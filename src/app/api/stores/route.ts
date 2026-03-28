import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const dayScheduleSchema = z.object({
  open: z.boolean(),
  from: z.string(),
  to: z.string(),
  breakFrom: z.string().optional(),
  breakTo: z.string().optional(),
});

const storeSchema = z.object({
  userId:       z.string().min(1),
  name:         z.string().min(1, 'Názov je povinný'),
  slug:         z.string().min(2).regex(/^[a-z0-9-]+$/, 'Len malé písmená, číslice a pomlčky'),
  description:  z.string().optional().default(''),
  templateId:   z.string().default('physical'),
  shopLanguage: z.string().default('sk'),
  colorScheme:  z.enum(['light', 'dark', 'warm', 'bold']).default('light'),
  currency:     z.string().default('EUR'),
  whatsapp:     z.string().optional().default(''),
  instagram:    z.string().optional().default(''),
  facebook:     z.string().optional().default(''),
  address:      z.string().optional().default(''),
  phone:        z.string().optional().default(''),
  openingHours: z.string().optional().default(''),
  deliveryInfo: z.string().optional().default(''),
  aboutText:    z.string().optional().default(''),
  bannerImage:  z.string().nullable().optional(),
  quickBadges:  z.array(z.string()).optional(),
  structuredHours: z.tuple([dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema]).optional(),
  orderAcceptance: z.object({ enabled: z.boolean(), from: z.string(), to: z.string() }).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  isPublished:  z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  try {
    const body = await request.json();
    const data = storeSchema.parse(body);

    if (data.userId !== session.user.id) {
      return NextResponse.json({ error: 'Neautorizovaný' }, { status: 403 });
    }

    // Check slug uniqueness
    const existing = await db.store.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: 'Táto URL adresa je už obsadená' }, { status: 409 });
    }

    const store = await db.store.create({
      data: {
        userId:      data.userId,
        name:        data.name,
        slug:        data.slug,
        description: data.description || null,
        templateId:  data.templateId,
        shopLanguage: data.shopLanguage,
        isPublished: data.isPublished,
        settings: {
          colorScheme:  data.colorScheme,
          currency:     data.currency,
          whatsapp:     data.whatsapp || undefined,
          instagram:    data.instagram || undefined,
          facebook:     data.facebook || undefined,
          address:      data.address || undefined,
          phone:        data.phone || undefined,
          openingHours: data.openingHours || undefined,
          deliveryInfo: data.deliveryInfo || undefined,
          aboutText:    data.aboutText || undefined,
          bannerImage:  data.bannerImage || undefined,
          quickBadges:  data.quickBadges || undefined,
          structuredHours: data.structuredHours || undefined,
          orderAcceptance: data.orderAcceptance || undefined,
          coordinates: data.coordinates || undefined,
        },
      },
    });

    return NextResponse.json({ id: store.id, slug: store.slug }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Neplatné údaje' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Chyba servera' }, { status: 500 });
  }
}
