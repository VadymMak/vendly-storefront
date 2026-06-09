'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, SessionContext } from '@/lib/studio/types';
import { renderSlideshow, DEFAULT_SEQUENCE } from '@/lib/slideshow-renderer';
import type { SlideshowConfig, SlideshowItem, TransitionType, VideoStyle, OnProgress } from '@/lib/slideshow-renderer';
import ChatMessageBubble from './ChatMessage';
import SkillPicker from './SkillPicker';

function collectImageUrls(messages: ChatMessage[]): string[] {
  const urls: string[] = [];
  for (const msg of messages) {
    if (msg.media?.type === 'image' && msg.media.url) {
      urls.push(msg.media.url);
    }
  }
  return urls;
}

/**
 * Load image from URL the SAME WAY as manual mode:
 * fetch → Blob → objectURL → Image element.
 *
 * DO NOT use img.crossOrigin + direct URL — canvas will be tainted
 * and captureStream() will throw SecurityError.
 *
 * Manual mode: File → URL.createObjectURL(file) → img.src = objectUrl
 * Chat mode:   fetch(url) → blob → URL.createObjectURL(blob) → img.src = objectUrl
 * Both produce local objectUrls → canvas stays clean.
 */
async function loadImageFromUrl(url: string): Promise<{ element: HTMLImageElement; objectUrl: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve({ element: img, objectUrl });
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src     = objectUrl;
  });
}

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
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isProcessing || isUploading) return;

    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10MB');
      return;
    }

    setIsUploading(true);

    const localUrl = URL.createObjectURL(file);
    const uploadMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: 'Uploaded image',
      media: { type: 'image', url: localUrl },
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, uploadMsg]);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/studio/upload', { method: 'POST', body: formData });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json() as { url: string };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === uploadMsg.id
            ? { ...m, media: { type: 'image' as const, url: data.url } }
            : m,
        ),
      );

      setContext((prev) => ({ ...prev, lastImageUrl: data.url }));

      const ackMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content:
          'Image uploaded! You can now ask me to: remove background, upscale to 4K, edit it, animate to video, or enhance faces.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, ackMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }, [isProcessing, isUploading]);

  const pollVideoJob = useCallback(async (jobId: string, messageId: string) => {
    const maxPollTime = 10 * 60 * 1000; // 10 min — matches manual flow
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > maxPollTime) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: m.content.replace(
                    /⏳[^\n]*/,
                    '⚠️ Video generation timed out. Check /studio for status.',
                  ),
                  isLoading: false,
                }
              : m,
          ),
        );
        return;
      }

      await new Promise((r) => setTimeout(r, 4000)); // 4s — matches manual flow

      try {
        const res = await fetch(`/api/studio/job/${jobId}`);
        if (!res.ok) continue;

        const data = await res.json() as { status: string; outputUrl?: string; error?: string };

        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') {
          if (data.status === 'succeeded' && data.outputUrl) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: m.content.replace(/⏳[^\n]*/, '✅ Video ready!'),
                      media: { type: 'video' as const, url: data.outputUrl! },
                      isLoading: false,
                    }
                  : m,
              ),
            );
            setContext((prev) => ({ ...prev, lastVideoUrl: data.outputUrl! }));
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: m.content.replace(
                        /⏳[^\n]*/,
                        `❌ Video failed: ${data.error || data.status}`,
                      ),
                      isLoading: false,
                    }
                  : m,
              ),
            );
          }
          return;
        }
      } catch {
        // Network error — retry
      }
    }
  }, []);

  const renderClipInChat = useCallback(async (
    imageUrls: string[],
    params: Record<string, string | number | boolean>,
    messageId: string,
  ) => {
    if (imageUrls.length < 2) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: '❌ Need at least 2 images to create a clip. Generate or upload more images first.', isLoading: false }
            : m,
        ),
      );
      return;
    }

  const objectUrlsToCleanup: string[] = [];

  try {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: `🎬 Loading ${imageUrls.length} images...`, isLoading: true }
            : m,
        ),
      );

      // fetch → blob → objectUrl (identical to manual mode, avoids CORS canvas tainting)
      const loaded = await Promise.all(imageUrls.map(loadImageFromUrl));
      loaded.forEach((l) => objectUrlsToCleanup.push(l.objectUrl));

      const durationPerImage = Number(params.durationPerImage) || 4;
      const items: SlideshowItem[] = loaded.map((l, i) => ({
        type: 'image' as const,
        element: l.element,
        duration: durationPerImage,
        motion: DEFAULT_SEQUENCE[i % DEFAULT_SEQUENCE.length],
      }));

      const platform = (params.platform as string) || 'instagram_reel';
      const outputSize = platform === 'instagram_post'
        ? { width: 1080, height: 1080 }
        : platform === 'cinematic'
          ? { width: 1920, height: 1080 }
          : { width: 1080, height: 1920 };

      const config: SlideshowConfig = {
        items,
        transitionDuration: 0.8,
        transitionType: (params.transition as TransitionType) || 'fade',
        outputSize,
        fps: 30,
        style: (params.style as VideoStyle) || 'cinematic',
      };

      const onProgress: OnProgress = (progress) => {
        const pct = Math.round(progress.percent);
        const phase = progress.phase === 'audio' ? 'Mixing audio' : 'Rendering';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `🎬 ${phase}... ${pct}%` }
              : m,
          ),
        );
      };

      const result = await renderSlideshow(config, onProgress);

      const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('image', new File([result.blob], `clip.${ext}`, { type: result.mimeType }));

      const uploadRes = await fetch('/api/studio/upload', { method: 'POST', body: formData });
      let videoUrl: string;
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json() as { url: string };
        videoUrl = uploadData.url;
      } else {
        videoUrl = URL.createObjectURL(result.blob);
      }

      const totalDuration = items.reduce((sum, it) => sum + it.duration, 0);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `✅ Clip ready! ${imageUrls.length} images, ${totalDuration}s total.`,
                media: { type: 'video' as const, url: videoUrl },
                isLoading: false,
              }
            : m,
        ),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `❌ Clip rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try Chrome for best compatibility.`,
                isLoading: false,
              }
            : m,
        ),
      );
    } finally {
      objectUrlsToCleanup.forEach((u) => URL.revokeObjectURL(u));
    }
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
        clipParams?: Record<string, string | number | boolean>;
        context?: SessionContext;
      };

      // Handle client-side clip rendering
      if (data.toolUsed === 'create_clip') {
        if (data.context) setContext(data.context);
        const imageUrls = collectImageUrls(messages);
        const clipParams = data.clipParams ?? { style: 'cinematic', transition: 'fade', durationPerImage: 4, platform: 'instagram_reel' };
        // Set the agent message first, then start rendering
        setMessages((prev) => prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: data.message || 'Starting clip render...', isLoading: true }
            : m,
        ));
        renderClipInChat(imageUrls, clipParams, loadingMsg.id);
        return;
      }

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
          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isUploading}
            title="Upload image"
            className="flex-shrink-0 w-10 h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isUploading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

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

