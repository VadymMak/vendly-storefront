import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { takeScreenshot } from '@/lib/screenshot';
import { analyzeScreenshot, type QaReport } from '@/lib/visual-qa';

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

    // If no Anthropic API key — skip analysis, return raw screenshot
    if (!process.env.ANTHROPIC_API_KEY) {
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    }

    const qaReport: QaReport = await analyzeScreenshot(buffer);

    await db.lead.update({
      where: { id },
      data: {
        siteQaReport: JSON.stringify(qaReport),
        siteStatus:   qaReport.passed ? 'qa_passed' : 'qa_failed',
      },
    });

    return NextResponse.json({ success: true, qaReport, screenshotTaken: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
