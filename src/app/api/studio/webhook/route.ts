import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_STUDIO_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Studio webhook signature failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return NextResponse.json({ received: true });
    if (session.metadata?.type !== 'studio_access') return NextResponse.json({ received: true });

    const userId = session.metadata?.userId;
    if (!userId) return NextResponse.json({ received: true });

    await db.user.update({
      where: { id: userId },
      data: { studioPaid: true },
    });
    console.log(`✅ Studio access granted: userId=${userId}`);
  }

  return NextResponse.json({ received: true });
}
