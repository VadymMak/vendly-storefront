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

  // ── Business-specific fields ──
  category: 'promotion' | 'sale' | 'showcase' | 'food' | 'service' | 'portfolio';
  suggestedAspects: ('9:16' | '4:5' | '1:1' | '16:9')[];
  defaultTexts: {
    position: 'top' | 'center' | 'bottom';
    placeholder: string;
    style: 'brand' | 'subtitle' | 'cta' | 'bar';
  }[];
  musicMood: string;
  colorMood: 'warm' | 'cool' | 'energetic' | 'elegant' | 'earthy' | 'bold';
}

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [
  {
    id: 'product-promo',
    name: 'Product Promo',
    description: 'Showcase a product with clean transitions',
    icon: '🛍️',
    category: 'promotion',
    clipDuration: [2, 4],
    transition: 'fade',
    transitionDuration: 0.3,
    syncToBeats: true,
    beatDivisor: 2,
    textOverlayChance: 0.3,
    introClipDuration: 3,
    outroClipDuration: 4,
    suggestedAspects: ['9:16', '4:5', '1:1'],
    defaultTexts: [
      { position: 'top', placeholder: 'Product Name', style: 'brand' },
      { position: 'bottom', placeholder: 'Shop Now →', style: 'cta' },
    ],
    musicMood: 'upbeat-modern',
    colorMood: 'cool',
  },
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    description: 'Fast cuts, urgency, countdown energy',
    icon: '🔥',
    category: 'sale',
    clipDuration: [1, 2.5],
    transition: 'cut',
    transitionDuration: 0,
    syncToBeats: true,
    beatDivisor: 1,
    textOverlayChance: 0.4,
    introClipDuration: 2,
    suggestedAspects: ['9:16', '4:5'],
    defaultTexts: [
      { position: 'top', placeholder: '-50% OFF', style: 'brand' },
      { position: 'center', placeholder: 'Limited Time Only', style: 'subtitle' },
      { position: 'bottom', placeholder: 'Order Now', style: 'cta' },
    ],
    musicMood: 'energetic-urgent',
    colorMood: 'bold',
  },
  {
    id: 'menu-of-day',
    name: 'Menu of Day',
    description: 'Warm food showcase, appetizing pacing',
    icon: '🍽️',
    category: 'food',
    clipDuration: [2.5, 4.5],
    transition: 'dissolve',
    transitionDuration: 0.6,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.25,
    introClipDuration: 3,
    outroClipDuration: 4,
    suggestedAspects: ['4:5', '9:16', '1:1'],
    defaultTexts: [
      { position: 'top', placeholder: "Today's Special", style: 'brand' },
      { position: 'bottom', placeholder: 'Reserve a Table', style: 'cta' },
    ],
    musicMood: 'warm-acoustic',
    colorMood: 'warm',
  },
  {
    id: 'new-arrival',
    name: 'New Arrival',
    description: 'Build anticipation, reveal product',
    icon: '🆕',
    category: 'promotion',
    clipDuration: [2, 3.5],
    transition: 'slide',
    transitionDuration: 0.4,
    syncToBeats: true,
    beatDivisor: 2,
    textOverlayChance: 0.2,
    introClipDuration: 3,
    outroClipDuration: 3,
    suggestedAspects: ['9:16', '4:5'],
    defaultTexts: [
      { position: 'top', placeholder: 'Just Dropped', style: 'brand' },
      { position: 'center', placeholder: 'Product Name', style: 'subtitle' },
      { position: 'bottom', placeholder: 'Get Yours →', style: 'cta' },
    ],
    musicMood: 'trendy-pop',
    colorMood: 'cool',
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'Transformation reveal — beauty, repair',
    icon: '✂️',
    category: 'service',
    clipDuration: [3, 5],
    transition: 'fade',
    transitionDuration: 0.5,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.15,
    introClipDuration: 4,
    outroClipDuration: 4,
    suggestedAspects: ['9:16', '4:5', '1:1'],
    defaultTexts: [
      { position: 'top', placeholder: 'Before', style: 'subtitle' },
      { position: 'bottom', placeholder: 'Book Now', style: 'cta' },
    ],
    musicMood: 'inspiring',
    colorMood: 'elegant',
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Elegant slow reveal of your best work',
    icon: '📸',
    category: 'portfolio',
    clipDuration: [3, 6],
    transition: 'dissolve',
    transitionDuration: 0.8,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.1,
    introClipDuration: 5,
    outroClipDuration: 5,
    suggestedAspects: ['1:1', '4:5', '16:9'],
    defaultTexts: [
      { position: 'bottom', placeholder: 'Your Business Name', style: 'brand' },
    ],
    musicMood: 'ambient-chill',
    colorMood: 'elegant',
  },
  {
    id: 'social-story',
    name: 'Social Story',
    description: 'Ultra-fast 15s story for TikTok/Reels',
    icon: '📱',
    category: 'promotion',
    clipDuration: [1, 2],
    transition: 'cut',
    transitionDuration: 0,
    syncToBeats: true,
    beatDivisor: 1,
    textOverlayChance: 0.35,
    suggestedAspects: ['9:16'],
    defaultTexts: [
      { position: 'center', placeholder: 'Your message here', style: 'brand' },
      { position: 'bottom', placeholder: 'Swipe Up ↑', style: 'cta' },
    ],
    musicMood: 'trending-viral',
    colorMood: 'energetic',
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    description: 'Customer photos with quote overlays',
    icon: '⭐',
    category: 'showcase',
    clipDuration: [3, 5],
    transition: 'fade',
    transitionDuration: 0.4,
    syncToBeats: false,
    beatDivisor: 4,
    textOverlayChance: 0.5,
    introClipDuration: 3,
    outroClipDuration: 4,
    suggestedAspects: ['4:5', '1:1', '9:16'],
    defaultTexts: [
      { position: 'top', placeholder: '★★★★★', style: 'brand' },
      { position: 'center', placeholder: '"Customer quote here"', style: 'subtitle' },
      { position: 'bottom', placeholder: 'Visit Us', style: 'cta' },
    ],
    musicMood: 'feel-good',
    colorMood: 'warm',
  },
];
