# VendShop AI Studio — Knowledge Base

This directory contains the documentation for the RAG chatbot's knowledge base.

## Files

| # | File | Topic | Chunks (est.) |
|---|------|-------|---------------|
| 01 | getting-started.md | Overview, first steps, tool list | 3 |
| 02 | plans-and-pricing.md | Plans, prices, credit packs | 4 |
| 03 | image-generation.md | Text-to-image, tiers, styles, sizes | 5 |
| 04 | video-generation.md | T2V, I2V, durations, aspect ratios | 5 |
| 05 | image-editing.md | AI Edit, Improve, presets | 3 |
| 06 | remove-background.md | Background removal | 2 |
| 07 | upscale.md | HD upscaling | 2 |
| 08 | inpaint.md | Edit & Replace, object removal | 3 |
| 09 | auto-split.md | Object segmentation | 2 |
| 10 | place-products.md | Scene composition, AI Blend | 3 |
| 11 | scene-compose.md | Multi-image AI composition | 2 |
| 12 | quick-filters.md | CSS filters | 2 |
| 13 | byok-api-keys.md | BYOK, providers, setup | 4 |
| 14 | credits-system.md | Credit mechanics, deduction, reset | 4 |
| 15 | troubleshooting.md | Error messages, solutions | 6 |
| 16 | rate-limits.md | Rate limits by plan | 2 |
| 17 | ai-models.md | All models, providers, specs | 4 |
| 18 | workflows.md | Step-by-step workflows | 5 |
| 19 | prompt-tips.md | Prompt writing guide | 4 |
| 20 | account-settings.md | Account, settings, languages | 2 |
| 21 | business-use-cases.md | Use cases by business type | 5 |
| 22 | image-formats-sizes.md | Formats, presets, downloads | 3 |
| 23 | generate-with-reference.md | Image variations | 2 |
| 24 | privacy-security.md | Privacy, GDPR, security | 2 |
| 25 | faq.md | Frequently asked questions | 5 |

**Total: 25 documents, ~77 estimated chunks**

## Ingestion

These files are processed by the RAG ingestion script (`scripts/ingest-kb.ts`) which:
1. Reads each markdown file
2. Splits by headers (## sections) into chunks of 500-800 tokens
3. Generates embeddings via OpenAI text-embedding-3-small
4. Stores in `kb_chunk` table with pgvector + tsvector

## Updating

When you add or modify a file:
1. Run `pnpm run ingest-kb` to re-process changed files
2. The script uses file checksums to skip unchanged files
