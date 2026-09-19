import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { SUBSCRIPTION_PLANS, getOrCreateCredits } from '@/lib/credits';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let plan: keyof typeof SUBSCRIPTION_PLANS;
  try {
    const body = await request.json() as { plan: string };
    if (!body.plan || !(body.plan in SUBSCRIPTION_PLANS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    plan = body.plan as keyof typeof SUBSCRIPTION_PLANS;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig.priceId) {
    return NextResponse.json({ error: 'Subscription not configured' }, { status: 500 });
  }

  const origin = process.env.NEXTAUTH_URL ?? 'https://vendshop.shop';

  // Ensure credits row exists
  await getOrCreateCredits(session.user.id);

  // Find or create Stripe customer
  let customerId: string;
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  if (user?.stripeCustomerId) {
    customerId = user.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: session.user.email,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${origin}/studio/generate?subscription=success&plan=${plan}`,
      cancel_url: `${origin}/studio/generate`,
      metadata: {
        type: 'subscription',
        userId: session.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[studio/subscribe] Stripe error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
