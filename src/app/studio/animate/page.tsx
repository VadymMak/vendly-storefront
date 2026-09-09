import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AnimateCanvas } from '@/components/studio/animate/AnimateCanvas';

export default async function AnimatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    }>
      <AnimateCanvas userId={session.user.id} userEmail={session.user.email ?? ''} />
    </Suspense>
  );
}
