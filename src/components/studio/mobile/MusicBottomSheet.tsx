'use client';

import { useTranslations } from 'next-intl';
import type { MusicTrack } from '@/lib/types';

interface MusicBottomSheetProps {
  tracks: MusicTrack[];
  currentTrackId: string;
  previewingId: string | null;
  onSelect: (trackId: string) => void;
  onPreview: (track: MusicTrack) => void;
  onClose: () => void;
}

export default function MusicBottomSheet({
  tracks,
  currentTrackId,
  previewingId,
  onSelect,
  onPreview,
  onClose,
}: MusicBottomSheetProps) {
  const t = useTranslations('mobile.reel');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a2e] rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-white font-semibold text-base">{t('musicTitle')}</h3>
          <button onClick={onClose} className="text-white/50 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Track list */}
        <div className="px-4 pb-4 space-y-1">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => onSelect(track.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                currentTrackId === track.id
                  ? 'bg-green-500/15 border border-green-500/30'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              {/* Radio */}
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                currentTrackId === track.id ? 'border-green-500' : 'border-white/30'
              }`}>
                {currentTrackId === track.id && (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>

              <span className="text-lg shrink-0">{track.emoji}</span>
              <span className="text-white text-sm flex-1 text-left">{track.title}</span>

              {/* Preview button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(track);
                }}
                className="text-white/40 hover:text-white/70 p-1"
                aria-label={previewingId === track.id ? 'Stop preview' : 'Preview track'}
              >
                {previewingId === track.id ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </button>
          ))}

          <div className="border-t border-white/10 my-2" />

          {/* No music option */}
          <button
            onClick={() => onSelect('no-music')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
              currentTrackId === 'no-music'
                ? 'bg-green-500/15 border border-green-500/30'
                : 'bg-white/5 border border-transparent hover:bg-white/10'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              currentTrackId === 'no-music' ? 'border-green-500' : 'border-white/30'
            }`}>
              {currentTrackId === 'no-music' && (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </div>
            <span className="text-lg shrink-0">🔇</span>
            <span className="text-white/60 text-sm flex-1 text-left">{t('noMusic')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
