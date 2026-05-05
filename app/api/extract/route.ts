import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        results.push({ name: 'unknown', size: 0, error: 'not a file' });
        continue;
      }
      results.push({
        name: file.name,
        size: file.size,
        type: file.type,
        error: null,
      });
    }

    return NextResponse.json({ rows: [], errors: [], debug: results, processed: files.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
