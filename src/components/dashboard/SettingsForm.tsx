'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ShopData, StoreSettingsFormData } from '@/lib/types';

// Shop language labels are always in their native language (not translated)
const LANGUAGES = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'cs', label: 'Čeština' },
  { value: 'uk', label: 'Українська' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

const COLOR_SCHEMES = [
  { value: 'light', preview: 'bg-white border-gray-200' },
  { value: 'dark',  preview: 'bg-gray-900 border-gray-700' },
  { value: 'warm',  preview: 'bg-amber-50 border-amber-200' },
  { value: 'bold',  preview: 'bg-indigo-950 border-indigo-800' },
] as const;

const CURRENCIES = ['EUR', 'CZK', 'UAH', 'USD'];

interface SettingsFormProps {
  userId: string;
  store: ShopData | null;
}

export default function SettingsForm({ userId, store }: SettingsFormProps) {
  const router = useRouter();
  const t = useTranslations('dashboardSettings');
  const isNew = !store;

  // Template types — translated via dashboardSettings keys
  const TEMPLATE_IDS = [
    { value: 'food',        label: t('storeTypeFood') },
    { value: 'physical',    label: t('storeTypePhysical') },
    { value: 'beauty',      label: t('storeTypeBeauty') },
    { value: 'repair',      label: t('storeTypeRepair') },
    { value: 'digital',     label: t('storeTypeDigital') },
    { value: 'restaurant',  label: t('storeTypeRestaurant') },
  ];

  // Color scheme labels — translated
  const COLOR_LABELS: Record<string, string> = {
    light: t('colorLight'),
    dark:  t('colorDark'),
    warm:  t('colorWarm'),
    bold:  t('colorBold'),
  };

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

  // Delete store state
  const [showDelete, setShowDelete]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]         = useState(false);

  const set = <K extends keyof StoreSettingsFormData>(field: K, value: StoreSettingsFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleDelete = async () => {
    if (!store || deleteConfirm !== store.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/dashboard/settings');
      router.refresh();
    } catch {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug && isNew) { setError(t('errorSlug')); return; }
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
        throw new Error(data.error || t('errorSlug'));
      }

      setSuccess(true);
      router.refresh();
      if (isNew) router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorSlug'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-secondary">{t('sectionBasic')}</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">{t('storeName')} *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Môj obchod"
            />
          </div>
          {isNew && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t('slug')} *</label>
              <div className="flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary">
                <span className="pl-4 text-sm text-gray-400">vendshop.shop/</span>
                <input
                  type="text" required value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="flex-1 py-2.5 pr-4 text-sm focus:outline-none"
                  placeholder="moj-obchod"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">{t('slugHint')}</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">{t('description')}</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t('storeType')}</label>
              <select
                value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {TEMPLATE_IDS.map((tmpl) => <option key={tmpl.value} value={tmpl.value}>{tmpl.label}</option>)}
              </select>
            </div>
            <div>
              {/* Shop language is always in native language — customers see this language */}
              <label className="mb-1 block text-sm font-medium text-secondary">{t('language')}</label>
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
        <h2 className="mb-4 font-semibold text-secondary">{t('sectionDesign')}</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">{t('colorScheme')}</label>
            <div className="flex gap-3">
              {COLOR_SCHEMES.map((cs) => (
                <button key={cs.value} type="button" onClick={() => set('colorScheme', cs.value)}
                  className="flex flex-col items-center gap-1.5">
                  <div className={`h-10 w-10 rounded-lg border-2 ${cs.preview} ${
                    form.colorScheme === cs.value ? 'ring-2 ring-primary ring-offset-1' : ''
                  }`} />
                  <span className="text-xs text-gray-500">{COLOR_LABELS[cs.value]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t('currency')}</label>
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
        <h2 className="mb-4 font-semibold text-secondary">{t('sectionContact')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { field: 'phone',     label: t('phone'),     placeholder: '+421 9xx xxx xxx' },
            { field: 'whatsapp',  label: t('whatsapp'),  placeholder: '421912345678' },
            { field: 'instagram', label: t('instagram'), placeholder: 'moj_obchod' },
            { field: 'facebook',  label: t('facebook'),  placeholder: 'MojObchod' },
          ] as const).map(({ field, label, placeholder }) => (
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
            <label className="mb-1 block text-sm font-medium text-secondary">{t('address')}</label>
            <input type="text" value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Hlavná 1, Bratislava" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">{t('openingHours')}</label>
            <input type="text" value={form.openingHours}
              onChange={(e) => set('openingHours', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Po–Pi 9:00–18:00" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">{t('deliveryInfo')}</label>
            <input type="text" value={form.deliveryInfo}
              onChange={(e) => set('deliveryInfo', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="..." />
          </div>
        </div>
      </section>

      {/* Publish */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-secondary">{t('isPublished')}</h2>
            <p className="mt-1 text-sm text-neutral">
              {form.isPublished ? t('publishedStatus') : t('unpublishedStatus')}
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
      {success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{t('success')}</div>}

      <button
        type="submit" disabled={submitting}
        className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? '...' : isNew ? t('saveNew') : t('saveEdit')}
      </button>

      {/* ── Danger Zone (only for existing stores) ── */}
      {!isNew && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="mb-1 font-semibold text-red-700">{t('dangerZone')}</h2>
          <p className="mb-4 text-sm text-red-500">{t('deleteStoreDesc')}</p>

          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              {t('deleteStore')}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{t('deleteConfirm')}</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={store?.name}
                className="w-full rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  ← Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteConfirm !== store?.name || deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {deleting ? t('deleting') : t('deleteConfirmBtn')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </form>
  );
}
