'use client';

import { useState, useEffect, useRef } from 'react';
import { createVoiceInput } from '@/lib/studio/mobile/voice';
import type { VoiceState } from '@/lib/studio/mobile/voice';

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function MobileVoiceInput({ onTranscript, disabled }: Props) {
  const [state, setState] = useState<VoiceState>('idle');
  const [supported, setSupported] = useState(true);
  const voiceRef = useRef<ReturnType<typeof createVoiceInput>>(null);

  useEffect(() => {
    const v = createVoiceInput();
    if (!v) { setSupported(false); return; }
    voiceRef.current = v;

    v.onResult((transcript, isFinal) => {
      if (isFinal) {
        onTranscript(transcript);
        setState('idle');
      }
    });
    v.onEnd(() => setState('idle'));
    v.onError(() => setState('idle'));
  }, [onTranscript]);

  if (!supported) return null;

  function toggle() {
    if (state === 'listening') {
      voiceRef.current?.stop();
      setState('idle');
    } else {
      voiceRef.current?.start();
      setState('listening');
    }
  }

  return (
    <div className="relative">
      {state === 'listening' && (
        <span className="absolute inset-0 rounded-full animate-[pulse-ring_1.5s_ease-in-out_infinite] bg-red-500/30" />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={state === 'listening' ? 'Stop recording' : 'Start voice input'}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          state === 'listening' ? 'bg-red-500 text-white' : 'bg-white/[0.08] text-gray-400'
        }`}
      >
        {state === 'listening' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
