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
| J | Shop Storefront Polish (навигация, newsletter, i18n) | ✅ |

---

## Фаза J — Shop Storefront Polish (приоритет: ВЫСОКИЙ)

> Цель: довести витрину магазина до уровня Shopify Dawn / Squarespace.
> Это то, что видят покупатели — самое важное для конверсии.

### J1 — Хардкод текстов → i18n (критично) ✅
- [x] ProductCard: "Bez fotky", "Nedostupné", "Na dopyt", "Do košíka", aria-label — перевести через shop-i18n
- [x] CategoryFilter: проверить захардкоженные тексты
- [x] CartDrawer: проверить захардкоженные тексты
- [x] Checkout page: перевести все SK строки
- [x] Product detail page (/item/[id]): перевести все SK строки
- [x] CartButton, AddToCartButton, ShopFooter, ShopHeader — все переведены
- [x] Success page, Not-found page — переведены
- [x] 5 языковых файлов обновлены (~40 новых ключей каждый)

### J2 — next/image оптимизация (критично) ✅
- [x] ProductCard: `<img>` → `<Image>` с fill, sizes, priority для first 4
- [x] Shop hero: banner image → `<Image>` с fill + priority
- [x] Shop hero: logo → `<Image>` с width/height
- [x] Item detail page: gallery images → `<Image>` с responsive sizes
- [x] next.config: настроить remotePatterns для Vercel Blob домена
- [x] ShopHeader: logo → `<Image>`
- [x] CartDrawer: cart item thumbnails → `<Image>`

### J3 — Product Card улучшения ✅ (частично)
- [x] Hover: показывать вторую фотографию (если есть images[1]) — crossfade transition
- [ ] Sale badge: если есть compareAtPrice, показать "-X%" badge (нужна миграция Prisma)
- [ ] Wishlist кнопка (сердечко) — опционально, localStorage (отложено)
- [x] Skeleton loading state при загрузке grid — ProductGridSkeleton + loading.tsx
- [x] Пустой placeholder для магазина без фото — градиент + иконка shopping bag

### J4 — Shop Footer ✅
- [x] Добавить footer на витрину: "Powered by VendShop" с ссылкой на vendshop.shop
- [x] Для Pro: скрыть branding (ownerPlan === 'PRO')
- [x] Copyright год — отдельный элемент
- [x] WhatsApp иконка добавлена в footer рядом с Instagram/Facebook
- [x] ownerPlan добавлен в ShopData + все shop queries

### J5 — Search ✅
- [x] Поиск по товарам: SearchBar компонент с 400ms debounce
- [x] URL параметр ?q=... для server-side фильтрации (name, description, category — insensitive)
- [x] Empty state для "ничего не найдено" + отдельный от пустого каталога
- [x] Категория скрывается при активном поиске
- [x] 3 ключа переводов во всех 5 языках

### J6 — Product Detail Page ✅
- [x] Image gallery: mouse-follow 2x zoom on hover, image counter, active ring на thumbnails
- [x] Breadcrumbs: home icon → Магазин → Категория → Товар (chevron separators)
- [x] Related products: getRelatedItems (same category → backfill), ProductCard grid
- [x] Structured data: JSON-LD Product schema (name, images, brand, offers, availability)
- [x] ShareButton: dropdown — Copy link (clipboard API) + WhatsApp share
- [x] OpenGraph meta: image, store name в title
- [x] 4 новых i18n ключа во всех 5 языках

### J7 — Shop Storefront Polish ✅
- [x] ShopHeader.tsx: двухрядный layout — Row 1 (лого + секционная навигация + действия), Row 2 (dropdown категорий + quick pills)
- [x] Якорная навигация со smooth scroll (#products, #reviews, #about, #contact)
- [x] ShopNewsletter.tsx: секция подписки на рассылку с dark gradient фоном
- [x] page.tsx: section IDs для всех секций + интеграция Newsletter
- [x] layout.tsx: передача categories в ShopHeader
- [x] shop-i18n.ts: 9 новых ключей (navProducts, navReviews, navAbout, navContact, newsletter*)
- [x] Переводы: все 5 локалей обновлены (en, sk, uk, cs, de)
- [x] Мобильное меню: секционные ссылки + категории + контакты
- [x] npx tsc --noEmit — без ошибок

---

## Фаза K — Landing Page Upgrade

> Цель: довести лендинг vendshop.shop до уровня smartctx.dev.
> SmartContext подход: Quick Answer box, Stats bar, Services cards, FAQ с конкретными цифрами, CTA, footer с legal.

### K1 — Hero section upgrade ✅
- [x] "Quick Answer" banner сверху — ключевые числа одной строкой (5 языков)
- [x] Animated gradient background с пульсирующими orbs
- [x] Stats bar под hero: "500+ магазинов", "4 страны", "5 языков", "99.9% uptime"
- [x] Автопрокрутка demo preview каждые 4с + progress dots + пауза при клике

### K2 — Social Proof усиление ✅
- [x] Логотипы технологий / интеграций (Next.js, Vercel, Stripe, Prisma, OpenAI)
- [x] "Powered by" подсекция с i18n (5 языков)
- [x] Fix: marquee items без demo URL — span вместо broken link
- [ ] Реальные цифры из DB (отложено — требует API endpoint)

### K3 — Testimonials секция (лендинг) ✅
- [x] 3 карточки с отзывами (звёзды, avatar initials, имя, тип бизнеса)
- [x] Quote icon, hover shadow, scroll-reveal animation
- [x] Данные из constants.ts (TESTIMONIALS array) + тексты через i18n (5 языков)
- [x] Testimonial тип в types.ts

### K4 — Footer upgrade ✅
- [x] Legal колонка: Privacy Policy, Terms of Service, GDPR — ссылки на /terms, /privacy, /gdpr
- [x] Connect колонка: WhatsApp, GitHub, LinkedIn
- [x] Social icons в brand секции (WhatsApp, GitHub, LinkedIn) с hover эффектами
- [x] Copyright с текущим годом + быстрые legal ссылки в bottom bar
- [x] 5-колоночный grid (brand, product, support, legal, connect)
- [x] connect i18n ключ во всех 5 языках

### K5 — Hero Premium Redesign (Shopify-killer) ✅
- [x] Dark hero background (bg-secondary #0f172a), gradient text headline (green shimmer)
- [x] Two-column layout: text left, interactive preview right
- [x] Glass morphism stats cards (4 cards: stores, countries, languages, uptime)
- [x] Business type selector pills in preview column
- [x] Auto-rotate preview with dot indicator
- [x] Background effects: radial gradient mesh + CSS grid pattern
- [x] hero i18n: titleLine1/titleLine2 split, quickAnswer, stats — all 5 languages

### K6 — Featured Shops Section ✅
- [x] 3 real live shops (Smak Shop, Ballon Party, Food Demo) as cards
- [x] Emoji icons, colored accent backgrounds, numbered badges (01-03)
- [x] Hover effects with arrow icon and shadow, links to real .vendshop.shop subdomains
- [x] featuredShops i18n keys in all 5 languages

### K7 — FAQ Upgrade with Specific Numbers ✅
- [x] All 7 FAQ answers rewritten with concrete numbers (plan prices, limits, timelines, percentages)
- [x] Specific details: 10/100/unlimited products, 135+ currencies, 500 MB files, 9 templates, 4 schemes
- [x] Step-by-step store creation breakdown (30 sec + 1 min + 3 min = 5 min)
- [x] Updated in all 5 languages (en, sk, uk, cs, de)

### K8 — JSON-LD Schemas for Landing ✅
- [x] SoftwareApplication schema: name, offers (3 plans), aggregateRating, features, languages
- [x] FAQPage schema: all 7 questions with concise answers for Google rich results
- [x] Both schemas injected in layout.tsx via script[type="application/ld+json"]

---

## Фаза L — Platform Core Features

### L1 — Banner image upload ✅ (сделано ранее в фазе H)
- [x] Hero background image загрузка в Settings → Design tab
- [x] Vercel Blob storage (sharp → webp, max 1600px)
- [ ] Crop/preview перед upload (отложено)

### L2 — Stripe Connect ✅ (частично)
- [x] Checkout flow: Stripe Checkout Session → redirect → payment → webhook
- [x] Webhooks: POST /api/webhooks/stripe → PAID / CANCELLED
- [x] Stripe Connect: application_fee + transfer_data для store owners с stripeAccountId
- [x] stripe.ts lib helper
- [x] DB price validation — цены берутся из БД, не доверяем клиенту (паттерн из vendly)
- [x] Idempotency check в webhook — проверка дублирования по stripeSessionId (паттерн из vendly)
- [ ] Onboarding: UI для подключения Stripe аккаунта (отложено)
- [ ] Dashboard: Revenue reporting (отложено)

### L3 — Email уведомления (Resend) ✅
- [x] Новый заказ → email владельцу (branded HTML template)
- [x] Подтверждение заказа → email покупателю (items table, total, branding)
- [x] Emails fire-and-forget (webhook flow + legacy /api/orders flow)
- [x] Professional baseTemplate system перенесён из vendly (shared header/card/footer)
- [x] 7 email функций: verification, password reset, welcome, order confirm, new order, review, report
- [x] Helper компоненты: accentBar, cardBody, heading, subtext, button, infoBox, divider, smallNote
- [ ] Модерация отзыва → email (отложено)

### L4 — GDPR / Account ✅
- [x] Cookie consent banner на витрине (localStorage, accept/decline, i18n 5 языков)
- [x] Export data — GET /api/account/export → JSON download (все stores, items, orders, reviews)
- [x] Account deletion — DELETE /api/account/delete → cascade (user → stores → items → orders → reviews → bookings → blogPosts)
- [x] UI в Dashboard Settings → Danger Zone: Export Data + Delete Account кнопки

### L5 — Onboarding Wizard
- [ ] 5 шагов: Имя магазина → Тип бизнеса → AI setup → Добавить товары → Publish
- [ ] Progress bar
- [ ] Skip option на каждом шаге

---

## Фаза M — SEO & Performance

### M1 — Structured Data (JSON-LD)
- [ ] LocalBusiness schema на витрине
- [x] Product schema на product detail page (J6)
- [ ] BreadcrumbList schema
- [ ] Review/AggregateRating schema
- [x] FAQ schema на лендинге (K8)
- [x] SoftwareApplication schema на лендинге (K8)

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
СЕЙЧАС:  K1-K8 (landing upgrade — SmartContext.dev) → L1-L5 (core features)
СКОРО:   M1-M3 (SEO/perf)
WOW:     N5-V1 (AI advisor chat) → N5-V2 (smart suggestions)
БУДУЩЕЕ: N1-N4 (blog, analytics, templates, AI tools) → N5-V3 (RAG/vector)

ЗАВЕРШЕНО: A → B → C → D → E → F → G → H → I → I.5 → П8 → J
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
