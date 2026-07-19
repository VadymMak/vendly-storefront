'use client';

import { useState, useEffect } from 'react';
import type { ChatMessage } from '@/lib/studio/types';

interface Props {
  message: ChatMessage;
  onDeleteMedia?: (messageId: string) => void;
  onUseAsReference?: (url: string) => void;
}

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

const handleDownload = async (url: string, filename: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
};

export default function ChatMessageBubble({ message, onDeleteMedia, onUseAsReference }: Props) {
  const isUser = message.role === 'user';
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  return (
    <>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[var(--color-primary)] text-white rounded-br-md'
              : 'bg-[var(--color-card)] text-[var(--color-text)] rounded-bl-md'
          }`}
        >
          {message.toolUsed && (
            <div
              className={`text-xs font-medium mb-1 ${
                isUser ? 'text-white/70' : 'text-[var(--color-primary)]'
              }`}
            >
              {message.toolUsed}
            </div>
          )}

          {message.isLoading ? (
            <LoadingDots />
          ) : (
            <>
              {message.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              )}

              {message.media?.type === 'image' && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="relative block w-full cursor-zoom-in group rounded-lg overflow-hidden"
                    onClick={() => setLightboxUrl(message.media!.url)}
                    aria-label="View full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.media.url}
                      alt="Generated"
                      className="max-w-full h-auto rounded-lg"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-end justify-center pb-3">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                        🔍 Click to view full size
                      </span>
                    </div>
                  </button>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleDownload(message.media!.url, `studio-${Date.now()}.webp`)}
                      className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                    >
                      Download
                    </button>
                    {onUseAsReference && (
                      <button
                        type="button"
                        onClick={() => onUseAsReference(message.media!.url)}
                        className="text-xs px-2 py-1 rounded bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] transition-colors cursor-pointer"
                        title="Use this image as visual reference for the next generation"
                      >
                        🔁 Use as reference
                      </button>
                    )}
                    {onDeleteMedia && (
                      <button
                        type="button"
                        onClick={() => onDeleteMedia(message.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}

              {message.media?.type === 'video' && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <div className="relative">
                    <video
                      src={message.media.url}
                      controls
                      className="max-w-full rounded-lg"
                      playsInline
                      preload="metadata"
                    />
                    {message.media.duration && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white pointer-events-none">
                        ▶ {Math.round(message.media.duration)}s
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(message.media!.url, `studio-${Date.now()}.mp4`)}
                      className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                    >
                      Download MP4
                    </button>
                    {onDeleteMedia && (
                      <button
                        type="button"
                        onClick={() => onDeleteMedia(message.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}

              {message.media?.type === 'audio' && (
                <div className="mt-2 rounded-lg overflow-hidden bg-black/10 p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">🎙️ Voiceover audio</p>
                  <audio
                    src={message.media.url}
                    controls
                    className="w-full"
                    preload="metadata"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(message.media!.url, `voiceover-${Date.now()}.mp3`)}
                      className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                    >
                      Download MP3
                    </button>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(message.media!.url)}
                      className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                    >
                      Copy URL
                    </button>
                  </div>
                </div>
              )}

              {!isUser && message.enhancedPrompt && (
                <details className="mt-2 group">
                  <summary className="text-[10px] text-[var(--color-text-muted)] cursor-pointer select-none list-none flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors">
                    <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                    ✨ Enhanced prompt
                  </summary>
                  <p className="mt-1 text-[10px] font-mono leading-relaxed text-[var(--color-text-muted)] bg-black/10 rounded-lg px-2 py-1.5 whitespace-pre-wrap break-words">
                    {message.enhancedPrompt}
                  </p>
                </details>
              )}
            </>
          )}

          <div
            className={`text-[10px] mt-1 ${
              isUser ? 'text-white/50' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close preview"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 select-none">
            Press Esc or click outside to close
          </div>
        </div>
      )}
    </>
  );
}
