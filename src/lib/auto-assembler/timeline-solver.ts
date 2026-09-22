import type { TimelineClip } from '@/lib/studio/store';
import type { AssemblyTemplate } from './templates';
import type { BrandKit } from '@/lib/studio/brand-kit';

export interface ClipSource {
  id: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  prompt?: string;
}

interface SolverInput {
  clips: ClipSource[];
  template: AssemblyTemplate;
  beats: number[];
  musicDuration: number;
  brandKit?: BrandKit | null;
  /** Max times each source clip may repeat. Default 2 → short SMB video. */
  maxRepeats?: number;
  /** Explicit target duration in seconds. Overrides maxRepeats-based cap. */
  targetDuration?: number;
}

interface SolverOutput {
  videoClips: Omit<TimelineClip, 'id' | 'trackId'>[];
  textClips: Omit<TimelineClip, 'id' | 'trackId'>[];
  totalDuration: number;
}

export function solveTimeline(input: SolverInput): SolverOutput {
  const { clips, beats, musicDuration, brandKit } = input;
  // template may be mutated below; keep original immutable
  const template = { ...input.template };

  if (clips.length === 0) return { videoClips: [], textClips: [], totalDuration: 0 };

  const [minDur, maxDur] = template.clipDuration;
  const maxRepeats = input.maxRepeats ?? 2;

  // Effective duration: targetDuration wins if set; else cap by maxRepeats
  const effectiveMusicDuration = input.targetDuration != null
    ? (musicDuration > 0 ? Math.min(input.targetDuration, musicDuration) : input.targetDuration)
    : Math.min(musicDuration, clips.length * maxRepeats * maxDur);

  // Max clips: if targetDuration explicit, allow enough to fill it; else cap by maxRepeats
  const maxClips = input.targetDuration != null
    ? Math.ceil(effectiveMusicDuration / minDur)
    : clips.length * maxRepeats;

  // Clamp transition duration to at most half the minimum clip duration
  if (template.transitionDuration > 0) {
    const minPossibleClip = minDur;
    if (template.transitionDuration >= minPossibleClip) {
      template.transitionDuration = Math.min(template.transitionDuration, minPossibleClip * 0.5);
    }
  }

  let cutPoints: number[];

  if (template.syncToBeats && beats.length > 0) {
    const filteredBeats = beats.filter((_, i) => i % template.beatDivisor === 0);
    cutPoints = [0];
    let lastCut = 0;

    for (const beat of filteredBeats) {
      if (beat <= 0 || beat > effectiveMusicDuration) continue;
      const gap = beat - lastCut;
      if (gap >= minDur) {
        cutPoints.push(beat);
        lastCut = beat;
      } else if (gap > maxDur) {
        cutPoints.push(lastCut + maxDur);
        lastCut += maxDur;
      }
    }
  } else {
    cutPoints = [0];
    const avgDur = (minDur + maxDur) / 2;
    let t = 0;
    while (t + avgDur <= effectiveMusicDuration) {
      t += avgDur;
      cutPoints.push(parseFloat(t.toFixed(3)));
    }
  }

  const totalDuration = Math.min(effectiveMusicDuration, cutPoints.at(-1)! + maxDur);

  const allSegments: { start: number; duration: number }[] = [];
  for (let i = 0; i < cutPoints.length; i++) {
    const start = cutPoints[i];
    const end = i < cutPoints.length - 1 ? cutPoints[i + 1] : totalDuration;
    const duration = parseFloat((end - start).toFixed(3));
    if (duration >= 0.3) allSegments.push({ start, duration });
  }

  // Hard cap: never exceed maxClips segments
  const segments = allSegments.slice(0, maxClips);

  const videoClips: Omit<TimelineClip, 'id' | 'trackId'>[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg  = segments[i];
    const clip = clips[i % clips.length];
    const dur  = clip.type === 'video' && clip.duration
      ? Math.min(seg.duration, clip.duration)
      : seg.duration;

    videoClips.push({
      type:      clip.type,
      startTime: seg.start,
      duration:  dur,
      sourceUrl: clip.url,
      prompt:    clip.prompt,
    });
  }

  // Recalculate actual total after slicing
  const actualTotal = videoClips.reduce(
    (max, c) => Math.max(max, c.startTime + c.duration), 0
  );

  // ── Brand text overlays ────────────────────────────────────────────────────

  const textClips: Omit<TimelineClip, 'id' | 'trackId'>[] = [];

  if (brandKit && template.defaultTexts && template.defaultTexts.length > 0) {
    const introDur = template.introClipDuration ?? 3;
    const outroDur = template.outroClipDuration ?? 4;

    for (const textDef of template.defaultTexts) {
      let text = textDef.placeholder;
      if (brandKit.businessName) {
        if (text === 'Your Business Name' || text === 'Product Name') {
          text = brandKit.businessName;
        }
      }
      if (textDef.style === 'cta' && brandKit.defaultCta) {
        text = brandKit.defaultCta;
      }

      let startTime = 0;
      let duration = introDur;
      if (textDef.position === 'top') {
        startTime = 0;
        duration = Math.min(introDur, actualTotal);
      } else if (textDef.position === 'bottom') {
        duration = Math.min(outroDur, actualTotal);
        startTime = Math.max(0, actualTotal - duration);
      } else {
        startTime = actualTotal * 0.2;
        duration = actualTotal * 0.6;
      }

      let color = '#FFFFFF';
      let barColor: string | undefined;
      if (textDef.style === 'brand') color = brandKit.primaryColor;
      if (textDef.style === 'cta')   color = brandKit.accentColor;
      if (textDef.style === 'bar')   { barColor = brandKit.primaryColor; color = '#FFFFFF'; }

      textClips.push({
        type: 'text',
        startTime: parseFloat(startTime.toFixed(3)),
        duration:  parseFloat(Math.max(0.5, duration).toFixed(3)),
        overlayData: {
          text,
          style:      textDef.style,
          position:   textDef.position,
          scope:      'global',
          animation:  'fade-in',
          fontFamily: brandKit.fontFamily || 'Inter',
          color,
          ...(barColor ? { barColor } : {}),
          fontSize: textDef.style === 'brand' ? 72 : textDef.style === 'cta' ? 56 : 48,
        },
      });
    }
  }

  return { videoClips, textClips, totalDuration: actualTotal };
}
