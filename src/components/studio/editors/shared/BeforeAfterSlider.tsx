'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { BeforeAfterSliderProps } from '@/lib/types';

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Result',
  initialPosition = 50,
  alt = '',
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const [loaded, setLoaded] = useState({ before: false, after: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const clamp = (v: number) => Math.min(95, Math.max(5, v));

  const posFromEvent = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return position;
    const rect = el.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * 100);
  }, [position]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setPosition(posFromEvent(e.clientX));
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [posFromEvent]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) setPosition(posFromEvent(touch.clientX));
  }, [posFromEvent]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPosition(p => clamp(p - 5));
    if (e.key === 'ArrowRight') setPosition(p => clamp(p + 5));
  }, []);

  const bothLoaded = loaded.before && loaded.after;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-lg"
      style={{ cursor: 'col-resize' }}
    >
      {/* After image — full width, always visible, provides container height */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={alt}
        draggable={false}
        className="block w-full"
        onLoad={() => {
          console.log('[BeforeAfterSlider] after image loaded:', afterUrl?.slice(0, 80));
          setLoaded(l => ({ ...l, after: true }));
        }}
        onError={() => {
          console.error('[BeforeAfterSlider] after image FAILED:', afterUrl?.slice(0, 80));
          setLoaded(l => ({ ...l, after: true }));
        }}
      />

      {/* Before image — clipped to left portion */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={alt}
          draggable={false}
          className="block w-full"
          onLoad={() => {
            console.log('[BeforeAfterSlider] before image loaded:', beforeUrl?.slice(0, 80));
            setLoaded(l => ({ ...l, before: true }));
          }}
          onError={() => {
            console.error('[BeforeAfterSlider] before image FAILED:', beforeUrl?.slice(0, 80));
            setLoaded(l => ({ ...l, before: true }));
          }}
        />
      </div>

      {/* Loading overlay — shown OVER images until both load */}
      {!bothLoaded && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#0f172a]/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
            <span className="text-xs text-gray-400">Loading comparison…</span>
          </div>
        </div>
      )}

      {/* Divider line */}
      {bothLoaded && (
        <div
          className="absolute bottom-0 top-0 w-0.5 bg-white"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
      )}

      {/* Handle */}
      {bothLoaded && (
        <div
          role="slider"
          aria-label="Comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          tabIndex={0}
          className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          style={{ left: `${position}%` }}
          onMouseDown={onMouseDown}
          onTouchMove={onTouchMove}
          onKeyDown={onKeyDown}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 4l-4 8 4 8M16 4l4 8-4 8" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Labels */}
      {bothLoaded && (
        <>
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
            {beforeLabel}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
            {afterLabel}
          </span>
        </>
      )}
    </div>
  );
}
