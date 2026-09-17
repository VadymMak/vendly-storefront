const BFL_API = 'https://api.bfl.ai';

export interface BflGenerateOptions {
  prompt:           string;
  width?:           number;
  height?:          number;
  outputFormat?:    'png' | 'jpeg';
  safetyTolerance?: number;
}

interface BflTaskResponse {
  id:           string;
  polling_url?: string;
}

interface BflResultResponse {
  id:      string;
  status:  'Pending' | 'Ready' | 'Error' | 'Request Moderated' | 'Content Moderated' | 'Task not found';
  result?: {
    sample: string;
    prompt: string;
    seed:   number;
  };
}

/**
 * Generate an image via the BFL FLUX API.
 * `modelEndpoint` is the endpoint path suffix, e.g. 'flux-2-pro' or 'flux-pro-1.1'.
 * Returns the URL of the completed image.
 */
export async function bflGenerate(
  apiKey: string,
  modelEndpoint: string,
  options: BflGenerateOptions,
): Promise<string> {
  const createRes = await fetch(`${BFL_API}/v1/${modelEndpoint}`, {
    method: 'POST',
    headers: {
      'x-key':        apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt:           options.prompt,
      width:            options.width  ?? 1024,
      height:           options.height ?? 1024,
      output_format:    options.outputFormat ?? 'png',
      safety_tolerance: options.safetyTolerance ?? 2,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => createRes.statusText);
    throw new Error(`BFL API error ${createRes.status}: ${errText}`);
  }

  const task = await createRes.json() as BflTaskResponse;
  const taskId = task.id;

  const pollUrl = task.polling_url ?? `${BFL_API}/v1/get_result?id=${taskId}`;

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(pollUrl, {
      headers: { 'x-key': apiKey },
    });

    if (!pollRes.ok) continue;

    const result = await pollRes.json() as BflResultResponse;

    if (result.status === 'Ready' && result.result?.sample) {
      return result.result.sample;
    }

    if (
      result.status === 'Error' ||
      result.status === 'Request Moderated' ||
      result.status === 'Content Moderated'
    ) {
      throw new Error(`BFL generation failed: ${result.status}`);
    }
    // 'Pending' — keep polling
  }

  throw new Error('BFL generation timed out after 120 seconds');
}

/** Map aspect ratio string to BFL-compatible width/height. */
export function aspectToSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '1:1':  return { width: 1024, height: 1024 };
    case '16:9': return { width: 1344, height: 768  };
    case '9:16': return { width: 768,  height: 1344 };
    case '4:3':  return { width: 1152, height: 896  };
    case '3:4':  return { width: 896,  height: 1152 };
    case '3:2':  return { width: 1216, height: 832  };
    case '2:3':  return { width: 832,  height: 1216 };
    default:     return { width: 1024, height: 1024 };
  }
}
