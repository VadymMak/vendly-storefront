'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { ChatMessage, SessionContext } from '@/lib/studio/types';
import { renderSlideshow, DEFAULT_SEQUENCE } from '@/lib/slideshow-renderer';
import type { SlideshowConfig, SlideshowItem, TransitionType, VideoStyle, OnProgress } from '@/lib/slideshow-renderer';
import ChatMessageBubble from './ChatMessage';
import SkillPicker from './SkillPicker';

function isErrorMessage(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return (
    content.includes('⚠️') ||
    content.includes('❌') ||
    lower.includes('sorry, something went wrong') ||
    lower.includes('too many requests') ||
    lower.includes('timed out') ||
    lower.includes('upload failed') ||
    lower.includes('failed:')
  );
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error('Could not load video')); };
    video.src = URL.createObjectURL(file);
  });
}

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  duration?: number;
}

function collectMediaItems(messages: ChatMessage[]): MediaItem[] {
  const items: MediaItem[] = [];
  for (const msg of messages) {
    if (!msg.media?.url) continue;
    const { type, url, duration } = msg.media;

    // Skip rendered clip videos — only collect source media (images + AI-generated videos)
    if (type === 'video' && msg.toolUsed === 'create_clip') {
      console.log(`[collectMedia] Skipping clip video: ${url.slice(0, 60)}`);
      continue;
    }

    if (type === 'image' || type === 'video') {
      items.push({ type, url, duration });
    }
  }
  console.log(`[collectMedia] Found ${items.length} media items from ${messages.length} messages`);
  items.forEach((item, i) => console.log(`  [${i}] ${item.type}: ${item.url}`));

  const uniqueUrls = new Set(items.map((i) => i.url));
  if (uniqueUrls.size < items.length) {
    console.warn(`[collectMedia] ⚠️ DUPLICATE URLs detected! ${items.length} items but only ${uniqueUrls.size} unique URLs`);
  }

  return items;
}

function collectImageUrls(messages: ChatMessage[]): string[] {
  return collectMediaItems(messages).filter((i) => i.type === 'image').map((i) => i.url);
}

function getLatestImageUrl(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].media?.type === 'image' && messages[i].media?.url) {
      return messages[i].media!.url;
    }
  }
  return null;
}

/**
 * Fit image into target dimensions with blurred background fill.
 * Preserves original aspect ratio (contain fit).
 * Empty space is filled with a blurred+darkened version of the same image.
 */
function fitImageToCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): HTMLImageElement {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const targetAspect = targetWidth / targetHeight;

  if (Math.abs(imgAspect - targetAspect) / targetAspect < 0.1) {
    return img;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Blur background at 1/4 resolution — ~60x faster, visually identical
  const BLUR_SCALE = 0.25;
  const blurW = Math.round(targetWidth * BLUR_SCALE);
  const blurH = Math.round(targetHeight * BLUR_SCALE);
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = blurW;
  blurCanvas.height = blurH;
  const blurCtx = blurCanvas.getContext('2d')!;

  let bgW: number, bgH: number, bgX: number, bgY: number;
  if (imgAspect > targetAspect) {
    bgH = blurH;
    bgW = blurH * imgAspect;
    bgX = (blurW - bgW) / 2;
    bgY = 0;
  } else {
    bgW = blurW;
    bgH = blurW / imgAspect;
    bgX = 0;
    bgY = (blurH - bgH) / 2;
  }
  blurCtx.filter = 'blur(8px) brightness(0.4)';
  blurCtx.drawImage(img, bgX, bgY, bgW, bgH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blurCanvas, 0, 0, targetWidth, targetHeight);

  // Foreground: contain-fit at full resolution
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (imgAspect > targetAspect) {
    drawW = targetWidth;
    drawH = targetWidth / imgAspect;
    drawX = 0;
    drawY = (targetHeight - drawH) / 2;
  } else {
    drawH = targetHeight;
    drawW = targetHeight * imgAspect;
    drawX = (targetWidth - drawW) / 2;
    drawY = 0;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const fitted = new Image();
  fitted.src = canvas.toDataURL('image/jpeg', 0.92);
  fitted.width = targetWidth;
  fitted.height = targetHeight;

  return fitted;
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
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  // blob:/data: URLs are local — fetch directly, no proxy needed
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return fetch(url);
  }

  // Relative URLs (same-origin) — fetch directly
  if (url.startsWith('/')) {
    return fetch(url);
  }

  // External HTTPS URLs — use proxy to avoid CORS
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const proxyUrl = `/api/studio/proxy-image?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) return response;

      const errorBody = await response.text().catch(() => '');
      console.warn(`[clip] Proxy attempt ${attempt}/${retries} returned ${response.status}: ${errorBody}`);

      if (response.status < 500 && response.status !== 408) {
        throw new Error(`Proxy error ${response.status}: ${errorBody || response.statusText}`);
      }

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(`Failed after ${retries} proxy attempts (last: ${response.status})`);
    } catch (err) {
      if (attempt < retries && (err instanceof TypeError || (err instanceof Error && err.message.includes('500')))) {
        console.warn(`[clip] Attempt ${attempt}/${retries}: ${err instanceof Error ? err.message : 'error'}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to fetch after all retries');
}

async function loadImageFromUrl(url: string): Promise<{ element: HTMLImageElement; objectUrl: string }> {
  const response = await fetchWithRetry(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve({ element: img, objectUrl });
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to decode image')); };
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
    lastAudioUrl: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [imageQuality, setImageQuality] = useState<'fast' | 'good'>('fast');
  const [imageProvider, setImageProvider] = useState<'flux' | 'grok'>('flux');
  const [ratedMessages, setRatedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { messages?: ChatMessage[]; context?: SessionContext };
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          setContext(parsed.context ?? { lastImageUrl: null, lastVideoUrl: null, lastAudioUrl: null });
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || isProcessing || isUploading) return;

    e.target.value = '';

    const validFiles: { file: File; isVideo: boolean; duration?: number }[] = [];

    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) {
        alert(`Skipped "${file.name}": only image and video files are allowed`);
        continue;
      }

      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`Skipped "${file.name}": ${isVideo ? 'video must be under 100MB' : 'image must be under 10MB'}`);
        continue;
      }

      let videoDuration: number | undefined;
      if (isVideo) {
        try {
          videoDuration = await getVideoDuration(file);
          if (videoDuration > 15) {
            alert(`Skipped "${file.name}": video must be 15 seconds or shorter`);
            continue;
          }
        } catch {
          alert(`Skipped "${file.name}": could not read video`);
          continue;
        }
      }

      validFiles.push({ file, isVideo, duration: videoDuration });
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);

    for (const { file, isVideo, duration } of validFiles) {
      const mediaType = isVideo ? 'video' as const : 'image' as const;
      const localUrl = URL.createObjectURL(file);
      const uploadMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: isVideo ? 'Uploaded video' : 'Uploaded image',
        media: { type: mediaType, url: localUrl, ...(duration !== undefined ? { duration } : {}) },
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
              ? { ...m, media: { type: mediaType, url: data.url, ...(duration !== undefined ? { duration } : {}) } }
              : m,
          ),
        );

        if (isVideo) {
          setContext((prev) => ({ ...prev, lastVideoUrl: data.url }));
        } else {
          setContext((prev) => ({ ...prev, lastImageUrl: data.url }));
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === uploadMsg.id
              ? { ...m, content: `❌ Upload failed: ${err instanceof Error ? err.message : 'error'}`, media: undefined }
              : m,
          ),
        );
      }
    }

    if (validFiles.length > 1) {
      const imgCount = validFiles.filter((f) => !f.isVideo).length;
      const vidCount = validFiles.filter((f) => f.isVideo).length;
      const desc = [
        imgCount > 0 ? `${imgCount} image${imgCount > 1 ? 's' : ''}` : '',
        vidCount > 0 ? `${vidCount} video${vidCount > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(' + ');

      const ackMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `📎 ${desc} uploaded! You can now create a clip, edit them, or ask me anything.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, ackMsg]);
    }

    setIsUploading(false);
  }, [isProcessing, isUploading]);

  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file (MP3, WAV, OGG, M4A)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('Audio file must be under 20MB');
      return;
    }
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
  }, []);

  const removeAudio = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  }, []);

  const handleUseAsReference = useCallback((url: string) => {
    setReferenceImageUrl(url);
    setContext((c) => ({ ...c, lastImageUrl: url }));
  }, []);

  const muxAudioWithVideo = useCallback(async (
    videoUrl: string,
    audioTrack: File,
  ): Promise<string> => {
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error('Failed to fetch video for muxing');
    const videoBlob = await videoResponse.blob();

    const formData = new FormData();
    formData.append('video', videoBlob, 'video.mp4');
    formData.append('audio', audioTrack, audioTrack.name);

    const response = await fetch('/api/studio/mux-audio', { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Mux failed' })) as { error?: string };
      throw new Error(err.error || 'Failed to add music to video');
    }

    const resultBlob = await response.blob();
    return URL.createObjectURL(resultBlob);
  }, []);

  const pollVideoJob = useCallback(async (jobId: string, messageId: string, audioForMux?: File | null) => {
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
            let finalVideoUrl = data.outputUrl!;

            if (audioForMux) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId ? { ...m, content: '🎵 Adding music to video...' } : m,
                ),
              );
              try {
                finalVideoUrl = await muxAudioWithVideo(data.outputUrl!, audioForMux);
                removeAudio();
              } catch (muxErr) {
                console.error('[pollVideoJob] Audio mux failed:', muxErr);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, content: '⚠️ Video ready, but music merge failed. Showing video without audio.' }
                      : m,
                  ),
                );
              }
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: m.content.replace(/⏳[^\n]*|🎵[^\n]*|⚠️[^\n]*/, '✅ Video ready!'),
                      media: { type: 'video' as const, url: finalVideoUrl },
                      isLoading: false,
                    }
                  : m,
              ),
            );
            setContext((prev) => ({ ...prev, lastVideoUrl: finalVideoUrl }));
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
  }, [muxAudioWithVideo, removeAudio]);

  const renderClipInChat = useCallback(async (
    mediaItems: MediaItem[],
    params: Record<string, string | number | boolean>,
    messageId: string,
    audio?: File | null,
  ) => {
    if (mediaItems.length < 1) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: '❌ Upload or generate at least 1 image or video first to create a clip.', isLoading: false }
            : m,
        ),
      );
      return;
    }

  const objectUrlsToCleanup: string[] = [];

  try {
      const imageCount = mediaItems.filter((m) => m.type === 'image').length;
      const videoCount = mediaItems.filter((m) => m.type === 'video').length;
      const itemDesc = [
        imageCount > 0 ? `${imageCount} image${imageCount > 1 ? 's' : ''}` : '',
        videoCount > 0 ? `${videoCount} video${videoCount > 1 ? 's' : ''}` : '',
      ].filter(Boolean).join(' + ');

      console.log(`[clip] Found ${mediaItems.length} media items:`, mediaItems.map((m) => ({ type: m.type, url: m.url.slice(0, 60) })));

      // flushSync forces React to commit DOM synchronously — user sees loading state before heavy work
      flushSync(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `🎬 Loading ${itemDesc}...`, isLoading: true }
              : m,
          ),
        );
      });
      // rAF + setTimeout: wait for browser to actually paint the updated DOM
      await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

      const isSingle = mediaItems.length === 1;

      const platform = (params.platform as string) || 'instagram_reel';
      const outputSize = platform === 'instagram_post'
        ? { width: 1080, height: 1080 }
        : platform === 'cinematic'
          ? { width: 1920, height: 1080 }
          : { width: 1080, height: 1920 };

      const items: SlideshowItem[] = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const media = mediaItems[i];

        if (media.type === 'video') {
          const response = await fetchWithRetry(media.url);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          objectUrlsToCleanup.push(objectUrl);

          const video = document.createElement('video');
          video.preload = 'auto';
          video.muted = true;
          video.playsInline = true;

          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load video')); };
            video.src = objectUrl;
          });

          items.push({
            type: 'video' as const,
            element: video,
            duration: media.duration || video.duration || 5,
          });
        } else {
          const loaded = await loadImageFromUrl(media.url);
          objectUrlsToCleanup.push(loaded.objectUrl);

          // Yield before heavy Canvas work — gives browser a paint opportunity
          await new Promise<void>((r) => requestAnimationFrame(() => r()));

          const fittedImg = fitImageToCanvas(loaded.element, outputSize.width, outputSize.height);

          const readyImg = fittedImg === loaded.element
            ? fittedImg
            : await new Promise<HTMLImageElement>((resolve, reject) => {
                if (fittedImg.complete && fittedImg.naturalWidth > 0) {
                  resolve(fittedImg);
                } else {
                  fittedImg.onload = () => resolve(fittedImg);
                  fittedImg.onerror = () => reject(new Error('Failed to create fitted image'));
                }
              });

          const imgDuration = isSingle
            ? (Number(params.duration) || 5)
            : (Number(params.durationPerImage) || 3);
          items.push({
            type: 'image' as const,
            element: readyImg,
            duration: imgDuration,
            motion: DEFAULT_SEQUENCE[i % DEFAULT_SEQUENCE.length],
          });
        }

        // Force React to paint progress, then yield for browser to render
        flushSync(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: `🎬 Loading ${itemDesc}... (${i + 1}/${mediaItems.length})` }
                : m,
            ),
          );
        });
        await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      }

      // Per-scene color grading — scene_styles: "cinematic,golden-hour,cool-tone" or JSON array
      if (params.scene_styles && items.length > 0) {
        try {
          const raw = params.scene_styles as string;
          const styles: string[] = raw.startsWith('[')
            ? (JSON.parse(raw) as string[])
            : raw.split(',').map((s) => s.trim());

          styles.forEach((s, i) => {
            if (i < items.length && s && s !== 'none') {
              items[i] = { ...items[i], style: s as import('@/lib/slideshow-renderer').VideoStyle };
            }
          });

          console.log('[clip] Scene styles applied:', styles);
        } catch (e) {
          console.warn('[clip] Failed to parse scene_styles:', e);
        }
      }

      // End card — branded final frame on clean background
      if (params.end_card) {
        try {
          const endCard = typeof params.end_card === 'string'
            ? JSON.parse(params.end_card as string)
            : (params.end_card as unknown as Record<string, string | number>);

          const cardOverlays: import('@/lib/slideshow-renderer').TextOverlay[] = [];

          if (endCard.brand) {
            cardOverlays.push({ text: String(endCard.brand), position: 'center', style: 'brand' });
          }
          if (endCard.tagline) {
            cardOverlays.push({ text: String(endCard.tagline), position: 'bottom', style: 'subtitle' });
          }
          if (endCard.cta) {
            cardOverlays.push({ text: String(endCard.cta), position: 'bottom', style: 'cta' });
          }

          items.push({
            type: 'color-card' as const,
            duration: Number(endCard.duration) || 2.5,
            bgColor: String(endCard.bg ?? '#0d0d0d'),
            cardOverlays,
          });

          console.log('[clip] End card added:', endCard);
        } catch (e) {
          console.warn('[clip] Failed to parse end_card:', e);
        }
      }

      // Parse text_overlays — agent sends as JSON string or array
      let textOverlays: import('@/lib/slideshow-renderer').TextOverlay[] | undefined;
      if (params.text_overlays) {
        try {
          textOverlays = typeof params.text_overlays === 'string'
            ? JSON.parse(params.text_overlays)
            : (params.text_overlays as unknown as import('@/lib/slideshow-renderer').TextOverlay[]);
        } catch {
          console.warn('[clip] Failed to parse text_overlays:', params.text_overlays);
        }
      }

      // Watermark -- load image before rendering starts
      let watermark: import('@/lib/slideshow-renderer').WatermarkConfig | undefined;
      if (params.watermark_url) {
        try {
          const wmImg = new Image();
          wmImg.crossOrigin = 'anonymous';
          wmImg.src = params.watermark_url as string;
          await new Promise<void>((resolve) => {
            wmImg.onload  = () => resolve();
            wmImg.onerror = () => resolve(); // fail silently, no watermark
          });
          if (wmImg.naturalWidth > 0) {
            watermark = {
              image:     wmImg,
              position:  ((params.watermark_position as string) || 'bottom-right') as import('@/lib/slideshow-renderer').WatermarkConfig['position'],
              opacity:   params.watermark_opacity ? Number(params.watermark_opacity) : 0.8,
              sizeRatio: params.watermark_size    ? Number(params.watermark_size)    : 0.12,
            };
            console.log('[clip] Watermark loaded:', params.watermark_url);
          }
        } catch (e) {
          console.warn('[clip] Failed to load watermark image:', e);
        }
      }

      const config: SlideshowConfig = {
        items,
        transitionDuration: items.length === 1 ? 0 : 0.8,
        transitionType: (params.transition as TransitionType) || 'fade',
        outputSize,
        fps: 30,
        audioFile: audio ?? undefined,
        style: (params.style as VideoStyle) || 'cinematic',
        textOverlays,
        watermark,
      };

      let lastReportedPct = -1;
      const onProgress: OnProgress = (progress) => {
        const pct = Math.round(progress.percent);
        // Throttle to every 5% — reduces chat re-renders ~13x vs every frame
        if (pct - lastReportedPct < 5 && pct < 100) return;
        lastReportedPct = pct;
        const phase = progress.phase === 'audio' ? 'Mixing audio' : 'Rendering';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `🎬 ${phase}... ${pct}%` }
              : m,
          ),
        );
      };

      console.log(`[clip] Rendering ${config.items.length} items:`, config.items.map((item, i) => ({
        index: i,
        type: item.type,
        duration: item.duration,
        hasElement: !!item.element,
        motion: 'motion' in item ? (item as { motion?: unknown }).motion : undefined,
      })));

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
                content: `✅ Clip ready! ${mediaItems.length} item${mediaItems.length === 1 ? '' : 's'}, ${totalDuration}s total.`,
                media: { type: 'video' as const, url: videoUrl },
                toolUsed: 'create_clip',
                isLoading: false,
              }
            : m,
        ),
      );
      // Clear audio after successful render
      setAudioFile(null);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (audioInputRef.current) audioInputRef.current.value = '';
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const hint = errMsg.includes('fetch')
        ? 'Network issue — please retry. If it keeps failing, try generating the images again.'
        : 'Try Chrome for best compatibility.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `❌ Clip rendering failed: ${errMsg}. ${hint}`,
                isLoading: false,
              }
            : m,
        ),
      );
    } finally {
      objectUrlsToCleanup.forEach((u) => URL.revokeObjectURL(u));
    }
  }, []);

  const sendText = useCallback(async (text: string) => {
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
    setIsProcessing(true);

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          history: messages.filter((m) => m.id !== 'welcome').slice(-6),
          hasAudio: !!audioFile,
          audioFileName: audioFile?.name || null,
          imageQuality,
          imageProvider,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: unknown };
        const errMsg = typeof err.error === 'string' ? err.error : 'Request failed';
        throw new Error(errMsg);
      }

      const data = await res.json() as {
        message?: string;
        media?: ChatMessage['media'];
        toolUsed?: string;
        enhancedPrompt?: string;
        model?: string;
        params?: Record<string, unknown>;
        jobId?: string;
        clipParams?: Record<string, string | number | boolean>;
        comboImages?: string[];
        transformParams?: Record<string, string | number | boolean>;
        context?: SessionContext;
      };

      if (data.toolUsed === 'create_clip') {
        if (data.context) setContext(data.context);
        // Use images from this combo only — prevents including all prior session images
        const clipMediaItems = data.comboImages && data.comboImages.length > 0
          ? data.comboImages.map((url) => ({ type: 'image' as const, url }))
          : collectMediaItems(messages);

        if (clipMediaItems.length === 0) {
          setMessages((prev) => prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, content: '❌ No images or videos found in chat. Generate or upload media first.', isLoading: false }
              : m
          ));
          setIsProcessing(false);
          return;
        }

        const clipParams = data.clipParams ?? { style: 'cinematic', transition: 'fade', durationPerImage: 3, platform: 'instagram_reel' };

        // Cap durationPerImage: Haiku often sends 7 — force max 5 unless user clearly wants more
        const rawDuration = Number(clipParams.durationPerImage) || 3;
        if (rawDuration > 5) {
          console.warn(`[clip] Agent sent durationPerImage=${rawDuration}, capping to 3`);
          clipParams.durationPerImage = 3;
        }

        // Deduplicate: if same URL appears multiple times, keep only unique (upload race condition)
        const seenUrls = new Set<string>();
        const uniqueMediaItems = clipMediaItems.filter((item) => {
          if (seenUrls.has(item.url)) {
            console.warn(`[clip] Duplicate URL removed: ${item.url.slice(-40)}`);
            return false;
          }
          seenUrls.add(item.url);
          return true;
        });

        if (uniqueMediaItems.length < clipMediaItems.length) {
          console.warn(`[clip] Removed ${clipMediaItems.length - uniqueMediaItems.length} duplicate(s). Using ${uniqueMediaItems.length} unique items.`);
        }

        // Auto-use voiceover as audio if no manual audio file uploaded
        // Priority: manual audioFile > lastAudioUrl voiceover > silence
        let clipAudio: File | null = audioFile;
        const voiceoverUrl = data.context?.lastAudioUrl ?? context?.lastAudioUrl ?? null;

        if (!clipAudio && voiceoverUrl) {
          try {
            setMessages((prev) => prev.map((m) =>
              m.id === loadingMsg.id
                ? { ...m, content: '🎙️ Loading voiceover audio...' }
                : m,
            ));
            const res = await fetch(voiceoverUrl);
            const blob = await res.blob();
            clipAudio = new File([blob], 'voiceover.mp3', { type: 'audio/mpeg' });
            console.log('[clip] Auto-using voiceover as audio track:', voiceoverUrl.slice(-60));
          } catch (e) {
            console.warn('[clip] Failed to fetch voiceover audio, rendering without audio:', e);
          }
        }

        setMessages((prev) => prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: clipAudio
                ? (audioFile ? 'Starting clip render with your music...' : 'Starting clip render with voiceover...')
                : (data.message || 'Starting clip render...'), isLoading: true }
            : m,
        ));
        renderClipInChat(uniqueMediaItems, clipParams, loadingMsg.id, clipAudio);
        return;
      }

      if (data.toolUsed === 'transform_image') {
        if (data.context) setContext(data.context);
        console.log('[transform_image] context:', JSON.stringify(context));
        console.log('[transform_image] lastImageUrl:', context?.lastImageUrl);
        const sourceUrl = context?.lastImageUrl || getLatestImageUrl(messages);
        console.log('[transform_image] sourceUrl (after fallback):', sourceUrl);
        if (!sourceUrl) {
          setMessages((prev) => prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, content: '❌ No image in session. Upload or generate an image first.', isLoading: false }
              : m,
          ));
          setIsProcessing(false);
          return;
        }
        const tParams = data.transformParams ?? {};
        const generateBoth = tParams.generate_both === true || tParams.fit_mode === 'both';

        setMessages((prev) => prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: generateBoth ? '🔄 Creating Fill & Fit versions...' : '🔄 Transforming image...', isLoading: true }
            : m,
        ));

        const buildFormData = (blob: Blob, fitMode?: string): FormData => {
          const fd = new FormData();
          fd.append('image', blob, 'image.png');
          if (tParams.preset) fd.append('preset', String(tParams.preset));
          if (tParams.width) fd.append('width', String(tParams.width));
          if (tParams.height) fd.append('height', String(tParams.height));
          if (tParams.quality) fd.append('quality', String(tParams.quality));
          if (tParams.format) fd.append('format', String(tParams.format));
          if (tParams.crop) fd.append('crop', String(tParams.crop));
          if (fitMode) fd.append('fit_mode', fitMode);
          else if (tParams.fit_mode && tParams.fit_mode !== 'both') fd.append('fit_mode', String(tParams.fit_mode));
          return fd;
        };

        const parseInfo = (res: Response, blob: Blob, label?: string): string => {
          const compressionRatio = res.headers.get('X-Compression-Ratio');
          const dimensions = res.headers.get('X-Dimensions');
          const originalSizeBytes = Number(res.headers.get('X-Original-Size') || 0);
          const outputSizeBytes = Number(res.headers.get('X-Output-Size') || 0);
          const lines: string[] = [];
          if (label) lines.push(label);
          if (dimensions) lines.push(`📐 ${dimensions}`);
          if (originalSizeBytes && outputSizeBytes) lines.push(`📦 ${(originalSizeBytes / 1024).toFixed(0)}KB → ${(outputSizeBytes / 1024).toFixed(0)}KB`);
          if (compressionRatio) lines.push(`🗜️ ${compressionRatio} smaller`);
          if (tParams.preset && !label) lines.push(`📱 ${String(tParams.preset).replace(/_/g, ' ')}`);
          void blob;
          return lines.length > 0 ? `\n${lines.join(' | ')}` : '';
        };

        void (async () => {
          try {
            const imgResponse = await fetch(sourceUrl);
            if (!imgResponse.ok) throw new Error('Failed to fetch source image');
            const imgBlob = await imgResponse.blob();

            if (generateBoth) {
              const [resCrop, resFit] = await Promise.all([
                fetch('/api/studio/transform-image', { method: 'POST', body: buildFormData(imgBlob, 'crop') }),
                fetch('/api/studio/transform-image', { method: 'POST', body: buildFormData(imgBlob, 'fit_blur') }),
              ]);
              if (!resCrop.ok || !resFit.ok) throw new Error('One or both transforms failed');

              const [blobCrop, blobFit] = await Promise.all([resCrop.blob(), resFit.blob()]);
              const urlCrop = URL.createObjectURL(blobCrop);
              const urlFit = URL.createObjectURL(blobFit);

              const infoCrop = parseInfo(resCrop, blobCrop, '🔲 Fill');
              const infoFit = parseInfo(resFit, blobFit, '🖼️ Fit');

              // Replace loading msg with Fill version, append Fit version as a new message
              setMessages((prev) => {
                const withCrop = prev.map((m) =>
                  m.id === loadingMsg.id
                    ? { ...m, content: `${data.message || '✅ Here\'s the Fill version:'}${infoCrop}`, media: { type: 'image' as const, url: urlCrop }, isLoading: false }
                    : m,
                );
                const fitMsg: ChatMessage = {
                  id: generateId(),
                  role: 'assistant' as const,
                  content: `🖼️ Here\'s the Fit version (nothing cropped):${infoFit}`,
                  media: { type: 'image' as const, url: urlFit },
                  toolUsed: 'transform_image',
                  timestamp: Date.now(),
                };
                return [...withCrop, fitMsg];
              });
              setContext((c) => ({ ...c, lastImageUrl: urlFit }));
            } else {
              const fitMode = tParams.fit_mode && tParams.fit_mode !== 'both' ? String(tParams.fit_mode) : undefined;
              const res2 = await fetch('/api/studio/transform-image', { method: 'POST', body: buildFormData(imgBlob, fitMode) });
              if (!res2.ok) {
                const err = await res2.json().catch(() => ({ error: 'Transform failed' })) as { error?: string };
                throw new Error(err.error || 'Transform failed');
              }

              const resultBlob = await res2.blob();
              const resultUrl = URL.createObjectURL(resultBlob);
              const infoText = parseInfo(res2, resultBlob);

              setMessages((prev) => prev.map((m) =>
                m.id === loadingMsg.id
                  ? { ...m, content: `${data.message || '✅ Image transformed!'}${infoText}`, media: { type: 'image' as const, url: resultUrl }, isLoading: false }
                  : m,
              ));
              setContext((c) => ({ ...c, lastImageUrl: resultUrl }));
            }
          } catch (err) {
            setMessages((prev) => prev.map((m) =>
              m.id === loadingMsg.id
                ? { ...m, content: `❌ Transform failed: ${err instanceof Error ? err.message : 'Unknown error'}`, isLoading: false }
                : m,
            ));
          } finally {
            setIsProcessing(false);
          }
        })();
        return;
      }

      const agentMsg: ChatMessage = {
        id: loadingMsg.id,
        role: 'assistant',
        content: data.message || '',
        media: data.media || undefined,
        toolUsed: data.toolUsed || undefined,
        enhancedPrompt: data.enhancedPrompt || undefined,
        model: data.model || undefined,
        toolParams: data.params || undefined,
        timestamp: Date.now(),
      };

      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? agentMsg : m)));

      if (data.context) {
        setContext(data.context);
      }

      if (data.jobId) {
        pollVideoJob(data.jobId, loadingMsg.id, audioFile);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: loadingMsg.id,
        role: 'assistant',
        content: `Sorry, something went wrong: ${error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => prev.map((m) => (m.id === loadingMsg.id ? errorMsg : m)));
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }, [audioFile, isProcessing, messages, context, pollVideoJob, renderClipInChat]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    void sendText(text);
  }, [input, sendText]);

  const handleRetry = useCallback(
    (messageIndex: number) => {
      let userText = '';
      let userIdx = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userText = messages[i].content;
          userIdx = i;
          break;
        }
      }
      if (!userText || userIdx === -1) return;

      // Remove failed exchange (user message + error response)
      setMessages((prev) => prev.slice(0, userIdx));

      // Re-send after state update flushes
      setTimeout(() => {
        void sendText(userText);
      }, 50);
    },
    [messages, sendText],
  );

  const handleDeleteMedia = useCallback((messageId: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === messageId ? { ...m, media: undefined } : m,
      );

      // Recalculate context: find the last remaining image, video and audio
      let newLastImageUrl: string | null = null;
      let newLastVideoUrl: string | null = null;
      let newLastAudioUrl: string | null = null;

      for (let i = updated.length - 1; i >= 0; i--) {
        const msg = updated[i];
        if (msg.media?.type === 'image' && !newLastImageUrl) newLastImageUrl = msg.media.url;
        if (msg.media?.type === 'video' && !newLastVideoUrl) newLastVideoUrl = msg.media.url;
        if (msg.media?.type === 'audio' && !newLastAudioUrl) newLastAudioUrl = msg.media.url;
        if (newLastImageUrl && newLastVideoUrl && newLastAudioUrl) break;
      }

      setContext((c) => ({ ...c, lastImageUrl: newLastImageUrl, lastVideoUrl: newLastVideoUrl, lastAudioUrl: newLastAudioUrl }));

      return updated;
    });
  }, []);

  const handleFeedback = useCallback(async (
    messageId: string,
    rating: 'up' | 'down',
    message: ChatMessage,
  ) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    let userPrompt = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userPrompt = messages[i].content;
        break;
      }
    }

    setRatedMessages((prev) => new Set(prev).add(messageId));

    let issue: string | undefined;
    if (rating === 'down') {
      const answer = window.prompt('What went wrong? (optional — helps improve future results)');
      issue = answer || undefined;
    }

    try {
      await fetch('/api/studio/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt,
          enhancedPrompt: message.enhancedPrompt || '',
          tool: message.toolUsed || '',
          model: message.model || '',
          params: message.toolParams || {},
          resultUrl: message.media?.url || '',
          rating,
          issue,
        }),
      });
    } catch {
      // feedback is best-effort, don't un-rate
    }
  }, [messages]);

  const handleSkillSelect = (skillPrompt: string, _presetId?: string) => {
    setInput(skillPrompt);
    inputRef.current?.focus();
  };

  const handleNewSession = () => {
    setMessages([WELCOME_MESSAGE]);
    setContext({ lastImageUrl: null, lastVideoUrl: null, lastAudioUrl: null });
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
        {messages.map((msg, index) => (
          <div key={msg.id}>
            <ChatMessageBubble message={msg} onDeleteMedia={handleDeleteMedia} onUseAsReference={handleUseAsReference} />
            {msg.role === 'assistant' && !msg.isLoading && isErrorMessage(msg.content) && (
              <div className="flex justify-start mt-1.5 pl-1">
                <button
                  type="button"
                  onClick={() => handleRetry(index)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  title="Retry this request"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                  Retry
                </button>
              </div>
            )}
            {msg.role === 'assistant' && msg.media?.url && !msg.isLoading && !isErrorMessage(msg.content) && (
              <div className="flex justify-start mt-1.5 pl-1 gap-1">
                {ratedMessages.has(msg.id) ? (
                  <span className="text-xs text-[var(--color-text-muted)] opacity-60 py-1">
                    Thanks for feedback!
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'up', msg)}
                      className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-green-500/10 hover:text-green-500"
                      title="Good result"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10v12" />
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'down', msg)}
                      className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                      title="Bad result — tell us what went wrong"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 14V2" />
                        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Skill Picker */}
      <SkillPicker onSelect={handleSkillSelect} />

      {/* Input area */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        {referenceImageUrl && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImageUrl} alt="Reference" className="w-6 h-6 rounded object-cover flex-shrink-0" />
            <span className="text-[var(--color-primary)]">🔁 Reference active</span>
            <span className="opacity-60 flex-1">— ask me to &quot;generate in this style&quot;</span>
            <button
              type="button"
              onClick={() => setReferenceImageUrl(null)}
              className="ml-auto text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              title="Remove reference"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {audioFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span className="max-w-[150px] truncate">{audioFile.name}</span>
            <span className="opacity-60">({(audioFile.size / 1024 / 1024).toFixed(1)}MB)</span>
            <button
              type="button"
              onClick={removeAudio}
              className="ml-1 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              title="Remove audio"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {/* Model toolbar: Provider + Quality */}
        <div className="mb-2 flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setImageProvider('flux')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              imageProvider === 'flux'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
            }`}
          >
            Flux
          </button>
          <button
            type="button"
            onClick={() => setImageProvider('grok')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              imageProvider === 'grok'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
            }`}
          >
            Grok ✦
          </button>
          {imageProvider === 'grok' && (
            <span className="text-[10px] text-[var(--color-text-muted)] opacity-60 ml-1">Aurora · BYOK · Free</span>
          )}
          {imageProvider === 'flux' && (
            <>
              <span className="mx-0.5 text-[var(--color-border)] select-none">·</span>
              <button
                type="button"
                onClick={() => setImageQuality('fast')}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  imageQuality === 'fast'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                ⚡ Fast
              </button>
              <button
                type="button"
                onClick={() => setImageQuality('good')}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  imageQuality === 'good'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                ✨ Good
              </button>
              {imageQuality === 'good' && (
                <span className="text-[10px] text-[var(--color-text-muted)] opacity-60 ml-1">Flux Dev · ~15s</span>
              )}
            </>
          )}
        </div>
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
            accept="image/*,video/mp4,video/quicktime"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Music upload button */}
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={isProcessing}
            title="Add music for clip"
            className={`flex-shrink-0 w-10 h-10 rounded-xl border transition-colors cursor-pointer ${
              audioFile
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            } flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
          <input
            ref={audioInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,audio/*"
            onChange={handleAudioUpload}
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

