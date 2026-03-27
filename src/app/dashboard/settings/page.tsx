import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId } from '@/lib/shop-queries';
import SettingsForm from '@/components/dashboard/SettingsForm';
import AiSetupWizard from '@/components/dashboard/AiSetupWizard';

export const metadata = { title: 'Settings | Dashboard' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ manual?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const store = await getStoreByUserId(session.user.id);
  const params = await searchParams;

  // New store + no ?manual=1 → show AI wizard
  if (!store && params.manual !== '1') {
    return (
      <AiSetupWizard userId={session.user.id} />
    );
  }

  // Existing store or manual mode → regular form
  const t = await getTranslations('dashboardSettings');

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
      <SettingsForm userId={session.user.id} store={store} />
    </div>
  );
}
