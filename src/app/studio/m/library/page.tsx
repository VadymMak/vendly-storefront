import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MobileLibrary } from '@/components/studio/mobile/MobileLibrary';

export default async function MobileLibraryPage({ searchParams }: { searchParams: Promise<{ select?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m/library');

  const { select } = await searchParams;
  return <MobileLibrary initialSelect={select === '1'} />;
}
