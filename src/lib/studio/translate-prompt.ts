import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Detect if text is already in English (simple heuristic).
 * Returns true if >80% of non-whitespace/punctuation chars are ASCII letters.
 */
function looksEnglish(text: string): boolean {
  const stripped = text.replace(/[\s\d€$£¥.,!?;:'"()\-–—/\\@#%&*+=\[\]{}|<>~`^_]/g, '');
  if (stripped.length === 0) return true;
  const latinCount = (stripped.match(/[a-zA-Z]/g) || []).length;
  return latinCount / stripped.length > 0.8;
}

/**
 * Translate a user prompt to English for better AI image generation.
 * Returns the original text if already English or if translation fails.
 * Cost: ~$0.0001 per call with GPT-4o-mini.
 */
export async function translatePromptToEnglish(prompt: string): Promise<string> {
  if (!prompt.trim()) return prompt;
  if (looksEnglish(prompt)) return prompt;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "You are a translator. Translate the user's text to English. Keep product names, brand names, prices, and special terms unchanged. Return ONLY the translation, nothing else. Do not add quotes or explanations.",
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const translated = response.choices[0]?.message?.content?.trim();
    if (!translated) return prompt;

    console.log('[translate-prompt] "%s" → "%s"', prompt.slice(0, 60), translated.slice(0, 60));
    return translated;
  } catch (err) {
    console.warn('[translate-prompt] Translation failed, using original:', err);
    return prompt;
  }
}
