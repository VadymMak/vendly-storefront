'use client';

import type { ChatMessage } from '@/lib/studio/types';

interface Props {
  message: ChatMessage;
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

export default function ChatMessageBubble({ message }: Props) {
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
                  <a
                    href={message.media.url}
                    download
                    className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors"
                  >
                    Download
                  </a>
                </div>
              </div>
            )}

            {message.media?.type === 'video' && (
              <div className="mt-2 rounded-lg overflow-hidden">
                <video
                  src={message.media.url}
                  controls
                  className="max-w-full rounded-lg"
                  playsInline
                />
                <div className="flex gap-2 mt-2">
                  <a
                    href={message.media.url}
                    download
                    className="text-xs px-2 py-1 rounded bg-black/10 hover:bg-black/20 transition-colors"
                  >
                    Download MP4
                  </a>
                </div>
              </div>
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
