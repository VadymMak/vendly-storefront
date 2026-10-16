// Per-user browser storage (PROMPT-267). localStorage / sessionStorage belong to the device + tab, not to
// the account — after a logout another user in the same browser would read the previous user's data
// (reel photos, chat history, …). Keys holding one user's data are therefore suffixed with the user id.
// Client-only: the server never touches browser storage.

let currentUser: string | null = null;

// Session-only editing state that can't be keyed per user: the desktop studio zustand store hydrates
// from sessionStorage when its module loads, before the user is known. Cleared on logout / login.
const DEVICE_SESSION_KEYS = ['studio-session', 'assemble-items'];

// Keys used before they were per user — removed once so no one reads another user's old data
const LEGACY_SESSION_KEYS = [
  'reel-photos', 'reel-phone-photos', 'reel-ctaLayout', 'reel-mode', 'reel-cta1', 'reel-cta2',
  'reel-ctaFont', 'reel-ctaFontSize', 'reel-ctaColor', 'reel-ctaDuration', 'reel-ctaMotion',
  'reel-musicTrackId', 'kb-chat-session',
];
const LEGACY_LOCAL_KEYS = ['studio-chat-session', 'reel-preferred-music'];
let legacyPurged = false;

/** Called by the studio shell with the signed-in user before any page reads storage */
export function setStorageUser(userId: string): void {
  if (typeof window === 'undefined' || currentUser === userId) return;
  currentUser = userId;
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    LEGACY_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
    LEGACY_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage blocked — nothing stored either
  }
}

/** `base:<userId>` — the storage key for this user's copy of `base` */
export function userKey(base: string): string {
  return `${base}:${currentUser ?? 'anonymous'}`;
}

/** Drop session editing state that isn't keyed per user — before signing out and on the login page */
export function clearDeviceSessionState(): void {
  try {
    DEVICE_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // storage blocked
  }
}
