import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudioHome } from '@/components/studio/home/StudioHome';
import { MobileRedirect } from '@/components/studio/MobileRedirect';

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio');
  return (
    <>
      <Suspense fallback={null}>
        <MobileRedirect />
      </Suspense>
      <StudioHome userId={session.user.id} userEmail={session.user.email ?? ''} />
    </>
  );
}
