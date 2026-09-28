'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { loadGoogleFont } from '@/lib/fonts/font-loader';
import { proxyUrl } from '@/lib/studio/mobile/share';
import type { MobileTextLayer } from '@/lib/types';
import { DraggableTextLayer } from './DraggableTextLayer';
import { TextStylePanel } from './TextStylePanel';

interface Props {
  imageUrl: string;
  onDone: (compositedUrl: string) => void;
  onCancel: () => void;
}

// iOS Safari refuses canvases above 16,777,216 px (toBlob returns null) — stay safely below
const MAX_CANVAS_PIXELS = 16_000_000;

function makeLayer(): MobileTextLayer {
  return {
    id: `txt-${Date.now()}`,
    text: 'Your text',
    x: 50,
    y: 50,
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    rotation: 0,
    opacity: 1,
    textTransform: 'none',
    letterSpacing: 0,
    scale: 1,
  };
}

export function MobileTextOverlayEditor({ imageUrl, onDone, onCancel }: Props) {
  const t = useTranslations('mobile.textEditor');
  const [layers, setLayers] = useState<MobileTextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function addLayer() {
    const layer = makeLayer();
    setLayers(prev => [...prev, layer]);
    setSelectedId(layer.id);
    setIsPanelOpen(true);
  }

  function updateLayer(id: string, updates: Partial<MobileTextLayer>) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }

  function deleteLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id));
    setSelectedId(null);
    setIsPanelOpen(false);
  }

  function handleDeselect(e: React.TouchEvent) {
    if (e.target === e.currentTarget) {
      setSelectedId(null);
      setIsPanelOpen(false);
    }
  }

  async function exportComposite() {
    setExporting(true);
    setExportError(false);
    try {
      // Ensure all fonts are loaded before drawing
      await Promise.all(
        layers.map(l => loadGoogleFont(l.fontFamily, l.fontWeight === 'bold' ? 700 : 400).catch(() => {}))
      );

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = proxyUrl(imageUrl);
      });

      // Downscale oversized sources (e.g. Upscale 4x) so the canvas stays within iOS limits
      const srcPixels = img.naturalWidth * img.naturalHeight;
      const fit = srcPixels > MAX_CANVAS_PIXELS ? Math.sqrt(MAX_CANVAS_PIXELS / srcPixels) : 1;

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(img.naturalWidth * fit);
      canvas.height = Math.floor(img.naturalHeight * fit);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const containerW = containerRef.current?.clientWidth ?? 350;
      const scale = canvas.width / containerW;

      for (const layer of layers) {
        const x = (layer.x / 100) * canvas.width;
        const y = (layer.y / 100) * canvas.height;
        const scaledFontSize = layer.fontSize * scale * (layer.scale ?? 1);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.globalAlpha = layer.opacity;

        const displayText =
          layer.textTransform === 'uppercase'
            ? layer.text.toUpperCase()
            : layer.textTransform === 'lowercase'
              ? layer.text.toLowerCase()
              : layer.text;

        ctx.font = `${layer.fontWeight} ${scaledFontSize}px "${layer.fontFamily}"`;
        ctx.textAlign = layer.textAlign;
        ctx.textBaseline = 'middle';

        if (layer.letterSpacing) {
          const ctxWithSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
          if (ctxWithSpacing.letterSpacing !== undefined) {
            ctxWithSpacing.letterSpacing = `${layer.letterSpacing * scale * (layer.scale ?? 1)}px`;
          }
        }

        if (layer.backgroundColor) {
          const metrics = ctx.measureText(displayText);
          const pad = (layer.bgPadding ?? 8) * scale * (layer.scale ?? 1);
          const textW = metrics.width;
          const textH = scaledFontSize * 1.2;
          ctx.fillStyle = layer.backgroundColor;
          const bgX =
            layer.textAlign === 'center' ? -textW / 2 - pad
            : layer.textAlign === 'right' ? -textW - pad
            : -pad;
          ctx.fillRect(bgX, -textH / 2 - pad, textW + pad * 2, textH + pad * 2);
        }

        if (layer.shadowColor) {
          ctx.shadowColor = layer.shadowColor;
          ctx.shadowBlur = (layer.shadowBlur ?? 4) * scale;
        }

        ctx.fillStyle = layer.color;
        ctx.fillText(displayText, 0, 0);

        ctx.restore();
      }

      // toBlob returns null when the canvas is too large / out of memory — reject instead of hanging
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png');
      });

      // Parent (MobileResultScreen) owns this URL and revokes it when replaced / unmounted
      onDone(URL.createObjectURL(blob));
    } catch (err) {
      console.error('[overlay export]', err);
      setExportError(true);
      setExporting(false);
    }
  }

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 active:text-white"
        >
          {t('cancel')}
        </button>
        <button
          onClick={addLayer}
          className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-sm font-medium text-white active:bg-white/[0.12]"
        >
          + {t('addText')}
        </button>
        <button
          onClick={exportComposite}
          disabled={exporting}
          className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
        >
          {exporting ? t('exporting') : t('done')}
        </button>
      </div>

      {exportError && (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {t('exportFailed')}
        </p>
      )}

      {/* Canvas area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          ref={containerRef}
          className="relative"
          onTouchStart={handleDeselect}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated result"
            className="w-full rounded-xl"
            draggable={false}
          />
          {layers.map(layer => (
            <DraggableTextLayer
              key={layer.id}
              layer={layer}
              isSelected={layer.id === selectedId}
              onSelect={() => { setSelectedId(layer.id); setIsPanelOpen(true); }}
              onMove={(x, y) => updateLayer(layer.id, { x, y })}
              onScale={(scale) => updateLayer(layer.id, { scale })}
              containerRef={containerRef}
            />
          ))}
        </div>
      </div>

      {/* Bottom panel */}
      {isPanelOpen && selectedLayer && (
        <TextStylePanel
          layer={selectedLayer}
          onChange={(updates) => updateLayer(selectedLayer.id, updates)}
          onDelete={() => deleteLayer(selectedLayer.id)}
        />
      )}
    </div>
  );
}
