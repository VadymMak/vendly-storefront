import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return false;
  }
  return true;
}

// GET /api/admin/leads — list all leads, newest first
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(leads);
}

// PATCH /api/admin/leads — update status / notes / siteUrl / siteName
export async function PATCH(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
