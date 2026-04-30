# Purge Lead — `DELETE /api/admin/leads/[id]/purge`

Hard-deletes a lead and **every external artifact** the site-generation pipeline produced for it.

## What gets removed (in order)

1. **GitHub repo** at `${GITHUB_OWNER}/${lead.siteRepoName}` — via GitHub REST API. Token must have the `delete_repo` scope; otherwise GitHub returns 403 and that step is reported as `error: …` (other steps still run).
2. **Vercel project** named `${lead.siteRepoName}` — via `DELETE /v9/projects/{name}`. Killing the project cascades all deployments.
3. **Vercel Blob photos** referenced by the lead (`heroPhotoUrl`, `galleryUrls`, `photoUrls` JSON, `logoUrl`). Only URLs on `*.public.blob.vercel-storage.com` are touched — Unsplash/foreign URLs are skipped silently.
4. **Lead row** in Postgres (last — DB is the source of truth).

A failure in steps 1–3 is recorded in the response but does **not** abort the others. A failure in step 4 returns HTTP 500 so the operator knows the row is still in the DB.

## Auth

Admin only. Gated by `session.user.email === ADMIN_EMAIL`, mirroring `/api/admin/set-plan`. Anyone else gets 403.

## Irreversible

This is a hard delete. There is no soft-delete fallback, no undo, no archive. **It is intended primarily for development testing of the lead → site pipeline** (so the same DriveLab Auto / test lead can be re-run end-to-end). Do not point it at real customer leads without thinking.

The existing `🗑️ Удалить` button on lead cards still does a soft-delete (sets `status = 'deleted'`) and is unchanged.

## Response shape

```jsonc
{
  "success": true,
  "deleted": {
    "github": "deleted" | "skipped" | "error: …",
    "vercel": "deleted" | "skipped" | "error: …",
    "blobs":  { "total": 6, "deleted": 6, "errors": [] },
    "lead":   "deleted"
  }
}
```

## curl example

```bash
curl -X DELETE \
  -H "Cookie: authjs.session-token=$(echo $YOUR_SESSION_COOKIE)" \
  https://vendshop.shop/api/admin/leads/clz123abc.../purge
```

Easier in practice: open the lead in the admin UI and click **🗑️ Purge completely**.
