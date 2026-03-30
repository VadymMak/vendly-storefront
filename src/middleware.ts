import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'vendshop.shop';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Remove port for local development (localhost:3000 → localhost)
  const currentHost = hostname.replace(/:\d+$/, '');

  // If this is the root domain, localhost, or Vercel preview URL → pass through to main app
  const isMainDomain =
    currentHost === ROOT_DOMAIN ||
    currentHost === `www.${ROOT_DOMAIN}` ||
    currentHost === 'localhost' ||
    currentHost.endsWith('.vercel.app');

  if (isMainDomain) {
    // Redirect /shop/[slug] path to subdomain in production
    const shopPathMatch = url.pathname.match(/^\/shop\/([^/]+)(\/.*)?$/);
    if (shopPathMatch && currentHost !== 'localhost' && !currentHost.endsWith('.vercel.app')) {
      const slug = shopPathMatch[1];
      const rest = shopPathMatch[2] || '';
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      return NextResponse.redirect(
        `${protocol}://${slug}.${ROOT_DOMAIN}${rest}${url.search}`,
        301
      );
    }
    return NextResponse.next();
  }

  // Extract subdomain: smak.vendshop.shop → smak
  // Or custom domain: myshop.sk → myshop.sk
  const isSubdomain = currentHost.endsWith(`.${ROOT_DOMAIN}`);
  const slug = isSubdomain
    ? currentHost.replace(`.${ROOT_DOMAIN}`, '')
    : currentHost;

  // API routes should NOT be rewritten — they live at /api/* on the root app
  if (url.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rewrite to /shop/[slug] route which will render the storefront
  url.pathname = `/shop/${slug}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
