# Промпт для Claude Code: Fix Text-to-Video (start frame CORS)

## Проблема

Text-to-video не работает — network error. Image-to-video работает нормально.

**Причина:** text-to-video сначала генерирует start frame (изображение из текста), и этот вызов идёт через `replicateDirectRun()` напрямую из браузера к `api.replicate.com` — CORS блокирует.

Точно та же проблема что была с image generation (fix уже сделан в коммите 304b8fe). Теперь нужен такой же fix для start frame.

## Что менять

Файл: `src/app/studio/StudioClient.tsx`

### Найти BYOK direct path для start frame generation

Около строки 733 (или рядом) есть код вроде:
```typescript
// BYOK path for text-to-video start frame
const result = await replicateDirectRun(byokConfig.apiKey, {
  model: byokConfig.models.startFrame,
  // ...
});
```

### Заменить на серверный вызов

Вместо прямого вызова `replicateDirectRun()` из браузера — вызывать `/api/generate-start-frame` серверный роут.

Серверный роут уже существует (`src/app/api/generate-start-frame/route.ts`) и:
- ✅ Ищет BYOK ключ юзера из DB (как generate-video)
- ✅ Fallback на REPLICATE_API_TOKEN
- ✅ Retry logic (429 handling)
- ✅ `Prefer: wait` для быстрого ответа
- ✅ Принимает `{ prompt, aspectRatio }` в body

Замена должна выглядеть примерно так:
```typescript
// Вместо replicateDirectRun() — всегда через сервер
const res = await fetch('/api/generate-start-frame', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: finalPrompt,
    aspectRatio: aspectRatio,  // '9:16', '1:1', или '16:9'
  }),
});

if (!res.ok) {
  const err = await res.json();
  throw new Error(err.error ?? 'Start frame generation failed');
}

const data = await res.json();

if (data.url) {
  // Synchronous result — use the URL directly as start image for video
  startImageUrl = data.url;
} else if (data.jobId) {
  // Async fallback — poll job status
  // Handle async case if needed
}
```

Затем передать `startImageUrl` в вызов `/api/generate-video` как раньше.

### Важно

- **НЕ трогать** image-to-video path — он уже работает (юзер выбирает картинку → `/api/generate-video`)
- **НЕ трогать** BYOK direct paths для remove-bg и upscale (отдельная задача)
- **НЕ трогать** серверный роут `/api/generate-start-frame` — он уже правильный
- Убедиться что `aspectRatio` правильно передаётся (формат: '9:16', '1:1', '16:9')

## Проверка

1. `pnpm dev`
2. Открыть Studio → Text-to-Video → ввести промпт → Generate
3. Должно: сгенерировать start frame через сервер → затем создать видео
4. `npx tsc --noEmit`
5. Коммит: "fix: route text-to-video start frame through server to avoid CORS block"
