import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { takeScreenshot } from '@/lib/screenshot';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const lead = await db.lead.findUnique({ where: { id } });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (!lead.siteVercelUrl) {
    return NextResponse.json(
      { error: 'Lead has no siteVercelUrl — create site first' },
      { status: 400 }
    );
  }

  try {
    const buffer = await takeScreenshot(lead.siteVercelUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
