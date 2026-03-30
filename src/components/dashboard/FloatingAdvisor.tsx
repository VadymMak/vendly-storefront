'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ShopData, ShopItem, ScoreCheck, AiAdvice, OwnerPlan } from '@/lib/types';
import { calculateStoreScore } from '@/lib/store-score';

interface FloatingAdvisorProps {
  storeId: string | null;
  userPlan: string;
  isAdmin?: boolean;
}

// ── Score ring (compact) ────────────────────────────────────────────────────
function ScoreRingSmall({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
        className="transition-all duration-500"
      />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="11" fontWeight="700">{score}</text>
    </svg>
  );
}

// ── Score ring (large) ──────────────────────────────────────────────────────
function ScoreRingLarge({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Check item ──────────────────────────────────────────────────────────────
function CheckItem({ check, t, onNavigate }: {
  check: ScoreCheck;
  t: (key: string) => string;
  onNavigate?: (tab: string) => void;
}) {
  const colors = {
    critical: check.passed ? 'text-green-600' : 'text-red-600',
    warning: check.passed ? 'text-green-600' : 'text-amber-500',
    bonus: check.passed ? 'text-green-600' : 'text-gray-400',
  };

  return (
    <button
      type="button"
      onClick={() => check.tab && onNavigate?.(check.tab)}
      disabled={!check.tab}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        check.tab ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className={colors[check.level]}>
        {check.passed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </span>
      <span className={`flex-1 ${check.passed ? 'text-gray-400 line-through' : 'text-secondary'}`}>
        {t(check.labelKey)}
      </span>
      {check.tab && !check.passed && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

// ── Advice card (clickable if has action) ───────────────────────────────────
function AdviceCard({ advice, onNavigate }: { advice: AiAdvice; onNavigate?: (target: string) => void }) {
  const styles = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-blue-200 bg-blue-50',
  };
  const hoverStyles = {
    high: 'hover:border-red-300 hover:shadow-sm',
    medium: 'hover:border-amber-300 hover:shadow-sm',
    low: 'hover:border-blue-300 hover:shadow-sm',
  };
  const dots = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-blue-500' };
  const arrowColors = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-blue-400' };

  const hasAction = !!(advice.action?.tab || advice.action?.page);
  const target = advice.action?.tab
    ? `/dashboard/settings?tab=${advice.action.tab}`
    : advice.action?.page ?? '';

  const Tag = hasAction ? 'button' : 'div';

  return (
    <Tag
      type={hasAction ? 'button' : undefined}
      onClick={hasAction ? () => onNavigate?.(target) : undefined}
      className={`w-full rounded-lg border p-2.5 text-left text-sm transition-all ${styles[advice.priority]} ${
        hasAction ? `cursor-pointer ${hoverStyles[advice.priority]}` : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dots[advice.priority]}`} />
        <p className="flex-1 text-secondary">{advice.text}</p>
        {hasAction && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`mt-0.5 shrink-0 ${arrowColors[advice.priority]}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </Tag>
  );
}

// ── Main floating advisor ───────────────────────────────────────────────────
export default function FloatingAdvisor({ storeId, userPlan, isAdmin = false }: FloatingAdvisorProps) {
  const t = useTranslations('storeAdvisor');
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<ShopData | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // AI state
  const [advices, setAdvices] = useState<AiAdvice[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  // Lightweight score from store data (fetched once)
  const [quickScore, setQuickScore] = useState<number | null>(null);

  const plan = userPlan as OwnerPlan;
  const canUseAi = isAdmin || plan === 'STARTER' || plan === 'PRO';

  // Fetch quick score on mount (lightweight endpoint)
  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/score`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.score != null) setQuickScore(data.score); })
      .catch(() => {});
  }, [storeId]);

  // Load full data when panel opens
  const loadData = useCallback(async () => {
    if (!storeId || loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/advisor-data`);
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
        setItems(data.items);
        setCategoryCount(data.categoryCount);
        setLoaded(true);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [storeId, loaded]);

  useEffect(() => {
    if (open && !loaded) loadData();
  }, [open, loaded, loadData]);

  const scoreResult = useMemo(() => {
    if (!store) return null;
    return calculateStoreScore(store, items, categoryCount);
  }, [store, items, categoryCount]);

  const handleGetAdvice = async () => {
    if (!storeId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/store-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, userLocale: locale }),
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

  const navigateToTab = (tab: string) => {
    setOpen(false);
    // Use hard navigation to guarantee ?tab= is picked up by SettingsForm
    window.location.href = `/dashboard/settings?tab=${tab}`;
  };

  const navigateToTarget = (target: string) => {
    setOpen(false);
    // Use hard navigation so settings page reads the new ?tab= correctly
    window.location.href = target;
  };

  // Don't render if no store
  if (!storeId) return null;

  const displayScore = scoreResult?.score ?? quickScore;
  const scoreColor = !displayScore ? '#9ca3af' : displayScore >= 80 ? '#16a34a' : displayScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <>
      {/* ── FAB button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-violet-600 pl-3.5 pr-4 py-2.5 text-white shadow-lg shadow-violet-300/40 hover:bg-violet-700 hover:shadow-xl transition-all duration-200 group"
        aria-label={t('storeScore')}
      >
        {/* Star icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover:scale-110 transition-transform">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
        </svg>

        {/* Label + score */}
        <span className="text-sm font-semibold whitespace-nowrap">
          {t('fabLabel')}
          {displayScore != null && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
              {displayScore}
            </span>
          )}
        </span>

        {/* Pulse dot for low scores */}
        {displayScore != null && displayScore < 60 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* ── Backdrop ────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Slide-over panel ────────────────────────────────────────── */}
      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
            </svg>
            <h2 className="text-lg font-bold text-secondary">{t('storeScore')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-65px)] overflow-y-auto px-5 py-5">
          {loading && !scoreResult ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            </div>
          ) : scoreResult ? (
            <>
              {/* Score */}
              <div className="mb-6 flex items-center gap-5">
                <ScoreRingLarge score={scoreResult.score} />
                <div>
                  <p className="text-sm text-neutral">
                    {scoreResult.score >= 80 ? t('scoreExcellent') : scoreResult.score >= 50 ? t('scoreGood') : t('scoreNeedsWork')}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {scoreResult.checks.filter((c) => c.passed).length}/{scoreResult.checks.length} {t('checksPassed')}
                  </p>
                </div>
              </div>

              {/* Failed checks */}
              {(() => {
                const failed = scoreResult.checks.filter((c) => !c.passed);
                return failed.length > 0 ? (
                  <div className="mb-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral">{t('toImprove')}</h4>
                    <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                      {failed.map((check) => (
                        <CheckItem key={check.id} check={check} t={t} onNavigate={navigateToTab} />
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Passed checks */}
              {(() => {
                const passed = scoreResult.checks.filter((c) => c.passed);
                return passed.length > 0 ? (
                  <details className="mb-6">
                    <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral hover:text-secondary">
                      {t('completed')} ({passed.length})
                    </summary>
                    <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                      {passed.map((check) => (
                        <CheckItem key={check.id} check={check} t={t} />
                      ))}
                    </div>
                  </details>
                ) : null;
              })()}

              {/* AI Advisor section */}
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
                  </svg>
                  <h3 className="text-sm font-bold text-violet-900">{t('aiAdvisor')}</h3>
                </div>

                {canUseAi ? (
                  <>
                    <p className="mb-3 text-xs text-violet-700">{t('aiDesc')}</p>

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
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z" />
                      </svg>
                      {aiLoading ? t('aiLoading') : t('aiGetAdvice')}
                    </button>

                    {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}

                    {advices.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {advices.map((advice) => (
                          <AdviceCard key={advice.id} advice={advice} onNavigate={navigateToTarget} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-3">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-violet-900 mb-1">{t('aiLocked')}</p>
                    <p className="text-xs text-violet-600">{t('aiLockedDesc')}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-neutral text-sm">
              {t('scoreNeedsWork')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
