'use client';

import { usePathname } from 'next/navigation';
import { StudioShell } from './StudioShell';
import { setStorageUser } from '@/lib/user-storage';

interface Props {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

export function StudioShellGuard({ userId, userEmail, children }: Props) {
  const pathname = usePathname();
  // Before any studio page renders: per-user storage keys (src/lib/user-storage.ts) use this id
  setStorageUser(userId);

  if (pathname === '/studio/m' || pathname.startsWith('/studio/m/')) {
    return <>{children}</>;
  }

  return (
    <StudioShell userId={userId} userEmail={userEmail}>
      {children}
    </StudioShell>
  );
}
