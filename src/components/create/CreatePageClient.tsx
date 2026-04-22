'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import PreviewPanel from './PreviewPanel';
import {
  CREATE_BUSINESS_TYPES,
  CREATE_PLANS,
  CREATE_DEFAULT_HOURS,
  CREATE_STORE_KEY,
} from '@/lib/constants';
import type { CreateState, CreatePlan } from '@/lib/types';

type Viewport = 'desktop' | 'tablet' | 'mobile';

const INITIAL_STATE: CreateState = {
  step: 1,
  business: 'barbershop',
  palette: 'classic',
  businessName: '',
  description: '',
  phone: '',
  email: '',
  address: '',
  hours: '',
  heroPhoto: null,
  logoPhoto: null,
  gallery: [],
  plan: 'starter',
};

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Inline SVG icons ───────────────────────────────────────────────────────────

function IcoArrowLeft() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
}
function IcoArrowRight() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function IcoArrowRightLg() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function IcoCheck({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size < 14 ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6" /></svg>;
}
function IcoSparkles({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" /><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" /></svg>;
}
function IcoUpload() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13M7 8l5-5 5 5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>;
}
function IcoImage() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 17l-5-5-9 9" /></svg>;
}
function IcoPlus() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function IcoX({ size = 11 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
function IcoTrash() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" /></svg>;
}

// ── Business type icon selector ───────────────────────────────────────────────

function BizIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'scissors': return <svg {...common}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
    case 'fork': return <svg {...common}><path d="M7 3v18M4 3c0 4 0 6 3 7M10 3c0 4 0 6-3 7M17 3c-2 2-3 4-3 7v2h4v9"/></svg>;
    case 'sparkles': return <svg {...common}><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/></svg>;
    case 'car': return <svg {...common}><path d="M4 16V11l2-5h12l2 5v5"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M5.5 16h13"/></svg>;
    case 'tooth': return <svg {...common}><path d="M12 3c-2.5 0-3.5 1-5 1s-3 1-3 4c0 3 1 4 1 7s1 8 3 8 2-5 4-5 2 5 4 5 3-5 3-8 1-4 1-7c0-3-1.5-4-3-4s-2.5-1-5-1z"/></svg>;
    case 'droplet': return <svg {...common}><path d="M12 2.5s6 7.2 6 11.5a6 6 0 0 1-12 0c0-4.3 6-11.5 6-11.5z"/></svg>;
    case 'wrench': return <svg {...common}><path d="M14.7 6.3a4 4 0 0 1 5.3 5.3l-9.4 9.4a2 2 0 0 1-2.8 0l-2.8-2.8a2 2 0 0 1 0-2.8l9.4-9.4z"/><path d="M14 10l2 2"/></svg>;
    case 'lotus': return <svg {...common}><path d="M12 4v8M6 12c0-3 2-5 6-8 4 3 6 5 6 8M3 12c2-1 4-1 5 1 1-2 3-2 4-1 1-1 3-1 4 1 1-2 3-2 5-1-2 5-6 8-9 8s-7-3-9-8z"/></svg>;
    case 'camera': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-2.5h5L16 7"/></svg>;
    case 'layers': return <svg {...common}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>;
    case 'book': return <svg {...common}><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/></svg>;
    case 'palette': return <svg {...common}><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1-.5-1.5-.5-2.5S14 15 15 15h2a4 4 0 0 0 4-4 8 8 0 0 0-9-8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="11" cy="7" r="1"/></svg>;
    default: return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
}

// ── Photo upload helpers ───────────────────────────────────────────────────────

interface SinglePhotoProps {
  label: string;
  hint: string;
  value: string | null;
  small?: boolean;
  onChange: (v: string | null) => void;
}

function SinglePhoto({ label, hint, value, onChange, small = false }: SinglePhotoProps) {
  const ref = useRef<HTMLInputElement>(null);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(f);
  }, [onChange]);

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-[10px] cursor-pointer transition-all ${value ? 'border border-[#253349]' : 'border border-dashed border-[#334155]'} bg-[#1e293b] hover:bg-[#243449]`}
      onClick={() => ref.current?.click()}
    >
      <div
        className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center bg-[#0f1a2e] border border-[#253349] text-[#64748b]"
        style={value ? { backgroundImage: `url(${value})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!value && (small ? <IcoImage /> : <IcoUpload />)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#e2e8f0]">{label}</div>
        <div className="text-[11.5px] text-[#64748b]">{value ? hint : hint}</div>
      </div>
      {value && (
        <button
          className="p-1.5 rounded-lg bg-transparent border border-[#253349] text-[#94a3b8] hover:bg-[#1e293b]"
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
        >
          <IcoTrash />
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}

interface GalleryUploaderProps {
  value: string[];
  onChange: (arr: string[]) => void;
}

function GalleryUploader({ value, onChange }: GalleryUploaderProps) {
  const ref = useRef<HTMLInputElement>(null);
  const idxRef = useRef(0);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = [...value];
      next[idxRef.current] = reader.result as string;
      onChange(next.filter(Boolean).slice(0, 6));
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  }, [value, onChange]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => {
        const src = value[i];
        return (
          <div
            key={i}
            className={`aspect-square rounded-lg overflow-hidden border flex items-center justify-center text-[#64748b] cursor-pointer transition-all relative ${src ? 'border-[#253349]' : 'border-dashed border-[#334155] hover:border-[#3d5174]'} bg-[#0f1a2e]`}
            style={src ? { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            onClick={() => { if (!src) { idxRef.current = value.length; ref.current?.click(); } }}
          >
            {!src && <IcoPlus />}
            {src && (
              <button
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[rgba(15,23,42,0.85)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, idx) => idx !== i)); }}
              >
                <IcoX size={10} />
              </button>
            )}
          </div>
        );
      })}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}

// ── Step 1: Business type + palette ───────────────────────────────────────────

function Step1({ state, setState }: { state: CreateState; setState: React.Dispatch<React.SetStateAction<CreateState>> }) {
  const t = useTranslations('create');
  const bt = useTranslations('create.biz');
  const biz = CREATE_BUSINESS_TYPES.find((b) => b.id === state.business) ?? CREATE_BUSINESS_TYPES[0];

  const selectBiz = (id: string) => {
    const b = CREATE_BUSINESS_TYPES.find((x) => x.id === id);
    setState((s) => ({ ...s, business: id, palette: b?.palettes[0].id ?? 'classic' }));
  };

  return (
    <div className="animate-[fadeUp_0.25s_ease-out]">
      <div className="grid grid-cols-3 gap-2">
        {CREATE_BUSINESS_TYPES.map((b) => {
          const selected = state.business === b.id;
          return (
            <div
              key={b.id}
              onClick={() => selectBiz(b.id)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-center ${
                selected
                  ? 'border-[#16a34a] bg-gradient-to-b from-[rgba(22,163,74,0.12)] to-[rgba(22,163,74,0.02)] shadow-[0_0_0_1px_#16a34a_inset]'
                  : 'border-[#253349] bg-[#1e293b] hover:border-[#334155] hover:bg-[#243449] hover:-translate-y-px'
              }`}
            >
              {selected && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#16a34a] shadow-[0_0_0_3px_rgba(34,197,94,0.25)]" />
              )}
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${selected ? 'bg-[rgba(34,197,94,0.18)] text-[#86efac]' : 'bg-[rgba(148,163,184,0.08)] text-[#e2e8f0]'}`}>
                <BizIcon name={b.icon} />
              </div>
              <div className="text-[12.5px] font-semibold text-[#e2e8f0] leading-tight">{bt(`${b.id}.label`)}</div>
              <div className="text-[10.5px] text-[#64748b]">{bt(`${b.id}.tagline`)}</div>
            </div>
          );
        })}
      </div>

      {/* Palette */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#94a3b8] mb-2 tracking-[0.01em]">
          <span>{t('step1.paletteLabel')}</span>
          <span className="text-[#64748b] normal-case font-medium">{t('step1.paletteTunedFor')} {bt(`${biz.id}.label`)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {biz.palettes.map((p) => {
            const sel = state.palette === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setState((s) => ({ ...s, palette: p.id }))}
                className={`flex items-center gap-2.5 py-2 px-3 rounded-[10px] border cursor-pointer transition-all ${sel ? 'border-[#16a34a] shadow-[0_0_0_1px_#16a34a_inset]' : 'border-[#253349] hover:border-[#334155]'} bg-[#1e293b]`}
              >
                <div className="flex">
                  {[p.primary, p.bg, p.fg, p.card].map((clr, i) => (
                    <span key={i} className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] border-[#1e293b]" style={{ background: clr, marginLeft: i === 0 ? 0 : -4 }} />
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-[#e2e8f0]">{p.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tip */}
      <div className="mt-5 p-3.5 bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.18)] rounded-xl flex gap-2.5 items-start">
        <span className="text-[#86efac] mt-0.5"><IcoSparkles size={16} /></span>
        <p className="text-[12.5px] text-[#cbeacf] leading-relaxed m-0">{t('step1.tip')}</p>
      </div>
    </div>
  );
}

// ── Step 2: Details + photos ───────────────────────────────────────────────────

const AI_DESCRIPTIONS: Record<string, string> = {
  barbershop: 'At {name}, we treat every cut like it matters — because it does. Walk in for a quick tidy-up or settle in for the full experience: cut, beard, hot towel, and good conversation.',
  restaurant: '{name} is a small neighborhood kitchen serving a short, seasonal menu sourced within a 40-mile radius. The list changes with the market.',
  beauty: '{name} is a quiet studio for hair, nails, and skin — unhurried appointments, experienced stylists, and products you\'ll want to take home.',
  auto: '{name} is a family-run garage built on one idea: fix what needs fixing, tell you what doesn\'t. Upfront quotes, certified technicians.',
  dentist: '{name} is a modern dental practice that treats nervous patients like the norm. Gentle care, honest pricing, and Saturday appointments.',
  water: '{name} delivers cold, filtered water to homes and offices. Set your schedule, skip a week, or pause — no contracts, no hassle.',
  electronics: '{name} fixes phones, tablets, and laptops — usually while you wait. Flat-rate pricing and a 90-day warranty on every repair.',
  yoga: '{name} is a small studio where classes stay small. Our teachers know your name, your injuries, and when you\'re having a rough week.',
  photography: '{name} is a photographer working on weddings, editorial, and personal projects. Mostly film, occasionally digital, always considered.',
  agency: '{name} is an independent studio helping ambitious teams ship products that feel good and convert well.',
  education: '{name} runs live, small-cohort programs taught by working professionals. Real feedback, portfolio projects, lifetime community.',
  design: '{name} is a studio for independent brands. We work on a few things a year, deeply — identity, packaging, and the occasional website.',
};

function Step2({ state, setState }: { state: CreateState; setState: React.Dispatch<React.SetStateAction<CreateState>> }) {
  const t = useTranslations('create.step2');

  const up = (k: keyof CreateState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));

  const aiGenerate = () => {
    const tpl = AI_DESCRIPTIONS[state.business] ?? AI_DESCRIPTIONS.agency;
    const name = state.businessName || state.business;
    setState((s) => ({ ...s, description: tpl.replace('{name}', name) }));
  };

  const inputCls = 'w-full bg-[#0f1a2e] border border-[#253349] text-[#e2e8f0] rounded-[10px] px-3 py-[11px] text-sm outline-none transition-all focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.2)] placeholder:text-[#475569]';

  return (
    <div className="grid gap-4 animate-[fadeUp_0.25s_ease-out]">
      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-1.5 tracking-[0.01em]">{t('nameLabel')}</label>
        <input className={inputCls} placeholder="Barbershop Co." value={state.businessName} onChange={up('businessName')} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[12px] font-semibold text-[#94a3b8] tracking-[0.01em]">{t('descLabel')}</label>
          <button
            onClick={aiGenerate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-semibold cursor-pointer border border-[rgba(139,92,246,0.35)] text-[#c4b5fd] transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(34,197,94,0.15))' }}
          >
            <IcoSparkles size={13} /> {t('aiBtn')}
          </button>
        </div>
        <textarea
          className={`${inputCls} resize-y min-h-[88px] leading-relaxed`}
          rows={4}
          placeholder={t('descPlaceholder')}
          value={state.description}
          onChange={up('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold text-[#94a3b8] mb-1.5 tracking-[0.01em]">{t('phoneLabel')}</label>
          <input className={inputCls} placeholder="+421 900 000 000" value={state.phone} onChange={up('phone')} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#94a3b8] mb-1.5 tracking-[0.01em]">{t('emailLabel')}</label>
          <input className={inputCls} placeholder="hello@yoursite.com" value={state.email} onChange={up('email')} />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-1.5 tracking-[0.01em]">{t('addressLabel')}</label>
        <input className={inputCls} placeholder="Hlavná 12, Bratislava" value={state.address} onChange={up('address')} />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-1.5 tracking-[0.01em]">{t('hoursLabel')}</label>
        <textarea
          className={`${inputCls} resize-y min-h-[76px] leading-relaxed`}
          rows={3}
          placeholder={CREATE_DEFAULT_HOURS}
          value={state.hours}
          onChange={up('hours')}
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-2 tracking-[0.01em]">{t('photosLabel')}</label>
        <div className="grid gap-2.5">
          <SinglePhoto
            label={t('heroImageLabel')}
            hint={t('heroImageHint')}
            value={state.heroPhoto}
            onChange={(v) => setState((s) => ({ ...s, heroPhoto: v }))}
          />
          <SinglePhoto
            label={t('logoLabel')}
            hint={t('logoHint')}
            value={state.logoPhoto}
            small
            onChange={(v) => setState((s) => ({ ...s, logoPhoto: v }))}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] font-semibold text-[#94a3b8] tracking-[0.01em]">{t('galleryLabel')}</label>
          <span className="text-[12px] text-[#64748b]">{state.gallery.length} / 6</span>
        </div>
        <GalleryUploader value={state.gallery} onChange={(arr) => setState((s) => ({ ...s, gallery: arr }))} />
      </div>
    </div>
  );
}

// ── Step 3: Plan + summary + launch ───────────────────────────────────────────

function Step3({
  state,
  setState,
  onLaunch,
}: {
  state: CreateState;
  setState: React.Dispatch<React.SetStateAction<CreateState>>;
  onLaunch: () => void;
}) {
  const t = useTranslations('create.step3');
  const tp = useTranslations('create.plans');
  const tb = useTranslations('create.biz');

  const biz = CREATE_BUSINESS_TYPES.find((b) => b.id === state.business) ?? CREATE_BUSINESS_TYPES[0];
  const palette = biz.palettes.find((p) => p.id === state.palette) ?? biz.palettes[0];
  const filledPhotos = (state.heroPhoto ? 1 : 0) + (state.logoPhoto ? 1 : 0) + state.gallery.length;

  const domain =
    state.plan === 'free'
      ? `${toSlug(state.businessName) || 'yoursite'}.vendshop.shop`
      : `${toSlug(state.businessName) || 'yoursite'}.com`;

  const langLabel =
    state.plan === 'pro' ? t('unlimited') : state.plan === 'starter' ? '15' : '5';

  const planFeats = (id: CreatePlan) => [
    tp(`${id}.f1`),
    tp(`${id}.f2`),
    tp(`${id}.f3`),
    tp(`${id}.f4`),
  ];

  return (
    <div className="grid gap-4 animate-[fadeUp_0.25s_ease-out]">
      {/* Plans */}
      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-2.5 tracking-[0.01em]">{t('planLabel')}</label>
        <div className="grid gap-2.5">
          {CREATE_PLANS.map((p) => {
            const selected = state.plan === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setState((s) => ({ ...s, plan: p.id }))}
                className={`border rounded-[14px] p-3.5 cursor-pointer transition-all grid gap-1.5 ${
                  selected
                    ? 'border-[#16a34a] bg-gradient-to-b from-[rgba(22,163,74,0.1)] to-[rgba(22,163,74,0.02)] shadow-[0_0_0_1px_#16a34a_inset]'
                    : 'border-[#253349] bg-[#1e293b] hover:border-[#334155]'
                }`}
                style={{ gridTemplateColumns: '1fr auto' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-[#e2e8f0]">{tp(`${p.id}.name`)}</span>
                    {p.popular && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(22,163,74,0.12)] text-[#86efac] border border-[rgba(34,197,94,0.3)]">
                        {t('mostPopular')}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-[#94a3b8] mt-0.5">{tp(`${p.id}.blurb`)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[18px] font-bold text-[#e2e8f0] tracking-tight">€{p.price}</span>
                  <span className="text-[12px] text-[#94a3b8] font-medium">{p.price === 0 ? ' forever' : ' / mo'}</span>
                </div>
                <div className="col-span-2 flex flex-wrap gap-x-3.5 gap-y-1.5 mt-0.5">
                  {planFeats(p.id as CreatePlan).map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-[12px] text-[#94a3b8]">
                      <span className="text-[#22c55e]"><IcoCheck size={13} /></span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="block text-[12px] font-semibold text-[#94a3b8] mb-2 tracking-[0.01em]">{t('summaryLabel')}</label>
        <div className="bg-[#1e293b] border border-[#253349] rounded-xl p-3.5 grid gap-2">
          {[
            { k: t('sumTemplate'), v: tb(`${biz.id}.label`) },
            { k: t('sumPalette'), v: palette.name, swatch: palette.primary },
            { k: t('sumName'), v: state.businessName || `${tb(`${biz.id}.label`)} Co.` },
            { k: t('sumContact'), v: state.phone || t('phoneNotSet') },
            { k: t('sumPhotos'), v: `${filledPhotos} ${t('uploaded')}` },
            { k: t('sumDomain'), v: domain },
            { k: t('sumLangs'), v: langLabel },
          ].map(({ k, v, swatch }) => (
            <div key={k} className="flex justify-between gap-3 text-[13px]">
              <span className="text-[#94a3b8]">{k}</span>
              <span className="text-[#e2e8f0] font-semibold text-right max-w-[60%] truncate flex items-center gap-2">
                {swatch && <span className="w-3 h-3 rounded-[3px] border border-[rgba(255,255,255,0.15)] flex-shrink-0" style={{ background: swatch }} />}
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Launch */}
      <button
        onClick={onLaunch}
        className="w-full flex items-center justify-center gap-2.5 rounded-[14px] py-4 text-[16px] font-bold text-[#052e13] cursor-pointer border border-[#16a34a] transition-all hover:-translate-y-px active:translate-y-0"
        style={{
          background: 'linear-gradient(180deg, #22c55e, #16a34a)',
          boxShadow: '0 10px 30px -10px rgba(34,197,94,0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        {t('launchBtn')} <IcoArrowRightLg />
      </button>
      <p className="text-center text-[12px] text-[#64748b] m-0">
        {state.plan === 'free' ? t('noCard') : t('freeTrial')}
      </p>
    </div>
  );
}

// ── Deploy overlay ─────────────────────────────────────────────────────────────

function DeployOverlay({
  progress,
  done,
  state,
  onClose,
}: {
  progress: number;
  done: boolean;
  state: CreateState;
  onClose: () => void;
}) {
  const t = useTranslations('create.deploy');
  const tb = useTranslations('create.biz');
  const pct = Math.round(progress * 100);
  const secsLeft = Math.max(0, Math.ceil(30 * (1 - progress)));
  const domain = `${toSlug(state.businessName) || 'yoursite'}.vendshop.shop`;
  const circumference = 2 * Math.PI * 26;

  const steps = [
    { label: t('d1'), done: progress > 0.15 },
    { label: t('d2'), done: progress > 0.45 },
    { label: t('d3'), done: progress > 0.75 },
    { label: t('d4'), done: progress >= 1 },
  ];

  const firstPending = steps.findIndex((s) => !s.done);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      style={{ background: 'rgba(11,18,32,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="w-full max-w-[480px] border border-[#253349] rounded-[18px] p-7 text-center"
        style={{ background: '#1e293b' }}
      >
        {!done ? (
          <>
            <svg className="w-16 h-16 mx-auto mb-4" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="26" fill="none" stroke="#22c55e" strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
              <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="#e2e8f0">{pct}%</text>
            </svg>
            <h3 className="text-[20px] font-bold tracking-tight text-[#e2e8f0] m-0">{t('title')}</h3>
            <p className="text-[14px] text-[#94a3b8] mt-1.5">
              {t('secsLeft', { secs: secsLeft })}
            </p>
            <div className="grid gap-2 mt-5 text-left">
              {steps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2.5 text-[13.5px] ${s.done ? 'text-[#e2e8f0]' : 'text-[#94a3b8]'}`}>
                  <span
                    className="w-[18px] h-[18px] rounded-full grid place-items-center flex-shrink-0"
                    style={{
                      background: s.done ? '#16a34a' : 'rgba(148,163,184,0.12)',
                      color: s.done ? '#052e13' : '#64748b',
                    }}
                  >
                    {s.done ? (
                      <IcoCheck size={11} />
                    ) : i === firstPending ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent"
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                    ) : null}
                  </span>
                  {s.label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#16a34a] mx-auto mb-4 grid place-items-center text-[#052e13]">
              <IcoCheck size={30} />
            </div>
            <h3 className="text-[22px] font-bold tracking-tight text-[#e2e8f0] m-0">{t('doneTitle')}</h3>
            <p className="text-[14px] text-[#94a3b8] mt-1.5">{t('doneSub')}</p>
            <div className="mt-5 p-3 bg-[#0f1a2e] border border-[#253349] rounded-[10px] font-mono text-[14px] text-[#86efac]">
              https://{domain}
            </div>
            <div className="flex gap-2.5 mt-5 justify-center">
              <a
                href={`https://${domain}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#052e13] border border-[#16a34a] cursor-pointer"
                style={{ background: '#16a34a' }}
              >
                {t('visitBtn')} <IcoArrowRight />
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-[#e2e8f0] border border-[#253349] bg-transparent hover:bg-[#243449] cursor-pointer"
              >
                {t('backBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export default function CreatePageClient() {
  const t = useTranslations('create');
  const tn = useTranslations('create.nav');

  const [state, setState] = useState<CreateState>(() => {
    if (typeof window === 'undefined') return INITIAL_STATE;
    try {
      const raw = localStorage.getItem(CREATE_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CreateState>;
        return { ...INITIAL_STATE, ...parsed, heroPhoto: null, logoPhoto: null, gallery: [] };
      }
    } catch {}
    return INITIAL_STATE;
  });

  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [deploying, setDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployed, setDeployed] = useState(false);

  // Persist (skip photos — data URLs are too large for localStorage)
  useEffect(() => {
    try {
      const { heroPhoto, logoPhoto, gallery, ...rest } = state;
      localStorage.setItem(CREATE_STORE_KEY, JSON.stringify(rest));
    } catch {}
  }, [state]);

  const goto = (n: number) =>
    setState((s) => ({ ...s, step: Math.max(1, Math.min(3, n)) as 1 | 2 | 3 }));

  const launch = () => {
    setDeploying(true);
    setDeployProgress(0);
    const start = Date.now();
    const dur = 30000;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setDeployProgress(p);
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(() => setDeployed(true), 400);
    };
    requestAnimationFrame(tick);
  };

  const biz = CREATE_BUSINESS_TYPES.find((b) => b.id === state.business) ?? CREATE_BUSINESS_TYPES[0];
  const palette = biz.palettes.find((p) => p.id === state.palette) ?? biz.palettes[0];

  const stepLabels = [
    { n: 1, label: t('topbar.stepChoose') },
    { n: 2, label: t('topbar.stepDetails') },
    { n: 3, label: t('topbar.stepLaunch') },
  ];

  const stepHeadings: Record<number, { kicker: string; title: string; sub: string }> = {
    1: { kicker: t('steps.1.kicker'), title: t('steps.1.title'), sub: t('steps.1.sub') },
    2: { kicker: t('steps.2.kicker'), title: t('steps.2.title'), sub: t('steps.2.sub') },
    3: { kicker: t('steps.3.kicker'), title: t('steps.3.title'), sub: t('steps.3.sub') },
  };
  const h = stepHeadings[state.step];

  return (
    <>
      {/* Topbar */}
      <header
        className="h-14 border-b border-[#253349] flex items-center justify-between px-5 sticky top-0 z-30"
        style={{ background: 'rgba(11,18,32,0.85)', backdropFilter: 'blur(10px)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 font-extrabold tracking-tight text-[16px] text-[#e2e8f0]">
            <span
              className="w-[26px] h-[26px] rounded-[7px] grid place-items-center text-[#052e13] font-black text-[14px]"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #22d3ee)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 4px 12px rgba(22,163,74,0.35)',
              }}
            >
              V
            </span>
            VendShop
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] px-2 py-1 rounded-full bg-[rgba(148,163,184,0.08)] text-[#94a3b8] border border-[#253349]">
            beta
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#94a3b8]">
          {stepLabels.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
                  state.step === s.n
                    ? 'bg-[rgba(22,163,74,0.12)] text-[#86efac]'
                    : state.step > s.n
                    ? 'text-[#86efac]'
                    : ''
                }`}
              >
                <span
                  className="w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] font-bold"
                  style={{
                    background:
                      state.step === s.n
                        ? '#16a34a'
                        : state.step > s.n
                        ? 'rgba(34,197,94,0.25)'
                        : '#1f2a3d',
                    color:
                      state.step === s.n
                        ? '#052e13'
                        : state.step > s.n
                        ? '#86efac'
                        : '#94a3b8',
                  }}
                >
                  {state.step > s.n ? '✓' : s.n}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < 2 && <span className="w-4 h-px bg-[#253349]" />}
            </div>
          ))}
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-1.5 text-[13px] text-[#94a3b8]">
          <span className="w-[7px] h-[7px] rounded-full bg-[#22c55e]" />
          <span className="hidden sm:block">{t('topbar.autoSaved')}</span>
        </div>
      </header>

      {/* App layout */}
      <div className="grid min-h-[calc(100vh-56px)]" style={{ gridTemplateColumns: 'minmax(420px,40%) 1fr' }}>

        {/* Left panel */}
        <div
          className="border-r border-[#253349] flex flex-col"
          style={{ maxHeight: 'calc(100vh - 56px)', background: '#0b1220' }}
        >
          {/* Step header */}
          <div className="px-5 pt-5 pb-3.5 border-b border-[#253349] sticky top-0 z-10 bg-[#0b1220]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#64748b] font-semibold">{h.kicker}</div>
            <h2 className="text-[20px] font-bold tracking-tight text-[#e2e8f0] mt-1 mb-0.5">{h.title}</h2>
            <p className="text-[13px] text-[#94a3b8] m-0">{h.sub}</p>
          </div>

          {/* Step body */}
          <div className="px-5 py-4 overflow-y-auto flex-1">
            {state.step === 1 && <Step1 state={state} setState={setState} />}
            {state.step === 2 && <Step2 state={state} setState={setState} />}
            {state.step === 3 && <Step3 state={state} setState={setState} onLaunch={launch} />}
          </div>

          {/* Step footer */}
          <div className="px-5 py-3 border-t border-[#253349] flex items-center justify-between bg-[rgba(15,23,42,0.6)]">
            <button
              onClick={() => goto(state.step - 1)}
              disabled={state.step === 1}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold border border-transparent bg-transparent text-[#e2e8f0] cursor-pointer hover:bg-[rgba(148,163,184,0.06)] transition-all ${state.step === 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <IcoArrowLeft /> {tn('back')}
            </button>

            <span className="text-[12px] text-[#64748b]">
              {tn('stepOf', { step: state.step })}
            </span>

            {state.step < 3 ? (
              <button
                onClick={() => goto(state.step + 1)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold text-[#052e13] bg-[#16a34a] border border-[#16a34a] cursor-pointer hover:bg-[#22c55e] hover:border-[#22c55e] transition-all"
              >
                {tn('continue')} <IcoArrowRight />
              </button>
            ) : (
              <span className="w-[1px]" />
            )}
          </div>
        </div>

        {/* Right panel — live preview */}
        <PreviewPanel
          state={state}
          biz={biz}
          palette={palette}
          viewport={viewport}
          onViewportChange={setViewport}
        />
      </div>

      {/* Responsive override for narrow screens — show steps stacked */}
      <style>{`
        @media (max-width: 960px) {
          .grid[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Deploy overlay */}
      {deploying && (
        <DeployOverlay
          progress={deployProgress}
          done={deployed}
          state={state}
          onClose={() => { setDeploying(false); setDeployed(false); }}
        />
      )}
    </>
  );
}
