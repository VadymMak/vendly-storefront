'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { downloadImage, extFromMime, proxyUrl, saveBlob } from '@/lib/studio/mobile/share';
import { PLATFORM_IMAGE_PRESETS, STYLE_CHIPS } from '@/lib/studio/constants';
import { MobileTextOverlayEditor } from './MobileTextOverlayEditor';
import { MobileResizeCropper } from './MobileResizeCropper';
import { ImproveBottomSheet } from './ImproveBottomSheet';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import type { GenerationMode } from '@/lib/types';

interface JobData {
  id: string;
  outputUrl: string | null;
  status: string;
  prompt?: string | null;
  modelUsed?: string | null;
  createdAt: Date;
}

interface InlineResult {
  imageUrl: string;
  prompt?: string;
  /** What the user typed — `prompt` also carries the style prefix */
  description?: string;
  model?: string;
  presetId?: string;
  styleId?: string;
  referenceImageUrl?: string;
  generationMode?: GenerationMode;
}

interface Props {
  job?: JobData;
  inlineResult?: InlineResult;
  onBack?: () => void;
  onRegenerate?: () => void;
  onTryStyle?: () => void;
}

export function MobileResultScreen({ job, inlineResult, onBack, onRegenerate, onTryStyle }: Props) {
  const router = useRouter();
  const t = useTranslations('mobile.result');
  const [sharing, setSharing] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [improving, setImproving] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [compositedImage, setCompositedImage] = useState<string | null>(null);
  const [currentPresetId, setCurrentPresetId] = useState(
    inlineResult?.presetId ?? 'ig-feed'
  );
  const [wasResized, setWasResized] = useState(false);

  const imageUrl = inlineResult?.imageUrl ?? job?.outputUrl ?? null;
  const prompt = inlineResult?.prompt ?? job?.prompt ?? undefined;
  const model = inlineResult?.model ?? job?.modelUsed ?? undefined;

  const displayUrl = compositedImage ?? imageUrl;
  const generationMode = inlineResult?.generationMode;
  const modeLabel = generationMode === 'photo_transform'
    ? t('photoEnhanced')
    : generationMode === 'text_create' ? t('createdFromPrompt') : '';
  const contextLabel = [
    modeLabel && `✨ ${modeLabel}`,
    getContextLabel(inlineResult?.styleId, currentPresetId, t('styleReference')),
  ].filter(Boolean).join(' · ');

  // compositedImage is a blob: URL (Text / Resize) or an https: URL (Improve).
  // Release blob: URLs when replaced or on unmount.
  useEffect(() => {
    if (!compositedImage?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(compositedImage);
  }, [compositedImage]);

  const blobRef = useRef<Blob | null>(null);

  // Prefetch blob on mount so Share fires instantly within user gesture (iPhone requirement).
  // proxyUrl leaves blob: as-is and routes remote URLs through our proxy (CORS).
  useEffect(() => {
    if (!displayUrl) return;
    blobRef.current = null; // invalidate on change
    fetch(proxyUrl(displayUrl))
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) blobRef.current = blob;
      })
      .catch(() => {});
  }, [displayUrl]);

  async function handleShare() {
    if (!displayUrl) return;
    setSharing(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(proxyUrl(displayUrl));
        if (res.ok) blob = await res.blob();
      }
      if (blob) {
        const file = new File([blob], `vendshop-creation.${extFromMime(blob.type)}`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: t('shareTitle'), files: [file] });
          setSharing(false);
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setSharing(false); return; }
    }
    await downloadImage(displayUrl);
    setSharing(false);
  }

  async function handleSave() {
    if (!displayUrl) return;
    if (blobRef.current) {
      saveBlob(blobRef.current);
      return;
    }
    await downloadImage(displayUrl);
  }

  if (improving && displayUrl) {
    return (
      <ImproveBottomSheet
        imageUrl={displayUrl}
        onDone={(improvedUrl) => {
          setCompositedImage(improvedUrl);
          setImproving(false);
        }}
        onCancel={() => setImproving(false)}
      />
    );
  }

  if (resizing && displayUrl) {
    return (
      <MobileResizeCropper
        imageUrl={displayUrl}
        currentPresetId={currentPresetId}
        onDone={(croppedUrl, newPresetId) => {
          setCompositedImage(croppedUrl);
          setCurrentPresetId(newPresetId);
          setWasResized(true);
          setResizing(false);
        }}
        onCancel={() => setResizing(false)}
      />
    );
  }

  if (editingText && displayUrl) {
    return (
      <MobileTextOverlayEditor
        imageUrl={displayUrl}
        onDone={(url) => { setCompositedImage(url); setEditingText(false); }}
        onCancel={() => setEditingText(false)}
      />
    );
  }

  if (!displayUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-gray-400">{t('notAvailable')}</p>
        <button onClick={() => onBack ? onBack() : router.back()} className="text-sm text-green-500">{t('back')}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => onBack ? onBack() : router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label={t('back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-base font-semibold text-white">{t('title')}</span>
        <div className="w-11" />
      </div>

      {/* Image — before/after only when the result really is the user's photo transformed
          (and not re-cropped, which would make the two frames incomparable) */}
      <div className="px-4">
        {inlineResult?.referenceImageUrl && generationMode === 'photo_transform' && !wasResized ? (
          <BeforeAfterSlider
            beforeUrl={inlineResult.referenceImageUrl}
            afterUrl={displayUrl}
          />
        ) : (
          <img
            src={displayUrl}
            alt="Generated result"
            className="w-full rounded-2xl object-cover"
          />
        )}
      </div>

      {contextLabel && (
        <p className="mt-2 px-4 text-xs text-gray-500">{contextLabel}</p>
      )}

      {/* Primary tool */}
      <div className="mt-4 px-4">
        <button
          onClick={() => setImproving(true)}
          className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-left active:bg-green-500/10"
        >
          <span className="text-xl" aria-hidden="true">✨</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-white">{t('improveTitle')}</span>
            <span className="block text-xs text-gray-500">{t('improveDesc')}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Secondary tools */}
      <div className="mt-3 grid grid-cols-2 gap-3 px-4">
        <ToolButton label={t('textTool')} onClick={() => setEditingText(true)}>
          <path d="M4 7V4h16v3" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
        </ToolButton>
        <ToolButton label={t('resizeTool')} onClick={() => setResizing(true)}>
          <path d="M6 2v14a2 2 0 002 2h14" /><path d="M18 22V8a2 2 0 00-2-2H2" />
        </ToolButton>
      </div>

      {/* More options */}
      <div className="mt-5 px-4">
        <p className="mb-1 text-xs uppercase tracking-wide text-gray-600">{t('moreOptions')}</p>
        <div className="divide-y divide-white/5">
          {onRegenerate && (
            <MoreOption icon="🔄" label={t('newVariation')} onClick={onRegenerate} />
          )}
          {onTryStyle && (
            <MoreOption icon="🎨" label={t('tryStyle')} onClick={onTryStyle} />
          )}
          <MoreOption
            icon="📱"
            label={t('makeStory')}
            onClick={() => router.push(`/studio/m/create?remake=ig-story&prompt=${encodeURIComponent(inlineResult?.description ?? prompt ?? '')}`)}
          />
        </div>
      </div>

      {/* Share + Save */}
      <div className="mt-5 grid grid-cols-2 gap-3 px-4">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {sharing ? t('sharing') : t('share')}
        </button>
        <button
          onClick={handleSave}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('save')}
        </button>
      </div>

      {/* Meta */}
      {(model || prompt) && (
        <div className="mt-4 px-4 space-y-1">
          {model && <p className="text-xs text-gray-600">{t('model', { name: model })}</p>}
          {prompt && (
            <p className="text-xs text-gray-700 line-clamp-2" title={prompt}>{prompt}</p>
          )}
        </div>
      )}
    </div>
  );
}

// "Food & Café · IG Feed Post 4:5" — either half is dropped when unknown
function getContextLabel(styleId: string | undefined, presetId: string | undefined, referenceLabel: string): string {
  const style = styleId === 'reference'
    ? referenceLabel
    : STYLE_CHIPS.find((s) => s.id === styleId)?.label;
  const preset = PLATFORM_IMAGE_PRESETS.find((p) => p.id === presetId);
  const format = preset ? `${preset.label} ${preset.aspect_ratio}` : undefined;
  return [style, format].filter(Boolean).join(' · ');
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white active:bg-white/[0.08]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
      {label}
    </button>
  );
}

function MoreOption({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 py-3 text-left text-sm text-gray-300 active:text-white"
    >
      <span className="text-base" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}
