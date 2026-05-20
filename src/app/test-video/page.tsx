import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TestVideoClient from './TestVideoClient';

export default async function TestVideoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/test-video');
  return <TestVideoClient userId={session.user.id} />;
}
