/**
 * Direct browser-to-Replicate API calls.
 * Used by BYOK and superuser accounts.
 * Bypasses Vercel — zero server CPU usage, no timeout limits.
 */

const REPLICATE_API = 'https://api.replicate.com/v1';

export interface ReplicateRunConfig {
  model: string;
  input: Record<string, unknown>;
}

export type ProgressCallback = (status: string, prediction?: { id: string }) => void;

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

interface ReplicateErrorBody {
  detail?: string;
  title?: string;
}

/**
 * Create prediction and poll until complete.
 * Runs entirely in the browser — no Vercel function involved.
 */
export async function replicateDirectRun(
  apiKey: string,
  config: ReplicateRunConfig,
  onProgress?: ProgressCallback,
): Promise<{ output: unknown; status: string; id: string }> {
  const createRes = await fetch(`${REPLICATE_API}/models/${config.model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ input: config.input }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as ReplicateErrorBody;
    throw new Error(err.detail ?? err.title ?? `Replicate API error: ${createRes.status}`);
  }

  let prediction = await createRes.json() as ReplicatePrediction;

  if (prediction.status === 'succeeded') {
    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return { output, status: 'succeeded', id: prediction.id };
  }
  if (prediction.status === 'failed') {
    throw new Error(prediction.error ?? 'Generation failed');
  }

  onProgress?.('processing', prediction);

  const pollUrl = `${REPLICATE_API}/predictions/${prediction.id}`;
  const maxPollTime = 10 * 60 * 1000;
  const startTime = Date.now();

  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled'
  ) {
    if (Date.now() - startTime > maxPollTime) {
      throw new Error('Generation timed out');
    }
    const elapsed = Date.now() - startTime;
    const interval = elapsed < 15000 ? 2000 : 4000;
    await new Promise<void>((r) => setTimeout(r, interval));

    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) continue;

    prediction = await pollRes.json() as ReplicatePrediction;
    onProgress?.(prediction.status, prediction);
  }

  if (prediction.status === 'failed') {
    throw new Error(prediction.error ?? 'Generation failed');
  }
  if (prediction.status === 'canceled') {
    throw new Error('Generation was canceled');
  }

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return { output, status: 'succeeded', id: prediction.id };
}

/**
 * Fetch a Replicate CDN image URL as a local blob URL.
 * Avoids CORS issues when using the result in <img src>.
 */
export async function fetchImageAsBlob(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
