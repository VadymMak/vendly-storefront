import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const BRAIN_URL = process.env.BRAIN_API_URL || 'https://multi-ai-chat-production.up.railway.app';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const response = await fetch(`${BRAIN_URL}/api/transform-image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transform-image] Brain error:', response.status, errorText);
      return NextResponse.json({ error: `Transform failed: ${response.statusText}` }, { status: response.status });
    }

    const compressionRatio = response.headers.get('X-Compression-Ratio');
    const dimensions = response.headers.get('X-Dimensions');
    const originalSize = response.headers.get('X-Original-Size');
    const outputSize = response.headers.get('X-Output-Size');

    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/webp',
        'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="transformed.webp"',
        'Content-Length': String(blob.size),
        ...(compressionRatio ? { 'X-Compression-Ratio': compressionRatio } : {}),
        ...(dimensions ? { 'X-Dimensions': dimensions } : {}),
        ...(originalSize ? { 'X-Original-Size': originalSize } : {}),
        ...(outputSize ? { 'X-Output-Size': outputSize } : {}),
      },
    });
  } catch (error) {
    console.error('[transform-image] Error:', error);
    return NextResponse.json({ error: 'Failed to transform image' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await fetch(`${BRAIN_URL}/api/transform-image/presets`);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
    }
    const presets = await response.json();
    return NextResponse.json(presets);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
  }
}
