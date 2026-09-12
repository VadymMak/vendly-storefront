'use client';

import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';

interface SceneCreatorProps {
  cutoutUrl: string;
  onClose: () => void;
  onResult: (url: string) => void;
}

interface SceneSize {
  label: string;
  width: number;
  height: number;
  icon: string;
}

const SCENE_SIZES: SceneSize[] = [
  { label: 'Square', width: 1024, height: 1024, icon: '⬜' },
  { label: 'Landscape', width: 1280, height: 832, icon: '▬' },
  { label: 'Portrait', width: 832, height: 1280, icon: '▮' },
  { label: 'Wide 16:9', width: 1344, height: 768, icon: '▭' },
  { label: 'Insta Story', width: 832, height: 1472, icon: '📱' },
];

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, cellSize = 16) {
  ctx.fillStyle = '#2a2a3e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#353550';
  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      if ((Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0) {
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }
}

const HANDLE_SIZE = 10;
type HandleCorner = 'tl' | 'tr' | 'bl' | 'br';

function getHandleRects(
  x: number, y: number, w: number, h: number, handleSize: number
): Record<HandleCorner, { x: number; y: number; w: number; h: number }> {
  const hs = handleSize;
  return {
    tl: { x: x - hs / 2, y: y - hs / 2, w: hs, h: hs },
    tr: { x: x + w - hs / 2, y: y - hs / 2, w: hs, h: hs },
    bl: { x: x - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    br: { x: x + w - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
  };
}

function hitTestHandle(
  mx: number, my: number,
  x: number, y: number, w: number, h: number,
  handleSize: number
): HandleCorner | null {
  const handles = getHandleRects(x, y, w, h, handleSize);
  for (const [corner, rect] of Object.entries(handles) as [HandleCorner, { x: number; y: number; w: number; h: number }][]) {
    if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
      return corner;
    }
  }
  return null;
}

type ProcessingStep = null | 'generating-bg' | 'compositing' | 'blending';

export function SceneCreator({ cutoutUrl, onClose, onResult }: SceneCreatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutoutImgRef = useRef<HTMLImageElement | null>(null);

  const [sceneSize, setSceneSize] = useState<SceneSize>(SCENE_SIZES[0]);
  const [objPos, setObjPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [objScale, setObjScale] = useState(1);
  const [displayScale, setDisplayScale] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [guidance, setGuidance] = useState(5);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [result, setResult] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const resizeCornerRef = useRef<HandleCorner | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; scale: number }>({ mouseX: 0, mouseY: 0, scale: 1 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cutoutImgRef.current = img;
      const fitScale = Math.min(
        (sceneSize.width * 0.5) / img.width,
        (sceneSize.height * 0.7) / img.height,
        1
      );
      setObjScale(fitScale);
      setObjPos({
        x: (sceneSize.width - img.width * fitScale) / 2,
        y: (sceneSize.height - img.height * fitScale) / 2,
      });
    };
    img.src = cutoutUrl;
  }, [cutoutUrl, sceneSize.width, sceneSize.height]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxW = container.clientWidth - 32;
    const maxH = container.clientHeight - 32;
    const scale = Math.min(maxW / sceneSize.width, maxH / sceneSize.height, 1);
    setDisplayScale(scale);
  }, [sceneSize]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = cutoutImgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d')!;
    const sw = sceneSize.width;
    const sh = sceneSize.height;
    canvas.width = sw;
    canvas.height = sh;

    drawCheckerboard(ctx, sw, sh, 20);

    const drawW = img.width * objScale;
    const drawH = img.height * objScale;
    ctx.drawImage(img, objPos.x, objPos.y, drawW, drawH);

    const handleSize = HANDLE_SIZE / displayScale;

    ctx.strokeStyle = 'rgba(22, 163, 74, 0.8)';
    ctx.lineWidth = 2 / displayScale;
    ctx.setLineDash([6 / displayScale, 4 / displayScale]);
    ctx.strokeRect(objPos.x, objPos.y, drawW, drawH);
    ctx.setLineDash([]);

    ctx.fillStyle = '#16a34a';
    for (const rect of Object.values(getHandleRects(objPos.x, objPos.y, drawW, drawH, handleSize))) {
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 2 / displayScale);
      ctx.fill();
    }
  }, [sceneSize, objPos, objScale, displayScale]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  function toSceneCoords(e: MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function isInsideObject(sx: number, sy: number): boolean {
    const img = cutoutImgRef.current;
    if (!img) return false;
    const drawW = img.width * objScale;
    const drawH = img.height * objScale;
    return sx >= objPos.x && sx <= objPos.x + drawW && sy >= objPos.y && sy <= objPos.y + drawH;
  }

  function handleMouseDown(e: MouseEvent<HTMLCanvasElement>) {
    const pos = toSceneCoords(e);
    const img = cutoutImgRef.current;
    if (!img) return;
    const drawW = img.width * objScale;
    const drawH = img.height * objScale;
    const handleSize = HANDLE_SIZE / displayScale;
    const corner = hitTestHandle(pos.x, pos.y, objPos.x, objPos.y, drawW, drawH, handleSize);
    if (corner) {
      isResizingRef.current = true;
      resizeCornerRef.current = corner;
      resizeStartRef.current = { mouseX: pos.x, mouseY: pos.y, scale: objScale };
      return;
    }
    if (isInsideObject(pos.x, pos.y)) {
      isDraggingRef.current = true;
      dragOffsetRef.current = { x: pos.x - objPos.x, y: pos.y - objPos.y };
    }
  }

  function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
    const pos = toSceneCoords(e);
    const img = cutoutImgRef.current;
    if (!img) return;

    if (isDraggingRef.current) {
      setObjPos({ x: pos.x - dragOffsetRef.current.x, y: pos.y - dragOffsetRef.current.y });
      return;
    }

    if (isResizingRef.current) {
      const start = resizeStartRef.current;
      const cx = objPos.x + (img.width * start.scale) / 2;
      const cy = objPos.y + (img.height * start.scale) / 2;
      const startDist = Math.sqrt((start.mouseX - cx) ** 2 + (start.mouseY - cy) ** 2);
      const currentDist = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
      if (startDist > 0) {
        const newScale = Math.max(0.05, Math.min(3, start.scale * (currentDist / startDist)));
        const oldW = img.width * objScale;
        const oldH = img.height * objScale;
        const newW = img.width * newScale;
        const newH = img.height * newScale;
        setObjPos(prev => ({ x: prev.x + (oldW - newW) / 2, y: prev.y + (oldH - newH) / 2 }));
        setObjScale(newScale);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawW = img.width * objScale;
    const drawH = img.height * objScale;
    const handleSize = HANDLE_SIZE / displayScale;
    const corner = hitTestHandle(pos.x, pos.y, objPos.x, objPos.y, drawW, drawH, handleSize);
    if (corner) {
      canvas.style.cursor = corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize';
    } else if (isInsideObject(pos.x, pos.y)) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    resizeCornerRef.current = null;
  }

  // ── Pass 1: Generate background image ───────────────────────────────────
  async function generateBackground(): Promise<string> {
    const ratio = sceneSize.width / sceneSize.height;
    let aspectRatio = '1:1';
    if (ratio > 1.5) aspectRatio = '16:9';
    else if (ratio > 1.1) aspectRatio = '4:3';
    else if (ratio < 0.65) aspectRatio = '9:16';
    else if (ratio < 0.9) aspectRatio = '3:4';

    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${prompt}, empty scene, no objects in foreground, background only, professional photography`,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        provider: 'flux-dev',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Background generation failed' })) as { error?: string };
      throw new Error(err.error || 'Background generation failed');
    }

    const buffer = await res.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  }

  // ── Pass 2a: Composite cutout onto background + build edge mask ──────────
  function compositeOnBackground(bgDataUrl: string): Promise<{ image: Blob; mask: Blob }> {
    return new Promise((resolve, reject) => {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        const cutout = cutoutImgRef.current!;
        const sw = sceneSize.width;
        const sh = sceneSize.height;
        const drawW = cutout.width * objScale;
        const drawH = cutout.height * objScale;

        // IMAGE: background + cutout composited
        const imgCanvas = document.createElement('canvas');
        imgCanvas.width = sw;
        imgCanvas.height = sh;
        const imgCtx = imgCanvas.getContext('2d')!;
        imgCtx.drawImage(bgImg, 0, 0, sw, sh);
        imgCtx.drawImage(cutout, objPos.x, objPos.y, drawW, drawH);

        // MASK: thin border ring around cutout edges only
        // Strategy: draw enlarged silhouette (white), punch hole with slightly shrunken silhouette (black)
        // Result: only the 15px ring around the object edges is white (= blend here)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = sw;
        maskCanvas.height = sh;
        const maskCtx = maskCanvas.getContext('2d')!;

        // All black = preserve everything by default
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(0, 0, sw, sh);

        const borderWidth = 15;

        // Draw enlarged silhouette at outer border → these pixels become candidates for white
        const outerScale = 1 + (borderWidth * 2) / Math.max(drawW, drawH);
        const outerW = drawW * outerScale;
        const outerH = drawH * outerScale;
        const outerX = objPos.x - (outerW - drawW) / 2;
        const outerY = objPos.y - (outerH - drawH) / 2;

        const outerCanvas = document.createElement('canvas');
        outerCanvas.width = sw;
        outerCanvas.height = sh;
        const outerCtx = outerCanvas.getContext('2d')!;
        outerCtx.drawImage(cutout, outerX, outerY, outerW, outerH);
        const outerData = outerCtx.getImageData(0, 0, sw, sh);

        // Draw shrunken silhouette → inner area to preserve (black)
        const innerScale = Math.max(0.01, 1 - (4 / Math.max(drawW, drawH)));
        const innerW = drawW * innerScale;
        const innerH = drawH * innerScale;
        const innerX = objPos.x + (drawW - innerW) / 2;
        const innerY = objPos.y + (drawH - innerH) / 2;

        const innerCanvas = document.createElement('canvas');
        innerCanvas.width = sw;
        innerCanvas.height = sh;
        const innerCtx = innerCanvas.getContext('2d')!;
        innerCtx.drawImage(cutout, innerX, innerY, innerW, innerH);
        const innerData = innerCtx.getImageData(0, 0, sw, sh);

        const mData = maskCtx.getImageData(0, 0, sw, sh);

        for (let i = 0; i < outerData.data.length; i += 4) {
          // Where outer silhouette has alpha → candidate for edge ring
          if (outerData.data[i + 3] > 5) {
            mData.data[i] = 255;
            mData.data[i + 1] = 255;
            mData.data[i + 2] = 255;
            mData.data[i + 3] = 255;
          }
          // Where inner (eroded) silhouette has alpha → object interior, stay black
          if (innerData.data[i + 3] > 30) {
            mData.data[i] = 0;
            mData.data[i + 1] = 0;
            mData.data[i + 2] = 0;
            mData.data[i + 3] = 255;
          }
        }
        maskCtx.putImageData(mData, 0, 0);

        function canvasToBlob(canvas: HTMLCanvasElement): Blob {
          const dataUrl = canvas.toDataURL('image/png');
          const binary = atob(dataUrl.split(',')[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
          return new Blob([array], { type: 'image/png' });
        }

        resolve({ image: canvasToBlob(imgCanvas), mask: canvasToBlob(maskCanvas) });
      };
      bgImg.onerror = () => reject(new Error('Failed to load background image'));
      bgImg.src = bgDataUrl;
    });
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      alert('Please describe the scene you want to create');
      return;
    }

    try {
      // ── Pass 1: Generate background ──────────────────────────────────
      setProcessingStep('generating-bg');
      const bgDataUrl = await generateBackground();

      // ── Pass 2a: Composite cutout onto background ────────────────────
      setProcessingStep('compositing');
      const { image, mask } = await compositeOnBackground(bgDataUrl);

      // ── Pass 2b: Edge blend via Flux Fill Pro ────────────────────────
      setProcessingStep('blending');
      const fd = new FormData();
      fd.append('image', image, 'scene-composite.png');
      fd.append('mask', mask, 'scene-edge-mask.png');
      fd.append('prompt', `${prompt}, seamless integration, natural lighting, realistic shadows`);
      fd.append('guidance', guidance.toString());

      const res = await fetch('/api/studio/inpaint', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Edge blending failed');
      }
      const data = await res.json() as { url: string };
      setResult(data.url);
    } catch (err) {
      console.error('[SceneCreator] Error:', err);
      alert(err instanceof Error ? err.message : 'Scene generation failed');
    } finally {
      setProcessingStep(null);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scalePercent = Math.round(objScale * 100);
  const isProcessing = processingStep !== null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[95vw] max-w-7xl overflow-hidden rounded-xl bg-[#1a1a2e]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          <IconX />
        </button>

        {/* Left: Canvas */}
        <div ref={containerRef} className="flex flex-1 items-center justify-center p-4">
          {result ? (
            <div className="text-center">
              <p className="mb-2 text-xs text-gray-400">Scene</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Generated scene" className="max-h-[70vh] rounded-lg" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: sceneSize.width * displayScale, height: sceneSize.height * displayScale, borderRadius: 8 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex w-[300px] flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#12121f] p-4">
          {result ? (
            <>
              <h3 className="text-sm font-medium text-white">Scene Result</h3>
              <button
                onClick={() => { onResult(result); onClose(); }}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Use Result
              </button>
              <button
                onClick={() => setResult(null)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                Try Again
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-white">Scene Creator</h3>
              <p className="text-[10px] text-gray-500">
                Position your object, describe the scene, and AI will generate the environment around it.
              </p>

              {/* Canvas size */}
              <div>
                <label className="text-xs text-gray-400">Canvas Size</label>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {SCENE_SIZES.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => setSceneSize(size)}
                      className={`rounded-lg px-2 py-1.5 text-xs transition-colors ${
                        sceneSize.label === size.label
                          ? 'bg-green-600 text-white'
                          : 'border border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="mr-1">{size.icon}</span>
                      {size.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-gray-600">{sceneSize.width} × {sceneSize.height}px</p>
              </div>

              {/* Object size */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Object Size</label>
                  <span className="text-xs font-mono text-gray-500">{scalePercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  value={scalePercent}
                  onChange={e => {
                    const newScale = parseInt(e.target.value) / 100;
                    const img = cutoutImgRef.current;
                    if (img) {
                      const oldW = img.width * objScale;
                      const oldH = img.height * objScale;
                      setObjPos(prev => ({
                        x: prev.x + (oldW - img.width * newScale) / 2,
                        y: prev.y + (oldH - img.height * newScale) / 2,
                      }));
                    }
                    setObjScale(newScale);
                  }}
                  className="mt-1 w-full accent-green-500"
                />
              </div>

              {/* Quick position */}
              <div>
                <label className="text-xs text-gray-400">Quick Position</label>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {[
                    { label: '↖', align: 'tl' }, { label: '↑', align: 'tc' }, { label: '↗', align: 'tr' },
                    { label: '←', align: 'ml' }, { label: '●', align: 'mc' }, { label: '→', align: 'mr' },
                    { label: '↙', align: 'bl' }, { label: '↓', align: 'bc' }, { label: '↘', align: 'br' },
                  ].map(({ label, align }) => (
                    <button
                      key={align}
                      onClick={() => {
                        const img = cutoutImgRef.current;
                        if (!img) return;
                        const ow = img.width * objScale;
                        const oh = img.height * objScale;
                        const sw = sceneSize.width;
                        const sh = sceneSize.height;
                        const pad = 20;
                        const positions: Record<string, { x: number; y: number }> = {
                          tl: { x: pad, y: pad }, tc: { x: (sw - ow) / 2, y: pad }, tr: { x: sw - ow - pad, y: pad },
                          ml: { x: pad, y: (sh - oh) / 2 }, mc: { x: (sw - ow) / 2, y: (sh - oh) / 2 }, mr: { x: sw - ow - pad, y: (sh - oh) / 2 },
                          bl: { x: pad, y: sh - oh - pad }, bc: { x: (sw - ow) / 2, y: sh - oh - pad }, br: { x: sw - ow - pad, y: sh - oh - pad },
                        };
                        setObjPos(positions[align]);
                      }}
                      className="rounded border border-white/10 py-1.5 text-xs text-gray-400 hover:bg-white/5"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* Guidance */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Prompt Strength</label>
                  <span className="text-xs font-mono text-gray-500">{guidance}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="5"
                  step="0.5"
                  value={guidance}
                  onChange={e => setGuidance(parseFloat(e.target.value))}
                  className="mt-1 w-full accent-green-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Natural</span>
                  <span>Follow prompt</span>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs text-gray-400">Describe the scene</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. marble table in Italian restaurant, warm candlelight, bokeh background, evening ambiance..."
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-600/50 focus:outline-none"
                  rows={4}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isProcessing || !prompt.trim()}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {processingStep === 'generating-bg' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Step 1/3: Generating background...
                  </span>
                ) : processingStep === 'compositing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Step 2/3: Compositing...
                  </span>
                ) : processingStep === 'blending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Step 3/3: Blending edges...
                  </span>
                ) : (
                  'Generate Scene'
                )}
              </button>

              <p className="text-[10px] text-gray-600">
                Two-pass AI: generates a clean background first, composites your object, then blends edges with Flux Fill Pro for photorealistic results.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
