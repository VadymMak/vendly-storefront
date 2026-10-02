import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MobileLibrary } from '@/components/studio/mobile/MobileLibrary';

export default async function MobileLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m/library');

  return <MobileLibrary />;
}
