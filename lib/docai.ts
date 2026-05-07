// REST-based Document AI client - v3 (URL mode for Vercel Blob)

async function getAccessToken(keyJson: Record<string, string>): Promise<string> {
  const { createSign } = await import('crypto');
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: keyJson.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(keyJson.private_key, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

function getEnv() {
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  const location = process.env.GOOGLE_DOCAI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;

  if (!projectNumber || !processorId || !keyB64) {
    throw new Error(
      `Missing env vars: projectNumber=${projectNumber} processorId=${processorId} hasKey=${!!keyB64}`
    );
  }

  const keyJson = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const processorUrl = `https://${location}-documentai.googleapis.com/v1/projects/${projectNumber}/locations/${location}/processors/${processorId}:process`;

  return { keyJson, processorUrl };
}

// ─── Primary: fetch PDF from a public URL, send to Document AI ────────────
// Works with Vercel Blob URLs or any publicly accessible PDF URL
export async function ocrPdfFromUrl(pdfUrl: string): Promise<string> {
  const { keyJson, processorUrl } = getEnv();

  // Fetch the PDF from the blob URL
  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    throw new Error(`Failed to fetch PDF from URL (${pdfRes.status}): ${pdfUrl}`);
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const token = await getAccessToken(keyJson);

  const response = await fetch(processorUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Document AI REST error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.document?.text ?? '';
}

// ─── Fallback: inline base64 (kept for local dev / small files) ───────────
export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  const { keyJson, processorUrl } = getEnv();
  const token = await getAccessToken(keyJson);

  const response = await fetch(processorUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Document AI REST error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.document?.text ?? '';
}
