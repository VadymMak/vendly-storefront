import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod/v4';
import { db } from '@/lib/db';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const existing = await db.user.findUnique({
      where: { email: data.email },
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
        email: data.email,
        passwordHash,
        name: data.name,
      },
    });

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
