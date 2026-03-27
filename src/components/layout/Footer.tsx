import { SITE_NAME } from '@/lib/constants';

const footerLinks = {
  product: [
    { label: 'Funkcie', href: '#features' },
    { label: 'Cenník', href: '#pricing' },
    { label: 'Šablóny', href: '#' },
    { label: 'Príklady', href: '#' },
  ],
  support: [
    { label: 'Dokumentácia', href: '#' },
    { label: 'Kontakt', href: '#' },
    { label: 'Status', href: '#' },
  ],
  legal: [
    { label: 'Podmienky', href: '#' },
    { label: 'Súkromie', href: '#' },
    { label: 'GDPR', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-secondary text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-lg font-bold">{SITE_NAME}</h3>
            <p className="mt-2 text-sm text-gray-400">
              Platforma pre malý biznis v SK, CZ, UA a DE.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Produkt</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Podpora</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Právne</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} {SITE_NAME}. Všetky práva vyhradené.
        </div>
      </div>
    </footer>
  );
}
