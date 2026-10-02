'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  beforeUrl: string;
  afterUrl: string;
  /** Override the default "before" / "after" captions */
  beforeLabel?: string;
  afterLabel?: string;
}

const START_POSITION = 50;
const REST_POSITION = 30;

export function BeforeAfterSlider({ beforeUrl, afterUrl, beforeLabel, afterLabel }: Props) {
  const t = useTranslations('mobile.result');
  const beforeText = beforeLabel ?? t('compareLabel');
  const afterText = afterLabel ?? t('resultLabel');
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(START_POSITION);
  const [dragging, setDragging] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string | undefined>();
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef(false);

  // Reveal: slide the divider from 50% to 30% once the result has painted.
  // Scheduled from onLoad; the fallback covers an image that never loads.
  function scheduleReveal(delay: number) {
    if (revealTimer.current) return;
    revealTimer.current = setTimeout(() => {
      if (!touched.current) setPosition(REST_POSITION);
    }, delay);
  }

  useEffect(() => {
    const fallback = setTimeout(() => scheduleReveal(0), 2000);
    return () => {
      clearTimeout(fallback);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, []);

  function moveTo(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    touched.current = true;
    setDragging(true);
    moveTo(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging) moveTo(e.clientX);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  const transition = dragging ? 'none' : 'all 0.5s ease-out';

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-2xl bg-white/[0.04]"
      style={{ aspectRatio: aspectRatio ?? '4 / 5' }}
    >
      {/* After — full image behind */}
      <img
        src={afterUrl}
        alt={afterText}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
          }
          scheduleReveal(150);
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Before — clipped to the left of the divider */}
      <img
        src={beforeUrl}
        alt={beforeText}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)`, transition }}
      />

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-gray-900">
        {beforeText}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-gray-900">
        {afterText}
      </span>

      {/* Divider + handle — 44px-wide drag strip centred on the line */}
      <div
        role="slider"
        aria-label={`${beforeText} / ${afterText}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-y-0 w-11 -translate-x-1/2 cursor-ew-resize"
        style={{ left: `${position}%`, touchAction: 'none', transition }}
      >
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 6 3 12 9 18" />
            <polyline points="15 6 21 12 15 18" />
          </svg>
        </div>
      </div>
    </div>
  );
}
