import { getVideoCreditCost } from '@/lib/studio/config';

export const PRESET_MAP = {
  og:      { label: 'OG Image',     display: '1200 × 630',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1200, target_height: 630  },
  cover:   { label: 'Cover / Hero', display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  product: { label: 'Product',      display: '800 × 800',   aspect_ratio: '1:1',  megapixels: '1',    target_width: 800,  target_height: 800  },
  story:   { label: 'Story / Reel', display: '630 × 1120',  aspect_ratio: '9:16', megapixels: '1',    target_width: 630,  target_height: 1120 },
  blog:    { label: 'Blog Header',  display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  thumb:   { label: 'Thumbnail',    display: '400 × 300',   aspect_ratio: '4:3',  megapixels: '0.25', target_width: 400,  target_height: 300  },
} as const;

export type PresetKey = keyof typeof PRESET_MAP;

export const STYLE_TAGS = [
  'photorealistic', 'cinematic', 'studio lighting', 'soft natural light',
  'golden hour', 'minimalist', 'dark moody', 'flat lay', 'bokeh background',
  '8K ultra detail', 'commercial', 'editorial',
] as const;

export const ENHANCE_MODES = [
  { value: 'og',       label: '📣 OG / Social banner' },
  { value: 'hero',     label: '🎯 Hero / Landing page' },
  { value: 'product',  label: '🛍 E-commerce product photo' },
  { value: 'interior', label: '🏠 Interior / Place atmosphere' },
  { value: 'food',     label: '🍽 Food / Menu photography' },
  { value: 'abstract', label: '✨ Abstract / Decorative' },
] as const;

export const OUTPUT_FORMATS = ['webp', 'png', 'jpeg'] as const;
export type OutputFormat = typeof OUTPUT_FORMATS[number];

export const QUICK_FILTERS = [
  { id: 'original', label: 'Original', filter: 'none' },
  { id: 'vivid',    label: 'Vivid',    filter: 'saturate(1.4) contrast(1.1)' },
  { id: 'warm',     label: 'Warm',     filter: 'sepia(0.2) saturate(1.2) brightness(1.05)' },
  { id: 'cool',     label: 'Cool',     filter: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)' },
  { id: 'bw',       label: 'B&W',      filter: 'grayscale(1)' },
  { id: 'sepia',    label: 'Sepia',    filter: 'sepia(0.8)' },
  { id: 'vintage',  label: 'Vintage',  filter: 'sepia(0.3) contrast(0.9) brightness(0.95) saturate(0.8)' },
  { id: 'dramatic', label: 'Dramatic', filter: 'contrast(1.4) brightness(0.9) saturate(1.2)' },
  { id: 'soft',     label: 'Soft',     filter: 'brightness(1.1) contrast(0.9) blur(0.5px)' },
  { id: 'fade',     label: 'Fade',     filter: 'brightness(1.1) saturate(0.7) contrast(0.9)' },
] as const;

export type QuickFilterId = typeof QUICK_FILTERS[number]['id'];

// Model list is fetched from /api/studio/models at runtime (see MODEL_CATALOG in src/lib/studio/config.ts)
export type FluxModel = string;

export const EXAMPLE_PROMPTS = [
  'A cozy coffee shop interior with warm lighting and wooden tables',
  'Product photography of a minimalist watch on white marble',
  'Street food market at night, vibrant colors, cinematic lighting',
  'Modern office space with floor-to-ceiling windows and city view',
] as const;

// ── Style chips — inject optimized prompt prefixes ───────────────────────────

export const STYLE_CHIPS = [
  { id: 'product',  label: 'Product photo', icon: '📦', promptPrefix: 'Professional product photography, clean studio lighting, sharp details, commercial e-commerce quality,' },
  { id: 'food',     label: 'Food',          icon: '🍽️', promptPrefix: 'Professional food photography, warm lighting, rich saturated colors, shallow depth of field, appetizing,' },
  { id: 'social',   label: 'Social post',   icon: '📱', promptPrefix: 'Modern social media content, vibrant colors, eye-catching composition, trending aesthetic,' },
  { id: 'beauty',   label: 'Beauty',        icon: '💅', promptPrefix: 'Beauty and wellness photography, soft flattering lighting, elegant composition, spa atmosphere,' },
  { id: 'interior', label: 'Interior',      icon: '🏠', promptPrefix: 'Professional interior photography, bright well-lit space, wide angle, inviting atmosphere, architectural detail,' },
  { id: 'custom',   label: 'Custom',        icon: '✨', promptPrefix: '' },
] as const;

export type StyleChipId = typeof STYLE_CHIPS[number]['id'];

// ── Enhancement presets (for /api/studio/edit — ImproveEditor) ──────────────

/**
 * Preservation-first prefix for ALL enhancement presets.
 * Anchors the generative model to the input image and prevents
 * subject hallucination (e.g. food → portrait).
 */
const IMPROVE_PREFIX = `Edit the uploaded image.

Keep ALL subjects, objects, people, food items, products, text, logos, background, layout, camera angle, framing, crop, perspective, pose, identity, and composition exactly as they are. Do not add, remove, replace, invent, redesign, restyle, or transform anything. Do not change the image category or subject matter.

Only improve image quality through photographic adjustments: lighting, exposure, white balance, color balance, contrast, highlight and shadow detail, noise reduction, and sharpness. The result must look like the same photograph captured with a better camera and better lighting.`;

export const ENHANCEMENT_PRESETS = [
  {
    id: 'professional',
    label: 'Professional',
    icon: 'sparkle',
    prompt: `${IMPROVE_PREFIX}

Apply balanced professional photo correction: improve exposure, neutral white balance, natural contrast, subtle clarity, and restrained sharpening. Maintain realism.`,
  },
  {
    id: 'bright_clean',
    label: 'Bright & Clean',
    icon: 'bright',
    prompt: `${IMPROVE_PREFIX}

Create a bright, clean finish: gently lift shadows, recover highlights, correct color cast, reduce distracting noise, and retain realistic colors and textures.`,
  },
  {
    id: 'warm_rich',
    label: 'Warm & Rich',
    icon: 'warm',
    prompt: `${IMPROVE_PREFIX}

Apply a subtle warm color grade: slightly warm the white balance, gently enrich existing colors, preserve accurate material and skin tones, and maintain natural contrast. Do not make colors neon, oversaturated, or artificial.`,
  },
  {
    id: 'crisp_detail',
    label: 'Sharp & Detailed',
    icon: 'sharp',
    prompt: `${IMPROVE_PREFIX}

Improve perceived clarity: apply mild denoising, edge-aware sharpening, and subtle local contrast. Do not fabricate details, alter texture, or make the image look HDR.`,
  },
  {
    id: 'soft_natural',
    label: 'Soft & Natural',
    icon: 'soft',
    prompt: `${IMPROVE_PREFIX}

Apply a soft, natural finish: slightly soften harsh contrast, preserve all real detail, maintain natural colors. Avoid blur, beauty retouching, or any change to people, objects, or scene content.`,
  },
  {
    id: 'studio_light',
    label: 'Studio Lighting',
    icon: 'light',
    prompt: `${IMPROVE_PREFIX}

Improve lighting consistency: fill in harsh shadows, improve rim lighting separation, correct color temperature, and enhance specular highlights on reflective surfaces. Keep the scene identical.`,
  },
] as const;

export type EnhancementPresetId = typeof ENHANCEMENT_PRESETS[number]['id'];

// ── Motion presets (for inline Animate panel) ────────────────────────────────

export const MOTION_PRESETS = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    prompt: 'Slow cinematic camera push-in, subtle natural movement, soft lighting, shallow depth of field, professional motion',
  },
  {
    id: 'food-motion',
    label: 'Food',
    prompt: 'Slow cinematic zoom in toward the dish, subtle steam rising, gentle movement in the background, warm natural lighting, appetizing motion',
  },
  {
    id: 'product-spin',
    label: 'Product Showcase',
    prompt: 'Smooth camera orbit around the product, clean studio lighting, subtle material texture highlights, professional showcase motion',
  },
  {
    id: 'portrait-motion',
    label: 'Portrait',
    prompt: 'Subtle natural movement, gentle hair sway, soft eye blink, warm lighting shift, natural and alive feeling',
  },
  {
    id: 'parallax',
    label: 'Parallax',
    prompt: 'Gentle parallax depth movement, soft clouds moving, subtle environmental motion, calm cinematic atmosphere',
  },
] as const;

export type MotionPresetId = typeof MOTION_PRESETS[number]['id'];

// ── Simplified size presets (replaces verbose PRESET_MAP for default UI) ─────

export const SIZE_PRESETS = [
  { id: 'instagram', label: 'Instagram',  subtitle: 'Feed post (4:5)',   aspect_ratio: '4:5',  megapixels: '1', target_width: 1080, target_height: 1350 },
  { id: 'square',    label: 'Square',     subtitle: '1:1',               aspect_ratio: '1:1',  megapixels: '1', target_width: 1080, target_height: 1080 },
  { id: 'story',     label: 'Story',      subtitle: 'Reel / TikTok',    aspect_ratio: '9:16', megapixels: '1', target_width: 1080, target_height: 1920 },
  { id: 'landscape', label: 'Landscape',  subtitle: 'Website / Cover',  aspect_ratio: '16:9', megapixels: '1', target_width: 1920, target_height: 1080 },
  { id: 'product',   label: 'Product',    subtitle: 'E-commerce (1:1)', aspect_ratio: '1:1',  megapixels: '1', target_width: 800,  target_height: 800  },
] as const;

export type SizePresetId = typeof SIZE_PRESETS[number]['id'];

// ── Video generation constants ───────────────────────────────────────────────

export const VIDEO_STYLE_CHIPS = [
  {
    id: 'product', label: 'Product', icon: '📦',
    promptSuffix:     'professional product commercial, crisp realistic details, controlled camera movement, premium studio lighting, clear hero composition, polished commercial quality',
    bestPromptSuffix: 'cinematic product videography, ultra-realistic studio lighting, precise product geometry, smooth controlled camera orbit, commercial 4K quality',
    defaultQuality:   'best' as const,
  },
  {
    id: 'food', label: 'Food', icon: '🍽️',
    promptSuffix:     'appetizing food commercial, warm natural lighting, rich realistic textures, shallow depth of field, gentle camera movement, premium restaurant presentation',
    bestPromptSuffix: 'cinematic food photography, warm ambient lighting, rich saturated colors, extreme shallow depth of field, appetizing texture detail, steam and movement, 4K',
    defaultQuality:   'best' as const,
  },
  {
    id: 'beauty', label: 'Beauty', icon: '💅',
    promptSuffix:     'premium beauty commercial, soft flattering lighting, elegant close-up movement, refined product details, luxurious calm atmosphere, polished editorial finish',
    bestPromptSuffix: 'luxury beauty commercial, soft flattering lighting, elegant smooth motion, premium skin texture detail, cinematic close-ups, 4K',
    defaultQuality:   'best' as const,
  },
  {
    id: 'social', label: 'Social Reel', icon: '📱',
    promptSuffix:     'vertical short-form video footage, one clear subject action, dynamic natural camera movement, vibrant modern color, clean uncluttered composition, fast visual pacing',
    bestPromptSuffix: 'cinematic vertical short-form footage, dynamic natural camera movement, vibrant modern color, clean composition with open space for later editing, professional visual pacing',
    defaultQuality:   'quick' as const,
  },
  {
    id: 'space', label: 'Space', icon: '🏠',
    promptSuffix:     'cinematic space showcase, bright natural lighting, smooth walkthrough camera movement, spacious premium atmosphere, refined architectural detail',
    bestPromptSuffix: 'cinematic interior walkthrough, smooth steadicam movement, natural sunlight, realistic depth and scale, architectural coherence, spacious premium atmosphere, 4K',
    defaultQuality:   'best' as const,
  },
  {
    id: 'service', label: 'Service', icon: '🔧',
    promptSuffix:     'professional service demonstration, trustworthy local business, clean before-and-after transformation, practical reliable atmosphere, sharp details',
    bestPromptSuffix: 'cinematic trade service commercial, expert craftsmanship in action, trustworthy documentary lighting, precise before-and-after transformation, clean professional workspace, 4K',
    defaultQuality:   'best' as const,
  },
  {
    id: 'hospitality', label: 'Hospitality', icon: '🏨',
    promptSuffix:     'inviting hospitality showcase, warm welcoming lighting, lifestyle vacation feel, soft ambient motion, premium comfort aesthetic',
    bestPromptSuffix: 'cinematic hospitality commercial, warm golden hour atmosphere, smooth sweeping camera movement, luxurious guest experience, inviting premium comfort, scenic travel feel, 4K',
    defaultQuality:   'best' as const,
  },
  {
    id: 'fitness', label: 'Fitness', icon: '🏋️',
    promptSuffix:     'energetic fitness footage, motivational atmosphere, dynamic movement, bold lighting, inspiring healthy lifestyle visuals',
    bestPromptSuffix: 'cinematic fitness commercial, powerful athletic motion, motivational dramatic lighting, dynamic camera work, inspiring energy, professional sports production, 4K',
    defaultQuality:   'quick' as const,
  },
  {
    id: 'fashion', label: 'Fashion', icon: '👗',
    promptSuffix:     'fashion lifestyle commercial, elegant editorial motion, soft natural lighting, premium clothing detail, aspirational campaign aesthetic',
    bestPromptSuffix: 'cinematic fashion editorial, elegant runway motion, luxurious fabric texture detail, premium lighting, polished lookbook camera movement, aspirational brand campaign, 4K',
    defaultQuality:   'best' as const,
  },
] as const;

export type VideoStyleChipId = typeof VIDEO_STYLE_CHIPS[number]['id'];

export const VIDEO_DURATIONS = [
  { seconds: 5  as const, label: '5s',  quickCredits: getVideoCreditCost('vid-quick', 5),  bestCredits: getVideoCreditCost('vid-best', 5),  eta: '~30s' },
  { seconds: 10 as const, label: '10s', quickCredits: getVideoCreditCost('vid-quick', 10), bestCredits: getVideoCreditCost('vid-best', 10), eta: '~60s' },
  { seconds: 15 as const, label: '15s', quickCredits: getVideoCreditCost('vid-quick', 15), bestCredits: getVideoCreditCost('vid-best', 15), eta: '~90s' },
];

export type VideoDurationValue = (typeof VIDEO_DURATIONS)[number]['seconds'];

export const VIDEO_ASPECT_RATIOS = [
  { value: '16:9', label: 'Landscape', subtitle: '16:9' },
  { value: '1:1',  label: 'Square',    subtitle: '1:1'  },
  { value: '9:16', label: 'Portrait',  subtitle: '9:16' },
] as const;

export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number]['value'];

// ── Platform image presets ────────────────────────────────────────────────────

export const PLATFORM_IMAGE_PRESETS = [
  { id: 'ig-feed',     platform: 'instagram', label: 'IG Feed Post',      subtitle: '4:5 · 1080×1350',  aspect_ratio: '4:5',  megapixels: '1', target_width: 1080, target_height: 1350, icon: '📸' },
  { id: 'ig-story',    platform: 'instagram', label: 'IG Story / Reel',   subtitle: '9:16 · 1080×1920', aspect_ratio: '9:16', megapixels: '1', target_width: 1080, target_height: 1920, icon: '📸' },
  { id: 'ig-square',   platform: 'instagram', label: 'IG Square',         subtitle: '1:1 · 1080×1080',  aspect_ratio: '1:1',  megapixels: '1', target_width: 1080, target_height: 1080, icon: '📸' },
  { id: 'tiktok',      platform: 'tiktok',    label: 'TikTok',            subtitle: '9:16 · 1080×1920', aspect_ratio: '9:16', megapixels: '1', target_width: 1080, target_height: 1920, icon: '🎵' },
  { id: 'yt-thumb',    platform: 'youtube',   label: 'YT Thumbnail',      subtitle: '16:9 · 1280×720',  aspect_ratio: '16:9', megapixels: '1', target_width: 1280, target_height: 720,  icon: '▶️' },
  { id: 'yt-banner',   platform: 'youtube',   label: 'YT Channel Banner', subtitle: '16:9 · 2560×1440', aspect_ratio: '16:9', megapixels: '1', target_width: 2560, target_height: 1440, icon: '▶️' },
  { id: 'fb-post',     platform: 'facebook',  label: 'FB Post',           subtitle: '1:1 · 1200×1200',  aspect_ratio: '1:1',  megapixels: '1', target_width: 1200, target_height: 1200, icon: '👥' },
  { id: 'fb-cover',    platform: 'facebook',  label: 'FB Cover',          subtitle: '16:9 · 820×312',   aspect_ratio: '16:9', megapixels: '1', target_width: 820,  target_height: 312,  icon: '👥' },
  { id: 'linkedin',    platform: 'linkedin',  label: 'LinkedIn Post',     subtitle: '16:9 · 1200×628',  aspect_ratio: '16:9', megapixels: '1', target_width: 1200, target_height: 628,  icon: '💼' },
  { id: 'pinterest',   platform: 'pinterest', label: 'Pinterest Pin',     subtitle: '2:3 · 1000×1500',  aspect_ratio: '2:3',  megapixels: '1', target_width: 1000, target_height: 1500, icon: '📌' },
  { id: 'product',     platform: 'ecommerce', label: 'Product Shot',      subtitle: '1:1 · 800×800',    aspect_ratio: '1:1',  megapixels: '1', target_width: 800,  target_height: 800,  icon: '🛒' },
  { id: 'landscape',   platform: 'generic',   label: 'Landscape',         subtitle: '16:9 · 1920×1080', aspect_ratio: '16:9', megapixels: '1', target_width: 1920, target_height: 1080, icon: '🖼️' },
  { id: 'square',      platform: 'generic',   label: 'Square',            subtitle: '1:1 · 1080×1080',  aspect_ratio: '1:1',  megapixels: '1', target_width: 1080, target_height: 1080, icon: '⬜' },
  { id: 'portrait',    platform: 'generic',   label: 'Portrait',          subtitle: '9:16 · 1080×1920', aspect_ratio: '9:16', megapixels: '1', target_width: 1080, target_height: 1920, icon: '📱' },
] as const;

export type PlatformImagePresetId = typeof PLATFORM_IMAGE_PRESETS[number]['id'];

// ── Platform video presets ────────────────────────────────────────────────────

export const PLATFORM_VIDEO_PRESETS = [
  { id: 'ig-reel',      platform: 'instagram', label: 'IG Reel',       subtitle: '9:16 · 90s max',  aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '📸' },
  { id: 'ig-story-v',   platform: 'instagram', label: 'IG Story',      subtitle: '9:16 · 15s max',  aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '📸' },
  { id: 'tiktok-v',     platform: 'tiktok',    label: 'TikTok',        subtitle: '9:16 · 60s max',  aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '🎵' },
  { id: 'yt-short',     platform: 'youtube',   label: 'YT Short',      subtitle: '9:16 · 60s max',  aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 10 as VideoDurationValue, icon: '▶️' },
  { id: 'yt-video',     platform: 'youtube',   label: 'YT Video',      subtitle: '16:9',            aspect_ratio: '16:9' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '▶️' },
  { id: 'fb-reel-v',    platform: 'facebook',  label: 'FB Reel',       subtitle: '9:16 · 90s max',  aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '👥' },
  { id: 'land-v',       platform: 'generic',   label: 'Landscape',     subtitle: '16:9',            aspect_ratio: '16:9' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '🖼️' },
  { id: 'sq-v',         platform: 'generic',   label: 'Square',        subtitle: '1:1',             aspect_ratio: '1:1'  as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '⬜' },
  { id: 'port-v',       platform: 'generic',   label: 'Portrait',      subtitle: '9:16',            aspect_ratio: '9:16' as VideoAspectRatio, defaultDuration: 5  as VideoDurationValue, icon: '📱' },
] as const;

export type PlatformVideoPresetId = typeof PLATFORM_VIDEO_PRESETS[number]['id'];
