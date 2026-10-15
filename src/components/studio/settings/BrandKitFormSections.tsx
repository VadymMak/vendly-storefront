'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BRAND_KIT_LIMITS, BRAND_KIT_SLIDERS, FONT_PRESETS, SUBTITLE_PRESETS, WATERMARK_POSITIONS } from '@/lib/constants';
import type { BrandKitForm } from '@/hooks/useBrandKitForm';
import type { WatermarkPosition } from '@/lib/types';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const POSITION_ARROWS: Record<WatermarkPosition, { arrow: string; labelKey: 'posBottomRight' | 'posBottomLeft' | 'posTopRight' | 'posTopLeft' }> = {
  'bottom-right': { arrow: '↘', labelKey: 'posBottomRight' },
  'bottom-left':  { arrow: '↙', labelKey: 'posBottomLeft' },
  'top-right':    { arrow: '↗', labelKey: 'posTopRight' },
  'top-left':     { arrow: '↖', labelKey: 'posTopLeft' },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

const INPUT = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none';

function Chips<T extends string>({ options, value, onChange }: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          // Preset names (Modern, Elegant…) and font names stay as written under Chrome auto-translate
          translate="no"
          className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
            value === o.id ? 'bg-green-600 text-white' : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-300">{label}</p>
        {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

/** Native color picker + hex text box; invalid hex stays local and is never applied. */
function ColorField({ label, value, onChange, invalidText }: { label: string; value: string; onChange: (hex: string) => void; invalidText: string }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Picker or "reset colors" changed the value from outside — show it in the text box
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  const invalid = !HEX.test(text);

  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        aria-label={label}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-full border border-white/20 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
      />
      <span className="w-24 text-sm text-gray-300">{label}</span>
      <div className="flex-1">
        <input
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={e => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX.test(v)) onChange(v.toUpperCase());
          }}
          aria-invalid={invalid}
          className={`${INPUT} font-mono ${invalid ? 'border-red-500/60' : ''}`}
        />
        {invalid && <p className="mt-1 text-[11px] text-red-400">{invalidText}</p>}
      </div>
    </div>
  );
}

function Slider({ label, value, range, onChange }: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono text-gray-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-green-500"
      />
    </div>
  );
}

/** All Brand Kit form sections — the mobile and desktop screens only differ in layout around them. */
export function BrandKitFormSections({ form }: { form: BrandKitForm }) {
  const t = useTranslations('settings.brandKit');
  const fileRef = useRef<HTMLInputElement>(null);
  const { draft, setField } = form;

  return (
    <div className="space-y-7">
      <Section title={t('businessInfo')}>
        {/* Logo */}
        <div className="space-y-2">
          <span className="text-sm text-gray-300">{t('logo')}</span>
          <div className="flex items-center gap-3">
            {draft.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logoUrl} alt="" className="h-14 w-14 rounded-lg border border-white/10 bg-white/5 object-contain p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-white/20 text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={form.saving}
              className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
            >
              {form.uploading ? t('uploading') : draft.logoUrl ? t('changeLogo') : t('uploadLogo')}
            </button>
            {draft.logoUrl && (
              <button type="button" onClick={() => void form.removeLogo()} disabled={form.saving} className="text-sm text-gray-500 hover:text-red-400 disabled:opacity-50">
                {t('removeLogo')}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                // Type and size are validated server-side; its error message shows in the save bar
                if (file) void form.uploadLogo(file);
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500">{t('logoHint')}</p>

          {form.suggested && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex gap-1">
                {[form.suggested.primary, form.suggested.secondary, form.suggested.text].map(c => (
                  <span key={c} className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="flex-1 text-sm text-gray-200">{t('useExtractedColors')}</span>
              <button type="button" onClick={form.acceptSuggested} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">{t('yes')}</button>
              <button type="button" onClick={form.dismissSuggested} className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white">{t('no')}</button>
            </div>
          )}
        </div>

        <Field label={t('businessName')}>
          <input className={INPUT} value={draft.businessName} maxLength={BRAND_KIT_LIMITS.businessNameMax} placeholder={t('businessNamePlaceholder')} onChange={e => setField('businessName', e.target.value)} />
        </Field>
        <Field label={t('instagramHandle')}>
          <input className={INPUT} value={draft.instagramHandle} maxLength={31} placeholder={t('instagramHandlePlaceholder')} autoCapitalize="none" autoCorrect="off" onChange={e => setField('instagramHandle', e.target.value)} />
        </Field>
        <Field label={t('ctaText')}>
          <input className={INPUT} value={draft.ctaText} maxLength={BRAND_KIT_LIMITS.ctaTextMax} placeholder={t('ctaTextPlaceholder')} onChange={e => setField('ctaText', e.target.value)} />
        </Field>
      </Section>

      <Section title={t('colors')}>
        <ColorField label={t('colorPrimary')} value={draft.colorPrimary} onChange={v => setField('colorPrimary', v)} invalidText={t('invalidHex')} />
        <ColorField label={t('colorSecondary')} value={draft.colorSecondary} onChange={v => setField('colorSecondary', v)} invalidText={t('invalidHex')} />
        <ColorField label={t('colorText')} value={draft.colorText} onChange={v => setField('colorText', v)} invalidText={t('invalidHex')} />
        <button
          type="button"
          onClick={() => void form.resetToLogoColors()}
          disabled={!draft.logoUrl}
          className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-40"
        >
          {t('resetColors')}
        </button>
        {form.notice === 'noLogoColors' && <p className="text-[11px] text-gray-500">{t('noLogoColors')}</p>}
      </Section>

      <Section title={t('stylePresets')}>
        <Field label={t('font')}>
          <Chips options={FONT_PRESETS} value={draft.fontPreset} onChange={v => setField('fontPreset', v)} />
        </Field>
        <Field label={t('subtitles')}>
          <Chips options={SUBTITLE_PRESETS} value={draft.subtitlePreset} onChange={v => setField('subtitlePreset', v)} />
        </Field>
      </Section>

      <Section title={t('watermark')}>
        <Toggle checked={draft.watermarkEnabled} onChange={v => setField('watermarkEnabled', v)} label={t('watermarkEnabled')} />
        <div className={`space-y-4 ${draft.watermarkEnabled ? '' : 'pointer-events-none opacity-40'}`}>
          <div className="space-y-1.5">
            <span className="text-sm text-gray-300">{t('watermarkPosition')}</span>
            <div className="grid grid-cols-4 gap-2">
              {WATERMARK_POSITIONS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setField('watermarkPosition', p.id)}
                  aria-pressed={draft.watermarkPosition === p.id}
                  aria-label={t(POSITION_ARROWS[p.id].labelKey)}
                  title={t(POSITION_ARROWS[p.id].labelKey)}
                  className={`rounded-lg py-2 text-lg transition-colors ${
                    draft.watermarkPosition === p.id ? 'bg-green-600 text-white' : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
                  }`}
                >
                  {POSITION_ARROWS[p.id].arrow}
                </button>
              ))}
            </div>
          </div>
          <Slider label={t('watermarkOpacity')} value={draft.watermarkOpacity} range={BRAND_KIT_SLIDERS.opacity} onChange={v => setField('watermarkOpacity', v)} />
          <Slider label={t('watermarkSize')} value={draft.watermarkScale} range={BRAND_KIT_SLIDERS.scale} onChange={v => setField('watermarkScale', v)} />
        </div>
      </Section>

      <Section title={t('title')}>
        <Toggle checked={draft.enabled} onChange={v => setField('enabled', v)} label={t('masterToggle')} hint={t('masterToggleHint')} />
      </Section>
    </div>
  );
}

/** Save button + status line, shared by both layouts. */
export function BrandKitSaveBar({ form }: { form: BrandKitForm }) {
  const t = useTranslations('settings.brandKit');
  return (
    <div className="space-y-2">
      {form.error && <p className="text-sm text-red-400">{form.error}</p>}
      <button
        type="button"
        onClick={() => void form.save()}
        disabled={form.saving || !form.dirty}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-green-500 active:bg-green-700 disabled:opacity-50"
      >
        {form.saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
        {form.saving ? t('saving') : form.notice === 'saved' ? `✓ ${t('saved')}` : t('save')}
      </button>
    </div>
  );
}
