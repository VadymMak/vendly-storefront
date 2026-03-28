import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://vendshop.shop";
const title = "VendShop — Váš online obchod za 5 minút";
const description =
  "Vytvorte si profesionálny online obchod bez technických znalostí. Platforma pre malý biznis v SK, CZ, UA a DE. Zadarmo.";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "VendShop",
              url: "https://vendshop.shop",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: [
                {
                  "@type": "Offer",
                  name: "Free",
                  price: "0",
                  priceCurrency: "EUR",
                  description:
                    "Up to 10 products, vendshop.shop subdomain, Stripe payments",
                },
                {
                  "@type": "Offer",
                  name: "Starter",
                  price: "12",
                  priceCurrency: "EUR",
                  billingIncrement: "P1M",
                  description:
                    "Custom domain, up to 100 products, 4 color schemes",
                },
                {
                  "@type": "Offer",
                  name: "Pro",
                  price: "29",
                  priceCurrency: "EUR",
                  billingIncrement: "P1M",
                  description:
                    "Unlimited products, priority support, advanced analytics",
                },
              ],
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "127",
                bestRating: "5",
              },
              description:
                "Create a professional online store in 5 minutes. No coding required. Platform for small businesses in SK, CZ, UA and DE.",
              featureList:
                "Stripe payments, AI translations, 9 business templates, 5 languages, custom domains, digital products",
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
                  name: "How much does it cost to create a store?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "The Free plan is €0 forever with up to 10 products. Starter is €12/month with custom domain and up to 100 products. Pro is €29/month with unlimited products and priority support.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Do I need technical skills?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Zero coding required. The visual editor offers 9 business templates and 4 color schemes. You can publish a store in under 5 minutes.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What payment methods do you support?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Stripe is integrated out of the box — customers can pay with Visa, Mastercard, Apple Pay, and Google Pay in 135+ currencies.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I use my own domain?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes, on Starter and Pro plans you can connect any custom domain with free SSL. Setup takes under 2 minutes.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I sell digital products?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes — e-books, courses, templates, music, software. Buyers receive a secure download link after payment. Files up to 500 MB per product.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How long does it take to create a store?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "5 minutes to a live store. Pick a business type, add your store name, upload products. AI generates descriptions and SEO metadata automatically.",
                  },
                },
                {
                  "@type": "Question",
                  name: "I don't speak the local language. Can I still create a store?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Write in any of the 5 supported languages and AI translates everything in 1 click. Over 30% of stores are run by international sellers.",
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
