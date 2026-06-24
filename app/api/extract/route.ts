import { NextRequest, NextResponse } from 'next/server';
import { ocrPdfFromUrl } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

// Normalize VOL/PAGE to standard format: XX XXXX/XXX
// Preserves county-specific book prefixes (RB, DB, OB, etc.)
// Handles: "DB 9968-415", "RB 546-3626", "D.B.V. 3616, Page 534",
//          "3132-571", "Deed Book 9968, page 415", "Record Book 546, Page 3626"
function normalizeVolPage(raw: string): string {
  if (!raw || raw.trim() === '') return raw;
  const s = raw.trim();

  // Already correct format e.g. "DB 9968/415" or "RB 546/3626"
  if (/^[A-Z]{1,3}\s+\d+\/\d+$/.test(s)) return s;

  // Extract prefix if present — preserve county-specific prefixes
  // RB = Record Book (Greene County PA and others)
  // DB = Deed Book, OB = Official Book, OR = Official Records
  // MB = Miscellaneous Book, WB = Will Book, LB = Lease Book
  // MR = Miscellaneous Records, DR = Deed Records
  let prefix = 'DB';
  const prefixMatch = s.match(/^([A-Za-z\.]+)\s*V?\s*/i);
  if (prefixMatch) {
    const raw_prefix = prefixMatch[1].replace(/\./g, '').replace(/V$/i, '').toUpperCase();
    if (['DB', 'RB', 'OB', 'OR', 'MB', 'WB', 'LB', 'MR', 'DR'].includes(raw_prefix)) {
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

// Post-process instrument type based on OCR text evidence
// Catches cases where Claude misclassifies corporate General Warranty Deeds
function correctDeedType(inst: ExtractedInstrument, ocrText: string): ExtractedInstrument {
  const type = (inst.instrument_type || '').toLowerCase();
  const ocr  = ocrText.toUpperCase();

  // Only attempt correction on deeds
  if (!type.includes('deed')) return inst;

  // If Claude said Special Warranty, check OCR for General Warranty evidence
  if (type === 'special warranty deed') {
    const hasGeneralWarranty =
      // Classic general warranty phrases
      ocr.includes('WARRANT AND FOREVER DEFEND') &&
      // No limiting "by through or under" language present
      !ocr.includes('BY, THROUGH OR UNDER') &&
      !ocr.includes('BY, THROUGH, OR UNDER') &&
      !ocr.includes('CLAIMING BY, THROUGH') &&
      !ocr.includes('SPECIAL WARRANTY');

    if (hasGeneralWarranty) {
      return {
        ...inst,
        instrument_type: 'General Warranty Deed',
        notes_for_reviewer:
          (inst.notes_for_reviewer ? inst.notes_for_reviewer + ' | ' : '') +
          'Auto-corrected from Special to General Warranty Deed — "WARRANT AND FOREVER DEFEND" found without limiting language in OCR text.',
      };
    }
  }

  return inst;
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
      ...correctDeedType(inst, ocrText),
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
