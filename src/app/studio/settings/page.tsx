import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsCanvas } from '@/components/studio/settings/SettingsCanvas';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <SettingsCanvas userEmail={session.user.email ?? ''} />;
}
