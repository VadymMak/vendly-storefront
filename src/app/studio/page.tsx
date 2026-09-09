import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudioClient from './StudioClient';
import { StudioHeader } from '@/components/layout/StudioHeader';

export const metadata: Metadata = {
  title: 'AI Studio — Create Images & Videos with AI',
  description: 'AI-powered content creation studio. Generate images with Flux, animate with Kling, assemble clips for Instagram and TikTok.',
  openGraph: {
    title: 'AI Studio — Create Images & Videos with AI',
    description: 'AI-powered content creation studio. Generate images with Flux, animate with Kling, assemble clips for Instagram and TikTok.',
    url: 'https://vendshop.shop/studio',
    type: 'website',
  },
};

export default async function StudioPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/studio');
  }

  return (
    <>
      <StudioHeader userEmail={session.user.email ?? ''} />
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
