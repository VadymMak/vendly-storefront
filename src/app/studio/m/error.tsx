'use client';

import { useEffect } from 'react';

export default function MobileStudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch('/api/studio/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack?.slice(0, 2000),
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] px-8 text-center">
      <p className="text-lg font-semibold text-white">Something went wrong</p>
      <p className="text-sm text-gray-400">{error.message}</p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white active:bg-green-700"
      >
        Try again
      </button>
    </div>
  );
}
