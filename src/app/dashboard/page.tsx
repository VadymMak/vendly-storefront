import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
      <p className="mt-2 text-neutral">
        Vitajte, {session.user.name || session.user.email}!
      </p>
      {/* TODO: Dashboard checklist, store management */}
    </div>
  );
}
