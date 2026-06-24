import { NextRequest, NextResponse } from 'next/server';
import { ocrPdfFromUrl } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

// Normalize VOL/PAGE to standard format: DB XXXX/XXX
// Handles: "DB 9968-415", "DBV 9968-415", "D.B.V. 3616, Page 534",
//          "3132-571", "Deed Book 9968, page 415", "Vol. 261, Page 445"
function normalizeVolPage(raw: string): string {
  if (!raw || raw.trim() === '') return raw;
  const s = raw.trim();

  // Already correct format e.g. "DB 9968/415"
  if (/^[A-Z]{1,3}\s+\d+\/\d+$/.test(s)) return s;

  // Extract prefix (DB, OB, MB, etc.) if present
  let prefix = 'DB';
  const prefixMatch = s.match(/^([A-Za-z\.]+)\s*V?\s*/i);
  if (prefixMatch) {
    const raw_prefix = prefixMatch[1].replace(/\./g, '').replace(/V$/i, '').toUpperCase();
    if (['DB', 'OB', 'MB', 'WB', 'LB'].includes(raw_prefix)) {
      prefix = raw_prefix;
    }
  }

  // Extract all numbers from the string
  const nums = s.match(/\d+/g);
  if (!nums || nums.length < 2) return s;

  // Last two numbers are volume and page
  const vol  = nums[nums.length - 2];
  const page = nums[nums.length - 1];

  return `${prefix} ${vol}/${page}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, filename } = body;

    if (!url || !filename) {
      return NextResponse.json({ error: 'Missing url or filename' }, { status: 400 });
    }

    let ocrText = '';
    try {
      ocrText = await ocrPdfFromUrl(url);
    } catch (ocrErr: unknown) {
      const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      console.error('OCR error:', msg);
      return NextResponse.json({ error: `OCR failed: ${msg}` }, { status: 500 });
    }

    if (!ocrText || ocrText.trim().length < 20) {
      return NextResponse.json({ error: 'OCR returned no usable text' }, { status: 422 });
    }

    let instruments: ExtractedInstrument[] = [];
    try {
      instruments = await extractInstruments(ocrText, filename);
    } catch (claudeErr: unknown) {
      const msg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
      console.error('Claude error:', msg);
      return NextResponse.json({ error: `Claude extraction failed: ${msg}` }, { status: 500 });
    }

    if (!Array.isArray(instruments)) {
      console.error('instruments was not an array:', instruments);
      instruments = [];
    }

    const rows: ExtractedRow[] = instruments.map((inst) => ({
      ...inst,
      vol_page: normalizeVolPage(inst.vol_page),
      source_file: filename,
    }));

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Extract route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
