import Link from 'next/link';

export default function ShopNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">Shop not found</h2>
      <p className="mt-2 text-gray-500">
        This store does not exist or is not yet published.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Back to VendShop
      </Link>
    </div>
  );
}
