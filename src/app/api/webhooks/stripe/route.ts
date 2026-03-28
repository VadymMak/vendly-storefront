import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { sendOrderConfirmation, sendNewOrderNotification } from '@/lib/email';
import type Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events (checkout.session.completed, etc.)
 * Proven patterns transferred from vendly: idempotency check, proper error handling.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only process paid sessions
      if (session.payment_status !== 'paid') {
        break;
      }

      const orderId = session.metadata?.orderId;
      if (!orderId) break;

      try {
        // ── Idempotency check (proven pattern from vendly) ─────────────
        const existingPaid = await db.order.findFirst({
          where: { stripeSessionId: session.id, status: 'PAID' },
        });
        if (existingPaid) {
          console.log(`⏭️ Order already processed for session ${session.id}`);
          break;
        }

        // Update order status
        await db.order.update({
          where: { id: orderId },
          data: { status: 'PAID', stripeSessionId: session.id },
        });

        // Fetch order with store info for emails
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: {
            store: {
              select: {
                name: true,
                slug: true,
                user: { select: { email: true, name: true } },
              },
            },
          },
        });

        if (order) {
          const orderItems = order.items as Array<{ name: string; quantity: number; price: number | null }>;

          // Send customer confirmation email
          try {
            await sendOrderConfirmation({
              to: order.customerEmail,
              customerName: order.customerName,
              orderId: order.id,
              storeName: order.store.name,
              total: order.total,
              items: orderItems,
            });
            console.log(`📧 Order confirmation sent: ${order.customerEmail}`);
          } catch (emailErr) {
            console.error('Order confirmation email failed:', emailErr);
          }

          // Send store owner notification email
          try {
            await sendNewOrderNotification({
              to: order.store.user.email,
              ownerName: order.store.user.name || '',
              orderId: order.id,
              storeName: order.store.name,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              total: order.total,
              items: orderItems,
            });
            console.log(`📧 New order notification sent: ${order.store.user.email}`);
          } catch (emailErr) {
            console.error('New order notification email failed:', emailErr);
          }
        }
      } catch (err) {
        console.error('Order processing error:', err);
        return NextResponse.json({ error: 'Order processing failed' }, { status: 500 });
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
