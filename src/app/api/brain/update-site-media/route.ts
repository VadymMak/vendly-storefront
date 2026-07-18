import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      store_slug?: string;
      lead_email?: string;
      section: 'hero' | 'logo' | 'gallery';
      media_url: string;
      media_type?: 'image' | 'video';
    };

    const { store_slug, lead_email, section, media_url, media_type = 'image' } = body;

    if (!media_url) {
      return NextResponse.json({ error: 'media_url is required' }, { status: 400 });
    }
    if (!store_slug && !lead_email) {
      return NextResponse.json({ error: 'store_slug or lead_email is required' }, { status: 400 });
    }

    // ── Store (self-serve sites) ──────────────────────────────────────
    if (store_slug) {
      const store = await db.store.findUnique({ where: { slug: store_slug } });
      if (!store) {
        return NextResponse.json({ error: `Store not found: ${store_slug}` }, { status: 404 });
      }

      const settings = (store.settings ?? {}) as Prisma.JsonObject;

      if (section === 'logo') {
        await db.store.update({
          where: { slug: store_slug },
          data: { logo: media_url },
        });
      } else if (section === 'hero') {
        // Store uses settings.bannerImage for hero image, settings.bannerVideo for video
        const heroKey = media_type === 'video' ? 'bannerVideo' : 'bannerImage';
        await db.store.update({
          where: { slug: store_slug },
          data: { settings: { ...settings, [heroKey]: media_url } },
        });
      } else if (section === 'gallery') {
        const existing = Array.isArray(settings['promoBanners'])
          ? (settings['promoBanners'] as string[])
          : [];
        await db.store.update({
          where: { slug: store_slug },
          data: {
            settings: {
              ...settings,
              promoBanners: [...existing, media_url].slice(-20),
            },
          },
        });
      }

      return NextResponse.json({
        updated: true,
        target: 'store',
        slug: store_slug,
        section,
        media_url,
      });
    }

    // ── Lead (client sites) ───────────────────────────────────────────
    if (lead_email) {
      const lead = await db.lead.findFirst({ where: { email: lead_email } });
      if (!lead) {
        return NextResponse.json({ error: `Lead not found: ${lead_email}` }, { status: 404 });
      }

      if (section === 'logo') {
        await db.lead.update({ where: { id: lead.id }, data: { logoUrl: media_url } });
      } else if (section === 'hero') {
        await db.lead.update({ where: { id: lead.id }, data: { heroPhotoUrl: media_url } });
      } else if (section === 'gallery') {
        const existing = lead.galleryUrls ?? [];
        await db.lead.update({
          where: { id: lead.id },
          data: { galleryUrls: [...existing, media_url].slice(-20) },
        });
      }

      return NextResponse.json({
        updated: true,
        target: 'lead',
        email: lead_email,
        section,
        media_url,
      });
    }
  } catch (error) {
    console.error('[brain/update-site-media]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
