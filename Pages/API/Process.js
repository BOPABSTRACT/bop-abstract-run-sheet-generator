// This goes in: api/process-documents.js
// (Create this file in your Vercel project)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documents } = req.body;

    // Validate input
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: documents array required' 
      });
    }

    if (documents.length > 20) {
      return res.status(400).json({ 
        error: 'Maximum 20 documents per request' 
      });
    }

    // Get API key from environment
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(500).json({ 
        error: 'API key not configured' 
      });
    }

    // Build extraction prompt
    const EXTRACTION_PROMPT = `You are an expert oil and gas title abstractor. Extract information from these public records documents and return it in JSON format.

For each document found, extract:
- VOL/PAGE (recording volume and page)
- Instrument Type (e.g., General Warranty Deed, Special Warranty Deed, Mortgage, Assignment, etc.)
- Doc. Date (document date)
- Recorded Date (recording date)
- Grantor (person/entity conveying property)
- Grantee (person/entity receiving property)
- Description (property description from document)
- Comments (any reservations, exceptions, or important notes)

Return ONLY valid JSON in this exact format with no markdown or extra text:
{
  "documents": [
    {
      "volPage": "DB 1094/697",
      "instrumentType": "General Warranty Deed",
      "docDate": "8/8/2011",
      "recordedDate": "8/23/2011",
      "grantor": "Name",
      "grantee": "Name",
      "description": "Description text",
      "comments": "Any notes"
    }
  ]
}`;

    // Build message content with documents
    const messageContent = [
      {
        type: 'text',
        text: EXTRACTION_PROMPT
      },
      ...documents.map(doc => ({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: doc.base64
        }
      }))
    ];

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(response.status).json({ 
        error: data.error?.message || 'API error' 
      });
    }

    // Parse Claude's response
    const responseText = data.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON in response:', responseText);
      return res.status(500).json({ 
        error: 'Failed to extract structured data from response' 
      });
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      success: true,
      extractedData,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}
