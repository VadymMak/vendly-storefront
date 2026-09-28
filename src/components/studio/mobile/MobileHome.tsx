'use client';

import Link from 'next/link';
import { useStudioStore } from '@/lib/studio/store';
import { QuickActionGrid } from './QuickActionGrid';

interface Props {
  userId: string;
}

export function MobileHome({ userId: _userId }: Props) {
  const generatedImages = useStudioStore(s => s.generatedImages);
  const recent = generatedImages.slice(0, 10);

  return (
    <div className="flex flex-col gap-6 py-5">
      {/* Hero greeting */}
      <div className="px-4">
        <h1 className="text-lg font-bold text-white">Create content</h1>
        <p className="mt-0.5 text-sm text-gray-500">for your business</p>
      </div>

      {/* Quick actions grid */}
      <QuickActionGrid />

      {/* Recent creations */}
      {recent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-sm font-semibold text-white">Recent</h2>
            <Link href="/studio/m/library" className="text-xs text-green-500">
              See all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1">
            {recent.map((item) => (
              <div
                key={item.id}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
              >
                {item.type === 'video' ? (
                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.url}
                    alt={item.prompt ?? 'Generated image'}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop studio link */}
      <div className="px-4 pb-4 text-center">
        <Link
          href="/studio?force=desktop"
          className="text-xs text-gray-500 underline underline-offset-2"
        >
          Use desktop studio →
        </Link>
      </div>
    </div>
  );
}
