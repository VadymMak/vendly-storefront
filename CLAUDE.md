# CLAUDE.md — vendly-storefront

@AGENTS.md

## Проект
Лендинг для vendshop.shop — платформы для малого бизнеса в SK/CZ/UA/DE.
Стек: Next.js 15 App Router, TypeScript, Tailwind CSS, pnpm.

## Правила

### Стилизация
- Только Tailwind CSS классы (никаких CSS Modules, styled-components и т.д.)
- Кастомные цвета определены в `src/app/globals.css` через `@theme inline`
- Design tokens (для использования в JS) в `src/styles/design-tokens.ts`

### TypeScript
- Строгая типизация, никаких `any`
- Типы в `src/lib/types.ts`

### Данные
- Все данные для секций хранятся в `src/lib/constants.ts`
- Никакого хардкода текстов в компонентах — всё через константы

### Язык общения
- Отвечать на русском

### Git
- Одна задача — один коммит
- После завершения задачи обновить план в `vendly-storefront-plan-v1.md` отметкой ✅

### Структура
```
src/
  app/            — Next.js App Router (page, layout, globals.css)
  components/
    layout/       — Header, Footer
    sections/     — Секции лендинга
    ui/           — Переиспользуемые UI компоненты
  lib/            — Константы, типы
  styles/         — Design tokens
```
