import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TextOverlay } from '@/lib/slideshow-renderer';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt?: string;
  model?: string;
  provider?: string;
  preset?: string;
  format?: string;
  duration?: number;
  createdAt: number;
}

// ── Timeline types ────────────────────────────────────────────────────────────

export interface TimelineClip {
  id: string;
  trackId: string;
  type: 'image' | 'video' | 'text' | 'audio';
  startTime: number;
  duration: number;
  sourceUrl?: string;
  prompt?: string;
  overlayData?: TextOverlay;
  audioName?: string;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'text' | 'audio';
  label: string;
  clips: TimelineClip[];
  locked: boolean;
  visible: boolean;
  height: number;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface StudioStore {
  generatedImages: MediaItem[];
  addImage: (item: MediaItem) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;

  generatedVideos: MediaItem[];
  addVideo: (item: MediaItem) => void;
  removeVideo: (id: string) => void;
  clearVideos: () => void;

  timelineItems: MediaItem[];
  addToTimeline: (item: Omit<MediaItem, 'id' | 'createdAt'>) => void;
  removeFromTimeline: (id: string) => void;
  reorderTimeline: (fromIndex: number, toIndex: number) => void;
  clearTimeline: () => void;

  textOverlays: TextOverlay[];
  setTextOverlays: (overlays: TextOverlay[]) => void;
  addTextOverlay: (overlay: TextOverlay) => void;
  removeTextOverlay: (index: number) => void;
  updateTextOverlay: (index: number, overlay: TextOverlay) => void;

  // ── Multi-track timeline ──────────────────────────────────────────────────
  timelineTracks: TimelineTrack[];
  initDefaultTracks: () => void;
  addTrack: (type: 'video' | 'text' | 'audio') => void;
  removeTrack: (trackId: string) => void;

  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId'>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  trimClip: (clipId: string, newStartTime: number, newDuration: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  restoreClip: (clip: TimelineClip) => void;
  clearAllTracks: () => void;

  playheadTime: number;
  setPlayheadTime: (time: number) => void;

  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;

  timelineZoom: number;
  setTimelineZoom: (zoom: number) => void;

  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;

  musicDataUrl: string | null;
  musicName: string | null;
  setMusic: (dataUrl: string | null, name: string | null) => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function makeTrack(type: 'video' | 'text' | 'audio', label: string): TimelineTrack {
  return {
    id: uid(),
    type,
    label,
    clips: [],
    locked: false,
    visible: true,
    height: type === 'video' ? 56 : 36,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      // ── Images ──────────────────────────────────────────────────────────────
      generatedImages: [],
      addImage: (item) =>
        set((s) => ({ generatedImages: [item, ...s.generatedImages].slice(0, 100) })),
      removeImage: (id) =>
        set((s) => ({ generatedImages: s.generatedImages.filter((i) => i.id !== id) })),
      clearImages: () => set({ generatedImages: [] }),

      // ── Videos ──────────────────────────────────────────────────────────────
      generatedVideos: [],
      addVideo: (item) =>
        set((s) => ({ generatedVideos: [item, ...s.generatedVideos].slice(0, 50) })),
      removeVideo: (id) =>
        set((s) => ({ generatedVideos: s.generatedVideos.filter((i) => i.id !== id) })),
      clearVideos: () => set({ generatedVideos: [] }),

      // ── Legacy timeline items (kept for migration) ────────────────────────
      timelineItems: [],
      addToTimeline: (item) =>
        set((s) => {
          const next: MediaItem = { ...item, id: uid(), createdAt: Date.now() };
          return { timelineItems: [...s.timelineItems, next].slice(0, 30) };
        }),
      removeFromTimeline: (id) =>
        set((s) => ({ timelineItems: s.timelineItems.filter((i) => i.id !== id) })),
      reorderTimeline: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.timelineItems];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { timelineItems: arr };
        }),
      clearTimeline: () => set({ timelineItems: [] }),

      // ── Text overlays ────────────────────────────────────────────────────
      textOverlays: [],
      setTextOverlays: (overlays) => set({ textOverlays: overlays }),
      addTextOverlay: (overlay) =>
        set((s) => ({ textOverlays: [...s.textOverlays, overlay] })),
      removeTextOverlay: (index) =>
        set((s) => ({ textOverlays: s.textOverlays.filter((_, i) => i !== index) })),
      updateTextOverlay: (index, overlay) =>
        set((s) => {
          const next = [...s.textOverlays];
          next[index] = overlay;
          return { textOverlays: next };
        }),

      // ── Multi-track timeline ─────────────────────────────────────────────
      timelineTracks: [],

      initDefaultTracks: () => {
        const { timelineTracks, timelineItems, textOverlays } = get();
        if (timelineTracks.length > 0) return;

        const videoTrack = makeTrack('video', 'Video 1');
        const textTrack  = makeTrack('text', 'Text');
        const audioTrack = makeTrack('audio', 'Audio');

        // Migrate legacy timelineItems → video clips
        let cursor = 0;
        for (const item of timelineItems) {
          const dur = item.duration ?? (item.type === 'video' ? 5 : 3);
          videoTrack.clips.push({
            id: uid(),
            trackId: videoTrack.id,
            type: item.type,
            startTime: cursor,
            duration: dur,
            sourceUrl: item.url,
            prompt: item.prompt,
          });
          cursor += dur;
        }

        // Migrate text overlays → text clips (span full video duration or 3s each)
        const totalVideoDur = cursor || 10;
        let textCursor = 0;
        for (const overlay of textOverlays) {
          const dur = overlay.scope === 'scene' ? 3 : totalVideoDur;
          textTrack.clips.push({
            id: uid(),
            trackId: textTrack.id,
            type: 'text',
            startTime: textCursor,
            duration: dur,
            overlayData: overlay,
          });
          if (overlay.scope === 'scene') textCursor += dur;
        }

        set({ timelineTracks: [videoTrack, textTrack, audioTrack] });
      },

      addTrack: (type) =>
        set((s) => {
          const count = s.timelineTracks.filter(t => t.type === type).length;
          const label = type === 'video' ? `Video ${count + 1}` : type === 'text' ? 'Text' : 'Audio';
          return { timelineTracks: [...s.timelineTracks, makeTrack(type, label)] };
        }),

      removeTrack: (trackId) =>
        set((s) => ({ timelineTracks: s.timelineTracks.filter(t => t.id !== trackId) })),

      // ── Clip operations ──────────────────────────────────────────────────
      addClipToTrack: (trackId, clip) =>
        set((s) => {
          const newClip: TimelineClip = { ...clip, id: uid(), trackId };
          return {
            timelineTracks: s.timelineTracks.map(t =>
              t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
            ),
          };
        }),

      removeClip: (clipId) =>
        set((s) => ({
          timelineTracks: s.timelineTracks.map(t => ({
            ...t,
            clips: t.clips.filter(c => c.id !== clipId),
          })),
          selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
        })),

      moveClip: (clipId, newTrackId, newStartTime) =>
        set((s) => {
          let movingClip: TimelineClip | null = null;
          const withoutClip = s.timelineTracks.map(t => {
            const found = t.clips.find(c => c.id === clipId);
            if (found) { movingClip = found; }
            return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
          });
          if (!movingClip) return s;
          const updated = { ...(movingClip as TimelineClip), trackId: newTrackId, startTime: newStartTime };
          return {
            timelineTracks: withoutClip.map(t =>
              t.id === newTrackId ? { ...t, clips: [...t.clips, updated] } : t
            ),
          };
        }),

      trimClip: (clipId, newStartTime, newDuration) =>
        set((s) => ({
          timelineTracks: s.timelineTracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? { ...c, startTime: Math.max(0, newStartTime), duration: Math.max(0.1, newDuration) }
                : c
            ),
          })),
        })),

      splitClip: (clipId, splitTime) =>
        set((s) => {
          let splitResult: { left: TimelineClip; right: TimelineClip } | null = null;
          const tracks = s.timelineTracks.map(t => {
            const clip = t.clips.find(c => c.id === clipId);
            if (!clip) return t;
            if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return t;
            const leftDur  = splitTime - clip.startTime;
            const rightDur = clip.duration - leftDur;
            const left:  TimelineClip = { ...clip, id: uid(), duration: leftDur };
            const right: TimelineClip = { ...clip, id: uid(), startTime: splitTime, duration: rightDur };
            splitResult = { left, right };
            return { ...t, clips: [...t.clips.filter(c => c.id !== clipId), left, right] };
          });
          return splitResult ? { timelineTracks: tracks, selectedClipId: null } : s;
        }),

      duplicateClip: (clipId) =>
        set((s) => {
          let newClip: TimelineClip | null = null;
          const tracks = s.timelineTracks.map(t => {
            const clip = t.clips.find(c => c.id === clipId);
            if (!clip) return t;
            const insertAt = clip.startTime + clip.duration;
            newClip = { ...clip, id: uid(), startTime: insertAt };
            const shifted = t.clips.map(c => {
              if (c.id === clipId) return c;
              if (c.startTime >= insertAt) return { ...c, startTime: c.startTime + clip.duration };
              return c;
            });
            return { ...t, clips: [...shifted, newClip!] };
          });
          return newClip ? { timelineTracks: tracks, selectedClipId: (newClip as TimelineClip).id } : s;
        }),

      restoreClip: (clip) =>
        set((s) => ({
          timelineTracks: s.timelineTracks.map(t =>
            t.id === clip.trackId ? { ...t, clips: [...t.clips, clip] } : t
          ),
        })),

      clearAllTracks: () =>
        set((s) => ({
          timelineTracks: s.timelineTracks.map(t => ({ ...t, clips: [] })),
        })),

      // ── Playhead ─────────────────────────────────────────────────────────
      playheadTime: 0,
      setPlayheadTime: (time) => set({ playheadTime: Math.max(0, time) }),

      // ── Playback ─────────────────────────────────────────────────────────
      isPlaying: false,
      setIsPlaying: (v) => set({ isPlaying: v }),

      // ── Zoom ─────────────────────────────────────────────────────────────
      timelineZoom: 80,
      setTimelineZoom: (zoom) => set({ timelineZoom: Math.min(400, Math.max(20, zoom)) }),

      // ── Selection ────────────────────────────────────────────────────────
      selectedClipId: null,
      setSelectedClipId: (id) => set({ selectedClipId: id }),

      // ── Music (persisted as data URL) ─────────────────────────────────────
      musicDataUrl: null,
      musicName: null,
      setMusic: (dataUrl, name) => set({ musicDataUrl: dataUrl, musicName: name }),
    }),
    {
      name: 'studio-session',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try { return sessionStorage.getItem(name); } catch { return null; }
        },
        setItem: (name: string, value: string) => {
          try {
            sessionStorage.setItem(name, value);
          } catch {
            // QuotaExceededError — store works in-memory, state just won't survive reload
            console.warn('[studio-store] sessionStorage quota exceeded, state not persisted');
          }
        },
        removeItem: (name: string) => {
          try { sessionStorage.removeItem(name); } catch { /* ignore */ }
        },
      })),
      partialize: (s) => ({
        // Omit musicDataUrl (can be 3-10 MB base64) and generated arrays
        // to stay well within the 5 MB sessionStorage limit.
        // Keep idb:// keys (< 50 bytes); strip data:/blob: URLs (can be MBs).
        timelineItems:  s.timelineItems,
        textOverlays:   s.textOverlays,
        timelineTracks: s.timelineTracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            const { overlayData: _o, ...rest } = c;
            if (rest.sourceUrl && !rest.sourceUrl.startsWith('idb://')) {
              const { sourceUrl: _s, ...lightClip } = rest;
              return lightClip;
            }
            return rest;
          }),
        })),
        timelineZoom:   s.timelineZoom,
        musicName:      s.musicName,
      }),
    },
  ),
);
