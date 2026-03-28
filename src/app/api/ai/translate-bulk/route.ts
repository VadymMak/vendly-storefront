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

    const store = await db.store.findFirst({
      where: { id: data.storeId, userId: session.user.id },
      include: { items: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const settings = store.settings as Record<string, unknown>;

    // Check Free plan limit
    if (effectivePlan === 'FREE' && settings.translationUsedAt) {
      return NextResponse.json({
        error: 'FREE_LIMIT',
        message: 'Free plan translation already used.',
      }, { status: 429 });
    }

    const langName = LANG_NAMES[store.shopLanguage] || 'Slovak';

    // Collect all texts to translate in one batch
    const textsToTranslate: { id: string; field: string; text: string }[] = [];

    if (store.description) {
      textsToTranslate.push({ id: 'store', field: 'description', text: store.description });
    }
    if (typeof settings.aboutText === 'string' && settings.aboutText) {
      textsToTranslate.push({ id: 'store', field: 'aboutText', text: settings.aboutText });
    }
    if (typeof settings.deliveryInfo === 'string' && settings.deliveryInfo) {
      textsToTranslate.push({ id: 'store', field: 'deliveryInfo', text: settings.deliveryInfo });
    }

    for (const item of store.items) {
      if (item.name) {
        textsToTranslate.push({ id: item.id, field: 'name', text: item.name });
      }
      if (item.description) {
        textsToTranslate.push({ id: item.id, field: 'description', text: item.description });
      }
      if (item.category) {
        textsToTranslate.push({ id: item.id, field: 'category', text: item.category });
      }
    }

    if (textsToTranslate.length === 0) {
      return NextResponse.json({ translated: 0, message: 'Nothing to translate' });
    }

    // Build a single prompt with all texts (numbered for parsing)
    const numberedTexts = textsToTranslate.map((t, i) => `[${i}] ${t.text}`).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator for small business e-commerce. ` +
            `Translate all numbered texts below to ${langName}. Rules:\n` +
            `- Keep brand names, proper nouns, product names as-is\n` +
            `- Use natural, conversational tone for an online store\n` +
            `- Keep prices, numbers, units, URLs unchanged\n` +
            `- If a text is already in ${langName}, return it unchanged\n` +
            `- Return ONLY numbered translations in exact same format: [0] translated text\\n[1] translated text\\n...`,
        },
        { role: 'user', content: numberedTexts },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const result = completion.choices[0]?.message?.content?.trim() || '';

    // Parse numbered results
    const translations: string[] = [];
    const lines = result.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[(\d+)]\s*(.+)$/);
      if (match) {
        translations[parseInt(match[1])] = match[2].trim();
      }
    }

    // Apply translations
    let storeDescription = store.description;
    const newSettings = { ...settings };
    const itemUpdates: { id: string; data: Record<string, string> }[] = [];

    for (let i = 0; i < textsToTranslate.length; i++) {
      const t = textsToTranslate[i];
      const translated = translations[i];
      if (!translated) continue;

      if (t.id === 'store') {
        if (t.field === 'description') storeDescription = translated;
        else newSettings[t.field] = translated;
      } else {
        // Item update
        let existing = itemUpdates.find((u) => u.id === t.id);
        if (!existing) {
          existing = { id: t.id, data: {} };
          itemUpdates.push(existing);
        }
        existing.data[t.field] = translated;
      }
    }

    // Update store
    newSettings.translationUsedAt = new Date().toISOString();
    await db.store.update({
      where: { id: store.id },
      data: {
        description: storeDescription,
        settings: newSettings as Parameters<typeof db.store.update>[0]['data']['settings'],
      },
    });

    // Update items
    for (const update of itemUpdates) {
      await db.item.update({
        where: { id: update.id },
        data: update.data,
      });
    }

    return NextResponse.json({
      translated: textsToTranslate.length,
      items: itemUpdates.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Bulk translation error:', err);
    return NextResponse.json({ error: 'Translation service unavailable' }, { status: 503 });
  }
}
