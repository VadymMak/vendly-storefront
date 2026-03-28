import ProductGridSkeleton from '@/components/shop/ProductGridSkeleton';
import { COLOR_SCHEMES } from '@/lib/constants';

export default function ShopLoading() {
  const scheme = COLOR_SCHEMES.light;

  return (
    <>
      {/* Hero skeleton */}
      <section className={`${scheme.heroBg} border-b ${scheme.border}`}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 h-20 w-20 rounded-2xl bg-gray-200 animate-pulse" />
            <div className="h-10 w-64 rounded-lg bg-gray-200 animate-pulse" />
            <div className="mt-4 h-5 w-96 max-w-full rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Catalog skeleton */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-7 w-32 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-4 w-20 rounded-md bg-gray-100 animate-pulse" />
        </div>
        <ProductGridSkeleton scheme={scheme} />
      </section>
    </>
  );
}
