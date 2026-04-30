# Admin auth — investigation

> Read-only audit. The two auth flows on the admin surface do not connect to each other. Details below; verdict at the bottom.

---

## 1. Locating Flow B ("VendShop Admin" password-only)

- **File:** [src/app/admin/layout.tsx](../src/app/admin/layout.tsx)
- **Lines:** entire file is the gate (1–67). Login UI at [:28-49](../src/app/admin/layout.tsx#L28-L49).
- **It is a `'use client'` component** ([:1](../src/app/admin/layout.tsx#L1)) — the gate runs **only in the browser**. The Next.js server renders the page regardless and the client component decides whether to render `children`.
- **Password is hard-coded in source** at [:5](../src/app/admin/layout.tsx#L5):
  ```ts
  const ADMIN_PASS = 'vendshop2026';
  ```
  Because the layout is `'use client'`, this string is shipped in the public JS bundle.

The form JSX ([:28-49](../src/app/admin/layout.tsx#L28-L49)):

```tsx
<div className="rounded-2xl p-8 text-center" style={{ background: '#1E293B' }}>
  <h2 className="mb-4 text-xl font-bold text-white">VendShop Admin</h2>
  <input
    type="password"
    value={password}
    onChange={e => setPassword(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && handleLogin()}
    placeholder="Password"
    className="mb-3 w-64 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
  />
  <br />
  <button onClick={handleLogin} className="rounded-lg bg-green-600 px-8 py-3 ...">Login</button>
</div>
```

There is **no `<form>` element and no submit handler that posts anywhere** — `handleLogin` is a pure JS function ([:19-24](../src/app/admin/layout.tsx#L19-L24)).

---

## 2. Trace of the login submission

**No HTTP request is made.** `handleLogin` ([src/app/admin/layout.tsx:19-24](../src/app/admin/layout.tsx#L19-L24)):

```ts
const handleLogin = () => {
  if (password === ADMIN_PASS) {
    sessionStorage.setItem('vendshop-admin', 'true');
    setAuthorized(true);
  }
};
```

- **API endpoint called:** none.
- **Payload:** none.
- **Env var holding password:** **none** — the password is the literal `'vendshop2026'` in source. Grep for `ADMIN_PASSWORD` across `src/` returns **zero matches**.
- **What is set on success:** `sessionStorage['vendshop-admin'] = 'true'`. **No cookie**, no JWT, no signed token, no server-side artefact of any kind.
- **Cookie attributes:** N/A — there is no cookie.
- **Logout:** removes the same `sessionStorage` key ([:57](../src/app/admin/layout.tsx#L57)).

**Practical consequence:** anyone who reads the JS bundle (or the repo) knows the password, and the "session" never reaches the server.

---

## 3. How other admin endpoints check auth

All files under `src/app/api/admin/`:

| # | Endpoint | Method(s) | File | Auth mechanism | Where |
|---|---|---|---|---|---|
| 1 | `/api/admin/leads` | GET, PATCH, DELETE | [src/app/api/admin/leads/route.ts](../src/app/api/admin/leads/route.ts) | **No auth check at all** | (none) |
| 2 | `/api/admin/leads/[id]/upload-photo` | POST | [src/app/api/admin/leads/[id]/upload-photo/route.ts](../src/app/api/admin/leads/%5Bid%5D/upload-photo/route.ts) | **No auth check at all** | (none) |
| 3 | `/api/admin/leads/[id]/purge` | DELETE | [src/app/api/admin/leads/[id]/purge/route.ts](../src/app/api/admin/leads/%5Bid%5D/purge/route.ts) | **NextAuth session + ADMIN_EMAIL** | [:71-75](../src/app/api/admin/leads/%5Bid%5D/purge/route.ts#L71-L75) |
| 4 | `/api/admin/set-plan` | POST | [src/app/api/admin/set-plan/route.ts](../src/app/api/admin/set-plan/route.ts) | **NextAuth session + ADMIN_EMAIL** | [:13-17](../src/app/api/admin/set-plan/route.ts#L13-L17) |

First-20-lines snapshots:

**`/api/admin/leads/route.ts`** — the GET handler runs straight into a Prisma call, no session lookup, no cookie read:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/leads — list all leads, newest first
export async function GET() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(leads);
}
```
PATCH and DELETE handlers in the same file are equally unguarded — they accept `id` from the body and run `db.lead.update(...)` directly.

**`/api/admin/leads/[id]/upload-photo/route.ts`** — handler starts at [:9](../src/app/api/admin/leads/%5Bid%5D/upload-photo/route.ts#L9) and goes straight into `db.lead.findUnique`, no auth call.

**`/api/admin/set-plan/route.ts`** ([:13-17](../src/app/api/admin/set-plan/route.ts#L13-L17)):
```ts
const session = await auth();
if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**`/api/admin/leads/[id]/purge/route.ts`** ([:71-75](../src/app/api/admin/leads/%5Bid%5D/purge/route.ts#L71-L75)) — exact same pattern as set-plan.

**Score: 2 endpoints check NextAuth+ADMIN_EMAIL, 2 endpoints check nothing.** None check the `vendshop-admin` sessionStorage flag (and they couldn't — sessionStorage doesn't reach the server).

---

## 4. How `/admin/leads` page is gated from anonymous access

- **`src/app/admin/leads/page.tsx`** — no server-side auth check. The file starts with `'use client'` (verified in [src/app/admin/leads/page.tsx:1](../src/app/admin/leads/page.tsx#L1)) and immediately defines React state. No `auth()`, no cookie read, no `redirect(...)`.
- **`src/app/admin/page.tsx`** ([:1-8](../src/app/admin/page.tsx#L1-L8)) — server component, but does no auth check; calls `getAllStoresAdmin()` directly.
- **`src/app/admin/layout.tsx`** — the only gate, and as documented above it is **client-side only**.
- **`src/middleware.ts`** ([1-57](../src/middleware.ts#L1-L57)) — handles subdomain rewriting (`smak.vendshop.shop` → `/shop/smak`). Has **no `/admin` matching, no auth logic**. The matcher at [:53-56](../src/middleware.ts#L53-L56) covers all paths but the function only branches on hostname.

**What actually gates `/admin/leads` from anonymous access:** the *server* doesn't gate it at all. The page HTML and the leads-list JS bundle are served to anyone. The `<AdminLayout>` client component then refuses to render the children until `sessionStorage['vendshop-admin'] === 'true'`.

In short: anyone can view the page source and call any unguarded `/api/admin/*` endpoint directly. The two auth-guarded endpoints (`set-plan`, `purge`) require a NextAuth session whose user email matches `ADMIN_EMAIL` — but **nothing in the admin UI flow ever creates such a session**.

---

## 5. Verdict

**Scenario C — mixed / inconsistent.** And it's worse than just inconsistent: the two flows are fully disconnected.

- The only login UI under `/admin/*` ([layout.tsx](../src/app/admin/layout.tsx)) is Flow B (sessionStorage password gate). It does not call NextAuth, does not set a cookie, and does not issue any server-side credential.
- The two API endpoints that *do* check auth ([set-plan](../src/app/api/admin/set-plan/route.ts), [purge](../src/app/api/admin/leads/%5Bid%5D/purge/route.ts)) only accept a NextAuth session — i.e. the user must be logged in through `/login` (NextAuth Credentials provider, [src/lib/auth.ts](../src/lib/auth.ts)) with an email matching `ADMIN_EMAIL`.
- The two API endpoints that don't check auth ([leads route.ts](../src/app/api/admin/leads/route.ts), [upload-photo](../src/app/api/admin/leads/%5Bid%5D/upload-photo/route.ts)) are reachable by anyone on the internet without any credential.

This is why Purge returns 403: Vadym is logged into `/admin/*` via Flow B (sessionStorage flag), so the browser has **no NextAuth session cookie**, so `auth()` in the purge handler returns null and the email check fails.

**The purge endpoint's auth check itself is correct in shape** (it matches `set-plan`, the only other guarded admin endpoint). The bug is the missing NextAuth session — i.e. the operator hasn't gone through `/login` with the `ADMIN_EMAIL` user. To make Purge work today, Vadym must:

1. Have a `User` row in the DB whose `email === process.env.ADMIN_EMAIL` (created via `/register` or seeded).
2. Log into `/login` with that user's password (NextAuth Credentials flow).
3. Then click Purge — the same browser will now carry the `authjs.session-token` cookie that `auth()` reads.

The `vendshop2026` admin gate at `/admin/layout.tsx` is irrelevant to the Purge endpoint and to `set-plan`. It only hides the page UI client-side.

---

## 6. Risk audit (Scenario C — listing the inconsistencies)

**Flow A (NextAuth + ADMIN_EMAIL):**
- [src/app/api/admin/set-plan/route.ts:13-17](../src/app/api/admin/set-plan/route.ts#L13-L17)
- [src/app/api/admin/leads/[id]/purge/route.ts:71-75](../src/app/api/admin/leads/%5Bid%5D/purge/route.ts#L71-L75)

**No auth at all (real security gap, not just inconsistency):**
- [src/app/api/admin/leads/route.ts](../src/app/api/admin/leads/route.ts) — `GET` exposes the full `Lead` table including emails, phone numbers, photo URLs, brief data. `PATCH` lets any caller mutate any lead by id. `DELETE` lets any caller soft-delete any lead by id.
- [src/app/api/admin/leads/[id]/upload-photo/route.ts](../src/app/api/admin/leads/%5Bid%5D/upload-photo/route.ts) — anyone can upload arbitrary 10 MB files into Vercel Blob and attach them to any lead by id.

**Outside `/api/admin/*` but related** — `/api/admin/leads/[id]/create-site` is at [src/app/api/leads/[id]/create-site/route.ts](../src/app/api/leads/%5Bid%5D/create-site/route.ts) (note: `/api/leads/...`, not `/api/admin/leads/...`). It performs no auth check either; anyone with a leadId can trigger a real GitHub repo + Vercel project creation against Vadym's accounts. (Not strictly in scope of this audit, but flagged because it shares the same blast radius as the purge endpoint and the existing UI button.)

**Flow B (`vendshop2026` sessionStorage):**
- [src/app/admin/layout.tsx](../src/app/admin/layout.tsx) — gates the **page UI only**. It is also a hard-coded plaintext password shipped in the public JS bundle, so it's not a security control even for the UI it gates.

---

**Verdict: scenario C**

**Recommended next step:** Decide on one auth mechanism for the entire `/admin/*` and `/api/admin/*` surface. The fastest, lowest-risk path is to keep NextAuth+ADMIN_EMAIL on the API side (already in place for `set-plan`/`purge`) and make the page surface require it too — replace the client-side `vendshop2026` gate with a server-side redirect-to-`/login` in `src/app/admin/layout.tsx` (or in middleware), then add the same `auth()` check to `/api/admin/leads/route.ts`, `/api/admin/leads/[id]/upload-photo/route.ts`, and `/api/leads/[id]/create-site/route.ts`. To unblock Purge **today**, simply create a User row with `email = ADMIN_EMAIL` and log in via `/login` before clicking Purge.

**Suggested commit message:** no fix needed — investigation only.
