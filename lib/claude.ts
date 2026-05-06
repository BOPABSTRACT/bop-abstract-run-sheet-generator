import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedInstrument {
  vol_page: string;
  instrument_type: string;
  doc_date: string;
  recorded_date: string;
  grantor: string;
  grantee: string;
  description: string;
  comments: string;
  confidence: 'high' | 'medium' | 'low';
  notes_for_reviewer: string;
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY env var.');
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function extractInstruments(
  ocrText: string,
  filename: string
): Promise<ExtractedInstrument[]> {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert oil and gas title abstractor. Extract all legal instruments from the following OCR text from "${filename}".

For each instrument found, return a JSON array of objects with these exact fields:
- vol_page: volume and page reference (e.g. "DB 1094/697")
- instrument_type: type of instrument (e.g. "General Warranty Deed", "Oil and Gas Lease", "Assignment")
- doc_date: date the document was executed (e.g. "8/8/2011")
- recorded_date: date the document was recorded (e.g. "8/23/2011")
- grantor: the grantor(s) named in the instrument
- grantee: the grantee(s) named in the instrument
- description: brief description of the property or interest conveyed
- comments: any prior deed references, book/page references, or other notable details
- confidence: your confidence in the extraction - "high", "medium", or "low"
- notes_for_reviewer: any concerns or ambiguities the reviewer should check

Return ONLY a valid JSON array, no other text.

OCR TEXT:
${ocrText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];
  const clean = content.text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ExtractedInstrument[];
}
