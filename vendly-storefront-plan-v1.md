# VendShop Storefront — План разработки v1

## 1. ЗАВЕРШЕНО ✅

- [x] Инициализация проекта (Next.js 15, TypeScript, Tailwind, pnpm)
- [x] Структура папок (components, lib, styles)
- [x] Design tokens и кастомные цвета
- [x] TypeScript типы
- [x] Константы (business types, pricing, FAQ, how-it-works)
- [x] UI компоненты (Button, Badge, Card)
- [x] Layout компоненты (Header, Footer)
- [x] Секции-заглушки (Hero, SocialProof, BusinessTypes, HowItWorks, Features, Pricing, FAQ, CTA)
- [x] Главная страница (page.tsx) — все секции собраны
- [x] CLAUDE.md с правилами проекта

## 2. ПЛАН — Phase 1 (MVP лендинг)

### П1 — Hero секция ✅
- [x] Красивый дизайн с градиентом/анимацией
- [x] Интерактивный selector типа бизнеса с live preview mockup
- [x] Responsive для mobile

### П2 — SocialProofBar + BusinessTypes секции ✅
- [x] SocialProofBar: бегущая строка (CSS marquee) с inline SVG иконками и разделителями
- [x] BusinessTypes: 6 карточек с inline SVG, hover эффекты, responsive grid 1→2→3
- [x] Demo URL бейджи и стрелка-ссылка на каждой карточке

### П3 — HowItWorks + FeaturesSection ✅
- [x] HowItWorks: 3 шага с inline SVG иконками, номерами, пунктирными стрелками между карточками
- [x] HowItWorks: CSS fade-in-up анимация с staggered delay
- [x] FeaturesSection: 8 фич (AI, multi-lang, payments, WhatsApp, mobile, analytics, SSL, domains)
- [x] FeaturesSection: inline SVG иконки, чередующийся фон (white/accent), hover с инверсией иконки
- [x] Feature тип и FEATURES данные вынесены в types.ts/constants.ts

### П4 — PricingSection + FaqSection ✅
- [x] PricingSection: 3 карточки (Free/Starter/Pro), Starter highlighted с зелёным bg и бейджем «Najobľúbenejší»
- [x] PricingSection: inline SVG галочки, hover подъём, staggered fade-in-up
- [x] FaqSection: 6 вопросов accordion (один открытый), CSS @keyframes accordion-open
- [x] FaqSection: inline SVG иконки (question mark, chevron с rotate), активное состояние (accent bg, primary border)
- [x] Bugfix: Fragment key в HowItWorks.tsx (React warning)

### П5 — CtaSection + Mobile Responsive ✅
- [x] CtaSection: форма ввода имени магазина + редирект на /register?name=...
- [x] CtaSection: gradient bg (primary → secondary), 3 перка с inline SVG (free, no card, 5 min)
- [x] Header: burger menu (useState), mobile dropdown с анимацией, close on nav click
- [x] Responsive аудит всех секций: уменьшены padding (p-8→p-6/p-5 на mobile), heading sizes (text-3xl→text-2xl)
- [x] SocialProofBar: уменьшены fade masks и spacing на 375px
- [x] Footer: уменьшен gap на mobile

### П6 — Полировка: SEO, smooth scroll, scroll animations ✅
- [x] SEO: title, meta description, Open Graph (og:title, og:description, og:image, og:url, og:locale)
- [x] SEO: Twitter card (summary_large_image), canonical URL via metadataBase
- [x] Smooth scroll: html { scroll-behavior: smooth }
- [x] Scroll animations: .scroll-reveal class с animation-timeline: view() на секциях below fold
- [x] Якоря проверены: #features, #how-it-works, #pricing, #faq — все совпадают с id секций
- [x] pnpm build: 0 ошибок, 0 warnings, static prerender OK

### П7 — Favicon и логотип ✅
- [x] Favicon: src/app/icon.svg — зелёный (#16a34a) rounded square с «V.» белым текстом
- [x] Header: inline SVG логотип (28×28, fill #16a34a) + «Vendly» text-secondary
- [x] Footer: inline SVG логотип (24×24, fill #16a34a) + «Vendly»

### П8 — Reviews / Testimonials система ✅
- [x] Prisma schema: Review model — status enum (PENDING/PUBLISHED/REJECTED), ownerReply, authorEmail, ipAddress
- [x] Types: ShopReview, DashboardReview, ReviewFormData, ReviewStatus
- [x] API routes: public GET/POST + authenticated PATCH/DELETE для модерации
- [x] Shop queries: getStoreReviews, getStoreAverageRating, getDashboardReviews, countRecentReviewsByIp
- [x] Storefront: ReviewsSection (server) + ReviewForm (client modal) со звёздами
- [x] Dashboard: ReviewsModerator с фильтрами, publish/reject/reply/delete
- [x] DashboardNav: вкладка Reviews с иконкой звезды
- [x] IP-based spam protection (3 reviews/day)
- [x] i18n: shopFront review keys + dashboardReviews namespace (все 5 языков)
- [ ] ⚠️ Требуется локально: `prisma generate && prisma db push`

## 3. Phase 2 (после MVP)

- [ ] Интеграция в vendly: ссылки на реальную платформу, демо-сайты, аналитика
- [ ] Блог (MDX)
- [ ] A/B тесты (разные варианты Hero, CTA)
- [x] ~~Страница с отзывами клиентов~~ (реализовано в П8)
- [ ] Мультиязычность (sk/cz/ua/de)
- [ ] Интеграция с CMS для контента
- [ ] og-image.png — создать реальное OG изображение 1200×630
