import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { runImagePipeline } from '@/lib/image-pipeline/decision-engine';

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    // Step 1 — Find lead
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Step 2 — Parse photo URLs from lead.photoUrls (JSON string: ["url1","url2",...])
    const photoUrls: string[] = [];
    if (lead.photoUrls) {
      try {
        const parsed = JSON.parse(lead.photoUrls) as unknown;
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (typeof u === 'string' && u.trim()) photoUrls.push(u.trim());
          }
        }
      } catch { /* malformed JSON — treat as empty */ }
    }

    if (photoUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No photos found for this lead' },
        { status: 400 },
      );
    }

    // Step 3 — Download all photos into Buffers
    const images = await Promise.all(
      photoUrls.map(async (url, i) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch photo ${i + 1}: HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        return { buffer: Buffer.from(ab), name: `photo-${i + 1}.jpg` };
      }),
    );

    // Step 4 — Run image pipeline
    const result = await runImagePipeline(
      images,
      lead.businessName ?? '',
      lead.businessType,
    );

    // Step 5 — Upload processed hero to Vercel Blob (if available)
    let heroBlobUrl: string | null = null;
    if (result.heroImage?.buffer) {
      const { url } = await put(
        `processed/${id}/hero.webp`,
        result.heroImage.buffer,
        { access: 'public' },
      );
      heroBlobUrl = url;
    }

    // Step 6 — Persist result in lead.siteQaReport as JSON
    const report = JSON.stringify({
      type:            'image-pipeline',
      decision:        result.decision,
      heroConfig:      result.heroConfig,
      heroBlobUrl,
      processingStats: result.processingStats,
      galleryImages:   result.galleryImages,
      warnings:        result.warnings,
      processedAt:     new Date().toISOString(),
    });

    await db.lead.update({
      where: { id },
      data:  { siteQaReport: report },
    });

    return NextResponse.json({
      success:         true,
      decision:        result.decision,
      heroConfig:      result.heroConfig,
      heroBlobUrl,
      processingStats: result.processingStats,
      warnings:        result.warnings,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
