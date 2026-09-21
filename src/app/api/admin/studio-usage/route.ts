import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const allLogs = await db.studioUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id:           true,
      provider:     true,
      modelAlias:   true,
      operation:    true,
      status:       true,
      costUsd:      true,
      creditCost:   true,
      durationMs:   true,
      byok:         true,
      createdAt:    true,
      userId:       true,
      errorMessage: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalCalls   = allLogs.length;
  const totalCost    = allLogs.reduce((s, l) => s + l.costUsd, 0);
  const totalCredits = allLogs.reduce((s, l) => s + l.creditCost, 0);
  const totalErrors  = allLogs.filter(l => l.status === 'error').length;
  const avgDuration  = totalCalls > 0
    ? allLogs.reduce((s, l) => s + (l.durationMs ?? 0), 0) / totalCalls
    : 0;
  const byokCalls = allLogs.filter(l => l.byok).length;

  const platformCost = allLogs
    .filter(l => !l.byok && l.status === 'success')
    .reduce((s, l) => s + l.costUsd, 0);
  const byokCost = allLogs
    .filter(l => l.byok && l.status === 'success')
    .reduce((s, l) => s + l.costUsd, 0);

  // Per-day
  const dailyMap = new Map<string, { calls: number; cost: number; errors: number }>();
  for (const log of allLogs) {
    const day   = log.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { calls: 0, cost: 0, errors: 0 };
    entry.calls++;
    entry.cost += log.costUsd;
    if (log.status === 'error') entry.errors++;
    dailyMap.set(day, entry);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // By provider
  const providerMap = new Map<string, { calls: number; cost: number; errors: number }>();
  for (const log of allLogs) {
    const entry = providerMap.get(log.provider) ?? { calls: 0, cost: 0, errors: 0 };
    entry.calls++;
    entry.cost += log.costUsd;
    if (log.status === 'error') entry.errors++;
    providerMap.set(log.provider, entry);
  }
  const byProvider = Array.from(providerMap.entries())
    .map(([provider, data]) => ({ provider, ...data }))
    .sort((a, b) => b.calls - a.calls);

  // By model
  const modelMap = new Map<string, { calls: number; cost: number }>();
  for (const log of allLogs) {
    const entry = modelMap.get(log.modelAlias) ?? { calls: 0, cost: 0 };
    entry.calls++;
    entry.cost += log.costUsd;
    modelMap.set(log.modelAlias, entry);
  }
  const byModel = Array.from(modelMap.entries())
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.calls - a.calls);

  // By operation
  const opMap = new Map<string, number>();
  for (const log of allLogs) {
    opMap.set(log.operation, (opMap.get(log.operation) ?? 0) + 1);
  }
  const byOperation = Array.from(opMap.entries())
    .map(([operation, calls]) => ({ operation, calls }))
    .sort((a, b) => b.calls - a.calls);

  // Top users
  const userMap = new Map<string, { calls: number; cost: number }>();
  for (const log of allLogs) {
    const entry = userMap.get(log.userId) ?? { calls: 0, cost: 0 };
    entry.calls++;
    entry.cost += log.costUsd;
    userMap.set(log.userId, entry);
  }
  const topUserIds = Array.from(userMap.entries())
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 10);

  const users = await db.user.findMany({
    where: { id: { in: topUserIds.map(([id]) => id) } },
    select: { id: true, email: true, name: true },
  });
  const userLookup = new Map(users.map(u => [u.id, u]));
  const topUsers = topUserIds.map(([id, data]) => ({
    userId: id,
    email:  userLookup.get(id)?.email ?? 'unknown',
    name:   userLookup.get(id)?.name ?? null,
    ...data,
  }));

  // Recent errors (last 20)
  const recentErrors = allLogs
    .filter(l => l.status === 'error')
    .slice(0, 20)
    .map(l => ({
      id:           l.id,
      modelAlias:   l.modelAlias,
      provider:     l.provider,
      errorMessage: l.errorMessage,
      createdAt:    l.createdAt,
    }));

  return NextResponse.json({
    summary: { totalCalls, totalCost, totalCredits, totalErrors, avgDuration, byokCalls, platformCost, byokCost, days },
    daily,
    byProvider,
    byModel,
    byOperation,
    topUsers,
    recentErrors,
  });
}
