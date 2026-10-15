import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BrandKitSettings } from '@/components/studio/settings/BrandKitSettings';

export default async function BrandKitSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <BrandKitSettings />;
}
