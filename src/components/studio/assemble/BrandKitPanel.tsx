'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BRAND_KIT_DEFAULTS, BRAND_KIT_LIMITS, FONT_PRESETS } from '@/lib/constants';
import type { BrandKitData, BrandKitSaveInput, FontPreset } from '@/lib/types';

const COLOR_PRESETS = {
  primary:   ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0891b2'],
  secondary: ['#0f172a', '#1e293b', '#111827', '#18181b', '#1c1917', '#0c0a09'],
  text:      ['#FFFFFF', '#f59e0b', '#f97316', '#ec4899', '#10b981', '#06b6d4'],
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function BrandKitPanel() {
  const { brandKit, save, uploadLogo, error } = useBrandKit();
  const logoRef    = useRef<HTMLInputElement>(null);
  // Local draft so typing doesn't PUT on every keystroke — fields commit on blur
  const [brand, setBrand] = useState<BrandKitData>(brandKit ?? BRAND_KIT_DEFAULTS);
  const [synced, setSynced] = useState(brandKit);
  if (brandKit !== synced) {
    setSynced(brandKit);
    if (brandKit) setBrand(brandKit);
  }

  function update(partial: Partial<BrandKitData>) {
    setBrand(b => ({ ...b, ...partial }));
  }

  function commit(partial: BrandKitSaveInput) {
    void save(partial);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > BRAND_KIT_LIMITS.logoMaxBytes) {
      alert('Logo must be under 5 MB');
      return;
    }
    void uploadLogo(file);
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">

      {/* Business name */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Business Name</div>
        <input
          type="text"
          value={brand.businessName}
          onChange={e => update({ businessName: e.target.value })}
          onBlur={e => commit({ businessName: e.target.value })}
          placeholder="My Business"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Logo */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Logo</div>
        <div className="flex items-center gap-2">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded border border-white/10 object-contain bg-white/5"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-white/20 text-gray-600 text-xs">
              🖼️
            </div>
          )}
          <button
            onClick={() => logoRef.current?.click()}
            className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:border-white/20 hover:text-white"
          >
            {brand.logoUrl ? 'Change' : 'Upload'}
          </button>
          {brand.logoUrl && (
            <button
              onClick={() => commit({ logoUrl: null })}
              className="text-xs text-gray-600 hover:text-red-400"
            >
              ✕
            </button>
          )}
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
        </div>
        <div className="mt-1 text-[9px] text-gray-700">PNG, JPEG, WebP or SVG · max 5 MB</div>
      </div>

      {/* Colors */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Colors</div>
        {(
          [
            { key: 'colorPrimary' as const, label: 'Primary', presets: COLOR_PRESETS.primary },
            { key: 'colorSecondary' as const, label: 'Secondary', presets: COLOR_PRESETS.secondary },
            { key: 'colorText' as const, label: 'Text', presets: COLOR_PRESETS.text },
          ] as const
        ).map(({ key, label, presets }) => (
          <div key={key} className="mb-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{label}</span>
              <input
                type="color"
                value={brand[key]}
                onChange={e => update({ [key]: e.target.value })}
                onBlur={e => commit({ [key]: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                title={label}
              />
              <input
                type="text"
                value={brand[key]}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update({ [key]: v });
                }}
                onBlur={e => { if (HEX.test(e.target.value)) commit({ [key]: e.target.value }); }}
                className="w-20 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white outline-none focus:ring-1 focus:ring-green-600/40"
              />
            </div>
            <div className="flex gap-1">
              {presets.map(c => (
                <button
                  key={c}
                  onClick={() => { update({ [key]: c }); commit({ [key]: c }); }}
                  className="h-4 w-4 rounded border transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: brand[key] === c ? '#fff' : 'transparent' }}
                  title={c}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Font */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Font</div>
        <select
          value={brand.fontPreset}
          onChange={e => {
            const fontPreset = e.target.value as FontPreset;
            update({ fontPreset });
            commit({ fontPreset });
          }}
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60"
        >
          {FONT_PRESETS.map(f => (
            <option key={f.id} value={f.id}>{f.label} · {f.fontFamily}</option>
          ))}
        </select>
      </div>

      {/* Default CTA */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Default CTA</div>
        <input
          type="text"
          value={brand.ctaText}
          onChange={e => update({ ctaText: e.target.value })}
          onBlur={e => commit({ ctaText: e.target.value })}
          placeholder="Learn More"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Contact info */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Instagram</div>
        <input
          type="text"
          value={brand.instagramHandle}
          onChange={e => update({ instagramHandle: e.target.value })}
          onBlur={e => commit({ instagramHandle: e.target.value })}
          placeholder="@yourbusiness"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {/* Full settings (watermark, presets, master toggle) */}
      <Link
        href="/studio/settings/brand"
        className="mt-1 rounded border border-white/10 py-1.5 text-center text-xs text-gray-500 hover:border-white/20 hover:text-gray-300"
      >
        All brand settings →
      </Link>
    </div>
  );
}
