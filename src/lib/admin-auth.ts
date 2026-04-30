import { NextResponse } from 'next/server';
import { auth } from './auth';

/** OK result returned by `requireAdmin()` when the caller is the admin. */
export interface AdminGuardOk {
  user: { email: string };
}

/**
 * Server-side admin gate for API route handlers.
 * Returns the session on success, or a NextResponse(401) the caller must return as-is.
 *
 * Usage:
 *   const guard = await requireAdmin();
 *   if (guard instanceof NextResponse) return guard;
 *   // …guard.user.email is the admin
 */
export async function requireAdmin(): Promise<AdminGuardOk | NextResponse<{ error: string }>> {
  const session = await auth();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!session?.user?.email || !adminEmail || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { user: { email: session.user.email } };
}

/** Pure email-string check — for layouts/server components that already have a session. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!email && !!adminEmail && email === adminEmail;
}
