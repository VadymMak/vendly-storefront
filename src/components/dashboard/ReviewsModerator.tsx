'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { DashboardReview, ReviewStatus } from '@/lib/types';

interface Props {
  initialReviews: DashboardReview[];
}

const STATUS_COLORS: Record<ReviewStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100 text-red-700',
};

export default function ReviewsModerator({ initialReviews }: Props) {
  const t = useTranslations('dashboardReviews');
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<ReviewStatus | 'ALL'>('ALL');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = filter === 'ALL' ? reviews : reviews.filter((r) => r.status === filter);

  const updateReview = async (id: string, data: { status?: ReviewStatus; ownerReply?: string | null }) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
        );
        if (data.ownerReply !== undefined) {
          setReplyingId(null);
          setReplyText('');
        }
      }
    } finally {
      setLoading(null);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  };

  const filters: Array<{ key: ReviewStatus | 'ALL'; label: string }> = [
    { key: 'ALL',       label: t('all') },
    { key: 'PENDING',   label: t('pending') },
    { key: 'PUBLISHED', label: t('published') },
    { key: 'REJECTED',  label: t('rejected') },
  ];

  const countByStatus = (s: ReviewStatus) => reviews.filter((r) => r.status === s).length;

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => {
          const count = f.key === 'ALL' ? reviews.length : countByStatus(f.key);
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Reviews list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-neutral">
          {t('noReviews')}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review) => (
            <div
              key={review.id}
              className={`rounded-xl border bg-white p-5 transition-colors ${
                review.status === 'PENDING' ? 'border-yellow-200' : 'border-gray-200'
              }`}
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-secondary">{review.author}</span>
                    {review.authorEmail && (
                      <span className="text-xs text-neutral">{review.authorEmail}</span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[review.status]}`}>
                      {t(review.status.toLowerCase() as 'pending' | 'published' | 'rejected')}
                    </span>
                  </div>
                  {/* Stars */}
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={star <= review.rating ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-neutral">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Review text */}
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{review.text}</p>

              {/* Owner reply */}
              {review.ownerReply && replyingId !== review.id && (
                <div className="mt-3 rounded-lg bg-green-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-green-700">{t('reply')}</p>
                  <p className="text-sm text-green-900">{review.ownerReply}</p>
                </div>
              )}

              {/* Reply form */}
              {replyingId === review.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('replyPlaceholder')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateReview(review.id, { ownerReply: replyText.trim() || null })}
                      disabled={loading === review.id}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t('replySave')}
                    </button>
                    <button
                      onClick={() => { setReplyingId(null); setReplyText(''); }}
                      className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {review.status !== 'PUBLISHED' && (
                  <button
                    onClick={() => updateReview(review.id, { status: 'PUBLISHED' })}
                    disabled={loading === review.id}
                    className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    ✓ {t('publish')}
                  </button>
                )}
                {review.status !== 'REJECTED' && (
                  <button
                    onClick={() => updateReview(review.id, { status: 'REJECTED' })}
                    disabled={loading === review.id}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    ✕ {t('reject')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setReplyingId(review.id);
                    setReplyText(review.ownerReply || '');
                  }}
                  disabled={loading === review.id}
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  💬 {t('reply')}
                </button>
                {review.ownerReply && (
                  <button
                    onClick={() => updateReview(review.id, { ownerReply: null })}
                    disabled={loading === review.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('replyDelete')}
                  </button>
                )}
                <button
                  onClick={() => deleteReview(review.id)}
                  disabled={loading === review.id}
                  className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
