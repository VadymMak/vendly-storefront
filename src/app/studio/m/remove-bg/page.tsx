import Link from 'next/link';

export default function RemoveBgPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-semibold text-white">Coming soon</p>
      <p className="text-sm text-gray-500">This feature is being built.</p>
      <Link href="/studio/m" className="text-sm text-green-500 underline">
        ← Back to Home
      </Link>
    </div>
  );
}
