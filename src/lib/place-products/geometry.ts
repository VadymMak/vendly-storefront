// Pure geometry for Place Products (desktop editor + mobile page). No DOM, no React.
// Objects use normalized centre positions (0..1 of the canvas), `scale` = canvas px per
// natural image px, `rotation` in radians — see PlacedObject in src/lib/types.ts.
import type { PlacedObject } from '@/lib/types';

export interface Point {
  x: number;
  y: number;
}

export type HitType = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rotate';

export interface HandleOptions {
  /** Distance of the rotate handle above the top edge, canvas px */
  rotateOffset: number;
  /** Hit radius around corner/rotate handles, canvas px (desktop 11, touch ≥22) */
  hitRadius: number;
}

export function ptDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function rotPt(px: number, py: number, cx: number, cy: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  };
}

/** Centre, half-size and rotated corner / handle points of an object, in canvas px. */
export function getObjBounds(obj: PlacedObject, cw: number, ch: number, rotateOffset: number) {
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
    rotHandle: rotPt(cx, cy - hh - rotateOffset, cx, cy, r),
  };
}

/** Point-in-rotated-rectangle test. */
export function isInsideObj(px: number, py: number, obj: PlacedObject, cw: number, ch: number): boolean {
  const dx = px - obj.x * cw;
  const dy = py - obj.y * ch;
  const cos = Math.cos(-obj.rotation);
  const sin = Math.sin(-obj.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= (obj.scale * obj.naturalWidth) / 2 && Math.abs(ly) <= (obj.scale * obj.naturalHeight) / 2;
}

/** Which part of the selected object a point hits: a handle, the body, or nothing. */
export function hitTestSelected(
  px: number,
  py: number,
  obj: PlacedObject,
  cw: number,
  ch: number,
  { rotateOffset, hitRadius }: HandleOptions,
): HitType | null {
  const b = getObjBounds(obj, cw, ch, rotateOffset);
  if (ptDist(px, py, b.rotHandle.x, b.rotHandle.y) <= hitRadius) return 'rotate';
  if (ptDist(px, py, b.tl.x, b.tl.y) <= hitRadius) return 'tl';
  if (ptDist(px, py, b.tr.x, b.tr.y) <= hitRadius) return 'tr';
  if (ptDist(px, py, b.bl.x, b.bl.y) <= hitRadius) return 'bl';
  if (ptDist(px, py, b.br.x, b.br.y) <= hitRadius) return 'br';
  if (isInsideObj(px, py, obj, cw, ch)) return 'move';
  return null;
}

/** Scale that fits an image into `fraction` of the canvas (never upscales past 1:1). */
export function fitScale(naturalW: number, naturalH: number, cw: number, ch: number, fraction: number): number {
  return Math.min((cw * fraction) / naturalW, (ch * fraction) / naturalH, 1);
}

/** Canvas size for a background, longest side = maxSide, aspect kept. */
export function canvasSizeFor(naturalW: number, naturalH: number, maxSide: number): { w: number; h: number } {
  const ratio = naturalW / naturalH;
  return ratio >= 1
    ? { w: maxSide, h: Math.round(maxSide / ratio) }
    : { w: Math.round(maxSide * ratio), h: maxSide };
}

/**
 * Two-finger gesture relative to its start: distance ratio (pinch) and angle change in
 * radians (twist), from the start and current positions of both pointers.
 */
export function twoFingerDelta(startA: Point, startB: Point, curA: Point, curB: Point): { scaleRatio: number; angleDelta: number } {
  const startDist = ptDist(startA.x, startA.y, startB.x, startB.y);
  const curDist = ptDist(curA.x, curA.y, curB.x, curB.y);
  const startAngle = Math.atan2(startB.y - startA.y, startB.x - startA.x);
  const curAngle = Math.atan2(curB.y - curA.y, curB.x - curA.x);
  return {
    scaleRatio: startDist > 0 ? curDist / startDist : 1,
    angleDelta: curAngle - startAngle,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
