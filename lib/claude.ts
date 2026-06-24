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
        content: `You are an expert oil and gas title abstractor preparing a chain of title run sheet. Extract all PRIMARY legal instruments from the OCR text of "${filename}".

CRITICAL RULES — follow these exactly:

1. ONLY extract the PRIMARY instrument on the page. Do NOT create separate entries for instruments mentioned in "Prior References", "Prior Deeds", "see also", or "referenced herein". Those are citations only.

2. INSTRUMENT TYPE must be fully specific. Never just write "Deed". Always write the full type:
   - "General Warranty Deed"
   - "Special Warranty Deed"
   - "Quitclaim Deed"
   - "Trustee's Deed"
   - "Executor's Deed"
   - "Oil and Gas Lease"
   - "Assignment of Oil and Gas Lease"
   - "Will" / "Last Will and Testament"
   - "Release of Lien"
   - etc.
   If the deed type is not stated, write "Deed (type unstated)".

3. DESCRIPTION field: Describe the property conveyed in neutral, standardized language. Always use:
   - "Excepting and Reserving" (never "Saving and Excepting" or "Reserving and Excepting")
   - "more or less" (never "more-or-less" or "M/L")
   - "situate" (never "situated" or "lying")
   - "bounded and described as follows" for metes and bounds references

4. COMMENTS field: Include prior deed references, consideration, exceptions, and reservations. Always use:
   - "Excepting and Reserving" (standardized)
   - "Prior Reference:" to introduce prior deed citations
   - "Subject to:" for easements and restrictions

5. If a field cannot be determined from the text, return an empty string. Never guess or fabricate.

6. CONFIDENCE scoring:
   - "high" = all fields clearly readable, typed document
   - "medium" = most fields readable, some ambiguity
   - "low" = handwritten, heavily degraded, or significant fields missing

Return ONLY a valid JSON array of objects with these exact fields:
- vol_page
- instrument_type
- doc_date
- recorded_date
- grantor
- grantee
- description
- comments
- confidence
- notes_for_reviewer

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
