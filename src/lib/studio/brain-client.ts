/**
 * Brain HTTP client for Studio Chat integration.
 * Brain = multi-ai-chat knowledge base (Railway).
 * Context calls are fire-and-forget-on-error — never block the chat.
 */

const BRAIN_URL =
  process.env.BRAIN_API_URL || 'https://multi-ai-chat-production.up.railway.app';
const BRAIN_PROJECT_ID = Number(process.env.BRAIN_STUDIO_PROJECT_ID ?? '22');
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

/**
 * Fetch Brain context for the current user message.
 * Returns empty string on any error (Brain context is optional).
 * Timeout: 3 seconds — never delays the chat response.
 */
export async function getBrainStudioContext(query: string): Promise<string> {
  if (!BRAIN_API_KEY) return '';
  try {
    const res = await fetch(`${BRAIN_URL}/api/studio-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-brain-api-key': BRAIN_API_KEY,
      },
      body: JSON.stringify({ query, project_id: BRAIN_PROJECT_ID }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { context?: string };
    return data.context?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Save Studio session result to Brain (fire-and-forget).
 * Never awaited — cannot block the response.
 */
export function saveToBrainAsync(
  userMessage: string,
  assistantMessage: string,
  toolUsed?: string,
): void {
  if (!BRAIN_API_KEY) return;
  const content = [
    `User: ${userMessage.slice(0, 300)}`,
    `Tool: ${toolUsed || 'chat'}`,
    `Result: ${assistantMessage.slice(0, 400)}`,
  ].join('\n');

  fetch(`${BRAIN_URL}/api/studio-context/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-brain-api-key': BRAIN_API_KEY,
    },
    body: JSON.stringify({
      project_id: BRAIN_PROJECT_ID,
      content,
      topics: ['studio', ...(toolUsed ? [toolUsed] : [])],
    }),
  }).catch(() => {}); // ignore all errors
}
