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
}

interface SolverOutput {
  videoClips: Omit<TimelineClip, 'id' | 'trackId'>[];
  textClips: Omit<TimelineClip, 'id' | 'trackId'>[];
  totalDuration: number;
}

export function solveTimeline(input: SolverInput): SolverOutput {
  const { clips, template, beats, musicDuration, brandKit } = input;

  if (clips.length === 0) return { videoClips: [], textClips: [], totalDuration: 0 };

  const [minDur, maxDur] = template.clipDuration;
  let cutPoints: number[];

  if (template.syncToBeats && beats.length > 0) {
    const filteredBeats = beats.filter((_, i) => i % template.beatDivisor === 0);
    cutPoints = [0];
    let lastCut = 0;

    for (const beat of filteredBeats) {
      if (beat <= 0) continue;
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
    while (t + avgDur <= musicDuration) {
      t += avgDur;
      cutPoints.push(parseFloat(t.toFixed(3)));
    }
  }

  const totalDuration = Math.min(musicDuration, cutPoints.at(-1)! + maxDur);

  const segments: { start: number; duration: number }[] = [];
  for (let i = 0; i < cutPoints.length; i++) {
    const start = cutPoints[i];
    const end = i < cutPoints.length - 1 ? cutPoints[i + 1] : totalDuration;
    const duration = parseFloat((end - start).toFixed(3));
    if (duration >= 0.3) segments.push({ start, duration });
  }

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

  // ── Brand text overlays ────────────────────────────────────────────────────

  const textClips: Omit<TimelineClip, 'id' | 'trackId'>[] = [];

  if (brandKit && template.defaultTexts && template.defaultTexts.length > 0) {
    const introDur = template.introClipDuration ?? 3;
    const outroDur = template.outroClipDuration ?? 4;

    for (const textDef of template.defaultTexts) {
      // Resolve placeholder to brand value
      let text = textDef.placeholder;
      if (brandKit.businessName) {
        if (text === 'Your Business Name' || text === 'Product Name') {
          text = brandKit.businessName;
        }
      }
      if (textDef.style === 'cta' && brandKit.defaultCta) {
        text = brandKit.defaultCta;
      }

      // Timing by position
      let startTime = 0;
      let duration = introDur;
      if (textDef.position === 'top') {
        startTime = 0;
        duration = Math.min(introDur, totalDuration);
      } else if (textDef.position === 'bottom') {
        duration = Math.min(outroDur, totalDuration);
        startTime = Math.max(0, totalDuration - duration);
      } else {
        startTime = totalDuration * 0.2;
        duration = totalDuration * 0.6;
      }

      // Style-based colors
      let color = '#FFFFFF';
      let barColor: string | undefined;
      if (textDef.style === 'brand') color = brandKit.primaryColor;
      if (textDef.style === 'cta')   color = brandKit.accentColor;
      if (textDef.style === 'bar')   { barColor = brandKit.primaryColor; color = '#FFFFFF'; }

      textClips.push({
        type: 'text',
        startTime: parseFloat(startTime.toFixed(3)),
        duration:  parseFloat(duration.toFixed(3)),
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

  return { videoClips, textClips, totalDuration };
}
