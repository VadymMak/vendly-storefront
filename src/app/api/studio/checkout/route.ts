import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { z } from 'zod/v4';

const CREDIT_PACKS = {
  starter: { label: 'Starter Pack — 50 Images + 3 Videos',   images: 50,  videos: 3,  priceEur: 500  },
  creator: { label: 'Creator Pack — 150 Images + 8 Videos',  images: 150, videos: 8,  priceEur: 1000 },
  pro:     { label: 'Pro Pack — 400 Images + 20 Videos',     images: 400, videos: 20, priceEur: 2000 },
} as const;

const checkoutSchema = z.object({
  pack: z.enum(['starter', 'creator', 'pro']),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let pack: 'starter' | 'creator' | 'pro';
  try {
    const body = await request.json() as Record<string, unknown>;
    ({ pack } = checkoutSchema.parse(body));
  } catch {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const packConfig = CREDIT_PACKS[pack];
  const origin = process.env.NEXTAUTH_URL ?? 'https://vendshop.shop';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: packConfig.label,
            description: `${packConfig.images} images + ${packConfig.videos} videos · Credits never expire`,
          },
          unit_amount: packConfig.priceEur,
        },
        quantity: 1,
      }],
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        pack,
        images: String(packConfig.images),
        videos: String(packConfig.videos),
        type:   'credit_pack',
      },
      success_url: `${origin}/studio/generate?checkout=success&pack=${pack}`,
      cancel_url:  `${origin}/studio/generate?checkout=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[studio/checkout] Stripe error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
