import { MODEL_CATALOG } from '@/lib/studio/config';
import type { CreativeAspectRatio, CreativeEditResult } from '@/lib/types';

export const CREATIVE_EDIT_ALIAS = 'edit-grok-creative';
export const CREATIVE_EDIT_CREDITS = MODEL_CATALOG[CREATIVE_EDIT_ALIAS].creditCost;

/**
 * Photo + the user's own prompt → Grok edit. The prompt goes out exactly as typed:
 * no preset wrapper and no translation (Grok reads Russian/German directly).
 */
export async function requestCreativeEdit(
  image: File,
  prompt: string,
  aspectRatio: CreativeAspectRatio,
): Promise<CreativeEditResult> {
  const fd = new FormData();
  fd.append('image', image);
  fd.append('prompt', prompt);
  fd.append('modelAlias', CREATIVE_EDIT_ALIAS);
  fd.append('aspectRatio', aspectRatio);

  try {
    const res = await fetch('/api/studio/edit', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string; code?: string; needsUpgrade?: boolean };
    if (res.ok && data.url) return { ok: true, url: data.url };
    if (data.code === 'content_moderation') return { ok: false, code: 'content_moderation' };
    if (data.needsUpgrade) return { ok: false, code: 'no_credits', message: data.error };
    return { ok: false, code: 'failed', message: data.error };
  } catch {
    return { ok: false, code: 'failed' };
  }
}
