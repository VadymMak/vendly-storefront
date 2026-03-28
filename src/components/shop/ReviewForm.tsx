'use client';

import { useState } from 'react';
import type { ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';

interface ReviewFormProps {
  storeId: string;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function ReviewForm({ storeId, scheme, t }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'spam'>('idle');

  const handleSubmit = async () => {
    if (!author.trim() || !rating || !text.trim()) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          author: author.trim(),
          authorEmail: email.trim() || undefined,
          rating,
          text: text.trim(),
        }),
      });

      if (res.status === 429) {
        setStatus('spam');
        return;
      }

      if (!res.ok) throw new Error();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const reset = () => {
    setAuthor('');
    setEmail('');
    setRating(0);
    setText('');
    setStatus('idle');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${scheme.accent} ${scheme.accentHover}`}
      >
        {t.leaveReview}
      </button>

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

            {status === 'success' ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
                <p className="text-sm text-gray-600">{t.reviewThanks}</p>
                <button
                  onClick={reset}
                  className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium hover:bg-gray-200"
                >
                  OK
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">{t.leaveReview}</h3>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Star rating */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.reviewRating} *</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="p-0.5"
                        >
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill={star <= (hoverRating || rating) ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className={`transition-colors ${
                              star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t.reviewName} *</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      maxLength={100}
                    />
                  </div>

                  {/* Email (optional) */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t.reviewEmail}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Text */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t.reviewText} *</label>
                    <textarea
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      maxLength={2000}
                    />
                  </div>

                  {/* Error messages */}
                  {status === 'error' && (
                    <p className="text-sm text-red-600">{t.reviewError}</p>
                  )}
                  {status === 'spam' && (
                    <p className="text-sm text-red-600">{t.reviewSpam}</p>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!author.trim() || !rating || !text.trim() || status === 'loading'}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                  >
                    {status === 'loading' ? '...' : t.reviewSubmit}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
