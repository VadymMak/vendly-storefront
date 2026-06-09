export type SkillCategory = 'image' | 'video' | 'edit' | 'text' | 'combo';
export type Platform =
  | 'instagram_reel'
  | 'instagram_post'
  | 'instagram_story'
  | 'tiktok'
  | 'youtube_shorts'
  | 'facebook_post'
  | 'any';

export interface PromptPreset {
  id: string;
  label: string;
  emoji: string;
  category: SkillCategory;
  description: string;
  platforms: Platform[];
  /** The professional prompt template. {subject} is replaced with user's input */
  promptTemplate: string;
  /** Default params for the tool */
  defaultParams: Record<string, string | number>;
  /** Which tool this preset triggers */
  targetTool: string;
}

export interface ComboStep {
  tool: string;
  description: string;
  /** Prompt template for this step. {subject} replaced with user input */
  promptTemplate?: string;
  params?: Record<string, string | number>;
}

export interface ComboPreset extends Omit<PromptPreset, 'targetTool' | 'promptTemplate'> {
  category: 'combo';
  steps: ComboStep[];
}

// ========================================
// IMAGE PRESETS
// ========================================

const IMAGE_PRESETS: PromptPreset[] = [
  {
    id: 'product_hero',
    label: 'Product Hero',
    emoji: '📦',
    category: 'image',
    description: 'Clean product shot on white/marble',
    platforms: ['instagram_post', 'facebook_post', 'any'],
    promptTemplate:
      'Professional product photography of {subject}, centered on clean white marble surface, soft studio lighting from upper left, subtle shadow underneath, 8K ultra detail, commercial quality, minimalist composition, shallow depth of field with bokeh background, color-accurate product representation',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle Scene',
    emoji: '🌅',
    category: 'image',
    description: 'Product in natural lifestyle setting',
    platforms: ['instagram_post', 'facebook_post', 'any'],
    promptTemplate:
      'Lifestyle product photography of {subject} in a warm, natural home setting, golden hour sunlight streaming through window, wooden table, green plants in background, shallow depth of field, authentic editorial feel, warm color palette, Instagram-worthy composition',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
  {
    id: 'flat_lay',
    label: 'Flat Lay',
    emoji: '📐',
    category: 'image',
    description: 'Top-down styled arrangement',
    platforms: ['instagram_post', 'any'],
    promptTemplate:
      'Professional flat lay photography, top-down view of {subject} arranged with complementary props, clean white or light beige background, organized composition with negative space, soft even lighting, no harsh shadows, Instagram-worthy styling, commercial quality',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
  {
    id: 'dark_moody',
    label: 'Dark & Moody',
    emoji: '🌑',
    category: 'image',
    description: 'Dramatic dark background',
    platforms: ['instagram_post', 'any'],
    promptTemplate:
      'Dark moody product photography of {subject}, deep black background, dramatic side lighting with warm orange accent light, visible light rays, luxurious feel, high contrast, rich shadows, premium brand aesthetic, cinematic color grading',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
  {
    id: 'food_hero',
    label: 'Food Shot',
    emoji: '🍽️',
    category: 'image',
    description: 'Appetizing food photography',
    platforms: ['instagram_post', 'instagram_story', 'any'],
    promptTemplate:
      'Professional food photography of {subject}, appetizing presentation, rustic wooden board or ceramic plate, fresh herbs garnish, steam visible, warm directional lighting, shallow depth of field, vibrant colors, restaurant-quality plating, editorial food styling',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
  {
    id: 'portrait_headshot',
    label: 'Portrait',
    emoji: '👤',
    category: 'image',
    description: 'Professional headshot/portrait',
    platforms: ['instagram_post', 'any'],
    promptTemplate:
      'Professional portrait photography of {subject}, clean studio background, soft Rembrandt lighting, catchlight in eyes, shallow depth of field, natural skin tones, confident pose, corporate headshot quality, shot on 85mm lens',
    defaultParams: { aspect_ratio: '1:1' },
    targetTool: 'generate_image',
  },
];

// ========================================
// VIDEO PRESETS (Image → Video animation)
// ========================================

const VIDEO_PRESETS: PromptPreset[] = [
  {
    id: 'turntable',
    label: 'Turntable 360°',
    emoji: '🔄',
    category: 'video',
    description: 'Smooth product rotation',
    platforms: ['instagram_reel', 'instagram_post', 'tiktok'],
    promptTemplate:
      'Smooth continuous 360-degree rotation of the product on a clean surface, studio lighting, consistent exposure throughout rotation, seamless motion, professional product showcase, soft shadows rotating with object',
    defaultParams: { aspectRatio: '1:1', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'zoom_in',
    label: 'Zoom In',
    emoji: '🔍',
    category: 'video',
    description: 'Dramatic close-up zoom',
    platforms: ['instagram_reel', 'tiktok', 'youtube_shorts'],
    promptTemplate:
      'Slow cinematic dolly zoom into the subject, camera moves forward smoothly, shallow depth of field increases, background blur intensifies progressively, dramatic detail reveal, professional camera movement',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'zoom_out',
    label: 'Zoom Out',
    emoji: '🔭',
    category: 'video',
    description: 'Epic reveal zoom out',
    platforms: ['instagram_reel', 'tiktok', 'youtube_shorts'],
    promptTemplate:
      'Camera slowly and smoothly pulls back from close-up to wide shot, revealing the full scene and surroundings, expanding perspective, epic establishing shot reveal, continuous fluid motion',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'parallax',
    label: 'Parallax 3D',
    emoji: '🎭',
    category: 'video',
    description: '3D depth parallax effect',
    platforms: ['instagram_reel', 'instagram_story', 'tiktok'],
    promptTemplate:
      'Subtle parallax motion creating depth between foreground and background layers, foreground elements shift faster than background, gentle side-to-side camera movement, creating immersive 3D depth effect, smooth and hypnotic',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'cinematic_reveal',
    label: 'Cinematic Reveal',
    emoji: '🎬',
    category: 'video',
    description: 'Dramatic light reveal',
    platforms: ['instagram_reel', 'tiktok', 'youtube_shorts'],
    promptTemplate:
      'Dramatic cinematic lighting transition, product emerges from darkness into beautiful illumination, volumetric light rays sweep across scene, atmospheric haze, professional film-quality lighting change, emotional reveal moment',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'gentle_float',
    label: 'Gentle Float',
    emoji: '☁️',
    category: 'video',
    description: 'Soft floating motion',
    platforms: ['instagram_reel', 'instagram_story', 'any'],
    promptTemplate:
      'Product gently floating and slowly rotating in mid-air, soft dreamy atmosphere, particles of light drifting around, ethereal feeling, smooth weightless motion, subtle up and down bobbing, magical product showcase',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
  {
    id: 'orbit',
    label: 'Orbit',
    emoji: '🪐',
    category: 'video',
    description: 'Camera orbits around subject',
    platforms: ['instagram_reel', 'tiktok', 'youtube_shorts'],
    promptTemplate:
      'Camera smoothly orbits around the subject in a half-circle arc, consistent distance maintained, lighting shifts naturally as perspective changes, cinematic circular tracking shot, professional steadicam quality',
    defaultParams: { aspectRatio: '9:16', duration: 5 },
    targetTool: 'image_to_video',
  },
];

// ========================================
// EDIT PRESETS
// ========================================

const EDIT_PRESETS: PromptPreset[] = [
  {
    id: 'remove_bg',
    label: 'Remove BG',
    emoji: '✂️',
    category: 'edit',
    description: 'Transparent background',
    platforms: ['any'],
    promptTemplate: '',
    defaultParams: {},
    targetTool: 'remove_background',
  },
  {
    id: 'upscale_4k',
    label: 'Upscale 4K',
    emoji: '🔎',
    category: 'edit',
    description: '4x resolution boost',
    platforms: ['any'],
    promptTemplate: '',
    defaultParams: { type: 'upscale' },
    targetTool: 'upscale',
  },
  {
    id: 'face_enhance',
    label: 'Face Enhance',
    emoji: '✨',
    category: 'edit',
    description: 'Portrait face detail boost',
    platforms: ['any'],
    promptTemplate: '',
    defaultParams: { type: 'portrait' },
    targetTool: 'face_enhance',
  },
  {
    id: 'warm_tone',
    label: 'Warm Tones',
    emoji: '🌤️',
    category: 'edit',
    description: 'Add warm golden tones',
    platforms: ['any'],
    promptTemplate:
      'Make the image warmer with golden tones, add warm sunlight feeling, increase warmth in shadows, golden hour color grading',
    defaultParams: {},
    targetTool: 'edit_image',
  },
  {
    id: 'cool_tone',
    label: 'Cool Tones',
    emoji: '❄️',
    category: 'edit',
    description: 'Cool blue-tinted look',
    platforms: ['any'],
    promptTemplate:
      'Apply cool blue color grading, add subtle blue tint to highlights, desaturate warm tones slightly, modern clean aesthetic',
    defaultParams: {},
    targetTool: 'edit_image',
  },
  {
    id: 'remove_text',
    label: 'Remove Text',
    emoji: '🚫',
    category: 'edit',
    description: 'Remove text, watermarks, logos',
    platforms: ['any'],
    promptTemplate:
      'Remove all text, watermarks, logos, and price tags from this image. Keep the product and background completely intact.',
    defaultParams: {},
    targetTool: 'edit_image',
  },
  {
    id: 'white_bg',
    label: 'White Background',
    emoji: '⬜',
    category: 'edit',
    description: 'Replace background with pure white',
    platforms: ['any'],
    promptTemplate:
      'Replace the background with clean pure white (#ffffff). Keep the main subject sharp and properly lit with a natural soft shadow underneath.',
    defaultParams: {},
    targetTool: 'edit_image',
  },
  {
    id: 'christmas_style',
    label: 'Christmas',
    emoji: '🎄',
    category: 'edit',
    description: 'Add Christmas/winter atmosphere',
    platforms: ['instagram_post', 'instagram_story', 'any'],
    promptTemplate:
      'Add festive Christmas atmosphere: warm golden lighting, subtle snowflakes, red and green accents, cozy winter feeling. Keep the product unchanged and clearly visible.',
    defaultParams: {},
    targetTool: 'edit_image',
  },
];

// ========================================
// TEXT PRESETS
// ========================================

const TEXT_PRESETS: PromptPreset[] = [
  {
    id: 'caption_instagram',
    label: 'IG Caption',
    emoji: '✍️',
    category: 'text',
    description: 'Instagram caption + hashtags',
    platforms: ['instagram_post', 'instagram_reel'],
    promptTemplate: '{subject}',
    defaultParams: { platform: 'instagram' },
    targetTool: 'write_caption',
  },
  {
    id: 'caption_tiktok',
    label: 'TikTok Caption',
    emoji: '🎵',
    category: 'text',
    description: 'TikTok description + tags',
    platforms: ['tiktok'],
    promptTemplate: '{subject}',
    defaultParams: { platform: 'tiktok' },
    targetTool: 'write_caption',
  },
  {
    id: 'caption_youtube',
    label: 'YT Description',
    emoji: '▶️',
    category: 'text',
    description: 'YouTube Shorts description',
    platforms: ['youtube_shorts'],
    promptTemplate: '{subject}',
    defaultParams: { platform: 'youtube' },
    targetTool: 'write_caption',
  },
];

// ========================================
// COMBO PRESETS (Multi-step chains)
// ========================================

const COMBO_PRESETS: ComboPreset[] = [
  {
    id: 'full_reel',
    label: 'Full Reel',
    emoji: '📱',
    category: 'combo',
    description: 'Generate → Animate → Caption',
    platforms: ['instagram_reel', 'tiktok'],
    steps: [
      {
        tool: 'generate_image',
        description: 'Generating product image',
        promptTemplate:
          'Professional product photography of {subject}, centered, beautiful studio background with soft gradient, cinematic studio lighting, 8K ultra detail, commercial quality, perfect for video animation',
        params: { aspect_ratio: '9:16' },
      },
      {
        tool: 'image_to_video',
        description: 'Animating to video (2-3 min)',
        promptTemplate:
          'Smooth cinematic motion, product slowly rotating with dramatic lighting shifts, professional product showcase, seamless animation',
        params: { aspectRatio: '9:16', duration: 5 },
      },
      {
        tool: 'write_caption',
        description: 'Writing caption',
        params: { platform: 'instagram' },
      },
    ],
    defaultParams: {},
  },
  {
    id: 'product_showcase',
    label: 'Product Showcase',
    emoji: '🏪',
    category: 'combo',
    description: 'Generate → Upscale 4K → Caption',
    platforms: ['instagram_post', 'facebook_post'],
    steps: [
      {
        tool: 'generate_image',
        description: 'Generating product image',
        promptTemplate:
          'Professional product photography of {subject}, clean white marble surface, soft studio lighting, commercial quality, 8K detail',
        params: { aspect_ratio: '1:1' },
      },
      {
        tool: 'upscale',
        description: 'Upscaling to 4K',
        params: { type: 'upscale' },
      },
      {
        tool: 'write_caption',
        description: 'Writing caption',
        params: { platform: 'instagram' },
      },
    ],
    defaultParams: {},
  },
  {
    id: 'tiktok_video',
    label: 'TikTok Video',
    emoji: '🎵',
    category: 'combo',
    description: 'Generate → Animate (zoom) → TikTok caption',
    platforms: ['tiktok'],
    steps: [
      {
        tool: 'generate_image',
        description: 'Generating image',
        promptTemplate:
          'Eye-catching product shot of {subject}, vibrant colors, dramatic lighting, social media optimized, trending aesthetic',
        params: { aspect_ratio: '9:16' },
      },
      {
        tool: 'image_to_video',
        description: 'Animating with zoom effect',
        promptTemplate:
          'Slow dramatic zoom into the product, shallow depth of field, cinematic feel, TikTok-ready',
        params: { aspectRatio: '9:16', duration: 5 },
      },
      {
        tool: 'write_caption',
        description: 'Writing TikTok caption',
        params: { platform: 'tiktok' },
      },
    ],
    defaultParams: {},
  },
  {
    id: 'clean_product',
    label: 'Clean Product',
    emoji: '🧹',
    category: 'combo',
    description: 'Edit (remove text) → Remove BG → Caption',
    platforms: ['instagram_post', 'facebook_post', 'any'],
    steps: [
      {
        tool: 'edit_image',
        description: 'Removing text & watermarks',
        promptTemplate:
          'Remove all text, watermarks, logos, price tags and any overlaid graphics from this image. Keep the product and original background completely intact and unchanged. Clean the image thoroughly.',
      },
      {
        tool: 'remove_background',
        description: 'Removing background',
      },
      {
        tool: 'write_caption',
        description: 'Writing product caption',
        params: { platform: 'instagram' },
      },
    ],
    defaultParams: {},
  },
  {
    id: 'story_ad',
    label: 'Story Ad',
    emoji: '📖',
    category: 'combo',
    description: 'Generate → Style edit → Caption',
    platforms: ['instagram_story'],
    steps: [
      {
        tool: 'generate_image',
        description: 'Generating product image',
        promptTemplate:
          'Professional product photography of {subject}, clean studio setting, soft directional lighting, 8K detail, vertical composition optimized for stories',
        params: { aspect_ratio: '9:16' },
      },
      {
        tool: 'edit_image',
        description: 'Adding visual style',
        promptTemplate:
          'Add eye-catching visual style: subtle gradient color overlay, modern clean aesthetic, make it Instagram-story ready with vibrant but tasteful colors. Keep the product sharp and recognizable.',
      },
      {
        tool: 'write_caption',
        description: 'Writing story caption',
        params: { platform: 'instagram' },
      },
    ],
    defaultParams: {},
  },
];

// ========================================
// ALL PRESETS
// ========================================

export const ALL_PRESETS: (PromptPreset | ComboPreset)[] = [
  ...IMAGE_PRESETS,
  ...VIDEO_PRESETS,
  ...EDIT_PRESETS,
  ...TEXT_PRESETS,
  ...COMBO_PRESETS,
];

export const PRESETS_BY_CATEGORY = {
  image: IMAGE_PRESETS,
  video: VIDEO_PRESETS,
  edit: EDIT_PRESETS,
  text: TEXT_PRESETS,
  combo: COMBO_PRESETS,
};

export function isComboPreset(preset: PromptPreset | ComboPreset): preset is ComboPreset {
  return preset.category === 'combo';
}

export function getPreset(id: string): PromptPreset | ComboPreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

export function getComboPreset(id: string): ComboPreset | undefined {
  return COMBO_PRESETS.find((p) => p.id === id);
}

export function buildPromptFromPreset(preset: PromptPreset, userInput: string): string {
  if (!preset.promptTemplate) return userInput;
  return preset.promptTemplate.replace('{subject}', userInput || 'the product');
}

export function presetsToAgentContext(): string {
  return ALL_PRESETS.filter((p): p is PromptPreset => !isComboPreset(p) && !!p.promptTemplate)
    .map(
      (p) =>
        `- "${p.id}": ${p.description} → tool: ${p.targetTool}, prompt: "${p.promptTemplate.slice(0, 80)}..."`,
    )
    .join('\n');
}
