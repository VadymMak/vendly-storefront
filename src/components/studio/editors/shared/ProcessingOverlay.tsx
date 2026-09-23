import type { ProcessingOverlayProps } from '@/lib/types';

export function ProcessingOverlay({ visible, message, submessage }: ProcessingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
      {message && (
        <p className="text-sm font-medium text-gray-200">{message}</p>
      )}
      {submessage && (
        <p className="text-xs text-gray-500">{submessage}</p>
      )}
    </div>
  );
}
