const loadedFonts = new Set<string>();
const loadingFonts = new Map<string, Promise<void>>();

function fontKey(family: string, weight: number): string {
  return `${family}:${weight}`;
}

export async function loadGoogleFont(family: string, weight: number = 400): Promise<void> {
  const key = fontKey(family, weight);
  if (loadedFonts.has(key)) return;
  if (loadingFonts.has(key)) return loadingFonts.get(key)!;

  const promise = (async () => {
    try {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font CSS fetch failed: ${res.status}`);
      const css = await res.text();

      // Google splits a family into one @font-face per script subset (cyrillic-ext, cyrillic, …,
      // latin-ext, latin), each with its own unicode-range — register them all, or only the first
      // subset's glyphs exist and Latin/Cyrillic text silently falls back to another font.
      const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].flatMap(([, block]) => {
        const src = block.match(/url\(['"]?([^'")\s]+\.woff2)['"]?\)/)?.[1];
        if (!src) return [];
        const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1].trim();
        return [new FontFace(family, `url(${src})`, {
          weight: String(weight),
          style: 'normal',
          ...(unicodeRange ? { unicodeRange } : {}),
        })];
      });
      if (faces.length === 0) throw new Error(`No woff2 URL in CSS for ${family}`);
      faces.forEach((face) => document.fonts.add(face));

      // Fetch the Latin and Cyrillic files now; other subsets download only when a page uses them
      const loaded = await document.fonts.load(`${weight} 16px "${family}"`, 'AaZzЖжЯя');
      if (loaded.length === 0) throw new Error(`No Latin/Cyrillic face for ${family}`);
      loadedFonts.add(key);
    } catch (err) {
      console.warn('[font-loader] Failed to load:', family, err);
      throw err;
    } finally {
      loadingFonts.delete(key);
    }
  })();

  loadingFonts.set(key, promise);
  return promise;
}

/** Load font in both normal (400) and bold (700) weights in parallel */
export async function loadGoogleFontBoth(family: string): Promise<void> {
  await Promise.all([
    loadGoogleFont(family, 400),
    loadGoogleFont(family, 700),
  ]);
}

export async function loadCustomFont(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const family = 'Custom-' + file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-');

  const face = new FontFace(family, buffer);
  await face.load();
  document.fonts.add(face);
  loadedFonts.add(fontKey(family, 400));
  return family;
}

export function isFontLoaded(family: string, weight: number = 400): boolean {
  return loadedFonts.has(fontKey(family, weight));
}

export async function waitForFonts(): Promise<void> {
  await document.fonts.ready;
}
