import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MobileLibrary } from '@/components/studio/mobile/MobileLibrary';

export default async function MobileLibraryPage({ searchParams }: { searchParams: Promise<{ select?: string; mode?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m/library');

  const { select, mode } = await searchParams;
  const initialSelect = select === '1' || mode === 'reel-select';
  return <MobileLibrary initialSelect={initialSelect} reelSelectMode={mode === 'reel-select'} />;
}
