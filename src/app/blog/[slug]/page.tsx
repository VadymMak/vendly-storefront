import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { getPostBySlug, getAllPostSlugsForSitemap, renderMarkdown, formatPostDate } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPostSlugsForSitemap().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug, 'en') ?? getPostBySlug(slug, 'de');
  if (!post) return {};

  const ogImages = post.image
    ? [{ url: `https://vendshop.shop${post.image}`, width: 1200, height: 630, alt: post.title }]
    : [{ url: 'https://vendshop.shop/og-image.png', width: 1200, height: 630, alt: post.title }];

  return {
    title: `${post.title} — VendShop Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: ogImages,
      siteName: 'VendShop',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImages[0].url],
    },
  };
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations('blog');

  const post = getPostBySlug(slug, locale);
  if (!post) notFound();

  const contentHtml = renderMarkdown(post.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: 'VendShop',
      url: 'https://vendshop.shop',
    },
    publisher: {
      '@type': 'Organization',
      name: 'VendShop',
      logo: {
        '@type': 'ImageObject',
        url: 'https://vendshop.shop/og-image.png',
      },
    },
    ...(post.image && { image: `https://vendshop.shop${post.image}` }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://vendshop.shop/blog/${slug}`,
    },
    inLanguage: post.locale,
    keywords: post.tags.join(', '),
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[--color-bg]">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          {/* Back */}
          <Link
            href="/blog"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
          >
            <BackArrowIcon />
            {t('backToBlog')}
          </Link>

          {/* Header */}
          <header className="mb-10">
            {post.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {post.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[--color-border] px-2.5 py-0.5 text-xs text-[--color-text-dim]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
              {post.title}
            </h1>

            <p className="mt-4 text-lg leading-relaxed text-[--color-text-muted]">
              {post.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-b border-[--color-border] pb-6 text-sm text-[--color-text-dim]">
              <span>{post.author}</span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <CalendarIcon />
                <time dateTime={post.date}>{formatPostDate(post.date, locale)}</time>
              </span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <ClockIcon />
                {post.readingTime} {t('minRead')}
              </span>
            </div>
          </header>

          {/* Body */}
          <div
            className="min-w-0"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Language alternates */}
          {post.alternates && Object.keys(post.alternates).length > 0 && (
            <aside className="mt-12 rounded-xl border border-[--color-border] bg-[--color-card] p-5">
              <p className="mb-3 text-sm text-[--color-text-muted]">{t('availableIn')}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(post.alternates).map(([lang, altSlug]) => (
                  <Link
                    key={lang}
                    href={`/blog/${altSlug}`}
                    className="rounded-full border border-[--color-primary]/40 px-3 py-1 text-xs font-semibold uppercase text-[--color-primary] transition-colors hover:bg-[--color-primary]/10"
                  >
                    {lang}
                  </Link>
                ))}
              </div>
            </aside>
          )}

          {/* CTA */}
          <div className="mt-14 rounded-2xl border border-[--color-primary]/30 bg-[--color-primary]/8 p-8 text-center">
            <h3 className="text-xl font-bold text-white">{t('ctaTitle')}</h3>
            <p className="mt-2 text-[--color-text-muted]">{t('ctaDesc')}</p>
            <a
              href="https://wa.me/421901234567"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-[--color-primary] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[--color-primary-dark]"
            >
              {t('ctaButton')}
            </a>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
