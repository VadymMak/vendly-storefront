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

## Фаза F — Следующие шаги
- [ ] Онбординг визард (5 шагов)
- [ ] AI генерация магазина (OpenAI)
- [ ] Stripe Connect checkout
- [ ] Загрузка фото (sharp → WebP)
- [ ] Email уведомления (Resend)
- [ ] Кастомные домены (Vercel API)
- [ ] Блог платформы
- [ ] Следующие шаблоны (restaurant, barber, workshop, portfolio)
