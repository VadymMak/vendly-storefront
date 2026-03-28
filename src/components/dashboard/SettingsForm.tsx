'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ShopData, StoreSettingsFormData } from '@/lib/types';
import ImageUpload from '@/components/ui/ImageUpload';

const LANGUAGES = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'cs', label: 'Čeština' },
  { value: 'uk', label: 'Українська' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

const COLOR_SCHEMES = [
  { value: 'light', preview: 'bg-white border-gray-300' },
  { value: 'dark',  preview: 'bg-gray-900 border-gray-700' },
  { value: 'warm',  preview: 'bg-amber-50 border-amber-200' },
  { value: 'bold',  preview: 'bg-indigo-950 border-indigo-800' },
] as const;

const CURRENCIES = ['EUR', 'CZK', 'UAH', 'USD'];

type Tab = 'general' | 'design' | 'contact' | 'publishing' | 'danger';

interface SettingsFormProps {
  userId: string;
  store: ShopData | null;
  initialTab?: Tab;
}

// ── Icons (inline SVG, no libraries) ─────────────────────────────────────────
function IconGeneral() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}
function IconDesign() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.84 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01a1.49 1.49 0 0 1-.36-.99c0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.97-4.03-9-9-9z" />
    </svg>
  );
}
function IconContact() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconPublish() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function IconDanger() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-secondary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsForm({ userId, store, initialTab = 'general' }: SettingsFormProps) {
  const router = useRouter();
  const t = useTranslations('dashboardSettings');
  const isNew = !store;

  const TEMPLATE_IDS = [
    { value: 'food',        label: t('storeTypeFood') },
    { value: 'physical',    label: t('storeTypePhysical') },
    { value: 'beauty',      label: t('storeTypeBeauty') },
    { value: 'repair',      label: t('storeTypeRepair') },
    { value: 'digital',     label: t('storeTypeDigital') },
    { value: 'restaurant',  label: t('storeTypeRestaurant') },
  ];
  const COLOR_LABELS: Record<string, string> = {
    light: t('colorLight'), dark: t('colorDark'), warm: t('colorWarm'), bold: t('colorBold'),
  };

  const [activeTab, setActiveTab] = useState<Tab>(isNew ? 'general' : initialTab);
  const [form, setForm] = useState<StoreSettingsFormData>({
    name:         store?.name || '',
    description:  store?.description || '',
    shopLanguage: store?.shopLanguage || 'sk',
    colorScheme:  store?.settings.colorScheme || 'light',
    currency:     store?.settings.currency || 'EUR',
    whatsapp:     store?.settings.whatsapp || '',
    instagram:    store?.settings.instagram || '',
    facebook:     store?.settings.facebook || '',
    address:      store?.settings.address || '',
    phone:        store?.settings.phone || '',
    openingHours: store?.settings.openingHours || '',
    deliveryInfo: store?.settings.deliveryInfo || '',
    aboutText:    store?.settings.aboutText || '',
    isPublished:  store?.isPublished ?? false,
    bannerImage:  store?.settings.bannerImage || '',
  });
  const [templateId, setTemplateId] = useState(store?.templateId || 'physical');
  const [slug, setSlug] = useState(store?.slug || '');
  const [logo, setLogo] = useState<string[]>(store?.logo ? [store.logo] : []);
  const [banner, setBanner] = useState<string[]>(store?.settings.bannerImage ? [store.settings.bannerImage] : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof StoreSettingsFormData>(field: K, value: StoreSettingsFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
        body: JSON.stringify({ ...form, templateId, slug, userId, logo: logo[0] || null, bannerImage: banner[0] || null }),
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
    }
  };

  // ── Sidebar nav items ────────────────────────────────────────────────────
  const navItems: { id: Tab; label: string; icon: React.ReactNode; danger?: boolean }[] = [
    { id: 'general',    label: t('sectionBasic'),    icon: <IconGeneral /> },
    { id: 'design',     label: t('sectionDesign'),   icon: <IconDesign /> },
    { id: 'contact',    label: t('sectionContact'),  icon: <IconContact /> },
    { id: 'publishing', label: t('isPublished'),     icon: <IconPublish /> },
    ...(isNew ? [] : [{ id: 'danger' as Tab, label: t('dangerZone'), icon: <IconDanger />, danger: true }]),
  ];

  // ── Save button ──────────────────────────────────────────────────────────
  const SaveButton = () => (
    <div className="mt-8 flex items-center gap-3 border-t border-gray-100 pt-6">
      <button
        type="submit" disabled={submitting}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? '...' : isNew ? t('saveNew') : t('saveEdit')}
      </button>
      {success && (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t('success')}
        </span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );

  return (
    <div className="flex gap-8 min-h-[600px]">
      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0">
        <nav className="sticky top-6 space-y-0.5">
          {navItems.map((item, i) => {
            const isDangerItem = item.danger;
            // Separator before danger zone
            const showSeparator = isDangerItem && navItems.length > 1;
            return (
              <div key={item.id}>
                {showSeparator && <div className="my-3 border-t border-gray-200" />}
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                    activeTab === item.id
                      ? isDangerItem
                        ? 'bg-red-50 text-red-700'
                        : 'bg-accent text-primary'
                      : isDangerItem
                        ? 'text-red-500 hover:bg-red-50 hover:text-red-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-secondary'
                  }`}
                >
                  <span className={activeTab === item.id && !isDangerItem ? 'text-primary' : ''}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Right content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <form onSubmit={handleSubmit}>

          {/* GENERAL */}
          {activeTab === 'general' && (
            <section>
              <SectionHeader title={t('sectionBasic')} />
              <div className="space-y-4">
                {/* Logo upload */}
                <ImageUpload
                  images={logo}
                  onChange={setLogo}
                  single
                  label="Logo obchodu"
                  hint="JPG, PNG alebo WEBP, max 5 MB. Odporúčame štvorec."
                />

                <Field label={`${t('storeName')} *`}>
                  <input
                    type="text" required value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={INPUT_CLS} placeholder="Môj obchod"
                  />
                </Field>
                {isNew && (
                  <Field label={`${t('slug')} *`} hint={t('slugHint')}>
                    <label htmlFor="settings-slug" className="flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary cursor-text">
                      <span className="pl-4 text-sm text-gray-400 select-none">vendshop.shop/</span>
                      <input
                        id="settings-slug"
                        type="text" required value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        className="flex-1 py-2.5 pr-4 text-sm focus:outline-none"
                        placeholder="moj-obchod"
                      />
                    </label>
                  </Field>
                )}
                <Field label={t('description')}>
                  <textarea
                    rows={3} value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    className={INPUT_CLS} placeholder="Krátky popis zobrazený v hero sekcii..."
                  />
                </Field>
                <Field label="O nás" hint="Dlhší text zobrazený v sekcii 'O nás' na stránke obchodu.">
                  <textarea
                    rows={4} value={form.aboutText}
                    onChange={(e) => set('aboutText', e.target.value)}
                    className={INPUT_CLS} placeholder="Napíšte o vašom obchode, histórii, hodnotách..."
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t('storeType')}>
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={INPUT_CLS}>
                      {TEMPLATE_IDS.map((tmpl) => <option key={tmpl.value} value={tmpl.value}>{tmpl.label}</option>)}
                    </select>
                  </Field>
                  <Field label={t('language')}>
                    <select value={form.shopLanguage} onChange={(e) => set('shopLanguage', e.target.value)} className={INPUT_CLS}>
                      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
              <SaveButton />
            </section>
          )}

          {/* DESIGN */}
          {activeTab === 'design' && (
            <section>
              <SectionHeader title={t('sectionDesign')} />
              <div className="space-y-6">
                {/* Banner / hero image */}
                <ImageUpload
                  images={banner}
                  onChange={setBanner}
                  single
                  label={t('bannerImage') || 'Hero / banner obrázok'}
                  hint={t('bannerHint') || 'Širokouhlý obrázok zobrazený v hero sekcii. Odporúčame 1600×600 px.'}
                />

                <Field label={t('colorScheme')}>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {COLOR_SCHEMES.map((cs) => (
                      <button key={cs.value} type="button" onClick={() => set('colorScheme', cs.value)}
                        className="flex flex-col items-center gap-1.5 group">
                        <div className={`h-12 w-12 rounded-xl border-2 transition-all ${cs.preview} ${
                          form.colorScheme === cs.value ? 'ring-2 ring-primary ring-offset-2 border-transparent' : 'group-hover:scale-105'
                        }`} />
                        <span className={`text-xs font-medium ${form.colorScheme === cs.value ? 'text-primary' : 'text-gray-500'}`}>
                          {COLOR_LABELS[cs.value]}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t('currency')}>
                  <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="w-48 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <SaveButton />
            </section>
          )}

          {/* CONTACT */}
          {activeTab === 'contact' && (
            <section>
              <SectionHeader title={t('sectionContact')} />
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  { field: 'phone',     label: t('phone'),     placeholder: '+421 9xx xxx xxx' },
                  { field: 'whatsapp',  label: t('whatsapp'),  placeholder: '421912345678' },
                  { field: 'instagram', label: t('instagram'), placeholder: 'moj_obchod' },
                  { field: 'facebook',  label: t('facebook'),  placeholder: 'MojObchod' },
                ] as const).map(({ field, label, placeholder }) => (
                  <Field key={field} label={label}>
                    <input
                      type="text"
                      value={form[field as keyof StoreSettingsFormData] as string}
                      onChange={(e) => set(field as keyof StoreSettingsFormData, e.target.value)}
                      className={INPUT_CLS} placeholder={placeholder}
                    />
                  </Field>
                ))}
                <div className="sm:col-span-2">
                  <Field label={t('address')}>
                    <input type="text" value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      className={INPUT_CLS} placeholder="Hlavná 1, Bratislava" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t('openingHours')}>
                    <input type="text" value={form.openingHours}
                      onChange={(e) => set('openingHours', e.target.value)}
                      className={INPUT_CLS} placeholder="Po–Pi 9:00–18:00" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t('deliveryInfo')}>
                    <input type="text" value={form.deliveryInfo}
                      onChange={(e) => set('deliveryInfo', e.target.value)}
                      className={INPUT_CLS} placeholder="..." />
                  </Field>
                </div>
              </div>
              <SaveButton />
            </section>
          )}

          {/* PUBLISHING */}
          {activeTab === 'publishing' && (
            <section>
              <SectionHeader title={t('isPublished')} />
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-secondary">{t('isPublished')}</p>
                    <p className="mt-0.5 text-sm text-neutral">
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
              </div>
              {store && (
                <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  🔗 <span className="font-medium text-secondary">{store.slug}.vendshop.shop</span>
                  {' '}—{' '}
                  {form.isPublished
                    ? <span className="text-green-600">visible to customers</span>
                    : <span className="text-gray-400">hidden (draft)</span>
                  }
                </div>
              )}
              <SaveButton />
            </section>
          )}

          {/* DANGER ZONE */}
          {activeTab === 'danger' && !isNew && (
            <section>
              <SectionHeader
                title={t('dangerZone')}
                subtitle={t('deleteStoreDesc')}
                danger
              />
              <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium text-secondary">{t('deleteStore')}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{t('deleteStoreDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); }}
                    className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {t('deleteStore')}
                  </button>
                </div>
              </div>
            </section>
          )}

        </form>
      </div>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {showDeleteModal && store && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
          />
          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-secondary">{t('deleteStore')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('deleteStoreDesc')}</p>
              </div>
            </div>

            {/* Confirmation input */}
            <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm text-gray-600">{t('deleteConfirm')}</p>
              <p className="mb-3 rounded border border-gray-200 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-secondary inline-block">
                {store.name}
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={store.name}
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirm !== store.name || deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? t('deleting') : t('deleteConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, danger }: { title: string; subtitle?: string; danger?: boolean }) {
  return (
    <div className={`mb-6 border-b pb-4 ${danger ? 'border-red-100' : 'border-gray-100'}`}>
      <h2 className={`text-lg font-semibold ${danger ? 'text-red-700' : 'text-secondary'}`}>{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
