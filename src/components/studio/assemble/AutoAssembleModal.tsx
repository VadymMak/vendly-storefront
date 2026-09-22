'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import { ASSEMBLY_TEMPLATES, type AssemblyTemplate } from '@/lib/auto-assembler/templates';
import { detectBeats } from '@/lib/auto-assembler/beat-detector';
import { solveTimeline, type ClipSource } from '@/lib/auto-assembler/timeline-solver';
import { useBrandKitStore } from '@/lib/studio/brand-kit';
import { saveMediaBlob } from '@/lib/studio/media-db';

type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';
type WizardStep  = 1 | 2 | 3 | 4;
type GenPhase    = 'idle' | 'detecting' | 'building' | 'done' | 'error';

interface WizardMedia {
  id: string;
  type: 'image' | 'video';
  idbUri: string;
  blobUrl: string;
  name: string;
}

interface Props {
  onClose: () => void;
  onExport?: () => void;
  onAspectRatio?: (ar: AspectRatio) => void;
}

const ASPECT_LABELS: Record<AspectRatio, string> = {
  '9:16': '9:16 TikTok',
  '4:5':  '4:5 Insta',
  '1:1':  '1:1 Square',
  '16:9': '16:9 Wide',
};

const MAX_FILES    = 20;
const MAX_FILE_MB  = 50;

function StepDots({ step }: { step: WizardStep }) {
  const labels = ['Goal', 'Media', 'Style', 'Done'];
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {labels.map((label, i) => {
        const n = (i + 1) as WizardStep;
        const active  = step === n;
        const done    = step > n;
        return (
          <div key={n} className="flex flex-col items-center gap-0.5">
            <div className={[
              'h-2 w-2 rounded-full transition-colors',
              active ? 'bg-green-500' : done ? 'bg-green-800' : 'bg-white/15',
            ].join(' ')} />
            <span className={['text-[8px] transition-colors', active ? 'text-green-400' : 'text-gray-700'].join(' ')}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AutoAssembleModal({ onClose, onExport, onAspectRatio }: Props) {
  const timelineTracks    = useStudioStore(s => s.timelineTracks);
  const clearAllTracks    = useStudioStore(s => s.clearAllTracks);
  const initDefaultTracks = useStudioStore(s => s.initDefaultTracks);
  const addClipToTrack    = useStudioStore(s => s.addClipToTrack);
  const generatedImages   = useStudioStore(s => s.generatedImages);
  const generatedVideos   = useStudioStore(s => s.generatedVideos);
  const musicDataUrl      = useStudioStore(s => s.musicDataUrl);
  const musicName         = useStudioStore(s => s.musicName);
  const setMusic          = useStudioStore(s => s.setMusic);
  const brand             = useBrandKitStore();

  const [step, setStep]                         = useState<WizardStep>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<AssemblyTemplate | null>(null);
  const [selectedAspect, setSelectedAspect]     = useState<AspectRatio>('9:16');
  const [targetDuration, setTargetDuration]     = useState<number>(15);
  const [wizardMedia, setWizardMedia]           = useState<WizardMedia[]>([]);
  const [isDragOver, setIsDragOver]             = useState(false);
  const [useCurrentMusic, setUseCurrentMusic]   = useState(true);
  const [customAudioFile, setCustomAudioFile]   = useState<File | null>(null);
  const [customAudioName, setCustomAudioName]   = useState('');
  const [noMusic, setNoMusic]                   = useState(false);
  const [phase, setPhase]                       = useState<GenPhase>('idle');
  const [errorMsg, setErrorMsg]                 = useState('');
  const [detectedBpm, setDetectedBpm]           = useState<number | null>(null);

  // Inline brand editing for step 2 — local state to prevent focus loss on re-render
  const [localBrandName, setLocalBrandName] = useState(brand.businessName);
  const [localCta, setLocalCta]             = useState(brand.defaultCta);
  const [inlinePrimary, setInlinePrimary]   = useState(brand.primaryColor);
  const [inlineAccent, setInlineAccent]     = useState(brand.accentColor);
  const [brandSectionOpen, setBrandSectionOpen] = useState(false);

  const audioInputRef  = useRef<HTMLInputElement>(null);
  const mediaInputRef  = useRef<HTMLInputElement>(null);
  const blobUrlsRef    = useRef<string[]>([]);
  const brandNameRef   = useRef<HTMLInputElement>(null);
  const ctaRef         = useRef<HTMLInputElement>(null);

  // Sync local brand fields from store when step 2 opens
  useEffect(() => {
    if (step === 2) {
      setLocalBrandName(brand.businessName);
      setLocalCta(brand.defaultCta);
      setInlinePrimary(brand.primaryColor);
      setInlineAccent(brand.accentColor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Revoke preview blob URLs on unmount
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach(u => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
    };
  }, []);

  // Library clips
  const libraryClips: ClipSource[] = [
    ...generatedImages.map(img => ({ id: img.id, type: 'image' as const, url: img.url, prompt: img.prompt })),
    ...generatedVideos.map(vid => ({ id: vid.id, type: 'video' as const, url: vid.url, prompt: vid.prompt })),
  ];
  const timelineVideoClips: ClipSource[] = (timelineTracks
    .find(t => t.type === 'video')?.clips ?? [])
    .filter(c => c.type === 'image' || c.type === 'video')
    .map(c => ({ id: c.id, type: c.type as 'image' | 'video', url: c.sourceUrl ?? '', prompt: c.prompt }))
    .filter(c => c.url);

  const wizardClips: ClipSource[] = wizardMedia.map(m => ({
    id: m.id, type: m.type, url: m.idbUri,
  }));
  const allClips = wizardClips.length > 0
    ? wizardClips
    : libraryClips.length > 0 ? libraryClips : timelineVideoClips;

  const hasEnoughMedia = allClips.length > 0;

  // ── Media upload ───────────────────────────────────────────────────────────

  async function addFiles(files: File[]) {
    const accepted = files
      .filter(f =>
        f.type.startsWith('image/') ||
        f.type.startsWith('video/') ||
        ['mp4','webm','mov','jpg','jpeg','png','webp'].some(ext => f.name.toLowerCase().endsWith(ext))
      )
      .filter(f => f.size <= MAX_FILE_MB * 1024 * 1024)
      .slice(0, MAX_FILES - wizardMedia.length);

    if (accepted.length === 0) return;

    const newMedia: WizardMedia[] = [];
    for (const file of accepted) {
      const key     = crypto.randomUUID();
      const blobUrl = URL.createObjectURL(file);
      blobUrlsRef.current.push(blobUrl);
      await saveMediaBlob(key, file);
      newMedia.push({
        id: key,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        idbUri: `idb://${key}`,
        blobUrl,
        name: file.name,
      });
    }
    setWizardMedia(prev => [...prev, ...newMedia]);
  }

  const handleMediaInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await addFiles(files);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardMedia.length]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void addFiles(files);
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  async function handleGenerate() {
    const clips = allClips;
    if (clips.length === 0) {
      setErrorMsg('Add at least one photo or clip.');
      setPhase('error');
      return;
    }
    if (!selectedTemplate) {
      setErrorMsg('Pick a template first.');
      setPhase('error');
      return;
    }

    // Flush local brand edits to store before generating
    if (localBrandName !== brand.businessName || localCta !== brand.defaultCta ||
        inlinePrimary !== brand.primaryColor || inlineAccent !== brand.accentColor) {
      brand.updateBrand({
        businessName: localBrandName,
        defaultCta: localCta,
        primaryColor: inlinePrimary,
        accentColor: inlineAccent,
      });
    }

    try {
      setPhase('detecting');

      let beats: number[] = [];
      let musicDuration   = 30;

      const audioSource = noMusic ? null : useCurrentMusic ? musicDataUrl : (customAudioFile ?? null);
      if (audioSource) {
        try {
          const result = await detectBeats(audioSource instanceof File ? audioSource : audioSource);
          beats         = result.beats;
          musicDuration = result.duration;
          setDetectedBpm(result.bpm);
        } catch {
          console.warn('[auto-assembler] Beat detection failed, using even spacing');
          musicDuration = 30;
        }
      } else {
        musicDuration = targetDuration;
      }

      setPhase('building');

      const activeBrand = brand.isConfigured ? brand : null;

      const { videoClips, textClips } = solveTimeline({
        clips,
        template: selectedTemplate,
        beats,
        musicDuration,
        brandKit: activeBrand,
        targetDuration,
      });

      clearAllTracks();
      initDefaultTracks();

      const tracks = useStudioStore.getState().timelineTracks;
      const videoTrack = tracks.find(t => t.type === 'video');
      const textTrack  = tracks.find(t => t.type === 'text');

      if (!videoTrack) throw new Error('No video track after init');

      for (const clip of videoClips) addClipToTrack(videoTrack.id, clip);

      if (textTrack && textClips.length > 0) {
        for (const tc of textClips) addClipToTrack(textTrack.id, tc);
      }

      if (customAudioFile && !useCurrentMusic && !noMusic) {
        const reader = new FileReader();
        reader.onload = () => setMusic(reader.result as string, customAudioName);
        reader.readAsDataURL(customAudioFile);
      }

      // Propagate aspect ratio
      onAspectRatio?.(selectedAspect);

      setPhase('done');
      setStep(4);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }

  // ── Step 1: Choose Goal ────────────────────────────────────────────────────

  function Step1() {
    return (
      <div className="flex flex-col gap-3 px-2 py-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">What do you want to create?</div>

        <div className="grid grid-cols-2 gap-1.5">
          {ASSEMBLY_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => {
                setSelectedTemplate(tpl);
                setSelectedAspect(tpl.suggestedAspects[0]);
              }}
              className={[
                'flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors',
                selectedTemplate?.id === tpl.id
                  ? 'border-green-600/60 bg-green-600/10 text-white'
                  : 'border-white/5 bg-white/3 text-gray-500 hover:border-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              <span className="text-base leading-none">{tpl.icon}</span>
              <span className="text-[11px] font-semibold leading-tight">{tpl.name}</span>
              <span className="text-[9px] leading-tight text-gray-600">{tpl.description}</span>
            </button>
          ))}
        </div>

        {/* Aspect ratio */}
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Aspect Ratio</div>
          <div className="flex flex-wrap gap-1">
            {(['9:16', '4:5', '1:1', '16:9'] as const).map(ar => (
              <button
                key={ar}
                onClick={() => setSelectedAspect(ar)}
                className={[
                  'rounded px-2 py-1 text-xs transition-colors',
                  selectedAspect === ar
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                ].join(' ')}
              >
                {ASPECT_LABELS[ar]}
              </button>
            ))}
          </div>
        </div>

        {/* Target duration */}
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Duration</div>
          <div className="flex flex-wrap gap-1">
            {([10, 15, 20, 30, 60] as const).map(d => (
              <button
                key={d}
                onClick={() => setTargetDuration(d)}
                className={[
                  'rounded px-2 py-1 text-xs transition-colors',
                  targetDuration === d
                    ? 'bg-green-600/60 text-white'
                    : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                ].join(' ')}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto flex gap-2 border-t border-white/6 pt-2">
          <button onClick={onClose} className="flex-1 rounded bg-white/8 py-1.5 text-xs text-gray-400 hover:bg-white/15 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => setStep(2)}
            disabled={!selectedTemplate}
            className="flex-1 rounded bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Add Media & Brand ──────────────────────────────────────────────

  function Step2() {
    const showLibrary  = libraryClips.length > 0 && wizardMedia.length === 0;
    const showTimeline = timelineVideoClips.length > 0 && wizardMedia.length === 0 && libraryClips.length === 0;

    return (
      <div className="flex flex-col gap-3 px-2 py-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Add your photos & clips</div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => mediaInputRef.current?.click()}
          className={[
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed py-4 transition-colors',
            isDragOver
              ? 'border-green-500/60 bg-green-500/5 text-green-400'
              : 'border-white/15 text-gray-600 hover:border-white/25 hover:text-gray-400',
          ].join(' ')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
          <span className="text-xs">
            {wizardMedia.length > 0 ? `${wizardMedia.length} file${wizardMedia.length > 1 ? 's' : ''} — add more` : 'Drag & drop or click'}
          </span>
          <span className="text-[10px]">jpg, png, mp4, webm · max 50 MB each</span>
        </div>
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={e => void handleMediaInput(e)}
        />

        {/* Wizard media thumbnails */}
        {wizardMedia.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{wizardMedia.length} file{wizardMedia.length > 1 ? 's' : ''} added</span>
              <button onClick={() => setWizardMedia([])} className="text-[10px] text-gray-700 hover:text-red-400">Clear all</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {wizardMedia.slice(0, 8).map(m => (
                <div key={m.id} className="relative h-10 w-10 overflow-hidden rounded border border-white/10 bg-black">
                  {m.type === 'image'
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.blobUrl} alt="" className="h-full w-full object-cover" />
                    : <video src={m.blobUrl} className="h-full w-full object-cover" muted playsInline />
                  }
                  <button
                    onClick={() => setWizardMedia(prev => prev.filter(x => x.id !== m.id))}
                    className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-bl bg-black/70 text-[8px] text-gray-400 hover:text-red-400"
                  >×</button>
                </div>
              ))}
              {wizardMedia.length > 8 && (
                <div className="flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-white/5 text-[10px] text-gray-500">
                  +{wizardMedia.length - 8}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Library/timeline fallback info */}
        {showLibrary && (
          <div className="rounded border border-green-600/20 bg-green-600/5 px-2 py-1.5 text-[10px] text-green-400">
            Will use {libraryClips.length} clip{libraryClips.length > 1 ? 's' : ''} from your library
          </div>
        )}
        {showTimeline && (
          <div className="rounded border border-white/10 bg-white/3 px-2 py-1.5 text-[10px] text-gray-500">
            Will use {timelineVideoClips.length} clip{timelineVideoClips.length > 1 ? 's' : ''} from timeline
          </div>
        )}

        {/* Inline brand — controlled open state to survive re-renders */}
        <div>
          <button
            type="button"
            onClick={() => setBrandSectionOpen(o => !o)}
            className="flex w-full items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300"
          >
            <span className={['transition-transform', brandSectionOpen ? 'rotate-90' : ''].join(' ')}>▶</span>
            🏷️ Brand (optional)
          </button>

          {brandSectionOpen && (
            <div className="mt-2 flex flex-col gap-2">
              <input
                ref={brandNameRef}
                type="text"
                value={localBrandName}
                onChange={e => {
                  const val = e.target.value;
                  const pos = e.target.selectionStart;
                  setLocalBrandName(val);
                  requestAnimationFrame(() => {
                    brandNameRef.current?.focus();
                    brandNameRef.current?.setSelectionRange(pos, pos);
                  });
                }}
                onBlur={e => brand.updateBrand({ businessName: e.target.value })}
                placeholder="Business name"
                className="w-full rounded bg-white/10 px-2 py-1.5 text-xs text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
              />
              <div className="flex items-center gap-2">
                <span className="w-14 text-[10px] text-gray-600">Primary</span>
                <input
                  type="color"
                  value={inlinePrimary}
                  onChange={e => setInlinePrimary(e.target.value)}
                  onBlur={e => brand.updateBrand({ primaryColor: e.target.value })}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="w-14 text-[10px] text-gray-600">Accent</span>
                <input
                  type="color"
                  value={inlineAccent}
                  onChange={e => setInlineAccent(e.target.value)}
                  onBlur={e => brand.updateBrand({ accentColor: e.target.value })}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </div>
              <input
                ref={ctaRef}
                type="text"
                value={localCta}
                onChange={e => {
                  const val = e.target.value;
                  const pos = e.target.selectionStart;
                  setLocalCta(val);
                  requestAnimationFrame(() => {
                    ctaRef.current?.focus();
                    ctaRef.current?.setSelectionRange(pos, pos);
                  });
                }}
                onBlur={e => brand.updateBrand({ defaultCta: e.target.value })}
                placeholder="CTA text (e.g. Order Now)"
                className="w-full rounded bg-white/10 px-2 py-1.5 text-xs text-white outline-none placeholder:text-gray-700 focus:ring-1 focus:ring-green-600/60"
              />
            </div>
          )}
        </div>

        <div className="mt-auto flex gap-2 border-t border-white/6 pt-2">
          <button onClick={() => setStep(1)} className="flex-1 rounded bg-white/8 py-1.5 text-xs text-gray-400 hover:bg-white/15 hover:text-white">
            ← Back
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={!hasEnoughMedia}
            className="flex-1 rounded bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Style & Music ──────────────────────────────────────────────────

  function Step3() {
    const previewClips = (() => {
      if (!selectedTemplate) return [];
      const avg   = (selectedTemplate.clipDuration[0] + selectedTemplate.clipDuration[1]) / 2;
      const count = Math.min(10, Math.max(3, allClips.length));
      return Array.from({ length: count }, (_, i) => ({
        label: `C${(i % Math.max(1, allClips.length)) + 1}`,
        flex: Math.max(1, Math.round(avg)),
      }));
    })();

    return (
      <div className="flex flex-col gap-3 px-2 py-1">

        {/* Mini preview */}
        {previewClips.length > 0 && selectedTemplate && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Preview</div>
            <div className="flex h-5 w-full gap-px overflow-hidden rounded">
              {previewClips.map((c, i) => (
                <div
                  key={i}
                  className="flex min-w-0 items-center justify-center overflow-hidden rounded-sm bg-green-700/30 text-[8px] text-green-400"
                  style={{ flex: c.flex }}
                >
                  {c.label}
                </div>
              ))}
            </div>
            <div className="mt-0.5 text-[9px] text-gray-700">
              ~{selectedTemplate.clipDuration[0]}–{selectedTemplate.clipDuration[1]}s per clip · {selectedTemplate.transition} cuts
            </div>
          </div>
        )}

        {/* Music */}
        <div className="border-t border-white/6 pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Music</div>

          {musicDataUrl && (
            <label className="mb-1 flex cursor-pointer items-center gap-2">
              <input
                type="radio" name="wiz-music" checked={useCurrentMusic && !noMusic}
                onChange={() => { setUseCurrentMusic(true); setNoMusic(false); setDetectedBpm(null); }}
                className="accent-green-500"
              />
              <span className="text-[11px] text-gray-400">
                Use current: <span className="text-gray-300">{musicName ?? 'music.mp3'}</span>
              </span>
            </label>
          )}

          <label className="mb-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio" name="wiz-music" checked={!useCurrentMusic && !noMusic}
              onChange={() => { setUseCurrentMusic(false); setNoMusic(false); }}
              className="accent-green-500"
            />
            <span className="text-[11px] text-gray-400">Upload music</span>
          </label>

          {!useCurrentMusic && !noMusic && (
            <>
              <button
                onClick={() => audioInputRef.current?.click()}
                className="mt-1 w-full rounded border border-dashed border-white/15 py-1.5 text-[11px] text-gray-500 hover:border-white/25 hover:text-gray-300"
              >
                {customAudioFile ? customAudioName : 'Choose MP3 / AAC…'}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setCustomAudioFile(f);
                  setCustomAudioName(f.name);
                  setDetectedBpm(null);
                }}
              />
            </>
          )}

          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio" name="wiz-music" checked={noMusic}
              onChange={() => setNoMusic(true)}
              className="accent-green-500"
            />
            <span className="text-[11px] text-gray-400">No music</span>
          </label>

          {detectedBpm !== null && (
            <div className="mt-1 text-[10px] text-green-400">♫ {detectedBpm} BPM detected</div>
          )}
        </div>

        {/* Error */}
        {phase === 'error' && (
          <div className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[10px] text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Status */}
        {(phase === 'detecting' || phase === 'building') && (
          <div className="flex items-center gap-2 rounded bg-white/5 px-2 py-1.5 text-[11px] text-gray-400">
            <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
            {phase === 'detecting' ? 'Detecting beats…' : 'Building timeline…'}
          </div>
        )}

        <div className="mt-auto flex gap-2 border-t border-white/6 pt-2">
          <button
            onClick={() => setStep(2)}
            disabled={phase === 'detecting' || phase === 'building'}
            className="flex-1 rounded bg-white/8 py-1.5 text-xs text-gray-400 hover:bg-white/15 hover:text-white disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            onClick={() => void handleGenerate()}
            disabled={phase === 'detecting' || phase === 'building'}
            className="flex-1 rounded bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === 'detecting' ? 'Detecting…' : phase === 'building' ? 'Building…' : 'Generate →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 4: Done ───────────────────────────────────────────────────────────

  function Step4() {
    const count = useStudioStore.getState().timelineTracks.find(t => t.type === 'video')?.clips.length ?? 0;
    return (
      <div className="flex flex-col items-center gap-4 px-3 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20 text-2xl">✓</div>
        <div>
          <p className="text-sm font-semibold text-white">Your video is ready!</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {count} clip{count !== 1 ? 's' : ''} · {selectedTemplate?.name}
          </p>
        </div>

        <div className="w-full space-y-1.5">
          <button
            onClick={onClose}
            className="w-full rounded bg-green-600 py-2 text-xs font-semibold text-white hover:bg-green-700"
          >
            Edit Timeline →
          </button>
          {onExport && (
            <button
              onClick={() => { onClose(); setTimeout(onExport, 50); }}
              className="w-full rounded border border-white/10 py-2 text-xs text-gray-400 hover:border-white/20 hover:text-white"
            >
              Export Clip
            </button>
          )}
          <button
            onClick={() => {
              setStep(1);
              setPhase('idle');
              setErrorMsg('');
              setDetectedBpm(null);
            }}
            className="w-full rounded py-1.5 text-xs text-gray-600 hover:text-gray-400"
          >
            ← Remake
          </button>
        </div>

        <div className="w-full border-t border-white/6 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Quick edits</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setStep(3); setPhase('idle'); }}
              className="flex-1 rounded bg-white/5 py-1.5 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300"
            >Change music</button>
            <button
              onClick={() => { setStep(1); setPhase('idle'); }}
              className="flex-1 rounded bg-white/5 py-1.5 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300"
            >Change style</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <StepDots step={step} />
      <div className="flex-1 overflow-y-auto">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </div>
    </div>
  );
}
