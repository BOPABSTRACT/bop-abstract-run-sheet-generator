import { NextRequest, NextResponse } from 'next/server';
import { ocrPdfFromUrl } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

// Expects JSON body: { files: [{ url: string, filename: string }] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: { url: string; filename: string }[] = body.files ?? [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const allRows: ExtractedRow[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const { url, filename } of files) {
      if (!url || !filename) {
        errors.push({ file: filename ?? 'unknown', error: 'Missing url or filename' });
        continue;
      }

      try {
        const ocrText = await ocrPdfFromUrl(url);

        if (!ocrText || ocrText.trim().length < 20) {
          errors.push({ file: filename, error: 'OCR returned no usable text' });
          continue;
        }

        const instruments = await extractInstruments(ocrText, filename);
        for (const inst of instruments) {
          allRows.push({ ...inst, source_file: filename });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        errors.push({ file: filename, error: message });
      }
    }

    return NextResponse.json({ rows: allRows, errors, processed: files.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Extract route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
