import type { ShopReview } from '@/lib/types';
import type { ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import ReviewForm from './ReviewForm';

interface ReviewsSectionProps {
  reviews: ShopReview[];
  avgRating: number;
  reviewCount: number;
  storeId: string;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export default function ReviewsSection({ reviews, avgRating, reviewCount, storeId, scheme, t }: ReviewsSectionProps) {
  const preview = reviews.slice(0, 3);

  return (
    <section className={`border-t ${scheme.border}`}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header with avg rating */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-2xl font-bold">{t.reviews}</h2>
            {reviewCount > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-lg font-semibold">{avgRating}</span>
                <span className={`text-sm ${scheme.textMuted}`}>
                  ({reviewCount} {t.reviewsCount})
                </span>
              </div>
            )}
          </div>
          <ReviewForm storeId={storeId} scheme={scheme} t={t} />
        </div>

        {/* Reviews list */}
        {preview.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((review) => (
              <div
                key={review.id}
                className={`rounded-xl border ${scheme.border} ${scheme.bgCard} p-5`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{review.author}</span>
                  <StarRating rating={review.rating} size={14} />
                </div>
                <p className={`text-sm leading-relaxed ${scheme.textMuted}`}>
                  {review.text}
                </p>
                {review.ownerReply && (
                  <div className={`mt-3 rounded-lg ${scheme.chipBg} p-3`}>
                    <p className={`mb-1 text-xs font-semibold ${scheme.chipText}`}>
                      {t.ownerReply}
                    </p>
                    <p className="text-sm">{review.ownerReply}</p>
                  </div>
                )}
                <p className={`mt-3 text-xs ${scheme.textMuted}`}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`py-8 text-center ${scheme.textMuted}`}>{t.reviewsEmpty}</p>
        )}

        {/* Show all button */}
        {reviews.length > 3 && (
          <details className="mt-6">
            <summary className={`cursor-pointer text-center text-sm font-medium ${scheme.chipText} hover:underline`}>
              {t.showAllReviews} ({reviews.length})
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(3).map((review) => (
                <div
                  key={review.id}
                  className={`rounded-xl border ${scheme.border} ${scheme.bgCard} p-5`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">{review.author}</span>
                    <StarRating rating={review.rating} size={14} />
                  </div>
                  <p className={`text-sm leading-relaxed ${scheme.textMuted}`}>
                    {review.text}
                  </p>
                  {review.ownerReply && (
                    <div className={`mt-3 rounded-lg ${scheme.chipBg} p-3`}>
                      <p className={`mb-1 text-xs font-semibold ${scheme.chipText}`}>
                        {t.ownerReply}
                      </p>
                      <p className="text-sm">{review.ownerReply}</p>
                    </div>
                  )}
                  <p className={`mt-3 text-xs ${scheme.textMuted}`}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
