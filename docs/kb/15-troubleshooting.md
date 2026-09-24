# Troubleshooting — Common Errors

## "No image credits remaining"

**Cause:** You've used all your monthly image credits and bonus credits.

**Solutions:**
1. Buy a credit pack (Pack S: €12 for 120 images, Pack L: €29 for 350 images)
2. Upgrade your plan for more monthly credits
3. Wait for monthly credit reset (every 30 days)
4. Use free tools: Grok Imagine (0 credits), Quick Filters, Auto Split, Place Products

## "Video generation requires a paid plan or credit pack"

**Cause:** You're on the Free plan and have no video credits.

**Solutions:**
1. Upgrade to Starter (€9/month — 5 video credits) or Pro (€19/month — 15 video credits)
2. Buy a credit pack that includes video credits

## "No video credits remaining"

**Cause:** You've used all your video credits for this period.

**Solutions:**
1. Buy a credit pack (Pack S includes 5 videos, Pack L includes 15 videos)
2. Upgrade your plan for more video credits
3. Wait for monthly credit reset

## "Too many requests. Please try again later."

**Cause:** You've hit the rate limit for your plan.

**Rate limits per hour:**
| Operation | Free | Starter | Pro |
|-----------|------|---------|-----|
| Image generation | 5/hr | 30/hr | 80/hr |
| Video generation | 1/hr | 3/hr | 10/hr |
| AI Edit | 5/hr | 30/hr | 80/hr |
| Remove Background | 5/hr | 30/hr | 80/hr |

**Solution:** Wait a few minutes, then try again. Upgrading your plan increases rate limits.

## "Please enter a valid description"

**Cause:** Your prompt was rejected by the content filter. This happens when:
- The prompt is too short (minimum 3 characters)
- The prompt is too long (maximum 2000 characters)
- The prompt contains gibberish or nonsensical text
- The prompt has excessive character repetition

**Solution:** Write a clear, descriptive prompt in natural language.

## "Generation timed out. Please try again."

**Cause:** The AI model took too long to respond (over 90 seconds for images).

**Solutions:**
1. Try again — sometimes servers are temporarily busy
2. Use a faster tier (Quick instead of Best)
3. Simplify your prompt

## "API key not configured" / "Add it in Settings → API Keys"

**Cause:** You're trying to use a model that requires an API key, and neither you nor the platform has one configured for that provider.

**Solutions:**
1. Add your own API key in Studio → Settings → API Keys
2. Try a different model/tier that doesn't require that provider
3. Contact support if you believe the platform should have this key

## Video generation takes too long

**Normal times:**
- 5s video: ~30 seconds
- 10s video: ~60 seconds
- 15s video: ~90 seconds

If it takes longer, the video is still processing. The maximum timeout is 10 minutes. If it fails after that, you'll see an error and credits won't be charged.

## "Generation failed" (generic error)

**Cause:** The AI provider returned an unexpected error.

**Solutions:**
1. Try again — most errors are temporary
2. Try a different quality tier
3. Modify your prompt slightly
4. If the error persists, try later — the provider may be experiencing issues

## Image quality is not good enough

**Tips:**
1. Use a higher quality tier (Best or HD instead of Quick)
2. Be more specific in your prompt — include lighting, style, composition details
3. Use style presets — they add professional photography terms
4. Try the Improve Photo tool to enhance the result
5. Upscale the image for higher resolution

## Credits were charged but no result

This should not happen. Credits are only deducted after a successful generation. If you believe credits were incorrectly charged:
1. Check your generation history in the Studio library
2. The generation may have succeeded but the result didn't load — refresh the page
3. Contact support if the issue persists
