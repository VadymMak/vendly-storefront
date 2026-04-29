# Onboarding Wizard — Investigation Report

> Read-only investigation. No source modified.
> Source files cited as `path:line`. Anything not in the code is flagged **UNCLEAR**.

---

## 1. Routing & entry points

- **URL:** `/create` (single, no locale segment).
- **Page component:** [src/app/create/page.tsx](../src/app/create/page.tsx) — server component that renders `<CreatePageClient />`.
- **Client component:** [src/components/create/CreatePageClient.tsx](../src/components/create/CreatePageClient.tsx) (929 lines).
- **Locale segment:** **No.** The whole app uses `next-intl` *without* `[locale]` URL segments — locale is read from a `locale` cookie in [src/i18n/request.ts:10](../src/i18n/request.ts#L10) and there is no `src/app/[locale]/` directory.
- **Auth-gating:** **Public.** No `auth()`/`getServerSession()`/redirect call exists in `src/app/create/` (verified by grep). Anyone can reach `/create` without logging in.
- **Pre-fill via query string** (CreatePageClient.tsx:629–653):
  - `?type=barbershop` pre-selects business type.
  - `?plan=starter` pre-selects plan and **jumps directly to step 3**.
  - `?type=...&plan=...` jumps to step 3 with that combo.

---

## 2. Wizard structure

- **Single-page state machine.** All three steps live in one client component at [CreatePageClient.tsx:625](../src/components/create/CreatePageClient.tsx#L625) and the right pane is the live preview. Steps are rendered conditionally on `state.step` ([CreatePageClient.tsx:867–869](../src/components/create/CreatePageClient.tsx#L867-L869)):
  ```tsx
  {state.step === 1 && <Step1 state={state} setState={setState} />}
  {state.step === 2 && <Step2 state={state} setState={setState} />}
  {state.step === 3 && <Step3 ... onLaunch={launch} launchError={launchError} />}
  ```
- **State store:** Plain React `useState<CreateState>` — initial value computed lazily from URL params + `localStorage` ([CreatePageClient.tsx:629–653](../src/components/create/CreatePageClient.tsx#L629-L653)). No Zustand, no server session, no URL params for state itself.
- **State shape:** [src/lib/types.ts:489–503](../src/lib/types.ts#L489-L503) — `CreateState { step, business, palette, businessName, description, phone, email, address, hoursSchedule, heroPhoto, logoPhoto, gallery, plan }`.
- **Navigation:** `goto(n)` clamps to 1–3 ([CreatePageClient.tsx:668–669](../src/components/create/CreatePageClient.tsx#L668-L669)). Footer "Back" → `goto(state.step - 1)` ([:875](../src/components/create/CreatePageClient.tsx#L875)); "Continue" → `goto(state.step + 1)` ([:888](../src/components/create/CreatePageClient.tsx#L888)). Step 3 hides "Continue" — terminal step.
- **Step indicators** in topbar at [CreatePageClient.tsx:805–841](../src/components/create/CreatePageClient.tsx#L805-L841) (visual only — clicking them does not navigate).

---

## 3. Step 1 — Choose

### Templates

- **Defined in** [src/lib/constants.ts:634–889](../src/lib/constants.ts#L634-L889) as `CREATE_BUSINESS_TYPES: CreateBusinessType[]`.
- **Count: 12, not 11.** The user's expected list of 11 omits one. Actual list from code:

  | # | id | icon | style | line |
  |---|----|------|-------|------|
  | 1 | `barbershop` | scissors | classic | [:636](../src/lib/constants.ts#L636) |
  | 2 | `restaurant` | fork | warm | [:658](../src/lib/constants.ts#L658) |
  | 3 | `beauty` | sparkles | natural | [:679](../src/lib/constants.ts#L679) |
  | 4 | `auto` | car | classic | [:701](../src/lib/constants.ts#L701) |
  | 5 | `dentist` | tooth | medical | [:722](../src/lib/constants.ts#L722) |
  | 6 | `water` | droplet | classic | [:743](../src/lib/constants.ts#L743) |
  | 7 | `electronics` | wrench | bold | [:764](../src/lib/constants.ts#L764) |
  | 8 | `yoga` | lotus | natural | [:785](../src/lib/constants.ts#L785) |
  | 9 | `photography` | camera | dark | [:806](../src/lib/constants.ts#L806) |
  | 10 | `agency` | layers | bold | [:827](../src/lib/constants.ts#L827) |
  | 11 | `education` | book | bold | [:848](../src/lib/constants.ts#L848) |
  | 12 | `design` | palette | dark | [:869](../src/lib/constants.ts#L869) |

  The expected "Digital Agency" maps to `agency`. **There is no separate "Design Studio" missing — `design` (#12) is the studio.** Localized labels live under the `create.biz.<id>.label` / `tagline` keys in [messages/*.json](../messages/) (resolved at runtime via `useTranslations('create.biz')` at [CreatePageClient.tsx:203](../src/components/create/CreatePageClient.tsx#L203)).

### Palettes

- **Per-template, not global.** Each `CreateBusinessType` carries its own `palettes: CreatePalette[]` array ([types.ts:451–459](../src/lib/types.ts#L451-L459)). 38 palettes total across 12 types (3–4 each). Every palette has `{ id, name, primary, bg, fg, muted, card }`.
- **"Sage / Clay / Dusk"** are the three palettes for `yoga` ([constants.ts:799–803](../src/lib/constants.ts#L799-L803)).
- **Default selection logic:** When user picks a business type, palette resets to `b.palettes[0].id` ([CreatePageClient.tsx:208](../src/components/create/CreatePageClient.tsx#L208)). The "Pre-tuned for Yoga Studio" UI label comes from the `create.step1.paletteTunedFor` translation key ([CreatePageClient.tsx:243](../src/components/create/CreatePageClient.tsx#L243)) — there is no separate "default palette" field; the *first palette in the array* is the default.

---

## 4. Live preview

- **File:** [src/components/create/PreviewPanel.tsx](../src/components/create/PreviewPanel.tsx) (482 lines). Inner `SitePreview` renders the actual site layout ([:217–434](../src/components/create/PreviewPanel.tsx#L217-L434)).
- **Wiring:** Direct prop pass-through from `CreatePageClient` ([CreatePageClient.tsx:900–906](../src/components/create/CreatePageClient.tsx#L900-L906)) — `state`, `biz`, `palette`, `viewport`, `onViewportChange`. Re-renders on every `setState`.
- **Real components or mock?** **Mock.** Preview is a self-contained set of inline-styled `<div>`/`<section>` elements built from the `template` block of `CREATE_BUSINESS_TYPES` (hero, services/menu, gallery, testimonials, contact, hours, footer). It does **not** import or render the actual storefront templates from `src/components/shop/`. Testimonials are hard-coded English placeholders per business type ([PreviewPanel.tsx:21–67](../src/components/create/PreviewPanel.tsx#L21-L67)), so the preview is not localized for non-EN users beyond the section labels.
- **Viewport switcher:** Yes — `'desktop' | 'tablet' | 'mobile'` controlled by `useState<Viewport>` ([CreatePageClient.tsx:655](../src/components/create/CreatePageClient.tsx#L655)). The toolbar buttons set `maxWidth: { desktop: '1180px', tablet: '720px', mobile: '380px' }` ([PreviewPanel.tsx:443, :463–470](../src/components/create/PreviewPanel.tsx#L443-L470)). Mobile branch also collapses nav, simplifies gallery to 3 squares, single testimonial column ([:243, :318–351](../src/components/create/PreviewPanel.tsx#L243-L351)).
- **Domain pill** in toolbar shows `${slug}.vendshop.shop` even on Pro/free toggle differences from Step 3 — the toolbar is hard-coded to the subdomain form ([PreviewPanel.tsx:441](../src/components/create/PreviewPanel.tsx#L441)). UNCLEAR if this is intentional.

---

## 5. Auto-save

- **Trigger:** `useEffect` on every `state` change ([CreatePageClient.tsx:661–666](../src/components/create/CreatePageClient.tsx#L661-L666)) — **no debounce, no interval**, fires synchronously on every keystroke.
- **Endpoint:** **None.** Persistence is `localStorage.setItem(CREATE_STORE_KEY, JSON.stringify(rest))` only. Key is `'vendshop_create_state_v1'` ([constants.ts:907](../src/lib/constants.ts#L907)).
- **What is saved:** The full `state` object **except** `heroPhoto`, `logoPhoto`, `gallery` (which are base64 data URLs and are stripped before save — [CreatePageClient.tsx:663](../src/components/create/CreatePageClient.tsx#L663)).
- **What is NOT saved:** No DB Lead, no draft Site row. Nothing reaches the server until the user clicks Launch on Step 3.
- **Reload behavior:** Same `useState` initializer reads `localStorage` on mount ([CreatePageClient.tsx:645–651](../src/components/create/CreatePageClient.tsx#L645-L651)) and merges over `INITIAL_STATE`, but explicitly clears photo fields:
  ```ts
  return { ...INITIAL_STATE, ...parsed, heroPhoto: null, logoPhoto: null, gallery: [] };
  ```
  → Photos are **always lost** on refresh.
- **The "Auto-saved" green dot in the topbar** ([CreatePageClient.tsx:843–847](../src/components/create/CreatePageClient.tsx#L843-L847)) is a static label — it does **not** reflect actual save state, only signals "we're persisting locally".

---

## 6. Step 2 — Details

### Fields collected

[CreatePageClient.tsx:333–426](../src/components/create/CreatePageClient.tsx#L333-L426):

- `businessName` (text input, [:351](../src/components/create/CreatePageClient.tsx#L351))
- `description` (textarea + an **"AI" button that's actually a static template lookup** in `AI_DESCRIPTIONS` at [:318–331](../src/components/create/CreatePageClient.tsx#L318-L331), [:339–343](../src/components/create/CreatePageClient.tsx#L339-L343)) — **no API call is made; the "AI" label is misleading.**
- `phone` ([:377](../src/components/create/CreatePageClient.tsx#L377))
- `email` ([:381](../src/components/create/CreatePageClient.tsx#L381))
- `address` ([:387](../src/components/create/CreatePageClient.tsx#L387))
- `hoursSchedule` (per-day toggle + 30-min slot dropdowns, [HoursScheduler:277–314](../src/components/create/CreatePageClient.tsx#L277-L314))
- `heroPhoto` (single-file, FileReader → data URL, [SinglePhoto:110–147](../src/components/create/CreatePageClient.tsx#L110-L147))
- `logoPhoto` (same)
- `gallery` (max 6 photos, [GalleryUploader:154–197](../src/components/create/CreatePageClient.tsx#L154-L197))
- **Not collected:** social links (Instagram/Facebook), website URL, services list, services prices. The brief form `/brief/[leadId]` collects those — see §11/§Top-5.

### Validation

- **None on the client** in CreatePageClient.tsx — no `required`, no Zod schema, no inline error UI per field. Step 1 → 2 → 3 navigation is unconditional. Even submission with all empty fields is accepted.
- **Server-side ([api/submit-lead/route.ts:9–33](../src/app/api/submit-lead/route.ts#L9-L33)):** Every field is silently coerced via `String(data.X || '')` or `data.X ? String(data.X) : null`. Required Prisma fields are `businessType`, `services`, `contact`, `language`. The wizard payload sets `services: state.description || ''` (via ([CreatePageClient.tsx:714](../src/components/create/CreatePageClient.tsx#L714))? — actually `description: state.description || null`, and `services` is **not** in the wizard payload), so Prisma may reject blank submissions because `services` is required on the `Lead` model ([prisma/schema.prisma:190](../prisma/schema.prisma#L190)). UNCLEAR — submit-lead does fall back to `data.description` for `services` ([:14](../src/app/api/submit-lead/route.ts#L14)) so it'll save the description text into both `services` and `description`. If both are empty, an empty string passes (column is `String`, not `String?`).
- **No library used.** Zod *is* installed (`zod ^4.3.6` in [package.json:34](../package.json#L34)) but not imported in this code path.

---

## 7. Step 3 — Launch & site creation

### THIS IS THE CRITICAL FINDING

The wizard's "Launch" button **does NOT create a site.** It only creates a database `Lead` row and sends a Telegram alert. **Nothing in the wizard flow ever calls `/api/leads/[id]/create-site`.**

### Trace of the Launch path

1. **User clicks "Launch"** → calls `launch` callback at [CreatePageClient.tsx:537–538](../src/components/create/CreatePageClient.tsx#L537-L538), implemented at [:693–755](../src/components/create/CreatePageClient.tsx#L693-L755).
2. **Photo uploads** ([:702–709](../src/components/create/CreatePageClient.tsx#L702-L709)): each base64 data URL is converted to a Blob and POSTed to `/api/upload-lead-photo` ([uploadPhoto callback :678–691](../src/components/create/CreatePageClient.tsx#L678-L691)). Failures return `null` and are filtered out — non-blocking.
   - **`/api/upload-lead-photo`** [src/app/api/upload-lead-photo/route.ts](../src/app/api/upload-lead-photo/route.ts):
     - Validates type (jpeg/png/webp/gif), size ≤10 MB.
     - In-memory IP rate limit: 10 uploads/minute ([:9–21](../src/app/api/upload-lead-photo/route.ts#L9-L21)).
     - `sharp(buffer).rotate().resize(1600, …).webp({ quality: 85 })` → pushes to Vercel Blob at `leads/temp/...` ([:42–52](../src/app/api/upload-lead-photo/route.ts#L42-L52)).
     - Returns `{ url }`.
3. **POST `/api/submit-lead`** ([CreatePageClient.tsx:729–733](../src/components/create/CreatePageClient.tsx#L729-L733)) with payload of business type, name, description, plan, phone/email/contact, address, language (`navigator.language.slice(0,2)` — *not* the next-intl cookie locale, [:720](../src/components/create/CreatePageClient.tsx#L720)), `JSON.stringify(hoursSchedule)`, palette id, and the three uploaded URLs.
4. **`/api/submit-lead/route.ts`** ([full file 84 lines](../src/app/api/submit-lead/route.ts)) does exactly two things:
   - `db.lead.create({ data: { … } })` ([:10–33](../src/app/api/submit-lead/route.ts#L10-L33)) — writes a `Lead` row with `siteStatus` defaulting to `'none'` ([prisma/schema.prisma:240](../prisma/schema.prisma#L240)).
   - Sends a Telegram message via `api.telegram.org/bot…/sendMessage` if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set ([:43–80](../src/app/api/submit-lead/route.ts#L43-L80)). Message includes a link to `vendshop.shop/brief/<leadId>`.
   - Returns `{ ok: true, leadId }`.
5. **Client behavior on success** ([CreatePageClient.tsx:744–748](../src/components/create/CreatePageClient.tsx#L744-L748)):
   - Clears `localStorage`.
   - Resets `state` to `INITIAL_STATE`.
   - Sets `setDeployed(true)` → the `DeployOverlay` ([:559–621](../src/components/create/CreatePageClient.tsx#L559-L621)) flips from spinner to a green check + `t('create.deploy.doneTitle')` + "New project" / "Back" buttons.

### What does NOT happen during the wizard launch

- ❌ **No GitHub repo creation.** No call to `api.github.com/repos/.../generate`.
- ❌ **No `lib/config.ts` / `lib/constants.ts` generation.** No call to Anthropic or OpenAI.
- ❌ **No Vercel deploy trigger.**
- ❌ **No subdomain assignment.** No write to a `Store.slug` (the wizard only writes a `Lead`, never a `Store`).
- ❌ **No Puppeteer + Claude Vision QA.**
- ❌ **No URL is returned to the customer.** The `submit-lead` response only contains `{ ok, leadId }`. The "doneSub" overlay text is whatever the i18n string says — but no clickable site URL is rendered to the user.

### Comparison: admin "Create Site" flow

[/admin/leads/page.tsx:676](../src/app/admin/leads/page.tsx#L676) calls `fetch('/api/leads/${lead.id}/create-site', { method: 'POST' })` — **only the admin UI ever invokes that endpoint.** Verified by full-tree grep: `/api/leads/[id]/create-site` has only those two callers — `OnboardingChat.tsx` and `CreatePageClient.tsx` reference the *upload* endpoint, but neither calls `create-site`.

The `create-site` route ([src/app/api/leads/[id]/create-site/route.ts](../src/app/api/leads/[id]/create-site/route.ts), 472 lines) is the real automation pipeline (15 steps: read template → process photos → generate config → Claude generates constants → create GitHub repo → wait → commit → create Vercel project → trigger deploy → poll → save lead). It is **the same handler** as in [vendshop-automation-tz-v1.md](../vendshop-automation-tz-v1.md), but **the wizard is a separate code path** and currently does not feed into it.

→ **The two flows are NOT the same handler with different inputs. They are two separate code paths that share the `Lead` table.** A site is created only when an operator manually clicks "Create Site" in `/admin/leads`.

### A subtler bug in the bridge between them

`/api/submit-lead` writes the gallery to **`Lead.galleryUrls` (`String[]`)** ([:29–31](../src/app/api/submit-lead/route.ts#L29-L31)).
`/api/leads/[id]/create-site` reads photos from **`Lead.photoUrls` (`String?` JSON-string)** ([create-site/route.ts:201–209](../src/app/api/leads/[id]/create-site/route.ts#L201-L209)).
These are **different columns** ([prisma/schema.prisma:215, :234](../prisma/schema.prisma#L215)). So even if an admin later clicks Create Site on a wizard-generated lead, the photos uploaded by the wizard are not seen by the site builder — it falls back to `'No photos — Claude will use Unsplash'` ([create-site/route.ts:251](../src/app/api/leads/[id]/create-site/route.ts#L251)).

### A second bridging mismatch — palette IDs

Wizard palette IDs are template-specific (`classic`, `charcoal`, `navy`, `sage`, `clay`, `terracotta`, `mint`, `sky`, …) — see §3. `create-site` maps via `PALETTE_MAP` which only knows `dark | light | warm | professional | natural | custom` ([generate-config.ts:67–74](../src/lib/generate-config.ts#L67-L74)). **None of the wizard palette IDs match.** Result: `mappedPalette` is always `undefined`, and the palette falls back to the per-businessType preset.

### A third mismatch — businessType IDs

Wizard ids: `barbershop, restaurant, beauty, auto, dentist, water, electronics, yoga, photography, agency, education, design`.
`create-site`'s `BUSINESS_TYPE_PRESET` / `TEMPLATE_REPO_MAP` keys: `repair, home_services, physical, ecommerce, food, restaurant, beauty, health, digital, education, photography, design` ([generate-config.ts:27–58](../src/lib/generate-config.ts#L27-L58)).
**Only 5 of 12 wizard ids match: `restaurant`, `beauty`, `education`, `photography`, `design`.**
The other 7 (`barbershop, auto, dentist, water, electronics, yoga, agency`) fall back to `DEFAULT_TEMPLATE_REPO = 'vendshop-template-classic'` and the `professional` / `inter` preset — i.e. a yoga studio gets a corporate-classic template if an admin ever runs Create Site on it.

---

## 8. Post-launch dashboard

- **The user's claim**: "after launch the customer can view, delete, or add pictures."
- **Search results:** No post-launch self-service site-management page exists for wizard-generated leads. There is no `/dashboard/lead/...`, no `/site/...`, no `/manage/...`. The wizard never authenticates the user, never creates a `User`, and never creates a `Store` — only a `Lead`.
- **What does exist:**
  - [src/app/brief/[leadId]/page.tsx](../src/app/brief/[leadId]/page.tsx) — a 5-step "brief" form for an existing lead (the link Telegram sends after submission). Customers can return here via the Telegram-sourced URL to upload more photos / pick palette / mood / hero / etc. The brief writes via `PATCH /api/brief/[leadId]` ([src/app/api/brief/[leadId]/route.ts](../src/app/api/brief/[leadId]/route.ts)) and uploads via `/api/brief/upload` ([src/app/api/brief/upload/route.ts](../src/app/api/brief/upload/route.ts)).
  - **Brief is unauthenticated and accessed by leadId in URL.** UNCLEAR if Vadym means this when he says "post-launch dashboard" — it is *pre*-site-creation, not post. There is no equivalent UI keyed off `siteStatus === 'created'`.
  - The `/dashboard/*` routes exist but are gated by `auth()` and tied to the **`User → Store → Items`** model (the older multi-tenant SaaS), which the wizard does not populate. Self-service wizard customers cannot reach `/dashboard`.
- **View / delete / upload-pictures endpoints:**
  - View site: **none from the wizard**. The deploy overlay shows a generic "done" message, not a link.
  - Delete site: **no endpoint found**. `Lead` rows are not deleted by any current API.
  - Upload pictures (post-launch): the only candidates are `POST /api/brief/upload` (brief flow) and `POST /api/admin/leads/[id]/upload-photo` (admin only).

→ **UNCLEAR / probable misconception:** the "view, delete, add pictures" UX Vadym described doesn't exist as a coherent post-launch surface. It may be the brief form, or it may be something he intends to build.

---

## 9. Error handling

### Wizard side ([CreatePageClient.tsx:693–755](../src/components/create/CreatePageClient.tsx#L693-L755))

- Photo upload failures: silent. `uploadPhoto` returns `null` on any error ([:678–691](../src/components/create/CreatePageClient.tsx#L678-L691)) and the lead is submitted without those photos.
- `submit-lead` failure: catches `!res.ok`, throws, the outer `catch` clears the deploy spinner and sets `launchError` to the i18n string `create.step3.launchError` ([:750–754](../src/components/create/CreatePageClient.tsx#L750-L754)). The error is rendered as a small red line under the Launch button ([:550–552](../src/components/create/CreatePageClient.tsx#L550-L552)). **The error message does not expose the HTTP status or the server message** — it's a single static translated string. No retry button — the user can simply click Launch again.
- **Stuck spinner risk:** `setDeploying(true)` is set unconditionally; `setDeploying(false)` is only set in the `catch` block ([:752](../src/components/create/CreatePageClient.tsx#L752)). On *success*, `setDeployed(true)` is set but `deploying` stays `true` so the overlay remains until user clicks "Back" or "New project". **If a network promise hangs forever (no timeout is set on the fetch calls), the overlay never closes.** No `AbortController`, no setTimeout fallback.

### Server side `/api/submit-lead/route.ts`

- DB save wrapped in try/catch — failures `console.error` but the route **still returns `{ ok: true, leadId: undefined }`** ([:35–37, :82](../src/app/api/submit-lead/route.ts#L35-L37)). The wizard would then mark deploy as "done" with no lead actually created. **This is a silent data-loss path.**
- Telegram failure: caught and logged, route still returns OK.

### `/api/leads/[id]/create-site` (NOT called by the wizard, but for completeness)

- Each step has its own try/catch / explicit error path. On failure, the `Lead.siteStatus` is set to `'error'` and `siteError` to the message ([create-site/route.ts:316–320, :461–470](../src/app/api/leads/[id]/create-site/route.ts#L316-L320)).
- GitHub 422 collision: retries once with random suffix ([:340–360](../src/app/api/leads/[id]/create-site/route.ts#L340-L360)).
- Anthropic constants generation failure: aborts (no repo created) and returns 500 ([:314–321](../src/app/api/leads/[id]/create-site/route.ts#L314-L321)).
- Vercel deploy poll has a 55-second timeout ([:64, :96–98](../src/app/api/leads/[id]/create-site/route.ts#L64)) and falls back to `siteStatus = 'creating'` with the projected URL guess.
- **Retry from UI**: the route's status guard ([:161–166](../src/app/api/leads/[id]/create-site/route.ts#L161-L166)) refuses to run again unless `siteStatus` is `'none'` *or* `'error'`. So an admin can re-click Create Site after a failure but not while in-progress. There is no automatic retry.

---

## 10. State of the code

### Dead branches / legacy references in wizard files

- **"AI" description button is fake.** Step 2's `aiGenerate` ([CreatePageClient.tsx:339–343](../src/components/create/CreatePageClient.tsx#L339-L343)) just template-substitutes from a hard-coded English `AI_DESCRIPTIONS` map ([:318–331](../src/components/create/CreatePageClient.tsx#L318-L331)). It does not call `/api/ai/describe` (which exists at [src/app/api/ai/describe/route.ts](../src/app/api/ai/describe/route.ts) and uses the real OpenAI integration).
- **`OnboardingChat` widget** ([src/components/widgets/OnboardingChat.tsx](../src/components/widgets/OnboardingChat.tsx)) also POSTs to `/api/submit-lead` — older lead-capture path, still wired in but not invoked from the wizard. It uses different field names (matches the legacy `services`/`contact` shape).
- **`CartContext`, `CartDrawer`, `CartButton`, `CheckoutForm`, Stripe checkout** — these are part of the multi-tenant Store model and have **zero references from `/create`** code (verified by tracing imports). Not dead, just unrelated. The wizard does not interact with the storefront/cart flow at all.
- **"Most popular" badge points to `pro` plan**, not `starter` ([constants.ts:894](../src/lib/constants.ts#L894)). Inconsistent with the marketing landing page where `starter` is the highlighted plan ([constants.ts:167](../src/lib/constants.ts#L167)). UNCLEAR if intentional.
- **Domain pill in preview is hard-coded `slug.vendshop.shop`** — does not flip to the `.com` form Step 3 shows for Pro/Starter plans ([CreatePageClient.tsx:449–452](../src/components/create/CreatePageClient.tsx#L449-L452) vs [PreviewPanel.tsx:441](../src/components/create/PreviewPanel.tsx#L441)).

### TODO / FIXME / HACK / @ts-ignore comments

`grep TODO|FIXME|HACK|@ts-ignore|@ts-expect-error` in `src/components/create/` and `src/app/api/submit-lead/`: **no matches**.

### Type strictness

- **No `any` casts in the wizard files** (none of `: any`, `as any` in `CreatePageClient.tsx` or `PreviewPanel.tsx`).
- A few `as` narrowings: `parsed as Partial<CreateState>` ([:648](../src/components/create/CreatePageClient.tsx#L648)), `urlPlan as CreatePlan | null` ([:633](../src/components/create/CreatePageClient.tsx#L633)), `e.target.files?.[0]` reads — all bounded.
- `submit-lead/route.ts` uses `Record<string, unknown>` and `String(x)` coercion ([:5–32](../src/app/api/submit-lead/route.ts#L5-L32)) — no schema validation, but no `any` either. Trust-the-client coercion is the main risk.
- TypeScript is strict (`strict: true` from CLAUDE.md "никаких `any`").

---

## 11. Test coverage

`grep` for `*.test.*`, `*.spec.*`, `__tests__`, `playwright.config.*`:

- **Single test file in the entire repo:** [src/lib/image-pipeline/__tests__/auto-crop.test.ts](../src/lib/image-pipeline/__tests__/auto-crop.test.ts) — unrelated to the wizard (image cropping for the automation pipeline).
- No Playwright config, no Cypress, no Vitest/Jest config touching `src/app/create/`, `src/components/create/`, or `src/app/api/submit-lead/`.
- **Zero tests cover the wizard or the site-creation pipeline.**

---

## Top 5 risks / surprises

1. **The wizard does not create a site.** It writes a `Lead` row and pings Telegram. Site creation is gated on a manual admin click in `/admin/leads`. The "Done" overlay implies the site is live, but no URL is ever returned and `submit-lead` returns `{ ok, leadId }` only. ([api/submit-lead/route.ts:82](../src/app/api/submit-lead/route.ts#L82), [CreatePageClient.tsx:741–748](../src/components/create/CreatePageClient.tsx#L741-L748))

2. **Three silent column/ID mismatches between the wizard and the automation pipeline.** Even if an admin later runs Create Site on a wizard-lead:
   - Photos written to `Lead.galleryUrls` are never read (`create-site` reads `Lead.photoUrls`). [submit-lead:29 vs create-site:201](../src/app/api/submit-lead/route.ts#L29)
   - Wizard palette IDs (`classic`, `sage`, `terracotta`…) don't exist in `PALETTE_MAP`, so palette is silently overridden by the businessType preset. [generate-config.ts:67–74](../src/lib/generate-config.ts#L67-L74)
   - 7 of 12 wizard businessType IDs (`barbershop`, `auto`, `dentist`, `water`, `electronics`, `yoga`, `agency`) are not in `TEMPLATE_REPO_MAP` and fall back to `vendshop-template-classic` with the wrong palette/font. A yoga studio becomes a corporate-classic site. [generate-config.ts:45–58](../src/lib/generate-config.ts#L45-L58)

3. **`/api/submit-lead` returns success even when the DB write fails.** The `try/catch` swallows the error and returns `{ ok: true, leadId: undefined }` ([submit-lead/route.ts:35–37, :82](../src/app/api/submit-lead/route.ts#L35-L37)). The wizard then shows "done" to a customer whose lead was never saved. There is also no `services` validation — Prisma may reject submissions with empty description on a clean DB.

4. **Auto-save persists to localStorage only and silently drops photos on every refresh.** No server draft, no leadId carried in URL — close the tab mid-flow with photos uploaded and you've lost them on reload (the in-memory blob URLs are stripped at [CreatePageClient.tsx:649](../src/components/create/CreatePageClient.tsx#L649)). The "Auto-saved" green dot is purely cosmetic — it's not bound to actual save state. Every keystroke writes localStorage with no debounce.

5. **No post-launch UI exists for wizard customers.** No authenticated dashboard, no "view / delete / add pictures" surface tied to a created site. The closest thing is `/brief/[leadId]` (5-step pre-creation form) which the customer reaches only via the Telegram link Vadym receives — not surfaced anywhere in the wizard or in transactional email. **No tests exist for any of this** (only file: an unrelated `auto-crop.test.ts`), so regressions in the launch path will not be caught.
