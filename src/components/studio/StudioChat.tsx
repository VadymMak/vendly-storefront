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

    // PHASE 1: Mock response — replaced by /api/studio/chat in Phase 2
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    const mockResponse: ChatMessage = {
      id: loadingMsg.id,
      role: 'assistant',
      content: getMockResponse(text),
      timestamp: Date.now(),
    };

    setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? mockResponse : m)));
    setIsProcessing(false);
    inputRef.current?.focus();
  }, [input, isProcessing, messages.length]);

  const handleSkillSelect = (skillPrompt: string) => {
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

function getMockResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('turntable') || lower.includes('360'))
    return "I'll create a 360° turntable animation. In Phase 2, I'll use Kling v2.1 for this. For now, this is a preview of the chat flow.";
  if (lower.includes('product') || lower.includes('photo'))
    return "I'll generate a professional product photo using Flux Schnell. The prompt will be enhanced automatically for best results. (Agent coming in Phase 2)";
  if (lower.includes('remove') || lower.includes('background'))
    return "I'll remove the background and give you a clean PNG. Just need an image in context first. (Agent coming in Phase 2)";
  if (lower.includes('video') || lower.includes('reel') || lower.includes('animate'))
    return "I'll animate your image into a video. Choose a style: turntable, zoom-in, parallax, or cinematic reveal. (Agent coming in Phase 2)";
  if (lower.includes('upscale') || lower.includes('4k') || lower.includes('hd'))
    return "I'll upscale your image to 4x resolution using Real-ESRGAN. (Agent coming in Phase 2)";
  if (lower.includes('caption') || lower.includes('hashtag') || lower.includes('instagram'))
    return "I'll write an engaging caption with relevant hashtags optimized for Instagram. (Agent coming in Phase 2)";
  return `I understand you want: "${input}". In Phase 2, I'll analyze your request and choose the best tool automatically. For now, try: product photo, turntable video, remove background, upscale, or Instagram caption.`;
}
