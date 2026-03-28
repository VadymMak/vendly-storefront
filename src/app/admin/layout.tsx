import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export const metadata = {
  title: 'Admin | VendShop',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav userName={session.user.name || session.user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
