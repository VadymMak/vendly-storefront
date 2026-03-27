'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Čaká',       class: 'bg-yellow-100 text-yellow-800' },
  { value: 'PAID',      label: 'Zaplatená',  class: 'bg-green-100 text-green-800' },
  { value: 'SHIPPED',   label: 'Odoslaná',   class: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETED', label: 'Dokončená',  class: 'bg-gray-100 text-gray-700' },
  { value: 'CANCELLED', label: 'Zrušená',    class: 'bg-red-100 text-red-700' },
] as const;

interface OrderStatusBadgeProps {
  orderId: string;
  status: string;
}

export default function OrderStatusBadge({ orderId, status }: OrderStatusBadgeProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentOption = STATUS_OPTIONS.find((s) => s.value === current) || STATUS_OPTIONS[0];

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCurrent(newStatus);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${currentOption.class} hover:opacity-80 disabled:opacity-50`}
      >
        {loading ? '...' : currentOption.label} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateStatus(opt.value)}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                  opt.value === current ? 'font-semibold' : ''
                }`}
              >
                <span className={`inline-block rounded-full px-2 py-0.5 ${opt.class}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
