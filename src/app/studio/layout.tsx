import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudioShellGuard } from '@/components/studio/StudioShellGuard';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio');

  return (
    <StudioShellGuard
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
    >
      {children}
    </StudioShellGuard>
  );
}
