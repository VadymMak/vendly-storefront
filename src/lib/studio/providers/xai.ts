import { grokGenerate, grokEdit } from '@/lib/xai-client';
import type { ImageProvider, ImageGenerateRequest, ImageEditRequest, MediaResult } from '../config';

export class XaiProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, _modelId: string): Promise<MediaResult> {
    const url = await grokGenerate(apiKey, req.prompt);
    return { url };
  }

  async edit(req: ImageEditRequest, apiKey: string, _modelId: string): Promise<MediaResult> {
    const url = await grokEdit(apiKey, req.imageUrl, req.prompt);
    return { url };
  }
}
