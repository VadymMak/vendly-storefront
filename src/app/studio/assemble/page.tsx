import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AssembleCanvas } from '@/components/studio/assemble/AssembleCanvas';

export default async function AssemblePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <AssembleCanvas userId={session.user.id} />;
}
