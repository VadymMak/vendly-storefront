const features = [
  {
    icon: '⚡',
    title: 'Rýchle nastavenie',
    description: 'Obchod hotový za 5 minút. Žiadne programovanie.',
  },
  {
    icon: '📱',
    title: 'Mobilný dizajn',
    description: 'Váš obchod vyzerá skvele na každom zariadení.',
  },
  {
    icon: '💳',
    title: 'Online platby',
    description: 'Stripe, PayPal a lokálne platobné metódy.',
  },
  {
    icon: '📊',
    title: 'Analytika',
    description: 'Sledujte predaje, návštevnosť a konverzie.',
  },
  {
    icon: '🌍',
    title: 'Multi-jazyk',
    description: 'Obchod v slovenčine, češtine, ukrajinčine aj nemčine.',
  },
  {
    icon: '🔒',
    title: 'Bezpečnosť',
    description: 'SSL certifikát, GDPR a bezpečné platby zadarmo.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-secondary sm:text-4xl">
            Všetko, čo potrebujete
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            Funkcie, ktoré pomôžu vášmu biznisu rásť online.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-gray-100 p-6 transition-shadow hover:shadow-md">
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-secondary">{feature.title}</h3>
              <p className="mt-2 text-neutral">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
