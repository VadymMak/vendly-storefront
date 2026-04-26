/**
 * One-time script: reset "Родник плюс" lead for re-testing.
 * Uses HTTPS admin API (no direct DB connection needed).
 */

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER  = process.env.GITHUB_OWNER!;
const VERCEL_TOKEN  = process.env.VERCEL_TOKEN!;
const ADMIN_API     = 'https://vendshop.shop/api/admin/leads';

interface Lead {
  id: string;
  businessName: string | null;
  siteRepoName: string | null;
  siteVercelUrl: string | null;
  siteStatus: string | null;
  vercelProject: string | null;
}

async function findLead(): Promise<Lead | null> {
  const res = await fetch(ADMIN_API);
  if (!res.ok) throw new Error(`GET /api/admin/leads failed: ${res.status}`);
  const leads = await res.json() as Lead[];
  return leads.find((l) =>
    l.businessName?.toLowerCase().includes('родник') ||
    l.siteRepoName?.startsWith('rodnik'),
  ) ?? null;
}

async function deleteGithubRepo(repoName: string) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repoName}`, {
    method: 'DELETE',
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 204)      console.log(`✅ GitHub repo deleted: ${repoName}`);
  else if (res.status === 404) console.log(`⚠️  GitHub repo not found: ${repoName}`);
  else console.error(`❌ GitHub delete [${res.status}]:`, await res.text());
}

async function deleteVercelProject(projectName: string) {
  const res = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (res.status === 204 || res.status === 200) console.log(`✅ Vercel project deleted: ${projectName}`);
  else if (res.status === 404)                  console.log(`⚠️  Vercel project not found: ${projectName}`);
  else console.error(`❌ Vercel delete [${res.status}]:`, await res.text());
}

async function resetLead(id: string) {
  const res = await fetch(ADMIN_API, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      siteStatus:    'none',
      siteRepoUrl:   null,
      siteRepoName:  null,
      siteVercelUrl: null,
      siteError:     null,
      siteCreatedAt: null,
    }),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  const updated = await res.json() as Lead;
  console.log(`✅ Lead reset: siteStatus=${updated.siteStatus}, siteRepoName=${updated.siteRepoName}`);
}

async function main() {
  console.log('🔍 Searching for lead "Родник плюс"...');
  const lead = await findLead();

  if (!lead) {
    console.error('❌ Lead not found!');
    process.exit(1);
  }

  console.log(`\nFound lead:`);
  console.log(`  id:           ${lead.id}`);
  console.log(`  businessName: ${lead.businessName}`);
  console.log(`  siteRepoName: ${lead.siteRepoName}`);
  console.log(`  siteVercelUrl:${lead.siteVercelUrl}`);
  console.log(`  siteStatus:   ${lead.siteStatus}`);

  const repoName = lead.siteRepoName ?? lead.vercelProject;

  if (repoName) {
    await deleteGithubRepo(repoName);
    await deleteVercelProject(repoName);
  } else {
    console.log('⚠️  No siteRepoName — skipping GitHub/Vercel delete');
  }

  await resetLead(lead.id);
  console.log('\n✅ Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
