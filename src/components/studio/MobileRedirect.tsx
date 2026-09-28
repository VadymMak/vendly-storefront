'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function MobileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // If ?force=desktop, save preference and stay
    if (searchParams.get('force') === 'desktop') {
      try { localStorage.setItem('vendshop-prefer-desktop', '1'); } catch {}
      return;
    }

    // If user previously chose desktop, stay
    try {
      if (localStorage.getItem('vendshop-prefer-desktop') === '1') return;
    } catch {}

    // Only redirect on mobile
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      window.innerWidth < 768;

    if (isMobile) {
      router.replace('/studio/m');
    }
  }, [router, searchParams]);

  return null;
}
