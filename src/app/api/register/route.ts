import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { getSuperuserEmails } from '@/lib/credits';
import { isDisposableEmail } from '@/lib/disposable-emails';
import { getClientIp, hashIp, isRegistrationLimited, recordRegistration } from '@/lib/registration-guard';
import { verifyTurnstileFailOpen } from '@/lib/turnstile';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

function invalidDataMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];
  if (field === 'email') return 'Please enter a valid email address.';
  if (field === 'password') return 'Password must be at least 8 characters.';
  return 'Invalid registration data. Please check the form and try again.';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const normalizedEmail = data.email.toLowerCase();
    const isSuperuser = getSuperuserEmails().has(normalizedEmail);

    if (!isSuperuser && isDisposableEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please use your real email address. Temporary email services are not supported.' },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const ipHash = ip ? hashIp(ip) : null;
    if (!ipHash) console.warn('[register] No client IP header — per-IP limit skipped');

    if (!isSuperuser && !(await verifyTurnstileFailOpen(data.turnstileToken, ip))) {
      return NextResponse.json(
        { error: 'Security check failed. Please refresh the page and try again.' },
        { status: 403 },
      );
    }

    if (!isSuperuser && ipHash && await isRegistrationLimited(ipHash)) {
      return NextResponse.json(
        { error: 'Too many accounts created from this network today. Please try again tomorrow.' },
        { status: 429 },
      );
    }

    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 },
      );
    }

    const passwordHash = await hash(data.password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name,
      },
    });

    if (ipHash) {
      // Never fail a completed sign-up because the counter write failed
      await recordRegistration(ipHash).catch((err) => console.error('[register] recordRegistration failed:', err));
    }

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: invalidDataMessage(error), details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Something went wrong on our side. Please try again later.' },
      { status: 500 },
    );
  }
}
