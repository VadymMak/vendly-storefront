import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  price:       z.string().optional(),
  currency:    z.string().optional(),
  category:    z.string().optional(),
  type:        z.enum(['PRODUCT', 'SERVICE', 'MENU_ITEM', 'PORTFOLIO']).optional(),
  isAvailable: z.boolean().optional(),
  images:      z.array(z.string()).optional(),
});

async function getItem(id: string, userId: string) {
  return db.item.findFirst({
    where: { id, store: { userId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const { id } = await params;
  const item = await getItem(id, session.user.id);
  if (!item) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const updated = await db.item.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.price       !== undefined && { price: data.price ? parseFloat(data.price) : null }),
        ...(data.currency    !== undefined && { currency: data.currency }),
        ...(data.category    !== undefined && { category: data.category || null }),
        ...(data.type        !== undefined && { type: data.type }),
        ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
        ...(data.images      !== undefined && { images: data.images }),
      },
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Neplatné údaje' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Chyba servera' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const { id } = await params;
  const item = await getItem(id, session.user.id);
  if (!item) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 });

  await db.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
