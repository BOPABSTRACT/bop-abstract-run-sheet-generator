import { NextRequest, NextResponse } from 'next/server';
import { ocrPdf } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const allRows: ExtractedRow[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        errors.push({ file: 'unknown', error: 'Not a valid file object' });
        continue;
      }

      const fileName = file.name || 'unnamed.pdf';

      if (!fileName.toLowerCase().endsWith('.pdf')) {
        errors.push({ file: fileName, error: 'Not a PDF file' });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
       const ocrText = await ocrPdf(buffer);
console.log('OCR TEXT SAMPLE:', ocrText.substring(0, 500));

        if (!ocrText || ocrText.trim().length < 20) {
          errors.push({ file: fileName, error: 'OCR returned no usable text' });
          continue;
        }

        const instruments = await extractInstruments(ocrText, fileName);
        for (const inst of instruments) {
          allRows.push({ ...inst, source_file: fileName });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        errors.push({ file: fileName, error: message });
      }
    }

    return NextResponse.json({ rows: allRows, errors, processed: files.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Extract route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
