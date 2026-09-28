'use client';

import { useRef } from 'react';
import type { MobileTextLayer } from '@/lib/types';

interface Props {
  layer: MobileTextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function DraggableTextLayer({ layer, isSelected, onSelect, onMove, containerRef }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    onSelect();

    const touch = e.touches[0];
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
      const newX = origX + (dx / rect.width) * 100;
      const newY = origY + (dy / rect.height) * 100;
      onMove(
        Math.max(0, Math.min(100, newX)),
        Math.max(0, Math.min(100, newY)),
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
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
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
    </div>
  );
}
