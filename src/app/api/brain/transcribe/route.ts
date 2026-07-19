import { NextRequest, NextResponse } from 'next/server';

const BRAIN_API_KEY  = process.env.BRAIN_API_KEY  || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { audio_url } = (await req.json()) as { audio_url: string };
    if (!audio_url) {
      return NextResponse.json({ error: 'audio_url required' }, { status: 400 });
    }

    // Download audio from URL (ElevenLabs / Vercel Blob URL)
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio' }, { status: 400 });
    }
    const audioBlob = await audioRes.blob();

    // Send to OpenAI Whisper via multipart/form-data (no openai npm package needed)
    const formData = new FormData();
    formData.append('file', new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' }), 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + OPENAI_API_KEY },
      body:    formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      return NextResponse.json({ error: 'Whisper API error: ' + err }, { status: 500 });
    }

    const data = (await whisperRes.json()) as {
      text:   string;
      words?: Array<{ word: string; start: number; end: number }>;
    };

    return NextResponse.json({
      text:  data.text,
      words: data.words ?? [],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
