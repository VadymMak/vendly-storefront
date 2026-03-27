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

### П6 — Интеграция в vendly
- [ ] Ссылки на реальную платформу
- [ ] Реальные демо-сайты в BusinessTypes
- [ ] Аналитика (Google Analytics / Plausible)

## 3. Phase 2 (после MVP)

- [ ] Блог (MDX)
- [ ] SEO оптимизация (meta tags, Open Graph, sitemap)
- [ ] A/B тесты (разные варианты Hero, CTA)
- [ ] Страница с отзывами клиентов
- [ ] Мультиязычность (sk/cz/ua/de)
- [ ] Интеграция с CMS для контента
