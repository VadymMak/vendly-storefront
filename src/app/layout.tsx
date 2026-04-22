import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import CookieBanner from '@/components/ui/CookieBanner';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
});

const siteUrl = "https://vendshop.shop";
const title = "VendShop — Profesionálna webová stránka za 48 hodín";
const description =
  "Profesionálny web pre váš biznis. Od €249. Hotové do 48 hodín. AI chatbot, SEO, WhatsApp v cene.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: siteUrl,
    siteName: "VendShop",
    title,
    description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VendShop — online obchod pre malý biznis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html
      lang="sk"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              name: "VendShop",
              url: "https://vendshop.shop",
              priceRange: "€249 - €799",
              offers: [
                {
                  "@type": "Offer",
                  name: "Landing",
                  price: "249",
                  priceCurrency: "EUR",
                  description:
                    "Professional website ready in 48 hours. AI chatbot, SEO, WhatsApp included.",
                },
                {
                  "@type": "Offer",
                  name: "Premium",
                  price: "399",
                  priceCurrency: "EUR",
                  description:
                    "Premium website with online store, booking, and priority support.",
                },
                {
                  "@type": "Offer",
                  name: "Individual",
                  price: "799",
                  priceCurrency: "EUR",
                  description:
                    "Custom design, full e-commerce, CRM, dedicated account manager.",
                },
              ],
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.9",
                ratingCount: "47",
                bestRating: "5",
              },
              description:
                "Professional website for your business. From €249. Ready in 48 hours. AI chatbot, SEO, WhatsApp included.",
              areaServed: ["SK", "CZ", "UA", "DE"],
              availableLanguage: ["sk", "en", "uk", "cs", "de"],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "How much does a website cost?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Landing package starts at €249 one-time + €29/month maintenance. Premium is €399 + €39/month. Individual custom project from €799 + €49/month.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How long does it take to create a website?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Standard delivery is 48 hours. Premium and Individual projects take 5-7 business days.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is included in the price?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Design, development, AI chatbot, SEO setup, WhatsApp button, hosting, SSL certificate, and 30 days of free support.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Do I need technical knowledge?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No. You provide your business information and photos. We handle everything else — design, code, hosting, and launch.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What happens after the website is launched?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Monthly maintenance includes security updates, content edits (up to 2 hours/month), performance monitoring, and priority support.",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
