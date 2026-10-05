import { createFalClient } from '@fal-ai/client';
import type { ImageProvider, ImageGenerateRequest, ImageEditRequest, MediaResult } from '../config';

// Named sizes where fal has an exact match; explicit {width, height} (multiples of 16) where
// it doesn't — 'portrait_4_3' is 3:4, so mapping 4:5 / 2:3 onto it silently changed the ratio.
const ASPECT_TO_FAL_SIZE: Record<string, string | { width: number; height: number }> = {
  '1:1':  'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3':  'landscape_4_3',
  '3:4':  'portrait_4_3',
  '4:5':  { width: 1024, height: 1280 },
  '3:2':  { width: 1248, height: 832 },
  '2:3':  { width: 832,  height: 1248 },
};

export class FalProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    const fal = createFalClient({ credentials: apiKey });

    const imageSize = ASPECT_TO_FAL_SIZE[req.aspectRatio ?? '1:1'] ?? 'square_hd';

    const isSchnell = modelId.includes('schnell');
    const isFlux2   = modelId.includes('flux-2');

    const result = await fal.subscribe(modelId, {
      input: {
        prompt:                req.prompt,
        image_size:            imageSize,
        num_images:            1,
        enable_safety_checker: true,
        output_format:         req.outputFormat === 'png' ? 'png' : 'jpeg',
        ...(isSchnell ? { num_inference_steps: 4 } : {}),
        ...(isFlux2   ? { num_inference_steps: 28, acceleration: 'regular' } : {}),
      },
    });

    const data = result.data as { images?: Array<{ url: string }> };
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error(`fal.ai ${modelId} returned no image`);
    return { url };
  }

  async edit(req: ImageEditRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    const fal = createFalClient({ credentials: apiKey });

    const result = await fal.subscribe(modelId, {
      input: {
        prompt:         req.prompt,
        image_url:      req.imageUrl,
        output_format:  'jpeg',
        guidance_scale: 4.2,
        ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
      },
    });

    const data = result.data as { images?: Array<{ url: string }> };
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error(`fal.ai ${modelId} edit returned no image`);
    return { url };
  }
}
