type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export type { VoiceState };

interface VoiceOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

function getVoiceLang(): string {
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const langMap: Record<string, string> = {
    sk: 'sk-SK',
    cs: 'cs-CZ',
    uk: 'uk-UA',
    de: 'de-DE',
    en: 'en-US',
  };
  const prefix = browserLang.split('-')[0];
  return langMap[prefix] ?? 'en-US';
}

interface SpeechResult { transcript: string; }
interface SpeechResultList { length: number; [i: number]: { [j: number]: SpeechResult; isFinal: boolean }; }
interface SpeechEvent { results: SpeechResultList; }
interface SpeechErrorEvent { error: string; }

type AnySpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
};

type SpeechRecognitionCtor = new () => AnySpeechRecognition;

export function createVoiceInput(options?: VoiceOptions) {
  if (typeof window === 'undefined') return null;

  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  const SpeechRecognitionImpl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SpeechRecognitionImpl) return null;

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = options?.lang ?? getVoiceLang();
  recognition.continuous = options?.continuous ?? false;
  recognition.interimResults = options?.interimResults ?? true;

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    onResult: (cb: (transcript: string, isFinal: boolean) => void) => {
      recognition.onresult = (event: SpeechEvent) => {
        const result = event.results[event.results.length - 1];
        cb(result[0].transcript, result.isFinal);
      };
    },
    onEnd: (cb: () => void) => {
      recognition.onend = cb;
    },
    onError: (cb: (error: string) => void) => {
      recognition.onerror = (e: SpeechErrorEvent) => cb(e.error);
    },
  };
}
