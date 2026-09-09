export interface AssembleItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt?: string;
  duration?: number;
  addedAt: number;
}

export function addToAssemble(item: Omit<AssembleItem, 'id' | 'addedAt'>) {
  try {
    const existing = getAssembleItems();
    const next: AssembleItem[] = [
      { ...item, id: crypto.randomUUID(), addedAt: Date.now() },
      ...existing,
    ].slice(0, 30);
    sessionStorage.setItem('assemble-items', JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

export function getAssembleItems(): AssembleItem[] {
  try {
    return JSON.parse(sessionStorage.getItem('assemble-items') ?? '[]') as AssembleItem[];
  } catch {
    return [];
  }
}

export function removeAssembleItem(id: string) {
  try {
    const next = getAssembleItems().filter(x => x.id !== id);
    sessionStorage.setItem('assemble-items', JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clearAssembleItems() {
  try {
    sessionStorage.removeItem('assemble-items');
  } catch { /* ignore */ }
}
