import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

let cachedClient: DocumentProcessorServiceClient | null = null;

function getClient(): DocumentProcessorServiceClient {
  if (cachedClient) return cachedClient;

  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyB64) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 env var.');
  }

  try {
    const keyJson = Buffer.from(keyB64, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyJson);
    cachedClient = new DocumentProcessorServiceClient({ credentials });
    return cachedClient;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    throw new Error(`Failed to initialize Document AI client: ${msg}`);
  }
}

export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_DOCAI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID or GOOGLE_DOCAI_PROCESSOR_ID env var.');
  }

  try {
    const client = getClient();
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });
    return result.document?.text ?? '';
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Document AI error: ${err.message}`);
    }
    throw new Error(`Document AI error: ${JSON.stringify(err)}`);
  }
}
