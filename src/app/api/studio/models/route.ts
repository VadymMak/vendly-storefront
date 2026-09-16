import { NextResponse } from 'next/server';
import { MODEL_CATALOG } from '@/lib/studio/config';

export interface PublicModelEntry {
  alias:            string;
  displayName:      string;
  provider:         string;
  operation:        string;
  tier:             string;
  creditCost:       number;
  creditType:       string;
  byokOnly:         boolean;
  supportedRatios?: string[];
}

export async function GET() {
  const models: PublicModelEntry[] = Object.entries(MODEL_CATALOG)
    .filter(([, m]) => m.enabled)
    .map(([alias, m]) => ({
      alias,
      displayName:     m.displayName,
      provider:        m.provider,
      operation:       m.operation,
      tier:            m.tier,
      creditCost:      m.creditCost,
      creditType:      m.creditType,
      byokOnly:        m.byokOnly ?? false,
      supportedRatios: m.supportedRatios,
    }));

  return NextResponse.json({ models });
}
