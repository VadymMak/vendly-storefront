import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSiteConfig, type LeadData, type HeroConfigHint } from '@/lib/generate-site-config';
import { commitFiles } from '@/lib/github-commit';
import { runImagePipeline } from '@/lib/image-pipeline/decision-engine';

// ─── Local types ──────────────────────────────────────────────────────────────

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}

interface VercelProjectResponse {
  id: string;
  name: string;
  alias?: { domain: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

function buildRepoName(businessName: string | null, businessType: string): string {
  const base = slugify(businessName ?? 'site');
  const type = slugify(businessType);
  return `${base}-${type}`;
}

/** Fetch raw file content from a GitHub repo. Tries each path in order, returns null if all fail. */
async function fetchTemplateFile(
  owner: string,
  token: string,
  repo: string,
  paths: string[],
): Promise<string | null> {
  for (const path of paths) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.raw+json',
        },
      },
    );
    if (res.ok) return res.text();
  }
  return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // Validate required env vars
  const GITHUB_TOKEN       = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER       = process.env.GITHUB_OWNER;
  const GITHUB_TEMPLATE_REPO = process.env.GITHUB_TEMPLATE_REPO;
  const VERCEL_TOKEN       = process.env.VERCEL_TOKEN;

  const missingVars = [
    !GITHUB_TOKEN        && 'GITHUB_TOKEN',
    !GITHUB_OWNER        && 'GITHUB_OWNER',
    !GITHUB_TEMPLATE_REPO && 'GITHUB_TEMPLATE_REPO',
    !VERCEL_TOKEN        && 'VERCEL_TOKEN',
  ].filter(Boolean);

  if (missingVars.length > 0) {
    return NextResponse.json(
      { error: `Missing required env vars: ${missingVars.join(', ')}` },
      { status: 500 },
    );
  }

  // Step 1 — Find lead
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Step 2 — Guard: already in progress or done
  if (lead.siteStatus !== 'none' && lead.siteStatus !== 'error') {
    return NextResponse.json(
      { error: 'Site already creating or created' },
      { status: 400 },
    );
  }

  // Step 3 — Mark as creating
  await db.lead.update({ where: { id }, data: { siteStatus: 'creating' } });

  let repoName = buildRepoName(lead.businessName, lead.businessType);

  try {
    // Step 4 — Create GitHub repo from template
    const githubRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_TEMPLATE_REPO}/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner: GITHUB_OWNER, name: repoName, private: false }),
      },
    );

    if (githubRes.status === 422) {
      // Name collision — append random suffix and retry
      repoName = `${repoName}-${randomSuffix()}`;
      const retryRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_TEMPLATE_REPO}/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner: GITHUB_OWNER, name: repoName, private: false }),
        },
      );
      if (!retryRes.ok) {
        const errBody = await retryRes.text();
        throw new Error(`GitHub API error (retry): ${retryRes.status} — ${errBody}`);
      }
      void (await retryRes.json() as GitHubRepoResponse);
    } else if (!githubRes.ok) {
      const errBody = await githubRes.text();
      throw new Error(`GitHub API error: ${githubRes.status} — ${errBody}`);
    } else {
      void (await githubRes.json() as GitHubRepoResponse);
    }

    // Step 5 — Wait for GitHub to finish generating from template
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));

    // Step 6 — Create Vercel project with GitHub integration
    const vercelRes = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        framework: 'nextjs',
        gitRepository: { type: 'github', repo: `${GITHUB_OWNER}/${repoName}` },
      }),
    });

    if (!vercelRes.ok) {
      const errBody = await vercelRes.text();
      throw new Error(`Vercel API error: ${vercelRes.status} — ${errBody}`);
    }
    void (await vercelRes.json() as VercelProjectResponse);

    const repoUrl   = `https://github.com/${GITHUB_OWNER}/${repoName}`;
    const vercelUrl = `https://${repoName}.vercel.app`;

    // ── Steps 7–9: config generation (non-fatal) ────────────────────────────
    let configGenerated = false;
    let configWarning: string | null = null;

    try {
      // Step 7 — Read template files from vendshop-template via GitHub API
      const [templateConfigTs, templateConstantsTs] = await Promise.all([
        fetchTemplateFile(GITHUB_OWNER!, GITHUB_TOKEN!, GITHUB_TEMPLATE_REPO!, [
          'lib/config.ts',
          'src/config.ts',
        ]),
        fetchTemplateFile(GITHUB_OWNER!, GITHUB_TOKEN!, GITHUB_TEMPLATE_REPO!, [
          'lib/constants.ts',
          'src/lib/constants.ts',
          'src/constants.ts',
        ]),
      ]);

      if (!templateConfigTs || !templateConstantsTs) {
        throw new Error(
          `Could not read template files from ${GITHUB_TEMPLATE_REPO} ` +
          `(config: ${templateConfigTs ? 'ok' : 'missing'}, constants: ${templateConstantsTs ? 'ok' : 'missing'})`,
        );
      }

      // Step 8 — Optionally run image pipeline (feature-flagged)
      const imagePipelineEnabled =
        process.env.IMAGE_QUALITY_GATE === 'true' ||
        process.env.VISION_ANALYSIS_ENABLED === 'true';

      let detectedHeroConfig: HeroConfigHint | null = null;
      let heroImageBase64: string | null = null;

      if (imagePipelineEnabled && lead.photoUrls) {
        try {
          const photoUrls: string[] = [];
          const parsed = JSON.parse(lead.photoUrls) as unknown;
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              if (typeof u === 'string' && u.trim()) photoUrls.push(u.trim());
            }
          }

          if (photoUrls.length > 0) {
            const images = await Promise.all(
              photoUrls.map(async (url, i) => {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} for photo ${i + 1}`);
                const ab = await res.arrayBuffer();
                return { buffer: Buffer.from(ab), name: `photo-${i + 1}.jpg` };
              }),
            );

            const pipelineResult = await runImagePipeline(
              images,
              lead.businessName ?? '',
              lead.businessType,
            );

            if (pipelineResult.heroConfig) {
              detectedHeroConfig = {
                heroTextColor:  pipelineResult.heroConfig.heroTextColor,
                heroOverlay:    pipelineResult.heroConfig.heroOverlay,
                overlayOpacity: pipelineResult.heroConfig.overlayOpacity,
                textPosition:   pipelineResult.heroConfig.textPosition,
              };
            }

            if (pipelineResult.heroImage?.buffer) {
              heroImageBase64 = pipelineResult.heroImage.buffer.toString('base64');
            }
          }
        } catch (imgErr) {
          // Non-fatal — log and continue without hero config
          const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
          configWarning = `Image pipeline warning: ${msg}`;
        }
      }

      // Step 9 — Generate config with Claude API
      const leadData: LeadData = {
        businessName:      lead.businessName,
        businessType:      lead.businessType,
        contact:           lead.contact,
        email:             lead.email,
        language:          lead.language,
        address:           lead.address,
        workingHours:      lead.workingHours,
        socialInstagram:   lead.socialInstagram,
        socialFacebook:    lead.socialFacebook,
        referenceUrl:      lead.referenceUrl,
        wishes:            lead.wishes,
        priceListUrl:      lead.priceListUrl,
        logoUrl:           lead.logoUrl,
        photoUrls:         lead.photoUrls,
        briefServicesJson: lead.briefServicesJson,
        selectedPalette:   lead.selectedPalette,
        selectedHero:      lead.selectedHero,
        selectedMood:      lead.selectedMood,
      };

      const generated = await generateSiteConfig(
        leadData,
        templateConfigTs,
        templateConstantsTs,
        detectedHeroConfig,
      );

      // Step 10 — Commit generated files (+ hero image if available)
      const filesToCommit = [
        { path: 'lib/config.ts',    content: generated.configTs },
        { path: 'lib/constants.ts', content: generated.constantsTs },
        ...(heroImageBase64
          ? [{ path: 'public/images/hero.webp', content: heroImageBase64, encoding: 'base64' as const }]
          : []),
      ];

      await commitFiles(repoName, filesToCommit);

      configGenerated = true;

      // Step 11 — Wait for Vercel to pick up the new commit
      await new Promise<void>((resolve) => setTimeout(resolve, 5000));

    } catch (configErr) {
      const msg = configErr instanceof Error ? configErr.message : String(configErr);
      configWarning = `Config generation failed: ${msg}`;
      // Non-fatal — continue with default template content
    }

    // Step 12 — Update lead
    await db.lead.update({
      where: { id },
      data: {
        siteRepoUrl:   repoUrl,
        siteRepoName:  repoName,
        siteVercelUrl: vercelUrl,
        siteStatus:    'created',
        siteCreatedAt: new Date(),
        siteError:     configWarning,
      },
    });

    return NextResponse.json({ success: true, repoUrl, vercelUrl, configGenerated });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db.lead.update({
      where: { id },
      data: { siteStatus: 'error', siteError: message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
