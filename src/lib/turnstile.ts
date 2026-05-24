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
