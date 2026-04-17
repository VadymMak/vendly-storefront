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

const CYRILLIC_MAP: Record<string, string> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u',
  ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'',
  э:'e', ю:'yu', я:'ya', і:'i', ї:'yi', є:'ye', ґ:'g',
};

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');
}

function slugify(text: string): string {
  return transliterate(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

function buildRepoName(businessName: string | null | undefined, businessType: string): string {
  let base = slugify(businessName ?? '');
  if (!base) base = 'site';
  if (!/^[a-z0-9]/.test(base)) base = 'site';
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
  const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY;

  console.log('[create-site] ANTHROPIC_API_KEY present:', !!ANTHROPIC_API_KEY);

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

  // Step 2b — Validate businessName
  if (!lead.businessName || lead.businessName.trim() === '') {
    return NextResponse.json(
      { error: 'Business name is required. Please fill in the brief form first.' },
      { status: 400 },
    );
  }

  // Step 3 — Mark as creating
  await db.lead.update({ where: { id }, data: { siteStatus: 'creating' } });

  let repoName = buildRepoName(lead.businessName, lead.businessType);
  console.log('[create-site] Step 1: Creating GitHub repo:', repoName);

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
      console.log('[create-site] Step 1: Name collision, retrying with:', repoName);
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

    // Step 2 — Wait for GitHub to finish generating from template
    // 7s instead of 3s: the git ref for heads/main must be accessible before commitFiles()
    // The old flow had implicit extra delay from Vercel API calls (~2-3s); new flow does not.
    console.log('[create-site] Step 2: Waiting 7s for GitHub repo to settle...');
    await new Promise<void>((resolve) => setTimeout(resolve, 7000));
    console.log('[create-site] Step 2: Done waiting');

    const repoUrl   = `https://github.com/${GITHUB_OWNER}/${repoName}`;
    const vercelUrl = `https://${repoName}.vercel.app`;

    // ── Steps 3–5: config generation (non-fatal) ────────────────────────────
    // Vercel project is created AFTER all commits so it sees the final code immediately.
    let configGenerated = false;
    let configWarning: string | null = null;

    try {
      console.log('[create-site] Step 3: Reading template files');
      // Step 3 — Read template files from vendshop-template via GitHub API
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

      // Step 4 — Optionally run image pipeline (feature-flagged)
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

      console.log('[create-site] Step 4: Generating config with Claude API (ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY, ')');
      // Step 4 — Generate config with Claude API
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
      console.log('[create-site] Step 4 result: configTs.length=', generated.configTs.length, 'constantsTs.length=', generated.constantsTs.length);

      console.log('[create-site] Step 5: Committing files to repo:', repoName);
      // Step 5 — Commit generated files (+ hero image if available)
      const filesToCommit = [
        { path: 'lib/config.ts',    content: generated.configTs },
        { path: 'lib/constants.ts', content: generated.constantsTs },
        ...(heroImageBase64
          ? [{ path: 'public/images/hero.webp', content: heroImageBase64, encoding: 'base64' as const }]
          : []),
      ];

      await commitFiles(repoName, filesToCommit);
      console.log('[create-site] Step 5: commitFiles completed successfully');

      configGenerated = true;

    } catch (configErr) {
      const msg = configErr instanceof Error ? configErr.message : String(configErr);
      const stack = configErr instanceof Error ? configErr.stack : undefined;
      console.error('[create-site] Error at step 3-5:', msg);
      if (stack) console.error('[create-site] Stack:', stack);
      configWarning = `Config generation failed: ${msg}`;
      // Non-fatal — Vercel will deploy the default template content
    }

    // Step 6 — Create Vercel project AFTER all commits are in place
    // This ensures Vercel's initial deploy picks up the fully generated code.
    console.log('[create-site] Step 6: Creating Vercel project');
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
    const vercelProject = await vercelRes.json() as VercelProjectResponse;

    // Step 7 — Trigger explicit production deployment (belt-and-suspenders:
    // Vercel sometimes doesn't auto-deploy on project creation)
    console.log('[create-site] Step 7: Triggering Vercel deployment');
    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:   repoName,
        target: 'production',
        gitSource: {
          type:   'github',
          org:    GITHUB_OWNER,
          repo:   repoName,
          ref:    'main',
        },
      }),
    });

    if (!deployRes.ok) {
      const errBody = await deployRes.text();
      // Non-fatal — project already exists, auto-deploy may still kick in
      console.warn('[create-site] Step 7: Explicit deploy trigger failed (non-fatal):', deployRes.status, errBody);
    } else {
      console.log('[create-site] Step 7: Deployment triggered, project id:', vercelProject.id);
    }

    // Step 8 — Update lead
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
    console.error('[create-site] Error at step 1-2:', message);

    await db.lead.update({
      where: { id },
      data: { siteStatus: 'error', siteError: message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
