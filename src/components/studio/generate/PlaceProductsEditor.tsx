'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { EditorCheckpoint, PlacedObject, PlaceProductsEditorProps } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const HANDLE_R = 7;
const ROTATE_OFFSET = 28;
const MAX_CANVAS = 800;

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function ptDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

function rotPt(px: number, py: number, cx: number, cy: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  };
}

function toCanvasPt(e: PointerEvent, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function getObjBounds(obj: PlacedObject, cw: number, ch: number) {
  const cx = obj.x * cw;
  const cy = obj.y * ch;
  const hw = (obj.scale * obj.naturalWidth) / 2;
  const hh = (obj.scale * obj.naturalHeight) / 2;
  const r = obj.rotation;
  return {
    cx, cy, hw, hh,
    tl: rotPt(cx - hw, cy - hh, cx, cy, r),
    tr: rotPt(cx + hw, cy - hh, cx, cy, r),
    bl: rotPt(cx - hw, cy + hh, cx, cy, r),
    br: rotPt(cx + hw, cy + hh, cx, cy, r),
    topMid: rotPt(cx, cy - hh, cx, cy, r),
    rotHandle: rotPt(cx, cy - hh - ROTATE_OFFSET, cx, cy, r),
  };
}

function isInsideObj(px: number, py: number, obj: PlacedObject, cw: number, ch: number): boolean {
  const cx = obj.x * cw;
  const cy = obj.y * ch;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-obj.rotation);
  const sin = Math.sin(-obj.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const hw = (obj.scale * obj.naturalWidth) / 2;
  const hh = (obj.scale * obj.naturalHeight) / 2;
  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}

type HitType = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rotate';

function hitTestSelected(
  px: number,
  py: number,
  obj: PlacedObject,
  cw: number,
  ch: number,
): HitType | null {
  const b = getObjBounds(obj, cw, ch);
  const r = HANDLE_R + 4;
  if (ptDist(px, py, b.rotHandle.x, b.rotHandle.y) <= r) return 'rotate';
  if (ptDist(px, py, b.tl.x, b.tl.y) <= r) return 'tl';
  if (ptDist(px, py, b.tr.x, b.tr.y) <= r) return 'tr';
  if (ptDist(px, py, b.bl.x, b.bl.y) <= r) return 'bl';
  if (ptDist(px, py, b.br.x, b.br.y) <= r) return 'br';
  if (isInsideObj(px, py, obj, cw, ch)) return 'move';
  return null;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Edge mask generation ──────────────────────────────────────────────────────

function generateEdgeMask(
  canvas: HTMLCanvasElement,
  objects: PlacedObject[],
  objImgs: Map<string, HTMLImageElement>,
): HTMLCanvasElement {
  const W = canvas.width;
  const H = canvas.height;
  const EDGE = 6;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = W;
  maskCanvas.height = H;
  const mctx = maskCanvas.getContext('2d')!;

  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, W, H);

  // Dilate pass: draw each object scaled up to create edge zone
  mctx.globalCompositeOperation = 'source-over';
  for (const obj of objects) {
    const img = objImgs.get(obj.id);
    if (!img) continue;
    const cx = obj.x * W;
    const cy = obj.y * H;
    const hw = (obj.scale * obj.naturalWidth) / 2;
    const hh = (obj.scale * obj.naturalHeight) / 2;
    const minDim = Math.min(hw * 2, hh * 2);
    const scaleUp = minDim > 0 ? 1 + (EDGE * 2) / minDim : 1;
    mctx.save();
    mctx.translate(cx, cy);
    mctx.rotate(obj.rotation);
    mctx.scale(scaleUp, scaleUp);
    mctx.drawImage(img, -hw, -hh, hw * 2, hh * 2);
    mctx.restore();
  }

  // Erode pass: cut out the interior of each object
  mctx.globalCompositeOperation = 'destination-out';
  for (const obj of objects) {
    const img = objImgs.get(obj.id);
    if (!img) continue;
    const cx = obj.x * W;
    const cy = obj.y * H;
    const hw = (obj.scale * obj.naturalWidth) / 2;
    const hh = (obj.scale * obj.naturalHeight) / 2;
    const ERODE = 2;
    const minDim = Math.min(hw * 2, hh * 2);
    const scaleDown = minDim > 0 ? Math.max(0, 1 - (ERODE * 2) / minDim) : 1;
    mctx.save();
    mctx.translate(cx, cy);
    mctx.rotate(obj.rotation);
    mctx.scale(scaleDown, scaleDown);
    mctx.drawImage(img, -hw, -hh, hw * 2, hh * 2);
    mctx.restore();
  }

  mctx.globalCompositeOperation = 'source-over';
  return maskCanvas;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DragState {
  type: HitType;
  objId: string;
  startPtr: { x: number; y: number };
  startX: number;
  startY: number;
  startScale: number;
  startRotation: number;
  objCx: number;
  objCy: number;
}

export function PlaceProductsEditor({
  backgroundUrl,
  initialCutouts = [],
  galleryImages = [],
  onClose,
  onResult,
}: PlaceProductsEditorProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [objects, setObjects]     = useState<PlacedObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasW, setCanvasW]     = useState(MAX_CANVAS);
  const [canvasH, setCanvasH]     = useState(MAX_CANVAS);
  const [bgLoaded, setBgLoaded]   = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [blending, setBlending]           = useState(false);
  const [error, setError]                 = useState('');
  const [splittingId, setSplittingId]     = useState<string | null>(null);
  const [zoomLevel, setZoomLevel]         = useState(1);
  const [historyStack, setHistoryStack]   = useState<EditorCheckpoint[]>([]);
  const [redoStack, setRedoStack]         = useState<EditorCheckpoint[]>([]);

  const bgImgRef          = useRef<HTMLImageElement | null>(null);
  const objImgsRef        = useRef<Map<string, HTMLImageElement>>(new Map());
  const backgroundUrlRef  = useRef<string>(backgroundUrl);

  // Refs to avoid stale closures in draw / pointer handlers
  const objectsRef   = useRef<PlacedObject[]>([]);
  const selectedRef  = useRef<string | null>(null);
  const canvasWRef   = useRef(MAX_CANVAS);
  const canvasHRef   = useRef(MAX_CANVAS);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { canvasWRef.current = canvasW; }, [canvasW]);
  useEffect(() => { canvasHRef.current = canvasH; }, [canvasH]);

  const dragRef    = useRef<DragState | null>(null);
  const ptrsRef    = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef   = useRef<{ dist: number; scale: number; objId: string } | null>(null);

  // ── Drawing ────────────────────────────────────────────────────────────────

  const draw = useCallback((hideSelection = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Background (cover-fit)
    const bg = bgImgRef.current;
    const bgR = bg.naturalWidth / bg.naturalHeight;
    const cnR = cw / ch;
    let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;
    if (bgR > cnR) {
      sw = bg.naturalHeight * cnR;
      sx = (bg.naturalWidth - sw) / 2;
    } else {
      sh = bg.naturalWidth / cnR;
      sy = (bg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, cw, ch);

    // Empty state hint
    if (objectsRef.current.length === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Upload cutouts below to place on this image', cw / 2, ch / 2);
      ctx.restore();
    }

    // Objects (back → front)
    for (const obj of objectsRef.current) {
      const img = objImgsRef.current.get(obj.id);
      if (!img) continue;
      const ox = obj.x * cw;
      const oy = obj.y * ch;
      const ow = obj.scale * obj.naturalWidth;
      const oh = obj.scale * obj.naturalHeight;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(obj.rotation);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(img, -ow / 2, -oh / 2, ow, oh);
      ctx.restore();
    }

    // Selection UI
    if (!hideSelection) {
      const selId = selectedRef.current;
      if (selId) {
        const obj = objectsRef.current.find(o => o.id === selId);
        if (obj) {
          const b = getObjBounds(obj, cw, ch);

          // Dashed bounding box
          ctx.save();
          ctx.translate(b.cx, b.cy);
          ctx.rotate(obj.rotation);
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2);
          ctx.restore();

          // Rotate handle connector
          ctx.save();
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(b.topMid.x, b.topMid.y);
          ctx.lineTo(b.rotHandle.x, b.rotHandle.y);
          ctx.stroke();
          ctx.restore();

          // Corner handles
          for (const pt of [b.tl, b.tr, b.bl, b.br]) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.fillRect(pt.x - HANDLE_R / 2, pt.y - HANDLE_R / 2, HANDLE_R, HANDLE_R);
            ctx.strokeRect(pt.x - HANDLE_R / 2, pt.y - HANDLE_R / 2, HANDLE_R, HANDLE_R);
            ctx.restore();
          }

          // Rotate handle circle
          ctx.save();
          ctx.beginPath();
          ctx.arc(b.rotHandle.x, b.rotHandle.y, HANDLE_R, 0, Math.PI * 2);
          ctx.fillStyle = '#16a34a';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${HANDLE_R + 2}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↻', b.rotHandle.x, b.rotHandle.y);
          ctx.restore();
        }
      }
    }
  }, []);

  // Redraw on state changes
  useEffect(() => { draw(); }, [objects, selectedId, canvasW, canvasH, bgLoaded, draw]);

  // ── Load background ────────────────────────────────────────────────────────

  useEffect(() => {
    setBgLoaded(false);
    loadImg(backgroundUrl).then(img => {
      bgImgRef.current = img;
      const ratio = img.naturalWidth / img.naturalHeight;
      let w: number, h: number;
      if (ratio >= 1) { w = MAX_CANVAS; h = Math.round(MAX_CANVAS / ratio); }
      else { h = MAX_CANVAS; w = Math.round(MAX_CANVAS * ratio); }
      setCanvasW(w);
      setCanvasH(h);
      setBgLoaded(true);
    }).catch(() => setError('Failed to load background image'));
  }, [backgroundUrl]);

  // ── Load initial cutouts ───────────────────────────────────────────────────

  useEffect(() => {
    if (!bgLoaded || initialCutouts.length === 0) return;
    const cw = canvasWRef.current;
    Promise.all(initialCutouts.map(src => loadImg(src))).then(imgs => {
      const newObjs: PlacedObject[] = imgs.map((img, i) => ({
        id: uid(),
        src: initialCutouts[i],
        x: Math.min(0.9, 0.5 + i * 0.08),
        y: 0.5,
        scale: (cw * 0.28) / img.naturalWidth,
        rotation: 0,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));
      newObjs.forEach((obj, i) => objImgsRef.current.set(obj.id, imgs[i]));
      setObjects(prev => [...prev, ...newObjs]);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgLoaded]);

  // ── Add object from src ────────────────────────────────────────────────────

  const addObject = useCallback(async (src: string, position?: { x: number; y: number }) => {
    try {
      const img = await loadImg(src);
      const cw  = canvasWRef.current;
      const ch  = canvasHRef.current;
      const scale = Math.min(
        (cw * 0.25) / img.naturalWidth,
        (ch * 0.25) / img.naturalHeight,
        1,
      );
      const obj: PlacedObject = {
        id: uid(),
        src,
        x: position?.x ?? 0.5,
        y: position?.y ?? 0.5,
        scale,
        rotation: 0,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
      objImgsRef.current.set(obj.id, img);
      setObjects(prev => [...prev, obj]);
      setSelectedId(obj.id);
    } catch {
      setError('Failed to load image');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    void addObject(src);
    e.target.value = '';
  }, [addObject]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch: second pointer arriving
    if (ptrsRef.current.size === 2) {
      const [a, b_] = Array.from(ptrsRef.current.values());
      const d = ptDist(a.x, a.y, b_.x, b_.y);
      const sel = selectedRef.current;
      if (sel) {
        const obj = objectsRef.current.find(o => o.id === sel);
        if (obj) pinchRef.current = { dist: d, scale: obj.scale, objId: sel };
      }
      dragRef.current = null;
      return;
    }

    const pt  = toCanvasPt(e.nativeEvent, canvasRef.current!);
    const cw  = canvasWRef.current;
    const ch  = canvasHRef.current;

    // Check selected object handles first
    const selId = selectedRef.current;
    if (selId) {
      const selObj = objectsRef.current.find(o => o.id === selId);
      if (selObj) {
        const hit = hitTestSelected(pt.x, pt.y, selObj, cw, ch);
        if (hit) {
          dragRef.current = {
            type: hit,
            objId: selId,
            startPtr: pt,
            startX: selObj.x,
            startY: selObj.y,
            startScale: selObj.scale,
            startRotation: selObj.rotation,
            objCx: selObj.x * cw,
            objCy: selObj.y * ch,
          };
          return;
        }
      }
    }

    // Check all objects (top = last in array)
    for (let i = objectsRef.current.length - 1; i >= 0; i--) {
      const obj = objectsRef.current[i];
      if (isInsideObj(pt.x, pt.y, obj, cw, ch)) {
        setSelectedId(obj.id);
        dragRef.current = {
          type: 'move',
          objId: obj.id,
          startPtr: pt,
          startX: obj.x,
          startY: obj.y,
          startScale: obj.scale,
          startRotation: obj.rotation,
          objCx: obj.x * cw,
          objCy: obj.y * ch,
        };
        return;
      }
    }

    setSelectedId(null);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch scale
    if (ptrsRef.current.size === 2 && pinchRef.current) {
      const [a, b_] = Array.from(ptrsRef.current.values());
      const d = ptDist(a.x, a.y, b_.x, b_.y);
      const ratio = d / pinchRef.current.dist;
      const objId = pinchRef.current.objId;
      const baseScale = pinchRef.current.scale;
      setObjects(prev => prev.map(o =>
        o.id === objId ? { ...o, scale: Math.max(0.01, baseScale * ratio) } : o
      ));
      return;
    }

    const d = dragRef.current;
    if (!d) return;

    const pt = toCanvasPt(e.nativeEvent, canvasRef.current!);
    const cw = canvasWRef.current;
    const ch = canvasHRef.current;
    const dx = pt.x - d.startPtr.x;
    const dy = pt.y - d.startPtr.y;

    setObjects(prev => prev.map(obj => {
      if (obj.id !== d.objId) return obj;

      if (d.type === 'move') {
        return {
          ...obj,
          x: Math.max(0, Math.min(1, d.startX + dx / cw)),
          y: Math.max(0, Math.min(1, d.startY + dy / ch)),
        };
      }

      if (d.type === 'rotate') {
        const startAngle = Math.atan2(d.startPtr.y - d.objCy, d.startPtr.x - d.objCx);
        const curAngle   = Math.atan2(pt.y - d.objCy, pt.x - d.objCx);
        return { ...obj, rotation: d.startRotation + (curAngle - startAngle) };
      }

      // Corner resize (aspect-ratio locked, scale from center)
      const startD = ptDist(d.startPtr.x, d.startPtr.y, d.objCx, d.objCy);
      if (startD === 0) return obj;
      const curD = ptDist(pt.x, pt.y, d.objCx, d.objCy);
      return { ...obj, scale: Math.max(0.01, d.startScale * (curD / startD)) };
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size < 2) pinchRef.current = null;
    if (ptrsRef.current.size === 0) dragRef.current = null;
  }, []);

  // ── Object actions ─────────────────────────────────────────────────────────

  const rotate90 = useCallback(() => {
    if (!selectedId) return;
    setObjects(prev => prev.map(o =>
      o.id === selectedId ? { ...o, rotation: o.rotation + Math.PI / 2 } : o
    ));
  }, [selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    objImgsRef.current.delete(selectedId);
    setObjects(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // ── History ────────────────────────────────────────────────────────────────

  const MAX_HISTORY = 15;

  const pushCheckpoint = useCallback(() => {
    setHistoryStack(prev => [
      ...prev.slice(-(MAX_HISTORY - 1)),
      { backgroundUrl: backgroundUrlRef.current, objects: [...objectsRef.current] },
    ]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(async () => {
    setHistoryStack(prev => {
      if (prev.length === 0) return prev;
      const checkpoint = prev[prev.length - 1];

      // Save current state to redo
      setRedoStack(r => [
        ...r,
        { backgroundUrl: backgroundUrlRef.current, objects: [...objectsRef.current] },
      ]);

      // Load checkpoint background
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        bgImgRef.current = img;
        backgroundUrlRef.current = checkpoint.backgroundUrl;

        // Reload object images missing from cache
        const pending = checkpoint.objects.filter(o => !objImgsRef.current.has(o.id));
        Promise.all(pending.map(o => loadImg(o.src).then(loaded => ({ id: o.id, loaded }))))
          .then(results => {
            results.forEach(({ id, loaded }) => objImgsRef.current.set(id, loaded));
            setObjects(checkpoint.objects);
            setSelectedId(null);
            draw();
          })
          .catch(() => {
            setObjects(checkpoint.objects);
            setSelectedId(null);
            draw();
          });
      };
      img.src = checkpoint.backgroundUrl;

      return prev.slice(0, -1);
    });
  }, [draw]);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const redoState = prev[prev.length - 1];

      // Save current state to history
      setHistoryStack(h => [
        ...h.slice(-(MAX_HISTORY - 1)),
        { backgroundUrl: backgroundUrlRef.current, objects: [...objectsRef.current] },
      ]);

      // Load redo background
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        bgImgRef.current = img;
        backgroundUrlRef.current = redoState.backgroundUrl;

        const pending = redoState.objects.filter(o => !objImgsRef.current.has(o.id));
        Promise.all(pending.map(o => loadImg(o.src).then(loaded => ({ id: o.id, loaded }))))
          .then(results => {
            results.forEach(({ id, loaded }) => objImgsRef.current.set(id, loaded));
            setObjects(redoState.objects);
            setSelectedId(null);
            draw();
          })
          .catch(() => {
            setObjects(redoState.objects);
            setSelectedId(null);
            draw();
          });
      };
      img.src = redoState.backgroundUrl;

      return prev.slice(0, -1);
    });
  }, [draw]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        void handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, handleUndo, handleRedo]);

  // ── Canvas zoom: Ctrl+Plus / Ctrl+Minus / Ctrl+0 ─────────────────────
  useEffect(() => {
    const handleZoomKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoomLevel(prev => Math.min(prev + 0.25, 4));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleZoomKey);
    return () => window.removeEventListener('keydown', handleZoomKey);
  }, []);

  // ── Canvas zoom: Ctrl+Scroll ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.min(4, Math.max(0.25, prev + delta)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [bgLoaded]);

  const bringForward = useCallback(() => {
    if (!selectedId) return;
    setObjects(prev => {
      const i = prev.findIndex(o => o.id === selectedId);
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }, [selectedId]);

  // ── Auto Split ────────────────────────────────────────────────────────────

  const autoSplit = useCallback(async (objId: string) => {
    const obj = objectsRef.current.find(o => o.id === objId);
    if (!obj) return;

    setSplittingId(objId);
    setError('');
    try {
      let imageUrl = obj.src;

      // blob: URLs are browser-local — SAM2 can't fetch them; upload first
      if (imageUrl.startsWith('blob:')) {
        const blobRes = await fetch(imageUrl);
        const blobData = await blobRes.blob();
        const fd = new FormData();
        fd.append('image', blobData, 'cutout.png');
        const uploadRes = await fetch('/api/studio/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) {
          setError('Failed to upload image for processing');
          return;
        }
        const uploadJson = await uploadRes.json() as { url: string };
        imageUrl = uploadJson.url;
        // Persist permanent URL so canvas thumbnail also updates
        setObjects(prev => prev.map(o => o.id === objId ? { ...o, src: imageUrl } : o));
      }

      const res = await fetch('/api/studio/auto-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      const json = await res.json() as { cutouts?: string[]; error?: string };

      if (!res.ok) {
        setError(json.error ?? 'Auto split failed');
        return;
      }

      const { cutouts } = json;
      if (!cutouts || cutouts.length === 0) {
        setError('No objects detected in this image');
        return;
      }
      if (cutouts.length === 1) {
        setError('Only 1 object detected — nothing to split');
        return;
      }

      // Remove original
      objImgsRef.current.delete(objId);
      setObjects(prev => prev.filter(o => o.id !== objId));
      setSelectedId(null);

      // Add each cutout spread horizontally
      for (let i = 0; i < cutouts.length; i++) {
        const x = cutouts.length === 1
          ? 0.5
          : 0.15 + (i * 0.7) / (cutouts.length - 1);
        await addObject(cutouts[i], { x, y: 0.5 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to split image');
    } finally {
      setSplittingId(null);
    }
  }, [addObject]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (exporting || objects.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setExporting(true);
    setError('');
    try {
      // Redraw without selection handles
      draw(true);

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
      );

      const fd = new FormData();
      fd.append('image', blob, 'composite.png');
      const resp = await fetch('/api/studio/upload', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error('Upload failed');
      const { url } = await resp.json() as { url: string };
      onResult(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
      draw();
    }
  }, [exporting, objects.length, draw, onResult]);

  // ── AI Blend ───────────────────────────────────────────────────────────────

  const handleAiBlend = useCallback(async () => {
    if (blending || objects.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setBlending(true);
    setError('');

    // Save checkpoint before blend so user can undo
    pushCheckpoint();

    try {
      draw(true);

      const compositeBlob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
      );

      const maskCanvas = generateEdgeMask(canvas, objects, objImgsRef.current);
      const maskBlob = await new Promise<Blob>((res, rej) =>
        maskCanvas.toBlob(b => b ? res(b) : rej(new Error('mask toBlob failed')), 'image/png')
      );

      const fd = new FormData();
      fd.append('composite', compositeBlob, 'composite.png');
      fd.append('mask', maskBlob, 'mask.png');

      const resp = await fetch('/api/studio/ai-blend', { method: 'POST', body: fd });
      const json = await resp.json() as { url?: string; error?: string };

      if (!resp.ok) {
        // Blend failed — roll back the checkpoint we pushed
        setHistoryStack(prev => prev.slice(0, -1));
        setError(json.error ?? 'AI Blend failed');
        return;
      }

      if (json.url) {
        // Load blended result as new background
        const newBg = await loadImg(json.url);
        bgImgRef.current = newBg;
        backgroundUrlRef.current = json.url;

        // Bake objects into background — clear them from the editor
        objImgsRef.current.clear();
        setObjects([]);
        setSelectedId(null);

        // Stay in editor — draw with new background, no objects
        draw();
      }
    } catch (err) {
      setHistoryStack(prev => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : 'AI Blend failed');
    } finally {
      setBlending(false);
    }
  }, [blending, objects, draw, pushCheckpoint]);

  const selectedObj = objects.find(o => o.id === selectedId) ?? null;

  // ── UI ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0b0f' }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ background: '#0f1117', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>
          <button
            onClick={() => void handleUndo()}
            disabled={historyStack.length === 0}
            className="rounded-md px-2 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="rounded-md px-2 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Place Products</span>
          {zoomLevel !== 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              className="rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Click to reset zoom (Ctrl+0)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || objects.length === 0}
          className="rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
          style={{ background: '#16a34a' }}
        >
          {exporting ? 'Exporting…' : 'Export →'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 bg-red-900/40 px-4 py-2 text-xs text-red-300">{error}</div>
      )}

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {!bgLoaded ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            style={{
              maxWidth: zoomLevel <= 1 ? '100%' : 'none',
              maxHeight: zoomLevel <= 1 ? '100%' : 'none',
              width: zoomLevel > 1 ? canvasW * zoomLevel : undefined,
              height: zoomLevel > 1 ? canvasH * zoomLevel : undefined,
              objectFit: 'contain',
              touchAction: 'none',
              cursor: dragRef.current ? 'grabbing' : 'default',
              borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              transformOrigin: 'center center',
              ...(zoomLevel < 1 && { transform: `scale(${zoomLevel})` }),
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
      </div>

      {/* Bottom tray */}
      <div
        className="shrink-0 px-4 pb-4 pt-3"
        style={{ background: '#0f1117', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Instructions when no objects placed */}
        {objects.length === 0 && (
          <div className="mb-3 text-center">
            <p className="text-sm text-gray-300">Add your product cutouts to place on this image</p>
            <p className="mt-1 text-xs text-gray-500">Upload PNG with transparent background, or use Remove BG first</p>
          </div>
        )}

        {/* Selected object actions */}
        {selectedObj && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Selected:</span>
            <button
              onClick={() => void autoSplit(selectedObj.id)}
              disabled={splittingId !== null}
              className="rounded-md px-3 py-1.5 text-xs text-green-400 transition-colors hover:text-green-300 disabled:opacity-40"
              style={{ background: 'rgba(22,163,74,0.08)' }}
            >
              {splittingId === selectedObj.id ? '⏳ Splitting…' : '✂ Split Objects'}
            </button>
            <button
              onClick={rotate90}
              className="rounded-md px-3 py-1.5 text-xs text-gray-300 transition-colors hover:text-white"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              ↺ Rotate 90°
            </button>
            <button
              onClick={bringForward}
              className="rounded-md px-3 py-1.5 text-xs text-gray-300 transition-colors hover:text-white"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              ↑ Forward
            </button>
            <button
              onClick={deleteSelected}
              className="rounded-md px-3 py-1.5 text-xs text-red-400 transition-colors hover:text-red-300"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              ✕ Delete
            </button>
          </div>
        )}

        {/* AI Blend action */}
        {objects.length > 0 && (
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => void handleAiBlend()}
              disabled={blending || objects.length === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: '#7c3aed' }}
            >
              {blending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Blending…
                </>
              ) : (
                '✨ AI Blend · 1 credit'
              )}
            </button>
            <span className="text-xs text-gray-500">
              Smooths edges so objects look naturally placed
            </span>
          </div>
        )}

        {/* Cutout thumbnails + Add button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="mr-1 shrink-0 text-xs text-gray-500">Cutouts:</span>

          {/* Placed objects */}
          {objects.map(obj => (
            <div key={obj.id} className="group relative shrink-0">
              <button
                onClick={() => setSelectedId(obj.id)}
                className="relative overflow-hidden rounded-lg transition-all"
                style={{
                  width: 56,
                  height: 56,
                  background: 'rgba(255,255,255,0.04)',
                  border: selectedId === obj.id
                    ? '2px solid #16a34a'
                    : '2px solid rgba(255,255,255,0.1)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={obj.src} alt="" className="h-full w-full object-contain p-1" />
                {splittingId === obj.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                  </div>
                )}
              </button>
              {/* Delete hover button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  objImgsRef.current.delete(obj.id);
                  setObjects(prev => prev.filter(o => o.id !== obj.id));
                  if (selectedId === obj.id) setSelectedId(null);
                }}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}
                title="Remove from canvas"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Gallery images not yet placed */}
          {galleryImages
            .filter(src => !objects.some(o => o.src === src))
            .map(src => (
              <button
                key={src}
                onClick={() => void addObject(src)}
                className="relative shrink-0 overflow-hidden rounded-lg transition-all hover:border-green-500/50"
                style={{
                  width: 56,
                  height: 56,
                  background: 'rgba(255,255,255,0.04)',
                  border: '2px dashed rgba(255,255,255,0.15)',
                }}
                title="Add to canvas"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-contain p-1 opacity-50 transition-opacity hover:opacity-80" />
              </button>
            ))}

          {/* Upload cutout — prominent */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-green-400 transition-all hover:bg-green-500/10 hover:text-green-300"
            style={{
              border: '2px dashed rgba(22,163,74,0.4)',
              background: 'rgba(22,163,74,0.05)',
              minHeight: 56,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Upload Cutout
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
