'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 text-center text-white">
      <div className="mb-4 text-4xl">📡</div>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-gray-400">
        Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full bg-green-600 px-6 py-2.5 text-sm font-medium text-white"
      >
        Retry
      </button>
    </div>
  );
}
