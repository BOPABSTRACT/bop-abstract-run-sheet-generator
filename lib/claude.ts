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

2. VOL/PAGE format: Always format as "DB XXXX/XXX" using a forward slash. Examples:
   - "Deed Book 9968, page 415" → "DB 9968/415"
   - "D.B.V. 3616, Page 534" → "DB 3616/534"
   - "DB 3132-571" → "DB 3132/571"
   - "Volume 261, Page 445" → "DB 261/445"
   - If the prefix is different (e.g. "OB" for oil/gas, "MB" for miscellaneous) use that prefix instead of "DB".
   - Always use a forward slash "/" between volume and page, never a dash or comma.

3. INSTRUMENT TYPE must be fully specific. Never just write "Deed". Always write the full type:
   - "General Warranty Deed" — grantor warrants title against all claims forever
   - "Special Warranty Deed" — grantor warrants only against claims arising during their ownership
   - "Quitclaim Deed" — grantor conveys whatever interest they have with no warranty
   - "Trustee's Deed"
   - "Executor's Deed"
   - "Administrator's Deed"
   - "Sheriff's Deed"
   - "Oil and Gas Lease"
   - "Assignment of Oil and Gas Lease"
   - "Memorandum of Oil and Gas Lease"
   - "Right-of-Way and Easement Agreement"
   - "Memorandum of Temporary Easement and Right-of-Way Agreement"
   - "Will" / "Last Will and Testament"
   - "Release of Lien"
   - etc.
   To determine General vs Special warranty: look for the warranty clause. "Warrant and forever defend against ALL lawful claimants" = General Warranty. "Warrant and forever defend against claims of persons claiming BY, THROUGH, or UNDER the grantor" = Special Warranty. If the deed type is not stated and no warranty clause is present, write "Deed (type unstated)".

4. DESCRIPTION field: Describe the property conveyed in neutral, standardized language. Always use:
   - "Excepting and Reserving" (never "Saving and Excepting" or "Reserving and Excepting")
   - "more or less" (never "more-or-less" or "M/L")
   - "situate" (never "situated" or "lying")
   - "bounded and described as follows" for metes and bounds references

5. COMMENTS field: Include prior deed references, consideration, exceptions, and reservations. Always use:
   - "Excepting and Reserving" (standardized)
   - "Prior Reference:" to introduce prior deed citations, formatted as "Prior Reference: DB XXXX/XXX"
   - "Subject to:" for easements and restrictions

6. If a field cannot be determined from the text, return an empty string. Never guess or fabricate.

7. CONFIDENCE scoring:
   - "high" = all fields clearly readable, typed document
   - "medium" = most fields readable, some ambiguity
   - "low" = handwritten, heavily degraded, or significant fields missing

8. You MUST return ONLY a valid JSON array. No explanation, no markdown, no code fences, no preamble. Just the raw JSON array starting with [ and ending with ].

Return a JSON array of objects with these exact fields:
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

If no primary instruments are found, return an empty array: []

OCR TEXT:
${ocrText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  const clean = content.text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) {
      console.error('Claude did not return an array:', clean.slice(0, 200));
      return [];
    }
    return parsed as ExtractedInstrument[];
  } catch (e) {
    console.error('Claude JSON parse failed:', clean.slice(0, 200));
    return [];
  }
}
