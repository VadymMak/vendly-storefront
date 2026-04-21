import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ContactForm from './ContactForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contactPage');
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
  };
}

export default async function ContactPage() {
  const t = await getTranslations('contactPage');

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[--color-bg]">
        {/* Hero */}
        <section className="py-20 sm:py-28 text-center px-4">
          <div className="mx-auto max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              {t('badge')}
            </span>
            <h1 className="mt-5 text-4xl font-bold text-white sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-4 text-lg text-[--color-text-muted]">
              {t('subtitle')}
            </p>
          </div>
        </section>

        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
