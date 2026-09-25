'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  repurposeVideo,
  REPURPOSE_TARGETS,
  type RepurposeTarget,
  type RepurposeProgress,
  type RepurposeResult,
} from '@/lib/studio/repurpose-renderer';

interface Props {
  sourceBlob: Blob;
  baseName?: string;
  onClose: () => void;
}

const DEFAULT_SELECTED = new Set(['ig-reel', 'tiktok', 'yt-short', 'fb-reel']);

export function RepurposeModal({ sourceBlob, baseName = 'video', onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Map<string, RepurposeProgress>>(new Map());
  const [results, setResults] = useState<RepurposeResult[]>([]);

  const toggleTarget = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(REPURPOSE_TARGETS.map(t => t.id)));
  const selectVertical = () => setSelected(new Set(REPURPOSE_TARGETS.filter(t => t.aspectRatio === '9:16').map(t => t.id)));
  const clearAll = () => setSelected(new Set());

  const selectedTargets = useMemo(
    () => REPURPOSE_TARGETS.filter(t => selected.has(t.id)),
    [selected],
  );

  // Rough estimate: ~1.4× source duration per target + 2s overhead each
  const sourceSize = sourceBlob.size;
  const estimatedSeconds = useMemo(() => {
    if (selected.size === 0) return 0;
    const avgDuration = 5; // assume 5s source; refined when we load metadata
    return Math.ceil(selected.size * (avgDuration * 1.4 + 2));
  }, [selected.size]);

  const estimatedMB = useMemo(() => {
    // ~6Mbps per target × 5s default
    return (selected.size * 6_000_000 * 5 / 8 / (1024 * 1024)).toFixed(0);
  }, [selected.size]);

  const handleRun = useCallback(async () => {
    if (selectedTargets.length === 0) return;
    setRunning(true);
    setProgress(new Map());
    setResults([]);

    const newResults = await repurposeVideo(
      sourceBlob,
      selectedTargets,
      baseName,
      (p) => setProgress(prev => new Map(prev).set(p.targetId, p)),
    );
    setResults(newResults);
    setRunning(false);
  }, [sourceBlob, selectedTargets, baseName]);

  const handleDownload = (result: RepurposeResult) => {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDownloadAll = () => {
    results.forEach((r, i) => {
      setTimeout(() => handleDownload(r), i * 300);
    });
  };

  const sourceSizeMB = (sourceSize / (1024 * 1024)).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-gray-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Create Marketing Package</h2>
            <p className="text-xs text-gray-500">Source: {sourceSizeMB} MB · Free, no credits</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Platform selection */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Select platforms</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[10px] text-green-500 hover:text-green-400">All</button>
              <span className="text-[10px] text-gray-600">·</span>
              <button onClick={selectVertical} className="text-[10px] text-green-500 hover:text-green-400">Vertical</button>
              <span className="text-[10px] text-gray-600">·</span>
              <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-400">Clear</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-4">
            {REPURPOSE_TARGETS.map(target => {
              const prog = progress.get(target.id);
              const result = results.find(r => r.targetId === target.id);
              const isSelected = selected.has(target.id);
              const isDone = prog?.phase === 'done';
              const isError = prog?.phase === 'error';
              const isActive = running && prog && prog.phase !== 'done' && prog.phase !== 'error';

              return (
                <button
                  key={target.id}
                  onClick={() => !running && toggleTarget(target.id)}
                  disabled={running}
                  className={[
                    'relative flex flex-col rounded-lg border p-3 text-left transition-colors',
                    isDone ? 'border-green-600/60 bg-green-950/20' :
                    isError ? 'border-red-500/40 bg-red-950/10' :
                    isSelected ? 'border-green-600/40 bg-green-950/10' :
                    'border-white/10 bg-white/3 hover:border-white/20',
                    running && !isSelected ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <div className={[
                      'h-3.5 w-3.5 flex-shrink-0 rounded border transition-colors',
                      isDone ? 'border-green-500 bg-green-500' :
                      isSelected ? 'border-green-500 bg-green-500' :
                      'border-white/30 bg-transparent',
                    ].join(' ')}>
                      {(isSelected || isDone) && (
                        <svg className="h-full w-full p-0.5" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-200">{target.label}</span>
                  </div>
                  <span className="mt-0.5 pl-5 text-[10px] text-gray-600">
                    {target.width}×{target.height}
                    {target.maxDuration ? ` · max ${target.maxDuration}s` : ''}
                  </span>

                  {/* Progress bar */}
                  {isActive && prog && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-200"
                        style={{ width: `${prog.percent}%` }}
                      />
                    </div>
                  )}

                  {/* Result info */}
                  {result && (
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-green-500">{result.sizeMB} MB</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(result); }}
                        className="rounded px-1.5 py-0.5 text-[10px] text-green-400 hover:bg-green-900/30"
                      >
                        ⬇ Download
                      </button>
                    </div>
                  )}

                  {isError && prog?.error && (
                    <span className="mt-1 text-[10px] text-red-400">{prog.error.slice(0, 50)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-4">
          {results.length === 0 && !running && (
            <>
              {selected.size > 0 && (
                <p className="mb-3 text-[11px] text-gray-500">
                  {selected.size} version{selected.size > 1 ? 's' : ''} · Est. ~{estimatedSeconds}s · ~{estimatedMB} MB total
                </p>
              )}
              <button
                onClick={() => void handleRun()}
                disabled={selected.size === 0}
                className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create Package ({selected.size} version{selected.size !== 1 ? 's' : ''})
              </button>
            </>
          )}

          {running && (
            <div className="text-center text-xs text-gray-400">
              Processing {progress.size} / {selectedTargets.length} targets…
            </div>
          )}

          {results.length > 0 && !running && (
            <div className="flex gap-3">
              <button
                onClick={handleDownloadAll}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                Download All ({results.length})
              </button>
              <button
                onClick={() => { setResults([]); setProgress(new Map()); }}
                className="rounded-lg border border-white/10 px-4 text-sm text-gray-400 hover:border-white/20 hover:text-white"
              >
                Redo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
