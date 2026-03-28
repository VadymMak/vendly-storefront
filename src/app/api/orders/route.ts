import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveUserPlan } from '@/lib/shop-queries';
import { sendOrderConfirmation, sendNewOrderNotification } from '@/lib/email';

const orderSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(1, 'Meno je povinné'),
  customerEmail: z.string().email('Neplatný e-mail'),
  customerPhone: z.string().optional().default(''),
  note: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string(),
      name: z.string(),
      price: z.number().nullable(),
      quantity: z.number().int().positive(),
    }),
  ).min(1, 'Košík je prázdny'),
  total: z.number().min(0),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = orderSchema.parse(body);

    // Find store by slug
    const store = await db.store.findUnique({
      where: { slug: data.slug },
      select: { id: true, slug: true, name: true, userId: true, isPublished: true },
    });

    if (!store || !store.isPublished) {
      return NextResponse.json({ error: 'Obchod nenájdený' }, { status: 404 });
    }

    // Get user's plan for fee calculation
    const user = await db.user.findUnique({
      where: { id: store.userId },
      select: { plan: true, email: true },
    });

    if (!user) return NextResponse.json({ error: 'Obchod nenájdený' }, { status: 404 });

    const effectivePlan = resolveUserPlan(user);
    // Platform fee: Free plan = 2%, Starter = 0%, Pro = 0%
    const feeRate = effectivePlan === 'FREE' ? 0.02 : 0;
    const platformFee = data.total * feeRate;

    // Create order
    const order = await db.order.create({
      data: {
        storeId: store.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        items: data.items,
        total: data.total,
        platformFee,
        status: 'PENDING',
      },
    });

    // Send notification emails (fire-and-forget)
    void sendOrderConfirmation({
      to: data.customerEmail,
      customerName: data.customerName,
      orderId: order.id,
      storeName: store.name,
      total: data.total,
      items: data.items as Array<{ name: string; quantity: number; price: number | null }>,
    });

    void sendNewOrderNotification({
      to: user.email,
      ownerName: '',
      orderId: order.id,
      storeName: store.name,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      total: data.total,
      items: data.items as Array<{ name: string; quantity: number; price: number | null }>,
    });

    return NextResponse.json({ orderId: order.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || 'Neplatné údaje' },
        { status: 400 },
      );
    }

    console.error('Order creation error:', err);
    return NextResponse.json(
      { error: 'Chyba pri vytváraní objednávky' },
      { status: 500 },
    );
  }
}
