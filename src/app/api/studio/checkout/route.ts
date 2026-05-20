import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = request.headers.get('origin') || 'https://vendshop.shop';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: session.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'AI Studio — Lifetime Access',
            description: 'Unlimited image & video generation. Bring your own API keys.',
          },
          unit_amount: 500, // $5.00
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'studio_access',
      userId: session.user.id,
    },
    success_url: `${origin}/studio?unlocked=1`,
    cancel_url: `${origin}/studio`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
