import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// This route is no longer used — export is handled client-side.
// Kept as a placeholder to avoid 404s.
export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Use client-side export' }, { status: 410 });
}
