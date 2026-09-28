'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function MobileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('force') === 'desktop') return;

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      window.innerWidth < 768;

    if (isMobile) {
      router.replace('/studio/m');
    }
  }, [router, searchParams]);

  return null;
}
