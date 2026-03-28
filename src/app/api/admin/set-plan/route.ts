import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const schema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['FREE', 'STARTER', 'PRO']),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
