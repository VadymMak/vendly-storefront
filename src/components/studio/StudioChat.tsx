'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, SessionContext } from '@/lib/studio/types';
import ChatMessageBubble from './ChatMessage';
import SkillPicker from './SkillPicker';

interface Props {
  userId: string;
  userEmail: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your AI Content Creator. Describe what you want to create, or pick a skill below. I can generate images, animate them to video, edit photos, remove backgrounds, and more.",
  timestamp: Date.now(),
};

const SESSION_KEY = 'studio-chat-session';
const MAX_MESSAGES = 30;

export default function StudioChat({ userId, userEmail }: Props) {
  void userId;
  void userEmail;

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [context, setContext] = useState<SessionContext>({
    lastImageUrl: null,
    lastVideoUrl: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { messages?: ChatMessage[]; context?: SessionContext };
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          setContext(parsed.context ?? { lastImageUrl: null, lastVideoUrl: null });
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ messages, context }));
      } catch {
        // ignore quota errors
      }
    }
  }, [messages, context]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const pollVideoJob = useCallback(async (jobId: string, messageId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/studio/job/${jobId}`);
        if (!res.ok) return;

        const data = await res.json() as {
          status?: string;
          output?: string | string[];
        };

        if (data.status === 'succeeded' && data.output) {
          const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: 'Video is ready! 🎬', media: { type: 'video' as const, url: videoUrl }, isLoading: false }
                : m,
            ),
          );
          setContext((prev) => ({ ...prev, lastVideoUrl: videoUrl }));
          return;
        }

        if (data.status === 'failed') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: '⚠️ Video generation failed. Please try again.', isLoading: false }
                : m,
            ),
          );
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: '⚠️ Video generation timed out. Check /studio for status.', isLoading: false }
                : m,
            ),
          );
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      }
    };

    poll();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    if (messages.length >= MAX_MESSAGES) {
      alert('Session limit reached (30 messages). Please start a new session.');
      return;
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const loadingMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          history: messages.filter((m) => m.id !== 'welcome').slice(-6),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json() as {
        message?: string;
        media?: ChatMessage['media'];
        toolUsed?: string;
        jobId?: string;
        context?: SessionContext;
      };

      const agentMsg: ChatMessage = {
        id: loadingMsg.id,
        role: 'assistant',
        content: data.message || '',
        media: data.media || undefined,
        toolUsed: data.toolUsed || undefined,
        timestamp: Date.now(),
      };

      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? agentMsg : m)));

      if (data.context) {
        setContext(data.context);
      }

      if (data.jobId) {
        pollVideoJob(data.jobId, loadingMsg.id);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: loadingMsg.id,
        role: 'assistant',
        content: `Sorry, something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? errorMsg : m)));
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }, [input, isProcessing, messages, context, pollVideoJob]);

  const handleSkillSelect = (skillPrompt: string, _presetId?: string) => {
    setInput(skillPrompt);
    inputRef.current?.focus();
  };

  const handleNewSession = () => {
    setMessages([WELCOME_MESSAGE]);
    setContext({ lastImageUrl: null, lastVideoUrl: null });
    localStorage.removeItem(SESSION_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-[var(--color-text)]">
            AI Content Creator
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {messages.length - 1} / {MAX_MESSAGES} messages
          </span>
        </div>
        <button
          type="button"
          onClick={handleNewSession}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-card)] transition-colors cursor-pointer"
        >
          New Session
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Skill Picker */}
      <SkillPicker onSelect={handleSkillSelect} />

      {/* Input area */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to create..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
            style={{ maxHeight: '120px' }}
            disabled={isProcessing}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

