'use client';

import { useTranslations } from 'next-intl';
import type { CreateBusinessType, CreatePalette, CreateState } from '@/lib/types';

const DAYS_PREVIEW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAYS_PREVIEW)[number];

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  state: CreateState;
  biz: CreateBusinessType;
  palette: CreatePalette;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
}

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length < 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pickContrast(hex: string): string {
  return hexLuminance(hex) > 0.55 ? '#0b0f1a' : '#ffffff';
}

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function initials(s: string): string {
  return (s || 'VS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface SiteColors {
  bg: string;
  fg: string;
  muted: string;
  primary: string;
  card: string;
  line: string;
  btnFg: string;
}

function buildColors(palette: CreatePalette): SiteColors {
  const isDark = hexLuminance(palette.bg) < 0.4;
  return {
    bg: palette.bg,
    fg: palette.fg,
    muted: palette.muted,
    primary: palette.primary,
    card: palette.card,
    line: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    btnFg: pickContrast(palette.primary),
  };
}

// ── Icon set (inline SVG, no external library) ──────────────────────────────

function IconArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconMenu({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function IconTablet() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="18" r="0.5" />
    </svg>
  );
}
function IconMobile() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" />
    </svg>
  );
}

// ── Site nav languages (demo) ────────────────────────────────────────────────

function LangSwitch({ isDark }: { isDark: boolean }) {
  const langs = ['SK', 'EN', 'DE'];
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 0,
        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
        borderRadius: 999,
        padding: 2,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {langs.map((l, i) => (
        <span
          key={l}
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: i === 0 ? (isDark ? 'rgba(255,255,255,0.92)' : '#111') : 'transparent',
            color: i === 0 ? (isDark ? '#111' : '#fff') : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

// ── Placeholder image (hatched) ───────────────────────────────────────────────

function PhImg({ label, isDark, style }: { label: string; isDark: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: isDark
          ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 12px, rgba(255,255,255,0.08) 12px 24px), linear-gradient(135deg, #243449, #1a2336)'
          : 'repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0 12px, rgba(0,0,0,0.06) 12px 24px), linear-gradient(135deg, #e8edf5, #dce4ef)',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
        fontFamily: 'monospace',
        fontSize: 10,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center' as const,
        padding: 8,
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {label}
    </div>
  );
}

// ── Contact info row ──────────────────────────────────────────────────────────

function InfoRow({ icon, text, c }: { icon: React.ReactNode; text: string; c: SiteColors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: c.fg }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `color-mix(in srgb, ${c.primary} 14%, transparent)`,
          color: c.primary,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ whiteSpace: 'pre-line' }}>{text}</div>
    </div>
  );
}

function PhoneIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
}
function MailIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
}
function MapPinIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

// ── Main preview frame ────────────────────────────────────────────────────────

function SitePreview({
  state,
  biz,
  palette,
  viewport,
}: {
  state: CreateState;
  biz: CreateBusinessType;
  palette: CreatePalette;
  viewport: Viewport;
}) {
  const t = useTranslations('create.preview');
  const td = useTranslations('create.days');
  const c = buildColors(palette);
  const isDark = hexLuminance(palette.bg) < 0.4;
  const tpl = biz.template;
  const mobile = viewport === 'mobile';

  const name = state.businessName || `${biz.id.charAt(0).toUpperCase() + biz.id.slice(1)} Co.`;
  const phone = state.phone || '+421 900 000 000';
  const email = state.email || `hello@${toSlug(name) || 'yoursite'}.com`;
  const address = state.address || 'Hlavná 12, Bratislava';
  const description = state.description || tpl.heroSub;

  const displayFonts: Record<string, string> = {
    classic: "'Inter', sans-serif",
    medical: "'Inter', sans-serif",
    bold: "'Inter', sans-serif",
    warm: "'Georgia', serif",
    natural: "'Georgia', serif",
    dark: "'Inter', sans-serif",
  };
  const displayFont = displayFonts[biz.style] ?? "'Inter', sans-serif";

  const hPad = mobile ? '14px 16px' : '16px 36px';
  const sPad = mobile ? '24px 16px' : '48px 36px 40px';

  return (
    <div
      style={{
        background: c.bg,
        color: c.fg,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${c.line}`,
          padding: hPad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {state.logoPhoto ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundImage: `url(${state.logoPhoto})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: `1px solid ${c.line}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: c.primary,
                color: c.btnFg,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 13,
                fontFamily: displayFont,
              }}
            >
              {initials(name)}
            </div>
          )}
          <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: mobile ? 16 : 18, letterSpacing: '-0.01em' }}>
            {name}
          </span>
        </div>

        {!mobile && (
          <nav style={{ display: 'flex', gap: 20 }}>
            {[tpl.sectionsTitle, t('navAbout'), t('navGallery'), t('navContact')].map((item) => (
              <span key={item} style={{ fontSize: 13, fontWeight: 500, color: c.fg, opacity: 0.8, cursor: 'pointer' }}>
                {item}
              </span>
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangSwitch isDark={isDark} />
          {!mobile && (
            <button
              style={{
                background: c.primary,
                color: c.btnFg,
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tpl.ctaPrimary}
            </button>
          )}
          {mobile && (
            <span style={{ color: c.fg }}>
              <IconMenu size={18} />
            </span>
          )}
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          padding: sPad,
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1.1fr 1fr',
          gap: mobile ? 18 : 32,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: c.primary,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            {tpl.heroKicker}
          </div>
          <h1
            style={{
              fontFamily: displayFont,
              fontSize: mobile ? 32 : 52,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              margin: '0 0 14px',
              whiteSpace: 'pre-line',
            }}
          >
            {tpl.heroTitle}
          </h1>
          <p style={{ color: c.muted, fontSize: mobile ? 14 : 16, lineHeight: 1.55, margin: '0 0 20px', maxWidth: 500 }}>
            {description}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{
                background: c.primary,
                color: c.btnFg,
                border: 'none',
                borderRadius: 9,
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tpl.ctaPrimary} <IconArrowRight size={14} />
            </button>
            <button
              style={{
                background: 'transparent',
                color: c.fg,
                border: `1px solid ${c.line}`,
                borderRadius: 9,
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tpl.ctaSecondary}
            </button>
          </div>
        </div>

        {/* Hero image */}
        <div
          style={{
            aspectRatio: mobile ? '16 / 11' : '5 / 6',
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${c.line}`,
            background: c.card,
          }}
        >
          {state.heroPhoto ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${state.heroPhoto})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <PhImg label={`HERO IMAGE · ${biz.id}`} isDark={isDark} />
          )}
        </div>
      </section>

      {/* Services section */}
      <section style={{ padding: mobile ? '0 16px 28px' : '0 36px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2
            style={{
              fontFamily: displayFont,
              fontSize: mobile ? 22 : 28,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              margin: 0,
            }}
          >
            {tpl.sectionsTitle}
          </h2>
          <span style={{ color: c.muted, fontSize: 12 }}>{t('viewAll')}</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {tpl.sections.map((s, i) => (
            <div
              key={i}
              style={{
                background: c.card,
                border: `1px solid ${c.line}`,
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: c.primary, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>0{i + 1}</div>
              <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {s.title}
              </div>
              <div style={{ color: c.muted, fontSize: 12, marginTop: 4, fontWeight: 500 }}>{s.meta}</div>
              <p style={{ color: c.fg, opacity: 0.8, fontSize: 13, lineHeight: 1.55, marginTop: 8, marginBottom: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery strip */}
      <section style={{ padding: mobile ? '0 16px 28px' : '0 36px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: displayFont, fontSize: mobile ? 18 : 22, fontWeight: 700, margin: 0 }}>
            {tpl.galleryLabel}
          </h2>
          <span style={{ color: c.muted, fontSize: 11 }}>{t('galleryOf', { n: state.gallery.length })}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 7 }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const src = state.gallery[i];
            return (
              <div
                key={i}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 9,
                  overflow: 'hidden',
                  border: `1px solid ${c.line}`,
                  background: c.card,
                }}
              >
                {src ? (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundImage: `url(${src})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ) : (
                  <PhImg label={`IMG ${i + 1}`} isDark={isDark} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact */}
      <section style={{ padding: mobile ? '0 16px 28px' : '0 36px 52px' }}>
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.line}`,
            borderRadius: 12,
            padding: mobile ? 18 : 28,
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1.2fr 1fr',
            gap: 24,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: displayFont,
                fontSize: mobile ? 22 : 26,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                margin: '0 0 10px',
              }}
            >
              {t('contactTitle')}
            </h2>
            <p style={{ color: c.muted, fontSize: 13.5, lineHeight: 1.55, margin: '0 0 18px' }}>
              {t('contactSub')}
            </p>
            <div style={{ display: 'grid', gap: 9 }}>
              <InfoRow icon={<MapPinIcon />} text={address} c={c} />
              <InfoRow icon={<PhoneIcon />} text={phone} c={c} />
              <InfoRow icon={<MailIcon />} text={email} c={c} />
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: c.primary,
                marginBottom: 10,
              }}
            >
              {t('hoursLabel')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', alignItems: 'center' }}>
              {DAYS_PREVIEW.map((day: DayKey) => {
                const s = state.hoursSchedule[day];
                return [
                  <span key={`${day}-d`} style={{ fontSize: 11, fontWeight: 600, color: c.muted }}>{td(day)}</span>,
                  <span key={`${day}-t`} style={{ fontSize: 12, color: c.fg }}>
                    {s.open ? `${s.from}–${s.to}` : td('closed')}
                  </span>,
                ];
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${c.line}`,
          padding: mobile ? '16px' : '20px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: c.muted,
          fontSize: 11.5,
        }}
      >
        <div>© 2026 {name}</div>
        <div>{t('madeWith')}</div>
      </footer>
    </div>
  );
}

// ── Panel wrapper with toolbar ────────────────────────────────────────────────

export default function PreviewPanel({ state, biz, palette, viewport, onViewportChange }: PreviewPanelProps) {
  const t = useTranslations('create.preview');
  const isDark = hexLuminance(palette.bg) < 0.4;
  const domain = `${toSlug(state.businessName) || 'yoursite'}.vendshop.shop`;

  const maxWidths: Record<Viewport, string> = {
    desktop: '1180px',
    tablet: '720px',
    mobile: '380px',
  };

  const viewportIcons: Record<Viewport, React.ReactNode> = {
    desktop: <IconMonitor />,
    tablet: <IconTablet />,
    mobile: <IconMobile />,
  };

  return (
    <div
      style={{
        background: '#060a14',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 56px)',
        flex: 1,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #253349',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15,23,42,0.6)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(22,163,74,0.12)',
              color: '#86efac',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: '#22c55e',
                boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
              }}
            />
            {t('live')}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {isDark ? '◉' : '○'} {biz.style}
          </span>
        </div>

        {/* URL pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            background: '#0f1a2e',
            border: '1px solid #253349',
            borderRadius: 999,
            fontSize: 11.5,
            color: '#94a3b8',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e' }} />
          {domain}
        </div>

        {/* Viewport tabs */}
        <div
          style={{
            display: 'flex',
            gap: 3,
            padding: 3,
            background: '#0f1a2e',
            border: '1px solid #253349',
            borderRadius: 8,
          }}
        >
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewportChange(v)}
              style={{
                background: viewport === v ? '#243449' : 'transparent',
                border: 'none',
                color: viewport === v ? '#e2e8f0' : '#94a3b8',
                padding: '5px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {viewportIcons[v]}
              <span style={{ textTransform: 'capitalize' }}>{t(v)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 20,
          display: 'grid',
          placeItems: 'start center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: maxWidths[viewport],
            background: palette.bg,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
            transition: 'max-width 0.2s',
          }}
        >
          <SitePreview state={state} biz={biz} palette={palette} viewport={viewport} />
        </div>
      </div>
    </div>
  );
}
