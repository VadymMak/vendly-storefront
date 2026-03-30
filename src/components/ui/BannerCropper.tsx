'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface BannerCropperProps {
  imageUrl: string;
  /** Aspect ratio width/height — hero is roughly 21:9 */
  aspectRatio?: number;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  /** i18n labels */
  labelSave?: string;
  labelCancel?: string;
  labelZoom?: string;
  labelDragHint?: string;
  labelTitle?: string;
}

/**
 * Banner image cropper.
 * User uploads any image → sees a preview with hero aspect ratio →
 * drags to reposition, zooms in/out → clicks Save → cropped JPEG blob returned.
 */
export default function BannerCropper({
  imageUrl,
  aspectRatio = 21 / 9,
  onCrop,
  onCancel,
  labelSave = 'Save',
  labelCancel = 'Cancel',
  labelZoom = 'Zoom',
  labelDragHint = 'Drag to reposition',
  labelTitle = 'Crop Banner',
}: BannerCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Container dimensions
  const CANVAS_WIDTH = 840;
  const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH / aspectRatio);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);

      // Auto-fit: calculate initial zoom so image fills the frame
      const scaleX = CANVAS_WIDTH / img.naturalWidth;
      const scaleY = CANVAS_HEIGHT / img.naturalHeight;
      const fitZoom = Math.max(scaleX, scaleY);
      setZoom(fitZoom);
      // Center the image
      setOffset({
        x: (CANVAS_WIDTH - img.naturalWidth * fitZoom) / 2,
        y: (CANVAS_HEIGHT - img.naturalHeight * fitZoom) / 2,
      });
    };
    img.src = imageUrl;
  }, [imageUrl, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Draw preview
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw checkerboard background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw image with current zoom + offset
    const w = img.naturalWidth * zoom;
    const h = img.naturalHeight * zoom;
    ctx.drawImage(img, offset.x, offset.y, w, h);
  }, [zoom, offset, CANVAS_WIDTH, CANVAS_HEIGHT]);

  useEffect(() => {
    if (imageLoaded) draw();
  }, [imageLoaded, draw]);

  // Mouse/touch drag
  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const img = imgRef.current;
    if (!img) return;

    const w = img.naturalWidth * zoom;
    const h = img.naturalHeight * zoom;

    let newX = e.clientX - dragStart.x;
    let newY = e.clientY - dragStart.y;

    // Clamp so image always covers the viewport
    newX = Math.min(0, Math.max(CANVAS_WIDTH - w, newX));
    newY = Math.min(0, Math.max(CANVAS_HEIGHT - h, newY));

    setOffset({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  // Zoom slider
  const handleZoom = (newZoom: number) => {
    const img = imgRef.current;
    if (!img) return;

    // Zoom around center
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const imgCenterX = (centerX - offset.x) / zoom;
    const imgCenterY = (centerY - offset.y) / zoom;

    let newX = centerX - imgCenterX * newZoom;
    let newY = centerY - imgCenterY * newZoom;

    // Clamp
    const w = img.naturalWidth * newZoom;
    const h = img.naturalHeight * newZoom;
    newX = Math.min(0, Math.max(CANVAS_WIDTH - w, newX));
    newY = Math.min(0, Math.max(CANVAS_HEIGHT - h, newY));

    setZoom(newZoom);
    setOffset({ x: newX, y: newY });
  };

  // Min zoom = fill the frame
  const getMinZoom = () => {
    const img = imgRef.current;
    if (!img) return 0.1;
    const scaleX = CANVAS_WIDTH / img.naturalWidth;
    const scaleY = CANVAS_HEIGHT / img.naturalHeight;
    return Math.max(scaleX, scaleY);
  };

  // Export cropped image
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);

    // Create a high-res output canvas (1920px wide for good quality hero)
    const OUTPUT_WIDTH = 1920;
    const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / aspectRatio);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_WIDTH;
    outCanvas.height = OUTPUT_HEIGHT;
    const ctx = outCanvas.getContext('2d');
    if (!ctx || !imgRef.current) return;

    // Scale from preview to output
    const scale = OUTPUT_WIDTH / CANVAS_WIDTH;
    const img = imgRef.current;
    ctx.drawImage(
      img,
      offset.x * scale,
      offset.y * scale,
      img.naturalWidth * zoom * scale,
      img.naturalHeight * zoom * scale,
    );

    // Export as PNG (lossless) — server-side sharp will do final WebP encoding
    outCanvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
        setSaving(false);
      },
      'image/png',
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{labelTitle}</h3>
            <p className="text-sm text-gray-500">{labelDragHint}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Canvas preview */}
        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-100"
          style={{
            width: '100%',
            maxWidth: CANVAS_WIDTH,
            aspectRatio: `${aspectRatio}`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {/* Grid overlay for composition */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/20" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/20" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/20" />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500">{labelZoom}</span>
          {/* Zoom out icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <input
            type="range"
            min={getMinZoom()}
            max={getMinZoom() * 3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(parseFloat(e.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-green-600"
          />
          {/* Zoom in icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {labelCancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !imageLoaded}
            className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? '...' : labelSave}
          </button>
        </div>
      </div>
    </div>
  );
}
