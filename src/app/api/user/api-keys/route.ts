import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod/v4';

const KEY_PREFIXES: Record<string, string> = {
  replicate:   'r8_',
  anthropic:   'sk-ant-',
  xai:         'xai-',
  elevenlabs:  'sk_',
};

const saveSchema = z.object({
  provider: z.enum(['replicate', 'anthropic', 'xai', 'elevenlabs']),
  key:      z.string().min(10),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await db.userApiKey.findMany({
    where:   { userId: session.user.id },
    select:  { id: true, provider: true, keyHint: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(keys);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const data = saveSchema.parse(body);

  const expectedPrefix = KEY_PREFIXES[data.provider];
  if (expectedPrefix && !data.key.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: `Invalid ${data.provider} API key — must start with "${expectedPrefix}"` },
      { status: 400 },
    );
  }

  const encryptedKey = encrypt(data.key);
  const keyHint      = '••••' + data.key.slice(-4);

  await db.userApiKey.upsert({
    where:  { userId_provider: { userId: session.user.id, provider: data.provider } },
    create: { userId: session.user.id, provider: data.provider, encryptedKey, keyHint },
    update: { encryptedKey, keyHint },
  });

  return NextResponse.json({ ok: true, provider: data.provider, keyHint });
}
