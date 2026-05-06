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
        content: `You are an expert oil and gas title abstractor. Extract all legal instruments from the following OCR text from "${filename}". The text may be from old scanned documents and may contain dots, ellipses, or OCR artifacts — do your best to extract what you can.

For each instrument found, return a JSON array of objects with these exact fields:
- vol_page: volume and page reference (e.g. "DB 1094/697" or "BOOK 338 PAGE 317")
- instrument_type: type of instrument (e.g. "Oil and Gas Lease", "Deed", "Assignment")
- doc_date: date the document was executed, or empty string if not found
- recorded_date: date recorded, or empty string if not found  
- grantor: the grantor(s) - the party conveying rights
- grantee: the grantee(s) - the party receiving rights
- description: brief description of property or interest conveyed
- comments: any other notable details, prior references, consideration amount
- confidence: "high", "medium", or "low"
- notes_for_reviewer: any concerns or ambiguities

If you find at least one instrument, return it even if some fields are empty strings.
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
