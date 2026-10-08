const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  try {
    const res = await fetch(`${REEL_SERVICE_URL}/generate/music/preview?id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return new Response('Not found', { status: 404 });

    return new Response(res.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[api/reel/music/preview] Failed:', err);
    return new Response('Error', { status: 500 });
  }
}
