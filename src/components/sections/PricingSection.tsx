import { PRICING_PLANS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-gray-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-secondary sm:text-4xl">
            Jednoduchý cenník
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            Začnite zadarmo. Platíte len keď rastie váš biznis.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <Card key={plan.id} highlighted={plan.highlighted} className="relative flex flex-col">
              {plan.highlighted && (
                <Badge variant="primary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Najpopulárnejší
                </Badge>
              )}

              <div className="text-center">
                <h3 className="text-xl font-bold text-secondary">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-secondary">
                    {plan.price === 0 ? 'Zadarmo' : `${plan.currency}${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-neutral">/{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral">{plan.description}</p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">✓</span>
                    <span className="text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  className="w-full"
                  href="#"
                >
                  {plan.cta}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
