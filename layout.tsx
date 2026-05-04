/**
 * POST /api/extract
 *
 * Receives one or more PDF files via multipart/form-data,
 * runs each through Document AI OCR, then through Claude for
 * structured extraction. Returns a flat array of instruments
 * with provenance (which file each came from).
 *
 * Phase 1: synchronous processing. Will time out on Vercel hobby
 * for large files / many files. For Phase 2 we'll move to a
 * background job pattern using Vercel Blob + a queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ocrPdf } from '@/lib/docai';
import { extractInstruments, type ExtractedInstrument } from '@/lib/claude';

// Run on Node.js runtime (not Edge) — we need Buffer + Google SDK
export const runtime = 'nodejs';
// Allow up to 60s on Vercel Pro; hobby will cap at 10s
export const maxDuration = 60;

interface ExtractedRow extends ExtractedInstrument {
  source_file: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const allRows: ExtractedRow[] = [];
    const errors: { file: string; error: string }[] = [];

    // Process files sequentially. Parallel is faster but blows up
    // memory limits and rate limits on free-tier APIs. Phase 2 work.
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        errors.push({ file: file.name, error: 'Not a PDF file' });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Step 1: OCR
        const ocrText = await ocrPdf(buffer);

        if (!ocrText || ocrText.trim().length < 20) {
          errors.push({
            file: file.name,
            error: 'OCR returned no usable text',
          });
          continue;
        }

        // Step 2: Claude extraction
        const instruments = await extractInstruments(ocrText, file.name);

        for (const inst of instruments) {
          allRows.push({ ...inst, source_file: file.name });
        }
      } catch (err: any) {
        errors.push({
          file: file.name,
          error: err?.message ?? String(err),
        });
      }
    }

    return NextResponse.json({
      rows: allRows,
      errors,
      processed: files.length,
    });
  } catch (err: any) {
    console.error('Extract route error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
