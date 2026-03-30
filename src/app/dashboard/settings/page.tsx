import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId, getUserPlan } from '@/lib/shop-queries';
import { db } from '@/lib/db';
import SettingsForm from '@/components/dashboard/SettingsForm';
import AiSetupWizard from '@/components/dashboard/AiSetupWizard';
import type { ShopItem, ItemType } from '@/lib/types';

export const metadata = { title: 'Settings | Dashboard' };

type Tab = 'general' | 'design' | 'contact' | 'promo' | 'categories' | 'advisor' | 'publishing' | 'danger';
const VALID_TABS: Tab[] = ['general', 'design', 'contact', 'promo', 'categories', 'advisor', 'publishing', 'danger'];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ manual?: string; tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [store, userPlan] = await Promise.all([
    getStoreByUserId(session.user.id),
    getUserPlan(session.user.id),
  ]);
  const params = await searchParams;

  // New store + no ?manual=1 → show AI wizard
  if (!store && params.manual !== '1') {
    return <AiSetupWizard userId={session.user.id} />;
  }

  const t = await getTranslations('dashboardSettings');
  const initialTab = VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'general';
  const isAdmin = !!(process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL);

  // Fetch items and category count for Store Advisor
  let items: ShopItem[] = [];
  let categoryCount = 0;
  if (store) {
    const [rawItems, catGroups] = await Promise.all([
      db.item.findMany({
        where: { storeId: store.id },
        select: {
          id: true, type: true, name: true, description: true,
          price: true, currency: true, category: true, images: true,
          isAvailable: true, sortOrder: true, metadata: true,
        },
      }),
      db.item.groupBy({
        by: ['category'],
        where: { storeId: store.id, category: { not: null } },
      }),
    ]);
    items = rawItems.map((i) => ({
      ...i,
      type: i.type as ItemType,
      metadata: (i.metadata as Record<string, unknown>) ?? null,
    }));
    categoryCount = catGroups.length;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary">
          {store ? t('titleEdit') : t('titleNew')}
        </h1>
        <p className="mt-1 text-sm text-neutral">
          {store ? t('descEdit') : t('descNew')}
        </p>
      </div>
      <SettingsForm
        userId={session.user.id}
        store={store}
        items={items}
        categoryCount={categoryCount}
        initialTab={initialTab}
        userPlan={userPlan}
        isAdmin={isAdmin}
      />
    </div>
  );
}
