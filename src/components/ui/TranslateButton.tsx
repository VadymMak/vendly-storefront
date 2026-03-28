'use client';

import { useState } from 'react';

interface TranslateButtonProps {
  text: string;
  targetLang: string;
  storeId: string;
  onTranslated: (translated: string) => void;
  disabled?: boolean;
  label?: string;
  labelDone?: string;
  labelLimit?: string;
  labelUndo?: string;
}

export default function TranslateButton({
  text,
  targetLang,
  storeId,
  onTranslated,
  disabled,
  label = 'Translate',
  labelDone = 'Translated',
  labelLimit = 'Limit reached',
  labelUndo = 'Undo',
}: TranslateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);

  const LANG_FLAGS: Record<string, string> = {
    sk: '🇸🇰', cs: '🇨🇿', uk: '🇺🇦', de: '🇩🇪', en: '🇬🇧',
  };

  const handleTranslate = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang, storeId }),
      });

      if (res.status === 429) {
        setLimitReached(true);
        return;
      }

      if (!res.ok) throw new Error('Translation failed');

      const data = await res.json();
      if (data.translated) {
        setOriginal(text);
        onTranslated(data.translated);
        setDone(true);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (original !== null) {
      onTranslated(original);
      setOriginal(null);
      setDone(false);
    }
  };

  if (limitReached) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-600">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {labelLimit}
      </span>
    );
  }

  if (done && original !== null) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {labelDone}
        </span>
        <button
          type="button"
          onClick={handleUndo}
          className="rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {labelUndo}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTranslate}
      disabled={disabled || loading || !text.trim()}
      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition-colors"
    >
      {loading ? (
        <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <span className="text-xs">{LANG_FLAGS[targetLang] || '🌐'}</span>
      )}
      {loading ? '...' : label}
    </button>
  );
}
