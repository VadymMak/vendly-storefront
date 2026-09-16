import Replicate from 'replicate';
import type { ImageProvider, ImageGenerateRequest, ImageEditRequest, MediaResult } from '../config';

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
      const r = (first as { url: () => string | URL }).url();
      return r instanceof URL ? r.toString() : String(r);
    }
    return String(first);
  }
  if (output && typeof (output as Record<string, unknown>)['url'] === 'function') {
    const r = (output as { url: () => string | URL }).url();
    return r instanceof URL ? r.toString() : String(r);
  }
  return String(output);
}

export class ReplicateProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    const replicate = new Replicate({ auth: apiKey });

    // Flux Redux (style-consistent variation from reference image)
    if (modelId === 'black-forest-labs/flux-redux-schnell') {
      if (!req.referenceImage) throw new Error('referenceImage required for flux-redux');
      const output = await replicate.run(
        modelId as `${string}/${string}`,
        {
          input: {
            redux_image:         req.referenceImage,
            num_outputs:         1,
            num_inference_steps: 4,
            output_format:       'webp',
            output_quality:      90,
          },
        },
      );
      return { url: extractUrl(output) };
    }

    // Flux Dev (higher quality, more steps)
    if (modelId === 'black-forest-labs/flux-dev') {
      const outputFormat = req.outputFormat === 'jpeg' ? 'png' : (req.outputFormat ?? 'webp');
      const output = await replicate.run(
        modelId as `${string}/${string}`,
        {
          input: {
            prompt,
            aspect_ratio:        req.aspectRatio ?? '1:1',
            num_inference_steps: 50,
            guidance_scale:      3.5,
            output_format:       outputFormat,
            output_quality:      85,
          },
        },
      );
      return { url: extractUrl(output) };
    }

    // Flux Schnell (default — fast)
    const outputFormat = req.outputFormat === 'jpeg' ? 'png' : (req.outputFormat ?? 'webp');
    const output = await replicate.run(
      modelId as `${string}/${string}`,
      {
        input: {
          prompt:              req.prompt,
          aspect_ratio:        req.aspectRatio ?? '1:1',
          megapixels:          req.megapixels  ?? '1',
          num_outputs:         1,
          num_inference_steps: 4,
          output_format:       outputFormat,
          output_quality:      90,
          go_fast:             true,
        },
      },
    );
    return { url: extractUrl(output) };
  }

  async edit(req: ImageEditRequest, apiKey: string, modelId: string): Promise<MediaResult> {
    const replicate = new Replicate({ auth: apiKey });
    const output = await replicate.run(
      modelId as `${string}/${string}`,
      {
        input: {
          prompt:           req.prompt,
          input_image:      req.imageUrl,
          aspect_ratio:     'match_input_image',
          safety_tolerance: 2,
          output_format:    'png',
        },
      },
    );
    if (output === null || output === undefined) {
      throw new Error('Flux Kontext Pro produced no output');
    }
    const url = extractUrl(output);
    if (!url || url === 'null' || url === 'undefined' || !url.startsWith('http')) {
      throw new Error('Flux Kontext Pro returned invalid image URL');
    }
    return { url };
  }
}
