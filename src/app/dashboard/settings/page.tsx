import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId } from '@/lib/shop-queries';
import SettingsForm from '@/components/dashboard/SettingsForm';

export const metadata = { title: 'Settings | Dashboard' };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('dashboardSettings');

  const store = await getStoreByUserId(session.user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">
          {store ? t('titleEdit') : t('titleNew')}
        </h1>
        <p className="mt-1 text-sm text-neutral">
          {store ? t('descEdit') : t('descNew')}
        </p>
      </div>
      <SettingsForm userId={session.user.id!} store={store} />
    </div>
  );
}
