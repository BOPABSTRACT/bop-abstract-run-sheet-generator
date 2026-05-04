/**
 * GET /api/health
 *
 * Simple health check that reports whether all required env vars are
 * configured. Doesn't actually call the external APIs (that costs money),
 * just verifies presence. Useful for debugging deployment issues.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const checks = {
    anthropic_api_key: Boolean(process.env.ANTHROPIC_API_KEY),
    google_project_id: Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID),
    google_processor_id: Boolean(process.env.GOOGLE_DOCAI_PROCESSOR_ID),
    google_location: Boolean(process.env.GOOGLE_DOCAI_LOCATION),
    google_service_account: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64),
  };

  const allGood = Object.values(checks).every(Boolean);

  return NextResponse.json({
    status: allGood ? 'ok' : 'misconfigured',
    checks,
    note: allGood
      ? 'All env vars present. Real extraction should work.'
      : 'Some env vars missing. See docs/SETUP.md.',
  });
}
