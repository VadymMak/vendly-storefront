export interface AssemblyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  clipDuration: [number, number];
  transition: 'cut' | 'fade' | 'dissolve' | 'slide';
  transitionDuration: number;
  syncToBeats: boolean;
  beatDivisor: number;
  textOverlayChance: number;
  introClipDuration?: number;
  outroClipDuration?: number;
}

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [
  {
    id: 'fast-paced',
    name: 'Fast Paced',
    description: 'Quick cuts on every beat, energetic',
    icon: '⚡',
    clipDuration: [1.5, 3],
    transition: 'cut',
    transitionDuration: 0,
    syncToBeats: true,
    beatDivisor: 2,
    textOverlayChance: 0,
    introClipDuration: 3,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Long takes with smooth fades',
    icon: '🎬',
    clipDuration: [4, 8],
    transition: 'dissolve',
    transitionDuration: 0.8,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.1,
    introClipDuration: 6,
    outroClipDuration: 5,
  },
  {
    id: 'travel',
    name: 'Travel',
    description: 'Medium clips synced to music beats',
    icon: '✈️',
    clipDuration: [2, 4],
    transition: 'slide',
    transitionDuration: 0.4,
    syncToBeats: true,
    beatDivisor: 4,
    textOverlayChance: 0.15,
  },
  {
    id: 'wedding',
    name: 'Wedding',
    description: 'Soft, elegant transitions',
    icon: '💍',
    clipDuration: [3, 6],
    transition: 'fade',
    transitionDuration: 1.0,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.05,
    introClipDuration: 5,
    outroClipDuration: 6,
  },
  {
    id: 'product',
    name: 'Product',
    description: 'Clean cuts for product showcase',
    icon: '📦',
    clipDuration: [2, 4],
    transition: 'fade',
    transitionDuration: 0.3,
    syncToBeats: true,
    beatDivisor: 2,
    textOverlayChance: 0.2,
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Very fast, attention-grabbing cuts',
    icon: '📱',
    clipDuration: [1, 2.5],
    transition: 'cut',
    transitionDuration: 0,
    syncToBeats: true,
    beatDivisor: 1,
    textOverlayChance: 0.3,
  },
  {
    id: 'vlog',
    name: 'Vlog',
    description: 'Natural pacing, dialogue-friendly',
    icon: '🎥',
    clipDuration: [3, 5],
    transition: 'dissolve',
    transitionDuration: 0.5,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.1,
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Ultra-fast cuts, high energy',
    icon: '🏃',
    clipDuration: [1, 2],
    transition: 'cut',
    transitionDuration: 0,
    syncToBeats: true,
    beatDivisor: 1,
    textOverlayChance: 0,
  },
];
