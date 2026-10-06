# RESEARCH: Image Resolution Pipeline — Where Quality Is Lost

Date: 2026-10-06 · Research only, no code changes · Focus: mobile Improve flow → reel source images

## TL;DR

- `maxInputSize: 1024` is **not the biggest loss**. Before the Improve step even runs, the upload route throws away about 85% of the photo's pixels: a 12 MP phone photo becomes 1152×1536.
- The final 1080×1350 cap comes from the **mobile crop step** (`MobileResizeCropper` draws to `preset.target_width × target_height`), not from the AI.
- Grok edit **does** support `resolution: "2k"`. We never send it. FLUX Kontext is fixed at about 1 MP output, so raising its input size gains nothing.
- For sharp macro shots in reels, the effective fix is to **give the reel pipeline the original full-res photo**. Pushing an AI-processed 1 MP image to 2 MP is not enough. A 30% macro crop from a 3024px-wide original is about 900px, which means about 1.2× upscale to 1080 instead of today's 5.9×.

## 1. Resolution trace (typical iPhone photo, 3024×4032, HEIC ≈ 2–3 MB)

| # | Step | File | Input | Output | What happens |
|---|------|------|-------|--------|--------------|
| 1 | Client compress | `src/lib/studio/compress-image.ts` | 3024×4032 | 3024×4032 | Untouched if ≤ 9 MB. Only files over 9 MB get re-encoded or shrunk (canvas cap 16 MP). |
| 2 | **Upload** | `src/app/api/studio/upload/route.ts:52-62` | 3024×4032 | **1152×1536** WebP q88 | `resize(1536, 1536, fit: 'inside')` on every image. **LOSS #1: 12.2 MP → 1.77 MP (−85%)** |
| 3 | enhance-deterministic | `src/app/api/studio/enhance-deterministic/route.ts`, `src/lib/studio/enhance-pipeline.ts` | 1152×1536 | 1152×1536 JPEG q92 4:4:4 | Sharp sharpen/contrast. No resize. No loss. |
| 4 | AI Style: pre-resize | `src/app/api/studio/edit/route.ts:92-96` | 1152×1536 | **768×1024** PNG | `resize(maxInputSize=1024, fit: 'inside')`. **LOSS #2: 1.77 MP → 0.79 MP** |
| 5 | AI Style: Grok | `src/lib/xai-client.ts:54-68` | 768×1024 | ~1 MP (1k default) | No `resolution` param sent, so xAI defaults to `1k`. |
| 6 | resize-to-original | `src/app/api/studio/resize-to-original/route.ts:56-59` | ~1 MP | 1152×1536 | Sharp `lanczos3`, `fit: 'fill'`. Upscales back about 1.3–1.5×, interpolation only. "Original" = `naturalWidth` of the **uploaded** blob (already capped at 1536), not the camera file. |
| 7 | **Crop to format** | `src/components/studio/mobile/MobileResizeCropper.tsx:131-139` | 1152×1536 (4:5 crop ≈ 1152×1440) | **1080×1350** JPEG 0.92 | Canvas is forced to `preset.target_width/height`. **LOSS #3: hard cap at 1080 wide** |
| 8 | Reel macro crop | reel pipeline (other repo) | ~324px region | 1080×1920 | **5.9× upscale**, the visible blur |

Generate (new image) path: provider outputs about 1 MP (fal `4:5` → 1024×1280, Schnell `megapixels: '1'`). Then `processBuffer` in `src/app/api/studio/generate/route.ts:100` cover-resizes it to `target_width × target_height` (1080×1350 for IG feed). That is a slight upscale of about 5%.

## 2. Where quality is lost (ranked by impact on reels)

1. **Upload cap at 1536** (step 2). Irreversible: every later step works from 1.77 MP at most.
2. **Crop canvas at 1080×1350** (step 7). Even a 2k AI result is squashed to 1080 wide.
3. **Edit pre-resize to 1024 + Grok 1k output** (steps 4–5). Detail is regenerated at about 0.8–1 MP and then interpolated up.
4. Minor: generate output about 1 MP, upscaled about 5% to the preset.

## 3. API capability matrix

| Provider / model | Used as | Max input | Output | Size control | Cost / image |
|---|---|---|---|---|---|
| xAI `grok-imagine-image-2.0` | `edit-grok`, `img-grok` | not documented | `1k` (default) / `1.5k` / `2k` (≈2048 long side) | `resolution` param on `/v1/images/edits` and generations. **We don't send it.** `aspect_ratio` has no `4:5`, but `auto` exists. | $0.04 listed flat on xAI models page. One third-party source says 2k is priced separately. **Verify on the first 2k invoice.** |
| FLUX.1 Kontext Pro (fal `fal-ai/flux-pro/kontext`) | `fal-kontext` | any (downscaled internally) | **fixed ≈1 MP**, multiples of 32 | `aspect_ratio` only. **No `megapixels`, no custom size.** | $0.04 |
| FLUX.1 Kontext Pro (Replicate) | `edit-kontext` | any | fixed ≈1 MP | `aspect_ratio: match_input_image` | config says $0.03 |
| Flux Schnell (Replicate) | `img-fast` generate | — | 1 MP | `megapixels`. As far as I know only `"1"` / `"0.25"` (unverified this session). **`"2"` not available.** | config value |
| fal Flux generate | `fal-*` | — | ~1 MP | `image_size` (named or `{width,height}`) | config value |
| Real-ESRGAN (Replicate) | `/api/enhance-image` type `upscale` (4×) / `portrait` (2×) | — | 2–4× input | `scale` | GPU-time billed, typically cents. Not verified. |
| Topaz image-upscale (Replicate) | `/api/enhance-image` type `supir` | — | up to 6× | `scale`, model `High Fidelity V2` | Not verified. Check the Replicate model page. |

Answers to the specific questions:

1. **Raise `maxInputSize` to 2048?** Yes for `edit-grok`, but only together with `resolution: '2k'`. Otherwise Grok still returns 1k. For both Kontext entries: no benefit, because output is fixed at 1 MP.
2. **Raise `PLATFORM_IMAGE_PRESETS` to 2160×2700?** Not by itself. Generate output is about 1 MP, so `processBuffer` would just Sharp-upscale it about 2.1×: bigger files, no real detail. The 1080×1350 in the cropper (step 7) is also driven by these presets, and IG displays at 1080 anyway. Better to decouple: a "publish" size of 1080×1350 and a "source" size at full res for the reel pipeline.
3. **Generate at higher res?** `megapixels` can't go above 1 on Schnell. Real options: Grok generate with `resolution: '2k'` (`grokGenerate` doesn't send it today), or FLUX1.1 Pro Ultra (4 MP, about $0.06 on fal, not in catalog).
4. **AI upscale step exists?** Yes. `/api/enhance-image` already wraps Real-ESRGAN (2×/4×) and Topaz. It isn't wired into the mobile Improve or generate flow.
5. **Cost at 2×:** Grok edit/gen at 2k is $0.04 if the flat price holds (verify). An added Real-ESRGAN 2× pass is roughly cents per image. Kontext has no 2× option.
6. **Kontext `megapixels: "2"` / custom size?** No. Only `aspect_ratio`.

## 4. Recommended changes (priority order)

1. **Keep the original for the reel pipeline** (biggest win, no AI cost).
   In `src/app/api/studio/upload/route.ts`, either raise the 1536 cap (e.g. 4096; `MAX_INPUT_PIXELS` is 50 MP so Sharp is safe), or store a full-res original next to the 1536 working copy and return both URLs. The reel pipeline should cut macro crops from the original. AI routes already downscale their own input, so they don't depend on the 1536 cap. Trade-off: blob storage and bandwidth.
2. **Grok edit at 2k.**
   Add `resolution?: '1k' | '1.5k' | '2k'` to `ImageEditRequest` (`src/lib/studio/config.ts`), pass it in `grokEdit` (`src/lib/xai-client.ts`), and set `edit-grok.maxInputSize = 2048`. Send JPEG q95 instead of PNG from `edit/route.ts` to keep the upload small.
3. **Don't force the crop canvas down to 1080.**
   In `MobileResizeCropper.handleApply`, output at the crop's native pixel size (keep the aspect, cap at e.g. 2× target), or produce two outputs: publish-size and source-size.
4. **`resize-to-original`:** `lanczos3` is already the best Sharp kernel. Replace `fit: 'fill'` with `cover`, so a non-4:5 Grok result is cropped instead of stretched. Optionally swap in Real-ESRGAN 2× for real detail when the scale factor is above about 1.5×.
5. **Generate:** if higher-res generated images are needed, use Grok `resolution: '2k'` or an optional Real-ESRGAN 2× pass. Don't just bump `target_width/height`.
6. **Housekeeping:** `edit-grok.costPerCall` is `0.0` in `src/lib/studio/config.ts:250`, but xAI lists $0.04/image. `logUsage` under-reports spend.

## 5. Cost impact per image

| Change | Extra cost per image |
|---|---|
| #1 keep original | $0 AI. Storage: about 2–4 MB more per photo |
| #2 Grok 2k edit | $0 if flat $0.04 holds (unverified for 2k) |
| #3 crop at native size | $0 |
| #4 / #5 Real-ESRGAN 2× pass | roughly cents (GPU-time billed, unverified) |

## Sources

- xAI REST API, images (edits params incl. `resolution`): https://docs.x.ai/developers/rest-api-reference/inference/images
- xAI image generation docs (`1k` default / `2k`): https://docs.x.ai/developers/model-capabilities/images/generation
- xAI models and pricing: https://docs.x.ai/developers/models
- BFL, Kontext output dimensions (fixed ~1 MP): https://help.bfl.ai/articles/9589283133-why-does-flux-kontext-can-alter-output-dimensions
- BFL resolution limits: https://help.bfl.ai/articles/8531149640-what-are-the-resolution-limits
- fal Kontext Pro price: https://computeprices.com/providers/fal-ai/models/flux-1-kontext-pro
