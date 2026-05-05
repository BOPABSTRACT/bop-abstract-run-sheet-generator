export async function ocrPdf(pdfBuffer: Buffer): Promise<string> {
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  const location = process.env.GOOGLE_DOCAI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCAI_PROCESSOR_ID;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;

  if (!projectNumber || !processorId || !keyB64) {
    throw new Error('Missing required environment variables');
  }

  // Get access token using service account credentials
  const keyJson = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  
  const token = await getAccessToken(keyJson);

  const url = `https://${location}-documentai.googleapis.com/v1/projects/${projectNumber}/locations/${location}/processors/${processorId}:process`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
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

async function getAccessToken(keyJson: Record<string, string>): Promise<string> {
  const { createSign } = await import('crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: keyJson.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

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
