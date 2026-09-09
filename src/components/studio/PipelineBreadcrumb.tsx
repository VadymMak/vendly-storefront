'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STEPS = [
  { href: '/studio/generate', label: 'Generate' },
  { href: '/studio/animate',  label: 'Animate' },
  { href: '/studio/assemble', label: 'Assemble' },
] as const;

export function PipelineBreadcrumb() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {STEPS.map((step, i) => {
        const isActive = pathname.startsWith(step.href);
        return (
          <span key={step.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-700">→</span>}
            <Link
              href={step.href}
              className={[
                'transition-colors',
                isActive
                  ? 'font-semibold text-white'
                  : 'text-gray-600 hover:text-gray-400',
              ].join(' ')}
            >
              {step.label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
