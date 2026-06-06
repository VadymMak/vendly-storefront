import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';
import AdminNav from '@/components/admin/AdminNav';

// Server-side admin gate (defense-layer-2). Middleware already redirects anonymous
// requests to /login; this layer enforces the ADMIN_EMAIL match that middleware skips.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!isAdminEmail(session?.user?.email)) {
    const callbackUrl = encodeURIComponent('/admin');
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B0F1A' }}>
      <AdminNav userName={session?.user?.name} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
