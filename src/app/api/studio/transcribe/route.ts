import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperuser, getOrCreateCredits, deductCredit } from '@/lib/credits';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function isAllowedTranscribeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|localhost)/i.test(parsed.hostname)) return false;
    const allowed = ['vercel-storage.com', 'replicate.delivery', 'fal.media'];
    return allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Transcription service not configured' }, { status: 500 });
  }

  const userId = session.user.id;
  const superuser = await isSuperuser(userId);

  if (!superuser) {
    const credits = await getOrCreateCredits(userId);
    const totalImages = credits.monthlyImages + credits.bonusImages;
    if (totalImages <= 0 && !credits.byokEnabled) {
      return NextResponse.json(
        { error: 'No credits remaining. Auto-captions cost 1 image credit.' },
        { status: 402 },
      );
    }
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    let audioBlob: Blob;
    let language: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      language = (formData.get('language') as string | null) ?? undefined;
      if (!file) {
        return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
      }
      audioBlob = file;
    } else {
      const body = await req.json() as { audio_url?: string; language?: string };
      language = body.language;
      if (!body.audio_url) {
        return NextResponse.json({ error: 'audio_url or audio file required' }, { status: 400 });
      }
      if (!isAllowedTranscribeUrl(body.audio_url)) {
        return NextResponse.json({ error: 'Audio URL not allowed' }, { status: 400 });
      }
      const audioRes = await fetch(body.audio_url);
      if (!audioRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch audio from URL' }, { status: 400 });
      }
      const cl = audioRes.headers.get('Content-Length');
      if (cl && parseInt(cl, 10) > TRANSCRIBE_MAX_BYTES) {
        return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 413 });
      }
      audioBlob = await audioRes.blob();
      if (audioBlob.size > TRANSCRIBE_MAX_BYTES) {
        return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 413 });
      }
    }

    const whisperForm = new FormData();
    whisperForm.append(
      'file',
      new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' }),
      'audio.mp3',
    );
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('response_format', 'verbose_json');
    whisperForm.append('timestamp_granularities[]', 'word');
    if (language) {
      whisperForm.append('language', language);
    }

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      return NextResponse.json({ error: `Whisper error: ${err}` }, { status: 500 });
    }

    const data = await whisperRes.json() as {
      text: string;
      language?: string;
      duration?: number;
      words?: Array<{ word: string; start: number; end: number }>;
    };

    if (!superuser) {
      await deductCredit(userId, 'image', 1);
    }

    return NextResponse.json({
      text: data.text,
      language: data.language,
      duration: data.duration,
      words: data.words ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
