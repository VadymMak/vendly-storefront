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

## Фаза H — Следующие шаги
- [ ] Загрузка фото товаров и логотипа (Vercel Blob / Sharp → WebP)
- [ ] Stripe Connect checkout (оплата заказов)
- [ ] Email уведомления при новом заказе (Resend)
- [ ] Онбординг визард (5 шагов) для нового пользователя
- [ ] AI генерация описания товара (OpenAI, уже есть route)
- [ ] Кастомные домены (Vercel API + DNS)
- [ ] SEO hreflang теги для всех языков
- [ ] Следующие шаблоны (restaurant, barber, workshop, portfolio)
- [ ] Блог платформы
