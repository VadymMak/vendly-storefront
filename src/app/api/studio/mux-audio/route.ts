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
    const video = formData.get('video') as File | null;
    const audio = formData.get('audio') as File | null;

    if (!video || !audio) {
      return NextResponse.json({ error: 'Both video and audio files are required' }, { status: 400 });
    }

    const brainFormData = new FormData();
    brainFormData.append('video', video);
    brainFormData.append('audio', audio);

    const response = await fetch(`${BRAIN_URL}/api/mux-audio`, {
      method: 'POST',
      body: brainFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[mux-audio] Brain error:', response.status, errorText);
      return NextResponse.json({ error: `Mux failed: ${response.statusText}` }, { status: response.status });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="video-with-audio.mp4"',
        'Content-Length': String(blob.size),
      },
    });
  } catch (error) {
    console.error('[mux-audio] Error:', error);
    return NextResponse.json({ error: 'Failed to merge audio with video' }, { status: 500 });
  }
}
