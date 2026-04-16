'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { BRIEF_TRANSLATIONS, getBriefT } from '@/lib/brief-translations';
import type { BriefService } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicLead {
  businessType:   string;
  services:       string;
  contact:        string;
  language:       string;
  businessName:   string | null;
  briefSubmitted: boolean;
}

interface FormState {
  businessName:       string;
  address:            string;
  email:              string;
  workingHours:       string;
  additionalServices: string;
  selectedPalette:    string;
  selectedHero:       string;
  selectedMood:       string;
  socialInstagram:    string;
  socialFacebook:     string;
  referenceUrl:       string;
  wishes:             string;
  website:            string; // honeypot
}

const INITIAL_FORM: FormState = {
  businessName: '', address: '', email: '', workingHours: '',
  additionalServices: '', selectedPalette: '', selectedHero: '', selectedMood: '',
  socialInstagram: '', socialFacebook: '', referenceUrl: '', wishes: '',
  website: '',
};

const EMPTY_SERVICE: BriefService = { name: '', price: '', duration: '', note: '' };

const TOTAL_STEPS = 5;

// ─── Style data ───────────────────────────────────────────────────────────────

const PALETTES = [
  { id: 'dark',         gradient: 'linear-gradient(135deg, #0A0A0A 0%, #D4A853 100%)' },
  { id: 'light',        gradient: 'linear-gradient(135deg, #E8F5E9 0%, #16a34a 100%)' },
  { id: 'warm',         gradient: 'linear-gradient(135deg, #F5F0EB 0%, #7C9A82 100%)' },
  { id: 'professional', gradient: 'linear-gradient(135deg, #1A2332 0%, #F97316 100%)' },
  { id: 'natural',      gradient: 'linear-gradient(135deg, #FFFDF9 0%, #2D5A3D 100%)' },
  { id: 'custom',       gradient: 'linear-gradient(135deg, #374151 0%, #6B7280 100%)' },
];

const HERO_SVGS: Record<string, React.ReactNode> = {
  fullscreen: (
    <svg viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect width="120" height="72" fill="#334155" rx="3"/>
      <text x="60" y="28" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="sans-serif">IMAGE</text>
      <rect x="0" y="48" width="120" height="24" fill="rgba(0,0,0,0.5)" rx="0"/>
      <rect x="10" y="53" width="55" height="5" rx="2" fill="#94a3b8"/>
      <rect x="10" y="62" width="28" height="6" rx="3" fill="#16a34a"/>
    </svg>
  ),
  split: (
    <svg viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect width="120" height="72" fill="#1e293b" rx="3"/>
      <rect x="60" width="60" height="72" fill="#334155" rx="0"/>
      <text x="90" y="40" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="sans-serif">IMAGE</text>
      <rect x="8" y="18" width="40" height="5" rx="2" fill="#94a3b8"/>
      <rect x="8" y="28" width="32" height="4" rx="2" fill="#475569"/>
      <rect x="8" y="37" width="26" height="4" rx="2" fill="#475569"/>
      <rect x="8" y="50" width="28" height="8" rx="3" fill="#16a34a"/>
    </svg>
  ),
  centered: (
    <svg viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect width="120" height="72" fill="#334155" rx="3"/>
      <rect width="120" height="72" fill="rgba(0,0,0,0.45)" rx="3"/>
      <rect x="30" y="20" width="60" height="6" rx="2" fill="rgba(255,255,255,0.85)"/>
      <rect x="38" y="32" width="44" height="4" rx="2" fill="rgba(255,255,255,0.5)"/>
      <rect x="42" y="44" width="36" height="8" rx="3" fill="#16a34a"/>
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waLink(contact: string) {
  return `https://wa.me/${contact.replace(/\D/g, '')}`;
}

function resolveLang(lang: string): string {
  return lang in BRIEF_TRANSLATIONS ? lang : 'en';
}

// Shared input styles
const inputCls = 'w-full rounded-xl border border-[#374151] bg-[#0F172A] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-green-500 placeholder:text-gray-500';
const inputSmCls = 'w-full rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2 text-sm text-white outline-none focus:border-green-500 placeholder:text-gray-600';
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-300';

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#374151] text-[10px] font-bold text-gray-300 hover:bg-green-600 hover:text-white transition-colors"
        aria-label="info"
      >?</button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-[#374151] bg-[#0B0F1A] px-3 py-2 text-xs leading-snug text-gray-200 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  onFiles, accept, uploading, label, hint, children, className = '',
}: {
  onFiles: (files: FileList) => void;
  accept: string;
  uploading: boolean;
  label: string;
  hint: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
        dragging ? 'border-green-500 bg-green-500/10' : 'border-[#374151] hover:border-green-600/60 hover:bg-green-500/5'
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
        multiple={false}
      />
      {children ?? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">
          {uploading ? (
            <span className="text-sm text-gray-400 animate-pulse">Uploading…</span>
          ) : (
            <>
              <span className="text-2xl">📁</span>
              <p className="text-sm font-medium text-gray-300">{label}</p>
              <p className="text-xs text-gray-500">{hint}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MultiDropZone({
  onFiles, uploading, label, hint,
}: {
  onFiles: (files: FileList) => void;
  uploading: boolean;
  label: string;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
        dragging ? 'border-green-500 bg-green-500/10' : 'border-[#374151] hover:border-green-600/60 hover:bg-green-500/5'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
        {uploading ? (
          <span className="text-sm text-gray-400 animate-pulse">Uploading…</span>
        ) : (
          <>
            <span className="text-2xl">🖼️</span>
            <p className="text-sm font-medium text-gray-300">{label}</p>
            <p className="text-xs text-gray-500">{hint}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <p className="text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const { leadId } = useParams<{ leadId: string }>();

  const [lead, setLead]         = useState<PublicLead | null>(null);
  const [pageStatus, setPage]   = useState<'loading' | 'invalid' | 'submitted' | 'form' | 'done'>('loading');
  const [step, setStep]         = useState<number>(1);
  const [form, setForm]         = useState<FormState>(INITIAL_FORM);
  const [services, setServices] = useState<BriefService[]>([{ ...EMPTY_SERVICE }]);
  const [logoUrl, setLogoUrl]   = useState('');
  const [priceListUrl, setPriceList] = useState('');
  const [photoUrls, setPhotos]  = useState<string[]>([]);

  const [uploadingLogo, setULogo]   = useState(false);
  const [uploadingPrice, setUPrice] = useState(false);
  const [uploadingPhotos, setUPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadErr, setUploadErr]   = useState('');

  // Fetch lead info
  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/brief/${leadId}`)
      .then((r) => {
        if (r.status === 404) { setPage('invalid'); return null; }
        return r.json() as Promise<PublicLead>;
      })
      .then((data) => {
        if (!data) return;
        setLead(data);
        if (data.briefSubmitted) {
          setPage('submitted');
        } else {
          setForm((p) => ({ ...p, businessName: data.businessName ?? '' }));
          setPage('form');
        }
      })
      .catch(() => setPage('invalid'));
  }, [leadId]);

  const lang = lead ? resolveLang(lead.language) : 'en';
  const t    = getBriefT(lang);

  // ── Quality score (0–10) ────────────────────────────────────────────────────
  const filledServices = services.filter((s) => s.name.trim());
  const servicesWithPrices = filledServices.filter((s) => s.price.trim()).length;

  const quality = useMemo(() => {
    let q = 0;
    if (form.businessName.trim())       q += 1;
    if (filledServices.length >= 1)     q += 1;
    if (servicesWithPrices >= 2)        q += 1;
    if (form.selectedPalette)           q += 1;
    if (form.selectedHero)              q += 1;
    if (form.selectedMood)              q += 1;
    if (photoUrls.length >= 5)          q += 2;
    else if (photoUrls.length >= 1)     q += 1;
    if (logoUrl)                        q += 1;
    if (form.workingHours.trim())       q += 1;
    return Math.min(q, 10);
  }, [form, filledServices.length, servicesWithPrices, photoUrls.length, logoUrl]);

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  // ── Upload helper ───────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('leadId', leadId);
    const res = await fetch('/api/brief/upload', { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Upload failed'); }
    const data = await res.json() as { url: string };
    return data.url;
  }, [leadId]);

  const handleLogoFiles = useCallback(async (files: FileList) => {
    if (!files[0]) return;
    setULogo(true); setUploadErr('');
    try { setLogoUrl(await uploadFile(files[0]) ?? ''); }
    catch (e) { setUploadErr(e instanceof Error ? e.message : t.uploadError); }
    finally   { setULogo(false); }
  }, [uploadFile, t]);

  const handlePriceFiles = useCallback(async (files: FileList) => {
    if (!files[0]) return;
    setUPrice(true); setUploadErr('');
    try { setPriceList(await uploadFile(files[0]) ?? ''); }
    catch (e) { setUploadErr(e instanceof Error ? e.message : t.uploadError); }
    finally   { setUPrice(false); }
  }, [uploadFile, t]);

  const handlePhotoFiles = useCallback(async (files: FileList) => {
    const available = 20 - photoUrls.length;
    if (available <= 0) return;
    const list = Array.from(files).slice(0, available);
    setUPhotos(true); setUploadErr('');
    try {
      const urls = await Promise.all(list.map((f) => uploadFile(f)));
      setPhotos((p) => [...p, ...(urls.filter(Boolean) as string[])]);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : t.uploadError);
    } finally {
      setUPhotos(false);
    }
  }, [uploadFile, photoUrls.length, t]);

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  // ── Service table handlers ─────────────────────────────────────────────────
  const updateService = (idx: number, field: keyof BriefService, val: string) => {
    setServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };
  const addServiceRow = () => setServices((prev) => [...prev, { ...EMPTY_SERVICE }]);
  const removeServiceRow = (idx: number) => {
    setServices((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const setField = (key: keyof FormState, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  // ── Step validation ─────────────────────────────────────────────────────────
  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return form.businessName.trim().length > 0;
      case 2: return filledServices.length >= 1;
      case 3: return !!form.selectedPalette && !!form.selectedHero && !!form.selectedMood;
      case 4: return photoUrls.length > 0 || !!logoUrl;
      case 5: return true;
      default: return false;
    }
  }, [step, form, filledServices.length, photoUrls.length, logoUrl]);

  const handleNext = () => {
    if (!canProceed) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (form.website) return; // honeypot
    setSubmitting(true);
    try {
      const cleanServices = services.filter((s) => s.name.trim());
      const payload = {
        ...form,
        briefServicesJson: cleanServices.length ? JSON.stringify(cleanServices) : null,
        logoUrl:      logoUrl || null,
        priceListUrl: priceListUrl || null,
        photoUrls:    photoUrls.length ? JSON.stringify(photoUrls) : null,
      };
      const res = await fetch(`/api/brief/${leadId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (res.ok) setPage('done');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ───────────────────────────────────────────────────────────
  if (pageStatus === 'loading') return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A]">
      <p className="animate-pulse text-gray-400">{t.loadingText}</p>
    </div>
  );

  if (pageStatus === 'invalid') return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A] px-4">
      <div className="max-w-md text-center">
        <p className="mb-2 text-4xl">🔗</p>
        <p className="text-lg font-semibold text-white">{t.invalidLink}</p>
      </div>
    </div>
  );

  if (pageStatus === 'submitted' || pageStatus === 'done') return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A] px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-900/40 ring-4 ring-green-500/30">
          <svg className="h-10 w-10 text-green-400" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 30, strokeDashoffset: pageStatus === 'done' ? 0 : 30, transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">{t.thankTitle}</h1>
        <p className="mb-1 text-gray-400">{t.thankSubtitle}</p>
        {lead && (
          <p className="mb-6 text-sm text-gray-500">{t.thankContact} <span className="text-green-400">{lead.contact}</span></p>
        )}
        <a
          href={lead ? waLink(lead.contact) : 'https://wa.me/421901234567'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-500 transition-colors"
        >
          💬 {t.thankWa}
        </a>
      </div>
    </div>
  );

  // ── FORM ────────────────────────────────────────────────────────────────────
  const bt = lead?.businessType ?? 'other';
  const stepOfText = t.stepOf.replace('{current}', String(step)).replace('{total}', String(TOTAL_STEPS));

  return (
    <div className="min-h-screen bg-[#0B0F1A] pb-28">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-[#374151] bg-[#0B0F1A]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white"/>
                  <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5"/>
                </svg>
              </div>
              <span className="font-bold text-white">VendShop</span>
            </div>
            <span className="text-xs font-medium text-gray-400">{stepOfText}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#374151]">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-2xl px-4 py-6">

        {/* Upload error toast */}
        {uploadErr && (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-900/40 px-4 py-3 text-sm text-red-300">
            ⚠️ {uploadErr}
          </div>
        )}

        {/* Honeypot */}
        <input
          type="text" name="website" value={form.website} tabIndex={-1} autoComplete="off"
          onChange={(e) => setField('website', e.target.value)}
          style={{ display: 'none' }} aria-hidden="true"
        />

        {/* ── STEP 1 · Basics ── */}
        {step === 1 && (
          <div>
            <StepHeader icon="🏢" title={t.s1Title} subtitle={t.s1Subtitle} />
            <div className="space-y-4 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <div>
                <label className={`${labelCls} flex items-center`}>
                  {t.labelBizName} <span className="ml-1 text-red-400">*</span>
                  <Tooltip text={t.bizNameHint} />
                </label>
                <input
                  type="text" className={inputCls} value={form.businessName}
                  placeholder="Café Merkur"
                  onChange={(e) => setField('businessName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.labelAddress}</label>
                <input
                  type="text" className={inputCls} value={form.address}
                  placeholder={t.phAddress}
                  onChange={(e) => setField('address', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.labelEmail}</label>
                <input
                  type="email" className={inputCls} value={form.email}
                  placeholder="hello@business.sk"
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.labelHours}</label>
                <input
                  type="text" className={inputCls} value={form.workingHours}
                  placeholder={t.phHours}
                  onChange={(e) => setField('workingHours', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 · Services ── */}
        {step === 2 && (
          <div>
            <StepHeader icon="📋" title={t.s2Title} subtitle={t.s2Subtitle} />

            {/* Chat-selected sections as context */}
            {lead && lead.services && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t.labelYourServices}</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.services.split(',').map((s) => s.trim()).filter(Boolean).map((s, i) => (
                    <span key={`${s}-${i}`} className="rounded-lg border border-green-800/50 bg-green-900/40 px-2.5 py-1 text-xs font-medium text-green-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Services table */}
            <div className="rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <div className="mb-1 text-sm font-semibold text-white">{t.servicesTableTitle} <span className="text-red-400">*</span></div>
              <p className="mb-4 text-xs text-gray-500">{t.servicesTableSubtitle}</p>

              <div className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="rounded-xl border border-[#334155] bg-[#0F172A] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                      {services.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeServiceRow(i)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >× {t.removeService}</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{t.colName}</label>
                        <input
                          type="text" className={inputSmCls} value={s.name}
                          placeholder={t.phServiceName}
                          onChange={(e) => updateService(i, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{t.colPrice}</label>
                        <input
                          type="text" className={inputSmCls} value={s.price}
                          placeholder={t.phServicePrice}
                          onChange={(e) => updateService(i, 'price', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{t.colDuration}</label>
                        <input
                          type="text" className={inputSmCls} value={s.duration}
                          placeholder={t.phServiceDuration}
                          onChange={(e) => updateService(i, 'duration', e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{t.colNote}</label>
                        <input
                          type="text" className={inputSmCls} value={s.note}
                          placeholder={t.phServiceNote}
                          onChange={(e) => updateService(i, 'note', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addServiceRow}
                className="mt-3 w-full rounded-xl border-2 border-dashed border-[#374151] py-3 text-sm font-medium text-gray-300 hover:border-green-600 hover:text-green-400 transition-colors"
              >
                {t.addService}
              </button>

              <p className="mt-3 text-xs italic text-gray-500">{t.servicesExample}</p>
              {filledServices.length === 0 && (
                <p className="mt-2 text-xs text-yellow-400">⚠️ {t.servicesEmpty}</p>
              )}
            </div>

            {/* Additional notes + price list */}
            <div className="mt-4 space-y-3 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <div>
                <label className={labelCls}>{t.labelAdditional}</label>
                <textarea
                  rows={3} className={`${inputCls} resize-none`}
                  value={form.additionalServices}
                  placeholder={t.phAdditional}
                  onChange={(e) => setField('additionalServices', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>{t.labelPriceList}</label>
                {priceListUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#374151] bg-[#0F172A] px-4 py-3">
                    <span className="text-sm text-green-400">✓ {t.hintPriceList}</span>
                    <a href={priceListUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-gray-400 hover:text-white underline">↗</a>
                    <button onClick={() => setPriceList('')} className="text-xs text-red-400 hover:text-red-300">×</button>
                  </div>
                ) : (
                  <DropZone
                    onFiles={handlePriceFiles}
                    accept="application/pdf,image/*"
                    uploading={uploadingPrice}
                    label={t.dragPriceList}
                    hint={t.hintPriceList}
                    className="py-4"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 · Visual ── */}
        {step === 3 && (
          <div>
            <StepHeader icon="🎨" title={t.s3Title} subtitle={t.s3Subtitle} />

            <div className="space-y-5 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              {/* Palettes */}
              <div>
                <p className={labelCls}>{t.labelPalette} <span className="text-red-400">*</span></p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PALETTES.map(({ id, gradient }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('selectedPalette', id)}
                      className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                        form.selectedPalette === id
                          ? 'border-green-500 ring-2 ring-green-500/30'
                          : 'border-[#374151] hover:border-[#4B5563]'
                      }`}
                    >
                      <div className="h-14 w-full" style={{ background: gradient }} />
                      <div className="bg-[#1E293B] py-1.5 px-2 text-center">
                        <span className="text-xs font-medium text-gray-300">
                          {t.palettes[id] ?? id}
                        </span>
                      </div>
                      {form.selectedPalette === id && (
                        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero */}
              <div>
                <p className={labelCls}>{t.labelHero} <span className="text-red-400">*</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {(['fullscreen', 'split', 'centered'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('selectedHero', id)}
                      className={`rounded-xl border-2 overflow-hidden transition-all ${
                        form.selectedHero === id
                          ? 'border-green-500 ring-2 ring-green-500/30'
                          : 'border-[#374151] hover:border-[#4B5563]'
                      }`}
                    >
                      <div className="h-14 w-full bg-[#0F172A] p-1">{HERO_SVGS[id]}</div>
                      <div className="bg-[#1E293B] py-1.5 px-1 text-center">
                        <span className="block text-[10px] font-medium text-gray-400 leading-tight">
                          {t.heros[id] ?? id}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <p className={labelCls}>{t.labelMood} <span className="text-red-400">*</span></p>
                <div className="space-y-2">
                  {(['modern', 'cozy', 'strict'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('selectedMood', id)}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        form.selectedMood === id
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-[#374151] hover:border-[#4B5563] hover:bg-[#263349]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{t.moods[id] ?? id}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{t.moodDesc[id] ?? ''}</div>
                      </div>
                      {form.selectedMood === id && (
                        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4 · Photos & logo ── */}
        {step === 4 && (
          <div>
            <StepHeader icon="📸" title={t.s4Title} subtitle={t.s4Subtitle} />

            {/* Photo checklist */}
            <div className="mb-4 rounded-2xl border border-green-800/40 bg-green-900/10 p-4">
              <p className="mb-2 text-sm font-semibold text-green-400">📋 {t.photoChecklistTitle}</p>
              <p className="mb-2 text-xs text-gray-400">{t.photoChecklistHint}</p>
              <p className="text-sm text-gray-300">{t.photoHintByType[bt] ?? t.photoHintByType.other}</p>
            </div>

            <div className="space-y-5 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              {/* Logo */}
              <div>
                <p className={labelCls}>{t.labelLogo}</p>
                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#374151] bg-[#0F172A]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="logo" className="h-full w-full object-contain p-1" />
                    </div>
                    <button
                      onClick={() => setLogoUrl('')}
                      className="rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                    >× {t.deletePhoto}</button>
                  </div>
                ) : (
                  <DropZone
                    onFiles={handleLogoFiles}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    uploading={uploadingLogo}
                    label={t.dragLogo}
                    hint={t.hintLogo}
                    className="h-24"
                  />
                )}
              </div>

              {/* Photos */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className={labelCls}>{t.labelPhotos} <span className="text-red-400">*</span></p>
                  <span className="text-xs text-gray-500">{photoUrls.length}/20</span>
                </div>
                <MultiDropZone
                  onFiles={handlePhotoFiles}
                  uploading={uploadingPhotos}
                  label={t.dragPhotos}
                  hint={t.hintPhotos}
                />
                {photoUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photoUrls.map((url, i) => (
                      <div key={i} className="group relative aspect-square overflow-hidden rounded-xl bg-[#0F172A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-700"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-600">{t.hintMaxPhotos}</p>
              </div>
            </div>

            {/* Socials & reference */}
            <div className="mt-4 space-y-3 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <p className="text-sm font-semibold text-white">{t.s5Title}</p>
              <p className="-mt-2 mb-1 text-xs text-gray-500">{t.s5Subtitle}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t.labelInstagram}</label>
                  <input type="text" className={inputCls} value={form.socialInstagram}
                    placeholder={t.phInstagram} onChange={(e) => setField('socialInstagram', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t.labelFacebook}</label>
                  <input type="text" className={inputCls} value={form.socialFacebook}
                    placeholder={t.phFacebook} onChange={(e) => setField('socialFacebook', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t.labelReference}</label>
                <input type="url" className={inputCls} value={form.referenceUrl}
                  placeholder={t.phReference} onChange={(e) => setField('referenceUrl', e.target.value)} />
              </div>
              <div>
                <label className={`${labelCls} flex items-center`}>
                  {t.labelWishes}
                  <Tooltip text={t.wishesHint} />
                </label>
                <textarea
                  rows={4} className={`${inputCls} resize-none`}
                  value={form.wishes}
                  placeholder={t.phWishes}
                  onChange={(e) => setField('wishes', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5 · Review ── */}
        {step === 5 && (
          <div>
            <StepHeader icon="✅" title={t.reviewTitle} subtitle={t.reviewSubtitle} />

            {/* Quality score */}
            <div className="mb-4 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{t.qualityLabel}</span>
                <span className={`text-2xl font-bold ${quality >= 8 ? 'text-green-400' : quality >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {quality}/10
                </span>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[#374151]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    quality >= 8 ? 'bg-green-500' : quality >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${quality * 10}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {quality >= 8 ? t.qualityTipHigh : quality >= 5 ? t.qualityTipMid : t.qualityTipLow}
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-3 rounded-2xl border border-[#374151] bg-[#1E293B] p-5">
              <ReviewRow label={t.reviewBasics} onEdit={() => setStep(1)} editTxt={t.btnEdit}>
                <div className="space-y-0.5 text-sm text-gray-300">
                  <div><span className="text-gray-500">{t.labelBizName}:</span> {form.businessName || '—'}</div>
                  {form.address      && <div><span className="text-gray-500">{t.labelAddress}:</span> {form.address}</div>}
                  {form.email        && <div><span className="text-gray-500">{t.labelEmail}:</span> {form.email}</div>}
                  {form.workingHours && <div><span className="text-gray-500">{t.labelHours}:</span> {form.workingHours}</div>}
                </div>
              </ReviewRow>

              <ReviewRow label={t.reviewServices} onEdit={() => setStep(2)} editTxt={t.btnEdit}>
                {filledServices.length > 0 ? (
                  <ul className="space-y-1 text-sm text-gray-300">
                    {filledServices.map((s, i) => (
                      <li key={i}>
                        <span className="text-white">{s.name}</span>
                        {s.price    && <span className="text-green-400"> — {s.price}</span>}
                        {s.duration && <span className="text-gray-400"> — {s.duration}</span>}
                        {s.note     && <span className="text-gray-500 italic"> ({s.note})</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-gray-500">—</span>
                )}
              </ReviewRow>

              <ReviewRow label={t.reviewStyle} onEdit={() => setStep(3)} editTxt={t.btnEdit}>
                <div className="space-y-0.5 text-sm text-gray-300">
                  <div><span className="text-gray-500">{t.labelPalette}:</span> {t.palettes[form.selectedPalette] ?? '—'}</div>
                  <div><span className="text-gray-500">{t.labelHero}:</span> {t.heros[form.selectedHero] ?? '—'}</div>
                  <div><span className="text-gray-500">{t.labelMood}:</span> {t.moods[form.selectedMood] ?? '—'}</div>
                </div>
              </ReviewRow>

              <ReviewRow label={t.reviewPhotos} onEdit={() => setStep(4)} editTxt={t.btnEdit}>
                <div className="space-y-0.5 text-sm text-gray-300">
                  <div><span className="text-gray-500">{t.labelLogo}:</span> {logoUrl ? '✓' : '—'}</div>
                  <div><span className="text-gray-500">{t.labelPhotos}:</span> {photoUrls.length}/20</div>
                  <div><span className="text-gray-500">{t.labelPriceList}:</span> {priceListUrl ? '✓' : '—'}</div>
                </div>
              </ReviewRow>

              <ReviewRow label={t.reviewContacts} onEdit={() => setStep(4)} editTxt={t.btnEdit}>
                <div className="space-y-0.5 text-sm text-gray-300">
                  <div><span className="text-gray-500">Instagram:</span> {form.socialInstagram || '—'}</div>
                  <div><span className="text-gray-500">Facebook:</span> {form.socialFacebook || '—'}</div>
                  <div><span className="text-gray-500">{t.labelReference}:</span> {form.referenceUrl || '—'}</div>
                  {form.wishes && (
                    <div className="pt-1"><span className="text-gray-500">{t.labelWishes}:</span> <span className="italic text-gray-400">{form.wishes}</span></div>
                  )}
                </div>
              </ReviewRow>
            </div>
          </div>
        )}

      </main>

      {/* ── Sticky footer (Back / Next / Submit) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#374151] bg-[#0B0F1A]/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="rounded-xl border border-[#374151] bg-[#1E293B] px-5 py-4 text-sm font-medium text-gray-300 hover:bg-[#263349] transition-colors disabled:opacity-60"
            >
              {t.btnBack}
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="ml-auto flex-1 rounded-xl bg-green-600 py-4 text-base font-bold text-white transition-all hover:bg-green-500 active:scale-[0.98] disabled:bg-[#1E293B] disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {t.btnNext}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="ml-auto flex-1 rounded-xl bg-green-600 py-4 text-base font-bold text-white transition-all hover:bg-green-500 active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t.submitting}
                </span>
              ) : t.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({
  label, onEdit, editTxt, children,
}: {
  label: string;
  onEdit: () => void;
  editTxt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-green-400 hover:text-green-300"
        >{editTxt}</button>
      </div>
      {children}
    </div>
  );
}
