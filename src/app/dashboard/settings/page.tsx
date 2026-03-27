import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getStoreByUserId } from '@/lib/shop-queries';
import SettingsForm from '@/components/dashboard/SettingsForm';

export const metadata = { title: 'Nastavenia | Dashboard' };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const store = await getStoreByUserId(session.user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Nastavenia obchodu</h1>
        <p className="mt-1 text-sm text-neutral">
          {store ? 'Upravte nastavenia vášho obchodu.' : 'Vytvorte váš prvý obchod.'}
        </p>
      </div>
      <SettingsForm userId={session.user.id!} store={store} />
    </div>
  );
}
