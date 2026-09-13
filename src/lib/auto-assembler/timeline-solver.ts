import type { TimelineClip } from '@/lib/studio/store';
import type { AssemblyTemplate } from './templates';

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
}

interface SolverOutput {
  videoClips: Omit<TimelineClip, 'id' | 'trackId'>[];
  totalDuration: number;
}

export function solveTimeline(input: SolverInput): SolverOutput {
  const { clips, template, beats, musicDuration } = input;

  if (clips.length === 0) return { videoClips: [], totalDuration: 0 };

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

  return { videoClips, totalDuration };
}
