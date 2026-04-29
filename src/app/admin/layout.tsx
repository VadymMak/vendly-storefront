import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';

// Server-side admin gate (defense-layer-2). Middleware already redirects anonymous
// requests to /login; this layer enforces the ADMIN_EMAIL match that middleware skips.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!isAdminEmail(session?.user?.email)) {
    const callbackUrl = encodeURIComponent('/admin');
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  // Inline server action — no client component needed for sign-out.
  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B0F1A' }}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">VendShop Admin</h1>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
