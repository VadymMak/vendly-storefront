'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShopData, StoreSettingsFormData } from '@/lib/types';

const LANGUAGES = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'cs', label: 'Čeština' },
  { value: 'uk', label: 'Українська' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

const COLOR_SCHEMES = [
  { value: 'light', label: 'Light', preview: 'bg-white border-gray-200' },
  { value: 'dark',  label: 'Dark',  preview: 'bg-gray-900 border-gray-700' },
  { value: 'warm',  label: 'Warm',  preview: 'bg-amber-50 border-amber-200' },
  { value: 'bold',  label: 'Bold',  preview: 'bg-indigo-950 border-indigo-800' },
] as const;

const CURRENCIES = ['EUR', 'CZK', 'UAH', 'USD'];

const TEMPLATE_IDS = [
  { value: 'food',     label: 'Jedlo & potraviny' },
  { value: 'physical', label: 'Fyzický obchod' },
  { value: 'beauty',   label: 'Krása & wellness' },
  { value: 'repair',   label: 'Opravovňa' },
  { value: 'digital',  label: 'Digitálne produkty' },
  { value: 'restaurant', label: 'Reštaurácia' },
];

interface SettingsFormProps {
  userId: string;
  store: ShopData | null;
}

export default function SettingsForm({ userId, store }: SettingsFormProps) {
  const router = useRouter();
  const isNew = !store;

  const [form, setForm] = useState<StoreSettingsFormData>({
    name:          store?.name || '',
    description:   store?.description || '',
    shopLanguage:  store?.shopLanguage || 'sk',
    colorScheme:   store?.settings.colorScheme || 'light',
    currency:      store?.settings.currency || 'EUR',
    whatsapp:      store?.settings.whatsapp || '',
    instagram:     store?.settings.instagram || '',
    facebook:      store?.settings.facebook || '',
    address:       store?.settings.address || '',
    phone:         store?.settings.phone || '',
    openingHours:  store?.settings.openingHours || '',
    deliveryInfo:  store?.settings.deliveryInfo || '',
    aboutText:     store?.settings.aboutText || '',
    isPublished:   store?.isPublished ?? false,
  });
  const [templateId, setTemplateId] = useState(store?.templateId || 'physical');
  const [slug, setSlug] = useState(store?.slug || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof StoreSettingsFormData>(field: K, value: StoreSettingsFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const url = isNew ? '/api/stores' : `/api/stores/${store!.id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, templateId, slug, userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chyba pri ukladaní');
      }

      setSuccess(true);
      router.refresh();
      if (isNew) router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-secondary">Základné informácie</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">Názov obchodu *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Môj obchod"
            />
          </div>
          {isNew && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                URL adresa (slug) *
              </label>
              <div className="flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary">
                <span className="pl-4 text-sm text-gray-400">vendshop.shop/</span>
                <input
                  type="text" required value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="flex-1 py-2.5 pr-4 text-sm focus:outline-none"
                  placeholder="moj-obchod"
                />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">Popis</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Krátky popis vášho obchodu..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">Typ obchodu</label>
              <select
                value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {TEMPLATE_IDS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">Jazyk obchodu</label>
              <select
                value={form.shopLanguage} onChange={(e) => set('shopLanguage', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Design */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-secondary">Dizajn</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">Farebná schéma</label>
            <div className="flex gap-3">
              {COLOR_SCHEMES.map((cs) => (
                <button
                  key={cs.value} type="button"
                  onClick={() => set('colorScheme', cs.value)}
                  className={`flex flex-col items-center gap-1.5`}
                >
                  <div className={`h-10 w-10 rounded-lg border-2 ${cs.preview} ${
                    form.colorScheme === cs.value ? 'ring-2 ring-primary ring-offset-1' : ''
                  }`} />
                  <span className="text-xs text-gray-500">{cs.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">Mena</label>
              <select
                value={form.currency} onChange={(e) => set('currency', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-secondary">Kontakt & sociálne siete</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { field: 'phone',     label: 'Telefón',    placeholder: '+421 9xx xxx xxx' },
            { field: 'whatsapp',  label: 'WhatsApp',   placeholder: '421912345678' },
            { field: 'instagram', label: 'Instagram',  placeholder: 'moj_obchod' },
            { field: 'facebook',  label: 'Facebook',   placeholder: 'MojObchod' },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="mb-1 block text-sm font-medium text-secondary">{label}</label>
              <input
                type="text"
                value={form[field as keyof StoreSettingsFormData] as string}
                onChange={(e) => set(field as keyof StoreSettingsFormData, e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={placeholder}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">Adresa</label>
            <input
              type="text" value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Hlavná 1, Bratislava"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">Otváracie hodiny</label>
            <input
              type="text" value={form.openingHours}
              onChange={(e) => set('openingHours', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Po–Pi 9:00–18:00"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">Info o doručení</label>
            <input
              type="text" value={form.deliveryInfo}
              onChange={(e) => set('deliveryInfo', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Doručenie do 2–3 dní, osobný odber v obchode"
            />
          </div>
        </div>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-secondary">Zverejniť obchod</h2>
            <p className="mt-1 text-sm text-neutral">
              {form.isPublished ? 'Obchod je verejný a zákazníci ho môžu navštíviť.' : 'Obchod je skrytý.'}
            </p>
          </div>
          <button
            type="button" role="switch" aria-checked={form.isPublished}
            onClick={() => set('isPublished', !form.isPublished)}
            className={`relative h-7 w-14 rounded-full transition-colors ${form.isPublished ? 'bg-primary' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isPublished ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">Nastavenia boli uložené!</div>}

      <button
        type="submit" disabled={submitting}
        className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? 'Ukladám...' : isNew ? 'Vytvoriť obchod' : 'Uložiť nastavenia'}
      </button>
    </form>
  );
}
