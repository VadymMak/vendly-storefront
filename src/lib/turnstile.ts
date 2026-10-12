/**
 * Cloudflare Turnstile server-side verification.
 * FAIL-CLOSED: if verification fails for any reason, block the request.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token) return false;

  // Skip in development when no secret key is configured
  if (process.env.NODE_ENV === 'development' && !process.env.TURNSTILE_SECRET_KEY) {
    return true;
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret:   process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip && { remoteip: ip }),
      }),
    });

    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false; // FAIL-CLOSED
  }
}

/**
 * Sign-up variant — FAIL-OPEN when Cloudflare is unreachable (network error, 5xx,
 * timeout); the per-IP sign-up limit is the backstop then. Always calls siteverify,
 * even with an empty token, so omitting the token can't skip the challenge: if
 * Cloudflare answers, its verdict stands. No TURNSTILE_SECRET_KEY → not enforced.
 */
export async function verifyTurnstileFailOpen(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token ?? '',
        ...(ip && { remoteip: ip }),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 500) {
      console.warn('[turnstile] siteverify', res.status, '— failing open');
      return true;
    }
    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('[turnstile] rejected:', data['error-codes']);
    return data.success === true;
  } catch (err) {
    console.warn('[turnstile] siteverify unreachable — failing open:', err);
    return true;
  }
}
