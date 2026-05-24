import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudioClient from './StudioClient';
import Header from '@/components/layout/Header';

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio');

  return (
    <>
      <Header />
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      }>
        <StudioClient userId={session.user.id} userEmail={session.user.email ?? ''} />
      </Suspense>
    </>
  );
}
