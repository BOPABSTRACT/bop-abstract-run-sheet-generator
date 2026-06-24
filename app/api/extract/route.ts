import { NextRequest, NextResponse } from 'next/server';
import { ocrPdfFromUrl } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
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
      source_file: filename,
    }));

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Extract route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
