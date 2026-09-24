# AI Models — What Powers Studio

## Image Generation Models

### Flux Schnell (Quick Tier)
- **Speed:** ~3 seconds
- **Quality:** Good for drafts and quick iterations
- **Cost:** 1 credit
- **Providers:** fal.ai (primary), Replicate (fallback)

### FLUX.2 Dev (Best Tier)
- **Speed:** ~8 seconds
- **Quality:** High quality, good for final content
- **Cost:** 2 credits
- **Providers:** fal.ai (primary), Replicate (fallback)

### Grok Imagine (Best Tier — Free)
- **Speed:** ~5-10 seconds
- **Quality:** Good quality
- **Cost:** 0 credits (free!)
- **Provider:** xAI
- Used as automatic fallback in Best tier

### FLUX.2 Pro (HD Tier)
- **Speed:** ~15 seconds
- **Quality:** Highest quality, best for print and professional use
- **Cost:** 3 credits
- **Provider:** BFL (Black Forest Labs)

## Image Editing Models

### Flux Kontext Pro
- **Cost:** 2 credits
- **Providers:** fal.ai, Replicate
- Best for precise edits with text instructions

### Grok Edit
- **Cost:** 0 credits (free!)
- **Provider:** xAI
- Good for general improvements and edits

## Video Models

### Grok Video 1.5
- **Provider:** xAI
- **Cost:** 8-25 video credits (depending on duration)
- Text-to-video generation
- Supports 5s, 10s, and 15s videos

### Kling 3.0
- **Provider:** fal.ai
- Image-to-video (animation)
- High quality motion

## Other Models

### SAM2 (Auto Split)
- **Provider:** fal.ai
- Object segmentation
- Free to use

### Remove-bg (lucataco)
- **Provider:** Replicate
- Background removal
- 1 credit

### Flux Fill Pro (Inpaint)
- **Provider:** Replicate
- Object removal and replacement
- 2 credits

## Automatic Fallback

Studio uses smart routing: if one AI provider fails, it automatically tries the next available provider. For example, if fal.ai is slow, it falls back to Replicate. You don't need to do anything — it happens automatically.

## Model Selection

In most cases, the system selects the best model automatically based on your chosen quality tier. Advanced users can select specific models using the model picker in the generation interface.
