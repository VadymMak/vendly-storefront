import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Rate limiter (per IP) ─────────────────────────────────────────────────────
const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string, limit: number): boolean {
  const now   = Date.now();
  const entry = rl.get(ip);
  if (!entry || now > entry.reset) {
    rl.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── GET /api/brief/[leadId] ───────────────────────────────────────────────────
// Returns public fields only (no status, notes, finance)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRate(ip, 30)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    businessType:   lead.businessType,
    services:       lead.services,
    contact:        lead.contact,
    language:       lead.language,
    businessName:   lead.businessName,
    briefSubmitted: lead.briefSubmitted,
  });
}

// ── PATCH /api/brief/[leadId] ─────────────────────────────────────────────────
// Submit brief data; marks briefSubmitted = true
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (lead.briefSubmitted) {
    return NextResponse.json({ error: 'Brief already submitted' }, { status: 409 });
  }

  const raw = await request.json() as Record<string, string | null | undefined>;

  // Drop honeypot field
  delete raw.website;

  const {
    businessName, address, workingHours, email,
    socialInstagram, socialFacebook, referenceUrl, wishes,
    priceListUrl, logoUrl, photoUrls,
    selectedPalette, selectedHero, selectedMood,
    additionalServices,
  } = raw;

  // Build update — only include defined values
  const data: Record<string, unknown> = {
    briefSubmitted:   true,
    briefSubmittedAt: new Date(),
  };

  const setIfDefined = (key: string, val: string | null | undefined) => {
    if (val !== undefined) data[key] = val || null;
  };

  setIfDefined('businessName',    businessName);
  setIfDefined('address',         address);
  setIfDefined('workingHours',    workingHours);
  setIfDefined('email',           email);
  setIfDefined('socialInstagram', socialInstagram);
  setIfDefined('socialFacebook',  socialFacebook);
  setIfDefined('referenceUrl',    referenceUrl);
  setIfDefined('wishes',          wishes);
  setIfDefined('priceListUrl',    priceListUrl);
  setIfDefined('logoUrl',         logoUrl);
  setIfDefined('photoUrls',       photoUrls);
  setIfDefined('selectedPalette', selectedPalette);
  setIfDefined('selectedHero',    selectedHero);
  setIfDefined('selectedMood',    selectedMood);

  // Append additional services to existing services string
  if (additionalServices?.trim()) {
    data.services = `${lead.services}\n\nДоп: ${additionalServices.trim()}`;
  }

  await db.lead.update({ where: { id: leadId }, data });

  // ── Telegram notification ──────────────────────────────────────────────────
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId) {
    const photoCount = photoUrls ? (() => { try { return (JSON.parse(photoUrls) as string[]).length; } catch { return 0; } })() : 0;
    const msg = [
      '📋 Бриф заполнен!',
      '',
      `Бизнес: ${businessName || lead.businessName || '-'}`,
      `Тип: ${lead.businessType}`,
      `Палитра: ${selectedPalette || '-'}`,
      `Hero: ${selectedHero || '-'}`,
      `Фото: ${photoCount}`,
      `Контакт: ${lead.contact}`,
      '',
      'CRM: vendshop.shop/admin/leads',
    ].join('\n');

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text: msg }),
      });
    } catch (err) {
      console.error('Telegram brief notification failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
