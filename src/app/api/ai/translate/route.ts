import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';

const LANG_NAMES: Record<string, string> = {
  sk: 'Slovak', cs: 'Czech', uk: 'Ukrainian', de: 'German', en: 'English',
};

const schema = z.object({
  text: z.string().min(1),
  targetLang: z.string().min(2),
  storeId: z.string().min(1),
});

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRaw = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, email: true },
  });
  if (!userRaw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const effectivePlan = resolveUserPlan(userRaw);

  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Verify store ownership
    const store = await db.store.findFirst({
      where: { id: data.storeId, userId: session.user.id },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Check Free plan limit: one-time translation
    const settings = store.settings as Record<string, unknown>;
    if (effectivePlan === 'FREE' && settings.translationUsedAt) {
      return NextResponse.json({
        error: 'FREE_LIMIT',
        message: 'Free plan translation already used. Upgrade to Starter for more translations.',
      }, { status: 429 });
    }

    const langName = LANG_NAMES[data.targetLang] || 'Slovak';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator for small business e-commerce content. ` +
            `Translate accurately to ${langName}. Rules:\n` +
            `- Keep brand names, proper nouns, and product names as-is\n` +
            `- Use natural, conversational tone appropriate for an online store\n` +
            `- Keep prices, numbers, units, URLs unchanged\n` +
            `- If text is already in ${langName}, return it unchanged\n` +
            `- Return ONLY the translated text, nothing else`,
        },
        { role: 'user', content: data.text },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const translated = completion.choices[0]?.message?.content?.trim() || '';

    // Mark translation used for Free plan (on first use)
    if (effectivePlan === 'FREE' && !settings.translationUsedAt) {
      await db.store.update({
        where: { id: data.storeId },
        data: {
          settings: {
            ...settings,
            translationUsedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({ translated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Translation error:', err);
    return NextResponse.json({ error: 'Translation service unavailable' }, { status: 503 });
  }
}
