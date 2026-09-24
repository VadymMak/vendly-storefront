import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only allow known video CDN hosts — prevents SSRF
const ALLOWED_HOSTS = new Set([
  'vidgen.x.ai',
  'fal.media',
  'v3.fal.media',
  'v3b.fal.media',
  'fal-cdn.com',
  'storage.googleapis.com',
]);

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  for (const allowed of ALLOWED_HOSTS) {
    if (hostname.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  // User must own the job and it must be succeeded
  const job = await db.studioJob.findFirst({
    where: {
      id:     jobId,
      userId: session.user.id,
      status: 'succeeded',
    },
    select: { id: true, outputUrl: true },
  });

  if (!job?.outputUrl) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  let parsed: URL;
  try {
    parsed = new URL(job.outputUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid video URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS allowed' }, { status: 400 });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Video host not allowed' }, { status: 403 });
  }

  // Server-side fetch — no CORS restrictions
  const upstream = await fetch(job.outputUrl, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'video/mp4';
  const contentLength = upstream.headers.get('content-length');

  if (!contentType.startsWith('video/')) {
    return NextResponse.json({ error: 'Unexpected content type' }, { status: 502 });
  }

  const filename = `vendshop-video-${jobId.slice(0, 8)}-${Date.now()}.mp4`;

  const headers = new Headers({
    'Content-Type':              contentType,
    'Content-Disposition':       `attachment; filename="${filename}"`,
    'Cache-Control':             'private, no-store',
    'X-Content-Type-Options':    'nosniff',
  });

  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return new Response(upstream.body, { status: 200, headers });
}
