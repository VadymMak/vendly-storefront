'use client';

import { useRef } from 'react';
import type { MobileTextLayer } from '@/lib/types';

interface Props {
  layer: MobileTextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onScale: (scale: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function getTouchDistance(t1: Touch | React.Touch, t2: Touch | React.Touch): number {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

export function DraggableTextLayer({ layer, isSelected, onSelect, onMove, onScale, containerRef }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    onSelect();

    // --- PINCH (2 fingers) ---
    if (e.touches.length === 2) {
      const initialDist = getTouchDistance(e.touches[0], e.touches[1]);
      const initialScale = layer.scale ?? 1;

      function handlePinchMove(ev: TouchEvent) {
        ev.preventDefault();
        if (ev.touches.length < 2) return;
        const ratio = getTouchDistance(ev.touches[0], ev.touches[1]) / initialDist;
        onScale(Math.max(0.3, Math.min(4.0, initialScale * ratio)));
      }

      function handlePinchEnd() {
        document.removeEventListener('touchmove', handlePinchMove);
        document.removeEventListener('touchend', handlePinchEnd);
      }

      document.addEventListener('touchmove', handlePinchMove, { passive: false });
      document.addEventListener('touchend', handlePinchEnd);
      return;
    }

    // --- CORNER DRAG or plain DRAG (1 finger) ---
    const touch = e.touches[0];
    const layerEl = layerRef.current;

    if (isSelected && layerEl) {
      const rect = layerEl.getBoundingClientRect();
      const HANDLE_SIZE = 28;
      const isCorner =
        touch.clientX >= rect.right - HANDLE_SIZE &&
        touch.clientY >= rect.bottom - HANDLE_SIZE;

      if (isCorner) {
        const initialDist = Math.hypot(touch.clientX - rect.left, touch.clientY - rect.top);
        const initialScale = layer.scale ?? 1;

        function handleCornerMove(ev: TouchEvent) {
          ev.preventDefault();
          const t = ev.touches[0];
          const currentDist = Math.hypot(t.clientX - rect.left, t.clientY - rect.top);
          const ratio = currentDist / initialDist;
          onScale(Math.max(0.3, Math.min(4.0, initialScale * ratio)));
        }

        function handleCornerEnd() {
          document.removeEventListener('touchmove', handleCornerMove);
          document.removeEventListener('touchend', handleCornerEnd);
        }

        document.addEventListener('touchmove', handleCornerMove, { passive: false });
        document.addEventListener('touchend', handleCornerEnd);
        return;
      }
    }

    // --- DRAG (1 finger, not corner) ---
    const startX = touch.clientX;
    const startY = touch.clientY;
    const origX = layer.x;
    const origY = layer.y;

    function handleTouchMove(ev: TouchEvent) {
      ev.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dx = ev.touches[0].clientX - startX;
      const dy = ev.touches[0].clientY - startY;
      onMove(
        Math.max(0, Math.min(100, origX + (dx / rect.width) * 100)),
        Math.max(0, Math.min(100, origY + (dy / rect.height) * 100)),
      );
    }

    function handleTouchEnd() {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }

  const displayText =
    layer.textTransform === 'uppercase'
      ? layer.text.toUpperCase()
      : layer.textTransform === 'lowercase'
        ? layer.text.toLowerCase()
        : layer.text;

  return (
    <div
      ref={layerRef}
      onTouchStart={handleTouchStart}
      className={`absolute select-none whitespace-pre-wrap ${
        isSelected ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-transparent' : ''
      }`}
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale ?? 1})`,
        fontSize: layer.fontSize,
        fontFamily: `"${layer.fontFamily}", sans-serif`,
        fontWeight: layer.fontWeight,
        color: layer.color,
        textAlign: layer.textAlign,
        opacity: layer.opacity,
        letterSpacing: layer.letterSpacing || undefined,
        textTransform: layer.textTransform === 'none' ? undefined : layer.textTransform,
        backgroundColor: layer.backgroundColor,
        padding: layer.backgroundColor ? (layer.bgPadding ?? 8) : undefined,
        textShadow: layer.shadowColor
          ? `0 0 ${layer.shadowBlur ?? 4}px ${layer.shadowColor}`
          : undefined,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      {displayText}
      {isSelected && (
        <div
          className="absolute -bottom-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/80"
          style={{ touchAction: 'none' }}
          aria-label="Resize"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M11 1v10H1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
