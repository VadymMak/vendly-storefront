'use client';

import { usePathname } from 'next/navigation';
import { StudioShell } from './StudioShell';

interface Props {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

export function StudioShellGuard({ userId, userEmail, children }: Props) {
  const pathname = usePathname();

  if (pathname === '/studio/m' || pathname.startsWith('/studio/m/')) {
    return <>{children}</>;
  }

  return (
    <StudioShell userId={userId} userEmail={userEmail}>
      {children}
    </StudioShell>
  );
}
