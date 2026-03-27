export default function SocialProofBar() {
  // TODO: Заменить на реальные логотипы клиентов
  const placeholderShops = [
    'Smak Shop',
    'Beauty Studio',
    'Pizza House',
    'TechFix',
    'DigiBooks',
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-neutral">
          Dôverujú nám stovky podnikateľov v SK, CZ, UA a DE
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
          {placeholderShops.map((name) => (
            <div
              key={name}
              className="flex h-10 items-center rounded bg-white px-4 text-sm font-medium text-neutral shadow-sm"
            >
              {/* TODO: Заменить текст на <Image /> логотипы */}
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
