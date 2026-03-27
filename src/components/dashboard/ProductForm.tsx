'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductFormData, ItemType } from '@/lib/types';

interface ProductFormProps {
  storeId: string;
  itemId?: string;
  defaultValues?: Partial<ProductFormData>;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'PRODUCT',   label: 'Produkt' },
  { value: 'SERVICE',   label: 'Služba' },
  { value: 'MENU_ITEM', label: 'Položka menu' },
  { value: 'PORTFOLIO', label: 'Portfólio' },
];

const CURRENCIES = ['EUR', 'CZK', 'UAH', 'USD'];

export default function ProductForm({ storeId, itemId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(itemId);

  const [form, setForm] = useState<ProductFormData>({
    name:        defaultValues?.name        || '',
    description: defaultValues?.description || '',
    price:       defaultValues?.price       || '',
    currency:    defaultValues?.currency    || 'EUR',
    category:    defaultValues?.category    || '',
    type:        defaultValues?.type        || 'PRODUCT',
    isAvailable: defaultValues?.isAvailable ?? true,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ProductFormData, value: string | boolean | ItemType) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const generateAiDescription = async () => {
    if (!form.name) {
      setError('Najprv zadajte názov produktu');
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
      if (!res.ok) throw new Error('AI nedostupné');
      const data = await res.json();
      set('description', data.description);
    } catch {
      setError('AI generovanie zlyhalo');
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
          <label className="mb-1 block text-sm font-medium text-secondary">Typ</label>
          <div className="flex flex-wrap gap-2">
            {ITEM_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('type', t.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  form.type === t.value
                    ? 'bg-primary text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-secondary">
            Názov *
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Napr. Domáci chlieb, Manikúra, Oprava telefónu..."
          />
        </div>

        {/* Description + AI */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="desc" className="text-sm font-medium text-secondary">
              Popis
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
              {aiLoading ? 'Generujem...' : 'AI popis'}
            </button>
          </div>
          <textarea
            id="desc"
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Popis produktu alebo služby..."
          />
        </div>

        {/* Price + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="mb-1 block text-sm font-medium text-secondary">
              Cena
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium text-secondary">
              Mena
            </label>
            <select
              id="currency"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-secondary">
            Kategória
          </label>
          <input
            id="category"
            type="text"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Napr. Pečivo, Nápoje, Doplnky..."
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
            {form.isAvailable ? 'Dostupné' : 'Skryté'}
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
          {submitting ? 'Ukladám...' : isEditing ? 'Uložiť zmeny' : 'Pridať produkt'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Zrušiť
        </button>
      </div>
    </form>
  );
}
