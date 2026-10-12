import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { getSuperuserEmails } from '@/lib/credits';
import { isDisposableEmail } from '@/lib/disposable-emails';
import { getClientIp, hashIp, isRegistrationLimited, recordRegistration } from '@/lib/registration-guard';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

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
        { error: 'Používateľ s týmto emailom už existuje' },
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
        { error: 'Neplatné údaje', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Interná chyba servera' },
      { status: 500 },
    );
  }
}
