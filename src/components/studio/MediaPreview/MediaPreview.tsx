'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MediaPreview.module.css';

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  format: string;           // 'JPEG', 'PNG', 'WebP', 'CR2', 'MP4', etc.
  originalFormat?: string;  // Set when converted from RAW (e.g. 'CR2')
  width?: number;
  height?: number;
  fileSize?: number;        // bytes
  duration?: number;        // seconds, video only
  bitDepth?: number;        // 8 / 14 / 16 (RAW)
  label?: string;           // 'Original', 'Enhanced', 'Generated', etc.
}

interface Props {
  items: MediaItem[];
  initialIndex?: number;
  showInfo?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaPreview({ items, initialIndex = 0, showInfo = true }: Props) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const active = items[activeIndex];

  const prev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setActiveIndex((i) => Math.min(items.length - 1, i + 1)), [items.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, prev, next]);

  // Reset video when item changes inside lightbox
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [activeIndex]);

  if (!active) return null;

  const isVideo = active.type === 'video';

  return (
    <div className={styles.container}>
      {/* Thumbnail strip — only shown when more than one item */}
      {items.length > 1 && (
        <div className={styles.grid}>
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.thumb} ${idx === activeIndex ? styles.thumbActive : ''}`}
              onClick={() => { setActiveIndex(idx); setLightboxOpen(true); }}
            >
              {item.type === 'video' ? (
                <div className={styles.videoThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnailUrl ?? ''}
                    alt=""
                    className={styles.thumbImg}
                    style={{ display: item.thumbnailUrl ? 'block' : 'none' }}
                  />
                  {!item.thumbnailUrl && (
                    <div className={styles.videoPlaceholder} />
                  )}
                  <span className={styles.playIcon} aria-hidden="true">▶</span>
                  {item.duration !== undefined && (
                    <span className={styles.duration}>{Math.round(item.duration)}s</span>
                  )}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl ?? item.url} alt={item.label ?? ''} className={styles.thumbImg} />
              )}
              {item.label && <span className={styles.label}>{item.label}</span>}
              {item.originalFormat && (
                <span className={styles.rawBadge}>{item.originalFormat}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Single-item inline preview (click to open lightbox) */}
      <button
        type="button"
        className={styles.inlinePreview}
        onClick={() => setLightboxOpen(true)}
        aria-label="Open preview"
      >
        {isVideo ? (
          <video
            src={active.url}
            muted
            playsInline
            preload="metadata"
            className={styles.inlineVideo}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.url} alt={active.label ?? 'Preview'} className={styles.inlineImg} />
        )}
        <div className={styles.inlineOverlay} aria-hidden="true">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        {active.originalFormat && (
          <span className={styles.inlineRawBadge}>{active.originalFormat} → {active.format}</span>
        )}
      </button>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setLightboxOpen(false)}
              aria-label="Close preview"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {activeIndex > 0 && (
              <button type="button" className={styles.navLeft} onClick={prev} aria-label="Previous">‹</button>
            )}
            {activeIndex < items.length - 1 && (
              <button type="button" className={styles.navRight} onClick={next} aria-label="Next">›</button>
            )}

            <div className={styles.previewArea}>
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={active.url}
                  controls
                  autoPlay
                  playsInline
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
                {active.fileSize !== undefined && (
                  <span>{formatBytes(active.fileSize)}</span>
                )}
                {active.bitDepth !== undefined && <span>{active.bitDepth}-bit</span>}
                {active.duration !== undefined && <span>{active.duration.toFixed(1)}s</span>}
                {active.label && <span className={styles.infoLabel}>{active.label}</span>}
              </div>
            )}

            {items.length > 1 && (
              <div className={styles.counter}>{activeIndex + 1} / {items.length}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
