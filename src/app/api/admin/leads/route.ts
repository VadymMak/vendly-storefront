import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

// GET /api/admin/leads — list all leads, newest first
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const leads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(leads);
}

// PATCH /api/admin/leads — update any field by id
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await request.json() as Record<string, unknown>;
  const { id, ...updates } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const lead = await db.lead.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(lead);
}

// DELETE /api/admin/leads — soft delete (status = 'deleted')
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await request.json() as { id?: string };
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const lead = await db.lead.update({
    where: { id },
    data: { status: 'deleted' },
  });

  return NextResponse.json(lead);
}
