'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { usePathname, useRouter } from 'next/navigation';
import { useStudioStore } from '@/lib/studio/store';
import {
  moveClipWithHistory,
  trimClipWithHistory,
  splitClipWithHistory,
  duplicateClipWithHistory,
  removeClipWithHistory,
  addTextOverlayWithHistory,
} from '@/lib/studio/history-commands';

// ── Icons ────────────────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

interface KbChatWidgetProps {
  userId: string;
}

type NavAction = { path: string; label: string };

type ToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    state: string;
    args: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
};

type TimelineCommandResult = {
  action: 'timeline_command';
  command: string;
  args: Record<string, unknown>;
  message?: string;
};

type MediaGeneratedResult = {
  action: 'media_generated';
  type: 'image' | 'video' | 'audio';
  url: string;
};

function executeTimelineCommand(cmd: TimelineCommandResult) {
  const store = useStudioStore.getState();
  const { command, args } = cmd;

  switch (command) {
    case 'addClipToTrack': {
      const { trackId, clipType, sourceUrl, startTime, duration } = args as {
        trackId: string; clipType: 'video' | 'image' | 'audio' | 'text';
        sourceUrl: string; startTime: number; duration: number;
      };
      store.addClipToTrack(trackId, { type: clipType, sourceUrl, startTime, duration });
      break;
    }
    case 'moveClip':
      moveClipWithHistory(
        args.clipId as string,
        args.newTrackId as string,
        args.newStartTime as number,
      );
      break;
    case 'trimClip':
      trimClipWithHistory(
        args.clipId as string,
        args.newStartTime as number,
        args.newDuration as number,
      );
      break;
    case 'splitClip':
      splitClipWithHistory(args.clipId as string, args.splitTime as number);
      break;
    case 'duplicateClip':
      duplicateClipWithHistory(args.clipId as string);
      break;
    case 'removeClip':
      removeClipWithHistory(args.clipId as string);
      break;
    case 'addTextOverlay': {
      const pos = args.position as string;
      const styleIn = args.style as string;
      const ovStyle: 'brand' | 'subtitle' | 'cta' | 'custom' =
        styleIn === 'title' ? 'brand' : styleIn === 'subtitle' ? 'subtitle' : 'custom';
      const ovPos: 'top' | 'center' | 'bottom' =
        pos === 'top' ? 'top' : pos === 'middle' ? 'center' : 'bottom';
      addTextOverlayWithHistory({
        text: args.text as string,
        position: ovPos,
        style: ovStyle,
        from: args.startTime as number,
        to: (args.startTime as number) + (args.duration as number),
        color: '#ffffff',
      });
      break;
    }
    case 'setPlayhead':
      store.setPlayheadTime?.(args.time as number);
      break;
  }
}

function extractNavActions(parts: { type: string; [k: string]: unknown }[]): NavAction[] {
  return (parts as ToolInvocationPart[])
    .filter(p => p.type === 'tool-invocation' && p.toolInvocation?.state === 'result')
    .map(p => p.toolInvocation.result as Record<string, unknown>)
    .filter(r => r?.action === 'navigate' && typeof r.path === 'string' && typeof r.label === 'string')
    .map(r => ({ path: r.path as string, label: r.label as string }));
}

export default function KbChatWidget({ userId: _userId }: KbChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const executedCommandsRef = useRef<Set<string>>(new Set());

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'kb-chat-session';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  });

  const currentPage = pathname.split('/studio/')[1]?.split('/')[0] || 'home';

  const timelineTracks = useStudioStore(s => s.timelineTracks);

  const getMessageBody = useCallback(() => {
    const base: Record<string, unknown> = {
      currentPage,
      language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    };
    if (currentPage === 'assemble') {
      base.timelineState = { tracks: timelineTracks };
    }
    return base;
  }, [currentPage, timelineTracks]);

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/studio/kb-chat',
      body: { sessionId },
    }),
    [sessionId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Process timeline_command results from assistant messages
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts as unknown as ToolInvocationPart[]) {
        if (
          part.type !== 'tool-invocation' ||
          part.toolInvocation?.state !== 'result' ||
          !part.toolInvocation.result
        ) continue;
        const { toolCallId, result } = part.toolInvocation;
        if (executedCommandsRef.current.has(toolCallId)) continue;
        if ((result as Record<string, unknown>).action === 'timeline_command') {
          executedCommandsRef.current.add(toolCallId);
          try {
            executeTimelineCommand(result as TimelineCommandResult);
          } catch (e) {
            console.error('[KbChatWidget] timeline command failed:', e);
          }
        }
      }
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text }, { body: getMessageBody() });
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, isLoading, sendMessage, getMessageBody]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
    try { sessionStorage.removeItem('kb-chat-session'); } catch { /* ignored */ }
  }, [setMessages]);

  // ── Closed state ─────────────────────────────────────────────────────────

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-500 hover:shadow-green-500/30 hover:scale-105 active:scale-95"
        aria-label="Open help chat"
      >
        <IconChat />
      </button>
    );
  }

  // ── Open state ───────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14] shadow-2xl shadow-black/40 max-[440px]:bottom-0 max-[440px]:right-0 max-[440px]:h-full max-[440px]:w-full max-[440px]:rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0a0f] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400">
            <IconSparkle />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Assistant</h3>
            <p className="text-[10px] text-gray-500">
              {currentPage === 'assemble' ? 'Edit your timeline' : currentPage === 'generate' ? 'Generate & enhance' : currentPage === 'animate' ? 'Animate your visuals' : 'Ask about Studio'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
              aria-label="Clear chat"
              title="New conversation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
            aria-label="Close chat"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Welcome screen */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600/10 text-green-400 mb-3">
              <IconSparkle />
            </div>
            <h4 className="text-sm font-medium text-white mb-1">How can I help?</h4>
            <p className="text-xs text-gray-500 mb-4">
              Ask about credits, tools, pricing, or troubleshooting
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'How do credits work?',
                'What tools are free?',
                'How to remove background?',
                'Compare plans',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    sendMessage({ text: q }, { body: getMessageBody() });
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300 transition-colors hover:border-green-500/30 hover:bg-green-500/10 hover:text-green-400"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, msgIdx) => {
          const text = msg.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('');

          const navActions = msg.role === 'assistant'
            ? extractNavActions(msg.parts as { type: string; [k: string]: unknown }[])
            : [];

          const mediaResults: MediaGeneratedResult[] = msg.role === 'assistant'
            ? (msg.parts as unknown as ToolInvocationPart[])
                .filter(p => p.type === 'tool-invocation' && p.toolInvocation?.state === 'result')
                .map(p => p.toolInvocation.result as Record<string, unknown>)
                .filter(r => r?.action === 'media_generated')
                .map(r => r as unknown as MediaGeneratedResult)
            : [];

          const timelineActions: TimelineCommandResult[] = msg.role === 'assistant'
            ? (msg.parts as unknown as ToolInvocationPart[])
                .filter(p => p.type === 'tool-invocation' && p.toolInvocation?.state === 'result')
                .map(p => p.toolInvocation.result as Record<string, unknown>)
                .filter(r => r?.action === 'timeline_command')
                .map(r => r as unknown as TimelineCommandResult)
            : [];

          if (!text && navActions.length === 0 && mediaResults.length === 0 && timelineActions.length === 0) return null;

          // Get preceding user question for feedback
          const precedingUserMsg = messages.slice(0, msgIdx).reverse().find(m => m.role === 'user');
          const precedingQuestion = precedingUserMsg?.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text).join('') || '';

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-br-md'
                    : 'bg-white/[0.06] text-gray-200 rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <>
                    {text && (
                      <div className="kb-chat-prose">
                        <AssistantMessage content={text} />
                      </div>
                    )}
                    {navActions.length > 0 && (
                      <div className={`flex flex-wrap gap-1.5 ${text ? 'mt-2.5' : ''}`}>
                        {navActions.map((nav, i) => (
                          <button
                            key={i}
                            onClick={() => { router.push(nav.path); setIsOpen(false); }}
                            className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-600/15 px-3 py-1.5 text-[12px] font-medium text-green-400 transition-colors hover:border-green-500/50 hover:bg-green-600/25 hover:text-green-300"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            {nav.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {mediaResults.length > 0 && (
                      <div className={`flex flex-col gap-2 ${text ? 'mt-2.5' : ''}`}>
                        {mediaResults.map((m, i) => (
                          m.type === 'image' ? (
                            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-white/10">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt="Generated" className="w-full h-auto max-h-48 object-cover" />
                            </a>
                          ) : (
                            <div key={i} className="rounded-lg border border-white/10 p-2 text-[11px] text-green-400">
                              {m.type === 'video' ? '🎬' : '🔊'} Generated {m.type} —{' '}
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-300">open</a>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    {timelineActions.length > 0 && (
                      <div className={`flex flex-col gap-1 ${text ? 'mt-2' : ''}`}>
                        {timelineActions.map((cmd, i) => (
                          <div key={i} className="flex items-center gap-1.5 rounded-md bg-green-600/10 border border-green-500/20 px-2 py-1 text-[11px] text-green-400">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {cmd.message ?? cmd.command}
                          </div>
                        ))}
                      </div>
                    )}
                    <FeedbackButtons
                      messageId={msg.id}
                      sessionId={sessionId}
                      question={precedingQuestion}
                      answer={text}
                    />
                  </>
                ) : (
                  <span className="whitespace-pre-wrap">{text}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2.5 text-gray-400">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-400 [animation-delay:0ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-400 [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-[13px] text-red-400">
              Something went wrong.{' '}
              <button
                onClick={() => sendMessage()}
                className="underline hover:text-red-300"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex items-end gap-2 border-t border-white/10 bg-[#0a0a0f] px-3 py-2.5"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/20 max-h-[80px] overflow-y-auto"
          style={{ height: 'auto', minHeight: '36px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 80) + 'px';
          }}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition-all hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-green-600"
          aria-label="Send message"
        >
          <IconSend />
        </button>
      </form>
    </div>
  );
}

// ── FeedbackButtons ───────────────────────────────────────────────────────────

function FeedbackButtons({ messageId, sessionId, question, answer }: {
  messageId: string;
  sessionId: string;
  question: string;
  answer: string;
}) {
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);

  const sendFeedback = async (rating: 'up' | 'down') => {
    setSubmitted(rating);
    try {
      await fetch('/api/studio/kb-chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, sessionId, rating, question, answer }),
      });
    } catch {
      // Feedback is best-effort — ignore errors
    }
  };

  if (submitted) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-600">
        {submitted === 'up' ? '👍' : '👎'} Thanks for feedback
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={() => sendFeedback('up')}
        className="rounded p-0.5 text-gray-600 transition-colors hover:bg-green-500/10 hover:text-green-400"
        aria-label="Helpful"
        title="Helpful"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
        </svg>
      </button>
      <button
        onClick={() => sendFeedback('down')}
        className="rounded p-0.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
        aria-label="Not helpful"
        title="Not helpful"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
          <path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
        </svg>
      </button>
    </div>
  );
}

// ── AssistantMessage — minimal markdown renderer ──────────────────────────────

function AssistantMessage({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n');
        const isList = lines.every(l => /^[\-\*]\s/.test(l.trim()) || l.trim() === '');

        if (isList && lines.some(l => l.trim())) {
          return (
            <ul key={i} className="my-1 ml-3 list-disc space-y-0.5 text-[13px]">
              {lines
                .filter(l => l.trim())
                .map((line, j) => (
                  <li key={j}>
                    <InlineMarkdown text={line.replace(/^[\-\*]\s*/, '')} />
                  </li>
                ))}
            </ul>
          );
        }

        const isNumbered = lines.every(l => /^\d+[\.\)]\s/.test(l.trim()) || l.trim() === '');
        if (isNumbered && lines.some(l => l.trim())) {
          return (
            <ol key={i} className="my-1 ml-3 list-decimal space-y-0.5 text-[13px]">
              {lines
                .filter(l => l.trim())
                .map((line, j) => (
                  <li key={j}>
                    <InlineMarkdown text={line.replace(/^\d+[\.\)]\s*/, '')} />
                  </li>
                ))}
            </ol>
          );
        }

        return (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            <InlineMarkdown text={para} />
          </p>
        );
      })}
    </>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-white/10 px-1 py-0.5 text-[12px] font-mono text-green-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
