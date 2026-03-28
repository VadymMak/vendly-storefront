'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/components/shop/CartContext';
import { CURRENCY_SYMBOLS, COLOR_SCHEMES } from '@/lib/constants';
import type { OrderFormData } from '@/lib/types';

export default function CheckoutPage() {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.split('/')[2] || '';
  const { items, totalPrice, currency, clearCart } = useCart();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

  // Use light scheme as default for client component
  const scheme = COLOR_SCHEMES.light;

  const [form, setForm] = useState<OrderFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Košík je prázdny</h1>
        <p className={`mt-2 ${scheme.textMuted}`}>
          Pridajte produkty do košíka pred objednaním.
        </p>
        <button
          onClick={() => router.push(`/`)}
          className={`mt-6 rounded-lg ${scheme.accent} ${scheme.accentHover} px-6 py-3 font-semibold transition-colors`}
        >
          Späť do obchodu
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map((ci) => ({
            itemId: ci.item.id,
            name: ci.item.name,
            price: ci.item.price,
            quantity: ci.quantity,
          })),
          total: totalPrice,
          ...form,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Chyba pri vytváraní objednávky');
      }

      const { orderId } = await response.json();
      clearCart();
      router.push(`/checkout/success?order=${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Objednávka</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Meno a priezvisko *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className={`w-full rounded-lg border ${scheme.border} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                placeholder="Ján Novák"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                E-mail *
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className={`w-full rounded-lg border ${scheme.border} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                placeholder="jan@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Telefón
              </label>
              <input
                id="phone"
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className={`w-full rounded-lg border ${scheme.border} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                placeholder="+421 9xx xxx xxx"
              />
            </div>

            <div>
              <label htmlFor="note" className="mb-1 block text-sm font-medium">
                Poznámka k objednávke
              </label>
              <textarea
                id="note"
                rows={3}
                value={form.note || ''}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={`w-full rounded-lg border ${scheme.border} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                placeholder="Špeciálne požiadavky, adresa doručenia..."
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`mt-6 w-full rounded-lg ${scheme.accent} ${scheme.accentHover} px-6 py-3 font-semibold transition-colors disabled:opacity-50`}
          >
            {submitting ? 'Odosielam...' : `Objednať za ${totalPrice.toFixed(2)} ${currencySymbol}`}
          </button>
        </form>

        {/* Order summary */}
        <div className={`lg:col-span-2 rounded-xl ${scheme.bgCard} ${scheme.border} border p-4`}>
          <h2 className="mb-3 font-semibold">Zhrnutie</h2>
          <ul className="space-y-3">
            {items.map(({ item, quantity }) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span>
                  {item.name} &times; {quantity}
                </span>
                <span className="font-medium">
                  {((item.price || 0) * quantity).toFixed(2)} {currencySymbol}
                </span>
              </li>
            ))}
          </ul>
          <hr className={`my-3 ${scheme.border}`} />
          <div className="flex items-center justify-between font-bold">
            <span>Spolu</span>
            <span>{totalPrice.toFixed(2)} {currencySymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
