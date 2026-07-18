'use client';

import type { ChatMessage } from '@/lib/studio/types';

interface Props {
  message: ChatMessage;
  onDeleteMedia?: (messageId: string) => void;
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

export default function ChatMessageBubble({ message, onDeleteMedia }: Props) {
  const isUser = message.role === 'user';

  return (
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.media.url}
                  alt="Generated"
                  className="max-w-full h-auto rounded-lg"
                  loading="lazy"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(message.media!.url, `studio-${Date.now()}.webp`)}
                    className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                  >
                    Download
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
  );
}
