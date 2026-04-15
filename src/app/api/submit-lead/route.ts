import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const data = await request.json() as Record<string, string>;

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramBotToken || !telegramChatId) {
    console.log('New lead (Telegram not configured):', data);
    return NextResponse.json({ ok: true });
  }

  const message = `
🆕 Новый лид VendShop!

📋 Тип: ${data.businessType ?? '—'}
🏢 Название: ${data.businessName ?? '—'}
📝 Услуги: ${data.services ?? '—'}
🎨 Стиль: ${data.style ?? '—'}
📱 Контакт: ${data.contact ?? '—'}
🌐 Язык: ${data.language ?? '—'}
🔗 Демо: ${data.demoUrl || 'не показан'}
⏰ Время: ${new Date().toLocaleString('sk-SK')}
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Telegram send failed:', err);
  }

  return NextResponse.json({ ok: true });
}
