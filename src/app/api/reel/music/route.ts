import { NextResponse } from 'next/server';

const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

export async function GET() {
  try {
    const res = await fetch(`${REEL_SERVICE_URL}/generate/music/catalog`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/reel/music] Failed:', err);
    return NextResponse.json({ tracks: [] });
  }
}
