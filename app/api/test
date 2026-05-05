import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const results: Record<string, string> = {};

  // Test 1: Check env vars
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  results.has_key = keyB64 ? `yes, length=${keyB64.length}` : 'NO';

  // Test 2: Try to decode it
  if (keyB64) {
    try {
      const keyJson = Buffer.from(keyB64, 'base64').toString('utf-8');
      const parsed = JSON.parse(keyJson);
      results.key_decode = 'ok';
      results.key_type = parsed.type ?? 'missing';
      results.key_project = parsed.project_id ?? 'missing';
    } catch (err: unknown) {
      results.key_decode = err instanceof Error ? err.message : String(err);
    }
  }

  // Test 3: Try to init Document AI client
  try {
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
    const keyJson = Buffer.from(keyB64!, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyJson);
    new DocumentProcessorServiceClient({ credentials });
    results.client_init = 'ok';
  } catch (err: unknown) {
    results.client_init = err instanceof Error ? err.message : JSON.stringify(err);
  }

  return NextResponse.json(results);
}
