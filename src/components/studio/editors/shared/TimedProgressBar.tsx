'use client';

import { useEffect, useState } from 'react';

interface TimedProgressBarProps {
  /** Typical duration of the job; the bar eases to ~92% over this time and waits there */
  durationMs: number;
}

/** Indeterminate-but-honest progress for provider calls with a known typical latency. */
export function TimedProgressBar({ durationMs }: TimedProgressBarProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-green-500 ease-out"
        style={{ width: started ? '92%' : '4%', transition: `width ${durationMs}ms` }}
      />
    </div>
  );
}
