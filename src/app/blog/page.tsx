import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { getAllPosts, formatPostDate } from '@/lib/blog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('blog');
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDesc'),
      type: 'website',
    },
  };
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5h12M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function BlogPage() {
  const locale = await getLocale();
  const t = await getTranslations('blog');
  const posts = getAllPosts(locale);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[--color-bg]">
        {/* Hero */}
        <section className="py-20 sm:py-28 text-center px-4">
          <div className="mx-auto max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-[--color-primary]/30 bg-[--color-primary]/10 px-4 py-1.5 text-sm font-medium text-[--color-primary]">
              {t('badge')}
            </span>
            <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-4 text-lg text-[--color-text-muted]">
              {t('subtitle')}
            </p>
          </div>
        </section>

        {/* Post list */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {posts.length === 0 ? (
              <p className="py-16 text-center text-[--color-text-muted]">{t('noPosts')}</p>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <article
                    key={post.slug}
                    className="group rounded-2xl border border-[--color-border] bg-[--color-card] p-6 transition-all hover:border-[--color-primary]/40 hover:shadow-lg hover:shadow-[--color-primary]/5 sm:p-8"
                  >
                    <Link href={`/blog/${post.slug}`} className="block">
                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-[--color-border] px-2.5 py-0.5 text-xs text-[--color-text-dim]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h2 className="text-xl font-bold text-white transition-colors group-hover:text-[--color-primary] sm:text-2xl">
                        {post.title}
                      </h2>

                      {/* Description */}
                      <p className="mt-3 leading-relaxed text-[--color-text-muted]">
                        {post.description}
                      </p>

                      {/* Meta row */}
                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-[--color-text-dim]">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon />
                            <time dateTime={post.date}>{formatPostDate(post.date, locale)}</time>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ClockIcon />
                            {post.readingTime} {t('minRead')}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-sm font-medium text-[--color-primary] opacity-0 transition-opacity group-hover:opacity-100">
                          {t('readMore')} <ArrowRightIcon />
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
