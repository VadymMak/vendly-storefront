# ТЗ: VendShop Site Automation — v1 (LOCKED 2026-04-16)

> **Этот документ — единственный источник истины для автоматизации флоу VendShop.**
> Любые изменения — только через `Change Control` (раздел 10).
> AI (Claude Code, Cursor, любой другой) **НЕ ИМЕЕТ ПРАВА** модифицировать этот файл или расширять scope без явного `да` от Vadym в чате.

---

## 0. Как читать этот документ

1. Разделы 1–4 описывают **цель и замороженные решения**. Их нельзя оспаривать при реализации.
2. Раздел 5 — **4 стадии**. Выполняются **строго по порядку**. Не смешивать. Не начинать следующую пока предыдущая не прошла done-критерий.
3. Для каждой стадии написано: **что открыть, где запускать код, что создать, как проверить**.
4. Разделы 6–9 — справочные (env vars, риски, rollback).
5. Раздел 10 — Change Control. Читать перед любым отступлением от плана.

---

## 1. Цель и границы

### Цель
Превратить ручной процесс «лид → сайт за ~2 часа работы Vadym» в **автоматический: лид → preview URL за ≤ 10 минут без вмешательства**.

### Ограничения scope
| В scope | НЕ в scope |
|---------|-----------|
| One-page сайты из `vendshop-template` (4 варианта) | E-commerce сайты (vendshop-ecommerce — отдельный ТЗ позже) |
| Автосоздание GitHub репо + Vercel деплой | Кастомные домены (остаётся ручной шаг) |
| Автоматическая визуальная QA (contrast) | SEO-оптимизация, Google Search Console |
| Интеграция Claude API для генерации `config.ts` + `constants.ts` | Генерация компонентов или стилей (компоненты заморожены) |
| Опциональная Stage 4: генерация изображений | Клиент-фейсинг revision portal (отдельный ТЗ позже) |

---

## 2. Текущее состояние (2026-04-16, проверено)

### Репозитории
- **vendly-storefront** (github.com/VadymMak/vendly-storefront) — SaaS платформа, домен vendshop.shop. Содержит: лендинг, бриф-форма `/brief/[leadId]`, админка `/admin/leads`, БД через Prisma+Neon.
- **vendshop-template** (github.com/VadymMak/vendshop-template) — GitHub template repo. 55 файлов. 4 варианта: `services`/`schedule`/`menu`/`portfolio`. Визуально заморожен через CSS vars (коммиты 14d8e07, ad5e30d).
- **formaink** (github.com/VadymMak/formaink) — референс для Header pattern. НЕ трогаем.

### Что автоматизировано
- ✅ Бриф-форма 5 шагов → Lead в БД
- ✅ Telegram notification при submit
- ✅ Prompt generator в `/admin/leads` (генерирует текст промпта)
- ✅ Vercel auto-deploy по push

### Что ручное (7 шагов)
1. Открыть `/admin/leads`, нажать "Generate prompt"
2. GitHub → vendshop-template → "Use this template" → новый repo
3. `git clone` локально
4. Открыть в VSCode, запустить Claude Code с промптом
5. Claude Code меняет `config.ts` + `constants.ts`
6. Генерация/скачивание изображений (Grok AI)
7. `pnpm build && git push`

---

## 3. Целевое состояние

После всех 4 стадий:

1. Клиент жмёт «Submit» в бриф-форме
2. Наш backend: создаёт repo → дергает Claude API → коммитит config → Vercel деплоит → Puppeteer делает скриншот → Claude Vision проверяет контраст → если OK — ссылка уходит клиенту через Telegram/Email
3. Vadym вовлекается только когда:
   - Визуальная QA упала → ручной ревью
   - Клиент запросил ревизию (вне этого ТЗ)
   - Нужно привязать кастомный домен

**Цель: 80% лидов идут без ручного вмешательства.**

---

## 4. Архитектурные решения (ЗАМОРОЖЕНО)

Каждое решение — финальное. Изменения только через Change Control.

### 4.1. Template заморожен
- AI **НИКОГДА** не модифицирует компоненты, layout, стили в `vendshop-template`
- AI меняет **ТОЛЬКО** `lib/config.ts` и `lib/constants.ts`
- Если AI считает что нужно изменить компонент — **СТОП**, пишет в Telegram «Нужен manual fix в template», дальше не идёт

### 4.2. Оркестратор живёт в vendly-storefront
- Endpoint: `POST /api/leads/[id]/create-site` в `vendly-storefront`
- Он делает ВСЕ внешние вызовы (GitHub, Vercel, Anthropic, Puppeteer)
- НЕ создаётся отдельный микросервис, НЕ используется очередь (пока)

### 4.3. Состояние лида расширяется
В Prisma `Lead` model добавляем поля:
```
siteRepoUrl    String?   // github URL созданного репо
siteRepoName   String?   // "viking-auto" — человекочитаемо
siteVercelUrl  String?   // "viking-auto.vercel.app"
siteStatus     String?   // pending|creating|building|qa_pending|qa_failed|ready|error
siteError      String?   // сообщение об ошибке (для ручного ревью)
siteCreatedAt  DateTime?
siteQaReport   String?   // JSON { contrast_ok, readability_score, issues }
```
Никаких других полей пока не добавляем.

### 4.4. Аутентификация внешних API
- **GitHub**: Personal Access Token (classic) со scopes `repo`, `workflow`. Хранится в `GITHUB_TOKEN` env var.
- **Vercel**: Personal Access Token. Хранится в `VERCEL_TOKEN`. Team ID — `VERCEL_TEAM_ID`.
- **Anthropic**: API key. Хранится в `ANTHROPIC_API_KEY`. Модель: **claude-sonnet-4-6** (не opus — дороже без нужды; не haiku — не вытянет diff по 5000-токенному input).
- **Puppeteer**: для Vercel serverless — `@sparticuz/chromium` + `puppeteer-core` (только такой комбо работает в Vercel functions).

### 4.5. Шаблон naming
Repo name формируется: `slugify(businessName)-{businessType}` (например `viking-services`). Если такой уже существует — добавляется `-{4 random chars}`.

### 4.6. Vercel проект
- Создаётся автоматически при push в новый repo (через Vercel API `POST /v10/projects` с git integration)
- Framework: `nextjs`
- Root directory: `/`
- Env vars: **никаких** на старте (template сейчас env-free)

### 4.7. Claude Code (VSCode) остаётся для ревизий
Stage 3 автоматизирует **первичную** генерацию. Ручные фиксы и ревизии по-прежнему делаются в VSCode Claude Code.

### 4.8. Stage 4 (images) — опционально
Изображения генерируются через Grok AI **вручную** на Stages 1-3. В Stage 4 — автоматизация, но это **optional** и запускается только после подтверждения Vadym.

---

## 5. Стадии реализации

### ⚙️ Stage 1 — Semi-auto site creation (GitHub + Vercel API)

**Цель:** одна кнопка в админке → создан GitHub repo из template → подключен к Vercel → задеплоен unchanged (с дефолтным config). Vadym всё ещё вручную открывает VSCode Claude Code и меняет config.

#### Что входит
- Endpoint `POST /api/leads/[id]/create-site` в vendly-storefront
- Кнопка «Create Site» в `/admin/leads/[id]` (или на странице списка рядом с «Generate prompt»)
- GitHub API integration (создание repo из template)
- Vercel API integration (создание project + первый deploy trigger)
- Prisma миграция — новые поля в Lead
- Обновление `siteStatus` в реальном времени (polling или просто reload)

#### Что НЕ входит
- ❌ Никакой Claude API
- ❌ Никакой Puppeteer
- ❌ Никакой генерации изображений
- ❌ Никакой Vision QA

#### Требования перед стартом
**Env vars в `.env.local` и в Vercel Production:**
- `GITHUB_TOKEN` — PAT classic со scopes `repo`, `workflow`
- `GITHUB_OWNER` — `VadymMak`
- `GITHUB_TEMPLATE_REPO` — `vendshop-template`
- `VERCEL_TOKEN` — personal access token
- `VERCEL_TEAM_ID` — ID команды (из Vercel dashboard → Settings → General → Team ID; оставить пустым если personal account)

#### Где открыть / где запускать код
- **Репо:** `vendly-storefront` (github.com/VadymMak/vendly-storefront)
- **Что открыть в VSCode:** весь репо `vendly-storefront/`
- **Где Claude Code запускать:** в том же VSCode, терминал внутри репо
- **Команды:**
  - `pnpm install` (если добавили новые зависимости — `@octokit/rest`)
  - `npx prisma db push` (после миграции Prisma)
  - `npx tsc --noEmit` перед коммитом
  - `pnpm dev` для теста локально
  - `git push` → Vercel auto-deploy

#### Файлы для создания / изменения
| Файл | Действие |
|------|----------|
| `prisma/schema.prisma` | Добавить 7 полей в Lead (см. 4.3) |
| `src/app/api/leads/[id]/create-site/route.ts` | NEW — главный endpoint |
| `src/lib/github.ts` | NEW — обёртка над @octokit/rest |
| `src/lib/vercel.ts` | NEW — обёртка над Vercel API |
| `src/lib/site-naming.ts` | NEW — slugify + уникальность имени |
| `src/app/admin/leads/page.tsx` | Добавить кнопку «Create Site» + состояние |
| `package.json` | Добавить `@octokit/rest` |

#### Критерии Done
- [ ] Клик «Create Site» на тестовом лиде создаёт GitHub repo с именем `{slug}-{type}`
- [ ] Repo автоматически подключен к Vercel, есть preview URL
- [ ] `siteStatus` в БД проходит: `creating` → `building` → `ready`
- [ ] Сайт открывается по Vercel URL с дефолтными данными template
- [ ] Если GitHub API/Vercel API падает — `siteStatus = 'error'`, `siteError` содержит сообщение, Telegram alert отправлен
- [ ] `npx tsc --noEmit` зелёный
- [ ] Pr merged в main, Production deploy прошёл

#### Rollback
Если Stage 1 ломается в production — убрать кнопку из админки (feature flag `NEXT_PUBLIC_ENABLE_AUTO_SITE='false'`). Ничего не удалять из БД.

---

### ⚙️ Stage 2 — Visual QA gate

**Цель:** перед тем как отдать preview URL — скриншот + Claude Vision check. Если контраст/читаемость проваливаются — alert Vadym, НЕ отдавать клиенту.

#### Что входит
- Модуль `src/lib/visual-qa.ts` — Puppeteer screenshot + Claude Vision rating
- Интеграция в endpoint `create-site`: после `siteStatus = 'ready'` → `qa_pending` → `qa_passed` | `qa_failed`
- Сохранение отчёта в `siteQaReport` (JSON)
- Telegram alert при `qa_failed` со скриншотом и причиной

#### Что НЕ входит
- ❌ Автофикс при провале (только алерт)
- ❌ A/B screenshots разных брейкпоинтов (только 1440×900 на старте)
- ❌ Lighthouse CI (оставляем на возможное будущее)

#### Требования
**Новые env vars:**
- `ANTHROPIC_API_KEY` — уже будет для Stage 3, можно добавить заранее
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — уже есть для бриф-нотификаций

**Новые зависимости:**
- `@sparticuz/chromium` — chromium binary под Vercel serverless
- `puppeteer-core`
- `@anthropic-ai/sdk` — SDK для Vision API

**Vercel Function config:**
- Нужно увеличить `maxDuration` до 60s в `vercel.json` для endpoint с QA
- Memory: 1024MB минимум

#### Где открыть / где запускать
- **Репо:** тот же `vendly-storefront`
- **Команды:**
  - `pnpm add @sparticuz/chromium puppeteer-core @anthropic-ai/sdk`
  - Локально Puppeteer падает на Mac → тест только на Vercel preview (через push → preview → триггер тестового лида)

#### Файлы
| Файл | Действие |
|------|----------|
| `src/lib/visual-qa.ts` | NEW — screenshot + vision + rating |
| `src/app/api/leads/[id]/create-site/route.ts` | Интеграция QA перед final status |
| `vercel.json` | `maxDuration: 60`, `memory: 1024` для этого route |
| `package.json` | 3 новые зависимости |

#### Контракт visual-qa.ts
```ts
type QaResult = {
  passed: boolean;
  score: number; // 0-10
  issues: string[];
  screenshotUrl: string; // Vercel Blob URL
};
export async function runVisualQa(url: string): Promise<QaResult>
```

Алгоритм:
1. Puppeteer открывает `url` → скриншот 1440×900 → скриншот после скролла до «Why Us» → оба загружаются в Vercel Blob
2. Claude Vision получает оба скриншота + промпт типа «Rate readability 0-10. List issues.»
3. `passed = score >= 7 && !issues.includes('unreadable')`
4. Возврат `QaResult`

#### Критерии Done
- [ ] Вручную создать лид с заведомо плохим фото → QA упала, Telegram alert пришёл
- [ ] Вручную создать лид с хорошими данными → QA прошла, ссылка ушла
- [ ] `siteQaReport` в БД содержит валидный JSON
- [ ] Скриншот доступен по `screenshotUrl` (Vercel Blob)

#### Rollback
Feature flag `NEXT_PUBLIC_ENABLE_VISUAL_QA='false'` → пропустить QA, сразу отдавать URL (как в Stage 1).

---

### ⚙️ Stage 3 — Claude API integration (убираем VSCode)

**Цель:** наш backend сам генерирует `config.ts` + `constants.ts` из данных брифа, коммитит через GitHub API. Ручной Claude Code в VSCode больше не нужен для первичной генерации.

#### Что входит
- Модуль `src/lib/ai-site-builder.ts` — вызов Anthropic API с промптом + данные брифа → получить content для `config.ts` и `constants.ts`
- Интеграция в endpoint `create-site`: между «repo создан» и «Vercel deploy» — вставить шаг «Claude генерирует контент → commit в repo»
- Переиспользовать существующий `buildPrompt` из `admin/leads/page.tsx` (вынести в `src/lib/prompts.ts`)
- Промпт для Claude: **строго ограничить** вывод — JSON с двумя полями `config.ts` и `constants.ts`, никакого markdown, никаких объяснений

#### Что НЕ входит
- ❌ Генерация компонентов или стилей (заморожено по 4.1)
- ❌ Редактирование других файлов (layout, CSS, globals.css)
- ❌ Мульти-ход диалог с AI (один вызов → один коммит)

#### Требования
- `ANTHROPIC_API_KEY` (уже добавлен в Stage 2)
- Модель: **claude-sonnet-4-6**
- Max tokens: 16000 (config.ts обычно 200 строк, constants.ts до 800 — оба помещаются)

#### Файлы
| Файл | Действие |
|------|----------|
| `src/lib/prompts.ts` | NEW — вынести `buildPrompt` + добавить `buildConfigPrompt`, `buildConstantsPrompt` |
| `src/lib/ai-site-builder.ts` | NEW — вызов Anthropic SDK, парсинг ответа |
| `src/app/api/leads/[id]/create-site/route.ts` | Интеграция AI-билдера перед первым push |
| `src/app/admin/leads/page.tsx` | `buildPrompt` теперь импортируется из `lib/prompts.ts` |

#### Критерии Done
- [ ] Лид «Viking» (с структурированными услугами из брифа) → полностью авто → Vercel URL
- [ ] Visual QA прошла
- [ ] Сгенерированный `config.ts` содержит правильные: businessName, palette, navigation, whatsapp
- [ ] Сгенерированный `constants.ts` содержит: правильные услуги с ценами (из `briefServicesJson`), правильные about text, правильные reviews (заглушки)
- [ ] Весь цикл ≤ 10 минут от submit до URL

#### Rollback
Feature flag `NEXT_PUBLIC_ENABLE_AI_BUILDER='false'` → пропустить AI-шаг, сайт создаётся с дефолтным template контентом (как в Stage 1).

---

### ⚙️ Stage 4 — Image generation (OPTIONAL)

**Не начинать пока Stages 1-3 не стабильны в production 2+ недели.**

Автоматизация генерации изображений через Grok AI или Flux (TBD). Отдельное ТЗ.

---

## 6. Env vars / секреты (checklist)

Все переменные — в vendly-storefront Vercel Production + Preview + Development:

| Var | Stage | Где получить |
|-----|-------|--------------|
| `GITHUB_TOKEN` | 1 | github.com/settings/tokens (classic, scopes: repo, workflow) |
| `GITHUB_OWNER` | 1 | = `VadymMak` |
| `GITHUB_TEMPLATE_REPO` | 1 | = `vendshop-template` |
| `VERCEL_TOKEN` | 1 | vercel.com/account/tokens |
| `VERCEL_TEAM_ID` | 1 | vercel.com → Settings → Team ID (или пусто для personal) |
| `ANTHROPIC_API_KEY` | 2,3 | console.anthropic.com/settings/keys |
| `TELEGRAM_BOT_TOKEN` | 2 | уже есть |
| `TELEGRAM_CHAT_ID` | 2 | уже есть |
| `BLOB_READ_WRITE_TOKEN` | 2 | уже есть (Vercel Blob) |
| `NEXT_PUBLIC_ENABLE_AUTO_SITE` | 1+ | feature flag, `true`/`false` |
| `NEXT_PUBLIC_ENABLE_VISUAL_QA` | 2+ | feature flag |
| `NEXT_PUBLIC_ENABLE_AI_BUILDER` | 3+ | feature flag |

---

## 7. Риски и митигация

| Риск | Митигация |
|------|-----------|
| GitHub API rate limit (5000/h для PAT) | Логировать все вызовы, tg-alert при 80% от лимита |
| Vercel deploy падает из-за env mismatch | Template не требует env vars — проверено |
| Claude генерирует сломанный TS | После генерации — `npx tsc` в temp dir; если ошибка — retry 1 раз с прошлой ошибкой в промпте |
| Puppeteer падает в Vercel function | Использовать `@sparticuz/chromium` и только этот комбо, не обычный puppeteer |
| AI галлюцинирует и возвращает «улучшенный» компонент | Промпт в Stage 3 **явно запрещает** трогать что-либо кроме config/constants; парсинг ответа — только JSON-ключи `config.ts` и `constants.ts`, остальное игнорируется |
| Клиент запрашивает ревизию | Вне этого ТЗ. Пока — через Telegram + VSCode Claude Code вручную |

---

## 8. Done definition для всего ТЗ

ТЗ считается полностью выполненным когда:
1. Stages 1, 2, 3 работают в production
2. ≥ 5 реальных лидов прошли от submit до preview URL автоматически
3. ≥ 4 из 5 прошли Visual QA с первого раза
4. Вся статистика видна в `/admin/leads` (siteStatus + QA score)

---

## 9. Rollback (общий)

Если production сломался:
- Все 3 feature flags в `'false'` → флоу возвращается к ручному (Stage 0 = сейчас)
- DB-поля остаются (не ломают существующий код — все `String?`)
- Старые GitHub repos и Vercel projects остаются (не удаляем автоматически никогда)

---

## 10. Change Control (КРИТИЧНО)

### Правило 1 — AI не расширяет scope
Никакой AI-агент (Claude Code, Cursor, я в Cowork) **не имеет права** добавлять функциональность, модифицировать архитектурные решения (раздел 4), или менять порядок стадий. Только реализация того что уже описано.

### Правило 2 — Предложения только через вопрос
Если AI **замечает** проблему или видит возможность улучшения — он пишет Vadym сообщение в формате:
> «Обнаружил: [что]. Предлагаю: [что добавить/поменять]. Обоснование: [почему]. Решение ваше — да/нет/отложить.»

И **ждёт ответа**. НЕ реализует.

### Правило 3 — Изменения в этом документе
Любая правка этого .md файла требует явного `да, меняем` от Vadym в чате. AI **не модифицирует** этот файл по собственной инициативе.

### Правило 4 — Версионирование
Если согласованное изменение вносится — создаётся `vendshop-automation-tz-v2.md` и обновляется `vendshop-automation-tz-v1.md` → помечается `SUPERSEDED by v2`.

### Правило 5 — Hallucination protocol
Если AI при реализации **не понимает** что делать — STOP, пишет Vadym, ждёт ответа. Не угадывает, не генерирует заглушки, не делает «похожее».

---

## 11. Контрольный список перед стартом Stage 1

Перед тем как начать код:
- [ ] Прочитал этот ТЗ полностью
- [ ] Получил все env vars (раздел 6, столбец Stage 1)
- [ ] Запланировал время на 1-2 дня фокусированной работы
- [ ] Понял, что Stage 1 **НЕ автоматизирует полностью** — это только GitHub + Vercel часть. Claude-генерация — Stage 3.
- [ ] Подтвердил что vendshop-template стабилен после последних коммитов (14d8e07, ad5e30d)

---

**LOCKED by Vadym + Claude, 2026-04-16.**
