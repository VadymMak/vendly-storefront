'use client';

import { useState, useRef, useCallback } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import { ASSEMBLY_TEMPLATES, type AssemblyTemplate } from '@/lib/auto-assembler/templates';
import { detectBeats } from '@/lib/auto-assembler/beat-detector';
import { solveTimeline, type ClipSource } from '@/lib/auto-assembler/timeline-solver';

type Phase = 'idle' | 'detecting' | 'building' | 'done' | 'error';

interface Props {
  onClose: () => void;
}

export function AutoAssembleModal({ onClose }: Props) {
  const timelineTracks  = useStudioStore(s => s.timelineTracks);
  const clearAllTracks  = useStudioStore(s => s.clearAllTracks);
  const initDefaultTracks = useStudioStore(s => s.initDefaultTracks);
  const addClipToTrack  = useStudioStore(s => s.addClipToTrack);
  const generatedImages = useStudioStore(s => s.generatedImages);
  const generatedVideos = useStudioStore(s => s.generatedVideos);
  const musicDataUrl    = useStudioStore(s => s.musicDataUrl);
  const musicName       = useStudioStore(s => s.musicName);
  const setMusic        = useStudioStore(s => s.setMusic);

  const [selectedTemplate, setSelectedTemplate] = useState<AssemblyTemplate>(ASSEMBLY_TEMPLATES[0]);
  const [phase, setPhase]                        = useState<Phase>('idle');
  const [errorMsg, setErrorMsg]                  = useState('');
  const [detectedBpm, setDetectedBpm]            = useState<number | null>(null);
  const [useCurrentMusic, setUseCurrentMusic]    = useState(true);
  const [customAudioFile, setCustomAudioFile]    = useState<File | null>(null);
  const [customAudioName, setCustomAudioName]    = useState('');
  const [confirmed, setConfirmed]                = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect clip sources from library + timeline
  const libraryClips: ClipSource[] = [
    ...generatedImages.map(img => ({ id: img.id, type: 'image' as const, url: img.url, prompt: img.prompt })),
    ...generatedVideos.map(vid => ({ id: vid.id, type: 'video' as const, url: vid.url, prompt: vid.prompt })),
  ];

  const timelineVideoClips: ClipSource[] = (timelineTracks
    .find(t => t.type === 'video')
    ?.clips ?? [])
    .filter(c => c.type === 'image' || c.type === 'video')
    .map(c => ({
      id:  c.id,
      type: c.type as 'image' | 'video',
      url:  c.sourceUrl ?? '',
      prompt: c.prompt,
    }))
    .filter(c => c.url);

  const allClips = libraryClips.length > 0 ? libraryClips : timelineVideoClips;
  const hasMusic = useCurrentMusic ? !!musicDataUrl : !!customAudioFile;
  const canGenerate = allClips.length > 0 && (hasMusic || true); // music optional

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomAudioFile(file);
    setCustomAudioName(file.name);
    setUseCurrentMusic(false);
    setDetectedBpm(null);
  }, []);

  async function handleGenerate() {
    if (!confirmed) { setConfirmed(true); return; }

    const clips = allClips;
    if (clips.length === 0) {
      setErrorMsg('Add clips to your library or timeline first.');
      setPhase('error');
      return;
    }

    try {
      setPhase('detecting');

      let beats: number[] = [];
      let musicDuration   = 30;

      const audioSource = useCurrentMusic ? musicDataUrl : (customAudioFile ?? null);
      if (audioSource) {
        try {
          const result = await detectBeats(audioSource instanceof File ? audioSource : audioSource);
          beats        = result.beats;
          musicDuration = result.duration;
          setDetectedBpm(result.bpm);
        } catch {
          console.warn('[auto-assembler] Beat detection failed, using even distribution');
          musicDuration = 30;
        }
      } else {
        // No music: use total = clips × avg duration
        const avg = (selectedTemplate.clipDuration[0] + selectedTemplate.clipDuration[1]) / 2;
        musicDuration = avg * clips.length;
      }

      setPhase('building');

      const { videoClips } = solveTimeline({
        clips,
        template: selectedTemplate,
        beats,
        musicDuration,
      });

      // Apply to store
      clearAllTracks();
      initDefaultTracks();

      const videoTrack = useStudioStore.getState().timelineTracks.find(t => t.type === 'video');
      if (!videoTrack) throw new Error('No video track after init');

      for (const clip of videoClips) {
        addClipToTrack(videoTrack.id, clip);
      }

      // Upload new music if provided
      if (customAudioFile && !useCurrentMusic) {
        const reader = new FileReader();
        reader.onload = () => {
          setMusic(reader.result as string, customAudioName);
        };
        reader.readAsDataURL(customAudioFile);
      }

      setPhase('done');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }

  // Mini timeline preview
  const previewClips = (() => {
    if (allClips.length === 0) return [];
    const avg = (selectedTemplate.clipDuration[0] + selectedTemplate.clipDuration[1]) / 2;
    const count = Math.min(10, Math.max(3, allClips.length));
    return Array.from({ length: count }, (_, i) => ({
      label: `C${(i % allClips.length) + 1}`,
      flex: Math.max(1, Math.round(avg)),
    }));
  })();

  const statusText =
    phase === 'detecting' ? 'Detecting beats…' :
    phase === 'building'  ? 'Building timeline…' :
    phase === 'done'      ? '✓ Done!' :
    phase === 'error'     ? `Error: ${errorMsg}` : '';

  return (
    <div className="flex h-full flex-col gap-3 px-1 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">Choose a style</div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {ASSEMBLY_TEMPLATES.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => { setSelectedTemplate(tpl); setConfirmed(false); }}
            className={[
              'flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors',
              selectedTemplate.id === tpl.id
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

      {/* Music section */}
      <div className="border-t border-white/6 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Music</div>
        {musicDataUrl && (
          <label className="mb-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="music-source"
              checked={useCurrentMusic}
              onChange={() => { setUseCurrentMusic(true); setDetectedBpm(null); }}
              className="accent-green-500"
            />
            <span className="text-[11px] text-gray-400">
              Use current: <span className="text-gray-300">{musicName ?? 'music.mp3'}</span>
            </span>
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="music-source"
            checked={!useCurrentMusic}
            onChange={() => setUseCurrentMusic(false)}
            className="accent-green-500"
          />
          <span className="text-[11px] text-gray-400">Upload music</span>
        </label>
        {!useCurrentMusic && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 w-full rounded border border-dashed border-white/15 py-1.5 text-[11px] text-gray-500 transition-colors hover:border-white/25 hover:text-gray-300"
            >
              {customAudioFile ? customAudioName : 'Choose MP3 / AAC…'}
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </>
        )}
        {detectedBpm !== null && (
          <div className="mt-1 text-[10px] text-green-400">♫ {detectedBpm} BPM detected</div>
        )}
        {!hasMusic && (
          <div className="mt-1 text-[10px] text-gray-600">No music — clips will be evenly spaced</div>
        )}
      </div>

      {/* Clips info */}
      <div className="border-t border-white/6 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Clips</div>
        {allClips.length > 0 ? (
          <div className="text-[11px] text-gray-400">
            {allClips.length} clip{allClips.length !== 1 ? 's' : ''}
            {libraryClips.length > 0 ? ' from library' : ' from timeline'}
          </div>
        ) : (
          <div className="text-[11px] text-yellow-600">
            Add clips to your library first
          </div>
        )}
      </div>

      {/* Mini timeline preview */}
      {previewClips.length > 0 && (
        <div className="border-t border-white/6 pt-2">
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

      {/* Confirm warning */}
      {confirmed && phase === 'idle' && (
        <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-2 py-1.5 text-[10px] text-yellow-400">
          This will replace the current timeline. Click Generate again to confirm.
        </div>
      )}

      {/* Status */}
      {phase !== 'idle' && (
        <div className={[
          'rounded px-2 py-1.5 text-[11px]',
          phase === 'done'  ? 'bg-green-600/15 text-green-400' :
          phase === 'error' ? 'bg-red-600/15 text-red-400' :
          'bg-white/5 text-gray-400',
        ].join(' ')}>
          {(phase === 'detecting' || phase === 'building') && (
            <span className="mr-1.5 inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent align-middle" />
          )}
          {statusText}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 border-t border-white/6 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded bg-white/8 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || phase === 'detecting' || phase === 'building' || phase === 'done'}
          className="flex-1 rounded bg-green-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmed ? 'Confirm & Generate' : 'Generate Timeline'}
        </button>
      </div>
    </div>
  );
}
