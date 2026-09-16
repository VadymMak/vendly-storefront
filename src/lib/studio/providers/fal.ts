import { fal } from '@fal-ai/client';
import type { ImageProvider, ImageGenerateRequest, ImageEditRequest, MediaResult } from '../config';

const ASPECT_TO_FAL_SIZE: Record<string, string> = {
  '1:1':  'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3':  'landscape_4_3',
  '3:4':  'portrait_4_3',
  '4:5':  'portrait_4_3',
  '3:2':  'landscape_4_3',
  '2:3':  'portrait_4_3',
};

export class FalProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    fal.config({ credentials: apiKey });

    const imageSize = ASPECT_TO_FAL_SIZE[req.aspectRatio ?? '1:1'] ?? 'square_hd';

    const result = await fal.subscribe(modelId, {
      input: {
        prompt:                req.prompt,
        image_size:            imageSize,
        num_images:            1,
        enable_safety_checker: true,
        output_format:         req.outputFormat === 'png' ? 'png' : 'jpeg',
        ...(modelId.includes('schnell') ? { num_inference_steps: 4 } : {}),
      },
    });

    const data = result.data as { images?: Array<{ url: string }> };
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error(`fal.ai ${modelId} returned no image`);
    return { url };
  }

  async edit(req: ImageEditRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    fal.config({ credentials: apiKey });

    const result = await fal.subscribe(modelId, {
      input: {
        prompt:        req.prompt,
        image_url:     req.imageUrl,
        output_format: 'png',
      },
    });

    const data = result.data as { images?: Array<{ url: string }> };
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error(`fal.ai ${modelId} edit returned no image`);
    return { url };
  }
}
