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

### П3 — HowItWorks
- [ ] Скриншоты каждого шага
- [ ] Анимация при скролле (intersection observer)

### П4 — Pricing
- [ ] Красивые карточки с hover эффектами
- [ ] Toggle месячный/годовой биллинг
- [ ] Анимация при появлении

### П5 — Mobile responsive
- [ ] Mobile menu (burger)
- [ ] Все секции адаптивны
- [ ] Тестирование на разных размерах экрана

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
