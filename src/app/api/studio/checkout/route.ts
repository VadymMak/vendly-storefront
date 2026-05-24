import { NextResponse } from 'next/server';

// Legacy: $5 one-time Studio access payment (removed — all logged-in users now get free tier)
export async function POST() {
  return NextResponse.json(
    { error: 'Studio access is now free for all registered users.' },
    { status: 410 },
  );
}
