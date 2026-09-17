'use client';

interface Props {
  videoUrl:       string;
  prompt?:        string;
  aspectRatio?:   string;
  onClose:        () => void;
  onRegenerate:   () => void;
  onDownload:     () => void;
  onAddToAssemble: () => void;
}

function aspectClass(ar?: string): string {
  switch (ar) {
    case '4:5':  return 'aspect-[4/5]';
    case '1:1':  return 'aspect-square';
    case '9:16': return 'aspect-[9/16]';
    case '16:9': return 'aspect-video';
    default:     return 'aspect-video';
  }
}

export function VideoDetailModal({ videoUrl, prompt, aspectRatio, onClose, onRegenerate, onDownload, onAddToAssemble }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#0d0d14] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/70 transition-colors hover:bg-black/80 hover:text-white"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Video */}
        <div className="flex items-center justify-center bg-black p-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoUrl}
            className={`max-h-[70vh] w-auto ${aspectClass(aspectRatio)} object-contain`}
            controls
            autoPlay
            playsInline
            loop
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 border-t border-white/10 p-4">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Regenerate
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:bg-white/[0.03]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button
            onClick={onAddToAssemble}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:bg-white/[0.03]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
            Add to Assemble
          </button>

          {prompt && (
            <p className="ml-auto max-w-xs truncate text-xs text-gray-500" title={prompt}>{prompt}</p>
          )}
        </div>
      </div>
    </div>
  );
}
