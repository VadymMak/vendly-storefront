import Link from 'next/link';

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}

export default async function CheckoutSuccessPage({ params, searchParams }: SuccessPageProps) {
  const { slug } = await params;
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      {/* Checkmark */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold">Objednávka prijatá!</h1>
      <p className="mt-3 text-gray-500">
        Ďakujeme za vašu objednávku. Predajca vás bude čoskoro kontaktovať.
      </p>

      {order && (
        <p className="mt-2 text-sm text-gray-400">
          Číslo objednávky: {order}
        </p>
      )}

      <Link
        href={`/`}
        className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Späť do obchodu
      </Link>
    </div>
  );
}
