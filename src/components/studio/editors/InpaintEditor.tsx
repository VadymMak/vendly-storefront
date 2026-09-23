'use client';

import { useState, useRef, useEffect, type MouseEvent } from 'react';
import type { EditorStatus } from '@/lib/types';
import { EditorShell } from './shared/EditorShell';
import { ProcessingOverlay } from './shared/ProcessingOverlay';
import { SceneCreator } from './SceneCreator';

interface InpaintEditorProps {
  imageUrl: string;
  onClose: () => void;
  onResult: (url: string) => void;
}

function InpaintToolsPanel({
  brushSize, onBrushSizeChange,
  tool, onToolChange,
  guidance, onGuidanceChange,
  prompt, onPromptChange,
  historyLength,
  onUndo, onClear,
  onRemoveBg,
  isProcessing,
}: {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  tool: 'brush' | 'eraser';
  onToolChange: (t: 'brush' | 'eraser') => void;
  guidance: number;
  onGuidanceChange: (g: number) => void;
  prompt: string;
  onPromptChange: (p: string) => void;
  historyLength: number;
  onUndo: () => void;
  onClear: () => void;
  onRemoveBg: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Paint mask</p>
      <p className="text-xs text-gray-500">
        Paint over the area you want to edit. Use brush to add, eraser to remove.
      </p>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Brush Size</span>
          <span className="font-mono text-xs text-gray-500">{brushSize}px</span>
        </div>
        <input
          type="range" min="5" max="100" value={brushSize}
          onChange={e => onBrushSizeChange(parseInt(e.target.value))}
          className="mt-1 w-full accent-green-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToolChange('brush')}
          className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
            tool === 'brush'
              ? 'border-green-500/40 bg-green-500/10 text-white'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          Brush
        </button>
        <button
          onClick={() => onToolChange('eraser')}
          className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
            tool === 'eraser'
              ? 'border-green-500/40 bg-green-500/10 text-white'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          Eraser
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClear}
          className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-gray-400 hover:bg-white/5"
        >
          Clear Mask
        </button>
        <button
          onClick={onUndo}
          disabled={historyLength === 0}
          className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-30"
        >
          Undo
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Prompt Strength</span>
          <span className="font-mono text-xs text-gray-500">{guidance}</span>
        </div>
        <input
          type="range" min="2" max="5" step="0.5" value={guidance}
          onChange={e => onGuidanceChange(parseFloat(e.target.value))}
          className="mt-1 w-full accent-green-500"
        />
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>Natural</span>
          <span>Follow prompt</span>
        </div>
      </div>

      <div>
        <span className="text-xs text-gray-400">What to fill in (optional)</span>
        <textarea
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          placeholder="Describe what should appear in the masked area..."
          rows={3}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-green-500/30"
        />
        <p className="mt-1 text-[10px] text-gray-500">Leave empty to remove the masked object</p>
      </div>

      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 text-[10px] text-gray-500">Or remove the entire background:</p>
        <button
          onClick={onRemoveBg}
          disabled={isProcessing}
          className="w-full rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
        >
          Remove Background
        </button>
      </div>
    </div>
  );
}

function InpaintResultPanel({ onCreateScene }: { onCreateScene: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
        <p className="text-xs text-green-400">
          Edit complete! Compare the result above, then keep or try again.
        </p>
      </div>
      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 text-[10px] text-gray-500">Place this result in a new scene:</p>
        <button
          onClick={onCreateScene}
          className="w-full rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-2.5 text-sm font-medium text-purple-400 hover:bg-purple-500/10"
        >
          Create Scene
        </button>
      </div>
    </div>
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
  const [status, setStatus] = useState<EditorStatus>('configuring');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSceneCreator, setShowSceneCreator] = useState(false);

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
    setStatus('processing');
    setError(null);
    try {
      const imageCanvas = imageCanvasRef.current!;
      const imageDataUrl = imageCanvas.toDataURL('image/png');
      const imageBinary = atob(imageDataUrl.split(',')[1]);
      const imageArray = new Uint8Array(imageBinary.length);
      for (let i = 0; i < imageBinary.length; i++) imageArray[i] = imageBinary.charCodeAt(i);
      const imageBlob = new Blob([imageArray], { type: 'image/png' });

      const maskBlob = exportMask();

      const fd = new FormData();
      fd.append('image', imageBlob, 'image.png');
      fd.append('mask', maskBlob, 'mask.png');
      fd.append('prompt', removeOnly ? '' : prompt);
      fd.append('guidance', guidance.toString());

      const res = await fetch('/api/studio/inpaint', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Inpaint failed');
      }
      const data = await res.json() as { url: string };
      setResult(data.url);
      setStatus('result-ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inpaint failed');
      setStatus('configuring');
    }
  }

  async function handleRemoveBg() {
    setStatus('processing');
    setError(null);
    try {
      const imageCanvas = imageCanvasRef.current!;
      const imageDataUrl = imageCanvas.toDataURL('image/png');
      const imageBinary = atob(imageDataUrl.split(',')[1]);
      const imageArray = new Uint8Array(imageBinary.length);
      for (let i = 0; i < imageBinary.length; i++) imageArray[i] = imageBinary.charCodeAt(i);
      const imageBlob = new Blob([imageArray], { type: 'image/png' });

      const fd = new FormData();
      fd.append('image', imageBlob, 'image.png');

      const res = await fetch('/api/studio/remove-bg', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Remove background failed');
      }
      const data = await res.json() as { url: string };
      setResult(data.url);
      setStatus('result-ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove background failed');
      setStatus('configuring');
    }
  }

  const isResultReady = status === 'result-ready' && result;

  return (
    <>
      <EditorShell
        title="Edit image"
        creditCost={2}
        status={status}
        onBack={onClose}
        primaryAction={
          isResultReady
            ? {
                label: 'Use result',
                onClick: () => { onResult(result); onClose(); },
              }
            : {
                label: prompt.trim() ? 'Inpaint · 2 credits' : 'Remove object · 2 credits',
                onClick: () => void handleInpaint(!prompt.trim()),
                disabled: status === 'processing',
                loading: status === 'processing',
              }
        }
        secondaryAction={
          isResultReady
            ? {
                label: 'Try again',
                onClick: () => {
                  setResult(null);
                  setStatus('configuring');
                  const maskCanvas = maskCanvasRef.current;
                  if (maskCanvas) {
                    maskCanvas.getContext('2d')!.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                  }
                  setHistory([]);
                },
              }
            : undefined
        }
        error={error}
        sidebar={
          isResultReady
            ? <InpaintResultPanel onCreateScene={() => setShowSceneCreator(true)} />
            : (
              <InpaintToolsPanel
                brushSize={brushSize} onBrushSizeChange={setBrushSize}
                tool={tool} onToolChange={setTool}
                guidance={guidance} onGuidanceChange={setGuidance}
                prompt={prompt} onPromptChange={setPrompt}
                historyLength={history.length}
                onUndo={handleUndo} onClear={handleClear}
                onRemoveBg={() => void handleRemoveBg()}
                isProcessing={status === 'processing'}
              />
            )
        }
      >
        <div ref={containerRef} className="flex h-full items-center justify-center p-4">
          {isResultReady ? (
            <div className="flex gap-4">
              <div className="text-center">
                <p className="mb-2 text-xs text-gray-400">Original</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Original" className="max-h-[70vh] rounded-lg border border-white/10" />
              </div>
              <div className="text-center">
                <p className="mb-2 text-xs text-gray-400">Result</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="Result" className="max-h-[70vh] rounded-lg border border-white/10" />
              </div>
            </div>
          ) : (
            <div
              className="relative"
              style={{
                width: imageDimensions.w || undefined,
                height: imageDimensions.h || undefined,
              }}
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
              <ProcessingOverlay
                visible={status === 'processing'}
                message="Processing edit..."
                submessage="This usually takes 10–20 seconds"
              />
            </div>
          )}
        </div>
      </EditorShell>

      {showSceneCreator && result && (
        <SceneCreator
          cutoutUrl={result}
          onClose={() => setShowSceneCreator(false)}
          onResult={(url) => { setShowSceneCreator(false); setResult(url); }}
        />
      )}
    </>
  );
}
