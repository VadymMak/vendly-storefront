'use client';

import { useState, type ChangeEvent } from 'react';
import styles from './TestImagePage.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_MAP = {
  og:      { label: 'OG Image',     display: '1200 × 630',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1200, target_height: 630  },
  cover:   { label: 'Cover / Hero', display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  product: { label: 'Product',      display: '800 × 800',   aspect_ratio: '1:1',  megapixels: '1',    target_width: 800,  target_height: 800  },
  story:   { label: 'Story / Reel', display: '630 × 1120',  aspect_ratio: '9:16', megapixels: '1',    target_width: 630,  target_height: 1120 },
  blog:    { label: 'Blog Header',  display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  thumb:   { label: 'Thumbnail',    display: '400 × 300',   aspect_ratio: '4:3',  megapixels: '0.25', target_width: 400,  target_height: 300  },
} as const;

type PresetKey = keyof typeof PRESET_MAP;

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

const ENHANCE_PHOTO_TYPES = [
  { value: 'sharpen',  label: 'Sharpen & Denoise', desc: 'Remove noise, sharpen edges' },
  { value: 'brighten', label: 'Brighten',          desc: 'Increase exposure'           },
  { value: 'upscale',  label: 'Upscale 4×',        desc: 'Upscale 4×'                  },
  { value: 'portrait', label: 'Portrait',           desc: 'Portrait enhance'            },
] as const;

type EnhancePhotoType = typeof ENHANCE_PHOTO_TYPES[number]['value'];

type ActiveTab = 'generate' | 'enhance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function aspectToPreviewDims(ratio: string, maxW = 44, maxH = 30) {
  const [a, b] = ratio.split(':').map(Number);
  const r = a / b;
  if (r > maxW / maxH) return { width: maxW, height: Math.round(maxW / r) };
  return { width: Math.round(maxH * r), height: maxH };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageMeta {
  display: string;
  ratio:   string;
  fmt:     OutputFormat;
  label:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestImagePage() {
  const [activeTab,       setActiveTab]       = useState<ActiveTab>('generate');

  // Generate tab state
  const [prompt,         setPrompt]         = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('og');
  const [outputFormat,   setOutputFormat]   = useState<OutputFormat>('webp');
  const [activeTags,     setActiveTags]     = useState<Set<string>>(new Set());
  const [enhanceMode,    setEnhanceMode]    = useState('og');
  const [enhancing,      setEnhancing]      = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [imageUrl,       setImageUrl]       = useState<string | null>(null);
  const [imageMeta,      setImageMeta]      = useState<ImageMeta | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  // Enhance photo tab state
  const [enhanceFile,    setEnhanceFile]    = useState<File | null>(null);
  const [enhancePreview, setEnhancePreview] = useState<string | null>(null);
  const [enhanceType,    setEnhanceType]    = useState<EnhancePhotoType>('sharpen');
  const [enhanceResult,  setEnhanceResult]  = useState<string | null>(null);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceError,   setEnhanceError]   = useState<string | null>(null);

  // ── Generate tab functions ────────────────────────────────────────────────

  function selectPreset(key: PresetKey) {
    setSelectedPreset(key);
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
        body: JSON.stringify({ prompt, enhanceMode, styleTags: [...activeTags] }),
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

    const preset = PRESET_MAP[selectedPreset];
    console.log('Generating with:', { preset: selectedPreset, ...preset, format: outputFormat });

    setGenerating(true);
    setError(null);
    setImageUrl(null);
    setImageMeta(null);
    try {
      const res = await fetch('/api/generate-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:         finalPrompt,
          aspect_ratio:   preset.aspect_ratio,
          megapixels:     preset.megapixels,
          target_width:   preset.target_width,
          target_height:  preset.target_height,
          output_format:  outputFormat,
        }),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? 'Generation failed');
      }

      // API always returns binary — blob URL works for all formats
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      setImageUrl(url);
      setImageMeta({
        display: preset.display,
        ratio:   preset.aspect_ratio,
        fmt:     outputFormat,
        label:   preset.label,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(url: string, meta: ImageMeta) {
    try {
      const res     = await fetch(url);
      const blob    = await res.blob();
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

  // ── Enhance photo tab functions ───────────────────────────────────────────

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setEnhanceFile(file);
    setEnhanceResult(null);
    setEnhanceError(null);
    if (file) {
      setEnhancePreview(URL.createObjectURL(file));
    } else {
      setEnhancePreview(null);
    }
  }

  async function handleEnhancePhoto() {
    if (!enhanceFile || enhanceLoading) return;
    setEnhanceLoading(true);
    setEnhanceError(null);
    setEnhanceResult(null);
    try {
      const fd = new FormData();
      fd.append('image', enhanceFile);
      fd.append('type', enhanceType);
      const res  = await fetch('/api/enhance-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (!data.url) throw new Error('No URL returned');
      setEnhanceResult(data.url);
    } catch (e) {
      setEnhanceError(e instanceof Error ? e.message : 'Error');
    } finally {
      setEnhanceLoading(false);
    }
  }

  async function downloadEnhanced(url: string) {
    try {
      const res     = await fetch(url);
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = `enhanced-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // silent
    }
  }

  const canGenerate      = !generating && !!(enhancedPrompt?.trim() ?? prompt.trim());
  const activePresetData = PRESET_MAP[selectedPreset];

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
          <span className={styles.endpoint}>
            {activeTab === 'generate' ? '/api/generate-image' : '/api/enhance-image'}
          </span>
          <span className={styles.modelInfo}>
            {activeTab === 'generate' ? 'flux-schnell · replicate' : 'real-esrgan · replicate'}
          </span>
        </div>
      </header>

      <div className={styles.main}>

        {/* ── Controls sidebar ── */}
        <aside className={styles.controls}>

          {/* Tab switcher */}
          <div className={styles.tabs}>
            <button
              className={cx(styles.tabBtn, activeTab === 'generate' && styles.tabActive)}
              onClick={() => setActiveTab('generate')}
              type="button"
            >
              Generate
            </button>
            <button
              className={cx(styles.tabBtn, activeTab === 'enhance' && styles.tabActive)}
              onClick={() => setActiveTab('enhance')}
              type="button"
            >
              Enhance Photo
            </button>
          </div>

          {/* ── Generate tab content ── */}
          {activeTab === 'generate' && (
            <>
              {/* Image Type Presets */}
              <section className={styles.section}>
                <div className={styles.sectionLabel}>Image Type</div>
                <div className={styles.presets}>
                  {(Object.entries(PRESET_MAP) as [PresetKey, typeof PRESET_MAP[PresetKey]][]).map(([key, p]) => {
                    const dims = aspectToPreviewDims(p.aspect_ratio);
                    return (
                      <button
                        key={key}
                        className={cx(styles.presetBtn, selectedPreset === key && styles.presetActive)}
                        onClick={() => selectPreset(key)}
                        type="button"
                      >
                        <div className={styles.previewBox}>
                          <div
                            className={styles.previewRect}
                            style={{ width: dims.width, height: dims.height }}
                          />
                        </div>
                        <span className={styles.presetLabel}>{p.label}</span>
                        <span className={styles.presetDims}>{p.display}</span>
                        <span className={styles.presetDims}>{p.aspect_ratio} · {p.megapixels}MP</span>
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
                      className={cx(styles.formatBtn, outputFormat === f && styles.formatActive)}
                      onClick={() => setOutputFormat(f)}
                      type="button"
                    >
                      {f}
                    </button>
                  ))}
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
            </>
          )}

          {/* ── Enhance photo tab content ── */}
          {activeTab === 'enhance' && (
            <>
              {/* File upload */}
              <section className={styles.section}>
                <div className={styles.sectionLabel}>Upload photo</div>
                <input
                  id="enhance-file-input"
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                />
                {!enhancePreview ? (
                  <label htmlFor="enhance-file-input" className={styles.fileLabel}>
                    <svg
                      className={styles.fileLabelIcon}
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M14 3v16M9 8l5-5 5 5"
                        stroke="#64748b"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4 20v4h20v-4"
                        stroke="#64748b"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Choose a photo to enhance</span>
                    <span className={styles.fileLabelSubtext}>JPEG · PNG · WEBP</span>
                  </label>
                ) : (
                  <div className={styles.filePreviewWrap}>
                    <img src={enhancePreview} alt="Preview" className={styles.filePreview} />
                    <span className={styles.filePreviewName}>{enhanceFile?.name}</span>
                    <label htmlFor="enhance-file-input" className={styles.changeFileBtn}>
                      Change photo
                    </label>
                  </div>
                )}
              </section>

              {/* Enhancement type */}
              <section className={styles.section}>
                <div className={styles.sectionLabel}>Enhancement Type</div>
                <div className={styles.enhanceTypes}>
                  {ENHANCE_PHOTO_TYPES.map(t => (
                    <button
                      key={t.value}
                      className={cx(
                        styles.enhanceTypeItem,
                        enhanceType === t.value && styles.enhanceTypeItemActive,
                      )}
                      onClick={() => setEnhanceType(t.value)}
                      type="button"
                    >
                      <div className={cx(
                        styles.enhanceTypeRadio,
                        enhanceType === t.value && styles.enhanceTypeRadioActive,
                      )}>
                        {enhanceType === t.value && <div className={styles.enhanceTypeRadioInner} />}
                      </div>
                      <div className={styles.enhanceTypeText}>
                        <span className={styles.enhanceTypeName}>{t.label}</span>
                        <span className={styles.enhanceTypeDesc}>{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Error */}
              {enhanceError && <div className={styles.error}>{enhanceError}</div>}

              {/* Enhance button */}
              <button
                className={styles.enhancePhotoBtn}
                onClick={handleEnhancePhoto}
                disabled={!enhanceFile || enhanceLoading}
                type="button"
              >
                {enhanceLoading ? (
                  <><div className={styles.spinnerCyan} />Processing…</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                      <path
                        d="M7.5 1.5v3M7.5 10.5v3M1.5 7.5h3M10.5 7.5h3M3.4 3.4l2.1 2.1M9.5 9.5l2.1 2.1M3.4 11.6l2.1-2.1M9.5 5.5l2.1-2.1"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    Enhance Photo
                  </>
                )}
              </button>
            </>
          )}

        </aside>

        {/* ── Result panel ── */}
        <main className={styles.result}>

          {/* Generate tab results */}
          {activeTab === 'generate' && (
            <>
              {generating && (
                <div className={styles.loadingArea}>
                  <div className={styles.loadingSpinner} />
                  <span>Generating {activePresetData.display} · {activePresetData.aspect_ratio} · {outputFormat}…</span>
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
                      <span className={styles.metaTag}>{imageMeta.display}</span>
                      <span className={styles.metaDot}>·</span>
                      <span className={styles.metaTag}>{imageMeta.ratio}</span>
                      <span className={styles.metaDot}>·</span>
                      <span className={styles.metaTag}>{imageMeta.fmt}</span>
                      <span className={styles.metaDot}>·</span>
                      <span className={styles.metaTag}>
                        {imageMeta.label.toLowerCase().replace(/[\s/]+/g, '-')}
                      </span>
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
            </>
          )}

          {/* Enhance tab results */}
          {activeTab === 'enhance' && (
            <>
              {enhanceLoading && (
                <div className={styles.loadingArea}>
                  <div className={styles.loadingSpinner} />
                  <span>Processing image…</span>
                </div>
              )}

              {!enhanceLoading && !enhanceResult && (
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
                    <path
                      d="M18 26l6 6 10-12"
                      stroke="#1e293b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={styles.placeholderText}>Result will appear here</span>
                </div>
              )}

              {!enhanceLoading && enhanceResult && enhancePreview && (
                <div className={styles.compareWrap}>
                  <div className={styles.comparePane}>
                    <div className={styles.compareLabel}>Original</div>
                    <img src={enhancePreview} alt="Original" className={styles.compareImg} />
                  </div>
                  <div className={styles.comparePane}>
                    <div className={styles.compareLabel}>Result</div>
                    <img src={enhanceResult} alt="Enhanced" className={styles.compareImg} />
                    <div className={styles.compareMeta}>
                      <button
                        className={styles.downloadBtn}
                        onClick={() => downloadEnhanced(enhanceResult)}
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
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
  );
}
