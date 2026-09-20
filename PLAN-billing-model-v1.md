# PLAN: Billing Model v1 — VendShop AI Studio

> Решение принято на основе анализа 5 AI (Claude + Grok + Perplexity + Copilot + Gemini), сентябрь 2026.
> Конкуренты изучены: Runway, Pika, Leonardo, Canva, BYOK-платформы.

---

## Принятая модель: Hybrid (Option C + E)

**Принцип: Картинки = привлечение (бесплатно). Видео = монетизация (платно).**

---

## Тарифные планы

### Free (€0)
- 15 images/мес (только Grok Imagine + Flux Schnell = ~$0 cost)
- 0 videos
- Full доступ: Assemble (editor), Chat agent (free tools only), Background Removal, Upscale
- Watermark на экспорте (опционально)
- Стоимость для платформы: ~$0

### Starter (€9/мес) — добавить после первых покупок credit packs
- 100 images/мес
- 5 videos/мес (5s)
- Optional BYOK для unlimited
- Стоимость: ~$1.55–3.50 (videos) + ~$0.20 (images) = ~$2–4

### Pro (€19/мес) — добавить после 10+ подписчиков Starter
- 300 images/мес
- 15 videos/мес (5s)
- Optional BYOK для unlimited
- Priority queue
- Стоимость: ~$4.65–10.50 (videos) + ~$0.60 (images) = ~$5–11

### BYOK Creator (€7/мес) — для power users
- Unlimited platform access (UI, assembler, chat, templates)
- Юзер использует свои ключи (Replicate, Kling, ElevenLabs)
- Стоимость для платформы: $0
- Margin: ~95%+

---

## Credit Packs (одноразовые, не expire)

| Pack | Цена | Images | Videos | Себестоимость | Margin |
|------|------|--------|--------|--------------|--------|
| Starter Pack | €5 | 50 | 3 | ~$1.00 | ~78% |
| Creator Pack | €10 | 150 | 8 | ~$2.80 | ~70% |
| Pro Pack | €20 | 400 | 20 | ~$7.00 | ~62% |

---

## Superuser аккаунты

Три superuser email (hardcoded в credits.ts):
- `makevytssvadym@gmail.com` (Vadym — admin)
- `akolesnyk1989@gmail.com` (Anastasiya — tester)
- `777sdv@gmail.com` (дочь — Instagram content)

**Правила для superusers:**
- ✅ Unlimited generations (без кредитов) — как сейчас
- ✅ BYOK Settings всегда видны (не спрятаны)
- ✅ Каждый superuser ДОЛЖЕН использовать свой BYOK ключ для видео
- ❌ НЕ использовать platform .env ключ для superuser генераций

---

## BYOK — правила видимости

| Тип юзера | Видит BYOK? | Где? |
|-----------|-------------|------|
| Superuser | ✅ Всегда | Прямо в Settings |
| Paid subscriber | ✅ | Advanced Settings |
| Free user | ❌ | Не показывать |

---

## Технические задачи (порядок выполнения)

### Phase 1: Fix Foundation (PROMPT-103) ✅ DONE
- ✅ Fix dual-storage BYOK bug — один source of truth (`UserApiKey`)
- ✅ Убрать `StudioCredits.replicateKey` из BYOK check → `hasUserApiKey()` helper
- ✅ Superusers: BYOK Settings всегда видны
- ✅ Superusers: enforce BYOK key для видео (403 если нет ключа)
- ✅ Regular users: BYOK скрыт в Advanced Settings

### Phase 2: Free Tier Enforcement (PROMPT-104) ✅ DONE
- ✅ Изменить PLAN_CREDITS: free={15/0}, starter={100/5}, pro={300/15}
- ✅ Free users: force fast tier (quality/premium → fast), costly models сброшены
- ✅ Server-side enforcement: videos=0 → checkCredits автоматически блокирует
- ✅ UI: upgrade modal при Animate, Best/HD disabled с 🔒 и tooltip
- ✅ HOTFIX: client-side credit gate (кнопка "No credits · Buy more" при 0)
- ✅ HOTFIX: credit check перед rate limit (403 вместо 429)
- ✅ HOTFIX: reset monthlyImages для existing free users (5→15)
- ⬜ Invite-only registration (optional — можно через env flag)

### Phase 3: Stripe Credit Packs (PROMPT-105) ✅ DONE
- ✅ Reactivate Stripe checkout (убрать HTTP 410) → `price_data` inline, Dashboard не нужен
- ✅ 3 credit pack products: Starter €5, Creator €10, Pro €20
- ✅ Webhook: уже обрабатывает `type=credit_pack` → `addBonusCredits()`
- ✅ UI: CreditPackModal + "Buy Credits" в CreditCounter + upgrade gate → modal
- ✅ Success flow: `?checkout=success` → refresh + toast + clean URL

### Phase 4: Subscriptions (PROMPT-107) ✅ DONE
- ✅ Stripe recurring subscriptions (Starter €9, Pro €19, BYOK Creator €7)
- ✅ Customer Portal для управления подпиской
- ✅ Webhook: invoice.paid → activate plan + set monthly credits
- ✅ Webhook: customer.subscription.deleted → downgrade to free
- ✅ P2025 fix: getOrCreateCredits() before any update
- ✅ PricingModal + Plans button in CreditCounter

### Phase 5: Per-Provider BYOK Check (PROMPT-109) ✅ DONE
- ✅ Добавлен `hasAnyApiKey(userId)` — для UI status (есть хоть один ключ)
- ✅ `checkCredits()` принимает `provider?` — проверяет конкретный провайдер или любой
- ✅ `deductCredit()` принимает `provider?` — аналогично
- ✅ `getCreditStatus()` использует `hasAnyApiKey` (UI видит BYOK если любой ключ)
- ✅ `generate/route.ts`: per-model credit check с `model.apiKeyProvider`
- ✅ `generate-video/route.ts`: credit check с явным `'replicate'`

### Phase 7 (was 5): BYOK Credit Bypass Removal (PROMPT-110) ✅ DONE
- ✅ `checkCredits()` — only `byok_creator` plan gets `byok: true` bypass; Starter/Pro deduct credits even with own keys
- ✅ `deductCredit()` — same: only `byok_creator` skips deduction; Starter/Pro always deduct
- ✅ `SUBSCRIPTION_PLANS` features: 'BYOK option' → 'Own API keys' (honest messaging)
- ✅ SettingsCanvas: removed "unlimited" from descriptions for paid users

### Phase 8: Fix BYOK Display + Subscription Management UI (PROMPT-111) ✅ DONE
- ✅ `getCreditStatus()`: added `byokUnlimited = byok && plan === 'byok_creator'`
- ✅ `CreditCounter`: `byokUnlimited` drives "∞ Unlimited" display (not just `byok`); Starter/Pro+key show 🔑 badge + credits counter
- ✅ `CreditCounter`: BYOK Creator gets "Manage" button in unlimited row
- ✅ `PricingModal`: 'BYOK option available' → 'Own API keys supported'
- ✅ `SettingsCanvas`: Credits section → Credits & Subscription; Manage subscription button for paid plans

### Phase 6: Video Provider Migration (PROMPT-112) ✅ DONE
- ✅ Primary provider: fal.ai Kling 3.0 Standard ($0.42/5s, −40% vs Replicate)
- ✅ Fallback chain: fal.ai → Replicate → Kling Direct
- ✅ `FalKlingProvider` using `@fal-ai/client` queue API
- ✅ Dynamic API key resolution: fal BYOK → FAL_KEY env → replicate BYOK → REPLICATE_API_TOKEN
- ✅ Backward-compatible polling: `fal:` prefix for new, unprefixed for legacy Replicate jobs

---

## Ключевые API costs (reference)

| Operation | Provider | Cost | Notes |
|-----------|----------|------|-------|
| Image (Best) | xAI Grok | $0.00 | FREE — наше преимущество |
| Image (Quick) | fal Schnell | $0.003 | |
| Image (Quality) | fal Dev | $0.02 | |
| Video 5s | fal.ai Kling 3.0 Std | $0.42 | **Primary (PROMPT-112)** |
| Video 5s | Replicate Kling v2.6 | $0.70 | Fallback |
| Video 5s | Kling Direct 3.0 | $0.42 | BYOK fallback |

---

*План утверждён: 19 сентября 2026. Обновлять после каждого промпта.*
