# CLAUDE.md — vendly-storefront

## ⚠️ ОБЯЗАТЕЛЬНО при каждом запуске
1. Прочитай `vendly-storefront-plan-v1.md` — посмотри что ✅ и что ⬜
2. Прочитай нужные файлы перед тем как писать код (`constants.ts`, `types.ts`, соседние компоненты)
3. После каждой задачи — обнови `vendly-storefront-plan-v1.md` (поставь ✅)
4. `npx tsc --noEmit` перед каждым коммитом

## Проект
Лендинг для vendshop.shop — платформы для малого бизнеса в SK/CZ/UA/DE.
Стек: Next.js 15 App Router, TypeScript, Tailwind CSS v4, pnpm.

## Команды
```bash
pnpm dev          # запуск dev сервера
pnpm build        # production сборка
pnpm lint         # линтер
npx tsc --noEmit  # проверка типов — ОБЯЗАТЕЛЬНО перед коммитом
```

## Правила

### Стилизация
- Только Tailwind CSS классы (никаких CSS Modules, styled-components, inline styles)
- Кастомные цвета через `@theme inline` в `src/app/globals.css`
- Design tokens (для использования в JS/TS) в `src/styles/design-tokens.ts`
- Inline SVG для иконок — никаких icon-библиотек (lucide, heroicons и т.д.)
- CSS `@keyframes` для анимаций — никакого Framer Motion

### Цвета
```
primary:   #16a34a  (зелёный — основной)
secondary: #0f172a  (тёмный)
accent:    #f0fdf4  (светло-зелёный фон)
neutral:   #6b7280  (серый текст)
```

### TypeScript
- Строгая типизация, никаких `any`
- Все типы — только в `src/lib/types.ts`

### Данные
- Все данные (тексты, планы, FAQ) — только в `src/lib/constants.ts`
- Никакого хардкода текстов в компонентах

### Компоненты
- Функциональные компоненты
- `'use client'` только там, где нужен state или effects

### Рабочий процесс
1. Перед кодом — прочитать нужные файлы (`constants.ts`, `types.ts`, соседние компоненты)
2. Одна задача — один коммит (сообщение на английском)
3. `npx tsc --noEmit` перед каждым коммитом
4. После задачи — обновить `vendly-storefront-plan-v1.md` (отметить ✅)

### Язык общения
- Отвечать на русском

## Структура файлов
```
src/
├── app/
│   ├── page.tsx          # главная страница (собирает секции)
│   ├── layout.tsx        # корневой layout (шрифты, meta)
│   └── globals.css       # Tailwind directives + @theme inline
├── components/
│   ├── sections/         # секции лендинга
│   │   ├── HeroSection.tsx
│   │   ├── SocialProofBar.tsx
│   │   ├── BusinessTypes.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── PricingSection.tsx
│   │   ├── FaqSection.tsx
│   │   └── CtaSection.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       └── Card.tsx
├── lib/
│   ├── constants.ts      # ВСЕ данные здесь
│   └── types.ts          # ВСЕ типы здесь
└── styles/
    └── design-tokens.ts  # токены для использования в JS/TS
```

## Справка — основной проект vendly
- Репо: https://github.com/VadymMak/vendly
- Деплой: https://vendshop.shop
- 9 типов магазинов: physical, food, restaurant, beauty, repair, home_services, digital, education, health
- 4 цветовые схемы: light, dark, warm, bold
- Языки: SK (default), EN, UK, CS, DE
- Планы: Free €0 / Starter €12 / Pro €29
