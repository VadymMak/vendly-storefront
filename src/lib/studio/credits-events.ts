// Tells the credit counters to refetch after something spent credits
export const CREDITS_CHANGED_EVENT = 'studio:credits-changed';

export function notifyCreditsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}
