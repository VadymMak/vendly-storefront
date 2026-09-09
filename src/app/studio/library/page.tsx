import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LibraryGrid } from '@/components/studio/library/LibraryGrid';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <LibraryGrid />;
}
