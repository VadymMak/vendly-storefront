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
const COLOR_DEFAULTS: Record<string, 'light' | 'dark' | 'warm' | 'bold' | 'festive' | 'elegant'> = {
  food:       'warm',
  restaurant: 'warm',
  beauty:     'elegant',
  repair:     'dark',
  physical:   'light',
  digital:    'light',
  events:     'festive',
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
            'You are an expert e-commerce setup assistant. ' +
            'Return ONLY a valid JSON object. No markdown, no extra text. ' +
            'CRITICAL: shopDescription must be ONLY a short 2-3 sentence description of the business. ' +
            'Do NOT include product names, product lists, or item details in shopDescription. ' +
            'Products go ONLY in the items array.',
        },
        {
          role: 'user',
          content: `Business name: "${data.businessName}"
Business description: "${data.businessDescription || 'not provided'}"
Business type: ${data.templateId}
Output language: ${langName}
Currency: ${currency}

Return a JSON object with exactly this structure:
{
  "shopName": "professional business name in ${langName}",
  "shopDescription": "2-3 sentence business description in ${langName}",
  "colorScheme": "${defaultColor}",
  "colorReason": "one sentence in ${langName}",
  "items": [
    {"name": "...", "description": "...", "price": 0, "currency": "${currency}", "category": "...", "type": "${itemType}"}
  ]
}

STRICT rules:
- shopName: translate/adapt the business name "${data.businessName}" into ${langName}. Short, professional, suitable for a storefront header
- shopDescription: ONLY a 2-3 sentence marketing description of the business. Do NOT list products here. Do NOT include numbering or bullet points
- items: exactly 5 items typical for a ${data.templateId} business. Each item is a separate object in the array
- colorScheme: one of light, dark, warm, bold, festive, elegant
- Prices must be realistic for the ${currency} market
- ALL text must be in ${langName}`,
        },
      ],
      max_tokens: 1000,
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
