'use client';

import { useRef } from 'react';
import { useBrandKitStore } from '@/lib/studio/brand-kit';

const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald',
  'Raleway', 'Poppins', 'Nunito', 'Playfair Display', 'Merriweather',
  'Source Sans Pro', 'Ubuntu', 'PT Sans', 'Noto Sans', 'Rubik',
  'Work Sans', 'DM Sans', 'Outfit', 'Plus Jakarta Sans',
];

const COLOR_PRESETS = {
  primary:   ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0891b2'],
  secondary: ['#0f172a', '#1e293b', '#111827', '#18181b', '#1c1917', '#0c0a09'],
  accent:    ['#f59e0b', '#f97316', '#ec4899', '#10b981', '#06b6d4', '#8b5cf6'],
};

export function BrandKitPanel() {
  const brand      = useBrandKitStore();
  const logoRef    = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      alert('Logo must be under 200 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => brand.setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">

      {/* Business name */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Business Name</div>
        <input
          type="text"
          value={brand.businessName}
          onChange={e => brand.updateBrand({ businessName: e.target.value })}
          placeholder="My Business"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Logo */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Logo</div>
        <div className="flex items-center gap-2">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoDataUrl}
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
            {brand.logoDataUrl ? 'Change' : 'Upload'}
          </button>
          {brand.logoDataUrl && (
            <button
              onClick={() => brand.setLogo(null)}
              className="text-xs text-gray-600 hover:text-red-400"
            >
              ✕
            </button>
          )}
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        <div className="mt-1 text-[9px] text-gray-700">Max 200 KB</div>
      </div>

      {/* Colors */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Colors</div>
        {(
          [
            { key: 'primaryColor' as const, label: 'Primary', presets: COLOR_PRESETS.primary },
            { key: 'secondaryColor' as const, label: 'Secondary', presets: COLOR_PRESETS.secondary },
            { key: 'accentColor' as const, label: 'Accent', presets: COLOR_PRESETS.accent },
          ] as const
        ).map(({ key, label, presets }) => (
          <div key={key} className="mb-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{label}</span>
              <input
                type="color"
                value={brand[key]}
                onChange={e => brand.updateBrand({ [key]: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                title={label}
              />
              <input
                type="text"
                value={brand[key]}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) brand.updateBrand({ [key]: v });
                }}
                className="w-20 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white outline-none focus:ring-1 focus:ring-green-600/40"
              />
            </div>
            <div className="flex gap-1">
              {presets.map(c => (
                <button
                  key={c}
                  onClick={() => brand.updateBrand({ [key]: c })}
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
          value={brand.fontFamily}
          onChange={e => brand.updateBrand({ fontFamily: e.target.value })}
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60"
        >
          {POPULAR_FONTS.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Default CTA */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Default CTA</div>
        <input
          type="text"
          value={brand.defaultCta}
          onChange={e => brand.updateBrand({ defaultCta: e.target.value })}
          placeholder="Learn More"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Contact info */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Contact / Website</div>
        <input
          type="text"
          value={brand.contactInfo}
          onChange={e => brand.updateBrand({ contactInfo: e.target.value })}
          placeholder="www.mybusiness.com"
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Clear */}
      {brand.isConfigured && (
        <button
          onClick={brand.clearBrand}
          className="mt-1 rounded border border-white/10 py-1.5 text-xs text-gray-500 hover:border-white/20 hover:text-gray-300"
        >
          Reset Brand Kit
        </button>
      )}
    </div>
  );
}
