import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getTranslations } from 'next-intl/server';
import ReviewsModerator from '@/components/dashboard/ReviewsModerator';

export default async function DashboardReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const store = await db.store.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!store) redirect('/dashboard');

  const reviews = await db.review.findMany({
    where: { storeId: store.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  const t = await getTranslations('dashboardReviews');

  const serialized = reviews.map((r) => ({
    id: r.id,
    author: r.author,
    authorEmail: r.authorEmail,
    rating: r.rating,
    text: r.text,
    status: r.status as 'PENDING' | 'PUBLISHED' | 'REJECTED',
    ownerReply: r.ownerReply,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral">{serialized.length} {t('total')}</p>
      </div>
      <ReviewsModerator initialReviews={serialized} />
    </div>
  );
}
