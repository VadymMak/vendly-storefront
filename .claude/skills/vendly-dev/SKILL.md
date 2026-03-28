---
name: vendly-dev
description: Vendly platform development workflow — enforces plan, code rules, and session startup checklist. Use this skill at the START of every vendly-storefront coding session.
triggers:
  - vendly
  - shop
  - storefront
  - продолжить
  - continue
  - go ahead
---

# Vendly Development Workflow Skill

## Session Startup Checklist (ОБЯЗАТЕЛЬНО)

При каждом начале работы:

1. **Прочитай мастер-план**: `vendly-master-plan-v3.md` — найди следующую незавершённую задачу
2. **Прочитай CLAUDE.md** — правила проекта (типы, данные, стили)
3. **Проверь текущие файлы** перед написанием кода:
   - `src/lib/types.ts` — все типы
   - `src/lib/constants.ts` — все данные
   - Соседние компоненты в той же папке
4. **Подтверди пользователю** какую задачу берёшь и почему

## Coding Rules (СТРОГО)

### Стилизация
- ТОЛЬКО Tailwind CSS классы
- Кастомные цвета через `@theme inline` в `globals.css`
- Inline SVG для иконок — НИКАКИХ icon-библиотек
- CSS `@keyframes` для анимаций — НИКАКОГО Framer Motion

### TypeScript
- Строгая типизация, НИКАКИХ `any`
- Все типы — ТОЛЬКО в `src/lib/types.ts`

### Данные
- Все данные — ТОЛЬКО в `src/lib/constants.ts`
- НИКАКОГО хардкода текстов в компонентах
- Витрина: тексты через `shop-i18n.ts` (shopLanguage магазина)
- Dashboard/Admin: тексты через `next-intl` (useTranslations/getTranslations)

### Компоненты
- `'use client'` ТОЛЬКО где нужен state/effects
- Props типизированы через interface

## After Each Task

1. `npx tsc --noEmit` — проверка типов
2. Обновить `vendly-master-plan-v3.md` — поставить [x]
3. Один коммит на одну задачу (message на английском)

## Priority Order

```
СЕЙЧАС:  J1 (i18n hardcode) → J2 (next/image) → J4 (shop footer) → J3 (product cards)
СКОРО:   J5 (search) → J6 (product detail) → K1-K4 (landing upgrade)
ПОТОМ:   L1-L5 (core features: Stripe, Email, GDPR)
БУДУЩЕЕ: M1-M3 (SEO) → N1-N4 (advanced)
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `vendly-master-plan-v3.md` | Master plan — check [x] status |
| `src/lib/types.ts` | ALL TypeScript types |
| `src/lib/constants.ts` | ALL data (texts, configs) |
| `src/lib/shop-i18n.ts` | Shop storefront translations |
| `src/lib/shop-queries.ts` | Database queries for shop pages |
| `src/app/globals.css` | Tailwind @theme inline (custom colors) |
| `src/styles/design-tokens.ts` | JS/TS design tokens |
| `messages/{en,sk,uk,cs,de}.json` | next-intl message files |

## Competitor Benchmarks (targets to match)

- **Shopify Dawn**: image optimization, product hover, sale badges, search, gallery zoom
- **SmartContext.dev**: Lighthouse 100, SEO 100, Quick Answer box, stats bar, dark mode, legal pages, GEO blog
- **Squarespace**: generous whitespace, elegant typography, professional templates
