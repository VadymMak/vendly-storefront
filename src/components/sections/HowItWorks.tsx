import { HOW_IT_WORKS_STEPS } from '@/lib/constants';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-accent py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-secondary sm:text-4xl">
            Ako to funguje
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            Tri jednoduché kroky k vášmu online obchodu.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div key={step.id} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl text-white">
                {step.step}
              </div>
              <div className="mt-4 text-3xl">{step.icon}</div>
              <h3 className="mt-4 text-xl font-semibold text-secondary">{step.title}</h3>
              <p className="mt-2 text-neutral">{step.description}</p>
              {/* TODO: Добавить скриншот каждого шага */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
