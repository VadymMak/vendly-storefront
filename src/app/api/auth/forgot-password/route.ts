import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { getSuperuserEmails } from '@/lib/credits';
import { sendPasswordResetEmail } from '@/lib/email';
import { PASSWORD_RESET } from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, hashIp } from '@/lib/registration-guard';
import { generateResetToken, hashResetToken } from '@/lib/password-reset';

const HOUR_MS = 60 * 60 * 1000;

const schema = z.object({ email: z.email() });

// Same body whether or not the account exists — no email enumeration
const GENERIC_RESPONSE = {
  message: 'If an account with that email exists, we sent a password reset link.',
};

export async function POST(request: Request) {
  let email: string;
  try {
    email = schema.parse(await request.json()).email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipHash = ip ? hashIp(ip) : null;

  // Cheap per-network cap on all requests, existing account or not
  if (ipHash && !checkRateLimit(`forgot-password:${ipHash}`, { maxRequests: PASSWORD_RESET.requestsPerIpHour, windowMs: HOUR_MS })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, passwordHash: true },
    });

    // Superusers log in with ADMIN_PASSWORD and have no passwordHash — never reset them
    if (!user || !user.passwordHash || getSuperuserEmails().has(email)) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Everything else runs after the response: both branches cost exactly one DB round
    // trip, so response time doesn't reveal whether the account exists
    void issueResetLink({ id: user.id, name: user.name, email }, ipHash)
      .catch((err) => console.error('[forgot-password] issue failed:', err));

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

async function issueResetLink(user: { id: string; name: string | null; email: string }, ipHash: string | null) {
  const since = new Date(Date.now() - HOUR_MS);
  const [forUser, forIp] = await Promise.all([
    db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: since } } }),
    ipHash
      ? db.passwordResetToken.count({ where: { requestIpHash: ipHash, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);
  if (forUser >= PASSWORD_RESET.perUserPerHour || forIp >= PASSWORD_RESET.perIpPerHour) {
    console.warn('[forgot-password] rate limited', { forUser, forIp });
    return;
  }

  const token = generateResetToken();
  await db.passwordResetToken.create({
    data: {
      userId:        user.id,
      tokenHash:     hashResetToken(token),
      expiresAt:     new Date(Date.now() + PASSWORD_RESET.tokenTtlMinutes * 60 * 1000),
      requestIpHash: ipHash,
    },
  });

  await sendPasswordResetEmail({ email: user.email, name: user.name || 'there', token });

  // Opportunistic cleanup of long-dead tokens
  await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * HOUR_MS) } } });
}
