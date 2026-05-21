import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  console.log('[studio/checkout] Starting...');
  console.log('[studio/checkout] STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('[studio/checkout] STRIPE_SECRET_KEY starts with:', process.env.STRIPE_SECRET_KEY?.substring(0, 10));

  try {
    const session = await auth();
    console.log('[studio/checkout] Auth session userId:', session?.user?.id ?? 'none');
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const origin = request.headers.get('origin') || 'https://vendshop.shop';
    console.log('[studio/checkout] Origin:', origin);

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

    console.log('[studio/checkout] Session created, url:', checkoutSession.url);
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[studio/checkout] Error:', error instanceof Error ? error.message : error);
    console.error('[studio/checkout] Stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json({ error: 'Checkout session creation failed' }, { status: 500 });
  }
}
