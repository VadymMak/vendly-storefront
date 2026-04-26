# VendShop Brain — Implementation Plan (SAVED FOR FUTURE)

> Created: 2026-04-20
> Status: SAVED — not started, implement when 50+ approved sites exist
> Source: Grok consultation, reviewed by Claude

## Concept
Learn from approved sites to improve future generation.
Claude gets "Intuition Context" — similar successful cases → better decisions → fewer fixes.

## Simplified v1 (START HERE when ready)
- Add to Lead model: approvedAt, rating (1-5), fixesCount (0-5), successScore (calculated)
- Approve form in admin (rating + fixes count)
- In generate-constants.ts prompt: simple SQL query for similar successful leads
- No Redis, no pgvector, no embeddings — just SQL
- When 100+ approved sites → upgrade to semantic search

## Full Plan (v2 — future)
- Redis Working Memory (lead cache, intuition cache)
- PostgreSQL + pgvector (semantic search via embeddings)
- OpenAI text-embedding-3-small for embeddings
- Intuition Layer: getIntuitionContext() → Top-5 similar successful cases
- Learning via CRM Approve form → success_score calculation
- Budget: ~$7/month (Redis $5 + OpenAI embeddings $2)

## Architecture (v2)
```
VENDSHOP BRAIN
├── Working Memory (Redis) — lead:{id}, intuition:{id}, TTL 7d
├── Long-term Memory (PostgreSQL + pgvector) — memories table
├── Intuition Layer — getIntuitionContext(lead) → prompt
└── Learning (CRM) — Approve form → success_score → memories
```

## success_score formula
- rating (50%): rating / 5.0
- fixes (30%): 0 fixes = 1.0, 1 = 0.9, 2 = 0.8, 3 = 0.6, 4 = 0.5, 5+ = 0.4
- time (20%): ≤1 day = 1.0, ≤3 = 0.8, ≤7 = 0.6, >7 = 0.4

## Image Pipeline Prerequisites (verify before Brain v2)
- [ ] Quality Gate (size, blur, duplicate detection)
- [ ] Vision Analysis (GPT-4o-mini)
- [ ] Auto-Crop
- [ ] Flux Integration
- [ ] Decision Engine
- [ ] HERO_CONFIG output

## Trigger to start Brain v2
When: 50+ approved sites with ratings in the database
