import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserPlan } from '@/lib/shop-queries';
import dns from 'dns/promises';

const domainSchema = z.object({
  domain: z.string().min(3).max(253).regex(
    /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.[a-zA-Z]{2,}$/,
    'Invalid domain format',
  ),
});

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'vendshop.shop';

/** Save / update custom domain for a store */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: storeId } = await params;

  // Verify ownership
  const store = await db.store.findFirst({
    where: { id: storeId, userId: session.user.id },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Plan check — Starter or Pro required
  const plan = await getUserPlan(session.user.id);
  if (plan === 'FREE') {
    return NextResponse.json(
      { error: 'PLAN_REQUIRED', message: 'Custom domains require Starter or Pro plan.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { domain } = domainSchema.parse(body);

    // Prevent using our own root domain or subdomains
    if (domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`)) {
      return NextResponse.json(
        { error: 'Cannot use vendshop.shop as custom domain.' },
        { status: 400 },
      );
    }

    // Check if domain is already taken by another store
    const existing = await db.store.findUnique({
      where: { customDomain: domain },
    });
    if (existing && existing.id !== storeId) {
      return NextResponse.json(
        { error: 'This domain is already connected to another store.' },
        { status: 409 },
      );
    }

    await db.store.update({
      where: { id: storeId },
      data: { customDomain: domain },
    });

    return NextResponse.json({ success: true, domain });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid domain format.' }, { status: 400 });
    }
    console.error('Domain save error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** Remove custom domain */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: storeId } = await params;

  const store = await db.store.findFirst({
    where: { id: storeId, userId: session.user.id },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  await db.store.update({
    where: { id: storeId },
    data: { customDomain: null },
  });

  return NextResponse.json({ success: true });
}

/** Verify DNS configuration */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: storeId } = await params;

  const store = await db.store.findFirst({
    where: { id: storeId, userId: session.user.id },
    select: { customDomain: true },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  if (!store.customDomain) {
    return NextResponse.json({ error: 'No custom domain set' }, { status: 400 });
  }

  // Check CNAME record
  try {
    const records = await dns.resolveCname(store.customDomain);
    const isValid = records.some(
      (r) => r === 'cname.vercel-dns.com' || r.endsWith('.vercel-dns.com'),
    );

    return NextResponse.json({
      domain: store.customDomain,
      dnsConfigured: isValid,
      cnameRecords: records,
    });
  } catch {
    // DNS lookup failed — domain not configured yet
    return NextResponse.json({
      domain: store.customDomain,
      dnsConfigured: false,
      cnameRecords: [],
    });
  }
}
