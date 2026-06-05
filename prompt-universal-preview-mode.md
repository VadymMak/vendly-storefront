# Prompt: Universal Media Preview Mode for Studio

## Goal
Add a universal preview component to the Studio that can display ALL supported media formats: images (JPEG, PNG, WebP, GIF, and converted RAW), videos (MP4, WebM, QuickTime), and generated content (Flux images, Kling videos). Users should be able to preview any file before and after processing.

## Context
- Project: vendly-storefront (Next.js 15, App Router)
- Current state: SlideshowCreator has inline preview for images/videos, but no standalone preview component
- StudioClient.tsx (1689 lines) manages all studio tools — generated images/videos show in result areas
- Generated content URLs come from Replicate CDN or Vercel Blob
- CSS Modules for template components (not Tailwind)
- DB import: `import { db } from '@/lib/db'`

## What "Preview Mode" Means
1. **Gallery view**: All uploaded/generated media in a grid with thumbnails
2. **Lightbox**: Click any item to see full-size preview with format info overlay
3. **Format info**: Show original format, dimensions, file size, bit depth (for RAW), duration (for video)
4. **Before/After**: For enhanced images — show original vs. enhanced side by side
5. **Video player**: Native HTML5 video player with controls for MP4/WebM

## Implementation

### Step 1: Create MediaPreview component
Create `src/components/studio/MediaPreview/MediaPreview.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './MediaPreview.module.css';

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;  // For videos — first frame
  type: 'image' | 'video';
  format: string;          // 'JPEG', 'PNG', 'WebP', 'CR2', 'MP4', etc.
  originalFormat?: string; // If converted from RAW
  width?: number;
  height?: number;
  fileSize?: number;       // bytes
  duration?: number;       // seconds (video only)
  bitDepth?: number;       // 8, 14, 16 (RAW)
  createdAt?: string;
  label?: string;          // 'Original', 'Enhanced', 'Generated', etc.
}

interface Props {
  items: MediaItem[];
  onClose?: () => void;
  initialIndex?: number;
  showInfo?: boolean;
}

export default function MediaPreview({ items, onClose, initialIndex = 0, showInfo = true }: Props) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const active = items[activeIndex];
  if (!active) return null;

  const isVideo = active.type === 'video';
  const isRawConverted = !!active.originalFormat;

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') setActiveIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex(i => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, items.length]);

  return (
    <div className={styles.container}>
      {/* Thumbnail Grid */}
      <div className={styles.grid}>
        {items.map((item, idx) => (
          <button
            key={item.id}
            className={`${styles.thumb} ${idx === activeIndex ? styles.thumbActive : ''}`}
            onClick={() => { setActiveIndex(idx); setLightboxOpen(true); }}
          >
            {item.type === 'video' ? (
              <div className={styles.videoThumb}>
                <video src={item.url} muted preload="metadata" />
                <span className={styles.playIcon}>▶</span>
                {item.duration && (
                  <span className={styles.duration}>
                    {Math.floor(item.duration)}s
                  </span>
                )}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl ?? item.url} alt={item.label ?? ''} />
            )}
            {item.label && <span className={styles.label}>{item.label}</span>}
            {item.originalFormat && (
              <span className={styles.rawBadge}>{item.originalFormat}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
          <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button className={styles.closeBtn} onClick={() => setLightboxOpen(false)}>
              ✕
            </button>

            {/* Navigation arrows */}
            {activeIndex > 0 && (
              <button className={styles.navLeft} onClick={() => setActiveIndex(i => i - 1)}>
                ‹
              </button>
            )}
            {activeIndex < items.length - 1 && (
              <button className={styles.navRight} onClick={() => setActiveIndex(i => i + 1)}>
                ›
              </button>
            )}

            {/* Main preview */}
            <div className={styles.previewArea}>
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={active.url}
                  controls
                  autoPlay
                  className={styles.videoPlayer}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.url}
                  alt={active.label ?? 'Preview'}
                  className={styles.previewImg}
                />
              )}
            </div>

            {/* Info overlay */}
            {showInfo && (
              <div className={styles.infoBar}>
                <span className={styles.infoFormat}>
                  {active.originalFormat
                    ? `${active.originalFormat} → ${active.format}`
                    : active.format}
                </span>
                {active.width && active.height && (
                  <span>{active.width} × {active.height}</span>
                )}
                {active.fileSize && (
                  <span>{(active.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                )}
                {active.bitDepth && <span>{active.bitDepth}-bit</span>}
                {active.duration && <span>{active.duration.toFixed(1)}s</span>}
                {active.label && <span className={styles.infoLabel}>{active.label}</span>}
              </div>
            )}

            {/* Counter */}
            <div className={styles.counter}>
              {activeIndex + 1} / {items.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 2: Create CSS Module
Create `src/components/studio/MediaPreview/MediaPreview.module.css`:

```css
.container {
  width: 100%;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  background: #1a1a1a;
  transition: border-color 0.2s;
}
.thumb:hover { border-color: rgba(255,255,255,0.3); }
.thumbActive { border-color: #3b82f6; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }

.videoThumb { position: relative; width: 100%; height: 100%; }
.videoThumb video { width: 100%; height: 100%; object-fit: cover; }
.playIcon {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.6); color: white;
  border-radius: 50%; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.duration {
  position: absolute; bottom: 4px; right: 4px;
  background: rgba(0,0,0,0.7); color: white;
  font-size: 11px; padding: 1px 5px; border-radius: 4px;
}

.label {
  position: absolute; bottom: 4px; left: 4px;
  background: rgba(0,0,0,0.7); color: white;
  font-size: 10px; padding: 1px 5px; border-radius: 4px;
  text-transform: uppercase;
}
.rawBadge {
  position: absolute; top: 4px; right: 4px;
  background: #f97316; color: white;
  font-size: 9px; padding: 1px 4px; border-radius: 3px;
  font-weight: 700;
}

/* Lightbox */
.lightbox {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.95);
  display: flex; align-items: center; justify-content: center;
}
.lightboxContent {
  position: relative;
  max-width: 95vw; max-height: 95vh;
  display: flex; flex-direction: column; align-items: center;
}

.closeBtn {
  position: absolute; top: -40px; right: 0;
  background: none; border: none; color: white;
  font-size: 24px; cursor: pointer; z-index: 10;
}
.navLeft, .navRight {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,0.1); border: none; color: white;
  font-size: 32px; padding: 8px 12px; cursor: pointer;
  border-radius: 8px; z-index: 10;
}
.navLeft { left: -60px; }
.navRight { right: -60px; }
.navLeft:hover, .navRight:hover { background: rgba(255,255,255,0.2); }

.previewArea {
  max-width: 90vw; max-height: 80vh;
  display: flex; align-items: center; justify-content: center;
}
.previewImg {
  max-width: 100%; max-height: 80vh; object-fit: contain;
  border-radius: 4px;
}
.videoPlayer {
  max-width: 90vw; max-height: 75vh; border-radius: 4px;
  background: #000;
}

.infoBar {
  display: flex; gap: 16px; margin-top: 12px;
  color: rgba(255,255,255,0.7); font-size: 13px;
  background: rgba(255,255,255,0.05);
  padding: 8px 16px; border-radius: 8px;
}
.infoFormat { color: #3b82f6; font-weight: 600; }
.infoLabel { color: #f97316; }

.counter {
  margin-top: 8px; color: rgba(255,255,255,0.5); font-size: 12px;
}
```

### Step 3: Create index export
Create `src/components/studio/MediaPreview/index.ts`:
```typescript
export { default as MediaPreview } from './MediaPreview';
export type { MediaItem } from './MediaPreview';
```

### Step 4: Integrate into StudioClient.tsx
File: `src/app/studio/StudioClient.tsx`

In the existing result display areas, replace plain `<img>` and `<video>` tags with MediaPreview:

```typescript
import { MediaPreview, MediaItem } from '@/components/studio/MediaPreview';

// When displaying generated results, build MediaItem array:
const previewItems: MediaItem[] = [];

// For generated image:
if (generatedImageUrl) {
  previewItems.push({
    id: 'generated-image',
    url: generatedImageUrl,
    type: 'image',
    format: 'PNG',
    label: 'Generated',
  });
}

// For generated video:
if (generatedVideoUrl) {
  previewItems.push({
    id: 'generated-video',
    url: generatedVideoUrl,
    type: 'video',
    format: 'MP4',
    duration: videoDuration,
    label: 'Generated',
  });
}

// For enhanced image (before/after):
if (enhancedUrl && originalUrl) {
  previewItems.push(
    { id: 'original', url: originalUrl, type: 'image', format: 'PNG', label: 'Original' },
    { id: 'enhanced', url: enhancedUrl, type: 'image', format: 'PNG', label: 'Enhanced' },
  );
}

// Render:
<MediaPreview items={previewItems} showInfo />
```

### Step 5: Add to SlideshowCreator
File: `src/components/studio/SlideshowCreator.tsx`

After the slideshow is rendered (the Canvas produces a video blob):
```typescript
// Preview the rendered slideshow video
const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

// After render completes:
const videoBlob = /* ... existing render result ... */;
setRenderedVideoUrl(URL.createObjectURL(videoBlob));

// In JSX:
{renderedVideoUrl && (
  <MediaPreview
    items={[{
      id: 'slideshow-result',
      url: renderedVideoUrl,
      type: 'video',
      format: 'MP4',
      label: 'Slideshow',
    }]}
  />
)}
```

### Step 6: Video format support verification
Ensure the video player handles all formats:
- MP4 (H.264) — universal
- WebM (VP8/VP9) — Chrome/Firefox
- QuickTime (MOV) — may need conversion for non-Safari browsers

For MOV files, add a note or auto-convert:
```typescript
// If browser can't play MOV, show a message:
const canPlayMov = videoRef.current?.canPlayType('video/quicktime') !== '';
if (!canPlayMov && active.format === 'MOV') {
  // Show: "QuickTime format — converting for preview..."
  // Or: "Download to view in your video player"
}
```

### Step 7: Type check
```bash
npx tsc --noEmit
```

## File Changes Summary
1. NEW: `src/components/studio/MediaPreview/MediaPreview.tsx` — Universal preview component
2. NEW: `src/components/studio/MediaPreview/MediaPreview.module.css` — Styles
3. NEW: `src/components/studio/MediaPreview/index.ts` — Export
4. EDIT: `src/app/studio/StudioClient.tsx` — Replace inline previews with MediaPreview
5. EDIT: `src/components/studio/SlideshowCreator.tsx` — Add preview for rendered output

## UX Notes
- Lightbox opens on click, closes on Escape or clicking outside
- Arrow keys navigate between items
- Video auto-plays in lightbox with controls
- RAW files show orange badge with original format name
- Info bar shows dimensions, size, format, bit depth
- Grid adapts to container width (responsive)
