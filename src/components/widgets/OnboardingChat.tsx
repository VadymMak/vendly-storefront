'use client';

import { useState, useRef, useEffect } from 'react';
import { CHATBOT_TRANSLATIONS, type ButtonItem } from '@/lib/chatbot-translations';

const DEMO_URLS: Record<string, string> = {
  restaurant: 'https://adriano-trencin.vercel.app',
  auto: 'https://auto-fix-roan.vercel.app',
  beauty: 'https://barbershop-trencin.vercel.app',
  medical: 'https://dentcare-trencin.vercel.app',
  fitness: 'https://zenflow-ivory.vercel.app',
  ecommerce: 'https://krokshop-trencin.vercel.app',
  photography: 'https://lens-art-five.vercel.app',
  bar: 'https://ember-lounge.vercel.app',
};

const WA_URL = 'https://wa.me/421901234567';

const ALT_DEMOS = Object.values(DEMO_URLS);

function detectLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('sk')) return 'sk';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('cs')) return 'cs';
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('ru')) return 'ru';
  return 'en';
}

interface Message {
  text: string;
  sender: 'bot' | 'user';
  buttons?: ButtonItem[];
}

interface Answers {
  businessType: string;
  businessName: string;
  services: string;
  style: string;
  contact: string;
  language: string;
  demoUrl: string;
}

const DEFAULT_ANSWERS: Answers = {
  businessType: '',
  businessName: '',
  services: '',
  style: '',
  contact: '',
  language: 'en',
  demoUrl: '',
};

export default function OnboardingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [inputValue, setInputValue] = useState('');
  const [lang, setLang] = useState('en');
  const [altDemoIdx, setAltDemoIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const t = CHATBOT_TRANSLATIONS[lang] ?? CHATBOT_TRANSLATIONS.en;

  const pushMsg = (msg: Message) => setMessages((prev) => [...prev, msg]);

  const handleOpen = () => {
    setIsOpen(true);
    if (hasStarted) return;
    setHasStarted(true);
    const detectedLang = detectLanguage();
    setLang(detectedLang);
    const tr = CHATBOT_TRANSLATIONS[detectedLang] ?? CHATBOT_TRANSLATIONS.en;
    setAnswers((prev) => ({ ...prev, language: detectedLang }));
    setMessages([{ text: tr.greeting, sender: 'bot', buttons: tr.businessTypes }]);
    setStep(0);
  };

  const handleButtonClick = (value: string, label: string) => {
    // Open external URL without advancing state
    if (value.startsWith('open:')) {
      window.open(value.slice(5), '_blank', 'noopener,noreferrer');
      return;
    }

    pushMsg({ text: label, sender: 'user' });

    switch (step) {
      case 0: {
        // Business type selected
        const demoUrl = DEMO_URLS[value] ?? '';
        setAnswers((prev) => ({ ...prev, businessType: value, demoUrl }));

        if (value === 'other') {
          pushMsg({ text: t.nameQuestion, sender: 'bot' });
          setStep(2);
        } else {
          const buttons: ButtonItem[] = [
            ...(demoUrl ? [{ label: t.demoButton, value: `open:${demoUrl}` }] : []),
            { label: t.likeButton, value: 'continue' },
            { label: t.anotherButton, value: 'another' },
          ];
          pushMsg({ text: t.demoMessage, sender: 'bot', buttons });
          setStep(1);
        }
        break;
      }

      case 1: {
        if (value === 'continue') {
          pushMsg({ text: t.nameQuestion, sender: 'bot' });
          setStep(2);
        } else if (value === 'another') {
          const idx = altDemoIdx % ALT_DEMOS.length;
          const newDemoUrl = ALT_DEMOS[idx] ?? DEMO_URLS.restaurant;
          setAltDemoIdx((i) => i + 1);
          const buttons: ButtonItem[] = [
            { label: t.demoButton, value: `open:${newDemoUrl}` },
            { label: t.likeButton, value: 'continue' },
            { label: t.anotherButton, value: 'another' },
          ];
          pushMsg({ text: t.demoMessage, sender: 'bot', buttons });
          // stay at step 1
        }
        break;
      }

      case 4: {
        // Style selected
        setAnswers((prev) => ({ ...prev, style: value }));
        pushMsg({ text: t.contactQuestion, sender: 'bot' });
        setStep(5);
        break;
      }

      case 6: {
        // Confirmation
        if (value === 'yes') {
          pushMsg({
            text: t.thankYou(answers.contact),
            sender: 'bot',
            buttons: [{ label: t.waButton, value: `open:${WA_URL}` }],
          });
          setStep(7);
          void submitLead(answers);
        } else {
          pushMsg({ text: t.editWhat, sender: 'bot', buttons: t.editOptions });
          setStep(8);
        }
        break;
      }

      case 8: {
        // Edit selection → jump back to that step
        const stepMap: Record<string, number> = {
          name: 2,
          services: 3,
          style: 4,
          contact: 5,
        };
        const target = stepMap[value] ?? 2;

        if (value === 'style') {
          pushMsg({ text: t.styleQuestion, sender: 'bot', buttons: t.styleOptions });
        } else {
          const questionMap: Record<string, string> = {
            name: t.nameQuestion,
            services: t.servicesQuestion,
            contact: t.contactQuestion,
          };
          pushMsg({ text: questionMap[value] ?? t.nameQuestion, sender: 'bot' });
        }
        setStep(target);
        break;
      }
    }
  };

  const handleTextSubmit = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    pushMsg({ text, sender: 'user' });

    switch (step) {
      case 2: {
        // Business name
        setAnswers((prev) => ({ ...prev, businessName: text }));
        pushMsg({ text: t.servicesQuestion, sender: 'bot' });
        setStep(3);
        break;
      }
      case 3: {
        // Services
        setAnswers((prev) => ({ ...prev, services: text }));
        pushMsg({ text: t.styleQuestion, sender: 'bot', buttons: t.styleOptions });
        setStep(4);
        break;
      }
      case 5: {
        // Contact — build confirmation
        const updated: Answers = { ...answers, contact: text };
        setAnswers(updated);

        const btLabel =
          t.businessTypes.find((bt) => bt.value === updated.businessType)?.label ??
          updated.businessType;
        const styleLabel =
          t.styleOptions.find((s) => s.value === updated.style)?.label ?? updated.style;

        pushMsg({
          text: t.confirmMessage({
            businessName: updated.businessName,
            businessType: btLabel,
            services: updated.services,
            style: styleLabel,
          }),
          sender: 'bot',
          buttons: [
            { label: t.confirmYes, value: 'yes' },
            { label: t.confirmEdit, value: 'edit' },
          ],
        });
        setStep(6);
        break;
      }
    }
  };

  async function submitLead(data: Answers) {
    try {
      await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // silent fail — lead still visible in server logs
    }
  }

  const showInput = step === 2 || step === 3 || step === 5;

  return (
    <>
      {/* ── Chat window ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between bg-secondary px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-sm font-semibold text-white">VendShop Asistent</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xl leading-none text-white/50 transition-colors hover:text-white"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-hide"
            style={{ background: 'var(--color-card)' }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[88%] space-y-2">
                  {/* Bubble */}
                  <div
                    className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.sender === 'bot'
                        ? 'rounded-tl-none text-white/90'
                        : 'bg-primary rounded-tr-none text-white'
                    }`}
                    style={
                      msg.sender === 'bot'
                        ? { background: 'var(--color-bg-alt)' }
                        : {}
                    }
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Buttons — only on the last message */}
                  {i === messages.length - 1 && msg.buttons && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.value}
                          onClick={() => handleButtonClick(btn.value, btn.label)}
                          className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Text input */}
          {showInput && (
            <div
              className="flex shrink-0 gap-2 border-t p-3"
              style={{
                background: 'var(--color-card)',
                borderColor: 'var(--color-border)',
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                placeholder="..."
                className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-primary placeholder:text-white/30"
                style={{
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!inputValue.trim()}
                className="flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M4 9h10M10 5l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:scale-110 hover:bg-primary-dark"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        )}
      </button>
    </>
  );
}
