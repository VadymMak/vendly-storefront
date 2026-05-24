import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// Credit packs configuration
export const CREDIT_PACKS = {
  pack_s: {
    name:        'Credit Pack S',
    description: '120 images + 5 videos',
    price:       1200, // €12.00 in cents
    images:      120,
    videos:      5,
  },
  pack_l: {
    name:        'Credit Pack L',
    description: '350 images + 15 videos',
    price:       2900, // €29.00 in cents
    images:      350,
    videos:      15,
  },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { packId?: string };
  const packId = body.packId as CreditPackId;

  if (!packId || !CREDIT_PACKS[packId]) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const pack = CREDIT_PACKS[packId];
  const origin = process.env.NEXTAUTH_URL ?? 'https://vendshop.shop';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name:        pack.name,
          description: pack.description,
        },
        unit_amount: pack.price,
      },
      quantity: 1,
    }],
    metadata: {
      userId: session.user.id,
      packId,
      images: String(pack.images),
      videos: String(pack.videos),
      type:   'credit_pack',
    },
    success_url: `${origin}/studio?purchase=success`,
    cancel_url:  `${origin}/studio?purchase=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
