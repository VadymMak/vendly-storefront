import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import StudioClient from './StudioClient';
import StudioLandingPage from '@/components/studio/StudioLandingPage';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'AI Studio — Free Image & Video Generator for Business | VendShop',
  description: 'Create professional images, videos, and social media content with AI. Free 5 images + 1 video monthly. No design skills needed.',
  openGraph: {
    title: 'AI Studio — Free Image & Video Generator for Business | VendShop',
    description: 'Create professional images, videos, and social media content with AI. Free 5 images + 1 video monthly. No design skills needed.',
    url: 'https://vendshop.shop/studio',
    type: 'website',
  },
};

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
