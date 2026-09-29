# AI Studio — Full Project Review

**URL:** https://vendshop.shop/studio
**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Prisma, pnpm
**Server:** PM2 process `vendly`, deployed at ~/vendly-studio
**Date:** September 18, 2026
**Prompt count:** 102 (PROMPT-001 through PROMPT-102a)

---

## What Is AI Studio

AI Studio is an all-in-one AI content creation platform for small businesses and content creators. It combines image generation, video animation, AI editing, inpainting, scene composition, and a CapCut-style video assembler — all in one web app. Originally part of VendShop (e-commerce SaaS), the platform pivoted to be a standalone AI Studio product at vendshop.shop after the e-commerce platform couldn't compete with Shopify.

Two active users: Vadym (admin) and Anastasiya (tester/content creator).

---

## Architecture Overview

### Three Main Modes

1. **Create** (GenerateCanvas.tsx) — unified workspace for image generation, enhancement, animation, inpainting, scene creation
2. **Assemble** (AssembleCanvas.tsx) — CapCut-style multi-track video editor with timeline, text overlays, audio, export
3. **Chat** (StudioChat.tsx) — AI agent that routes tasks to the right tools automatically (Haiku for routing, GPT-4o-mini for text, Replicate/fal/xAI for media)

### Image Generation — Multi-Provider Architecture

The system uses a **Provider Abstraction Layer** with fallback chains per quality tier:

| Tier | Priority Chain | Status |
|------|---------------|--------|
| **Quick** (~3s) | fal-schnell → Replicate Schnell | ✅ Working |
| **Best** (~8s) | fal-dev → Grok Imagine (FREE) → Replicate Dev | ✅ Working |
| **HD** (~15s) | BFL FLUX.2 Pro | ❌ API key pending |

**11 registered models across 4 providers:**

| Provider | Models | Auth |
|----------|--------|------|
| **fal.ai** | Flux Schnell, FLUX.2 Dev, Flux Kontext Pro | FAL_KEY (platform) |
| **Replicate** | Flux Schnell, Flux Dev, Flux Redux, Flux Kontext Pro | REPLICATE_API_TOKEN or user BYOK |
| **xAI (Grok)** | Grok Imagine, Grok Edit | XAI_API_KEY (FREE, $0/call) |
| **BFL** | FLUX.2 Pro | BFL_API_KEY (not active yet) |

**Smart Model Picker UI:**
- Simple mode: 3 tier buttons (Quick / Best / HD)
- Advanced mode: dropdown with individual model selection
- Automatic fallback: if primary model fails, tries next in chain

### Video Generation — Dual Provider

| Provider | Model | Role | Auth |
|----------|-------|------|------|
| **Replicate** (KlingProvider) | kwaivgi/kling-v2.6 | Primary | REPLICATE_API_TOKEN |
| **Official Kling API** (KlingDirectProvider) | kling-v2-6 at api.klingai.com | Fallback (on 402/429) | KLING_KEY + KLING_SECRET (JWT) |

**Video flow:** POST create task → poll for result → save video URL → show in VideoDetailModal popup

**Supported aspect ratios:** 16:9, 1:1, 9:16 (mapped from image presets: 4:5→9:16)

### Size Presets

| Preset | Aspect Ratio | Resolution | Use Case |
|--------|-------------|------------|----------|
| Instagram | 4:5 | 1080×1350 | Feed posts |
| Square | 1:1 | 1080×1080 | Profile, thumbnails |
| Story | 9:16 | 1080×1920 | Reels, TikTok |
| Landscape | 16:9 | 1920×1080 | Website, YouTube |
| Product | 1:1 | 800×800 | E-commerce |

### Credits & Monetization

- **Free plan:** limited credits
- **Starter:** €12/month
- **Pro:** €29/month
- **BYOK (Bring Your Own Key):** users can add their own Replicate/ElevenLabs/Kling API keys
- Stripe checkout integration for credit purchases
- Credit deduction happens on successful job completion (not on request)

---

## What's Built and Working (✅)

### Create Mode (GenerateCanvas)
- ✅ **Image generation** with multi-model routing and tier selection
- ✅ **AI image editing** — upload image + text prompt → edited image (Grok Edit / Flux Kontext Pro)
- ✅ **5 enhancement presets** — Professional, Food, Product, Portrait, Real Estate
- ✅ **Inpainting** — paint mask on image, describe what to fill (Flux Fill Pro)
- ✅ **Scene Creator** — remove background from object, place into AI-generated scene
- ✅ **Remove Background** — one-click background removal
- ✅ **Upscale** — Real-ESRGAN 4x upscaling
- ✅ **Animate** — image-to-video with 5 motion presets (Cinematic, Food, Product Showcase, Portrait, Parallax)
- ✅ **VideoDetailModal** — popup video player with correct aspect ratios, download, regenerate
- ✅ **Quick filters** — Original, Vivid, Warm, Cool, B&W, Sepia, Vintage, Dramatic
- ✅ **Image detail modal** — full-size preview with metadata, filters, inpaint access
- ✅ **Drag & Drop** image upload
- ✅ **Library** — saved images/videos persist across sessions
- ✅ **Output formats** — WEBP, PNG, JPEG

### Chat Mode (StudioChat)
- ✅ **AI Agent** with Haiku routing — automatically picks the right tool
- ✅ **20+ prompt presets** in 4 categories
- ✅ **Image generation, editing, upscale, remove-bg** via chat commands
- ✅ **Video generation + extension** via chat
- ✅ **Character consistency** — InstantID (same face across images)
- ✅ **Talking avatar / lip-sync** — SadTalker (photo+audio → talking head)
- ✅ **Voiceover** — ElevenLabs TTS with BYOK
- ✅ **Style presets** — 14 styles (photorealistic, cinematic, anime, watercolor, etc.)
- ✅ **Ad clip workflow** — 4-step automated pipeline: generate → animate → voiceover → assemble
- ✅ **Movie Maker** — state machine for multi-scene narrative clips with LoRA face consistency
- ✅ **Self-learning feedback** — 👍/👎 on results, stored in StudioFeedback model
- ✅ **Universal Prompt Enhancement Engine** — 7-step pipeline with virtual camera system

### Assemble Mode (Video Editor)
- ✅ **Multi-track NLE timeline** — video, text, audio tracks
- ✅ **Drag, trim, cut** clips on timeline
- ✅ **Text overlays** — brand, subtitle, CTA, bar, custom types
- ✅ **Canvas preview** synced with timeline playback
- ✅ **Basic color swatches** + hex input
- ✅ **4 animations** — none, fade-in, slide-left, slide-up
- ✅ **Audio support** with sync fixes
- ✅ **IndexedDB persistence** — media survives page reload
- ✅ **WebCodecs video export** — frame-by-frame rendering
- ✅ **Export modal** — preview result before saving

### Infrastructure
- ✅ **Auth** (NextAuth) with session management
- ✅ **Rate limiting** with bypass for admin/superuser
- ✅ **Spam/abuse check** on prompts
- ✅ **Honeypot** fields for bot protection
- ✅ **Cloudflare Turnstile** captcha
- ✅ **Proxy endpoint** for CORS-safe image/video downloads
- ✅ **Admin dashboard** at /admin
- ✅ **Credit system** with plan-based limits
- ✅ **BYOK** — users bring own API keys (Replicate, ElevenLabs, Kling)
- ✅ **Job polling system** — create prediction → poll status → deduct credits on success
- ✅ **Vercel Blob** storage for uploads
- ✅ **Studio usage tracking** (track-generation endpoint)

### Brain Integration (multi-ai-chat MCP server)
- ✅ **generate_image, create_video, extend_video** MCP tools
- ✅ **generate_character_image** (InstantID)
- ✅ **create_talking_avatar** (SadTalker / lipsync-2)
- ✅ **remove_background, upscale_image** MCP tools
- ✅ **generate_voiceover** (ElevenLabs)
- ✅ **create_clip** — full pipeline (scenes + audio + text + watermark + captions)
- ✅ **update_site_media** — push generated assets to VendShop stores
- ✅ **Session memory** — context persists across conversations

---

## What's Planned / In Progress (⬜)

### Short-term (next 1-2 weeks)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Video download fix** | Test download on prod, add more CDN domains if needed | High |
| **Admin Studio Usage** | Generate on prod to verify usage logging | High |
| **BFL API key** | Activate FLUX.2 Pro for HD tier | Medium |
| **BYOK expansion UI** | Better UI for managing multiple API keys | Medium |

### Medium-term (1-2 months)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Assemble Phase 2** | Font Library (Google Fonts), Color Picker, Resizable Text Frames, Text Presets (12 styles), Extended Animations (10 types), Auto-Assembler with templates | High |
| **Cost optimization** | Route to cheapest model that meets quality threshold | Medium |
| **Platform presets** | One-click Instagram/TikTok/YouTube formatting | Medium |
| **LoRA training** | Custom face models for character consistency | Medium |
| **Auto-posting** | Direct publish to social platforms | Low |

### Long-term (2-3 months)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Video Editor (Anastasiya's TZ)** | Full professional video editor with timeline, effects, transitions | High |
| **Movie Maker v2** | Storyboard editor where user edits each scene before generating | Medium |
| **Self-learning v2** | Query feedback DB before generation, pgvector similarity | Medium |
| **Multi-language** | SK, EN, UK, CS, DE support in Studio UI | Low |

---

## Key Technical Decisions

1. **Multi-provider with fallback** — no single point of failure; if fal.ai is down, Replicate picks up
2. **Grok Imagine is FREE** — $0/call for image generation, used as Best-tier fallback
3. **Kling v2.6 on Replicate** — primary video provider; official Kling API as fallback (requires separate keys)
4. **Credit deduction on success** — not on request; user doesn't pay for failed generations
5. **Prompt enhancement engine** — 7-step pipeline classifies subject, picks virtual camera, ensures structural integrity
6. **No external icon libraries** — all SVG inline to minimize bundle
7. **Tailwind CSS only** — no CSS Modules, styled-components, or inline styles
8. **Code workflow** — Cowork (this chat) for discussion/prompts, Claude Code in VSCode for actual coding

---

## File Structure (key files)

```
src/
├── components/studio/
│   ├── generate/
│   │   ├── GenerateCanvas.tsx      # Main Create workspace (~1450 lines)
│   │   ├── ImageDetailModal.tsx    # Image preview popup
│   │   ├── VideoDetailModal.tsx    # Video preview popup (NEW)
│   │   ├── InpaintEditor.tsx       # Mask painting + fill
│   │   └── SceneCreator.tsx        # Object + scene composition
│   ├── assemble/
│   │   ├── AssembleCanvas.tsx      # Video editor workspace
│   │   ├── Timeline.tsx            # Multi-track NLE timeline
│   │   ├── TextFrame.tsx           # Resizable text overlays
│   │   ├── FontPicker.tsx          # Font selection
│   │   ├── ColorPicker.tsx         # Color selection
│   │   ├── TextPropertiesPanel.tsx # Text formatting controls
│   │   └── AutoAssembleModal.tsx   # Template-based auto assembly
│   ├── library/LibraryGrid.tsx     # Saved media browser
│   ├── StudioChat.tsx              # Chat mode UI
│   ├── StudioShell.tsx             # Layout with sidebar nav
│   └── StudioLandingPage.tsx       # Non-auth landing
├── lib/
│   ├── studio/
│   │   ├── config.ts               # 11 model definitions + tier routing
│   │   ├── resolve.ts              # Model resolution logic
│   │   ├── agent.ts                # Haiku routing agent
│   │   ├── tools.ts                # Tool execution
│   │   ├── constants.ts            # Size presets, motion presets, filters
│   │   ├── store.ts                # MediaItem type + Zustand store
│   │   └── learning.ts             # Self-learning feedback
│   ├── video/
│   │   ├── kling-provider.ts       # Replicate wrapper (kwaivgi/kling-v2.6)
│   │   ├── kling-direct-provider.ts # Official Kling API (api.klingai.com)
│   │   ├── wan-provider.ts         # Wan video provider
│   │   └── provider.ts             # VideoProvider interface
│   ├── credits.ts                  # Credit system + plan limits
│   ├── rate-limit.ts               # Rate limiting
│   └── studio-jobs.ts              # Job creation + polling
├── app/api/
│   ├── studio/
│   │   ├── generate/route.ts       # Image generation endpoint
│   │   ├── edit/route.ts           # AI image editing
│   │   ├── inpaint/route.ts        # Inpainting endpoint
│   │   ├── remove-bg/route.ts      # Background removal
│   │   ├── scene-compose/route.ts  # Scene composition
│   │   ├── chat/route.ts           # Chat agent endpoint
│   │   ├── job/[id]/route.ts       # Job polling
│   │   ├── models/route.ts         # Available models list
│   │   ├── resolve-model/route.ts  # Tier → model resolution
│   │   ├── credits/route.ts        # Credit balance
│   │   ├── checkout/route.ts       # Stripe checkout
│   │   ├── upload/route.ts         # Vercel Blob upload
│   │   ├── proxy-image/route.ts    # CORS proxy for downloads
│   │   └── feedback/route.ts       # Self-learning feedback
│   └── generate-video/route.ts     # Video generation endpoint
```

---

## API Keys / Environment

| Key | Provider | Status | Cost |
|-----|----------|--------|------|
| REPLICATE_API_TOKEN | Replicate | ✅ Active | Pay per use |
| FAL_KEY | fal.ai | ✅ Active ($10 balance) | Pay per use |
| XAI_API_KEY | xAI (Grok) | ✅ Active | FREE |
| BFL_API_KEY | BFL (FLUX.2 Pro) | ❌ API was down | ~$0.05/img |
| OPENAI_API_KEY | OpenAI (GPT-4o-mini) | ✅ Active | Captions/text |
| KLING_KEY + KLING_SECRET | Kling Direct | ⬜ Planned | $0.50-1.00/video |
| ELEVENLABS_API_KEY | ElevenLabs | ✅ BYOK only | User pays |

---

## Recent Changes (September 2026)

- **P85-P92:** Smart Model Picker UI, tier fallback chain, fal.ai + Grok integration, Instagram 4:5 preset
- **P98:** HD tier upgraded to FLUX.2 Pro (BFL)
- **P101:** Kling v2-1 → v2-6 migration (model was retired Sept 15)
- **P102:** VideoDetailModal popup with correct aspect ratios
- **P102a:** Video download fix (expanded proxy allowlist, error feedback)

---

## Deploy Commands

**Mac terminal (push):**
```bash
git push origin main
```

**Server terminal (pull + build + restart):**
```bash
cd ~/vendly-studio && git pull origin main && pnpm build && /usr/bin/pm2 restart vendly --update-env
```
