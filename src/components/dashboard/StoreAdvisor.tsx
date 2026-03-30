'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { ShopData, ShopItem, ScoreCheck, AiAdvice, OwnerPlan } from '@/lib/types';
import { calculateStoreScore } from '@/lib/store-score';

interface StoreAdvisorProps {
  store: ShopData;
  items: ShopItem[];
  categoryCount: number;
  userPlan: OwnerPlan;
  onNavigateTab?: (tab: string) => void;
}

// ── Score ring (SVG circle) ──────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Check item ───────────────────────────────────────────────────────────────
function CheckItem({
  check,
  t,
  onNavigate,
}: {
  check: ScoreCheck;
  t: (key: string) => string;
  onNavigate?: (tab: string) => void;
}) {
  const levelColors = {
    critical: check.passed ? 'text-green-600' : 'text-red-600',
    warning: check.passed ? 'text-green-600' : 'text-amber-500',
    bonus: check.passed ? 'text-green-600' : 'text-gray-400',
  };

  return (
    <button
      type="button"
      onClick={() => check.tab && onNavigate?.(check.tab)}
      disabled={!check.tab}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        check.tab ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className={levelColors[check.level]}>
        {check.passed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
      </span>
      <span className={check.passed ? 'text-gray-400 line-through' : 'text-secondary'}>
        {t(check.labelKey)}
      </span>
      {check.tab && !check.passed && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto text-gray-300">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

// ── AI Advice card ───────────────────────────────────────────────────────────
function AdviceCard({ advice }: { advice: AiAdvice }) {
  const priorityStyles = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-blue-200 bg-blue-50',
  };
  const dotStyles = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-500',
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${priorityStyles[advice.priority]}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotStyles[advice.priority]}`} />
        <p className="text-secondary">{advice.text}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function StoreAdvisor({ store, items, categoryCount, userPlan, onNavigateTab }: StoreAdvisorProps) {
  const t = useTranslations('storeAdvisor');
  const locale = useLocale();

  const [advices, setAdvices] = useState<AiAdvice[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const { score, checks } = useMemo(
    () => calculateStoreScore(store, items, categoryCount),
    [store, items, categoryCount],
  );

  const failedChecks = checks.filter((c) => !c.passed);
  const passedChecks = checks.filter((c) => c.passed);
  const canUseAi = userPlan === 'STARTER' || userPlan === 'PRO';

  const handleGetAdvice = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/store-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, userLocale: locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Error');
        if (data.used !== undefined) setUsage({ used: data.used, limit: data.limit });
        return;
      }
      setAdvices(data.advices);
      setUsage({ used: data.used, limit: data.limit });
    } catch {
      setAiError(t('aiUnavailable'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section>
      {/* ── Score section ──────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-6">
        <ScoreRing score={score} />
        <div>
          <h3 className="text-lg font-bold text-secondary">{t('storeScore')}</h3>
          <p className="text-sm text-neutral">
            {score >= 80 ? t('scoreExcellent') : score >= 50 ? t('scoreGood') : t('scoreNeedsWork')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {passedChecks.length}/{checks.length} {t('checksPassed')}
          </p>
        </div>
      </div>

      {/* ── Failed checks ──────────────────────────────────────────────── */}
      {failedChecks.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral">{t('toImprove')}</h4>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {failedChecks.map((check) => (
              <CheckItem key={check.id} check={check} t={t} onNavigate={onNavigateTab} />
            ))}
          </div>
        </div>
      )}

      {/* ── Passed checks (collapsible) ────────────────────────────────── */}
      {passedChecks.length > 0 && (
        <details className="mb-6">
          <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral hover:text-secondary">
            {t('completed')} ({passedChecks.length})
          </summary>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {passedChecks.map((check) => (
              <CheckItem key={check.id} check={check} t={t} />
            ))}
          </div>
        </details>
      )}

      {/* ── AI Advisor section ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
          </svg>
          <h3 className="text-base font-bold text-violet-900">{t('aiAdvisor')}</h3>
        </div>

        {canUseAi ? (
          <>
            <p className="mb-3 text-sm text-violet-700">{t('aiDesc')}</p>

            {/* Usage meter */}
            {usage && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-violet-600 mb-1">
                  <span>{t('aiUsed', { used: usage.used, limit: usage.limit })}</span>
                  <span>{usage.limit - usage.used} {t('aiRemaining')}</span>
                </div>
                <div className="h-1.5 rounded-full bg-violet-200">
                  <div
                    className="h-1.5 rounded-full bg-violet-600 transition-all"
                    style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleGetAdvice}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
              </svg>
              {aiLoading ? t('aiLoading') : t('aiGetAdvice')}
            </button>

            {aiError && (
              <p className="mt-2 text-sm text-red-600">{aiError}</p>
            )}

            {/* AI results */}
            {advices.length > 0 && (
              <div className="mt-4 space-y-2">
                {advices.map((advice) => (
                  <AdviceCard key={advice.id} advice={advice} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* FREE plan — locked state */
          <div className="text-center py-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-violet-900 mb-1">{t('aiLocked')}</p>
            <p className="text-xs text-violet-600">{t('aiLockedDesc')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
