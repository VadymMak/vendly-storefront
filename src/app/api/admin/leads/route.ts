import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/leads — list all leads, newest first
export async function GET() {
  const leads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(leads);
}

// PATCH /api/admin/leads — update status / notes / siteUrl / siteName
export async function PATCH(request: Request) {
  const body = await request.json() as {
    id: string;
    status?: string;
    notes?: string;
    siteUrl?: string;
    siteName?: string;
  };

  const { id, ...fields } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const lead = await db.lead.update({
    where: { id },
    data: fields,
  });

  return NextResponse.json(lead);
}
