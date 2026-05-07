import { NextRequest, NextResponse } from 'next/server';
import { ocrPdfFromUrl } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

// Accepts a SINGLE file: { url: string, filename: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, filename } = body;

    if (!url || !filename) {
      return NextResponse.json({ error: 'Missing url or filename' }, { status: 400 });
    }

    const ocrText = await ocrPdfFromUrl(url);

    if (!ocrText || ocrText.trim().length < 20) {
      return NextResponse.json({ error: 'OCR returned no usable text' }, { status: 422 });
    }

    const instruments = await extractInstruments(ocrText, filename);
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
