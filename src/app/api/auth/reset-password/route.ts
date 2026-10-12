import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { getSuperuserEmails } from '@/lib/credits';
import { hashResetToken, notePasswordChanged } from '@/lib/password-reset';

const schema = z.object({
  token:    z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

export async function POST(request: Request) {
  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await request.json());
  } catch (error) {
    const field = error instanceof z.ZodError ? error.issues[0]?.path[0] : undefined;
    return NextResponse.json(
      { error: field === 'password' ? 'Password must be 8 to 128 characters.' : INVALID_LINK },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const tokenHash = hashResetToken(data.token);

    const record = await db.passwordResetToken.findUnique({
      where:  { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { email: true } } },
    });
    if (!record || record.usedAt || record.expiresAt <= now || getSuperuserEmails().has(record.user.email)) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    // Atomic claim — of two concurrent requests with the same token only one wins
    const claimed = await db.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data:  { usedAt: now },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    }

    const passwordHash = await hash(data.password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data:  { passwordHash, passwordChangedAt: now },
      }),
      // Any other outstanding links for this account stop working too
      db.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data:  { usedAt: now },
      }),
    ]);

    // Existing sessions (incl. an attacker's) are rejected from the next request on
    notePasswordChanged(record.userId, now);

    return NextResponse.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
