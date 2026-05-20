import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import StudioClient from './StudioClient';

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { studioPaid: true },
  });

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    }>
      <StudioClient userId={session.user.id} studioPaid={user?.studioPaid ?? false} />
    </Suspense>
  );
}
