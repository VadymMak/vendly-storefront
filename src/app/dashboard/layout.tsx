import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardNav from '@/components/dashboard/DashboardNav';
import FloatingAdvisor from '@/components/dashboard/FloatingAdvisor';
import { getStoreByUserId, getUserPlan } from '@/lib/shop-queries';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: 'Dashboard | VendShop',
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const isAdmin = !!(process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL);
  const userId = session.user.id ?? '';

  const [store, userPlan] = await Promise.all([
    getStoreByUserId(userId),
    getUserPlan(userId),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav user={session.user} isAdmin={isAdmin} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <FloatingAdvisor
        storeId={store?.id ?? null}
        userPlan={userPlan}
        isAdmin={isAdmin}
      />
    </div>
  );
}
