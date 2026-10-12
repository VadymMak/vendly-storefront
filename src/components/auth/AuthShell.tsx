import Link from 'next/link';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Centered logo + card, same look as /login and /register. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#16a34a" />
              <text x="6" y="23" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white">V.</text>
            </svg>
            <span className="text-2xl font-bold text-primary">Vendly</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-bold text-secondary">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-neutral">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
