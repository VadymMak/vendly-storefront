import type { Metadata, Viewport } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MobileStudioShell } from '@/components/studio/mobile/MobileStudioShell';

export const metadata: Metadata = {
  title: 'VendShop Studio',
  description: 'Create content for your business',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
};

export default async function MobileStudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m');

  return (
    <MobileStudioShell
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
    >
      {children}
    </MobileStudioShell>
  );
}
