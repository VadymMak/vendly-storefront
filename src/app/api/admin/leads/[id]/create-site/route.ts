import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { resolveHeroLayout } from '@/lib/business-types';
import { generateConfigTs, getTemplateRepo, type LeadConfigInput } from '@/lib/generate-config';
import { generateConstantsTs, type LeadConstantsInput } from '@/lib/generate-constants';
import { commitFiles } from '@/lib/github-commit';
import { getLeadPhotos } from '@/lib/lead-photos';
import sharp from 'sharp';

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

/** Poll Vercel until the latest production deployment is READY or ERROR, or maxWaitMs exceeded. */
async function waitForDeployment(
  projectName: string,
  vercelToken: string,
  teamId: string | undefined,
  maxWaitMs = 55000,
): Promise<{ ready: boolean; url: string | null }> {
  const startTime    = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const teamQuery = teamId ? `&teamId=${teamId}` : '';
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${projectName}&limit=1&target=production${teamQuery}`,
        { headers: { Authorization: `Bearer ${vercelToken}` } },
      );
      const data = await res.json() as { deployments?: { state: string; url: string }[] };
      const deployment = data.deployments?.[0];

      if (deployment) {
        console.log('[create-site] Deployment status:', deployment.state);
        if (deployment.state === 'READY') {
          return { ready: true, url: `https://${deployment.url}` };
        }
        if (deployment.state === 'ERROR') {
          console.error('[create-site] Deployment failed:', deployment.url);
          return { ready: false, url: null };
        }
      }
    } catch (e) {
      console.error('[create-site] Poll error:', e);
    }

    await new Promise<void>((r) => setTimeout(r, pollInterval));
  }

  console.warn('[create-site] Deployment timeout after', maxWaitMs, 'ms');
  return { ready: false, url: `https://${projectName}.vercel.app` };
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
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  // Validate required env vars
  const GITHUB_TOKEN      = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER      = process.env.GITHUB_OWNER;
  const VERCEL_TOKEN      = process.env.VERCEL_TOKEN;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  console.log('[create-site] ANTHROPIC_API_KEY present:', !!ANTHROPIC_API_KEY);

  const missingVars = [
    !GITHUB_TOKEN  && 'GITHUB_TOKEN',
    !GITHUB_OWNER  && 'GITHUB_OWNER',
    !VERCEL_TOKEN  && 'VERCEL_TOKEN',
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

  const templateRepo = getTemplateRepo(lead.businessType ?? '');
  console.log('[create-site] Template repo:', templateRepo, '(businessType:', lead.businessType, ')');

  // Step 2 — Guard: already in progress or done
  if (lead.siteStatus !== 'none' && lead.siteStatus !== 'error') {
    return NextResponse.json(
      { error: 'Site already creating or created' },
      { status: 400 },
    );
  }

  // Step 3 — Validate businessName
  if (!lead.businessName || lead.businessName.trim() === '') {
    return NextResponse.json(
      { error: 'Business name is required. Please fill in the brief form first.' },
      { status: 400 },
    );
  }

  // Step 4 — Mark as creating
  await db.lead.update({ where: { id }, data: { siteStatus: 'creating' } });

  const repoName = buildRepoName(lead.businessName, lead.businessType);
  console.log('[create-site] Target repo name:', repoName);

  try {
    // Step 5 — Read template constants.ts (used as structural reference for Claude)
    console.log('[create-site] Step 5: Reading template constants from', templateRepo);
    const templateConstantsTs = await fetchTemplateFile(
      GITHUB_OWNER!, GITHUB_TOKEN!, templateRepo,
      ['lib/constants.ts', 'src/lib/constants.ts', 'src/constants.ts'],
    );

    if (!templateConstantsTs) {
      throw new Error(`Could not read lib/constants.ts from ${templateRepo}`);
    }
    console.log('[create-site] Step 5: Template constants loaded, length:', templateConstantsTs.length);

    // Step 6 — Process photos into public/images/ (hero crop + gallery passthrough)
    console.log('[create-site] Step 6: Processing lead photos');
    let heroImagePath:     string | null = null;
    let galleryImagePaths: string[] | null = null;
    const imageFiles: Array<{ path: string; content: string; encoding: 'base64' }> = [];

    // Read photos via the unified helper. Wizard writes hero + gallery
    // explicitly; brief writes only gallery (hero stays null), in which case
    // we fall back to the legacy heroImageIndex pick.
    const leadPhotos = getLeadPhotos(lead);
    let heroUrl:        string | null = leadPhotos.hero;
    let galleryUrlList: string[]      = leadPhotos.gallery;
    if (!heroUrl && galleryUrlList.length > 0) {
      const idx = Math.min(Math.max(lead.heroImageIndex ?? 0, 0), galleryUrlList.length - 1);
      heroUrl        = galleryUrlList[idx];
      galleryUrlList = galleryUrlList.filter((_, i) => i !== idx);
    }

    if (heroUrl || galleryUrlList.length > 0) {
      try {
        // Download hero (if any) and all gallery photos
        const downloads: Promise<Buffer>[] = [];
        if (heroUrl) {
          downloads.push((async () => {
            const res = await fetch(heroUrl!);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching hero photo`);
            return Buffer.from(await res.arrayBuffer());
          })());
        }
        downloads.push(...galleryUrlList.map(async (url, i) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} fetching gallery photo ${i + 1}`);
          return Buffer.from(await res.arrayBuffer());
        }));
        const buffers = await Promise.all(downloads);

        // Hero: crop to 1600×900
        if (heroUrl) {
          const heroBuffer = await sharp(buffers[0])
            .resize(1600, 900, { fit: 'cover', position: 'center' })
            .webp({ quality: 85 })
            .toBuffer();
          imageFiles.push({ path: 'public/images/hero.webp', content: heroBuffer.toString('base64'), encoding: 'base64' });
          heroImagePath = '/images/hero.webp';
        }

        // Gallery: remaining photos (already webp — pass through)
        const paths: string[] = [];
        const galleryStart = heroUrl ? 1 : 0;
        for (let i = galleryStart; i < buffers.length; i++) {
          const galleryIdx = i - galleryStart + 1;
          imageFiles.push({ path: `public/images/gallery-${galleryIdx}.webp`, content: buffers[i].toString('base64'), encoding: 'base64' });
          paths.push(`/images/gallery-${galleryIdx}.webp`);
        }
        if (paths.length > 0) galleryImagePaths = paths;

        console.log(`[create-site] Step 6: ${imageFiles.length} image(s) processed — hero=${heroImagePath ? 'yes' : 'no'}, ${paths.length} gallery`);
      } catch (imgErr) {
        console.warn('[create-site] Step 6: Image processing warning (non-fatal):', imgErr instanceof Error ? imgErr.message : imgErr);
        heroImagePath = null;
        galleryImagePaths = null;
        imageFiles.length = 0;
      }
    } else {
      console.log('[create-site] Step 6: No photos — Claude will use Unsplash');
    }

    // Step 6b — Process logo (if provided)
    let logoImagePath: string | null = null;
    if (lead.logoUrl) {
      try {
        const logoRes = await fetch(lead.logoUrl);
        if (logoRes.ok) {
          const logoBuf = Buffer.from(await logoRes.arrayBuffer());
          const logoWebp = await sharp(logoBuf)
            .webp({ quality: 85, alphaQuality: 100 })
            .toBuffer();
          imageFiles.push({ path: 'public/images/logo.webp', content: logoWebp.toString('base64'), encoding: 'base64' });
          logoImagePath = '/images/logo.webp';
          console.log('[create-site] Step 6b: Logo processed →', logoImagePath);
        } else {
          console.warn('[create-site] Step 6b: Logo fetch failed —', logoRes.status);
        }
      } catch (logoErr) {
        console.warn('[create-site] Step 6b: Logo processing warning (non-fatal):', logoErr instanceof Error ? logoErr.message : logoErr);
      }
    } else {
      console.log('[create-site] Step 6b: No logoUrl — text fallback will be used');
    }

    // Step 7 — Generate config.ts programmatically (instant, no AI)
    console.log('[create-site] Step 7: Generating config.ts programmatically');
    const configInput: LeadConfigInput = {
      businessName:    lead.businessName,
      businessType:    lead.businessType,
      contact:         lead.contact,
      email:           lead.email,
      language:        lead.language,
      selectedPalette: lead.selectedPalette,
    };
    const configTs = generateConfigTs(configInput);
    // Derive templateType the same way generate-config.ts does — share the logic
    const templateType = ['restaurant', 'food'].includes(lead.businessType) ? 'menu' : 'services';
    console.log('[create-site] Step 7: config.ts generated, templateType:', templateType, 'length:', configTs.length);

    // Step 8 — Generate constants.ts with Claude (FATAL if fails — don't create repo)
    console.log('[create-site] Step 8: Generating constants.ts with Claude (ANTHROPIC_API_KEY present:', !!ANTHROPIC_API_KEY, ')');
    // Resolve 'auto'/null/legacy heroLayout into a definitive 'split' | 'full'
    // before handing off to Sonnet — the template needs a concrete value.
    const resolvedHeroLayout = resolveHeroLayout(lead.heroLayout, lead.businessType);

    const constantsInput: LeadConstantsInput = {
      businessName:      lead.businessName,
      businessType:      lead.businessType,
      templateType,
      contact:           lead.contact,
      email:             lead.email,
      language:          lead.language,
      description:       lead.description,
      address:           lead.address,
      workingHours:      lead.workingHours,
      socialInstagram:   lead.socialInstagram,
      socialFacebook:    lead.socialFacebook,
      wishes:            lead.wishes,
      heroImagePath,
      galleryImagePaths,
      logoImagePath,
      briefServicesJson: lead.briefServicesJson,
      heroLayout:        resolvedHeroLayout,
    };

    const constantsTs = await generateConstantsTs(constantsInput, templateConstantsTs);

    if (!constantsTs) {
      console.error('[create-site] Step 8: Constants generation failed — aborting (no repo created)');
      await db.lead.update({
        where: { id },
        data: { siteStatus: 'error', siteError: 'Constants generation failed' },
      });
      return NextResponse.json({ error: 'Constants generation failed' }, { status: 500 });
    }
    console.log('[create-site] Step 8: constants.ts generated, length:', constantsTs.length);

    // Step 9 — Create GitHub repo from template
    let finalRepoName = repoName;
    console.log('[create-site] Step 9: Creating GitHub repo:', finalRepoName);
    const githubRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${templateRepo}/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner: GITHUB_OWNER, name: finalRepoName, private: false }),
      },
    );

    if (githubRes.status === 422) {
      // Name collision — append random suffix and retry once
      finalRepoName = `${finalRepoName}-${randomSuffix()}`;
      console.log('[create-site] Step 9: Name collision, retrying with:', finalRepoName);
      const retryRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${templateRepo}/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner: GITHUB_OWNER, name: finalRepoName, private: false }),
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

    const repoUrl   = `https://github.com/${GITHUB_OWNER}/${finalRepoName}`;
    const vercelUrl = `https://${finalRepoName}.vercel.app`;

    // Step 10 — Wait for GitHub repo to settle (heads/main ref must be accessible)
    console.log('[create-site] Step 10: Waiting 7s for GitHub repo to settle...');
    await new Promise<void>((resolve) => setTimeout(resolve, 7000));
    console.log('[create-site] Step 10: Done waiting');

    // Step 11 — Commit generated files
    console.log('[create-site] Step 11: Committing files to repo:', finalRepoName);
    const filesToCommit = [
      { path: 'lib/config.ts',    content: configTs },
      { path: 'lib/constants.ts', content: constantsTs },
      ...imageFiles,
    ];

    await commitFiles(finalRepoName, filesToCommit);
    console.log('[create-site] Step 11: commitFiles completed — committed', filesToCommit.length, 'file(s)');

    // Step 12 — Create Vercel project (AFTER all commits — sees final code immediately)
    console.log('[create-site] Step 12: Creating Vercel project');
    const vercelRes = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:          finalRepoName,
        framework:     'nextjs',
        gitRepository: { type: 'github', repo: `${GITHUB_OWNER}/${finalRepoName}` },
      }),
    });

    if (!vercelRes.ok) {
      const errBody = await vercelRes.text();
      throw new Error(`Vercel API error: ${vercelRes.status} — ${errBody}`);
    }
    const vercelProject = await vercelRes.json() as VercelProjectResponse;
    console.log('[create-site] Step 12: Vercel project created, id:', vercelProject.id);

    // Step 13 — Trigger explicit production deployment (belt-and-suspenders)
    console.log('[create-site] Step 13: Triggering Vercel deployment');
    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:      finalRepoName,
        target:    'production',
        gitSource: { type: 'github', org: GITHUB_OWNER, repo: finalRepoName, ref: 'main' },
      }),
    });

    if (!deployRes.ok) {
      const errBody = await deployRes.text();
      console.warn('[create-site] Step 13: Explicit deploy trigger failed (non-fatal):', deployRes.status, errBody);
    } else {
      console.log('[create-site] Step 13: Deployment triggered');
    }

    // Step 14 — Wait for deployment to become READY (max 55s)
    console.log('[create-site] Step 14: Polling for READY state...');
    const VERCEL_TEAM_ID   = process.env.VERCEL_TEAM_ID;
    const deploymentResult = await waitForDeployment(finalRepoName, VERCEL_TOKEN!, VERCEL_TEAM_ID, 55000);
    console.log('[create-site] Step 14: Deployment result:', deploymentResult);

    // Step 15 — Save lead
    const finalUrl    = deploymentResult.url ?? vercelUrl;
    const finalStatus = deploymentResult.ready ? 'created' : 'creating';
    console.log('[create-site] Step 15: Saving lead — status:', finalStatus, 'url:', finalUrl);

    await db.lead.update({
      where: { id },
      data: {
        siteRepoUrl:   repoUrl,
        siteRepoName:  finalRepoName,
        siteVercelUrl: finalUrl,
        siteStatus:    finalStatus,
        siteCreatedAt: new Date(),
        siteError:     deploymentResult.ready ? null : 'Deployment still in progress',
      },
    });

    return NextResponse.json({
      success:         true,
      repoUrl,
      vercelUrl:       finalUrl,
      deploymentReady: deploymentResult.ready,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-site] Fatal error:', message);

    await db.lead.update({
      where: { id },
      data: { siteStatus: 'error', siteError: message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
