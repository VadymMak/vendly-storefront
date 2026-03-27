import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const patchSchema = z.object({
  name:         z.string().min(1).optional(),
  description:  z.string().optional(),
  templateId:   z.string().optional(),
  shopLanguage: z.string().optional(),
  isPublished:  z.boolean().optional(),
  colorScheme:  z.enum(['light', 'dark', 'warm', 'bold']).optional(),
  currency:     z.string().optional(),
  whatsapp:     z.string().optional(),
  instagram:    z.string().optional(),
  facebook:     z.string().optional(),
  address:      z.string().optional(),
  phone:        z.string().optional(),
  openingHours: z.string().optional(),
  deliveryInfo: z.string().optional(),
  aboutText:    z.string().optional(),
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
    const settingsFields = ['colorScheme','currency','whatsapp','instagram','facebook','address','phone','openingHours','deliveryInfo','aboutText'] as const;
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
