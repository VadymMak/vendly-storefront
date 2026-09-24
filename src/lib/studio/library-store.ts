// DEPRECATED: localStorage library replaced by /api/studio/my-work (StudioJob table).
// These functions are kept to avoid breaking any remaining imports; remove once all callers are updated.

export interface LibraryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  model?: string;
  provider?: string;
  preset?: string;
  createdAt: number;
}

const KEY = 'studio-library';
const MAX = 200;

export function saveToLibrary(item: Omit<LibraryItem, 'id' | 'createdAt'>): void {
  try {
    const existing = getLibraryItems();
    const next = [
      { ...item, id: crypto.randomUUID(), createdAt: Date.now() },
      ...existing.filter(x => x.url !== item.url),
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

export function getLibraryItems(): LibraryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LibraryItem[];
  } catch {
    return [];
  }
}

export function removeLibraryItem(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getLibraryItems().filter(x => x.id !== id)));
  } catch { /* ignore */ }
}

export function clearLibrary(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
