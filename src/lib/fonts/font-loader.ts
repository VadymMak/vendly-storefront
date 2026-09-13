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

      // Extract first woff2 URL from CSS (Google Fonts returns woff2 for modern browsers)
      const match = css.match(/url\(['"]?([^'")\s]+\.woff2)['"]?\)/);
      if (!match) throw new Error(`No woff2 URL in CSS for ${family}`);

      const face = new FontFace(family, `url(${match[1]})`, {
        weight: String(weight),
        style: 'normal',
      });
      await face.load();
      document.fonts.add(face);
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
