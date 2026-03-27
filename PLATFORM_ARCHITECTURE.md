# Vendly Platform v2 — Архитектурный документ

> Главный документ платформы. Читать перед любой задачей.
> Версия: 1.0 · Март 2026 · VadymMak
> Стек: Next.js 15, TypeScript, Tailwind CSS v4, Prisma, PostgreSQL (Neon)

---

## 1. КОНЦЕПЦИЯ

SaaS конструктор магазинов для малого бизнеса в SK/CZ/UA/DE/PL/RO.
Каждый тип бизнеса = отдельный шаблон витрины с уникальным дизайном и функциями.
AI генерирует готовый магазин за 5 секунд при регистрации.

**Конкуренты:** Shopify, Squarespace, Durable
**Преимущество:** локализация SK/CZ/UA/DE + AI на старте + гибкие шаблоны + низкая цена

---

## 2. БИЗНЕС-МОДЕЛЬ

| План | Цена | AI запросы | Комиссия | Домен |
|------|------|-----------|----------|-------|
| Free | €0 | 5/мес | 2% с продаж | slug.vendshop.shop |
| Starter | €12/мес | 150/мес | 0% | slug.vendshop.shop |
| Pro | €29/мес | безлимит | 0% | свой домен |

**Stripe Connect** — комиссия снимается автоматически через `application_fee_amount`.
Покупатель платит → деньги на счёт платформы → минус комиссия → перевод владельцу.

---

## 3. ШАБЛОНЫ (Template Registry)

### Принцип
Каждый тип бизнеса = отдельная папка. Добавить новый тип = создать папку + одна строка в registry.

```
src/templates/
  registry.ts              ← ЕДИНЫЙ РЕЕСТР всех шаблонов
  food-shop/               ← СТАРТ (первый шаблон)
    index.ts               ← конфиг шаблона
    StoreFront.tsx         ← витрина покупателя
    sections/              ← секции витрины
  restaurant/              ← СЛЕДУЮЩИЙ
    index.ts
    StoreFront.tsx
    sections/
  barber/
  workshop/
  portfolio/
```

### registry.ts — пример
```typescript
import { foodShop } from './food-shop'
import { restaurant } from './restaurant'
// добавить новый тип = одна строка здесь

export const TEMPLATES = { foodShop, restaurant }
export type TemplateType = keyof typeof TEMPLATES
```

### Конфиг шаблона (index.ts)
```typescript
export const foodShop = {
  id: 'food-shop',
  name: { sk: 'Potravinový obchod', en: 'Food Shop', uk: 'Продуктовий магазин' },
  icon: '🛒',
  features: ['cart', 'delivery', 'categories'],  // что доступно
  itemType: 'product',                            // product | service | booking
  aiPrompt: 'Generate a food shop...',            // промпт для AI генерации
  colors: { primary: '#16a34a' },                 // дефолтные цвета
}
```

### Шаблоны на старте и их уникальные фичи

| Шаблон | Дизайн | Уникальные секции |
|--------|--------|-------------------|
| **food-shop** | Большие карточки с фото (chefbrothers.bg) | Категории, корзина, доставка |
| **restaurant** | Hero с атмосферным фото, меню по категориям | Меню, резервация, часы работы |
| **barber** | Портфолио работ, команда мастеров | Услуги + цены, мастера, бронирование |
| **workshop** | Строгий, технический | Услуги + прайс, форма заявки, WhatsApp |
| **portfolio** | Галерея, минималистичный | Проекты, цифровые продукты, контакт |

---

## 4. БАЗА ДАННЫХ (Prisma Schema)

```prisma
// Пользователь платформы (владелец магазина)
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  passwordHash   String?
  name           String?
  uiLanguage     String    @default("sk")  // язык дашборда
  plan           Plan      @default(FREE)
  stripeAccountId String?                  // Stripe Connect account
  aiUsageCount   Int       @default(0)
  aiUsageMonth   String?                   // "2026-03"
  stores         Store[]
  createdAt      DateTime  @default(now())
}

// Магазин (один пользователь может иметь несколько)
model Store {
  id             String    @id @default(cuid())
  slug           String    @unique          // smak → smak.vendshop.shop
  customDomain   String?   @unique          // smak.sk (Pro план)
  templateId     String                     // 'food-shop' | 'restaurant' | ...
  shopLanguage   String    @default("sk")   // язык витрины (≠ uiLanguage)
  name           String
  description    String?
  logo           String?                    // URL в Vercel Blob
  settings       Json                       // цвета, шрифты, контакты, часы
  isPublished    Boolean   @default(false)
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  items          Item[]
  orders         Order[]
  bookings       Booking[]
  reviews        Review[]
  blogPosts      BlogPost[]
  createdAt      DateTime  @default(now())
}

// Гибкая сущность (продукт / услуга / пункт меню / проект)
model Item {
  id          String    @id @default(cuid())
  storeId     String
  store       Store     @relation(fields: [storeId], references: [id])
  type        ItemType                       // product | service | menu_item | portfolio
  name        String
  description String?
  price       Float?
  currency    String    @default("EUR")
  category    String?
  images      String[]                       // WebP URLs в Vercel Blob
  isAvailable Boolean   @default(true)
  sortOrder   Int       @default(0)
  metadata    Json?                          // type-specific поля
  createdAt   DateTime  @default(now())
}

// Заказ (food-shop, restaurant, portfolio)
model Order {
  id              String      @id @default(cuid())
  storeId         String
  store           Store       @relation(fields: [storeId], references: [id])
  customerName    String
  customerEmail   String
  customerPhone   String?
  items           Json                       // snapshot товаров
  total           Float
  platformFee     Float                      // 2% или 0%
  stripeSessionId String?
  status          OrderStatus @default(PENDING)
  createdAt       DateTime    @default(now())
}

// Бронирование / заявка (barber, workshop, restaurant)
model Booking {
  id          String        @id @default(cuid())
  storeId     String
  store       Store         @relation(fields: [storeId], references: [id])
  service     String?
  name        String
  phone       String
  email       String?
  datetime    DateTime?
  message     String?
  status      BookingStatus @default(NEW)
  createdAt   DateTime      @default(now())
}

// Отзыв
model Review {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id])
  author    String
  rating    Int                              // 1-5
  text      String
  isVisible Boolean  @default(true)
  createdAt DateTime @default(now())
}

// Блог платформы (SEO + GEO)
model BlogPost {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  content     String
  excerpt     String?
  coverImage  String?
  language    String   @default("sk")
  isPublished Boolean  @default(false)
  publishedAt DateTime?
  createdAt   DateTime @default(now())
}

// AI использование
model AiUsage {
  id        String   @id @default(cuid())
  userId    String
  action    String                           // 'generate_shop' | 'product_desc' | 'blog_post'
  month     String                           // "2026-03"
  count     Int      @default(0)
  updatedAt DateTime @updatedAt
  @@unique([userId, month])
}

enum Plan          { FREE STARTER PRO }
enum ItemType      { PRODUCT SERVICE MENU_ITEM PORTFOLIO }
enum OrderStatus   { PENDING PAID SHIPPED COMPLETED CANCELLED }
enum BookingStatus { NEW CONFIRMED CANCELLED COMPLETED }
```

---

## 5. ЯЗЫКИ

### UI дашборда (язык интерфейса владельца)
```
EN — обязательно (приоритет 1)
SK — обязательно (приоритет 1)
UA — старт
CS — старт
DE — старт
PL, RO, BG — позже
```

### Язык витрины (что видят покупатели)
Те же языки. Выбирается независимо при создании магазина.

### Как хранится
```
user.uiLanguage   → "en" | "sk" | "uk" | "cs" | "de"
store.shopLanguage → "en" | "sk" | "uk" | "cs" | "de"
```

Полностью независимые настройки. Украинец создаёт словацкий магазин для словацких покупателей.

---

## 6. AI ИНТЕГРАЦИЯ (OpenAI GPT-4o mini)

### Онбординг — генерация магазина (1 запрос ~€0.0003)
Вход: `{ templateId, name, city, shopLanguage }`
Выход: структурированный JSON:
```json
{
  "slogan": "Domáca chuť každý deň",
  "description": "...",
  "categories": ["Ryby", "Zelenina", "Mliečne"],
  "items": [
    { "name": "Losos", "price": 12.50, "description": "...", "category": "Ryby" }
  ],
  "colors": { "primary": "#16a34a", "secondary": "#0f172a" },
  "faq": [{ "q": "...", "a": "..." }]
}
```

### AI в дашборде
- Описание продукта по фото/названию
- Статья в блог магазина
- SEO title + description
- Предложения что добавить в магазин

### Лимиты (трекинг через AiUsage)
```
FREE:    5 запросов/мес  (+ 1 бесплатная генерация при регистрации)
STARTER: 150 запросов/мес
PRO:     безлимит (soft limit 1000)
```

---

## 7. ОНБОРДИНГ ВИЗАРД

```
/onboarding
  step 1: Выбор шаблона     → визуальные карточки (food-shop, restaurant...)
  step 2: Детали магазина   → название + город + язык витрины
  step 3: Регистрация       → email + пароль
  step 4: AI генерация      → лоадер "AI создаёт ваш магазин..."
  step 5: Готово!           → редирект в /dashboard с чеклистом
```

### Чеклист в дашборде после создания
```
☐ Добавь логотип
☐ Загрузи фото продуктов
☐ Подключи Stripe для приёма платежей
☐ Опубликуй магазин
☐ Поделись ссылкой
```

---

## 8. ДОМЕНЫ

```
Free/Starter: slug.vendshop.shop     ← Vercel wildcard *.vendshop.shop
Pro:          myshop.sk              ← Vercel Domains API
```

### Как работает кастомный домен (Pro)
1. Владелец вводит домен в дашборде
2. `POST /api/domains` → `vercel.domains.add({ domain })`
3. Показываем инструкцию: добавить CNAME запись у регистратора
4. Vercel выдаёт SSL автоматически
5. Middleware перехватывает запрос и рендерит нужный магазин

---

## 9. ИЗОБРАЖЕНИЯ

При загрузке фото → автоконвертация через `sharp`:
```
оригинал → WebP (магазин, оптимизированный)
оригинал → JPEG 1200x630 (OG image для соцсетей)
```
Хранение: Vercel Blob

---

## 10. МАРШРУТИЗАЦИЯ (Middleware)

```
vendshop.shop          → лендинг платформы
vendshop.shop/blog     → блог платформы (SEO + GEO)
vendshop.shop/dashboard → дашборд владельца
smak.vendshop.shop     → витрина магазина "smak"
myshop.sk              → витрина магазина с кастомным доменом
```

Middleware читает hostname → находит магазин в БД → рендерит нужный шаблон.

---

## 11. СТРУКТУРА ФАЙЛОВ

```
src/
├── app/
│   ├── (platform)/              ← лендинг + блог платформы
│   │   ├── page.tsx
│   │   └── blog/
│   ├── (auth)/                  ← регистрация, вход
│   ├── onboarding/              ← визард создания магазина
│   ├── dashboard/               ← дашборд владельца
│   │   ├── page.tsx             ← обзор + чеклист
│   │   ├── products/
│   │   ├── orders/
│   │   ├── bookings/
│   │   ├── reviews/
│   │   └── settings/
│   ├── shop/[slug]/             ← витрины магазинов
│   └── api/                     ← API роуты
│       ├── ai/                  ← генерация
│       ├── domains/             ← Vercel Domains API
│       ├── stripe/              ← webhook, checkout
│       └── upload/              ← Vercel Blob + sharp
├── templates/                   ← шаблоны витрин
│   ├── registry.ts
│   ├── food-shop/
│   ├── restaurant/
│   └── ...
├── lib/
│   ├── db.ts                    ← Prisma singleton
│   ├── auth.ts                  ← NextAuth v5
│   ├── ai.ts                    ← OpenAI wrapper
│   ├── stripe.ts                ← Stripe Connect
│   ├── email.ts                 ← Resend
│   ├── storage.ts               ← Vercel Blob + sharp
│   └── domains.ts               ← Vercel Domains API
├── middleware.ts                 ← subdomain routing
└── messages/                    ← i18n переводы (next-intl)
    ├── sk.json
    ├── en.json
    ├── uk.json
    ├── cs.json
    └── de.json
```

---

## 12. EMAIL УВЕДОМЛЕНИЯ (Resend)

| Событие | Кому | Шаблон |
|---------|------|--------|
| Регистрация | Владелец | Добро пожаловать |
| Новый заказ | Владелец | Детали заказа |
| Новая заявка на бронирование | Владелец | Детали заявки |
| Подтверждение заказа | Покупатель | Чек + детали |

---

## 13. БЛОГ ПЛАТФОРМЫ (SEO + GEO)

`vendshop.shop/blog` — статьи на SK/EN/UK/CS/DE:
- "Ako otvoriť online obchod s jedlom na Slovensku"
- "Najlepší web pre kaviareň v roku 2026"
- "Как создать сайт для барбершопа"

GEO = Generative Engine Optimization — чтобы ChatGPT/Gemini рекомендовали платформу.

---

## 14. ПОРЯДОК РАЗРАБОТКИ

### Фаза A — Инфраструктура ✅
1. ✅ Зависимости (prisma, next-auth, next-intl, stripe, sharp, resend, openai, zod, bcryptjs)
2. ✅ Prisma schema (User, Store, Item, Order, Booking, Review, BlogPost, AiUsage) + db singleton
3. ✅ Middleware (subdomain routing: slug.vendshop.shop → /shop/[slug])
4. ✅ Auth (NextAuth v5 Credentials) — JWT sessions, /api/auth, /api/register, /dashboard protection
5. ✅ i18n (next-intl) — EN/SK/UK/CS/DE, messages/*.json, next-intl plugin

### Фаза B — Первый шаблон: food-shop
5. Template registry
6. food-shop витрина (большие карточки, категории, корзина)
7. Stripe Connect checkout

### Фаза C — Онбординг
8. Визард 5 шагов
9. AI генерация магазина
10. Дашборд + чеклист

### Фаза D — Дашборд
11. Управление продуктами (CRUD + AI описания)
12. Заказы и бронирования
13. Загрузка фото (sharp → WebP + JPEG)
14. Настройки магазина

### Фаза E — Полировка
15. Кастомные домены (Vercel API)
16. Блог платформы
17. Email уведомления
18. Следующие шаблоны (restaurant, barber...)

---

## 15. ENV ПЕРЕМЕННЫЕ

```env
# База данных
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Stripe Connect
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Resend
RESEND_API_KEY=
FROM_EMAIL=noreply@vendshop.shop

# Vercel Domains API
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=

# Platform
NEXT_PUBLIC_ROOT_DOMAIN=vendshop.shop
NEXT_PUBLIC_BASE_URL=https://vendshop.shop
```

---

*Последнее обновление: 2026-03-27 · VadymMak*
*Следующее обновление: после завершения Фазы A*
