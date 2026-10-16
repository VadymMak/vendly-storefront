# AI Models — What Powers Studio

## Image Generation Models

### Flux Schnell (Quick Tier)
- **Speed:** ~3 seconds
- **Quality:** Good for drafts and quick iterations
- **Cost:** {{cost:image-quick}}
- **Providers:** fal.ai (primary), Replicate (fallback)

### FLUX.2 Dev (Best Tier)
- **Speed:** ~8 seconds
- **Quality:** High quality, good for final content
- **Cost:** {{cost:image-best}}
- **Providers:** fal.ai (primary), Replicate (fallback)

### Grok Imagine (Best Tier)
- **Speed:** ~5-10 seconds
- **Quality:** Good quality
- **Cost:** {{cost:image-best}}
- **Provider:** xAI
- Used as automatic fallback in Best tier

### FLUX.2 Pro (HD Tier)
- **Speed:** ~15 seconds
- **Quality:** Highest quality, best for print and professional use
- **Cost:** {{cost:image-hd}}
- **Provider:** BFL (Black Forest Labs)

## Image Editing Models

### Flux Kontext Pro
- **Cost:** {{cost:kontext-edit}}
- **Providers:** fal.ai, Replicate
- Best for precise edits with text instructions

### Grok Edit
- **Cost:** {{cost:ai-style}} (used for AI Style in Improve Photo)
- **Provider:** xAI
- Good for general improvements and edits

## Video Models

### Grok Video 1.5
- **Provider:** xAI
- **Cost:** {{credits:video-quick-5s}} / {{credits:video-quick-10s}} / {{credits:video-quick-15s}} video credits for 5s / 10s / 15s
- Text-to-video generation
- Supports 5s, 10s, and 15s videos

### Kling 3.0
- **Provider:** fal.ai
- Image-to-video (Animate) — {{cost:video-animate-5s}}
- Text-to-video, Best tier — {{credits:video-best-5s}} / {{credits:video-best-10s}} / {{credits:video-best-15s}} video credits for 5s / 10s / 15s
- High quality motion

## Other Models

### SAM2 (Auto Split)
- **Provider:** fal.ai
- Object segmentation
- Free to use

### Remove-bg (lucataco)
- **Provider:** Replicate
- Background removal
- {{cost:remove-bg}}

### Flux Fill Pro (Inpaint)
- **Provider:** Replicate
- Object removal and replacement
- {{cost:inpaint}}

## Automatic Fallback

Studio uses smart routing: if one AI provider fails, it automatically tries the next available provider. For example, if fal.ai is slow, it falls back to Replicate. You don't need to do anything — it happens automatically.

## Model Selection

In most cases, the system selects the best model automatically based on your chosen quality tier. Advanced users can select specific models using the model picker in the generation interface.
