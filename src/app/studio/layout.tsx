import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudioShell } from '@/components/studio/StudioShell';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio');

  return (
    <StudioShell
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
    >
      {children}
    </StudioShell>
  );
}
