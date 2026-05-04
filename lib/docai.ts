/**
 * Google Document AI integration.
 * Reads service account credentials from base64-encoded env var.
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

let cachedClient: DocumentProcessorServiceClient | null = null;

/**
 * Build a DocumentProcessorServiceClient from credentials in env vars.
 * Cached so we don't reinit on every request.
 */
function getClient(): DocumentProcessorServiceClient {
  if (cachedClient) return cachedClient;

  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyB64) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 env var. See docs/SETUP.md.'
    );
  }

  const keyJson = Buffer.from(keyB64, 'base64').toString('utf-8');
  const credentials = JSON.parse(keyJson);

  cachedClient = new DocumentProcessorServiceClient({ credentials });
  return cachedClient;
}

/**
 * Run OCR on a PDF buffer. Returns the extracted text.
 *
 * For Phase 1 we just return the full text content. In Phase 2 we'll
 * also return the structural data (paragraphs, tables, bounding boxes)
 * which Document AI provides for richer review UX.
 */
export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_DOCAI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      'Missing GOOGLE_CLOUD_PROJECT_ID or GOOGLE_DOCAI_PROCESSOR_ID env var. See docs/SETUP.md.'
    );
  }

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
}
