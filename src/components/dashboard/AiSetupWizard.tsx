'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AiSetupItem, AiSetupResult } from '@/lib/types';

// ─── Static config ────────────────────────────────────────────────────────────

const TEMPLATE_OPTIONS = [
  { value: 'food',        emoji: '🍕' },
  { value: 'physical',    emoji: '🛍️' },
  { value: 'beauty',      emoji: '💅' },
  { value: 'repair',      emoji: '🔧' },
  { value: 'digital',     emoji: '💻' },
  { value: 'restaurant',  emoji: '🍽️' },
  { value: 'events',      emoji: '🎈' },
] as const;

type TemplateValue = typeof TEMPLATE_OPTIONS[number]['value'];

const LANG_OPTIONS = ['sk', 'cs', 'uk', 'de', 'en'] as const;

const COLOR_SCHEMES = [
  { value: 'light'   as const, preview: 'bg-white border-gray-300' },
  { value: 'dark'    as const, preview: 'bg-gray-900 border-gray-700' },
  { value: 'warm'    as const, preview: 'bg-amber-50 border-amber-300' },
  { value: 'bold'    as const, preview: 'bg-indigo-950 border-indigo-700' },
  { value: 'festive' as const, preview: 'bg-red-50 border-red-300' },
  { value: 'elegant' as const, preview: 'bg-stone-50 border-rose-200' },
];

type ColorScheme = 'light' | 'dark' | 'warm' | 'bold' | 'festive' | 'elegant';
type Step = 'input' | 'loading' | 'preview' | 'creating';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AiSetupWizardProps {
  userId: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AiSetupWizard({ userId }: AiSetupWizardProps) {
  const router = useRouter();
  const t  = useTranslations('aiWizard');
  const ts = useTranslations('dashboardSettings');

  // Template type labels (translated)
  const TEMPLATE_LABELS: Record<TemplateValue, string> = {
    food:        ts('storeTypeFood'),
    physical:    ts('storeTypePhysical'),
    beauty:      ts('storeTypeBeauty'),
    repair:      ts('storeTypeRepair'),
    digital:     ts('storeTypeDigital'),
    restaurant:  ts('storeTypeRestaurant'),
    events:      ts('storeTypeEvents'),
  };

  // Color scheme labels (translated)
  const COLOR_LABELS: Record<ColorScheme, string> = {
    light:   ts('colorLight'),
    dark:    ts('colorDark'),
    warm:    ts('colorWarm'),
    bold:    ts('colorBold'),
    festive: ts('colorFestive'),
    elegant: ts('colorElegant'),
  };

  // ─── State ──────────────────────────────────────────────────────────────────

  const [step, setStep]               = useState<Step>('input');
  const [error, setError]             = useState<string | null>(null);

  // Step 1 inputs
  const [businessName, setBusinessName] = useState('');
  const [businessDesc, setBusinessDesc] = useState('');
  const [templateId,   setTemplateId]   = useState<TemplateValue>('physical');
  const [shopLanguage, setShopLanguage] = useState('sk');
  const [slug,         setSlug]         = useState('');

  // Step 2 — animated loading steps
  const [loadingStep, setLoadingStep]   = useState(0);
  const loadingTimer                    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 (preview) — AI result + user edits
  const [result,       setResult]       = useState<AiSetupResult | null>(null);
  const [editedName,   setEditedName]   = useState('');
  const [editedDesc,   setEditedDesc]   = useState('');
  const [editedColor,  setEditedColor]  = useState<ColorScheme>('light');
  const [editedItems,  setEditedItems]  = useState<AiSetupItem[]>([]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  // Total loading steps count (must match LOADING_STEPS array below)
  const TOTAL_LOADING_STEPS = 5;

  useEffect(() => {
    if (step !== 'loading') {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
      return;
    }
    setLoadingStep(0);
    loadingTimer.current = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= TOTAL_LOADING_STEPS - 2) {
          // Stay on last step until AI finishes
          if (loadingTimer.current) clearInterval(loadingTimer.current);
          return TOTAL_LOADING_STEPS - 1;
        }
        return prev + 1;
      });
    }, 900);
    return () => {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleGenerate = async () => {
    if (!businessName.trim()) return;
    if (!slug.trim()) { setError(t('errorSlug')); return; }
    setError(null);
    setStep('loading');

    try {
      const res = await fetch('/api/ai/setup-shop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ businessName, businessDescription: businessDesc, templateId, shopLanguage }),
      });

      if (!res.ok) throw new Error('AI unavailable');
      const data = (await res.json()) as AiSetupResult;

      setResult(data);
      setEditedName(data.shopName          || businessName);
      setEditedDesc(data.shopDescription   || '');
      setEditedColor((data.colorScheme as ColorScheme) || 'light');
      setEditedItems(data.items            || []);
      setStep('preview');
    } catch {
      setError(t('errorGenerate'));
      setStep('input');
    }
  };

  const handleConfirm = async () => {
    setStep('creating');
    setError(null);

    const currency = shopLanguage === 'cs' ? 'CZK' : shopLanguage === 'uk' ? 'UAH' : 'EUR';

    try {
      // 1. Create store
      const storeRes = await fetch('/api/stores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name:         editedName || businessName,
          description:  editedDesc,
          shopLanguage,
          colorScheme:  editedColor,
          currency,
          templateId,
          slug,
          isPublished:  false,
          whatsapp:     '',
          instagram:    '',
          facebook:     '',
          address:      '',
          phone:        '',
          openingHours: '',
          deliveryInfo: '',
          aboutText:    '',
        }),
      });

      if (!storeRes.ok) {
        const data = (await storeRes.json()) as { error?: string };
        throw new Error(data.error || 'Failed to create store');
      }

      const store = (await storeRes.json()) as { id: string };

      // 2. Create starter items in parallel
      await Promise.all(
        editedItems.map((item) =>
          fetch('/api/products', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storeId:     store.id,
              name:        item.name,
              description: item.description,
              price:       String(item.price),
              currency:    item.currency || currency,
              category:    item.category,
              type:        item.type,
              isAvailable: true,
            }),
          }),
        ),
      );

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGenerate'));
      setStep('preview');
    }
  };

  const updateItem = (idx: number, field: keyof AiSetupItem, value: string | number) =>
    setEditedItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const removeItem = (idx: number) =>
    setEditedItems((prev) => prev.filter((_, i) => i !== idx));

  // ─── Progress bar ────────────────────────────────────────────────────────────

  const stepIdx = step === 'input' ? 0 : step === 'loading' ? 1 : 2;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress dots */}
      <div className="mb-8 flex items-center justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === stepIdx
                ? 'h-3 w-8 bg-primary'
                : i < stepIdx
                ? 'h-2.5 w-2.5 bg-primary opacity-50'
                : 'h-2.5 w-2.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Input ── */}
      {step === 'input' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-3xl">✨</div>
            <h1 className="text-2xl font-bold text-secondary">{t('step1Title')}</h1>
            <p className="mt-2 text-sm text-neutral">{t('step1Subtitle')}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
            {/* Business name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t('businessName')} *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('businessNamePlaceholder')}
              />
            </div>

            {/* Business description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t('businessDesc')}
              </label>
              <textarea
                rows={2}
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('businessDescPlaceholder')}
              />
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-primary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {t('anyLanguageHint')}
              </p>
            </div>

            {/* Business type pills */}
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                {t('businessType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_OPTIONS.map((tmpl) => (
                  <button
                    key={tmpl.value}
                    type="button"
                    onClick={() => setTemplateId(tmpl.value)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      templateId === tmpl.value
                        ? 'bg-primary text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tmpl.emoji}</span>
                    <span>{TEMPLATE_LABELS[tmpl.value]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shop language pills */}
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                {t('shopLanguage')}
              </label>
              <div className="flex gap-2">
                {LANG_OPTIONS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setShopLanguage(lang)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                      shopLanguage === lang
                        ? 'bg-primary text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Slug */}
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t('slug')} *
              </label>
              <label htmlFor="wizard-slug" className="flex cursor-text items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary">
                <span className="select-none pl-4 text-sm text-gray-400">vendshop.shop/</span>
                <input
                  id="wizard-slug"
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                  }
                  className="flex-1 bg-transparent py-2.5 pl-1 pr-4 text-sm focus:outline-none"
                  placeholder="smak-shop"
                />
              </label>
              <p className="mt-1 text-xs text-gray-400">{t('slugHint')}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!businessName.trim() || !slug.trim()}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            ✨ {t('generateBtn')}
          </button>

          <button
            onClick={() => router.push('/dashboard/settings?manual=1')}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('skipBtn')} →
          </button>
        </div>
      )}

      {/* ── Step 2: Loading ── */}
      {step === 'loading' && (() => {
        const LOADING_STEPS = [
          { emoji: '🔍', text: t('loadingStep1') },
          { emoji: '✍️', text: t('loadingStep2') },
          { emoji: '📦', text: t('loadingStep3') },
          { emoji: '🎨', text: t('loadingStep4') },
          { emoji: '🚀', text: t('loadingStep5') },
        ];
        const progress = Math.round(((loadingStep + 1) / LOADING_STEPS.length) * 100);

        return (
          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10">
            {/* Icon + title */}
            <div className="mb-8 text-center">
              <div className="relative mx-auto mb-4 h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
              </div>
              <h2 className="text-xl font-bold text-secondary">{t('step2Title')}</h2>
              <p className="mt-1 text-sm text-neutral">{t('step2Subtitle')}</p>
            </div>

            {/* Animated steps */}
            <div className="mb-8 space-y-3">
              {LOADING_STEPS.map((s, idx) => {
                const isDone    = idx < loadingStep;
                const isCurrent = idx === loadingStep;
                const isPending = idx > loadingStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                      isCurrent ? 'bg-accent' : isDone ? 'bg-gray-50' : 'bg-transparent'
                    } ${isPending ? 'opacity-30' : 'opacity-100'}`}
                  >
                    {/* Status icon */}
                    <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                      {isDone ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : isCurrent ? (
                        <span className="flex h-7 w-7 items-center justify-center">
                          <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-200 text-xs text-gray-400">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    {/* Emoji + text */}
                    <span className="text-lg leading-none">{s.emoji}</span>
                    <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
                      {s.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="overflow-hidden rounded-full bg-gray-100 h-2">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-gray-400">{progress}%</p>
          </div>
        );
      })()}

      {/* ── Step 3: Preview ── */}
      {(step === 'preview' || step === 'creating') && result && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-3xl">🎉</div>
            <h1 className="text-2xl font-bold text-secondary">{t('step3Title')}</h1>
            <p className="mt-2 text-sm text-neutral">{t('step3Subtitle')}</p>
          </div>

          {/* Shop name */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-secondary">{t('generatedName')}</h3>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-secondary">{t('generatedDesc')}</h3>
            <textarea
              rows={3}
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Color scheme */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 text-sm font-semibold text-secondary">{t('generatedColor')}</h3>
            {result.colorReason && (
              <p className="mb-3 text-xs text-neutral">
                {t('colorReason')} {result.colorReason}
              </p>
            )}
            <div className="flex gap-3">
              {COLOR_SCHEMES.map((cs) => (
                <button
                  key={cs.value}
                  type="button"
                  onClick={() => setEditedColor(cs.value)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`h-10 w-10 rounded-lg border-2 ${cs.preview} transition-all ${
                      editedColor === cs.value ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                  />
                  <span className="text-xs text-gray-500">{COLOR_LABELS[cs.value]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Starter items */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-secondary">{t('generatedItems')}</h3>
            <div className="space-y-2">
              {editedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name — inline editable */}
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-secondary hover:border-gray-200 focus:border-primary focus:outline-none focus:bg-white"
                    />
                    <p className="truncate px-1 text-xs text-neutral">{item.description}</p>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-gray-400">{t('price')}:</span>
                      <input
                        type="number"
                        value={item.price}
                        min="0"
                        step="0.01"
                        onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-gray-400">{item.currency}</span>
                      {item.category && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-primary">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="mt-0.5 shrink-0 text-gray-300 transition-colors hover:text-red-400"
                    aria-label="Remove item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('input')}
              disabled={step === 'creating'}
              className="rounded-lg border border-gray-200 px-5 py-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              ← {t('backBtn')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={step === 'creating'}
              className="flex-1 rounded-lg bg-primary py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {step === 'creating' ? t('creating') : `✓ ${t('confirmBtn')}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
