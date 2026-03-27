import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const patchSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const { id } = await params;

  // Verify order belongs to user's store
  const order = await db.order.findFirst({
    where: { id, store: { userId: session.user.id } },
  });
  if (!order) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    await db.order.update({ where: { id }, data: { status: data.status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Chyba servera' }, { status: 500 });
  }
}
