import { NextRequest, NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });
    }

    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname: `uploads/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      onUploadCompleted: {
        callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/blob-callback`,
      },
    });

    return NextResponse.json({ clientToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('upload-url error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
