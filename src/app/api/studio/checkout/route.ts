import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { z } from 'zod/v4';
import { STUDIO_CREDIT_PACKS } from '@/lib/constants';
import type { StudioCreditPackId } from '@/lib/types';

const checkoutSchema = z.object({
  pack: z.enum(['starter', 'creator', 'pro']),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let pack: StudioCreditPackId;
  try {
    const body = await request.json() as Record<string, unknown>;
    ({ pack } = checkoutSchema.parse(body));
  } catch {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const packConfig = STUDIO_CREDIT_PACKS.find((p) => p.id === pack);
  if (!packConfig) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }
  const origin = process.env.NEXTAUTH_URL ?? 'https://vendshop.shop';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${packConfig.name} — ${packConfig.images} Images + ${packConfig.videos} Video Credits`,
            description: `${packConfig.images} image credits + ${packConfig.videos} video credits · Credits never expire`,
          },
          unit_amount: packConfig.priceEur * 100,
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
