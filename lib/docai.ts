import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

let cachedClient: DocumentProcessorServiceClient | null = null;

function getClient(): DocumentProcessorServiceClient {
  if (cachedClient) return cachedClient;

  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');

  const keyJson = Buffer.from(keyB64, 'base64').toString('utf-8');
  const credentials = JSON.parse(keyJson);
  cachedClient = new DocumentProcessorServiceClient({ credentials });
  return cachedClient;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.message) return String(e.message);
    if (e.details) return `gRPC error: ${String(e.details)}`;
    if (e.code) return `gRPC code ${String(e.code)}`;
    return JSON.stringify(err);
  }
  return String(err);
}

export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_DOCAI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID or GOOGLE_DOCAI_PROCESSOR_ID');
  }

  const client = getClient();
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  try {
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });
    return result.document?.text ?? '';
  } catch (err: unknown) {
    throw new Error(`Document AI failed: ${formatError(err)}`);
  }
}
