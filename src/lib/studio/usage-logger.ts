import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export interface UsageLogEntry {
  userId:        string;
  modelAlias:    string;
  provider:      string;
  modelId:       string;
  operation:     string;
  status:        'success' | 'error' | 'timeout';
  durationMs?:   number;
  costUsd:       number;
  creditCost:    number;
  byok:          boolean;
  errorMessage?: string;
  metadata?:     Record<string, unknown>;
}

export async function logUsage(entry: UsageLogEntry): Promise<void> {
  try {
    await db.studioUsageLog.create({
      data: {
        ...entry,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Logging must never break the main request
    console.error('[usage-log] Failed to log:', err);
  }
}
