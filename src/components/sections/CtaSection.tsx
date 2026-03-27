import Button from '@/components/ui/Button';

export default function CtaSection() {
  return (
    <section className="bg-primary py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Začnite predávať online ešte dnes
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
          Vytvorte si obchod zadarmo za 5 minút. Žiadna kreditná karta. Žiadne záväzky.
        </p>
        <div className="mt-10">
          <Button size="lg" variant="secondary" href="#">
            Vytvoriť obchod zadarmo →
          </Button>
        </div>
      </div>
    </section>
  );
}
