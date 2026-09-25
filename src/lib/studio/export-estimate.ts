export interface ExportEstimate {
  estimatedSeconds: number;
  estimatedLabel: string;
  estimatedBytes: number;
  estimatedSizeLabel: string;
}

const BITRATE_BY_RESOLUTION: Record<string, number> = {
  '9:16':  4_500_000,
  '16:9':  5_000_000,
  '1:1':   4_000_000,
  '4:5':   4_200_000,
  '4:3':   4_500_000,
};

// Empirical: WebCodecs renders at ~30-60 fps, MediaRecorder at real-time.
// We assume worst-case (MediaRecorder) for the estimate.
const RENDER_TIME_PER_SECOND_OF_CONTENT = 1.4;
const AUDIO_MIX_OVERHEAD_SECONDS = 3;

export function estimateExport(input: {
  clipCount: number;
  totalDurationSeconds: number;
  aspectRatio: string;
  hasAudio: boolean;
}): ExportEstimate {
  const { clipCount, totalDurationSeconds, aspectRatio, hasAudio } = input;
  if (clipCount < 2 || totalDurationSeconds <= 0) {
    return { estimatedSeconds: 0, estimatedLabel: '', estimatedBytes: 0, estimatedSizeLabel: '' };
  }

  const renderSec = totalDurationSeconds * RENDER_TIME_PER_SECOND_OF_CONTENT
    + (hasAudio ? AUDIO_MIX_OVERHEAD_SECONDS : 0);
  const estimatedSeconds = Math.ceil(renderSec);

  const bitrate = BITRATE_BY_RESOLUTION[aspectRatio] ?? 4_500_000;
  const estimatedBytes = Math.round((bitrate / 8) * totalDurationSeconds);

  return {
    estimatedSeconds,
    estimatedLabel: formatTimeEstimate(estimatedSeconds),
    estimatedBytes,
    estimatedSizeLabel: formatFileSize(estimatedBytes),
  };
}

export function formatTimeEstimate(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
