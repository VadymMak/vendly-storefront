import { SITE_NAME, NAV_ITEMS } from '@/lib/constants';
import Button from '@/components/ui/Button';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="text-xl font-bold text-secondary">
          {SITE_NAME}
        </a>

        {/* TODO: Mobile menu burger */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-neutral transition-colors hover:text-secondary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button size="sm" href="#pricing">
            Začať zadarmo
          </Button>
        </div>
      </div>
    </header>
  );
}
