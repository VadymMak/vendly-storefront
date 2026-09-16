import { grokGenerate, grokEdit } from '@/lib/xai-client';
import type { ImageProvider, ImageGenerateRequest, ImageEditRequest, MediaResult } from '../config';

const ASPECT_TO_GROK_SIZE: Record<string, string> = {
  '1:1':  '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
  '4:5':  '1024x1280',
  '3:2':  '1536x1024',
  '2:3':  '1024x1536',
  '4:3':  '1365x1024',
  '3:4':  '1024x1365',
};

export class XaiProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, _modelId: string): Promise<MediaResult> {
    const size = ASPECT_TO_GROK_SIZE[req.aspectRatio ?? '1:1'] ?? '1024x1024';
    const url = await grokGenerate(apiKey, req.prompt, size);
    return { url };
  }

  async edit(req: ImageEditRequest, apiKey: string, _modelId: string): Promise<MediaResult> {
    const url = await grokEdit(apiKey, req.imageUrl, req.prompt);
    return { url };
  }
}
