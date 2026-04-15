'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { CHATBOT_TRANSLATIONS } from '@/lib/chatbot-translations';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_URLS: Record<string, string> = {
  restaurant:  'https://adriano-trencin.vercel.app',
  auto:        'https://auto-fix-roan.vercel.app',
  beauty:      'https://barbershop-trencin.vercel.app',
  medical:     'https://dentcare-trencin.vercel.app',
  fitness:     'https://zenflow-ivory.vercel.app',
  ecommerce:   'https://krokshop-trencin.vercel.app',
  photography: 'https://lens-art-five.vercel.app',
  bar:         'https://ember-lounge.vercel.app',
  other:       'https://vendshop.shop/#portfolio',
};

const WA_URL = 'https://wa.me/421901234567';

// Tooltip text per language
const TOOLTIP_TEXT: Record<string, string> = {
  sk: 'Chcete web? Začnite tu! 👇',
  en: 'Want a website? Start here! 👇',
  de: 'Wollen Sie eine Website? Starten Sie hier! 👇',
  cs: 'Chcete web? Začněte zde! 👇',
  uk: 'Хочете сайт? Почніть тут! 👇',
  ru: 'Хотите сайт? Начните здесь! 👇',
};

// Brief button labels per language (not in chatbot-translations to avoid touching that file)
const BRIEF_BTN: Record<string, string> = {
  sk: '📋 Vyplniť brief pre váš web →',
  en: '📋 Fill in your website brief →',
  de: '📋 Brief für Ihre Website ausfüllen →',
  cs: '📋 Vyplnit brief pro váš web →',
  uk: '📋 Заповнити бриф для вашого сайту →',
  ru: '📋 Заполнить бриф для сайта →',
};

// Locales supported in the site header. 'ru' is NOT a site locale —
// Russian speakers use one of the five supported locales, so we detect
// their preference separately via navigator.language.
const SITE_LANGS = new Set(['sk', 'en', 'de', 'cs', 'uk']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps the next-intl site locale to a chatbot translation key.
 * - Site locale found in translations → use it directly.
 * - Site locale NOT found (shouldn't happen with current LOCALE_OPTIONS) →
 *   fall back to 'ru' if the browser language is Russian, else 'en'.
 */
function resolveLang(siteLocale: string): string {
  if (SITE_LANGS.has(siteLocale)) return siteLocale;
  // 'ru' is not a header locale; detect it from the browser as a bonus path.
  if (typeof navigator !== 'undefined' &&
      navigator.language.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | 'business-type'   // step 0a — choose business type
  | 'demo'            // step 0b — show demo preview
  | 'services'        // step 1  — multi-select sections
  | 'contact'         // step 2  — enter contact
  | 'confirm'         // step 3  — review & confirm
  | 'edit'            // step 3b — pick what to edit
  | 'done';           // step 4  — thank you

interface Message {
  text: string;
  sender: 'bot' | 'user';
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingChat() {
  // ── Locale (drives chatbot language reactively) ────────────────────────────
  // useLocale() reads from NextIntlClientProvider context. When the user
  // switches language in the header (POST /api/locale + router.refresh()),
  // next-intl updates the context and this component re-renders with the
  // new locale — no extra state needed.
  const siteLocale = useLocale();
  const lang       = resolveLang(siteLocale);

  const [briefLeadId, setBriefLeadId]     = useState<string | null>(null);
  const [isOpen, setIsOpen]               = useState(false);
  const [hasStarted, setHasStarted]       = useState(false);
  const [showTooltip, setShowTooltip]     = useState(false);
  const [dotVisible, setDotVisible]       = useState(false);
  const [phase, setPhase]                 = useState<Phase>('business-type');
  const [businessType, setBusinessType]   = useState('');
  const [demoUrl, setDemoUrl]             = useState('');
  const [selectedServices, setSelected]   = useState<string[]>([]);
  const [contact, setContact]             = useState('');
  const [inputValue, setInputValue]       = useState('');
  const [messages, setMessages]           = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const t = CHATBOT_TRANSLATIONS[lang] ?? CHATBOT_TRANSLATIONS.en;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when contact phase is reached
  useEffect(() => {
    if (phase === 'contact') {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    setDotVisible(false);
    localStorage.setItem('vendshop-chat-seen', 'true');
  };

  // Show tooltip + dot on first visit (3s delay, 8s auto-hide)
  useEffect(() => {
    const seen = localStorage.getItem('vendshop-chat-seen');
    if (seen) return;
    setDotVisible(true);
    const showTimer = setTimeout(() => setShowTooltip(true), 3000);
    const hideTimer = setTimeout(() => setShowTooltip(false), 11000); // 3s delay + 8s visible
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // ── Message helpers ──────────────────────────────────────────────────────

  const pushBot  = (text: string) => setMessages((p) => [...p, { text, sender: 'bot' }]);
  const pushUser = (text: string) => setMessages((p) => [...p, { text, sender: 'user' }]);

  // ── Open / close ─────────────────────────────────────────────────────────

  const handleOpen = () => {
    dismissTooltip();
    setIsOpen(true);
    if (hasStarted) return;
    setHasStarted(true);
    // `t` is already resolved from the current site locale — use it directly.
    setMessages([{ text: t.greeting, sender: 'bot' }]);
    setPhase('business-type');
  };

  const handleToggle = () => (isOpen ? setIsOpen(false) : handleOpen());

  // Listen for programmatic open event (e.g. from HowItWorks)
  useEffect(() => {
    const handler = () => {
      dismissTooltip();
      handleOpen();
    };
    window.addEventListener('open-vendshop-chat', handler);
    return () => window.removeEventListener('open-vendshop-chat', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, lang]);

  // ── Step 0a: business type ────────────────────────────────────────────────

  const handleBusinessType = (value: string, label: string) => {
    const url = DEMO_URLS[value] ?? DEMO_URLS.other;
    setBusinessType(value);
    setDemoUrl(url);
    setSelected([]);
    pushUser(label);
    pushBot(t.demoMessage);
    setPhase('demo');
  };

  // ── Step 0b: demo → next ─────────────────────────────────────────────────

  const handleLike = () => {
    pushUser(t.likeButton);
    pushBot(t.servicesQuestion);
    setPhase('services');
  };

  // ── Step 1: multi-select services ─────────────────────────────────────────

  const toggleService = (value: string) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );

  const handleServicesNext = () => {
    if (selectedServices.length === 0) return;
    const opts = t.serviceOptions[businessType] ?? [];
    const labels = opts.filter((o) => selectedServices.includes(o.value)).map((o) => o.label);
    pushUser(labels.join(', '));
    pushBot(t.contactQuestion);
    setPhase('contact');
  };

  // ── Step 2: contact ───────────────────────────────────────────────────────

  const handleContactSubmit = () => {
    const text = inputValue.trim();
    if (!text) return;
    setContact(text);
    setInputValue('');
    pushUser(text);

    const btLabel      = t.businessTypeLabels[businessType] ?? businessType;
    const opts         = t.serviceOptions[businessType] ?? [];
    const serviceLabels = opts
      .filter((o) => selectedServices.includes(o.value))
      .map((o) => o.label)
      .join(', ');

    pushBot(t.confirmMessage({ businessTypeLabel: btLabel, services: serviceLabels, contact: text }));
    setPhase('confirm');
  };

  // ── Step 3: confirm ───────────────────────────────────────────────────────

  const handleConfirmYes = () => {
    pushUser(t.confirmYes);
    pushBot(t.thankYou(contact));
    setPhase('done');
    void submitLead();
  };

  const handleConfirmEdit = () => {
    pushUser(t.confirmEdit);
    pushBot(t.editWhat);
    setPhase('edit');
  };

  // ── Step 3b: edit target ──────────────────────────────────────────────────

  const handleEditTarget = (value: string, label: string) => {
    pushUser(label);
    if (value === 'businessType') {
      setBusinessType('');
      setSelected([]);
      setContact('');
      pushBot(t.greeting);
      setPhase('business-type');
    } else if (value === 'services') {
      pushBot(t.servicesQuestion);
      setPhase('services');
    } else {
      pushBot(t.contactQuestion);
      setPhase('contact');
    }
  };

  // ── Submit lead ───────────────────────────────────────────────────────────

  async function submitLead() {
    try {
      const opts          = t.serviceOptions[businessType] ?? [];
      const serviceLabels = opts
        .filter((o) => selectedServices.includes(o.value))
        .map((o) => o.label)
        .join(', ');

      const res  = await fetch('/api/submit-lead', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType,
          businessName: '',
          services: serviceLabels,
          style:    '',
          contact,
          language: lang,
          demoUrl,
        }),
      });
      const data = await res.json() as { ok?: boolean; leadId?: string };
      if (data.leadId) setBriefLeadId(data.leadId);
    } catch {
      // silent — lead visible in server logs
    }
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  const progressStep =
    phase === 'business-type' || phase === 'demo' ? 1 :
    phase === 'services'                          ? 2 :
    phase === 'contact'                           ? 3 :
    phase === 'confirm' || phase === 'edit'       ? 4 :
    null; // done

  const currentOpts = t.serviceOptions[businessType] ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat window ── */}
      {isOpen && (
        <div
          className={[
            'fixed z-50 flex flex-col overflow-hidden shadow-2xl',
            // Mobile: full-width slide up from bottom
            'bottom-0 right-0 w-full h-[85vh] rounded-t-2xl',
            // Desktop: 380×560 floating card
            'sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[560px] sm:rounded-2xl',
            'border border-white/10',
          ].join(' ')}
        >
          {/* ── Header ── */}
          <div className="shrink-0 flex flex-col bg-secondary px-4 pt-3 pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="text-sm font-semibold text-white">VendShop Asistent</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <CloseIcon />
              </button>
            </div>
            {/* Progress indicator */}
            <p className="mt-1 text-xs text-white/45">
              {progressStep !== null ? t.progressStep(progressStep) : t.progressDone}
            </p>
          </div>

          {/* ── Messages ── */}
          {/* Outer div scrolls; inner div is flex-col justify-end so messages
              stick to the bottom (messenger-style) when there are few of them. */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ background: 'var(--color-card)' }}
          >
            <div className="flex min-h-full flex-col justify-end gap-3 p-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={[
                      'max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                      msg.sender === 'bot'
                        ? 'rounded-tl-none text-white/90'
                        : 'bg-primary rounded-tr-none text-white',
                    ].join(' ')}
                    style={msg.sender === 'bot' ? { background: 'var(--color-bg-alt)' } : {}}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Interactive area ── */}
          <div
            className="shrink-0 border-t p-3"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >

            {/* Phase: choose business type */}
            {phase === 'business-type' && (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {t.businessTypes.map((bt) => (
                  <button
                    key={bt.value}
                    onClick={() => handleBusinessType(bt.value, bt.label)}
                    className="min-h-[48px] flex-shrink-0 w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/20 active:bg-primary/30"
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Phase: demo preview */}
            {phase === 'demo' && (
              <div className="flex flex-col gap-2">
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {t.demoButton}
                </a>
                <p className="text-center text-xs text-white/40">{t.socialProof}</p>
                <button
                  onClick={handleLike}
                  className="min-h-[48px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
                >
                  {t.likeButton}
                </button>
              </div>
            )}

            {/* Phase: multi-select services */}
            {phase === 'services' && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto">
                  {currentOpts.map((opt) => {
                    const selected = selectedServices.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleService(opt.value)}
                        className={[
                          'min-h-[48px] flex-shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                          selected
                            ? 'border-primary bg-primary text-white'
                            : 'border-primary/30 bg-transparent text-primary hover:bg-primary/10 active:bg-primary/20',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <button
                    onClick={handleServicesNext}
                    className="min-h-[48px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
                  >
                    {t.nextButton}
                  </button>
                )}
              </div>
            )}

            {/* Phase: contact input */}
            {phase === 'contact' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-white/40 leading-relaxed">{t.trustMessage}</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="tel"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
                    placeholder={t.contactPlaceholder}
                    className="flex-1 min-h-[48px] rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-primary placeholder:text-white/30"
                    style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                  />
                  <button
                    onClick={handleContactSubmit}
                    disabled={!inputValue.trim()}
                    className="flex min-h-[48px] w-12 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 active:scale-95"
                    aria-label="Send"
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>
            )}

            {/* Phase: confirm */}
            {phase === 'confirm' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmYes}
                  className="min-h-[48px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
                >
                  {t.confirmYes}
                </button>
                <button
                  onClick={handleConfirmEdit}
                  className="min-h-[48px] w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {t.confirmEdit}
                </button>
              </div>
            )}

            {/* Phase: edit menu */}
            {phase === 'edit' && (
              <div className="flex flex-col gap-1.5">
                {t.editOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleEditTarget(opt.value, opt.label)}
                    className="min-h-[48px] w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Phase: done */}
            {phase === 'done' && (
              <div className="flex flex-col gap-2">
                {briefLeadId && (
                  <a
                    href={`https://vendshop.shop/brief/${briefLeadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
                  >
                    {BRIEF_BTN[lang] ?? BRIEF_BTN.en}
                  </a>
                )}
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {t.waButton}
                </a>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Tooltip notification ── */}
      {showTooltip && !isOpen && (
        <div
          className="fixed z-[51] flex flex-col items-end"
          style={{ bottom: '100px', right: '24px' }}
        >
          <div
            className="relative rounded-lg px-4 py-3 text-sm font-medium text-white"
            style={{
              background: '#16a34a',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '240px',
            }}
          >
            {/* Close button */}
            <button
              onClick={dismissTooltip}
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label="Close tooltip"
              style={{ fontSize: '10px', lineHeight: 1 }}
            >
              ×
            </button>
            {TOOLTIP_TEXT[lang] ?? TOOLTIP_TEXT.en}
            {/* Arrow pointing down */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: '-8px',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid #16a34a',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-primary-dark active:scale-95"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
        {/* Notification dot */}
        {dotVisible && !isOpen && (
          <span className="absolute top-0 right-0 h-[10px] w-[10px] rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
        )}
      </button>
    </>
  );
}
