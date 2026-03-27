import { BUSINESS_TYPES } from '@/lib/constants';
import Card from '@/components/ui/Card';

export default function BusinessTypes() {
  return (
    <section id="business-types" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-secondary sm:text-4xl">
            Pre každý typ biznisu
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            Či predávate tovar, jedlo alebo služby — VendShop sa prispôsobí vášmu podnikaniu.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_TYPES.map((type) => (
            <Card key={type.id} className="text-center transition-shadow hover:shadow-md">
              <div className="text-4xl">{type.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-secondary">{type.title}</h3>
              <p className="mt-2 text-sm text-neutral">{type.description}</p>
              {/* TODO: Добавить интерактивный превью демо-сайта */}
              <a
                href={`https://${type.demo}`}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pozrieť demo →
              </a>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
