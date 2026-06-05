# Промпт для Claude Code: Fix Image Generation Route

## Проблема

Image generation (`/api/generate-image`) не работает ни на Mac, ни на Windows.
Video generation (`/api/generate-video`) работает нормально.

**Root cause найден** — два отличия между роутами:

### 1. Feature flag блокирует роут (строка 21)
```typescript
// generate-image/route.ts — БЛОКИРУЕТ
if (process.env.REPLICATE_ENABLED !== 'true') {
  return NextResponse.json({ error: 'Image generation is disabled' }, { status: 503 });
}
```
`REPLICATE_ENABLED` нигде не установлен → роут ВСЕГДА возвращает 503.

В `generate-video/route.ts` такой проверки **нет** → видео работает.

### 2. Auth: image route не ищет BYOK ключ юзера
```typescript
// generate-image/route.ts — ТОЛЬКО env var
const token = process.env.REPLICATE_API_TOKEN;
if (!token) return 500;
```

```typescript
// generate-video/route.ts — сначала BYOK, потом env fallback ✅
const keyRecord = await db.userApiKey.findUnique({
  where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  select: { encryptedKey: true },
});
const replicateKey = keyRecord
  ? decrypt(keyRecord.encryptedKey)
  : (process.env.REPLICATE_API_TOKEN ?? '');
```

---

## Что нужно сделать

Файл: `src/app/api/generate-image/route.ts`

### Шаг 1: Убрать feature flag

Удалить строки 20-22:
```typescript
// УДАЛИТЬ ЭТО:
if (process.env.REPLICATE_ENABLED !== 'true') {
  return NextResponse.json({ error: 'Image generation is disabled' }, { status: 503 });
}
```

### Шаг 2: Добавить импорты для BYOK

Добавить в начало файла:
```typescript
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
```

### Шаг 3: Заменить auth на BYOK-first паттерн

Удалить:
```typescript
const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  return NextResponse.json({ error: 'Missing API token' }, { status: 500 });
}
```

Вместо этого, **после** блока auth (после `if (!session?.user?.id)`) добавить:
```typescript
// ── Replicate key: BYOK first, env fallback ─────────────────────────────────
const keyRecord = await db.userApiKey.findUnique({
  where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  select: { encryptedKey: true },
});
const token = keyRecord
  ? decrypt(keyRecord.encryptedKey)
  : (process.env.REPLICATE_API_TOKEN ?? '');
if (!token) {
  return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
}
```

### Шаг 4: Всё остальное оставить как есть

Не трогать:
- Honeypot check
- Rate limiting
- Spam check  
- Credit check & deduction
- Sharp resize pipeline
- Output format logic
- Replicate SDK call (`replicate.run('black-forest-labs/flux-schnell', ...)`)

---

## Финальный вид начала файла

```typescript
import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';

interface GenerateBody {
  prompt:         string;
  aspect_ratio?:  string;
  megapixels?:    string;
  target_width?:  number;
  target_height?: number;
  output_format?: 'webp' | 'png' | 'jpeg';
  website?:       string;
}

export async function POST(request: Request) {
  // ── Parse body (needed for honeypot — must come before auth) ──────────────────
  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Honeypot — silent reject (bot thinks it worked) ───────────────────────────
  if (body.website) {
    return NextResponse.json({ success: true });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Replicate key: BYOK first, env fallback ──────────────────────────────────
  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const token = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // ... остальной код без изменений (rate limit, spam, credits, replicate.run, sharp) ...
```

---

## Шаг 5: Также исправить StudioClient.tsx — BYOK image path

В `src/components/studio/StudioClient.tsx` есть BYOK branch для image generation (около строки 323-337) где `replicateDirectRun()` вызывает Replicate напрямую из браузера.

Это **вторая линия обороны** — даже если BYOK включён, лучше всегда ходить через сервер (как для video). Нужно:

Найти BYOK branch для image generation (примерно):
```typescript
if (byokConfig?.byok && byokConfig.apiKey && byokConfig.models) {
  const result = await replicateDirectRun(byokConfig.apiKey, { ... });
  // ...
}
```

**Заменить на серверный вызов** — вместо прямого вызова Replicate из браузера, всегда использовать `/api/generate-image`. BYOK ключ юзера уже лежит в DB, серверный роут его найдёт сам:

```typescript
// Всегда через сервер — убрать BYOK branch для image generation
const res = await fetch('/api/generate-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: finalPrompt,
    aspect_ratio,
    megapixels,
    target_width,
    target_height,
    output_format,
  }),
});
```

**НЕ трогать** BYOK direct path для remove-bg и upscale — они могут остаться browser-direct пока работают. Фокус только на image generation.

---

## Проверка

1. `pnpm dev`
2. Открыть Studio → попробовать сгенерировать изображение
3. Проверить что работает и с BYOK ключом, и без (с env var)
4. `npx tsc --noEmit`
5. Коммит: "fix: remove REPLICATE_ENABLED gate, add BYOK key lookup to image generation"

---

## НЕ делать

- Не трогать generate-video — он уже работает правильно
- Не трогать remove-bg, enhance-image, ai-edit routes (отдельная задача)
- Не менять Replicate model (flux-schnell)
- Не менять Sharp pipeline
- Не менять credit/rate-limit логику
