import type { TextOverlay } from '@/lib/slideshow-renderer';

export interface TextPreset {
  name: string;
  category: 'basic' | 'artistic' | 'cinematic' | 'fun';
  style: Partial<TextOverlay>;
  requiredFonts?: string[];
}

export const PRESET_CATEGORIES = ['basic', 'artistic', 'cinematic', 'fun'] as const;
export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  basic:     'Basic',
  artistic:  'Artistic',
  cinematic: 'Cinematic',
  fun:       'Fun',
};

export const TEXT_PRESETS: TextPreset[] = [
  // ── Basic ──────────────────────────────────────────────────────────────────
  {
    name: 'Clean',
    category: 'basic',
    style: {
      style: 'custom',
      fontFamily: 'Inter',
      fontSize: 28,
      color: '#FFFFFF',
      fontWeight: 'normal',
      animation: 'fade-in',
    },
    requiredFonts: ['Inter'],
  },
  {
    name: 'Bold Impact',
    category: 'basic',
    style: {
      style: 'custom',
      fontFamily: 'Montserrat',
      fontSize: 42,
      color: '#FFFFFF',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 4,
      animation: 'slide-up',
    },
    requiredFonts: ['Montserrat'],
  },
  {
    name: 'Minimal',
    category: 'basic',
    style: {
      style: 'custom',
      fontFamily: 'DM Sans',
      fontSize: 22,
      color: '#EEEEEE',
      fontWeight: 'normal',
      letterSpacing: 2,
      opacity: 0.9,
      animation: 'fade-in',
    },
    requiredFonts: ['DM Sans'],
  },

  // ── Artistic ───────────────────────────────────────────────────────────────
  {
    name: 'Neon',
    category: 'artistic',
    style: {
      style: 'custom',
      fontFamily: 'Orbitron',
      fontSize: 36,
      color: '#FF00FF',
      fontWeight: 'bold',
      shadowColor: '#FF00FF',
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textTransform: 'uppercase',
      animation: 'fade-in',
    },
    requiredFonts: ['Orbitron'],
  },
  {
    name: 'Neon Blue',
    category: 'artistic',
    style: {
      style: 'custom',
      fontFamily: 'Orbitron',
      fontSize: 36,
      color: '#00F0FF',
      fontWeight: 'bold',
      shadowColor: '#00F0FF',
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textTransform: 'uppercase',
      animation: 'fade-in',
    },
    requiredFonts: ['Orbitron'],
  },
  {
    name: 'Outline',
    category: 'artistic',
    style: {
      style: 'custom',
      fontFamily: 'Bebas Neue',
      fontSize: 56,
      color: 'transparent',
      strokeColor: '#FFFFFF',
      strokeWidth: 2,
      textTransform: 'uppercase',
      letterSpacing: 6,
      animation: 'slide-left',
    },
    requiredFonts: ['Bebas Neue'],
  },
  {
    name: 'Retro',
    category: 'artistic',
    style: {
      style: 'custom',
      fontFamily: 'Press Start 2P',
      fontSize: 18,
      color: '#FFD700',
      shadowColor: '#FF4500',
      shadowBlur: 0,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      animation: 'fade-in',
    },
    requiredFonts: ['Press Start 2P'],
  },

  // ── Cinematic ──────────────────────────────────────────────────────────────
  {
    name: 'Cinematic',
    category: 'cinematic',
    style: {
      style: 'custom',
      fontFamily: 'Playfair Display',
      fontSize: 32,
      color: '#FFFFFF',
      fontWeight: 'normal',
      letterSpacing: 8,
      textTransform: 'uppercase',
      animation: 'fade-in',
      animationDuration: 1.2,
    },
    requiredFonts: ['Playfair Display'],
  },
  {
    name: 'Subtitle',
    category: 'cinematic',
    style: {
      style: 'subtitle',
      fontSize: 20,
      animation: 'fade-in',
    },
  },
  {
    name: 'Lower Third',
    category: 'cinematic',
    style: {
      style: 'bar',
      barColor: '#E85D04',
      animation: 'slide-left',
    },
  },

  // ── Fun ────────────────────────────────────────────────────────────────────
  {
    name: 'Handwritten',
    category: 'fun',
    style: {
      style: 'custom',
      fontFamily: 'Caveat',
      fontSize: 40,
      color: '#FFFFFF',
      fontWeight: 'normal',
      animation: 'fade-in',
    },
    requiredFonts: ['Caveat'],
  },
  {
    name: 'Tag',
    category: 'fun',
    style: {
      style: 'custom',
      fontFamily: 'Nunito',
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: 'bold',
      bgShape: 'pill',
      bgShapeColor: '#16a34a',
      bgShapeOpacity: 0.9,
      bgShapePadding: 14,
      animation: 'scale-up',
    },
    requiredFonts: ['Nunito'],
  },
];
