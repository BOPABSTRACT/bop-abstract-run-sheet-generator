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

2. VOL/PAGE format: Always format as "DB XXXX/XXX" using a forward slash between volume and page number. Examples:
   - "Deed Book 9968, page 415" → "DB 9968/415"
   - "D.B.V. 3616, Page 534" → "DB 3616/534"
   - "DB 3132-571" → "DB 3132/571"
   - "Volume 261, Page 445" → "DB 261/445"
   - "DBV 9968-415" → "DB 9968/415"
   - ALWAYS use a forward slash "/" between volume and page. NEVER use a dash or comma.
   - ALWAYS use exactly "DB" as the prefix unless a different book type is clearly indicated (OB, MB, etc.)

3. INSTRUMENT TYPE — NEVER return just "Deed". Always return the FULL specific type.

   To determine General vs Special Warranty Deed, look for the WARRANTY CLAUSE:
   - "General Warranty Deed" — the grantor warrants title against ALL persons and ALL claims whatsoever. Key phrases: "warrant and defend against ALL lawful claimants", "warrant generally", "general warranty". Corporate grantors (coal companies, railroad companies) that include a warranty clause defending against ALL claimants = General Warranty Deed.
   - "Special Warranty Deed" — the grantor only warrants against claims arising BY, THROUGH, or UNDER the grantor themselves. Key phrases: "warrant and defend against claims of persons claiming BY, THROUGH, or UNDER grantor", "special warranty", "warrant specially".
   - If the deed says "SHALL AND WILL WARRANT AND FOREVER DEFEND" without limiting to claims "by, through, or under" — that is a GENERAL WARRANTY DEED.
   - If no warranty clause can be found: "Deed (type unstated)"

   Other full instrument types to use:
   - "Quitclaim Deed", "Trustee's Deed", "Executor's Deed", "Administrator's Deed", "Sheriff's Deed"
   - "Oil and Gas Lease", "Memorandum of Oil and Gas Lease"
   - "Assignment of Oil and Gas Lease"
   - "Right-of-Way and Easement Agreement"
   - "Memorandum of Temporary Easement and Right-of-Way Agreement"
   - "Will" / "Last Will and Testament"
   - "Release of Lien", "Satisfaction of Mortgage"

4. DATES — Return dates exactly as they appear in the document. Do not reformat or convert them. If the document says "May 13, 1997" return "May 13, 1997". If it says "6/18/1997" return "6/18/1997". Do not convert to ISO format or any other format.

5. DESCRIPTION field: Describe the property conveyed in neutral, standardized language. Always use:
   - "Excepting and Reserving" (never "Saving and Excepting" or "Reserving and Excepting")
   - "more or less" (never "more-or-less" or "M/L")
   - "situate" (never "situated" or "lying")
   - "bounded and described as follows" for metes and bounds references

6. COMMENTS field: Include prior deed references, consideration, exceptions, reservations, and any other encumbrances. Always use:
   - "Excepting and Reserving" (standardized)
   - "Prior Reference: DB XXXX/XXX" to introduce prior deed citations
   - "Subject to:" for easements and restrictions
   - "Together with:" for appurtenant rights

7. If a field cannot be determined from the text, return an empty string. Never guess or fabricate.

8. CONFIDENCE scoring:
   - "high" = all fields clearly readable, typed document
   - "medium" = most fields readable, some ambiguity
   - "low" = handwritten, heavily degraded, or significant fields missing

9. You MUST return ONLY a valid JSON array. No explanation, no markdown, no code fences, no preamble. Just the raw JSON array starting with [ and ending with ].

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
