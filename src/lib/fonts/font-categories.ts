export type FontCategory = 'sans-serif' | 'serif' | 'handwritten' | 'display' | 'monospace';

export interface FontEntry {
  family: string;
  category: FontCategory;
  weight: number[];
  popular: boolean;
}

export const FONT_CATALOG: FontEntry[] = [
  // Sans-Serif
  { family: 'Roboto',            category: 'sans-serif', weight: [400, 700],               popular: true  },
  { family: 'Open Sans',         category: 'sans-serif', weight: [400, 600, 700],           popular: true  },
  { family: 'Montserrat',        category: 'sans-serif', weight: [400, 500, 600, 700, 800, 900], popular: true },
  { family: 'Lato',              category: 'sans-serif', weight: [400, 700],               popular: true  },
  { family: 'Inter',             category: 'sans-serif', weight: [400, 500, 600, 700],     popular: true  },
  { family: 'Poppins',           category: 'sans-serif', weight: [400, 500, 600, 700],     popular: true  },
  { family: 'Oswald',            category: 'sans-serif', weight: [400, 500, 600, 700],     popular: true  },
  { family: 'Nunito',            category: 'sans-serif', weight: [400, 600, 700],          popular: false },
  { family: 'Raleway',           category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Work Sans',         category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Outfit',            category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'DM Sans',           category: 'sans-serif', weight: [400, 500, 700],          popular: false },
  { family: 'Manrope',           category: 'sans-serif', weight: [400, 500, 600, 700, 800], popular: false },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', weight: [400, 500, 600, 700, 800], popular: false },
  { family: 'Source Sans 3',     category: 'sans-serif', weight: [400, 600, 700],          popular: false },
  { family: 'Rubik',             category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Quicksand',         category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Barlow',            category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Cabin',             category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Karla',             category: 'sans-serif', weight: [400, 500, 600, 700],     popular: false },

  // Serif
  { family: 'Playfair Display',   category: 'serif', weight: [400, 500, 600, 700, 800, 900], popular: true  },
  { family: 'Merriweather',       category: 'serif', weight: [400, 700],               popular: true  },
  { family: 'Lora',               category: 'serif', weight: [400, 500, 600, 700],     popular: true  },
  { family: 'PT Serif',           category: 'serif', weight: [400, 700],               popular: false },
  { family: 'Noto Serif',         category: 'serif', weight: [400, 700],               popular: false },
  { family: 'Libre Baskerville',  category: 'serif', weight: [400, 700],               popular: false },
  { family: 'Cormorant Garamond', category: 'serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'EB Garamond',        category: 'serif', weight: [400, 500, 600, 700, 800], popular: false },
  { family: 'Crimson Text',       category: 'serif', weight: [400, 600, 700],          popular: false },
  { family: 'DM Serif Display',   category: 'serif', weight: [400],                   popular: false },
  { family: 'Bitter',             category: 'serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Spectral',           category: 'serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Vollkorn',           category: 'serif', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Source Serif 4',     category: 'serif', weight: [400, 600, 700],          popular: false },

  // Handwritten
  { family: 'Dancing Script',      category: 'handwritten', weight: [400, 500, 600, 700], popular: true  },
  { family: 'Pacifico',            category: 'handwritten', weight: [400],               popular: true  },
  { family: 'Caveat',              category: 'handwritten', weight: [400, 500, 600, 700], popular: true  },
  { family: 'Great Vibes',         category: 'handwritten', weight: [400],               popular: false },
  { family: 'Satisfy',             category: 'handwritten', weight: [400],               popular: false },
  { family: 'Sacramento',          category: 'handwritten', weight: [400],               popular: false },
  { family: 'Kalam',               category: 'handwritten', weight: [400, 700],          popular: false },
  { family: 'Courgette',           category: 'handwritten', weight: [400],               popular: false },
  { family: 'Amatic SC',           category: 'handwritten', weight: [400, 700],          popular: false },
  { family: 'Indie Flower',        category: 'handwritten', weight: [400],               popular: false },
  { family: 'Shadows Into Light',  category: 'handwritten', weight: [400],               popular: false },
  { family: 'Architects Daughter', category: 'handwritten', weight: [400],               popular: false },
  { family: 'Patrick Hand',        category: 'handwritten', weight: [400],               popular: false },
  { family: 'Permanent Marker',    category: 'handwritten', weight: [400],               popular: false },

  // Display
  { family: 'Bebas Neue',   category: 'display', weight: [400],                   popular: true  },
  { family: 'Anton',        category: 'display', weight: [400],                   popular: true  },
  { family: 'Abril Fatface', category: 'display', weight: [400],                  popular: false },
  { family: 'Righteous',    category: 'display', weight: [400],                   popular: false },
  { family: 'Bungee',       category: 'display', weight: [400],                   popular: false },
  { family: 'Orbitron',     category: 'display', weight: [400, 500, 600, 700, 800, 900], popular: false },
  { family: 'Russo One',    category: 'display', weight: [400],                   popular: false },
  { family: 'Staatliches',  category: 'display', weight: [400],                   popular: false },
  { family: 'Alfa Slab One', category: 'display', weight: [400],                  popular: false },
  { family: 'Black Ops One', category: 'display', weight: [400],                  popular: false },
  { family: 'Monoton',      category: 'display', weight: [400],                   popular: false },
  { family: 'Bungee Shade', category: 'display', weight: [400],                   popular: false },
  { family: 'Faster One',   category: 'display', weight: [400],                   popular: false },
  { family: 'Press Start 2P', category: 'display', weight: [400],                 popular: false },
  { family: 'Creepster',    category: 'display', weight: [400],                   popular: false },

  // Monospace
  { family: 'Fira Code',        category: 'monospace', weight: [400, 500, 600, 700],     popular: true  },
  { family: 'JetBrains Mono',   category: 'monospace', weight: [400, 500, 600, 700, 800], popular: true },
  { family: 'Source Code Pro',  category: 'monospace', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Space Mono',       category: 'monospace', weight: [400, 700],               popular: false },
  { family: 'IBM Plex Mono',    category: 'monospace', weight: [400, 500, 600, 700],     popular: false },
  { family: 'Inconsolata',      category: 'monospace', weight: [400, 700],               popular: false },
  { family: 'Ubuntu Mono',      category: 'monospace', weight: [400, 700],               popular: false },
  { family: 'Courier Prime',    category: 'monospace', weight: [400, 700],               popular: false },
];

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif':  'Sans',
  'serif':       'Serif',
  'handwritten': 'Hand',
  'display':     'Display',
  'monospace':   'Mono',
};
