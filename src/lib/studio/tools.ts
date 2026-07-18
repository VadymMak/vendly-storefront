import { ToolName } from './types';

export interface ToolDefinition {
  name: ToolName;
  description: string;
  apiRoute: string;
  model: string;
  provider: 'replicate' | 'anthropic' | 'openai' | 'brain';
  costEstimate: string;
  inputType: 'text' | 'image' | 'image+text' | 'media';
  outputType: 'image' | 'video' | 'text';
}

export const STUDIO_TOOLS: ToolDefinition[] = [
  {
    name: 'generate_image',
    description:
      'Generate a new image from a text description. Use for creating product photos, lifestyle scenes, backgrounds, any image from scratch.',
    apiRoute: '/api/generate-image',
    model: 'Flux Schnell',
    provider: 'replicate',
    costEstimate: '$0.003',
    inputType: 'text',
    outputType: 'image',
  },
  {
    name: 'image_to_video',
    description:
      'Animate a static image into a short video. Use for turntable, zoom, parallax, cinematic effects. Requires an image in context.',
    apiRoute: '/api/generate-video',
    model: 'Kling v2.1',
    provider: 'replicate',
    costEstimate: '$0.30-0.60',
    inputType: 'image+text',
    outputType: 'video',
  },
  {
    name: 'edit_image',
    description:
      'Edit an existing image using Flux Kontext Pro. Powerful AI editing: remove text/watermarks, change background, adjust style, add/remove elements, change colors, add seasonal atmosphere, replace objects. Requires an image in context. Give clear English instructions of what to change.',
    apiRoute: '/api/ai-edit',
    model: 'Flux Kontext Pro',
    provider: 'replicate',
    costEstimate: '$0.03',
    inputType: 'image+text',
    outputType: 'image',
  },
  {
    name: 'upscale',
    description:
      'Upscale image to 4x resolution. Use when user wants higher quality, larger image, or says "4K", "HD", "upscale".',
    apiRoute: '/api/enhance-image',
    model: 'Real-ESRGAN',
    provider: 'replicate',
    costEstimate: '$0.10',
    inputType: 'image',
    outputType: 'image',
  },
  {
    name: 'remove_background',
    description:
      'Remove background from image, output transparent PNG. Use when user wants cutout, transparent bg, or product on clean background.',
    apiRoute: '/api/remove-bg',
    model: 'remove-bg',
    provider: 'replicate',
    costEstimate: '$0.02',
    inputType: 'image',
    outputType: 'image',
  },
  {
    name: 'face_enhance',
    description:
      'Enhance face details in portrait. Use for portrait photos, headshots, face quality improvement.',
    apiRoute: '/api/enhance-image',
    model: 'Real-ESRGAN',
    provider: 'replicate',
    costEstimate: '$0.10',
    inputType: 'image',
    outputType: 'image',
  },
  {
    name: 'write_caption',
    description:
      'Write social media caption with hashtags. Use when user wants text for Instagram/TikTok/YouTube post.',
    apiRoute: 'internal:openai',
    model: 'GPT-4o-mini',
    provider: 'openai',
    costEstimate: '$0.001',
    inputType: 'text',
    outputType: 'text',
  },
  {
    name: 'transform_image',
    description:
      'Resize, compress, convert format, or apply social media preset to an image. FREE — no credits used. Presets: instagram_square, instagram_portrait, instagram_story, instagram_landscape, tiktok, youtube_thumbnail, youtube_banner, facebook_post, facebook_cover, facebook_story, twitter_post, twitter_header, linkedin_post, linkedin_cover, pinterest, thumbnail, og_image.',
    apiRoute: '/api/studio/transform-image',
    model: 'Pillow (Python)',
    provider: 'brain',
    costEstimate: 'Free',
    inputType: 'image',
    outputType: 'image',
  },
  {
    name: 'generate_with_reference',
    description:
      "Generate a new image using the current image as a visual style or content reference (img2img). Use when user says 'use my photo', 'in this style', 'similar to my image', 'generate with reference', 'keep my product', 'make something like this'. Requires an image in context.",
    apiRoute: '/api/studio/generate-with-reference',
    model: 'Flux Dev (img2img)',
    provider: 'replicate',
    costEstimate: '$0.025',
    inputType: 'image+text',
    outputType: 'image',
  },
  {
    name: 'create_clip',
    description:
      'Create an Instagram/TikTok-style video clip from images and/or videos with Ken Burns motion, transitions, and optional music. Images get Ken Burns camera motion; videos play as-is. Renders directly in browser — no credits needed. Requires at least 1 image or video in chat context. Use when user says "make a clip", "slideshow", "montage", "combine images into video".',
    apiRoute: 'internal:client-render',
    model: 'Canvas + MediaRecorder',
    provider: 'replicate',
    costEstimate: 'Free',
    inputType: 'media',
    outputType: 'video',
  },
];

export function toolsToSystemPrompt(): string {
  return STUDIO_TOOLS.map(
    (t) => `- ${t.name}: ${t.description} [input: ${t.inputType}, output: ${t.outputType}]`
  ).join('\n');
}
