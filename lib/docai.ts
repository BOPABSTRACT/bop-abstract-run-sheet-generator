// Google Document AI REST client
// Splits PDFs larger than 30 pages into chunks before sending to Document AI

const DOCAI_PAGE_LIMIT = 30;

async function getAccessToken(): Promise<string> {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyBase64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');

  const key = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(key.private_key, 'base64url');

  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Send a base64-encoded PDF (or chunk) to Document AI and return OCR text
async function ocrChunk(
  pdfBase64: string,
  accessToken: string,
  projectNumber: string,
  processorId: string,
  location: string
): Promise<string> {
  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectNumber}/locations/${location}/processors/${processorId}:process`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: { content: pdfBase64, mimeType: 'application/pdf' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Document AI REST error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.document?.text ?? '';
}

// Split a PDF buffer into chunks of at most maxPages pages
// Uses a simple byte-level page boundary detection
async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  maxPages: number
): Promise<Buffer[]> {
  // Dynamically import pdf-lib for server-side PDF splitting
  const { PDFDocument } = await import('pdf-lib');

  const srcDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = srcDoc.getPageCount();

  if (totalPages <= maxPages) {
    return [pdfBuffer];
  }

  const chunks: Buffer[] = [];
  let startPage = 0;

  while (startPage < totalPages) {
    const endPage = Math.min(startPage + maxPages, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: endPage - startPage },
      (_, i) => startPage + i
    );
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => chunkDoc.addPage(page));
    const chunkBytes = await chunkDoc.save();
    chunks.push(Buffer.from(chunkBytes));
    startPage = endPage;
  }

  return chunks;
}

export async function ocrPdfFromUrl(pdfUrl: string): Promise<string> {
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;
  const location = process.env.GOOGLE_DOCAI_LOCATION ?? 'us';

  if (!projectNumber || !processorId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_NUMBER or GOOGLE_DOCAI_PROCESSOR_ID');
  }

  // Fetch the PDF
  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    throw new Error(`Failed to fetch PDF from Blob: ${pdfRes.status}`);
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const accessToken = await getAccessToken();

  // Split into 30-page chunks if needed
  const chunks = await splitPdfIntoChunks(pdfBuffer, DOCAI_PAGE_LIMIT);

  // OCR each chunk and concatenate results
  const textParts: string[] = [];
  for (const chunk of chunks) {
    const chunkBase64 = chunk.toString('base64');
    const chunkText = await ocrChunk(
      chunkBase64,
      accessToken,
      projectNumber,
      processorId,
      location
    );
    textParts.push(chunkText);
  }

  return textParts.join('\n\n');
}
