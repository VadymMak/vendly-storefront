import Replicate from 'replicate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedImage {
  buffer: Buffer;
  prompt: string;
  model: string;
  cost: number;
}

// ─── Business type → base prompt mapping ──────────────────────────────────────

const BUSINESS_TYPE_PROMPTS: Record<string, string> = {
  physical:      'Professional photo of a modern retail store interior with well-organized product displays and welcoming atmosphere',
  food:          'Professional photo of a cozy restaurant interior with warm lighting, wooden tables, appetizing food display',
  restaurant:    'Professional photo of an elegant restaurant dining room with ambient lighting, set tables, and inviting decor',
  beauty:        'Professional photo of a modern beauty salon interior, clean aesthetic, mirrors and styling stations',
  repair:        'Professional photo of a clean auto repair workshop, organized tools, car on lift',
  home_services: 'Professional photo of a professional handyman at work in a clean modern home interior',
  digital:       'Professional photo of a modern tech office workspace with multiple monitors, clean desk setup',
  education:     'Professional photo of a bright modern classroom, students engaged in learning',
  health:        'Professional photo of a clean medical clinic reception, friendly atmosphere',
};

const QUALITY_SUFFIX = ', high quality, 4K, commercial photography, no text, no watermark';

function buildPrompt(businessType: string, style: 'photo' | 'illustration'): string {
  const base =
    BUSINESS_TYPE_PROMPTS[businessType] ??
    'Professional photo of a modern business office with clean design and welcoming atmosphere';

  const styled =
    style === 'illustration'
      ? base.replace(/^Professional photo/i, 'Modern flat illustration')
      : base;

  return `${styled}${QUALITY_SUFFIX}`;
}

// ─── generateHeroImage ────────────────────────────────────────────────────────

export async function generateHeroImage(
  businessName: string,
  businessType: string,
  style: 'photo' | 'illustration',
): Promise<GeneratedImage> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN env var is missing');
  }

  const prompt = buildPrompt(businessType, style);

  const replicate = new Replicate({ auth: token });

  const output = await replicate.run('black-forest-labs/flux-schnell', {
    input: {
      prompt,
      num_outputs:    1,
      aspect_ratio:   '16:9',
      output_format:  'webp',
      output_quality: 90,
    },
  });

  // output is an array of URL strings (or ReadableStream objects depending on SDK version)
  const outputArray = Array.isArray(output) ? output : [output];
  const firstItem = outputArray[0];

  if (!firstItem) {
    throw new Error(`Replicate returned empty output for business "${businessName}"`);
  }

  // Resolve to URL string — may be a string or a FileOutput object with a url() method
  let imageUrl: string;
  if (typeof firstItem === 'string') {
    imageUrl = firstItem;
  } else if (
    typeof firstItem === 'object' &&
    firstItem !== null &&
    typeof (firstItem as { url?: () => string }).url === 'function'
  ) {
    imageUrl = (firstItem as { url: () => string }).url();
  } else {
    imageUrl = String(firstItem);
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download generated image: HTTP ${imgRes.status}`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    prompt,
    model: 'flux-schnell',
    cost:  0.003,
  };
}

// ─── shouldRegenerate ─────────────────────────────────────────────────────────

export function shouldRegenerate(passedImages: number, bestScore: number): boolean {
  return passedImages === 0 || bestScore < 40;
}
