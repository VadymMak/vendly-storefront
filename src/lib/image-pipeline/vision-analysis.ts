import OpenAI from 'openai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropSuggestion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextSafeZone {
  position: 'top' | 'center' | 'bottom';
  confidence: number;
}

export interface SemanticMatch {
  matchesBusiness: boolean;
  confidence: number;
  reason: string;
}

export interface SingleImageAnalysis {
  index: number;
  heroSuitable: boolean;
  heroScore: number;           // 1–10
  brightness: 'dark' | 'light' | 'mixed';
  recommendedTextColor: string;
  recommendedOverlay: string;
  textSafeZone: TextSafeZone;
  cropSuggestion: (CropSuggestion & { shouldCrop: boolean; reason: string }) | null;
  contentDescription: string;
  semanticMatch: SemanticMatch;
  issues: string[];
  recommendation: 'PASS' | 'FIX' | 'REGENERATE' | 'REJECT';
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
  // Extended fields from per-image analysis
  perImageResults: SingleImageAnalysis[];
  bestImageBrightness: 'dark' | 'light' | 'mixed';
  bestImageRecommendation: 'PASS' | 'FIX' | 'REGENERATE' | 'REJECT';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGES = 5;

const FALLBACK: HeroAnalysis = {
  bestImageIndex:          0,
  heroTextColor:           '#ffffff',
  heroOverlay:             'dark-40%',
  overlayOpacity:          40,
  textPosition:            'center',
  cropSuggestion:          null,
  reasoning:               'Fallback defaults applied — analysis unavailable',
  allScores:               [],
  perImageResults:         [],
  bestImageBrightness:     'mixed',
  bestImageRecommendation: 'PASS',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

function normaliseTextPosition(raw: unknown): 'top' | 'center' | 'bottom' {
  if (raw === 'top' || raw === 'center' || raw === 'bottom') return raw;
  return 'center';
}

function normaliseBrightness(raw: unknown): 'dark' | 'light' | 'mixed' {
  if (raw === 'dark' || raw === 'light' || raw === 'mixed') return raw;
  return 'mixed';
}

function normaliseRecommendation(raw: unknown): 'PASS' | 'FIX' | 'REGENERATE' | 'REJECT' {
  if (raw === 'PASS' || raw === 'FIX' || raw === 'REGENERATE' || raw === 'REJECT') return raw;
  return 'PASS';
}

function overlayToOpacity(overlay: string): number {
  const match = overlay.match(/(\d+)%/);
  return match ? parseInt(match[1]!, 10) : 40;
}

function parseCropSuggestion(raw: unknown): (CropSuggestion & { shouldCrop: boolean; reason: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.should_crop === false) return null;
  if (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
  ) {
    return {
      x:          r.x,
      y:          r.y,
      width:      r.width,
      height:     r.height,
      shouldCrop: Boolean(r.should_crop),
      reason:     typeof r.reason === 'string' ? r.reason : '',
    };
  }
  return null;
}

// ─── Per-image analysis ───────────────────────────────────────────────────────

async function analyzeOneImage(
  client: OpenAI,
  buffer: Buffer,
  index: number,
  total: number,
  businessType: string,
  businessName: string,
): Promise<SingleImageAnalysis> {
  const userPrompt = `Business type: ${businessType}
Business name: ${businessName}
Image ${index + 1} of ${total}.

Analyze and return JSON only (no markdown, no explanation):
{
  "hero_suitable": true,
  "hero_score": 7,
  "brightness": "dark",
  "recommended_text_color": "#FFFFFF",
  "recommended_overlay": "dark-40%",
  "text_safe_zone": {
    "position": "center",
    "confidence": 8
  },
  "crop_suggestion": {
    "should_crop": false,
    "x": 0, "y": 0, "width": 0, "height": 0,
    "reason": ""
  },
  "content_description": "Brief description",
  "semantic_match": {
    "matches_business": true,
    "confidence": 8,
    "reason": "reason"
  },
  "issues": [],
  "recommendation": "PASS"
}`;

  let raw = '';
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role:    'system',
          content: 'You are an image analyzer for a website builder. Analyze this image for use as a hero section background.',
        },
        {
          role:    'user',
          content: [
            { type: 'image_url' as const, image_url: { url: toDataUrl(buffer), detail: 'low' as const } },
            { type: 'text' as const, text: userPrompt },
          ],
        },
      ],
      max_tokens: 512,
    });
    raw = response.choices[0]?.message.content ?? '';
  } catch {
    // Return safe fallback for this image
    return {
      index, heroSuitable: true, heroScore: 5, brightness: 'mixed',
      recommendedTextColor: '#ffffff', recommendedOverlay: 'dark-40%',
      textSafeZone: { position: 'center', confidence: 5 },
      cropSuggestion: null, contentDescription: '', issues: [],
      semanticMatch: { matchesBusiness: true, confidence: 5, reason: '' },
      recommendation: 'PASS',
    };
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const p = JSON.parse(cleaned) as Record<string, unknown>;

    const textSafeZoneRaw = (p.text_safe_zone ?? {}) as Record<string, unknown>;
    const semanticRaw     = (p.semantic_match ?? {}) as Record<string, unknown>;

    return {
      index,
      heroSuitable:         Boolean(p.hero_suitable),
      heroScore:            typeof p.hero_score === 'number' ? p.hero_score : 5,
      brightness:           normaliseBrightness(p.brightness),
      recommendedTextColor: typeof p.recommended_text_color === 'string' ? p.recommended_text_color : '#ffffff',
      recommendedOverlay:   typeof p.recommended_overlay    === 'string' ? p.recommended_overlay    : 'dark-40%',
      textSafeZone: {
        position:   normaliseTextPosition(textSafeZoneRaw.position),
        confidence: typeof textSafeZoneRaw.confidence === 'number' ? textSafeZoneRaw.confidence : 5,
      },
      cropSuggestion: parseCropSuggestion(p.crop_suggestion),
      contentDescription: typeof p.content_description === 'string' ? p.content_description : '',
      semanticMatch: {
        matchesBusiness: Boolean(semanticRaw.matches_business),
        confidence:      typeof semanticRaw.confidence === 'number' ? semanticRaw.confidence : 5,
        reason:          typeof semanticRaw.reason     === 'string' ? semanticRaw.reason     : '',
      },
      issues:         Array.isArray(p.issues) ? (p.issues as string[]) : [],
      recommendation: normaliseRecommendation(p.recommendation),
    };
  } catch {
    return {
      index, heroSuitable: true, heroScore: 5, brightness: 'mixed',
      recommendedTextColor: '#ffffff', recommendedOverlay: 'dark-40%',
      textSafeZone: { position: 'center', confidence: 5 },
      cropSuggestion: null, contentDescription: '', issues: [],
      semanticMatch: { matchesBusiness: true, confidence: 5, reason: '' },
      recommendation: 'PASS',
    };
  }
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function analyzeImagesForHero(
  images: Array<{ buffer: Buffer; name: string }>,
  businessType: string,
  businessName: string,
): Promise<HeroAnalysis> {
  if (images.length === 0) return FALLBACK;

  const candidates = images.slice(0, MAX_IMAGES);
  const client     = new OpenAI();

  // Analyze each image in parallel
  const perImageResults = await Promise.all(
    candidates.map((img, i) =>
      analyzeOneImage(client, img.buffer, i, candidates.length, businessType, businessName),
    ),
  );

  // Pick the best: highest heroScore among PASS/FIX recommendations, not REJECT
  const eligible = perImageResults.filter((r) => r.recommendation !== 'REJECT');
  const best     = (eligible.length > 0 ? eligible : perImageResults)
    .reduce((a, b) => (b.heroScore > a.heroScore ? b : a));

  const allScores: ImageScore[] = perImageResults.map((r) => ({
    index:  r.index,
    score:  r.heroScore * 10,  // convert 1–10 to 0–100
    reason: r.contentDescription,
  }));

  // Extract crop coords if AI recommends a crop
  const cropRaw = best.cropSuggestion;
  const cropSuggestion: CropSuggestion | null =
    cropRaw?.shouldCrop
      ? { x: cropRaw.x, y: cropRaw.y, width: cropRaw.width, height: cropRaw.height }
      : null;

  return {
    bestImageIndex:          best.index,
    heroTextColor:           best.recommendedTextColor,
    heroOverlay:             best.recommendedOverlay,
    overlayOpacity:          overlayToOpacity(best.recommendedOverlay),
    textPosition:            best.textSafeZone.position,
    cropSuggestion,
    reasoning:               best.contentDescription,
    allScores,
    perImageResults,
    bestImageBrightness:     best.brightness,
    bestImageRecommendation: best.recommendation,
  };
}
