import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';

const schema = z.object({
  businessName:        z.string().min(1),
  businessDescription: z.string().default(''),
  templateId:          z.string().default('physical'),
  shopLanguage:        z.string().default('sk'),
});

const LANG_NAMES: Record<string, string> = {
  sk: 'Slovak', cs: 'Czech', uk: 'Ukrainian', de: 'German', en: 'English',
};

// Smart color scheme defaults based on business type
const COLOR_DEFAULTS: Record<string, 'light' | 'dark' | 'warm' | 'bold'> = {
  food:       'warm',
  restaurant: 'warm',
  beauty:     'bold',
  repair:     'dark',
  physical:   'light',
  digital:    'light',
};

// Typical item type per business category
const ITEM_TYPE_MAP: Record<string, string> = {
  food:       'PRODUCT',
  restaurant: 'MENU_ITEM',
  beauty:     'SERVICE',
  repair:     'SERVICE',
  physical:   'PRODUCT',
  digital:    'PRODUCT',
};

// Currency by language
const CURRENCY_MAP: Record<string, string> = {
  cs: 'CZK',
  uk: 'UAH',
  sk: 'EUR',
  de: 'EUR',
  en: 'EUR',
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
    return NextResponse.json({ error: 'AI limit reached for this month' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const langName = LANG_NAMES[data.shopLanguage] || 'Slovak';
    const defaultColor = COLOR_DEFAULTS[data.templateId] || 'light';
    const itemType = ITEM_TYPE_MAP[data.templateId] || 'PRODUCT';
    const currency = CURRENCY_MAP[data.shopLanguage] || 'EUR';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert e-commerce setup assistant for small businesses in Central and Eastern Europe. ' +
            'Generate shop setup data as valid JSON only. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: `Business name: "${data.businessName}"
Business description: "${data.businessDescription || 'not provided'}"
Business type: ${data.templateId}
Output language: ${langName}
Currency: ${currency}

Generate a JSON object with these exact fields:
{
  "shopDescription": "2-3 sentence professional description in ${langName}",
  "colorScheme": "${defaultColor}",
  "colorReason": "one sentence in ${langName} why this color scheme fits this business",
  "items": [
    {
      "name": "item name in ${langName}",
      "description": "one sentence in ${langName}",
      "price": 12.50,
      "currency": "${currency}",
      "category": "category name in ${langName}",
      "type": "${itemType}"
    }
  ]
}

Rules:
- Exactly 5 items in the "items" array
- colorScheme must be one of: light, dark, warm, bold
- Items must be typical for a ${data.templateId} business
- Prices must be realistic for the market (${currency})
- All text (shopDescription, colorReason, names, descriptions, categories) must be in ${langName}`,
        },
      ],
      max_tokens: 900,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    });

    // Increment AI usage counter
    await db.user.update({
      where: { id: session.user.id },
      data: {
        aiUsageCount: usageThisMonth + 1,
        aiUsageMonth: thisMonth,
      },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('AI setup-shop error:', err);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
