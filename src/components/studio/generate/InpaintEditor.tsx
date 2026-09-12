'use client';

import { useState, useRef, useEffect, type MouseEvent } from 'react';

interface InpaintEditorProps {
  imageUrl: string;
  onClose: () => void;
  onResult: (url: string) => void;
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function InpaintEditor({ imageUrl, onClose, onResult }: InpaintEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [guidance, setGuidance] = useState(5);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const maxW = container.clientWidth - 32;
      const maxH = container.clientHeight - 32;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      setImageDimensions({ w, h });

      const imageCanvas = imageCanvasRef.current!;
      imageCanvas.width = img.width;
      imageCanvas.height = img.height;
      imageCanvas.getContext('2d')!.drawImage(img, 0, 0);

      const maskCanvas = maskCanvasRef.current!;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  function getCanvasCoords(e: MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    setHistory(prev => [...prev.slice(-19), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    isDrawingRef.current = true;
    const pos = getCanvasCoords(e);
    lastPosRef.current = pos;
    drawAt(pos.x, pos.y);
  }

  function drawAt(x: number, y: number) {
    const canvas = maskCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const scaledBrush = brushSize * (canvas.width / rect.width);

    ctx.beginPath();
    ctx.arc(x, y, scaledBrush / 2, 0, Math.PI * 2);
    if (tool === 'brush') {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
      ctx.fill();
    } else {
      ctx.save();
      ctx.clip();
      ctx.clearRect(x - scaledBrush, y - scaledBrush, scaledBrush * 2, scaledBrush * 2);
      ctx.restore();
    }
  }

  function draw(e: MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = maskCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getCanvasCoords(e);
    const rect = canvas.getBoundingClientRect();
    const scaledBrush = brushSize * (canvas.width / rect.width);

    if (lastPosRef.current && tool === 'brush') {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.lineWidth = scaledBrush;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)';
      ctx.stroke();
    } else if (lastPosRef.current && tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.lineWidth = scaledBrush;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      ctx.stroke();
      ctx.restore();
    }

    lastPosRef.current = pos;
  }

  function stopDrawing() {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }

  function handleUndo() {
    if (history.length === 0) return;
    const canvas = maskCanvasRef.current!;
    canvas.getContext('2d')!.putImageData(history[history.length - 1], 0, 0);
    setHistory(prev => prev.slice(0, -1));
  }

  function handleClear() {
    const canvas = maskCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    setHistory(prev => [...prev.slice(-19), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function exportMask(): Blob {
    const maskCanvas = maskCanvasRef.current!;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const ctx = exportCanvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    const maskData = maskCanvas.getContext('2d')!.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const exportData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);

    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i + 3] > 10) {
        exportData.data[i] = 255;
        exportData.data[i + 1] = 255;
        exportData.data[i + 2] = 255;
        exportData.data[i + 3] = 255;
      }
    }
    ctx.putImageData(exportData, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: 'image/png' });
  }

  async function handleInpaint(removeOnly = false) {
    setIsProcessing(true);
    try {
      const imageCanvas = imageCanvasRef.current!;
      const imageDataUrl = imageCanvas.toDataURL('image/webp', 0.9);
      const imageBinary = atob(imageDataUrl.split(',')[1]);
      const imageArray = new Uint8Array(imageBinary.length);
      for (let i = 0; i < imageBinary.length; i++) imageArray[i] = imageBinary.charCodeAt(i);
      const imageBlob = new Blob([imageArray], { type: 'image/webp' });

      const maskBlob = exportMask();

      const fd = new FormData();
      fd.append('image', imageBlob, 'image.webp');
      fd.append('mask', maskBlob, 'mask.png');
      fd.append('prompt', removeOnly ? '' : prompt);
      fd.append('guidance', guidance.toString());

      const res = await fetch('/api/studio/inpaint', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Inpaint failed');
      }
      const data = await res.json() as { url: string };
      setResult(data.url);
    } catch (err) {
      console.error('[Inpaint] Error:', err);
      alert(err instanceof Error ? err.message : 'Inpaint failed');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
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

        {/* Left: Canvas area */}
        <div ref={containerRef} className="flex flex-1 items-center justify-center p-4">
          {result ? (
            <div className="flex gap-4">
              <div className="text-center">
                <p className="mb-2 text-xs text-gray-400">Original</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Original" className="max-h-[70vh] rounded-lg" />
              </div>
              <div className="text-center">
                <p className="mb-2 text-xs text-gray-400">Result</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="Result" className="max-h-[70vh] rounded-lg" />
              </div>
            </div>
          ) : (
            <div
              className="relative"
              style={{ width: imageDimensions.w || undefined, height: imageDimensions.h || undefined }}
            >
              <canvas
                ref={imageCanvasRef}
                className="absolute inset-0 rounded-lg"
                style={{ width: '100%', height: '100%' }}
              />
              <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 cursor-crosshair rounded-lg"
                style={{ width: '100%', height: '100%' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          )}
        </div>

        {/* Right: Tools sidebar */}
        <div className="flex w-[300px] flex-col gap-4 border-l border-white/10 bg-[#12121f] p-4">
          {result ? (
            <>
              <h3 className="text-sm font-medium text-white">Result</h3>
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
              <h3 className="text-sm font-medium text-white">Inpaint Tools</h3>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Brush Size</label>
                  <span className="text-xs font-mono text-gray-500">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={brushSize}
                  onChange={e => setBrushSize(parseInt(e.target.value))}
                  className="mt-1 w-full accent-green-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setTool('brush')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    tool === 'brush'
                      ? 'bg-green-600 text-white'
                      : 'border border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  Brush
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    tool === 'eraser'
                      ? 'bg-green-600 text-white'
                      : 'border border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  Eraser
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5"
                >
                  Clear Mask
                </button>
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-30"
                >
                  Undo
                </button>
              </div>

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

              <div className="border-t border-white/10" />

              <div>
                <label className="text-xs text-gray-400">What to fill in (optional)</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe what should appear in the masked area..."
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-600/50 focus:outline-none"
                  rows={3}
                />
                <p className="mt-1 text-[10px] text-gray-600">
                  Leave empty to remove the masked object
                </p>
              </div>

              <button
                onClick={() => handleInpaint(false)}
                disabled={isProcessing}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Inpaint'}
              </button>
              <button
                onClick={() => handleInpaint(true)}
                disabled={isProcessing}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Remove Object'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
