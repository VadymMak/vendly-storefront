import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId } from '@/lib/shop-queries';
import { db } from '@/lib/db';
import SettingsForm from '@/components/dashboard/SettingsForm';
import AiSetupWizard from '@/components/dashboard/AiSetupWizard';

export const metadata = { title: 'Settings | Dashboard' };

type Tab = 'general' | 'design' | 'contact' | 'publishing' | 'danger';
const VALID_TABS: Tab[] = ['general', 'design', 'contact', 'publishing', 'danger'];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ manual?: string; tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [store, user] = await Promise.all([
    getStoreByUserId(session.user.id),
    db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
  ]);
  const params = await searchParams;

  // New store + no ?manual=1 → show AI wizard
  if (!store && params.manual !== '1') {
    return <AiSetupWizard userId={session.user.id} />;
  }

  const t = await getTranslations('dashboardSettings');
  const initialTab = VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'general';

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
      <SettingsForm userId={session.user.id} store={store} initialTab={initialTab} userPlan={user?.plan || 'FREE'} />
    </div>
  );
}
