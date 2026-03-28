'use client';

import { useState } from 'react';

interface BulkTranslateButtonProps {
  storeId: string;
  targetLang: string;
  translationUsed: boolean;
  plan: string;
  onDone: () => void;
  labels: {
    button: string;
    translating: string;
    done: string;
    limitReached: string;
    upgrade: string;
    description: string;
    descriptionUsed: string;
  };
}

export default function BulkTranslateButton({
  storeId,
  targetLang,
  translationUsed,
  plan,
  onDone,
  labels,
}: BulkTranslateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ translated: number; items: number } | null>(null);

  const LANG_FLAGS: Record<string, string> = {
    sk: '🇸🇰', cs: '🇨🇿', uk: '🇺🇦', de: '🇩🇪', en: '🇬🇧',
  };

  const isFreeAndUsed = plan === 'FREE' && translationUsed;

  const handleBulk = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/translate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setResult(data);
      onDone();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-sm font-medium text-green-700">
            {labels.done} — {result.translated} texts, {result.items} products
          </p>
        </div>
      </div>
    );
  }

  if (isFreeAndUsed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">{labels.limitReached}</p>
            <p className="mt-1 text-xs text-amber-600">{labels.descriptionUsed}</p>
            <a href="/dashboard/billing" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors">
              {labels.upgrade} →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">{LANG_FLAGS[targetLang] || '🌐'}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">{labels.description}</p>
          {plan === 'FREE' && (
            <p className="mt-1 text-xs text-blue-500">Free plan: one-time translation</p>
          )}
          <button
            type="button"
            onClick={handleBulk}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {labels.translating}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" />
                  <path d="M22 22l-5-10-5 10" /><path d="M14 18h6" />
                </svg>
                {labels.button}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
