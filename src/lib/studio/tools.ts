import { ToolName } from './types';

export interface ToolDefinition {
  name: ToolName;
  description: string;
  apiRoute: string;
  model: string;
  provider: 'replicate' | 'anthropic' | 'openai';
  costEstimate: string;
  inputType: 'text' | 'image' | 'image+text';
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
    name: 'create_clip',
    description:
      'Create an Instagram/TikTok-style video clip from multiple images in the chat session. Applies Ken Burns camera motion (zoom-in, zoom-out, pan), transitions (fade, slide, zoom), and optional visual style (cinematic, golden-hour, vintage). Renders directly in browser — no credits needed. Requires at least 2 images in chat context. Use when user says "make a clip", "slideshow", "montage", "combine images into video".',
    apiRoute: 'internal:client-render',
    model: 'Canvas + MediaRecorder',
    provider: 'replicate',
    costEstimate: 'Free',
    inputType: 'image',
    outputType: 'video',
  },
];

export function toolsToSystemPrompt(): string {
  return STUDIO_TOOLS.map(
    (t) => `- ${t.name}: ${t.description} [input: ${t.inputType}, output: ${t.outputType}]`
  ).join('\n');
}
