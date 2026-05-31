import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import StudioClient from './StudioClient';
import StudioLandingPage from '@/components/studio/StudioLandingPage';
import Header from '@/components/layout/Header';

export default async function StudioPage() {
  const session = await auth();

  return (
    <>
      <Header />
      {session?.user?.id ? (
        <Suspense fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        }>
          <StudioClient userId={session.user.id} userEmail={session.user.email ?? ''} />
        </Suspense>
      ) : (
        <StudioLandingPage />
      )}
    </>
  );
}
