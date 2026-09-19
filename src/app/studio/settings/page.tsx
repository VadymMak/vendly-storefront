import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsCanvas } from '@/components/studio/settings/SettingsCanvas';
import { getCreditStatus, isSuperuser } from '@/lib/credits';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [superuser, creditStatus] = await Promise.all([
    isSuperuser(session.user.id),
    getCreditStatus(session.user.id),
  ]);

  return (
    <SettingsCanvas
      userEmail={session.user.email ?? ''}
      isSuperuser={superuser}
      planType={creditStatus.plan}
    />
  );
}
