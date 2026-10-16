# Credits System — How It Works

## Credit Types

There are two types of credits:
- **Image credits** — used for image generation, editing, AI Style, remove background, upscale, inpaint, AI blend, photo reels
- **Video credits** — used for video generation, animation and AI video reels

## Credit Costs by Tool

### Image Tools
| Tool | Credits |
|------|---------|
| Generate Image (Quick) | {{cost:image-quick}} |
| Generate Image (Best) | {{cost:image-best}} |
| Generate Image (HD) | {{cost:image-hd}} |
| Grok Imagine | {{cost:image-best}} |
| Improve Photo — basic presets | Free |
| Improve Photo — AI Style (Grok) | {{cost:ai-style}} |
| Creative Edit (your own prompt) | {{cost:creative-edit}} |
| AI Edit (Flux Kontext) | {{cost:kontext-edit}} |
| Remove Background | {{cost:remove-bg}} |
| Upscale HD | {{cost:upscale}} |
| Edit & Replace (Inpaint) | {{cost:inpaint}} |
| AI Blend | {{cost:ai-blend}} |
| Scene Compose | {{cost:scene-compose}} |
| Generate from reference image | {{cost:reference-generate}} |
| Auto-captions (video subtitles) | {{cost:transcribe}} |
| Auto Split | Free |
| Place Products (manual) | Free |
| Quick Filters | Free |

### Video Tools
| Tool | Credits |
|------|---------|
| Generate Video — Quick (Grok) 5s / 10s / 15s | {{credits:video-quick-5s}} / {{credits:video-quick-10s}} / {{credits:video-quick-15s}} video credits |
| Generate Video — Best (Kling) 5s / 10s / 15s | {{credits:video-best-5s}} / {{credits:video-best-10s}} / {{credits:video-best-15s}} video credits |
| Animate (Image-to-Video) | {{cost:video-animate-5s}} |
| Animate from text — start frame (generated first) | {{cost:start-frame}} |

### Reels
| Reel type | Credits |
|------|---------|
| Photo reel (images mode) | {{cost:reel-image}} |
| AI video reel (video mode) | {{cost:reel-video}} |

Reels are charged when generation starts. If a reel fails, the credits are returned automatically. Reels always use credits.

## Monthly Allowances

| Plan | Image Credits | Video Credits |
|------|--------------|---------------|
| Free | {{plan:free:images}}/month | {{plan:free:videos}} |
| Starter (€{{plan:starter:price}}) | {{plan:starter:images}}/month | {{plan:starter:videos}}/month |
| Pro (€{{plan:pro:price}}) | {{plan:pro:images}}/month | {{plan:pro:videos}}/month |

## Credit Deduction Priority

When you use a tool, credits are deducted in this order:
1. **Bonus credits first** (from credit packs)
2. **Monthly credits second** (from your plan)

This means your purchased credits are always used before your monthly allocation, protecting your monthly credits for later in the cycle.

## Credit Reset

Monthly credits reset every 30 days (from your last reset, or when your subscription renews). Unused monthly credits do NOT carry over — they reset to your plan's allowance. Bonus credits from packs never expire and carry over indefinitely.

## Checking Your Balance

Your current credit balance is shown in the Studio top bar (on mobile: the counter next to the language buttons). You can also check your plan in Studio → Settings.

## What Happens When Credits Run Out

- Image generation shows "No image credits remaining"
- Video generation shows "No video credits remaining"
- You can buy a credit pack (from €{{pack:starter:price}}) for immediate top-up
- Or upgrade your plan for a higher monthly allowance
- Free tools (basic Improve presets, Auto Split, Place Products, Quick Filters) continue to work
