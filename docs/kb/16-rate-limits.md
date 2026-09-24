# Rate Limits

## What are rate limits?

Rate limits prevent abuse and ensure fair usage for all users. Each plan has different limits on how many operations you can perform per hour.

## Limits by Plan

| Operation | Free | Starter | Pro |
|-----------|------|---------|-----|
| Image Generation | 5/hour | 30/hour | 80/hour |
| Video Generation | 1/hour | 3/hour | 10/hour |
| AI Edit / Improve | 5/hour | 30/hour | 80/hour |
| Enhance Image | 5/hour | 30/hour | 80/hour |
| Remove Background | 5/hour | 30/hour | 80/hour |
| Registration | 2/24 hours | 2/24 hours | 2/24 hours |
| Buy Credits | 5/hour | 5/hour | 5/hour |

## What happens when you hit a limit?

You'll see: "Too many requests. Please try again later." (HTTP 429)

Wait a few minutes and try again. Rate limits reset on an hourly rolling window.

## How to increase your limits

Upgrade to a higher plan. Pro plan users get 80 generations per hour for most operations, which is more than enough for most workflows.

## BYOK Creator plan

BYOK Creator plan users also have rate limits (same as Pro tier), but since they use their own API keys, provider-side limits may also apply.
