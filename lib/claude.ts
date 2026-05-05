/**
 * Claude (Anthropic) integration.
 * Extracts structured instrument data from OCR text.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedInstrument {
  instrument_name: string;
  artist: string;
  quantity: number;
  notes: string;
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY env var.');
  }
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
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are extracting instrument/gear requirements from a run sheet document.

Extract all instruments, equipment, and gear items from the following OCR text from "${filename}".

Return a JSON array of objects with these fields:
- instrument_name: the name of the instrument or piece of gear
- artist: the artist or performer it belongs to (empty string if unknown)
- quantity: number needed (default 1 if not specified)
- notes: any special requirements or notes (empty string if none)

Return ONLY valid JSON, no other text.

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
