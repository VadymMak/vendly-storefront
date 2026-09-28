import OpenAI from 'openai';

// Fail fast: translation is best-effort, the original prompt is always a valid fallback
const TRANSLATE_TIMEOUT_MS = 8_000;

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: TRANSLATE_TIMEOUT_MS,
    maxRetries: 0,
  });
  return client;
}

/**
 * Decide whether a prompt needs translating.
 * A character heuristic can't tell German or Slovak from English (both are mostly
 * plain ASCII letters), so the UI locale is the primary signal: any non-English
 * locale goes to the model, which returns English text unchanged. For English
 * (or unknown) locales, only prompts with non-ASCII letters are sent.
 */
function needsTranslation(prompt: string, locale?: string): boolean {
  if (locale && locale !== 'en') return true;
  return /\p{L}/u.test(prompt.replace(/[A-Za-z]/g, ''));
}

/**
 * Translate a user prompt to English for better AI image generation.
 * Returns the original text if already English or if translation fails / times out.
 * Cost: ~$0.0001 per call with GPT-4o-mini.
 */
export async function translatePromptToEnglish(prompt: string, locale?: string): Promise<string> {
  if (!prompt.trim() || !needsTranslation(prompt, locale)) return prompt;

  const openai = getClient();
  if (!openai) return prompt;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "You are a translator. Translate the user's text to English. If it is already in English, return it unchanged. Keep product names, brand names, prices, and special terms unchanged. Return ONLY the translation, nothing else. Do not add quotes or explanations.",
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const translated = response.choices[0]?.message?.content?.trim();
    if (!translated) return prompt;

    // Log metadata only — user prompts are personal content (GDPR), don't persist them in logs
    if (translated !== prompt) {
      console.log('[translate-prompt] translated (locale=%s, %d → %d chars)', locale ?? '-', prompt.length, translated.length);
    }
    return translated;
  } catch (err) {
    console.warn('[translate-prompt] Translation failed, using original:', err instanceof Error ? err.message : 'unknown error');
    return prompt;
  }
}
