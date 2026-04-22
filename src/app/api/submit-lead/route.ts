import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const data = await request.json() as Record<string, unknown>;

  // ── Save to DB ─────────────────────────────────────────────────────────────
  let lead: { id: string } | undefined;
  try {
    lead = await db.lead.create({
      data: {
        // Backward-compat fields (OnboardingChat)
        businessType: String(data.businessType || ''),
        services:     String(data.services     || data.description || ''),
        contact:      String(data.contact      || data.phone       || data.email || ''),
        language:     String(data.language     || ''),
        demoUrl:      data.demoUrl             ? String(data.demoUrl)      : null,

        // /create wizard fields
        businessName:    data.businessName    ? String(data.businessName)    : null,
        description:     data.description     ? String(data.description)     : null,
        plan:            data.plan            ? String(data.plan)            : null,
        email:           data.email           ? String(data.email)           : null,
        address:         data.address         ? String(data.address)         : null,
        workingHours:    data.workingHours     ? String(data.workingHours)    : null,
        selectedPalette: data.palette         ? String(data.palette)         : null,
        logoUrl:         data.logoUrl         ? String(data.logoUrl)         : null,
        heroPhotoUrl:    data.heroPhotoUrl     ? String(data.heroPhotoUrl)    : null,
        galleryUrls:     Array.isArray(data.galleryUrls)
                           ? (data.galleryUrls as unknown[]).filter((u): u is string => typeof u === 'string')
                           : [],
      },
    });
    console.log('Lead saved:', lead.id);
  } catch (err) {
    console.error('DB save failed:', err);
  }

  // ── Send to Telegram ───────────────────────────────────────────────────────
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId   = process.env.TELEGRAM_CHAT_ID;

  if (telegramBotToken && telegramChatId) {
    const desc = data.description ? String(data.description).slice(0, 120) + '…' : '-';
    const galleryCount = Array.isArray(data.galleryUrls) ? (data.galleryUrls as unknown[]).length : 0;

    const message = [
      '🆕 Новый лид VendShop!',
      '',
      `Бизнес: ${data.businessType || '-'} — ${data.businessName || '-'}`,
      `Тариф: ${data.plan || '-'}`,
      `Описание: ${desc}`,
      '',
      `Контакт: ${data.contact || data.phone || '-'}`,
      `Email: ${data.email   || '-'}`,
      `Адрес: ${data.address || '-'}`,
      `Язык: ${data.language || '-'}`,
      '',
      `Фото: hero=${data.heroPhotoUrl ? '✅' : '—'} · logo=${data.logoUrl ? '✅' : '—'} · gallery=${galleryCount}`,
      `ID: ${lead?.id    || '-'}`,
      `Время: ${new Date().toLocaleString('sk-SK')}`,
      '',
      `Бриф: ${lead?.id ? `vendshop.shop/brief/${lead.id}` : '-'}`,
    ].join('\n');

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: message }),
        },
      );
      const result = await res.json();
      console.log('Telegram response:', JSON.stringify(result));
    } catch (err) {
      console.error('Telegram failed:', err);
    }
  }

  return NextResponse.json({ ok: true, leadId: lead?.id });
}
