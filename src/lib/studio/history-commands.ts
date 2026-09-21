import { useStudioStore } from '@/lib/studio/store';
import { useHistoryStore } from '@/lib/studio/history';
import type { TimelineClip } from '@/lib/studio/store';
import type { TextOverlay } from '@/lib/slideshow-renderer';

export function removeClipWithHistory(clipId: string) {
  const store = useStudioStore.getState();
  const clip = store.timelineTracks.flatMap(t => t.clips).find(c => c.id === clipId);
  if (!clip) return;
  const snapshot: TimelineClip = { ...clip };

  useHistoryStore.getState().push({
    label: 'Delete clip',
    execute: () => useStudioStore.getState().removeClip(clipId),
    undo: () => useStudioStore.getState().restoreClip(snapshot),
  });
}

export function splitClipWithHistory(clipId: string, splitTime: number) {
  const store = useStudioStore.getState();
  const clip = store.timelineTracks.flatMap(t => t.clips).find(c => c.id === clipId);
  if (!clip) return;
  const snapshot: TimelineClip = { ...clip };
  const idsBefore = new Set(
    store.timelineTracks.find(t => t.id === clip.trackId)?.clips.map(c => c.id) ?? []
  );
  let splitIds: string[] = [];

  useHistoryStore.getState().push({
    label: 'Split clip',
    execute: () => {
      useStudioStore.getState().splitClip(snapshot.id, splitTime);
      const trackAfter = useStudioStore.getState().timelineTracks.find(t => t.id === snapshot.trackId);
      splitIds = trackAfter?.clips.filter(c => !idsBefore.has(c.id)).map(c => c.id) ?? [];
    },
    undo: () => {
      const s = useStudioStore.getState();
      splitIds.forEach(id => s.removeClip(id));
      s.restoreClip(snapshot);
    },
  });
}

export function moveClipWithHistory(clipId: string, newTrackId: string, newStartTime: number) {
  const store = useStudioStore.getState();
  const clip = store.timelineTracks.flatMap(t => t.clips).find(c => c.id === clipId);
  if (!clip) return;
  const origTrackId = clip.trackId;
  const origStart = clip.startTime;

  useHistoryStore.getState().push({
    label: 'Move clip',
    execute: () => useStudioStore.getState().moveClip(clipId, newTrackId, newStartTime),
    undo: () => useStudioStore.getState().moveClip(clipId, origTrackId, origStart),
  });
}

export function trimClipWithHistory(clipId: string, newStart: number, newDuration: number) {
  const store = useStudioStore.getState();
  const clip = store.timelineTracks.flatMap(t => t.clips).find(c => c.id === clipId);
  if (!clip) return;
  const origStart = clip.startTime;
  const origDur = clip.duration;

  useHistoryStore.getState().push({
    label: 'Trim clip',
    execute: () => useStudioStore.getState().trimClip(clipId, newStart, newDuration),
    undo: () => useStudioStore.getState().trimClip(clipId, origStart, origDur),
  });
}

export function duplicateClipWithHistory(clipId: string) {
  const store = useStudioStore.getState();
  const clip = store.timelineTracks.flatMap(t => t.clips).find(c => c.id === clipId);
  if (!clip) return;
  const trackId = clip.trackId;
  const idsBefore = new Set(
    store.timelineTracks.find(t => t.id === trackId)?.clips.map(c => c.id) ?? []
  );
  let newClipId: string | null = null;

  useHistoryStore.getState().push({
    label: 'Duplicate clip',
    execute: () => {
      useStudioStore.getState().duplicateClip(clipId);
      const trackAfter = useStudioStore.getState().timelineTracks.find(t => t.id === trackId);
      newClipId = trackAfter?.clips.find(c => !idsBefore.has(c.id))?.id ?? null;
    },
    undo: () => {
      if (newClipId) useStudioStore.getState().removeClip(newClipId);
    },
  });
}

export function addTextOverlayWithHistory(overlay: TextOverlay) {
  useHistoryStore.getState().push({
    label: 'Add text',
    execute: () => useStudioStore.getState().addTextOverlay(overlay),
    undo: () => {
      const overlays = useStudioStore.getState().textOverlays;
      useStudioStore.getState().removeTextOverlay(overlays.length - 1);
    },
  });
}

export function removeTextOverlayWithHistory(index: number) {
  const overlay = useStudioStore.getState().textOverlays[index];
  if (!overlay) return;

  useHistoryStore.getState().push({
    label: 'Remove text',
    execute: () => useStudioStore.getState().removeTextOverlay(index),
    undo: () => {
      const overlays = useStudioStore.getState().textOverlays;
      useStudioStore.getState().setTextOverlays([
        ...overlays.slice(0, index),
        overlay,
        ...overlays.slice(index),
      ]);
    },
  });
}
