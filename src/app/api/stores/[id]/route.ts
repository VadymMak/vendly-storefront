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

const patchSchema = z.object({
  name:         z.string().min(1).optional(),
  description:  z.string().optional(),
  templateId:   z.string().optional(),
  shopLanguage: z.string().optional(),
  isPublished:  z.boolean().optional(),
  colorScheme:  z.enum(['light', 'dark', 'warm', 'bold', 'festive', 'elegant']).optional(),
  currency:     z.string().optional(),
  whatsapp:     z.string().optional(),
  instagram:    z.string().optional(),
  facebook:     z.string().optional(),
  address:      z.string().optional(),
  phone:        z.string().optional(),
  openingHours: z.string().optional(),
  deliveryInfo: z.string().optional(),
  aboutText:    z.string().optional(),
  logo:         z.string().nullable().optional(),
  bannerImage:  z.string().nullable().optional(),
  quickBadges:  z.array(z.string()).optional(),
  structuredHours: z.tuple([dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema, dayScheduleSchema]).optional(),
  orderAcceptance: z.object({ enabled: z.boolean(), from: z.string(), to: z.string() }).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  promoBanners: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
    ctaText: z.string().optional(),
    ctaLink: z.string().optional(),
    enabled: z.boolean(),
  })).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const { id } = await params;
  const store = await db.store.findFirst({ where: { id, userId: session.user.id } });
  if (!store) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    // Merge settings
    const currentSettings = store.settings as Record<string, unknown>;
    const newSettings: Record<string, unknown> = { ...currentSettings };
    const settingsFields = ['colorScheme','currency','whatsapp','instagram','facebook','address','phone','openingHours','deliveryInfo','aboutText','bannerImage','quickBadges','structuredHours','orderAcceptance','coordinates','promoBanners'] as const;
    for (const field of settingsFields) {
      if (data[field] !== undefined) {
        newSettings[field] = data[field] || undefined;
      }
    }

    await db.store.update({
      where: { id },
      data: {
        ...(data.name         !== undefined && { name: data.name }),
        ...(data.description  !== undefined && { description: data.description || null }),
        ...(data.templateId   !== undefined && { templateId: data.templateId }),
        ...(data.shopLanguage !== undefined && { shopLanguage: data.shopLanguage }),
        ...(data.isPublished  !== undefined && { isPublished: data.isPublished }),
        ...(data.logo         !== undefined && { logo: data.logo || null }),
        settings: newSettings as Parameters<typeof db.store.update>[0]['data']['settings'],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Neplatné údaje' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Chyba servera' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });

  const { id } = await params;

  // Verify ownership before deleting
  const store = await db.store.findFirst({ where: { id, userId: session.user.id } });
  if (!store) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 });

  await db.store.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
