import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

const DEFAULT_VOICES: Record<string, string> = {
  adam:    'pNInz6obpgDQGcFmaJgB',
  rachel:  '21m00Tcm4TlvDq8ikWAM',
  arnold:  'VR6AewLTigWG4xSOukaG',
  elli:    'MF3mGyEYCl7XYWbV9V6O',
  antonio: 'ErXwobaYiN019PkySvjV',
};

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      text?: string;
      voice_id?: string;
      elevenlabs_api_key?: string;
      language?: string;
      stability?: number;
      similarity_boost?: number;
    };

    const {
      text,
      voice_id = 'adam',
      elevenlabs_api_key,
      language = 'en',
      stability = 0.5,
      similarity_boost = 0.75,
    } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long. Maximum 5000 characters.' }, { status: 400 });
    }

    const elKey = elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
    if (!elKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured. Pass elevenlabs_api_key or set ELEVENLABS_API_KEY env var.' },
        { status: 500 },
      );
    }

    const resolvedVoiceId = DEFAULT_VOICES[voice_id.toLowerCase()] ?? voice_id;

    // eleven_multilingual_v2 supports SK, CS, UK, DE and 25+ languages
    // eleven_monolingual_v1 deprecated July 2025 — use eleven_multilingual_v2 for all languages
    const modelId = 'eleven_multilingual_v2';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
          voice_settings: { stability, similarity_boost },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown ElevenLabs error');
      return NextResponse.json(
        { error: `ElevenLabs error ${response.status}: ${errText}` },
        { status: 502 },
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const blob = await put(`brain/audio/${Date.now()}.mp3`, audioBuffer, {
      access: 'public',
      contentType: 'audio/mpeg',
    });

    return NextResponse.json({
      url:        blob.url,
      media:      { type: 'audio', url: blob.url },
      voice_id:   resolvedVoiceId,
      language,
      model_id:   modelId,
      characters: text.length,
    });
  } catch (error) {
    console.error('[brain/voiceover]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
