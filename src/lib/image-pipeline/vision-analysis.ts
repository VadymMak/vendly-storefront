import OpenAI from 'openai';
import { filterImages } from './quality-gate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropSuggestion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageScore {
  index: number;
  score: number;
  reason: string;
}

export interface HeroAnalysis {
  bestImageIndex: number;
  heroTextColor: string;
  heroOverlay: string;
  overlayOpacity: number;
  textPosition: 'top' | 'center' | 'bottom';
  cropSuggestion: CropSuggestion | null;
  reasoning: string;
  allScores: ImageScore[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGES = 5;

const FALLBACK: HeroAnalysis = {
  bestImageIndex: 0,
  heroTextColor:  '#ffffff',
  heroOverlay:    'dark-40%',
  overlayOpacity: 40,
  textPosition:   'center',
  cropSuggestion: null,
  reasoning:      'Fallback defaults applied — analysis unavailable',
  allScores:      [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

function normaliseTextPosition(raw: unknown): 'top' | 'center' | 'bottom' {
  if (raw === 'top' || raw === 'center' || raw === 'bottom') return raw;
  return 'center';
}

function parseCrop(raw: unknown): CropSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
  ) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  return null;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function analyzeImagesForHero(
  images: Array<{ buffer: Buffer; name: string }>,
  businessType: string,
  businessName: string,
): Promise<HeroAnalysis> {
  if (images.length === 0) return FALLBACK;

  // Run quality gate and take up to MAX_IMAGES passing images
  const { passed, failed: _failed } = await filterImages(images);
  const candidates = (passed.length > 0 ? passed : images.map((_img, i) => ({ ...FALLBACK, filePath: images[i]!.name })))
    .slice(0, MAX_IMAGES);

  // Map back to buffers (passed contains ImageAnalysis — match by filePath/name)
  const candidateBuffers = candidates.map((analysis) => {
    const match = images.find((img) => img.name === analysis.filePath);
    return match ?? images[0]!;
  });

  const client = new OpenAI();

  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = candidateBuffers.map(
    (img) => ({
      type:      'image_url' as const,
      image_url: { url: toDataUrl(img.buffer), detail: 'low' as const },
    }),
  );

  const userPrompt = `Business: ${businessName} (type: ${businessType})

I'm showing you ${candidateBuffers.length} candidate image${candidateBuffers.length > 1 ? 's' : ''} for the hero section of this business website.
The hero will have a text overlay with the business name and tagline.

For each image, score it 0-100 based on:
- Relevance to the business type
- Composition (good subject, not too busy)
- Space for text overlay (clear area for readable text)
- Visual appeal and professionalism
- Brightness distribution (not too dark/light overall)

Then select the best one and recommend:
- Text color: #ffffff (for dark images) or #000000 (for light images)
- Overlay type and opacity to ensure text readability
- Best position for text (top/center/bottom)
- Crop suggestion if the image needs it (coordinates for 16:9 aspect ratio hero)

Return ONLY valid JSON matching this structure:
{"bestImageIndex": 0, "heroTextColor": "#ffffff", "heroOverlay": "dark-40%", "overlayOpacity": 40, "textPosition": "center", "cropSuggestion": null, "reasoning": "...", "allScores": [{"index": 0, "score": 85, "reason": "..."}]}`;

  let raw: string;
  try {
    const response = await client.chat.completions.create({
      model:    'gpt-4o-mini',
      messages: [
        {
          role:    'system',
          content: 'You are a web design expert selecting the best hero image for a business website. You analyze composition, subject matter, brightness, and text overlay compatibility.',
        },
        {
          role:    'user',
          content: [...imageContent, { type: 'text' as const, text: userPrompt }],
        },
      ],
      max_tokens: 1024,
    });

    raw = response.choices[0]?.message.content ?? '';
  } catch {
    return FALLBACK;
  }

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const allScores: ImageScore[] = Array.isArray(parsed.allScores)
      ? (parsed.allScores as Array<Record<string, unknown>>).map((s) => ({
          index:  typeof s.index  === 'number' ? s.index  : 0,
          score:  typeof s.score  === 'number' ? s.score  : 0,
          reason: typeof s.reason === 'string' ? s.reason : '',
        }))
      : [];

    return {
      bestImageIndex: typeof parsed.bestImageIndex === 'number' ? parsed.bestImageIndex : 0,
      heroTextColor:  typeof parsed.heroTextColor  === 'string' ? parsed.heroTextColor  : '#ffffff',
      heroOverlay:    typeof parsed.heroOverlay    === 'string' ? parsed.heroOverlay    : 'dark-40%',
      overlayOpacity: typeof parsed.overlayOpacity === 'number' ? parsed.overlayOpacity : 40,
      textPosition:   normaliseTextPosition(parsed.textPosition),
      cropSuggestion: parseCrop(parsed.cropSuggestion),
      reasoning:      typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      allScores,
    };
  } catch {
    return FALLBACK;
  }
}
