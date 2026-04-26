'use client';

import { useState } from 'react';
import styles from './TestImagePage.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'OG Image',     width: 1200, height: 630,  mode: 'og' },
  { label: 'Cover / Hero', width: 1440, height: 810,  mode: 'hero' },
  { label: 'Product',      width: 800,  height: 800,  mode: 'product' },
  { label: 'Story / Reel', width: 630,  height: 1120, mode: 'product' },
  { label: 'Blog Header',  width: 1440, height: 810,  mode: 'hero' },
  { label: 'Thumbnail',    width: 400,  height: 300,  mode: 'product' },
] as const;

const STYLE_TAGS = [
  'photorealistic', 'cinematic', 'studio lighting', 'soft natural light',
  'golden hour', 'minimalist', 'dark moody', 'flat lay', 'bokeh background',
  '8K ultra detail', 'commercial', 'editorial',
];

const ENHANCE_MODES = [
  { value: 'og',       label: '📣 OG / Social banner' },
  { value: 'hero',     label: '🎯 Hero / Landing page' },
  { value: 'product',  label: '🛍 E-commerce product photo' },
  { value: 'interior', label: '🏠 Interior / Place atmosphere' },
  { value: 'food',     label: '🍽 Food / Menu photography' },
  { value: 'abstract', label: '✨ Abstract / Decorative' },
];

const OUTPUT_FORMATS = ['webp', 'png', 'jpeg'] as const;
type OutputFormat = typeof OUTPUT_FORMATS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function getPreviewDims(w: number, h: number, maxW = 44, maxH = 30) {
  const ratio = w / h;
  if (ratio > maxW / maxH) {
    return { width: maxW, height: Math.round(maxW / ratio) };
  }
  return { width: Math.round(maxH * ratio), height: maxH };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageMeta {
  w:      number;
  h:      number;
  fmt:    OutputFormat;
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestImagePage() {
  const [prompt,          setPrompt]          = useState('');
  const [enhancedPrompt,  setEnhancedPrompt]  = useState<string | null>(null);
  const [activePreset,    setActivePreset]    = useState<number | null>(0);
  const [width,           setWidth]           = useState(1200);
  const [height,          setHeight]          = useState(630);
  const [format,          setFormat]          = useState<OutputFormat>('webp');
  const [activeTags,      setActiveTags]      = useState<Set<string>>(new Set());
  const [enhanceMode,     setEnhanceMode]     = useState('og');
  const [enhancing,       setEnhancing]       = useState(false);
  const [generating,      setGenerating]      = useState(false);
  const [imageUrl,        setImageUrl]        = useState<string | null>(null);
  const [imageMeta,       setImageMeta]       = useState<ImageMeta | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  function selectPreset(i: number) {
    const p = PRESETS[i];
    setActivePreset(i);
    setWidth(p.width);
    setHeight(p.height);
    setEnhanceMode(p.mode);
    setEnhancedPrompt(null);
  }

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  async function handleEnhance() {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    setError(null);
    try {
      const res  = await fetch('/api/enhance-prompt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, enhanceMode, styleTags: [...activeTags], width, height }),
      });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok || !data.enhanced) throw new Error(data.error ?? 'Enhancement failed');
      setEnhancedPrompt(data.enhanced);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  }

  async function handleGenerate() {
    const finalPrompt = (enhancedPrompt ?? prompt).trim();
    if (!finalPrompt || generating) return;
    setGenerating(true);
    setError(null);
    setImageUrl(null);
    setImageMeta(null);
    try {
      const res = await fetch('/api/generate-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, width, height, output_format: format }),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? 'Generation failed');
      }

      let url: string;
      if (format === 'jpeg') {
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
      } else {
        const data = await res.json() as { url?: string };
        if (!data.url) throw new Error('No image URL in response');
        url = data.url;
      }

      setImageUrl(url);
      setImageMeta({
        w: width, h: height, fmt: format,
        label: activePreset !== null ? PRESETS[activePreset].label : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(url: string, meta: ImageMeta) {
    try {
      const res    = await fetch(url);
      const blob   = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = `flux-image-${Date.now()}.${meta.fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // silent — image is still visible in the preview
    }
  }

  const canGenerate = !generating && !!(enhancedPrompt?.trim() ?? prompt.trim());

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 1.5L8.3 4.9 12 5.8l-2.6 2.5.6 3.6L7 10.1l-3 1.8.6-3.6L2 5.8l3.7-.9L7 1.5z"
                fill="white"
              />
            </svg>
          </div>
          <span className={styles.title}>Image Studio</span>
          <span className={styles.badge}>DEV</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.endpoint}>/api/generate-image</span>
          <span className={styles.modelInfo}>flux-schnell · replicate</span>
        </div>
      </header>

      <div className={styles.main}>

        {/* ── Controls sidebar ── */}
        <aside className={styles.controls}>

          {/* Image Type Presets */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Image Type</div>
            <div className={styles.presets}>
              {PRESETS.map((p, i) => {
                const dims = getPreviewDims(p.width, p.height);
                return (
                  <button
                    key={p.label}
                    className={cx(styles.presetBtn, activePreset === i && styles.presetActive)}
                    onClick={() => selectPreset(i)}
                    type="button"
                  >
                    <div className={styles.previewBox}>
                      <div
                        className={styles.previewRect}
                        style={{ width: dims.width, height: dims.height }}
                      />
                    </div>
                    <span className={styles.presetLabel}>{p.label}</span>
                    <span className={styles.presetDims}>{p.width}×{p.height}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Prompt */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Prompt</div>
            <textarea
              className={styles.textarea}
              placeholder="A modern barbershop interior, warm lighting, wooden accents, minimalist style…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </section>

          {/* Claude Enhance */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Enhance Mode</div>
            <select
              className={styles.select}
              value={enhanceMode}
              onChange={e => setEnhanceMode(e.target.value)}
            >
              {ENHANCE_MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button
              className={styles.enhanceBtn}
              onClick={handleEnhance}
              disabled={!prompt.trim() || enhancing}
              type="button"
            >
              {enhancing
                ? <><div className={styles.spinner} />Enhancing…</>
                : <>✦ Enhance with Claude</>
              }
            </button>
            {enhancedPrompt && (
              <div className={styles.enhancedBox}>
                <div className={styles.enhancedHeader}>
                  <div className={styles.enhancedDot} />
                  <span className={styles.enhancedHeaderLabel}>Enhanced Prompt</span>
                  <button
                    className={styles.clearBtn}
                    onClick={() => setEnhancedPrompt(null)}
                    type="button"
                    title="Clear enhanced prompt"
                  >✕</button>
                </div>
                <p className={styles.enhancedText}>{enhancedPrompt}</p>
              </div>
            )}
          </section>

          {/* Style Modifiers */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Style Modifiers</div>
            <div className={styles.tags}>
              {STYLE_TAGS.map(tag => (
                <button
                  key={tag}
                  className={cx(styles.tag, activeTags.has(tag) && styles.tagActive)}
                  onClick={() => toggleTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>

          {/* Output Format */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Output Format</div>
            <div className={styles.formatGroup}>
              {OUTPUT_FORMATS.map(f => (
                <button
                  key={f}
                  className={cx(styles.formatBtn, format === f && styles.formatActive)}
                  onClick={() => setFormat(f)}
                  type="button"
                >
                  {f}
                </button>
              ))}
            </div>
          </section>

          {/* Size */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Size</div>
            <div className={styles.sizeRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Width</label>
                <input
                  type="number"
                  className={styles.input}
                  value={width}
                  min={256}
                  max={1440}
                  step={64}
                  onChange={e => { setWidth(Number(e.target.value)); setActivePreset(null); }}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Height</label>
                <input
                  type="number"
                  className={styles.input}
                  value={height}
                  min={256}
                  max={1440}
                  step={64}
                  onChange={e => { setHeight(Number(e.target.value)); setActivePreset(null); }}
                />
              </div>
            </div>
          </section>

          {/* Error */}
          {error && <div className={styles.error}>{error}</div>}

          {/* Generate */}
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={!canGenerate}
            type="button"
          >
            {generating ? (
              <><div className={styles.spinnerWhite} />Generating…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 7.5h10M9 4l3.5 3.5L9 11"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Generate Image
              </>
            )}
          </button>

        </aside>

        {/* ── Result panel ── */}
        <main className={styles.result}>

          {generating && (
            <div className={styles.loadingArea}>
              <div className={styles.loadingSpinner} />
              <span>Generating {width}×{height} · {format}…</span>
            </div>
          )}

          {!generating && !imageUrl && (
            <div className={styles.placeholder}>
              <svg
                className={styles.placeholderIcon}
                width="52"
                height="52"
                viewBox="0 0 52 52"
                fill="none"
                aria-hidden="true"
              >
                <rect x="6" y="11" width="40" height="30" rx="4" stroke="#1e293b" strokeWidth="2" />
                <circle cx="17" cy="21" r="4.5" stroke="#1e293b" strokeWidth="2" />
                <path
                  d="M6 35l11-9 8 8 6-6 9 7 6-4"
                  stroke="#1e293b"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={styles.placeholderText}>Your image will appear here</span>
            </div>
          )}

          {!generating && imageUrl && imageMeta && (
            <div className={styles.resultWrap}>
              <img
                src={imageUrl}
                alt="Generated"
                className={styles.resultImg}
              />
              <div className={styles.resultMeta}>
                <div className={styles.metaInfo}>
                  <span className={styles.metaTag}>{imageMeta.w}×{imageMeta.h}</span>
                  <span className={styles.metaDot}>·</span>
                  <span className={styles.metaTag}>{imageMeta.fmt}</span>
                  {imageMeta.label && (
                    <>
                      <span className={styles.metaDot}>·</span>
                      <span className={styles.metaTag}>
                        {imageMeta.label.toLowerCase().replace(/[\s/]+/g, '-')}
                      </span>
                    </>
                  )}
                </div>
                <button
                  className={styles.downloadBtn}
                  onClick={() => handleDownload(imageUrl, imageMeta)}
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M6 1v7M3 5.5l3 3 3-3M1 11h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Download {imageMeta.fmt.toUpperCase()}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
