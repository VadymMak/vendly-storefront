import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { resolveUserPlan } from '@/lib/shop-queries';

const checkoutSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional().default(''),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        name: z.string(),
        price: z.number().nullable(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  total: z.number().min(0),
});

/**
 * POST /api/checkout
 * Creates an Order + Stripe Checkout Session, returns the session URL.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = checkoutSchema.parse(body);

    // Find store + owner
    const store = await db.store.findUnique({
      where: { slug: data.slug },
      include: { user: { select: { id: true, plan: true, email: true, stripeAccountId: true } } },
    });

    if (!store || !store.isPublished) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const effectivePlan = resolveUserPlan(store.user);
    const feeRate = effectivePlan === 'FREE' ? 0.02 : 0;
    const platformFee = Math.round(data.total * feeRate * 100); // in cents

    // Create order in DB first
    const order = await db.order.create({
      data: {
        storeId: store.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        items: data.items,
        total: data.total,
        platformFee: data.total * feeRate,
        status: 'PENDING',
      },
    });

    // Determine the origin for redirect URLs
    const origin = request.headers.get('origin') || 'https://vendshop.shop';

    // Build Stripe line items from order items
    const lineItems = data.items
      .filter((item) => item.price !== null && item.price > 0)
      .map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
          unit_amount: Math.round((item.price as number) * 100),
        },
        quantity: item.quantity,
      }));

    if (lineItems.length === 0) {
      // All items are "on request" / free — skip Stripe, mark order directly
      await db.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });
      return NextResponse.json({ orderId: order.id, url: null }, { status: 201 });
    }

    // Create Stripe Checkout Session
    const sessionParams: Record<string, unknown> = {
      mode: 'payment',
      customer_email: data.customerEmail,
      line_items: lineItems,
      metadata: { orderId: order.id, storeId: store.id },
      success_url: `${origin}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${store.slug}`,
    };

    // If store owner has Stripe Connect, use application_fee
    if (store.user.stripeAccountId && platformFee > 0) {
      Object.assign(sessionParams, {
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: { destination: store.user.stripeAccountId },
        },
      });
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
    );

    // Save stripe session ID on order
    await db.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ orderId: order.id, url: session.url }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Invalid data' }, { status: 400 });
    }
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
