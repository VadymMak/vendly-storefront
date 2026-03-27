'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteItemButtonProps {
  itemId: string;
  itemName: string;
}

export default function DeleteItemButton({ itemId, itemName }: DeleteItemButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Zmazať?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {loading ? '...' : 'Áno'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          Nie
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Zmazať ${itemName}`}
      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
    >
      Zmazať
    </button>
  );
}
