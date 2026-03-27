import { SITE_TAGLINE } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="text-center">
          <Badge variant="primary">Nová platforma pre malý biznis</Badge>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-secondary sm:text-5xl lg:text-6xl">
            {SITE_TAGLINE}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral">
            Vytvorte si profesionálny online obchod bez technických znalostí.
            Predávajte produkty, prijímajte objednávky a rastite s VendShop.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" href="#pricing">
              Vytvoriť obchod zadarmo
            </Button>
            <Button size="lg" variant="outline" href="#how-it-works">
              Ako to funguje
            </Button>
          </div>

          {/* TODO: Hero image/screenshot placeholder */}
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <div className="flex h-64 items-center justify-center text-neutral">
              {/* TODO: Добавить скриншот платформы */}
              <p className="text-sm">Screenshot platformy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
