import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { GenerateCanvas } from '@/components/studio/generate/GenerateCanvas';

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <GenerateCanvas userId={session.user.id} userEmail={session.user.email ?? ''} />;
}
