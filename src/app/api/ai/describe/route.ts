import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';

const schema = z.object({
  name:     z.string().min(1),
  type:     z.string().default('PRODUCT'),
  category: z.string().optional(),
});

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  // Check AI usage limit
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, email: true, aiUsageCount: true, aiUsageMonth: true },
  });

  if (!user) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const effectivePlan = resolveUserPlan(user);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const usageThisMonth = user.aiUsageMonth === thisMonth ? user.aiUsageCount : 0;

  const limit = effectivePlan === 'FREE' ? 5 : effectivePlan === 'STARTER' ? 20 : Infinity;
  if (usageThisMonth >= limit) {
    return NextResponse.json(
      { error: `Dosiaľ ste vyčerpali AI limit pre tento mesiac (${limit} generovaní)` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const typeLabel: Record<string, string> = {
      PRODUCT: 'produkt', SERVICE: 'služba', MENU_ITEM: 'jedlo/nápoj', PORTFOLIO: 'práca/projekt',
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Si copywriter pre malé firmy v SR/ČR/UA. Píš stručné, predajné popisy produktov v slovenčine. Max 3 vety.',
        },
        {
          role: 'user',
          content: `Napíš popis pre ${typeLabel[data.type] || 'položku'}: "${data.name}"${data.category ? `, kategória: ${data.category}` : ''}.`,
        },
      ],
      max_tokens: 150,
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
      return NextResponse.json({ error: 'Neplatné údaje' }, { status: 400 });
    }
    console.error('AI error:', err);
    return NextResponse.json({ error: 'AI momentálne nedostupné' }, { status: 503 });
  }
}
