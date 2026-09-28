import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MobileHome } from '@/components/studio/mobile/MobileHome';

export default async function MobileHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m');
  return <MobileHome userId={session.user.id} />;
}
