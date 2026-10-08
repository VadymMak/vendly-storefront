import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: string;
      digest?: string;
      stack?: string;
      url?: string;
      timestamp?: string;
    };
    console.error('[client-error]', {
      message: body.message,
      digest: body.digest,
      url: body.url,
      timestamp: body.timestamp,
      stack: body.stack,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
