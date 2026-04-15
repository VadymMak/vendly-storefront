import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const data = await request.json() as Record<string, string>;

  // ── Save to DB ─────────────────────────────────────────────────────────────
  let lead: { id: string } | undefined;
  try {
    lead = await db.lead.create({
      data: {
        businessType: data.businessType || '',
        services:     data.services     || '',
        contact:      data.contact      || '',
        language:     data.language     || '',
        demoUrl:      data.demoUrl      || null,
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
    const message = [
      '🆕 Новый лид VendShop!',
      '',
      'Тип: '    + (data.businessType || '-'),
      'Услуги: ' + (data.services     || '-'),
      'Контакт: '+ (data.contact      || '-'),
      'Язык: '   + (data.language     || '-'),
      'Демо: '   + (data.demoUrl      || '-'),
      'ID: '     + (lead?.id           || '-'),
      'Время: '  + new Date().toLocaleString('sk-SK'),
      '',
      'Бриф: '   + (lead?.id ? `vendshop.shop/brief/${lead.id}` : '-'),
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
