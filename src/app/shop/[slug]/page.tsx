interface ShopPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { slug } = await params;

  // TODO: Fetch store from DB by slug and render template
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-secondary">
          Obchod: {slug}
        </h1>
        <p className="mt-2 text-neutral">
          Vitrina bude čoskoro k dispozícii.
        </p>
      </div>
    </div>
  );
}
