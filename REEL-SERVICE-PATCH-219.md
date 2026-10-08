# PROMPT-219: reel-service Backend Patch

Apply on the server in `~/reel-service/`.

---

## 1. Создать директорию и скачать треки

```bash
mkdir -p ~/reel-service/audio
cd ~/reel-service/audio
```

Скачай вручную 6 MP3 с Pixabay Music (royalty-free):
- `warm-cafe.mp3`       — acoustic, ~105 BPM, 20-30s
- `fresh-upbeat.mp3`    — happy/energetic, ~125 BPM
- `elegant-lounge.mp3`  — chill lounge, ~110 BPM
- `energetic-promo.mp3` — promotional, ~135 BPM
- `acoustic-natural.mp3`— folk/natural, ~100 BPM
- `modern-minimal.mp3`  — minimal electronic, ~115 BPM

Нормализуй громкость:
```bash
for f in ~/reel-service/audio/*.mp3; do
  ffmpeg -i "$f" -af loudnorm=I=-16:LRA=11:TP=-1.5 -y "${f%.mp3}_norm.mp3"
  mv "${f%.mp3}_norm.mp3" "$f"
done
```

---

## 2. Создать `~/reel-service/audio/music-catalog.json`

```json
[
  {"id":"warm-cafe","title":"Warm Café","emoji":"☕","mood":"cozy","category":["food","beauty"],"file":"warm-cafe.mp3","duration":25,"bpm":105,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false},
  {"id":"fresh-upbeat","title":"Fresh & Upbeat","emoji":"🍽","mood":"upbeat","category":["food","restaurant"],"file":"fresh-upbeat.mp3","duration":25,"bpm":125,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false},
  {"id":"elegant-lounge","title":"Elegant Lounge","emoji":"💎","mood":"elegant","category":["beauty","premium"],"file":"elegant-lounge.mp3","duration":25,"bpm":110,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false},
  {"id":"energetic-promo","title":"Energetic Promo","emoji":"⚡","mood":"energetic","category":["promo","restaurant"],"file":"energetic-promo.mp3","duration":25,"bpm":135,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false},
  {"id":"acoustic-natural","title":"Acoustic Natural","emoji":"🎸","mood":"natural","category":["bakery","handmade"],"file":"acoustic-natural.mp3","duration":25,"bpm":100,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false},
  {"id":"modern-minimal","title":"Modern Minimal","emoji":"✨","mood":"modern","category":["general","digital"],"file":"modern-minimal.mp3","duration":25,"bpm":115,"source":"pixabay","license":"Pixabay Content License","attributionRequired":false}
]
```

---

## 3. Обновить `src/routes/generate.js` (ADDITIVE)

Добавить в начало файла импорты (если ещё нет):
```js
const { readFileSync, existsSync, copyFileSync, createReadStream } = require('fs');
```

Добавить три новых endpoint'а ПОСЛЕ существующих роутов (но перед `module.exports`):

### GET /music/catalog
```js
router.get('/music/catalog', (req, res) => {
  const catalogPath = path.join(__dirname, '../../audio/music-catalog.json');
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    res.json({ tracks: catalog });
  } catch (err) {
    console.error('[music] Failed to read catalog:', err.message);
    res.json({ tracks: [] });
  }
});
```

### GET /music/preview
```js
router.get('/music/preview', (req, res) => {
  const { id } = req.query;
  const audioDir = path.join(__dirname, '../../audio');
  try {
    const catalog = JSON.parse(readFileSync(path.join(audioDir, 'music-catalog.json'), 'utf-8'));
    const track = catalog.find(t => t.id === id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    const filePath = path.join(audioDir, track.file);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### POST /remux
```js
router.post('/remux', async (req, res) => {
  const { jobId, musicTrackId, userId } = req.body;
  if (!jobId || !musicTrackId) {
    return res.status(400).json({ error: 'jobId and musicTrackId required' });
  }
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (job.status !== 'done') {
    return res.status(400).json({ error: 'Job not complete' });
  }

  const audioDir = path.join(__dirname, '../../audio');

  if (musicTrackId === 'no-music') {
    const outputPath = path.join(path.dirname(job.masterPath), 'reel-no-music.mp4');
    copyFileSync(job.masterPath, outputPath);
    job.videoPath = outputPath;
    job.currentTrackId = 'no-music';
    return res.json({ success: true, videoUrl: `/generate/video/${jobId}` });
  }

  try {
    const catalog = JSON.parse(readFileSync(path.join(audioDir, 'music-catalog.json'), 'utf-8'));
    const track = catalog.find(t => t.id === musicTrackId);
    if (!track) return res.status(400).json({ error: `Unknown track: ${musicTrackId}` });

    const trackPath = path.join(audioDir, track.file);
    if (!existsSync(trackPath)) {
      return res.status(500).json({ error: `Track file not found: ${track.file}` });
    }

    const outputPath = path.join(path.dirname(job.masterPath), `reel-${musicTrackId}.mp4`);
    await muxAudio(job.masterPath, trackPath, outputPath);
    job.videoPath = outputPath;
    job.currentTrackId = musicTrackId;
    console.log(`[${jobId}] Re-muxed with track: ${musicTrackId}`);
    res.json({ success: true, videoUrl: `/generate/video/${jobId}` });
  } catch (err) {
    console.error(`[${jobId}] Re-mux failed:`, err.message);
    res.status(500).json({ error: 'Re-mux failed' });
  }
});
```

Также в POST /generate handler найди строку где вызывается `runReelPipeline` и добавь `musicTrackId`:
```js
// Было:
const { photos, mode, cta1, cta2, userId } = req.body;
// Стало:
const { photos, mode, cta1, cta2, userId, musicTrackId } = req.body;

// В вызове runReelPipeline добавить:
runReelPipeline(jobId, { photos, mode, cta1, cta2, userId, musicTrackId: musicTrackId || 'warm-cafe' });
```

В GET /status/:jobId добавить `currentTrackId` в ответ:
```js
// В объект ответа:
currentTrackId: job.currentTrackId || 'warm-cafe',
```

---

## 4. Обновить `src/pipeline/reel-pipeline.js` (ADDITIVE)

В начале функции `runReelPipeline`, после получения `params`:
```js
const musicTrackId = params.musicTrackId || 'warm-cafe';
```

После того как создан `master-reel.mp4` (concat + CTA overlay), добавить:
```js
// Сохранить путь к silent master
const masterReelPath = path.join(outputDir, 'renders', 'master-reel.mp4');
job.masterPath = masterReelPath;

// Mux audio
const audioDir = path.join(__dirname, '../../audio');
let finalReelPath = masterReelPath;

if (musicTrackId !== 'no-music') {
  const { readFileSync, existsSync } = require('fs');
  const catalog = JSON.parse(readFileSync(path.join(audioDir, 'music-catalog.json'), 'utf-8'));
  const track = catalog.find(t => t.id === musicTrackId);
  const trackPath = track ? path.join(audioDir, track.file) : path.join(audioDir, 'warm-cafe.mp3');

  if (existsSync(trackPath)) {
    finalReelPath = path.join(outputDir, 'renders', `reel-${musicTrackId}.mp4`);
    await muxAudio(masterReelPath, trackPath, finalReelPath);
    job.currentTrackId = musicTrackId;
    console.log(`[${jobId}] Audio muxed: ${musicTrackId}`);
  } else {
    console.warn(`[${jobId}] Track not found: ${trackPath}, using silent reel`);
    job.currentTrackId = 'no-music';
  }
} else {
  job.currentTrackId = 'no-music';
}

job.videoPath = finalReelPath;
```

---

## 5. Рестарт PM2

```bash
pm2 restart reel-service
```

---

## 6. Тест

```bash
# Проверить каталог
curl http://127.0.0.1:3010/generate/music/catalog | jq '.tracks | length'
# Должно вернуть: 6

# Проверить preview
curl -I http://127.0.0.1:3010/generate/music/preview?id=warm-cafe
# Должно вернуть: Content-Type: audio/mpeg
```
