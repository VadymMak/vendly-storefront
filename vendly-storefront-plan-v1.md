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

### П9 — Store Advisor (AI + rule-based) ✅
- [x] Rule-based Store Score: 18 проверок (critical/warning/bonus), взвешенный скоринг (`src/lib/store-score.ts`)
- [x] StoreAdvisor компонент: score ring + checklist + AI advice (`src/components/dashboard/StoreAdvisor.tsx`)
- [x] AI Advisor API: GPT endpoint с structured JSON, plan-based limits (FREE=0, STARTER=10/mo, PRO=50/mo)
- [x] Prisma: aiAdvisorCount, aiAdvisorMonth, aiAdvisorLastUsed поля в User model
- [x] i18n: storeAdvisor namespace (~37 ключей) во всех 5 языках
- [x] Admin unlimited AI usage (ADMIN_EMAIL bypass — без лимитов и cooldown)

### П10 — Store count limits per plan ✅
- [x] FREE=1 магазин, STARTER=3, PRO=10, ADMIN=unlimited
- [x] Серверная валидация в `src/app/api/stores/route.ts`

### П11 — Floating Advisor FAB ✅
- [x] FloatingAdvisor компонент: FAB кнопка (bottom-right) видна на всех dashboard страницах
- [x] Текстовая метка "Advisor" + score badge + pulse dot (score < 60)
- [x] Slide-over панель: score ring, checklist, AI advisor
- [x] Lightweight score API (`/api/stores/[id]/score`) — загружается на mount
- [x] Full data API (`/api/stores/[id]/advisor-data`) — загружается при открытии панели
- [x] Интеграция в `dashboard/layout.tsx`

### П12 — Actionable AI advice cards ✅
- [x] AI prompt возвращает `action` field с навигационными подсказками (tab/page)
- [x] Карточки советов кликабельны — ведут на нужный таб/страницу
- [x] Server-side валидация action targets (whitelist tabs/pages)
- [x] AiAdviceAction тип в `types.ts`
- [x] Fix: SettingsForm синхронизация activeTab с URL `?tab=` через useSearchParams
- [x] Fix: hard navigation (window.location.href) вместо router.push для надёжного переключения табов

### П13 — Auto-geocoding адреса ✅
- [x] Автоматический geocoding адреса через Nominatim при сохранении настроек (если адрес есть, но coordinates пусты)
- [x] Карта на публичной странице магазина показывается автоматически после сохранения адреса

### П14 — Auto-generated openingHours ✅
- [x] Удалено текстовое поле "Графік роботи (текст)" — дублировало слайдеры
- [x] `formatStructuredHours()` — автогенерация текста из structuredHours (e.g. "Mon–Fri 09:00–18:00, Sat–Sun Closed")
- [x] Текст генерируется при сохранении и показывается на публичной странице магазина
- [x] Локализация дней недели и "Зачинено/Closed" на язык магазина (sk/cs/uk/de/en)

## 3. Phase 2 — Storefront Design Overhaul (текущая фаза)

### Стратегия
- **Подход:** модульная система шаблонов по типу магазина (вместо одного универсального)
- **Стиль:** "Shopery meets Rohlik" — чистый, тёплый, европейский
- **Рабочий процесс:** итеративный — компонент → скриншот → обратная связь → правка → следующий
- **Первый тип:** Food/Продукты (тестируем на Smak Shop)
- **Референсы:** Shopify Taste theme, Rohlik.cz, Figma Shopery, Figma Grocery UI Kit

### Фаза A — Food Store Template ✅
Порядок работы: по одной секции, каждую утверждаем визуально.

#### A.1 — Product Card (карточка товара) ✅
- [x] Скруглённая карточка с мягкой тенью, aspect-ratio 4:3
- [x] Категория — small uppercase текст (не бейдж на фото)
- [x] Вес/объём из metadata серым под названием
- [x] Цена крупно (extrabold), валюта мелким
- [x] Кнопка "+" круглая с shadow (h-9 w-9, 44px touch target)
- [x] Hover: -translate-y-1 + shadow-xl + image zoom
- [x] Unavailable: мягкий blur overlay
- [x] No-photo: компактный placeholder
- [x] Бейджи статусов (Featured/Hot/New/Popular) — цветные бейджи в left-top углу карточки
- [ ] TODO (Phase B): бейджи скидок "−20%" — когда будет customAttributes

#### A.2 — Hero Section (баннер) — Classic variants ✅
- [x] ShopHero компонент: Classic с фото (bannerImage + overlay)
- [x] ShopHero компонент: Classic без фото (gradient fallback)
- [x] Адаптивный цвет текста: heroTextColor (auto/light/dark) — auto определяет по наличию фото
- [x] 3 мини-бейджа trust из quickBadges (первые 3) в hero
- [x] CTA кнопка "Перейти к каталогу" (адаптивный цвет)
- [x] Типы: HeroLayout, HeroTextColor, ProductStatus в types.ts
- [x] heroLayout + heroTextColor добавлены в ShopSettings
- [x] BannerCropper: drag+zoom crop tool для баннера (21:9, canvas, 1920px export)
- [ ] TODO: Compact hero layout (featured products above fold) — Starter/Pro only
- [ ] TODO: Dashboard setting для переключения heroLayout
- [ ] TODO: AI Advisor рекомендация compact layout для платных планов

#### A.3 — Catalog / Product Grid ✅
- [x] Горизонтальная полоса категорий — scrollable на mobile, flex-wrap на desktop, grid icon на "All"
- [x] Rounded search bar — rounded-full, py-3, focus shadow
- [x] Grid 2→3→4 колонки (responsive) — уже было
- [x] scrollbar-hide CSS утилита для чистого горизонтального скролла
- [ ] TODO: Фильтры: цена, категория, наличие — Phase D

#### A.4 — Typography & Spacing ✅
- [x] Catalog: extrabold sm:text-3xl заголовок, wider search (sm:w-80), py-12/py-14
- [x] About: ring-4 на avatar, text-3xl stats, tighter tracking, py-14
- [x] Contact: rounded-2xl карточки, rounded-full иконки, hover:-translate-y-0.5
- [x] Warm palette обновлена: orange-50 bg, green-600 accent, stone text — food-store стиль
- [x] Увеличены отступы секций (py-14) для лучшего ритма

#### A.5 — Contact & Footer ✅
- [x] Контактные карточки: rounded-2xl, circular icons, hover lift, bg-white/70
- [x] Карта (уже починено — zoom на город)
- [x] Footer: scheme-aware цвета, social circles с branded hover, opacity-based текст
- [x] Footer typography: text-xl extrabold имя, 11px bold uppercase заголовки колонок

### Фаза B — Product Attributes System ⬜
- [ ] `customAttributes` JSON поле в Product model
- [ ] Предустановленные наборы атрибутов по типу магазина:
  - Food: вес, состав, калории, аллергены, срок годности
  - Clothing: размер, цвет (свотчи), материал, пол, сезон
  - Electronics: модель, характеристики (таблица), гарантия, совместимость
  - Beauty: объём, тип кожи, ингредиенты, сертификации
- [ ] Рендеринг атрибутов на карточке и на странице товара по типу магазина

### Фаза C — Другие шаблоны ⬜
- [ ] Clothing template
- [ ] Electronics template
- [ ] Beauty template
- [ ] General/Universal template (улучшенный текущий)

### Фаза D — Каталог-фильтры по типу ⬜
- [ ] Food: по категории, аллергенам, цене
- [ ] Clothing: по размеру, цвету, материалу, полу
- [ ] Electronics: по характеристикам, бренду, цене
- [ ] Beauty: по типу кожи, объёму

## 4. Phase 3 (после дизайна)

- [ ] Интеграция в vendly: ссылки на реальную платформу, демо-сайты, аналитика
- [ ] Блог (MDX)
- [ ] A/B тесты (разные варианты Hero, CTA)
- [x] ~~Страница с отзывами клиентов~~ (реализовано в П8)
- [ ] Мультиязычность (sk/cz/ua/de)
- [ ] Интеграция с CMS для контента
- [ ] og-image.png — создать реальное OG изображение 1200×630
