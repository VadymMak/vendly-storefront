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

export const FLUX_MODELS = [
  { value: 'schnell', label: 'Flux Schnell', desc: 'Fast, 1 credit' },
  { value: 'dev',     label: 'Flux Dev',     desc: 'Balanced, 2 credits' },
  { value: 'pro',     label: 'Flux Pro',     desc: 'Best quality, 3 credits' },
] as const;

export type FluxModel = typeof FLUX_MODELS[number]['value'];

export const EXAMPLE_PROMPTS = [
  'A cozy coffee shop interior with warm lighting and wooden tables',
  'Product photography of a minimalist watch on white marble',
  'Street food market at night, vibrant colors, cinematic lighting',
  'Modern office space with floor-to-ceiling windows and city view',
] as const;
