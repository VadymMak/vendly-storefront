'use client';

import { useRef } from 'react';
import type { TextOverlay } from '@/lib/slideshow-renderer';

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

function posYDefault(position: TextOverlay['position']): number {
  if (position === 'top')    return 10;
  if (position === 'bottom') return 80;
  return 50;
}

const HANDLE_CURSORS: Record<HandleType, string> = {
  nw: 'nw-resize', n: 'n-resize',   ne: 'ne-resize',
  e:  'e-resize',  se: 'se-resize', s:  's-resize',
  sw: 'sw-resize', w: 'w-resize',   rotate: 'crosshair',
};

const CORNER_HANDLES: HandleType[] = ['nw', 'ne', 'se', 'sw'];
const ALL_HANDLES:   HandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate'];

interface Props {
  overlay: TextOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange: (x: number, y: number) => void;
  onChange: (updates: Partial<TextOverlay>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function TextFrame({
  overlay,
  isSelected,
  onSelect,
  onPositionChange,
  onChange,
  containerRef,
  children,
}: Props) {
  const frameRef   = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const posX     = overlay.x   ?? 50;
  const posY     = overlay.y   ?? posYDefault(overlay.position);
  const rotation = overlay.rotation ?? 0;

  // ── Move drag ──────────────────────────────────────────────────────────────
  function handleMoveDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const container = containerRef.current;
    const frame     = frameRef.current;
    if (!container || !frame) return;

    const startX = e.clientX, startY = e.clientY;
    const origX = posX, origY = posY;

    function onMove(ev: MouseEvent) {
      if (!container || !frame) return;
      const rect = container.getBoundingClientRect();
      const nx = Math.max(5, Math.min(95, origX + ((ev.clientX - startX) / rect.width)  * 100));
      const ny = Math.max(5, Math.min(95, origY + ((ev.clientY - startY) / rect.height) * 100));
      frame.style.left = `${nx}%`;
      frame.style.top  = `${ny}%`;
    }

    function onUp(ev: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nx = Math.round(Math.max(5, Math.min(95, origX + ((ev.clientX - startX) / rect.width)  * 100)));
      const ny = Math.round(Math.max(5, Math.min(95, origY + ((ev.clientY - startY) / rect.height) * 100)));
      onPositionChange(nx, ny);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // ── Handle drag ────────────────────────────────────────────────────────────
  function handleHandleDown(type: HandleType) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const container = containerRef.current;
      const frame     = frameRef.current;
      const content   = contentRef.current;
      if (!container || !frame || !content) return;

      const containerRect = container.getBoundingClientRect();
      const frameRect     = frame.getBoundingClientRect();
      const cx = frameRect.left + frameRect.width  / 2;
      const cy = frameRect.top  + frameRect.height / 2;

      // Non-null captures for use in closures (TypeScript can't narrow refs inside closures)
      const frameEl:   HTMLDivElement = frame;
      const contentEl: HTMLDivElement = content;

      // ── Rotation ────────────────────────────────────────────────────────────
      if (type === 'rotate') {
        const startAngle    = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        const startRotation = overlay.rotation ?? 0;
        let lastRotation    = startRotation;

        function onMove(ev: MouseEvent) {
          const curAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
          lastRotation   = ((startRotation + (curAngle - startAngle)) % 360 + 360) % 360;
          frameEl.style.transform = `translate(-50%, -50%) rotate(${lastRotation}deg)`;
        }

        function onUp() {
          onChange({ rotation: Math.round(lastRotation) });
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        return;
      }

      // ── Corner resize: scale fontSize by distance ratio ────────────────────
      if (CORNER_HANDLES.includes(type)) {
        const startDist     = Math.hypot(e.clientX - cx, e.clientY - cy);
        const startFontSize = overlay.fontSize ?? 24;
        let lastFontSize    = startFontSize;

        function onMove(ev: MouseEvent) {
          if (startDist < 1) return;
          const scale  = Math.max(0.1, Math.hypot(ev.clientX - cx, ev.clientY - cy) / startDist);
          lastFontSize = Math.round(Math.max(6, Math.min(200, startFontSize * scale)));
          contentEl.style.transform       = `scale(${scale})`;
          contentEl.style.transformOrigin = 'center center';
        }

        function onUp() {
          const newFontSize = lastFontSize;
          onChange({ fontSize: newFontSize });
          requestAnimationFrame(() => {
            contentEl.style.transform = '';
            contentEl.style.transformOrigin = '';
          });
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        return;
      }

      // ── Side handles: e/w → width, n/s → height ───────────────────────────
      const startW = overlay.width  ?? (frameRect.width  / containerRect.width  * 100);
      const startH = overlay.height ?? (frameRect.height / containerRect.height * 100);
      let lastW    = startW, lastH = startH;
      const startMouseX = e.clientX, startMouseY = e.clientY;

      function onMove(ev: MouseEvent) {
        const dx = (ev.clientX - startMouseX) / containerRect.width  * 100;
        const dy = (ev.clientY - startMouseY) / containerRect.height * 100;

        if (type === 'e') {
          lastW = Math.max(5, Math.min(100, startW + dx));
          frameEl.style.width = `${lastW}%`;
        } else if (type === 'w') {
          lastW = Math.max(5, Math.min(100, startW - dx));
          frameEl.style.width = `${lastW}%`;
        } else if (type === 's') {
          lastH = Math.max(5, Math.min(100, startH + dy));
          frameEl.style.height = `${lastH}%`;
        } else if (type === 'n') {
          lastH = Math.max(5, Math.min(100, startH - dy));
          frameEl.style.height = `${lastH}%`;
        }
      }

      function onUp() {
        if (type === 'e' || type === 'w') onChange({ width:  Math.round(lastW) });
        else                               onChange({ height: Math.round(lastH) });
        requestAnimationFrame(() => {
          frameEl.style.width  = '';
          frameEl.style.height = '';
        });
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    };
  }

  // ── Handle styles (positioned relative to frame) ───────────────────────────
  const H = 8; // handle dot size in px
  const off = -(H / 2);

  function handleStyle(type: HandleType): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: H,
      height: H,
      borderRadius: type === 'rotate' ? '50%' : 2,
      backgroundColor: '#ffffff',
      border: '1.5px solid #22c55e',
      cursor: HANDLE_CURSORS[type],
      zIndex: 30,
      pointerEvents: 'auto',
    };

    switch (type) {
      case 'nw':     return { ...base, top: off, left: off };
      case 'n':      return { ...base, top: off, left: '50%', marginLeft: off };
      case 'ne':     return { ...base, top: off, right: off };
      case 'e':      return { ...base, top: '50%', right: off, marginTop: off };
      case 'se':     return { ...base, bottom: off, right: off };
      case 's':      return { ...base, bottom: off, left: '50%', marginLeft: off };
      case 'sw':     return { ...base, bottom: off, left: off };
      case 'w':      return { ...base, top: '50%', left: off, marginTop: off };
      case 'rotate': return {
        ...base,
        top: -(H / 2 + 18),
        left: '50%',
        marginLeft: off,
        backgroundColor: '#22c55e',
        border: '1.5px solid #15803d',
      };
    }
  }

  return (
    <div
      ref={frameRef}
      className="absolute select-none"
      style={{
        left: `${posX}%`,
        top:  `${posY}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex: isSelected ? 20 : 10,
        pointerEvents: 'auto',
        cursor: isSelected ? 'grab' : 'pointer',
        ...(overlay.width  ? { width:  `${overlay.width}%`  } : {}),
        ...(overlay.height ? { height: `${overlay.height}%` } : {}),
        outline: isSelected ? '1.5px solid #22c55e' : undefined,
        outlineOffset: isSelected ? '2px' : undefined,
      }}
      onMouseDown={handleMoveDown}
      onClick={e => { e.stopPropagation(); onSelect(); }}
    >
      {/* Content wrapper (scaled during corner resize preview) */}
      <div
        ref={contentRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          height: '100%',
          minWidth: 'fit-content',
          minHeight: 'fit-content',
        }}
      >
        {children}
      </div>

      {/* Handles: only when selected */}
      {isSelected && (
        <>
          {/* Rotation connector line */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: -14,
              left: '50%',
              marginLeft: -0.5,
              width: 1,
              height: 14,
              backgroundColor: '#22c55e',
              opacity: 0.7,
            }}
          />
          {/* 8 resize + 1 rotate handles */}
          {ALL_HANDLES.map(type => (
            <div
              key={type}
              style={handleStyle(type)}
              onMouseDown={handleHandleDown(type)}
            />
          ))}
        </>
      )}
    </div>
  );
}
