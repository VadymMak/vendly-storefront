import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { countRecentReviewsByIp } from '@/lib/shop-queries';
import { headers } from 'next/headers';

const MAX_REVIEWS_PER_DAY = 3;

const reviewSchema = z.object({
  storeId:     z.string().min(1),
  author:      z.string().min(1).max(100),
  authorEmail: z.string().email().optional().or(z.literal('')),
  rating:      z.number().int().min(1).max(5),
  text:        z.string().min(3).max(2000),
});

/** GET — public: get published reviews for a store */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: 'storeId required' }, { status: 400 });
  }

  const reviews = await db.review.findMany({
    where: { storeId, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      author: true,
      rating: true,
      text: true,
      ownerReply: true,
      createdAt: true,
    },
  });

  return NextResponse.json(reviews);
}

/** POST — public: submit a new review (pending moderation) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = reviewSchema.parse(body);

    // Verify store exists and is published
    const store = await db.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, isPublished: true },
    });
    if (!store || !store.isPublished) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // IP-based spam protection
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown';

    if (ip !== 'unknown') {
      const recentCount = await countRecentReviewsByIp(ip);
      if (recentCount >= MAX_REVIEWS_PER_DAY) {
        return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
      }
    }

    const review = await db.review.create({
      data: {
        storeId:     data.storeId,
        author:      data.author,
        authorEmail: data.authorEmail || null,
        rating:      data.rating,
        text:        data.text,
        status:      'PENDING',
        ipAddress:   ip !== 'unknown' ? ip : null,
      },
    });

    return NextResponse.json({ id: review.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Invalid data' }, { status: 400 });
    }
    console.error('Review POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
