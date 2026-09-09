import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt?: string;
  model?: string;
  preset?: string;
  format?: string;
  duration?: number;
  createdAt: number;
}

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
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set) => ({
      generatedImages: [],
      addImage: (item) =>
        set((s) => ({ generatedImages: [item, ...s.generatedImages].slice(0, 100) })),
      removeImage: (id) =>
        set((s) => ({ generatedImages: s.generatedImages.filter((i) => i.id !== id) })),
      clearImages: () => set({ generatedImages: [] }),

      generatedVideos: [],
      addVideo: (item) =>
        set((s) => ({ generatedVideos: [item, ...s.generatedVideos].slice(0, 50) })),
      removeVideo: (id) =>
        set((s) => ({ generatedVideos: s.generatedVideos.filter((i) => i.id !== id) })),
      clearVideos: () => set({ generatedVideos: [] }),

      timelineItems: [],
      addToTimeline: (item) =>
        set((s) => {
          const next: MediaItem = { ...item, id: crypto.randomUUID(), createdAt: Date.now() };
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
    }),
    {
      name: 'studio-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
