import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const schema = z.object({
  storeId: z.string().min(1),
  userLocale: z.string().default('en'),
});

const PLAN_LIMITS: Record<string, number> = {
  FREE: 0,
  STARTER: 10,
  PRO: 50,
};

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  sk: 'Odpovedaj v slovenčine.',
  cs: 'Odpovídej v češtině.',
  uk: 'Відповідай українською.',
  de: 'Antworte auf Deutsch.',
  en: 'Respond in English.',
};

const COOLDOWN_MS = 60_000; // 1 minute between requests

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      email: true,
      aiAdvisorCount: true,
      aiAdvisorMonth: true,
      aiAdvisorLastUsed: true,
    },
  });

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const effectivePlan = resolveUserPlan(user);
  const isAdmin = !!(ADMIN_EMAIL && user.email === ADMIN_EMAIL);
  const limit = isAdmin ? Infinity : (PLAN_LIMITS[effectivePlan] ?? 0);

  if (limit === 0) {
    return NextResponse.json({ error: 'Upgrade to Starter or Pro for AI advisor' }, { status: 403 });
  }

  // Check monthly limit (admin bypasses)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const usageThisMonth = user.aiAdvisorMonth === thisMonth ? (user.aiAdvisorCount ?? 0) : 0;

  if (!isAdmin && usageThisMonth >= limit) {
    return NextResponse.json(
      { error: 'Monthly AI advisor limit reached', used: usageThisMonth, limit },
      { status: 429 },
    );
  }

  // Cooldown check (admin bypasses)
  if (!isAdmin && user.aiAdvisorLastUsed) {
    const elapsed = Date.now() - new Date(user.aiAdvisorLastUsed).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSec}s before next request`, cooldown: waitSec },
        { status: 429 },
      );
    }
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Verify store ownership
    const store = await db.store.findFirst({
      where: { id: data.storeId, userId: session.user.id },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Gather store data for analysis
    const items = await db.item.findMany({
      where: { storeId: data.storeId },
      select: {
        name: true,
        description: true,
        price: true,
        currency: true,
        category: true,
        images: true,
        isAvailable: true,
      },
    });

    const settings = store.settings as Record<string, unknown>;
    const langInstruction = LOCALE_INSTRUCTIONS[data.userLocale] || LOCALE_INSTRUCTIONS.en;

    const storeContext = JSON.stringify({
      name: store.name,
      description: store.description,
      type: store.templateId,
      language: store.shopLanguage,
      isPublished: store.isPublished,
      hasLogo: !!store.logo,
      hasBanner: !!settings.bannerImage,
      hasAddress: !!settings.address,
      hasPhone: !!settings.phone,
      hasWhatsapp: !!settings.whatsapp,
      hasSocial: !!(settings.instagram || settings.facebook),
      hasHours: !!settings.structuredHours,
      hasAbout: !!settings.aboutText,
      hasDelivery: !!settings.deliveryInfo,
      promoCount: Array.isArray(settings.promoBanners) ? settings.promoBanners.length : 0,
      totalItems: items.length,
      availableItems: items.filter((i) => i.isAvailable).length,
      itemsWithoutPhoto: items.filter((i) => i.images.length === 0).length,
      itemsWithoutDesc: items.filter((i) => !i.description?.trim()).length,
      categories: [...new Set(items.map((i) => i.category).filter(Boolean))],
      priceRange: items.length > 0
        ? { min: Math.min(...items.filter((i) => i.price).map((i) => i.price!)), max: Math.max(...items.filter((i) => i.price).map((i) => i.price!)) }
        : null,
      items: items.slice(0, 30).map((i) => ({
        name: i.name,
        category: i.category,
        price: i.price,
        hasPhoto: i.images.length > 0,
        hasDesc: !!i.description?.trim(),
      })),
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert e-commerce store advisor. Analyze the store data and give 3-5 specific, actionable recommendations to improve the store. ${langInstruction}

Format your response as a JSON object with "advices" array. Each item has:
- "text": the recommendation (1-2 sentences, specific and actionable)
- "priority": "high" | "medium" | "low"
- "action": an object with ONE of these navigation hints (or omit if no direct action):
  - {"tab": "general"} — store name, description, language
  - {"tab": "design"} — colors, logo, banner
  - {"tab": "contact"} — phone, address, social media, whatsapp, hours
  - {"tab": "promo"} — promotional banners
  - {"page": "/dashboard/products/new"} — add new products
  - {"page": "/dashboard/products"} — edit existing products

Focus on: missing information, product quality, pricing strategy, categories balance, marketing opportunities. Be specific — mention product names, categories, exact numbers. Don't give generic advice.`,
        },
        {
          role: 'user',
          content: `Analyze this store:\n${storeContext}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    // Update usage
    await db.user.update({
      where: { id: session.user.id },
      data: {
        aiAdvisorCount: usageThisMonth + 1,
        aiAdvisorMonth: thisMonth,
        aiAdvisorLastUsed: new Date(),
      },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let advices: { text: string; priority: string; action?: { tab?: string; page?: string } }[] = [];
    try {
      const parsed = JSON.parse(raw);
      advices = Array.isArray(parsed) ? parsed : parsed.recommendations || parsed.advices || [];
    } catch {
      advices = [];
    }

    // Validate action fields
    const validTabs = new Set(['general', 'design', 'contact', 'promo', 'categories']);
    const validPages = new Set(['/dashboard/products', '/dashboard/products/new', '/dashboard/orders']);

    return NextResponse.json({
      advices: advices.map((a, i) => {
        let action: { tab?: string; page?: string } | undefined;
        if (a.action?.tab && validTabs.has(a.action.tab)) {
          action = { tab: a.action.tab };
        } else if (a.action?.page && validPages.has(a.action.page)) {
          action = { page: a.action.page };
        }
        return {
          id: `advice-${i}`,
          text: a.text || '',
          priority: a.priority || 'medium',
          action,
        };
      }),
      used: usageThisMonth + 1,
      limit: isAdmin ? 9999 : limit,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    console.error('AI advisor error:', err);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
