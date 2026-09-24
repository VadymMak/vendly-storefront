# BYOK — Bring Your Own API Keys

## What is BYOK?

BYOK (Bring Your Own Key) lets you use your own API keys from AI providers instead of (or in addition to) the platform's shared keys. This gives you more control over costs and potentially higher rate limits.

## Supported Providers

| Provider | Used for | Where to get a key |
|----------|---------|-------------------|
| Replicate | Image generation (Flux Schnell, Flux Dev), Remove Background, Inpaint | [replicate.com](https://replicate.com) |
| xAI (Grok) | Image generation (Grok Imagine), Image editing (Grok Edit), Video generation (Grok Video 1.5) | [x.ai](https://x.ai) |
| fal.ai | Image generation (Flux Schnell, Flux Dev, Kontext), Video (Kling 3.0) | [fal.ai](https://fal.ai) |
| BFL (Black Forest Labs) | HD image generation (FLUX.2 Pro) | [bfl.ml](https://bfl.ml) |

## How to add API keys

1. Go to Studio → Settings
2. Find the API Keys section
3. Click "Add Key" for the provider you want
4. Paste your API key
5. The key is encrypted and stored securely

## How BYOK Works

When you have your own key for a provider:
- The system uses YOUR key instead of the platform's shared key
- Your key is checked first; if not set, the platform key is used as fallback

## BYOK Creator Plan (€7/month)

The BYOK Creator plan is designed for users who bring their own keys:
- **Unlimited usage** — no credit deductions at all
- All models unlocked
- Priority queue
- You pay providers directly based on their pricing

## BYOK on Starter/Pro Plans

If you're on Starter or Pro and add your own keys:
- Credits are still deducted normally
- Your own keys are used for API calls (potentially faster/more reliable)
- This does NOT give you unlimited usage — credits still apply

## Provider Pricing (approximate)

| Provider | Model | Cost per generation |
|----------|-------|-------------------|
| Replicate Flux Schnell | img-fast | ~$0.003 |
| Replicate Flux Dev | img-quality | ~$0.03 |
| fal.ai Flux Schnell | fal-schnell | ~$0.003 |
| fal.ai Flux Dev | fal-dev | ~$0.012 |
| BFL FLUX.2 Pro | img-premium | ~$0.03 |
| xAI Grok Imagine | img-grok | Free |
| xAI Grok Edit | edit-grok | Free |
| xAI Grok Video 1.5 | video | ~$0.15-0.30 |

## Security

- API keys are encrypted before storage (AES encryption)
- Keys are never exposed in the browser or API responses
- You can delete your keys anytime from Settings
