import type { TextOverlay } from '@/lib/slideshow-renderer';

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export type CaptionStyle = 'subtitle' | 'karaoke' | 'word-by-word' | 'sentence';

export interface CaptionOptions {
  style: CaptionStyle;
  wordsPerLine: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
  animation: TextOverlay['animation'];
  offsetSeconds: number;
}

const DEFAULT_OPTIONS: CaptionOptions = {
  style: 'subtitle',
  wordsPerLine: 4,
  fontSize: 36,
  fontFamily: 'Inter',
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.7)',
  position: 'bottom',
  animation: 'fade-in',
  offsetSeconds: 0,
};

export function groupWordsIntoCaptions(
  words: WhisperWord[],
  options: Partial<CaptionOptions> = {},
): TextOverlay[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const offset = opts.offsetSeconds;

  if (words.length === 0) return [];

  switch (opts.style) {
    case 'word-by-word':
      return words.map(w => ({
        text: w.word.trim(),
        position: opts.position,
        style: 'custom' as const,
        from: w.start + offset,
        to: w.end + offset + 0.05,
        fontSize: Math.round(opts.fontSize * 1.5),
        fontFamily: opts.fontFamily,
        fontWeight: 'bold' as const,
        color: opts.color,
        backgroundColor: opts.backgroundColor,
        animation: 'scale-up' as const,
        animationDuration: 0.15,
      }));

    case 'karaoke':
      return groupByChunks(words, opts.wordsPerLine * 2).map(chunk => ({
        text: chunk.map(w => w.word).join(' ').trim(),
        position: opts.position,
        style: 'custom' as const,
        from: chunk[0].start + offset,
        to: chunk[chunk.length - 1].end + offset + 0.2,
        fontSize: opts.fontSize,
        fontFamily: opts.fontFamily,
        color: opts.color,
        backgroundColor: opts.backgroundColor,
        animation: 'typewriter' as const,
        animationMode: 'per-word' as const,
        animationDuration: chunk[chunk.length - 1].end - chunk[0].start,
      }));

    case 'sentence':
      return groupBySentences(words).map(chunk => ({
        text: chunk.map(w => w.word).join(' ').trim(),
        position: opts.position,
        style: 'subtitle' as const,
        from: chunk[0].start + offset,
        to: chunk[chunk.length - 1].end + offset + 0.15,
        fontSize: opts.fontSize,
        fontFamily: opts.fontFamily,
        color: opts.color,
        backgroundColor: opts.backgroundColor,
        animation: opts.animation,
      }));

    case 'subtitle':
    default:
      return groupByChunks(words, opts.wordsPerLine).map(chunk => ({
        text: chunk.map(w => w.word).join(' ').trim(),
        position: opts.position,
        style: 'subtitle' as const,
        from: chunk[0].start + offset,
        to: chunk[chunk.length - 1].end + offset + 0.15,
        fontSize: opts.fontSize,
        fontFamily: opts.fontFamily,
        color: opts.color,
        backgroundColor: opts.backgroundColor,
        animation: opts.animation,
      }));
  }
}

function groupByChunks(words: WhisperWord[], size: number): WhisperWord[][] {
  const chunks: WhisperWord[][] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
}

function groupBySentences(words: WhisperWord[]): WhisperWord[][] {
  const sentences: WhisperWord[][] = [];
  let current: WhisperWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    current.push(w);
    const endsWithPunct = /[.!?;]$/.test(w.word.trim());
    const nextWord = words[i + 1];
    const longPause = nextWord && nextWord.start - w.end > 0.8;

    if (endsWithPunct || longPause || current.length >= 12) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length > 0) sentences.push(current);
  return sentences;
}

export function captionsToTimelineClips(
  captions: TextOverlay[],
  trackId: string,
): Array<{
  trackId: string;
  clip: {
    type: 'text';
    startTime: number;
    duration: number;
    overlayData: TextOverlay;
  };
}> {
  return captions
    .filter(c => c.from != null && c.to != null)
    .map(caption => ({
      trackId,
      clip: {
        type: 'text' as const,
        startTime: caption.from!,
        duration: Math.max(0.1, caption.to! - caption.from!),
        overlayData: caption,
      },
    }));
}
