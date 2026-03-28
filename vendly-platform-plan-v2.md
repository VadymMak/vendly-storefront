# Vendly Platform — План разработки v2

## Фаза A — Инфраструктура ✅
- [x] Зависимости (prisma, next-auth, next-intl, stripe, sharp, resend, openai, zod, bcryptjs)
- [x] Prisma schema (User, Store, Item, Order, Booking, Review, BlogPost, AiUsage)
- [x] Middleware (subdomain routing)
- [x] Auth (NextAuth v5 Credentials)
- [x] i18n (next-intl) — EN/SK/UK/CS/DE

## Фаза B — Первый шаблон: food-shop ✅
- [x] Shop queries (getStoreBySlug, getStoreItems, getStoreCategories)
- [x] Shop page (/shop/[slug]) with category filter and product grid
- [x] Shop components (ProductGrid, ProductCard, CategoryFilter, CartContext, CartDrawer)
- [x] Color schemes (light, dark, warm, bold)

## Фаза C — Dashboard ✅
- [x] Dashboard page with stats (products, orders, revenue)
- [x] Dashboard queries (getStoreByUserId, getDashboardStats, getDashboardOrders)
- [x] Protected route (redirect to /login if not authenticated)

## Фаза D — Browse (Marketplace) ✅
- [x] /browse page — listing all published stores
- [x] Filter by templateId (business type pills)
- [x] Store cards: logo/fallback, name, description, template badge, item count
- [x] DB query: getPublishedStores with _count items
- [x] Responsive grid 1→2→3

## Фаза E — Admin Panel ✅
- [x] /admin — stores table (slug, name, user email, template, items, published status, date)
- [x] /admin/users — users table (email, name, plan badge, store count, date)
- [x] Protected by ADMIN_EMAIL env var
- [x] Navigation between admin pages

## Фаза F — i18n, Auth forms, Edit product ✅
- [x] i18n messages: nav, hero, cta, footer, auth keys in all 5 languages (EN/SK/UK/CS/DE)
- [x] Header: language switcher dropdown (SK/EN/UK/CS/DE) with globe icon, useTranslations for nav
- [x] CtaSection: useTranslations for title, subtitle, button, perks
- [x] Login page: full form with signIn('credentials'), error handling, link to /register
- [x] Register page: full form with POST /api/register, auto-login, link to /login
- [x] Product edit page: /dashboard/products/[id]/edit — fetch item, check ownership, ProductForm with defaultValues

## Фаза G — Dashboard i18n + Production deploy ✅
- [x] next-intl интегрирован в дашборд (server + client components)
- [x] DashboardNav: language switcher (SK/EN/UK/CS/DE), useTranslations('dashboardNav')
- [x] Login / Register: useTranslations('auth') — все 5 языков
- [x] Dashboard Overview: getTranslations('dashboardOverview')
- [x] Dashboard Products: getTranslations('dashboardProducts')
- [x] Dashboard Orders: getTranslations('dashboardOrders')
- [x] Dashboard Settings / SettingsForm: useTranslations('dashboardSettings')
- [x] Архитектура: interface language (next-intl cookie) ≠ shop language (DB field)
- [x] Production deploy на Vercel — регистрация и логин работают
- [x] Neon DB: pnpm db:push выполнен, схема актуальна

## Фаза H — Shop redesign + Image uploads + i18n fix ✅
- [x] Shop page (/shop/[slug]) — полный редизайн: hero с логотипом/аватаром, чипы (адрес/часы/доставка), CTA кнопки (phone/WhatsApp)
- [x] ProductCard — badge категории, description excerpt, hover lift эффект
- [x] ShopHeader — убран голый номер телефона, добавлены icon-кнопки (📞 + WhatsApp)
- [x] ColorSchemeTokens — новые токены: heroBg, chipBg, chipText, outlineBtn (все 4 схемы)
- [x] Settings page — GitHub-style layout: левый sidebar nav + правая область контента
- [x] Settings Danger Zone — модал с подтверждением имени магазина (backdrop blur)
- [x] ImageUpload компонент — multi (фото товаров) + single (логотип), WebP preview, spinner
- [x] API /api/upload — Vercel Blob + Sharp (WebP, max 1600px, EXIF rotate, 5MB лимит)
- [x] ProductForm — images[] поддержка + ImageUpload интеграция
- [x] SettingsForm — logo upload (single mode), сохранение в store.logo
- [x] API products/[id] и stores/[id] — поддержка images[] и logo
- [x] ProductForm i18n — все хардкоженые SK строки → useTranslations (все 5 языков)
- [x] Vercel Blob store подключён (vendly-blob, BLOB_READ_WRITE_TOKEN)
- [x] Domain vendshop.shop → Vercel Production (www → redirect 307)

## Фаза I — Quick badges + Working hours + AI translation ✅
- [x] Quick info badges — 16 бейджей (fast delivery, PayPal, pickup...), выбор в Settings Design tab, отображение на витрине (QuickBadgesStrip)
- [x] Structured working hours — 7-дневное расписание с перерывами, Open/Closed статус на витрине (StoreStatus), время приёма онлайн-заказов
- [x] OpenStreetMap — адрес + геокодинг через Nominatim, iframe карта на витрине и в Settings
- [x] AI Translation — API endpoints (/api/ai/translate, /api/ai/translate-bulk), TranslateButton + BulkTranslateButton компоненты
- [x] Translate в SettingsForm — кнопки перевода для description, aboutText, deliveryInfo + bulk translate banner
- [x] Translate в ProductForm — кнопки перевода для name и description
- [x] Free plan ограничение — одноразовый AI перевод, `translationUsedAt` в settings JSON, upsell на Starter/Pro
- [x] Landing page — новая feature card "AI content translation", обновлённые pricing plans (free_f5, starter_f7, pro_f8), FAQ q7 про языковой барьер
- [x] i18n — все ключи переводов в 5 языках (EN/SK/UK/CS/DE)

## Фаза I.5 — Admin & Custom Domains ✅
- [x] Admin PRO override — `resolveUserPlan()` / `getUserPlan()`, admin email → PRO в 5 API routes
- [x] Manual plan switcher — `/api/admin/set-plan` endpoint, PlanSelector компонент в admin/users
- [x] Subdomain routing — `getStoreUrl()`, middleware redirect `/shop/slug` → `slug.vendshop.shop`, root-relative shop links
- [x] Custom domain — API `/api/stores/[id]/domain` (save/delete/DNS verify), UI в Settings publishing tab
- [x] Custom domain fallback — `getStoreByDomain()` в shop layout/page/item, middleware rewrite для custom domains
- [x] i18n — custom domain ключи в 5 языках

## Фаза J — Следующие шаги
- [ ] Hero/banner image upload для магазина (фоновое изображение в настройках)
- [ ] Stripe Connect checkout (оплата заказов)
- [ ] Email уведомления при новом заказе (Resend)
- [ ] Account deletion (GDPR) — реальное удаление аккаунта из Danger Zone
- [ ] Онбординг визард (5 шагов) для нового пользователя
- [x] Кастомные домены (Vercel API + DNS)
- [ ] SEO hreflang теги для всех языков
- [ ] Следующие шаблоны (restaurant, barber, workshop, portfolio)
- [ ] Блог платформы
- [ ] Balloon-party тестовый магазин (celebration/photo area)
