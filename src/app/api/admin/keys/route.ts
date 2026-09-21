import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const PLATFORM_USER_ID = 'platform';

// GET — list all platform keys (hint only, never full key)
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const keys = await db.userApiKey.findMany({
    where: { userId: PLATFORM_USER_ID, isPlatform: true },
    select: {
      id: true,
      provider: true,
      keyHint: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { provider: 'asc' },
  });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const spendLogs = await db.studioUsageLog.findMany({
    where: {
      createdAt: { gte: since },
      byok: false,
      status: 'success',
    },
    select: { provider: true, costUsd: true },
  });

  const spendByProvider: Record<string, number> = {};
  for (const log of spendLogs) {
    spendByProvider[log.provider] = (spendByProvider[log.provider] ?? 0) + log.costUsd;
  }

  const auditLogs = await db.platformKeyAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ keys, spendByProvider, auditLogs });
}

// POST — add or rotate a platform key
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json() as { provider: string; key: string };
  if (!body.provider || !body.key) {
    return NextResponse.json({ error: 'provider and key are required' }, { status: 400 });
  }

  const encryptedKey = encrypt(body.key.trim());
  const keyHint = body.key.trim().length > 4
    ? `...${body.key.trim().slice(-4)}`
    : '****';

  const existing = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: PLATFORM_USER_ID, provider: body.provider } },
    select: { id: true, keyHint: true },
  });

  const action = existing ? 'rotated' : 'created';

  const key = await db.userApiKey.upsert({
    where: { userId_provider: { userId: PLATFORM_USER_ID, provider: body.provider } },
    update: { encryptedKey, keyHint, isPlatform: true, isActive: true },
    create: {
      userId: PLATFORM_USER_ID,
      provider: body.provider,
      encryptedKey,
      keyHint,
      isPlatform: true,
      isActive: true,
    },
  });

  await db.platformKeyAuditLog.create({
    data: {
      keyId: key.id,
      provider: body.provider,
      action,
      adminEmail: guard.user.email,
      metadata: existing ? { oldHint: existing.keyHint, newHint: keyHint } : { newHint: keyHint },
    },
  });

  return NextResponse.json({ ok: true, action, keyHint });
}

// PATCH — enable/disable a platform key
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json() as { provider: string; isActive: boolean };
  if (!body.provider || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'provider and isActive are required' }, { status: 400 });
  }

  const existing = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: PLATFORM_USER_ID, provider: body.provider } },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  await db.userApiKey.update({
    where: { id: existing.id },
    data: { isActive: body.isActive },
  });

  await db.platformKeyAuditLog.create({
    data: {
      keyId: existing.id,
      provider: body.provider,
      action: body.isActive ? 'enabled' : 'disabled',
      adminEmail: guard.user.email,
    },
  });

  return NextResponse.json({ ok: true });
}

