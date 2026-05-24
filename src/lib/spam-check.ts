// Gibberish detection (ported from star-food / ub-market.com)
export function isGibberish(text: string): boolean {
  if (text.length > 20 && !/\s/.test(text)) return true;
  const vowels = text.match(/[aeiouyаеёиоуыэюяіїєґ]/gi) || [];
  if (text.length > 10 && vowels.length / text.length < 0.1) return true;
  const upper = (text.match(/[A-ZА-ЯІЇЄҐ]/g) || []).length;
  const lower = (text.match(/[a-zа-яіїєґ]/g) || []).length;
  if (upper > 3 && lower > 3 && upper / (upper + lower) > 0.4) return true;
  const unique = new Set(text.split('')).size;
  if (text.length > 15 && unique / text.length > 0.8) return true;
  return false;
}

// Prompt validation for AI Studio
export function isAbusivePrompt(prompt: string): boolean {
  if (!prompt || typeof prompt !== 'string') return true;
  if (isGibberish(prompt)) return true;
  if (prompt.trim().length < 3) return true;
  if (prompt.length > 2000) return true;
  if (/(.)\1{10,}/.test(prompt)) return true;
  return false;
}

// Disposable email detection
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', '10minutemail.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'trashmail.com', 'fakeinbox.com',
  'tempail.com', 'temp-mail.org', 'mohmal.com',
  'getnada.com', 'emailondeck.com', 'mintemail.com',
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain ?? '');
}

export function isSuspiciousEmail(email: string): boolean {
  const local = email.split('@')[0] || '';
  const dots  = (local.match(/\./g) || []).length;
  if (dots >= 3) return true;
  if (/(\w\.){3,}/.test(local)) return true;
  return false;
}
