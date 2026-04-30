import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

const schema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['FREE', 'STARTER', 'PRO']),
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const { userId, plan } = schema.parse(body);

    await db.user.update({
      where: { id: userId },
      data: { plan: plan as 'FREE' | 'STARTER' | 'PRO' },
    });

    return NextResponse.json({ success: true, plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
