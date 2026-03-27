import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'vendshop.shop';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Remove port for local development (localhost:3000 → localhost)
  const currentHost = hostname.replace(/:\d+$/, '');

  // If this is the root domain, localhost, or Vercel preview URL → pass through to main app
  if (
    currentHost === ROOT_DOMAIN ||
    currentHost === `www.${ROOT_DOMAIN}` ||
    currentHost === 'localhost' ||
    currentHost.endsWith('.vercel.app')
  ) {
    return NextResponse.next();
  }

  // Extract subdomain: smak.vendshop.shop → smak
  // Or custom domain: myshop.sk → myshop.sk
  const isSubdomain = currentHost.endsWith(`.${ROOT_DOMAIN}`);
  const slug = isSubdomain
    ? currentHost.replace(`.${ROOT_DOMAIN}`, '')
    : currentHost;

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
