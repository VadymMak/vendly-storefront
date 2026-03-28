# Vendly Platform — Master Plan v3

> Обновлено: 2026-03-28
> На основе анализа: Shopify Dawn, Squarespace templates, Ecwid, SmartContext.dev
> Все фазы A–I.5 завершены. Этот план — от текущего состояния до профессиональной платформы.

---

## Завершённые фазы (справка)

| Фаза | Описание | Статус |
|------|----------|--------|
| A | Инфраструктура (Prisma, Auth, i18n, middleware) | ✅ |
| B | Food-shop шаблон, витрина, корзина, цветовые схемы | ✅ |
| C | Dashboard (статистика, заказы, защита маршрутов) | ✅ |
| D | Browse/Marketplace (публичные магазины) | ✅ |
| E | Admin Panel (магазины, пользователи) | ✅ |
| F | i18n, Auth формы, Edit product | ✅ |
| G | Dashboard i18n + Production deploy | ✅ |
| H | Shop redesign, Image uploads, Settings UI | ✅ |
| I | Quick badges, Working hours, AI translation | ✅ |
| I.5 | Admin PRO override, Subdomains, Custom domains | ✅ |
| П8 | Reviews/Testimonials система (storefront + dashboard) | ✅ |

---

## Фаза J — Shop Storefront Polish (приоритет: ВЫСОКИЙ)

> Цель: довести витрину магазина до уровня Shopify Dawn / Squarespace.
> Это то, что видят покупатели — самое важное для конверсии.

### J1 — Хардкод текстов → i18n (критично)
- [ ] ProductCard: "Bez fotky", "Nedostupné", "Na dopyt", "Do košíka", aria-label — перевести через shop-i18n
- [ ] CategoryFilter: проверить захардкоженные тексты
- [ ] CartDrawer: проверить захардкоженные тексты
- [ ] Checkout page: перевести все SK строки
- [ ] Product detail page (/item/[id]): перевести все SK строки

### J2 — next/image оптимизация (критично)
- [ ] ProductCard: `<img>` → `<Image>` с blur placeholder, sizes, priority для first 4
- [ ] Shop hero: banner image → `<Image>` с fill + priority
- [ ] Shop hero: logo → `<Image>` с width/height
- [ ] Item detail page: gallery images → `<Image>` с responsive sizes
- [ ] next.config: настроить remotePatterns для Vercel Blob домена

### J3 — Product Card улучшения
- [ ] Hover: показывать вторую фотографию (если есть images[1])
- [ ] Sale badge: если есть compareAtPrice, показать "-X%" badge
- [ ] Wishlist кнопка (сердечко) — опционально, localStorage
- [ ] Skeleton loading state при загрузке grid
- [ ] Пустой placeholder для магазина без фото — красивее (градиент + иконка типа бизнеса)

### J4 — Shop Footer
- [ ] Добавить footer на витрину: "Powered by Vendly" с ссылкой
- [ ] Для Pro/Custom domain: возможность скрыть branding
- [ ] Copyright год + privacy policy link

### J5 — Search
- [ ] Поиск по товарам: SearchBar компонент с debounce
- [ ] URL параметр ?q=... для server-side фильтрации
- [ ] Empty state для "ничего не найдено"

### J6 — Product Detail Page
- [ ] Image gallery с thumbnails и zoom on hover
- [ ] Breadcrumbs: Магазин → Категория → Товар
- [ ] Related products секция ("Вам также может понравиться")
- [ ] Structured data (JSON-LD Product schema) для SEO
- [ ] Share button (WhatsApp, Copy link)

---

## Фаза K — Landing Page Upgrade

> Цель: довести лендинг vendshop.shop до уровня smartctx.dev.
> SmartContext подход: Quick Answer box, Stats bar, Services cards, FAQ с конкретными цифрами, CTA, footer с legal.

### K1 — Hero section upgrade
- [ ] "Quick Answer" banner сверху (как smartctx.dev) — ключевые числа одной строкой
- [ ] Animated gradient или particle background вместо plain bg
- [ ] Stats bar под hero: "500+ магазинов", "4 страны", "Lighthouse 95+"
- [ ] Автопрокрутка demo preview магазинов в hero

### K2 — Social Proof усиление
- [ ] Реальные цифры вместо placeholder (кол-во магазинов из DB, если возможно)
- [ ] Логотипы партнёров / интеграций (Stripe, Vercel, OpenAI)
- [ ] "Trusted by" секция с аватарами реальных пользователей

### K3 — Testimonials секция (лендинг)
- [ ] 3 карточки с отзывами (со звёздами, фото, имя, тип бизнеса)
- [ ] "See all reviews" кнопка
- [ ] Данные из constants.ts (или реальные из DB в будущем)

### K4 — Footer upgrade
- [ ] Добавить Legal колонку: Privacy Policy, Terms of Service
- [ ] Добавить Connect колонку: WhatsApp, GitHub, LinkedIn
- [ ] Copyright с текущим годом

---

## Фаза L — Platform Core Features

### L1 — Banner image upload
- [ ] Hero background image загрузка в Settings → Design tab
- [ ] Crop/preview перед upload
- [ ] Vercel Blob storage (как для logo/products)

### L2 — Stripe Connect
- [ ] Onboarding: подключение Stripe аккаунта владельца магазина
- [ ] Checkout flow: создание PaymentIntent, оплата картой
- [ ] Webhooks: обновление статуса заказа
- [ ] Dashboard: Revenue reporting

### L3 — Email уведомления (Resend)
- [ ] Новый заказ → email владельцу
- [ ] Подтверждение заказа → email покупателю
- [ ] Модерация отзыва → email (опционально)
- [ ] Шаблоны email (branded, responsive)

### L4 — GDPR / Account
- [ ] Account deletion — реальное удаление (каскад: user → stores → items → orders → reviews)
- [ ] Export data (JSON/CSV download)
- [ ] Cookie consent banner на витрине

### L5 — Onboarding Wizard
- [ ] 5 шагов: Имя магазина → Тип бизнеса → AI setup → Добавить товары → Publish
- [ ] Progress bar
- [ ] Skip option на каждом шаге

---

## Фаза M — SEO & Performance

### M1 — Structured Data (JSON-LD)
- [ ] LocalBusiness schema на витрине
- [ ] Product schema на product detail page
- [ ] BreadcrumbList schema
- [ ] Review/AggregateRating schema
- [ ] FAQ schema на лендинге

### M2 — SEO Optimization
- [ ] hreflang теги для всех 5 языков
- [ ] Dynamic OG images (next/og) для каждого магазина
- [ ] sitemap.xml (динамический — все магазины + все товары)
- [ ] robots.txt

### M3 — Performance
- [ ] Lighthouse audit → 95+ на витрине
- [ ] Bundle analysis → убрать unused dependencies
- [ ] ISR (Incremental Static Regeneration) для shop pages
- [ ] Image CDN optimization (Vercel Image Optimization)

---

## Фаза N — Advanced Features

### N1 — Blog (MDX)
- [ ] MDX-based blog: /blog/[slug]
- [ ] GEO-optimized posts для AI citation (как smartctx.dev)
- [ ] Categories, tags, reading time
- [ ] RSS feed

### N2 — Analytics Dashboard
- [ ] Page views tracking (lightweight, privacy-first)
- [ ] Order funnel: views → cart → checkout → paid
- [ ] Top products, top categories
- [ ] Time range selector

### N3 — Templates System
- [ ] Restaurant template (menu categories, reservation)
- [ ] Beauty/Barber template (booking calendar)
- [ ] Repair/Service template (service list, quotes)
- [ ] Portfolio/Digital template

### N4 — Advanced AI (product tools)
- [ ] AI product description generator
- [ ] AI image alt-text generator
- [ ] Smart pricing suggestions
- [ ] Automated SEO meta generation

### N5 — AI Dashboard Advisor (WOW feature)

> Контекстный AI-помощник внутри дашборда. Анализирует состояние магазина,
> предлагает следующие шаги, и может выполнять действия через кнопки Apply/Reject.
> Аналог: Shopify Magic, но проще и с фокусом на onboarding + growth.

#### V1 — Context Chat (без embeddings)
- [ ] `AiAdvisor` client component — floating chat button (bottom-right) + slide-up panel
- [ ] API `/api/ai/advisor` — POST endpoint, принимает storeId + user message
- [ ] System prompt строится динамически: store data (name, description, settings, item count, order count, reviews, план пользователя)
- [ ] Контекст магазина < 3K токенов → влезает в окно OpenAI без RAG
- [ ] Предустановленные "quick prompts": "Что мне улучшить?", "Помоги с описанием", "Как привлечь клиентов?"
- [ ] Ответ AI содержит structured actions в JSON: `{ message: "...", actions: [{ type: "publish_store"|"add_product"|"upload_logo"|"translate"|..., label: "...", route: "/dashboard/..." }] }`
- [ ] Action buttons: "Применить" (навигация/выполнение) / "Пропустить"
- [ ] Chat history в localStorage (per store, max 20 messages)
- [ ] Rate limit: 10 AI requests/day на Free, 50 на Starter, unlimited на Pro
- [ ] i18n: chat UI в 5 языках, AI отвечает на языке интерфейса пользователя

#### V2 — Smart Suggestions (proactive)
- [ ] При входе в дашборд — автоматический анализ: "У вас 3 товара без фото", "Магазин не опубликован", "Нет описания"
- [ ] Suggestion cards вверху дашборда (dismissable)
- [ ] Scoring система: "Ваш магазин готов на 65%" — прогресс-бар с чеклистом
- [ ] Notification dot на кнопке чата когда есть новые рекомендации

#### V3 — PG Vector + RAG (будущее)
- [ ] pgvector extension в Neon PostgreSQL
- [ ] Embeddings таблица: store content, platform FAQ, best practices
- [ ] AI-чат на витрине для покупателей: "Есть ли у вас красные шары для свадьбы?"
- [ ] Semantic search по товарам (альтернатива текстовому поиску)
- [ ] Knowledge base из FAQ/блога платформы для advisor

---

## Приоритет выполнения

```
СЕЙЧАС:  J1 (i18n хардкод) → J2 (next/image) → J4 (footer) → J3 (cards)
СКОРО:   J5 (search) → J6 (product detail) → K1-K4 (landing upgrade)
ПОТОМ:   L1-L5 (core features) → M1-M3 (SEO/perf)
WOW:     N5-V1 (AI advisor chat) → N5-V2 (smart suggestions)
БУДУЩЕЕ: N1-N4 (blog, analytics, templates, AI tools) → N5-V3 (RAG/vector)
```

---

## Сравнение с конкурентами (по результатам исследования)

| Фича | Shopify Dawn | SmartCtx.dev | Vendly (текущее) | Vendly (план) |
|------|-------------|-------------|------------------|---------------|
| Image optimization | next/image, blur, srcset | next/image | raw `<img>` | ✅ J2 |
| Product hover 2nd image | ✅ | — | ❌ | ✅ J3 |
| Sale badges | ✅ | — | ❌ | ✅ J3 |
| Product search | ✅ | — | ❌ | ✅ J5 |
| Product detail gallery | ✅ zoom + thumbnails | — | basic | ✅ J6 |
| Shop footer/branding | ✅ | ✅ full footer | ❌ нет footer | ✅ J4 |
| Stats/social proof | ✅ | ✅ numbers bar | marquee only | ✅ K1 |
| Quick Answer box | — | ✅ | ❌ | ✅ K1 |
| Testimonials (landing) | — | — | ❌ | ✅ K3 |
| FAQ с конкретикой | — | ✅ numbers | generic | ✅ K1 |
| JSON-LD schemas | ✅ | ✅ | ❌ | ✅ M1 |
| Lighthouse 95+ | ✅ | ✅ 100 | не проверено | ✅ M3 |
| Dark mode toggle | — | ✅ | ❌ | nice-to-have |
| AI dashboard advisor | ✅ Shopify Magic | ✅ RAG chat | ❌ | ✅ N5 |
| AI storefront chat | — | ✅ RAG | ❌ | ✅ N5-V3 |
| Store readiness score | ✅ | — | ❌ | ✅ N5-V2 |
| Blog (MDX/GEO) | — | ✅ 4 posts | ❌ | ✅ N1 |
| AI chat (RAG) | — | ✅ | ❌ | nice-to-have |
| Legal pages | ✅ | ✅ Privacy+ToS | ❌ | ✅ K4 |
| i18n хардкод | ❌ clean | ✅ clean | ⚠️ есть | ✅ J1 |
