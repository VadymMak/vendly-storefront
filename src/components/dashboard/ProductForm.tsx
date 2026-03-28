'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ProductFormData, ItemType } from '@/lib/types';
import ImageUpload from '@/components/ui/ImageUpload';

interface ProductFormProps {
  storeId: string;
  itemId?: string;
  defaultValues?: Partial<ProductFormData>;
}

const CURRENCIES = ['EUR', 'CZK', 'UAH', 'USD'];

const INPUT_CLS = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export default function ProductForm({ storeId, itemId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const t = useTranslations('dashboardProducts');
  const isEditing = Boolean(itemId);

  const ITEM_TYPES: { value: ItemType; label: string }[] = [
    { value: 'PRODUCT',   label: t('typeProduct') },
    { value: 'SERVICE',   label: t('typeService') },
    { value: 'MENU_ITEM', label: t('typeMenu') },
    { value: 'PORTFOLIO', label: t('typePortfolio') },
  ];

  const [form, setForm] = useState<ProductFormData>({
    name:        defaultValues?.name        || '',
    description: defaultValues?.description || '',
    price:       defaultValues?.price       || '',
    currency:    defaultValues?.currency    || 'EUR',
    category:    defaultValues?.category    || '',
    type:        defaultValues?.type        || 'PRODUCT',
    isAvailable: defaultValues?.isAvailable ?? true,
    images:      defaultValues?.images      || [],
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ProductFormData, value: string | boolean | ItemType | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const generateAiDescription = async () => {
    if (!form.name) {
      setError(t('errorAiName'));
      return;
    }
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, type: form.type, category: form.category }),
      });
      if (!res.ok) throw new Error(t('errorAiUnavailable'));
      const data = await res.json();
      set('description', data.description);
    } catch {
      setError(t('errorAiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/products/${itemId}` : '/api/products';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, storeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chyba');
      }

      router.push('/dashboard/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="space-y-5">

        {/* Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary">{t('fieldType')}</label>
          <div className="flex flex-wrap gap-2">
            {ITEM_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => set('type', type.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  form.type === type.value
                    ? 'bg-primary text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Images */}
        <ImageUpload
          images={form.images}
          onChange={(imgs) => set('images', imgs)}
          max={5}
          label={t('fieldImages')}
          hint={t('fieldImagesHint')}
        />

        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-secondary">
            {t('fieldName')} *
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={INPUT_CLS}
            placeholder={t('fieldNamePlaceholder')}
          />
        </div>

        {/* Description + AI */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="desc" className="text-sm font-medium text-secondary">
              {t('fieldDesc')}
            </label>
            <button
              type="button"
              onClick={generateAiDescription}
              disabled={aiLoading}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-medium text-primary hover:bg-green-100 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              {aiLoading ? t('aiGenerating') : t('aiBtn')}
            </button>
          </div>
          <textarea
            id="desc"
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={INPUT_CLS}
            placeholder={t('fieldDescPlaceholder')}
          />
        </div>

        {/* Price + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="mb-1 block text-sm font-medium text-secondary">
              {t('fieldPrice')}
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              className={INPUT_CLS}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium text-secondary">
              {t('fieldCurrency')}
            </label>
            <select
              id="currency"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              className={INPUT_CLS}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-secondary">
            {t('fieldCategory')}
          </label>
          <input
            id="category"
            type="text"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className={INPUT_CLS}
            placeholder={t('fieldCategoryPlaceholder')}
          />
        </div>

        {/* Available toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.isAvailable}
            onClick={() => set('isAvailable', !form.isAvailable)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              form.isAvailable ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              form.isAvailable ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
          <span className="text-sm text-secondary">
            {form.isAvailable ? t('fieldAvailable') : t('fieldUnavailable')}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {submitting ? t('saving') : isEditing ? t('saveEdit') : t('saveNew')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
