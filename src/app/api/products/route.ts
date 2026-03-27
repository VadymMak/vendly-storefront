import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const productSchema = z.object({
  storeId:     z.string().min(1),
  name:        z.string().min(1, 'Názov je povinný'),
  description: z.string().optional().default(''),
  price:       z.string().optional(),
  currency:    z.string().default('EUR'),
  category:    z.string().optional().default(''),
  type:        z.enum(['PRODUCT', 'SERVICE', 'MENU_ITEM', 'PORTFOLIO']),
  isAvailable: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = productSchema.parse(body);

    // Verify store belongs to user
    const store = await db.store.findFirst({
      where: { id: data.storeId, userId: session.user.id },
    });
    if (!store) return NextResponse.json({ error: 'Obchod nenájdený' }, { status: 404 });

    const item = await db.item.create({
      data: {
        storeId:     data.storeId,
        name:        data.name,
        description: data.description || null,
        price:       data.price ? parseFloat(data.price) : null,
        currency:    data.currency,
        category:    data.category || null,
        type:        data.type,
        isAvailable: data.isAvailable,
        images:      [],
      },
    });

    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Neplatné údaje' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Chyba servera' }, { status: 500 });
  }
}
