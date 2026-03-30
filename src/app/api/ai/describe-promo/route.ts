import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';

const schema = z.object({
  title: z.string().min(1),
  language: z.string().default('sk'),
});

const LANG_PROMPTS: Record<string, { system: string; user: (title: string) => string }> = {
  sk: {
    system: 'Si marketingový copywriter pre malé firmy. Píš stručné, pútavé promo texty v slovenčine. Max 2 vety.',
    user: (title) => `Napíš krátky propagačný text pre banner s názvom: "${title}".`,
  },
  cs: {
    system: 'Jsi marketingový copywriter pro malé firmy. Piš stručné, poutavé promo texty v češtině. Max 2 věty.',
    user: (title) => `Napiš krátký propagační text pro banner s názvem: "${title}".`,
  },
  uk: {
    system: 'Ти маркетинговий копірайтер для малого бізнесу. Пиши стислі, привабливі промо-тексти українською. Максимум 2 речення.',
    user: (title) => `Напиши короткий рекламний текст для банера з назвою: "${title}".`,
  },
  de: {
    system: 'Du bist Marketing-Texter für kleine Unternehmen. Schreibe kurze, ansprechende Promo-Texte auf Deutsch. Max 2 Sätze.',
    user: (title) => `Schreibe einen kurzen Werbetext für ein Banner mit dem Titel: "${title}".`,
  },
  en: {
    system: 'You are a marketing copywriter for small businesses. Write concise, engaging promo texts in English. Max 2 sentences.',
    user: (title) => `Write a short promotional text for a banner titled: "${title}".`,
  },
};

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check AI usage limit
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, email: true, aiUsageCount: true, aiUsageMonth: true },
  });

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const effectivePlan = resolveUserPlan(user);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const usageThisMonth = user.aiUsageMonth === thisMonth ? user.aiUsageCount : 0;

  const limit = effectivePlan === 'FREE' ? 5 : effectivePlan === 'STARTER' ? 20 : Infinity;
  if (usageThisMonth >= limit) {
    return NextResponse.json({ error: 'AI limit reached' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const lang = LANG_PROMPTS[data.language] || LANG_PROMPTS.en;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: lang.system },
        { role: 'user', content: lang.user(data.title) },
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    // Update usage counter
    await db.user.update({
      where: { id: session.user.id },
      data: {
        aiUsageCount: usageThisMonth + 1,
        aiUsageMonth: thisMonth,
      },
    });

    const description = completion.choices[0]?.message?.content?.trim() || '';
    return NextResponse.json({ description });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    console.error('AI promo error:', err);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
