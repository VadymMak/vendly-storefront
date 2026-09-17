import { bflGenerate, aspectToSize } from '@/lib/bfl-client';
import type { ImageProvider, ImageGenerateRequest, MediaResult } from '../config';

export class BflProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    const { width, height } = aspectToSize(req.aspectRatio ?? '1:1');
    // BFL doesn't support webp — fall back to png
    const outputFormat = req.outputFormat === 'jpeg' ? 'jpeg' : 'png';
    const url = await bflGenerate(apiKey, modelId, {
      prompt: req.prompt,
      width,
      height,
      outputFormat,
    });
    return { url };
  }
}
