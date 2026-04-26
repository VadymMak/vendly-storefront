# VendShop — 6 Templates Specification (Final)

> Created: 2026-04-20
> Source: Grok consultation (4 turns)
> Status: APPROVED — ready for implementation

## Architecture

- 6 separate GitHub template repos (NOT one repo with conditionals)
- Each repo is a standalone Next.js project
- `lib/` identical across all 6 (synced via script from classic)
- Differences ONLY in `components/` and CSS
- `config.ts` does NOT contain heroStyle/mood — those are baked into each template's components

## Mapping: businessType → template repo

| businessType | Template Repo | Palette | Hero Style | Services Style |
|---|---|---|---|---|
| repair, home_services, physical | vendshop-template-classic | clean-light | Fullscreen | Grid 3 cols |
| food, restaurant | vendshop-template-warm | warm-cozy | Split | List (Menu) |
| beauty, health | vendshop-template-natural | natural | Split | List |
| digital, education | vendshop-template-bold | bold | Fullscreen | Cards + icons |
| photography, design | vendshop-template-dark | dark-premium | Centered | Grid + photo |
| medical (dedicated) | vendshop-template-medical | medical | Split | Grid + icons |

## Implementation Order

1. Rename current `vendshop-template` → `vendshop-template-classic`
2. Create `vendshop-template-warm` (food/restaurant — most common)
3. Create remaining 4 in order: dark, bold, natural, medical
4. Update `vendly-storefront` mapping in route.ts

## Sync Script (scripts/sync-lib.sh)

Copies `lib/` from vendshop-template-classic to all 5 other repos.

---

## 1. vendshop-template-classic (Classic Professional)

**Best for:** repair, home_services, physical
**Feel:** Clean, strict, professional

### Palette (globals.css)
```css
:root {
  --color-primary: #3b82f6;
  --color-bg: #f8f9fa;
  --color-bg-alt: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-card: #ffffff;
  --color-card-hover: #f1f5f9;
}
```

### Fonts: Inter (heading + body)
```tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

### HeroSection.tsx (Fullscreen)
```tsx
import Image from 'next/image';
import styles from './HeroSection.module.css';
import { HERO, IMAGES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function HeroSection() {
  const ui = t();

  return (
    <section className={styles.hero}>
      <Image
        src={IMAGES.hero}
        alt={HERO.title}
        fill
        priority
        className={styles.heroImage}
      />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>{HERO.title}</h1>
        <p className={styles.subtitle}>{HERO.subtitle}</p>
        <div className={styles.ctaGroup}>
          <a href="#contact" className={styles.ctaPrimary}>{ui.hero.cta1}</a>
          <a href="#services" className={styles.ctaSecondary}>{ui.hero.cta2}</a>
        </div>
      </div>
    </section>
  );
}
```

### HeroSection.module.css
```css
.hero { position: relative; height: 100vh; min-height: 680px; overflow: hidden; }
.heroImage { object-fit: cover; }
.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
.content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: white; padding: 0 24px; }
.title { font-size: clamp(2.8rem, 8vw, 4.5rem); margin: 0 0 16px; }
.subtitle { font-size: 1.25rem; max-width: 640px; margin: 0 0 32px; }
.ctaGroup { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
```

### ServicesSection.tsx (Grid 3 cols, grouped by category)
```tsx
import styles from './ServicesSection.module.css';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function ServicesSection() {
  const ui = t();

  return (
    <section className={styles.services}>
      <h2 className={styles.sectionTitle}>{ui.services.title}</h2>
      {SERVICE_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.grid}>
            {category.items.map(service => (
              <div key={service.name} className={styles.card}>
                <h4>{service.name}</h4>
                <p>{service.description}</p>
                <div className={styles.price}>{service.price}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

### ServicesSection.module.css
```css
.services { padding: 100px 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px; }
.card { background: var(--color-card); padding: 32px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
```

---

## 2. vendshop-template-warm (Warm & Cozy)

**Best for:** food, restaurant
**Feel:** Warm, cozy, appetizing

### Palette (globals.css)
```css
:root {
  --color-primary: #3d5a2b;
  --color-bg: #fdf6ec;
  --color-bg-alt: #ffffff;
  --color-text: #2a1f14;
  --color-text-muted: #78716c;
  --color-border: #e6d9c2;
  --color-card: #ffffff;
  --color-card-hover: #f5f0e8;
  --color-hero-overlay: rgba(61, 90, 43, 0.15);
}
```

### Fonts: Playfair Display (heading) + Inter (body)
```tsx
import { Playfair_Display, Inter } from 'next/font/google';
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

### HeroSection.tsx (Split: photo left, text right)
```tsx
import Image from 'next/image';
import styles from './HeroSection.module.css';
import { HERO, IMAGES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function HeroSection() {
  const ui = t();

  return (
    <section className={styles.hero}>
      <div className={styles.imageSide}>
        <Image src={IMAGES.hero} alt="" fill className={styles.image} />
      </div>
      <div className={styles.textSide}>
        <h1 className={styles.title}>{HERO.title}</h1>
        <p className={styles.subtitle}>{HERO.subtitle}</p>
        <div className={styles.ctaGroup}>
          <a href="#contact" className={styles.ctaPrimary}>{ui.hero.cta1}</a>
          <a href="#menu" className={styles.ctaSecondary}>{ui.hero.cta2}</a>
        </div>
      </div>
    </section>
  );
}
```

### HeroSection.module.css
```css
.hero { display: grid; grid-template-columns: 1fr 1fr; min-height: 720px; }
.imageSide { position: relative; }
.image { object-fit: cover; }
.textSide { padding: 80px 60px; display: flex; flex-direction: column; justify-content: center; background: var(--color-bg); }
.title { font-size: clamp(2.6rem, 7vw, 4.2rem); }
```

### MenuSection.tsx (List vertical)
```tsx
import styles from './MenuSection.module.css';
import { MENU_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function MenuSection() {
  const ui = t();

  return (
    <section className={styles.menu}>
      <h2 className={styles.sectionTitle}>{ui.menu.title}</h2>
      {MENU_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.list}>
            {category.items.map(item => (
              <div key={item.name} className={styles.item}>
                <div className={styles.info}>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                </div>
                <div className={styles.price}>{item.price}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

---

## 3. vendshop-template-dark (Dark Premium)

**Best for:** photography, design
**Feel:** Expensive, elegant, minimalist

### Palette (globals.css)
```css
:root {
  --color-primary: #cbd5e1;
  --color-bg: #0f172a;
  --color-bg-alt: #1e2937;
  --color-text: #f8fafc;
  --color-text-muted: #94a3b8;
  --color-border: #334155;
  --color-card: #1e2937;
  --color-card-hover: #334155;
  --color-hero-overlay: rgba(15, 23, 42, 0.65);
}
```

### Fonts: Space Grotesk (heading) + Inter (body)
```tsx
import { Space_Grotesk, Inter } from 'next/font/google';
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['500', '600', '700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

### HeroSection.tsx (Centered)
```tsx
import Image from 'next/image';
import styles from './HeroSection.module.css';
import { HERO, IMAGES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function HeroSection() {
  const ui = t();

  return (
    <section className={styles.hero}>
      <Image src={IMAGES.hero} alt={HERO.title} fill priority className={styles.backgroundImage} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>{HERO.title}</h1>
        <p className={styles.subtitle}>{HERO.subtitle}</p>
        <div className={styles.ctaGroup}>
          <a href="#contact" className={styles.ctaPrimary}>{ui.hero.cta1}</a>
          <a href="#services" className={styles.ctaSecondary}>{ui.hero.cta2}</a>
        </div>
      </div>
    </section>
  );
}
```

### HeroSection.module.css
```css
.hero { position: relative; height: 100vh; min-height: 720px; overflow: hidden; display: flex; align-items: center; justify-content: center; text-align: center; }
.backgroundImage { object-fit: cover; }
.overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.65); }
.content { position: relative; z-index: 2; max-width: 800px; padding: 0 24px; color: white; }
.title { font-size: clamp(3rem, 9vw, 5rem); margin: 0 0 20px; }
.subtitle { font-size: 1.35rem; margin: 0 0 40px; opacity: 0.95; }
.ctaGroup { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
```

### ServicesSection.tsx (Grid with photo on top of each card)
```tsx
import Image from 'next/image';
import styles from './ServicesSection.module.css';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function ServicesSection() {
  const ui = t();

  return (
    <section className={styles.services}>
      <h2 className={styles.sectionTitle}>{ui.services.title}</h2>
      {SERVICE_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.grid}>
            {category.items.map(service => (
              <div key={service.name} className={styles.card}>
                <div className={styles.info}>
                  <h4>{service.name}</h4>
                  <p>{service.description}</p>
                  <div className={styles.price}>{service.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

### ServicesSection.module.css
```css
.services { padding: 120px 24px; background: var(--color-bg); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 40px; }
.card { background: var(--color-card); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.info { padding: 28px; }
```

---

## 4. vendshop-template-bold (Bold & Energetic)

**Best for:** digital, education
**Feel:** Bright, dynamic, modern

### Palette (globals.css)
```css
:root {
  --color-primary: #e11d48;
  --color-bg: #0f172a;
  --color-bg-alt: #1e2937;
  --color-text: #f8fafc;
  --color-text-muted: #cbd5e1;
  --color-border: #334155;
  --color-card: #1e2937;
  --color-card-hover: #334155;
  --color-hero-overlay: rgba(225, 29, 72, 0.55);
}
```

### Fonts: Manrope (heading) + Inter (body)
```tsx
import { Manrope, Inter } from 'next/font/google';
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['500', '600', '700'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

### HeroSection.tsx (Fullscreen bold)
```tsx
import Image from 'next/image';
import styles from './HeroSection.module.css';
import { HERO, IMAGES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function HeroSection() {
  const ui = t();

  return (
    <section className={styles.hero}>
      <Image src={IMAGES.hero} alt={HERO.title} fill priority className={styles.heroImage} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>{HERO.title}</h1>
        <p className={styles.subtitle}>{HERO.subtitle}</p>
        <div className={styles.ctaGroup}>
          <a href="#contact" className={styles.ctaPrimary}>{ui.hero.cta1}</a>
          <a href="#services" className={styles.ctaSecondary}>{ui.hero.cta2}</a>
        </div>
      </div>
    </section>
  );
}
```

### HeroSection.module.css
```css
.hero { position: relative; height: 100vh; min-height: 700px; overflow: hidden; }
.heroImage { object-fit: cover; }
.overlay { position: absolute; inset: 0; background: rgba(225, 29, 72, 0.55); }
.content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: white; padding: 0 24px; }
.title { font-size: clamp(3.2rem, 9vw, 5.5rem); margin: 0 0 20px; font-weight: 700; }
.subtitle { font-size: 1.4rem; max-width: 700px; margin: 0 0 40px; }
```

### ServicesSection.tsx (Cards with big emoji icons)
```tsx
import styles from './ServicesSection.module.css';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function ServicesSection() {
  const ui = t();

  return (
    <section className={styles.services}>
      <h2 className={styles.sectionTitle}>{ui.services.title}</h2>
      {SERVICE_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.cards}>
            {category.items.map(service => (
              <div key={service.name} className={styles.card}>
                <div className={styles.icon}>{service.icon}</div>
                <h4>{service.name}</h4>
                <p>{service.description}</p>
                <div className={styles.price}>{service.price}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

---

## 5. vendshop-template-natural (Natural & Soft)

**Best for:** beauty, health
**Feel:** Soft, natural, calm

### Palette (globals.css)
```css
:root {
  --color-primary: #3d5a2b;
  --color-bg: #f8f1e3;
  --color-bg-alt: #ffffff;
  --color-text: #2c2418;
  --color-text-muted: #78716c;
  --color-border: #e6d9c2;
  --color-card: #ffffff;
  --color-card-hover: #f5f0e8;
  --color-hero-overlay: rgba(61, 90, 43, 0.15);
}
```

### Fonts: Playfair Display (heading) + Inter (body)

### HeroSection.tsx (Split soft)
Same structure as warm but with generous padding (100px 80px).

### ServicesSection.tsx (List with soft cards, generous spacing)
```tsx
import styles from './ServicesSection.module.css';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function ServicesSection() {
  const ui = t();

  return (
    <section className={styles.services}>
      <h2 className={styles.sectionTitle}>{ui.services.title}</h2>
      {SERVICE_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.list}>
            {category.items.map(service => (
              <div key={service.name} className={styles.item}>
                <h4>{service.name}</h4>
                <p>{service.description}</p>
                <div className={styles.price}>{service.price}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

---

## 6. vendshop-template-medical (Medical Trust)

**Best for:** medical (dedicated)
**Feel:** Trustworthy, clean, professional

### Palette (globals.css)
```css
:root {
  --color-primary: #0f766e;
  --color-bg: #f8fafc;
  --color-bg-alt: #ffffff;
  --color-text: #1e2937;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-card: #ffffff;
  --color-card-hover: #f1f5f9;
  --color-hero-overlay: rgba(15, 118, 110, 0.08);
}
```

### Fonts: Inter (heading + body)

### HeroSection.tsx (Split clean)
Same structure as warm/natural split.

### ServicesSection.tsx (Grid with icons)
```tsx
import styles from './ServicesSection.module.css';
import { SERVICE_CATEGORIES } from '@/lib/constants';
import { t } from '@/lib/get-ui-text';

export default function ServicesSection() {
  const ui = t();

  return (
    <section className={styles.services}>
      <h2 className={styles.sectionTitle}>{ui.services.title}</h2>
      {SERVICE_CATEGORIES.map(category => (
        <div key={category.id} className={styles.categoryGroup}>
          <h3 className={styles.categoryTitle}>{category.name}</h3>
          <div className={styles.grid}>
            {category.items.map(service => (
              <div key={service.name} className={styles.card}>
                <div className={styles.icon}>{service.icon}</div>
                <h4>{service.name}</h4>
                <p>{service.description}</p>
                <div className={styles.price}>{service.price}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

---

## Changes needed in vendly-storefront

### generate-config.ts — add template repo mapping
```ts
const TEMPLATE_REPO_MAP: Record<string, string> = {
  repair:        'vendshop-template-classic',
  home_services: 'vendshop-template-classic',
  physical:      'vendshop-template-classic',
  food:          'vendshop-template-warm',
  restaurant:    'vendshop-template-warm',
  beauty:        'vendshop-template-natural',
  health:        'vendshop-template-natural',
  digital:       'vendshop-template-bold',
  education:     'vendshop-template-bold',
  photography:   'vendshop-template-dark',
  design:        'vendshop-template-dark',
  ecommerce:     'vendshop-template-classic',
};

// Default fallback
const DEFAULT_TEMPLATE_REPO = 'vendshop-template-classic';
```

### route.ts — use dynamic template repo
Replace `GITHUB_TEMPLATE_REPO` env var with:
```ts
const templateRepo = TEMPLATE_REPO_MAP[lead.businessType] ?? DEFAULT_TEMPLATE_REPO;
```

Use `templateRepo` in GitHub generate API call and fetchTemplateFile().

---

## Sync script (scripts/sync-lib.sh)

```bash
#!/bin/bash
SOURCE="vendshop-template-classic/lib"
TARGETS=(
  "vendshop-template-warm/lib"
  "vendshop-template-dark/lib"
  "vendshop-template-bold/lib"
  "vendshop-template-natural/lib"
  "vendshop-template-medical/lib"
)
for target in "${TARGETS[@]}"; do
  cp -r "$SOURCE/"* "$target/"
  echo "Synced → $target"
done
```
