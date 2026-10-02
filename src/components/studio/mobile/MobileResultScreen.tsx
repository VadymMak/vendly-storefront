'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { downloadImage, extFromMime, proxyUrl, saveBlob } from '@/lib/studio/mobile/share';
import { PLATFORM_IMAGE_PRESETS, STYLE_CHIPS } from '@/lib/studio/constants';
import { MobileTextOverlayEditor } from './MobileTextOverlayEditor';
import { MobileResizeCropper } from './MobileResizeCropper';
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
  const [compositedImage, setCompositedImage] = useState<string | null>(null);
  const [improvingUpload, setImprovingUpload] = useState(false);
  const [resizing, setResizing] = useState(false);
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

  // compositedImage is a blob: URL from the text editor — release it when replaced or on unmount
  useEffect(() => {
    if (!compositedImage) return;
    return () => URL.revokeObjectURL(compositedImage);
  }, [compositedImage]);

  const blobRef = useRef<Blob | null>(null);

  // Prefetch blob on mount so Share fires instantly within user gesture (iPhone requirement)
  useEffect(() => {
    if (!displayUrl) return;
    blobRef.current = null; // invalidate on change
    fetch(compositedImage ? displayUrl : proxyUrl(displayUrl))
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) blobRef.current = blob;
      })
      .catch(() => {});
  }, [displayUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleShare() {
    if (!displayUrl) return;
    setSharing(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const src = compositedImage ? displayUrl : proxyUrl(displayUrl);
        const res = await fetch(src);
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

  async function getPersistentUrl(url: string): Promise<string> {
    if (!url.startsWith('blob:')) return url;
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'composited.jpg', { type: blob.type || 'image/jpeg' });
    const fd = new FormData();
    fd.append('image', file);
    const uploadRes = await fetch('/api/studio/upload', { method: 'POST', body: fd });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const data = await uploadRes.json() as { url: string };
    return data.url;
  }

  async function handleSave() {
    if (!displayUrl) return;
    if (blobRef.current) {
      saveBlob(blobRef.current);
      return;
    }
    await downloadImage(displayUrl);
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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-base font-semibold text-white">{t('title')}</span>
        <div className="w-9" />
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

      {/* Share + Save */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {sharing ? t('sharing') : t('share')}
        </button>
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('save')}
        </button>
      </div>

      {/* Quick actions */}
      <div className="mt-5 mx-4 overflow-hidden rounded-2xl border border-white/10">
        {onRegenerate && (
          <QuickAction icon="🔄" label={t('newVariation')} onClick={onRegenerate} />
        )}
        {onTryStyle && (
          <QuickAction icon="🎨" label={t('tryStyle')} onClick={onTryStyle} />
        )}
        <QuickAction
          icon="📱"
          label={t('makeStory')}
          onClick={() => router.push(`/studio/m/create?remake=ig-story&prompt=${encodeURIComponent(prompt ?? '')}`)}
        />
        <QuickAction
          icon="✏️"
          label={t('addText')}
          onClick={() => setEditingText(true)}
        />
        <QuickAction
          icon="📐"
          label={t('resize')}
          onClick={() => setResizing(true)}
        />
        <QuickAction
          icon="✨"
          label={improvingUpload ? '…' : t('improve')}
          onClick={async () => {
            if (improvingUpload || !displayUrl) return;
            try {
              setImprovingUpload(true);
              const persistentUrl = await getPersistentUrl(displayUrl);
              router.push(`/studio/m/improve?image=${encodeURIComponent(persistentUrl)}`);
            } catch {
              router.push('/studio/m/improve');
            } finally {
              setImprovingUpload(false);
            }
          }}
          last
        />
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

function QuickAction({ icon, label, onClick, last }: { icon: string; label: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-white active:bg-white/[0.06] ${!last ? 'border-b border-white/10' : ''}`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}
