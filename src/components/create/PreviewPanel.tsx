'use client';

import { useTranslations } from 'next-intl';
import type { CreateBusinessType, CreateHeroLayout, CreatePalette, CreateState, CreateTemplateStyle } from '@/lib/types';

const DAYS_PREVIEW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAYS_PREVIEW)[number];

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  state: CreateState;
  biz: CreateBusinessType;
  palette: CreatePalette;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  onHeroLayoutChange: (layout: CreateHeroLayout) => void;
}

// ── Fake testimonials per business style ──────────────────────────────────────

const TESTIMONIALS: Record<string, { text: string; name: string; role: string }[]> = {
  barbershop: [
    { text: 'Best cut in town. Always on point, never rushed — and online booking is a lifesaver.', name: 'Tomáš K.', role: 'Regular client' },
    { text: 'Came in nervous, left looking like a completely different person. Highly recommend.', name: 'Martin P.', role: 'New client' },
    { text: 'Booked in 30 seconds. Clean shop, skilled hands, good vibes.', name: 'Jakub N.', role: 'Monthly visitor' },
  ],
  restaurant: [
    { text: 'The seasonal menu is why we come back every week. Honest food, no pretension.', name: 'Anna S.', role: 'Food enthusiast' },
    { text: 'Reserved for our anniversary — exceeded every expectation. Beautiful evening.', name: 'Miroslav & Zuzka', role: 'Returning guests' },
    { text: 'Quiet atmosphere, excellent wine list, and the staff actually knew the menu.', name: 'Petra V.', role: 'Local regular' },
  ],
  beauty: [
    { text: 'Finally a salon that listens. My hair has never felt this healthy.', name: 'Sofia M.', role: 'Regular client' },
    { text: 'The team is experienced, calm, and genuinely talented. Worth every cent.', name: 'Katarína B.', role: 'Satisfied customer' },
    { text: 'Booked a facial and left glowing. The products they use are exceptional.', name: 'Monika T.', role: 'New client' },
  ],
  auto: [
    { text: 'Fixed my brakes same day, gave me an honest quote upfront. No surprises.', name: 'Pavel H.', role: 'Car owner' },
    { text: 'Been bringing both my cars here for 4 years. Never once felt overcharged.', name: 'Ján R.', role: 'Regular customer' },
    { text: 'Quick diagnosis, transparent pricing, and they actually called me when it was ready.', name: 'Lukáš F.', role: 'First-time customer' },
  ],
  dentist: [
    { text: 'I was terrified of dentists for years. This practice changed that completely.', name: 'Eva K.', role: 'Long-term patient' },
    { text: 'Gentle, modern, and they explain everything before they do it. Top service.', name: 'Richard M.', role: 'Patient' },
    { text: 'Saturday appointments are a game-changer. Professional and kind staff.', name: 'Silvia O.', role: 'New patient' },
  ],
  yoga: [
    { text: 'Classes stay small, the teachers know your name and your progress. Rare.', name: 'Dominika L.', role: 'Member for 2 years' },
    { text: 'I tried yoga at a big gym — no comparison. This is the real thing.', name: 'Marek V.', role: 'New member' },
    { text: 'The morning sessions reset my entire week. Cannot imagine life without this.', name: 'Alžbeta P.', role: 'Daily practitioner' },
  ],
  photography: [
    { text: 'Shot our wedding with such care. The film photos are everything we hoped for.', name: 'Jana & Peter', role: 'Wedding clients' },
    { text: 'Worked with us on a brand shoot — thoughtful, patient, stunning results.', name: 'Natália R.', role: 'Brand client' },
    { text: 'The editing style is distinctive without being overdone. Brilliant eye.', name: 'Tomáš W.', role: 'Editorial client' },
  ],
  agency: [
    { text: 'They shipped a product that felt considered, not just built. Big difference.', name: 'Ondrej K.', role: 'Startup founder' },
    { text: 'Honest about timelines, decisive on creative, and delivered on every promise.', name: 'Zuzana M.', role: 'Marketing director' },
    { text: 'Our conversion rate went up 34% after the redesign. Data speaks for itself.', name: 'Radoslav P.', role: 'E-commerce owner' },
  ],
  _default: [
    { text: 'Excellent service from start to finish. Exactly what we were looking for.', name: 'Mária D.', role: 'Customer' },
    { text: 'Professional, fast, and fairly priced. Will definitely return.', name: 'Ivan S.', role: 'Regular client' },
    { text: 'Really impressed with the quality and attention to detail.', name: 'Petra J.', role: 'New customer' },
  ],
};

// ── Color helpers ─────────────────────────────────────────────────────────────

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
  return (s || 'VS').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

interface SiteColors {
  bg: string; fg: string; muted: string; primary: string; card: string; line: string; btnFg: string;
}

function buildColors(palette: CreatePalette): SiteColors {
  const isDark = hexLuminance(palette.bg) < 0.4;
  return {
    bg: palette.bg, fg: palette.fg, muted: palette.muted, primary: palette.primary, card: palette.card,
    line: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    btnFg: pickContrast(palette.primary),
  };
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconArrowRight({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function IconMenu({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
function IconMonitor() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
}
function IconTablet() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="18" r="0.5" /></svg>;
}
function IconMobile() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>;
}
function IconStar({ size = 13, filled = true, color = '#f59e0b' }: { size?: number; filled?: boolean; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
function IconQuote({ color = 'currentColor' }: { color?: string }) {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>;
}

// ── LangSwitch demo ───────────────────────────────────────────────────────────

function LangSwitch({ isDark }: { isDark: boolean }) {
  return (
    <div style={{ display: 'inline-flex', gap: 0, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 999, padding: 2, fontSize: 11, fontWeight: 600 }}>
      {['SK', 'EN', 'DE'].map((l, i) => (
        <span key={l} style={{ padding: '3px 9px', borderRadius: 999, background: i === 0 ? (isDark ? 'rgba(255,255,255,0.92)' : '#111') : 'transparent', color: i === 0 ? (isDark ? '#111' : '#fff') : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>{l}</span>
      ))}
    </div>
  );
}

// ── Placeholder image ─────────────────────────────────────────────────────────

function PhImg({ label, isDark, style }: { label: string; isDark: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ background: isDark ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 12px, rgba(255,255,255,0.08) 12px 24px), linear-gradient(135deg, #243449, #1a2336)' : 'repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0 12px, rgba(0,0,0,0.06) 12px 24px), linear-gradient(135deg, #e8edf5, #dce4ef)', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: 10, display: 'grid', placeItems: 'center', textAlign: 'center' as const, padding: 8, width: '100%', height: '100%', ...style }}>
      {label}
    </div>
  );
}

// ── Map placeholder ───────────────────────────────────────────────────────────

function MapPlaceholder({ isDark, primary, label, openLabel }: { isDark: boolean; primary: string; label: string; openLabel: string }) {
  const bg = isDark ? '#1a2336' : '#dce4ef';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const roadColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: bg, borderRadius: 10, overflow: 'hidden', minHeight: 140 }}>
      {/* Grid background */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* Horizontal roads */}
        {[22, 42, 62].map((y) => <rect key={`h${y}`} x="0" y={`${y}%`} width="100%" height="8" fill={roadColor} />)}
        {/* Vertical roads */}
        {[18, 38, 62, 82].map((x) => <rect key={`v${x}`} x={`${x}%`} y="0" width="7" height="100%" fill={roadColor} />)}
        {/* Block fills */}
        {[[0,0,18,22],[25,0,13,22],[45,0,17,22],[69,0,13,22],[0,30,18,12],[25,30,13,12],[45,30,17,12],[69,30,13,12],[0,54,18,46],[25,54,13,46],[45,54,17,46],[69,54,13,46]].map(([x,y,w,h], i) => (
          <rect key={i} x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} fill={gridColor} />
        ))}
      </svg>
      {/* Pin */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -80%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50% 50% 50% 0', background: primary, transform: 'rotate(-45deg)', boxShadow: '0 3px 10px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, background: 'rgba(255,255,255,0.85)', borderRadius: '50%', transform: 'rotate(45deg)' }} />
        </div>
        <div style={{ width: 4, height: 4, background: primary, borderRadius: '50%', opacity: 0.5, marginTop: -2 }} />
      </div>
      {/* Label pill */}
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: isDark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.92)', borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        {label} · {openLabel} ↗
      </div>
    </div>
  );
}

// ── Contact info row ──────────────────────────────────────────────────────────

function InfoRow({ icon, text, c }: { icon: React.ReactNode; text: string; c: SiteColors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: c.fg }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: `color-mix(in srgb, ${c.primary} 14%, transparent)`, color: c.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ whiteSpace: 'pre-line' }}>{text}</div>
    </div>
  );
}

function PhoneIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>; }
function MailIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>; }
function MapPinIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>; }

// ── Section header helper ─────────────────────────────────────────────────────

function SectionHeader({ title, sub, c, font, mobile, viewAll }: { title: string; sub?: string; c: SiteColors; font: string; mobile: boolean; viewAll?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <h2 style={{ fontFamily: font, fontSize: mobile ? 20 : 26, fontWeight: 700, letterSpacing: '-0.015em', margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: c.muted, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 }}>{sub}</p>}
      </div>
      {viewAll && <span style={{ color: c.muted, fontSize: 12, flexShrink: 0, marginLeft: 16 }}>{viewAll}</span>}
    </div>
  );
}

// ── Main site preview ─────────────────────────────────────────────────────────

function SitePreview({ state, biz, palette, viewport }: { state: CreateState; biz: CreateBusinessType; palette: CreatePalette; viewport: Viewport }) {
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
    classic: "'Inter', sans-serif", medical: "'Inter', sans-serif", bold: "'Inter', sans-serif",
    warm: "'Georgia', serif", natural: "'Georgia', serif", dark: "'Inter', sans-serif",
  };
  const displayFont = displayFonts[biz.style] ?? "'Inter', sans-serif";

  const hPad = mobile ? '12px 16px' : '16px 36px';
  const sPad = mobile ? '24px 16px' : '48px 36px 40px';
  const secPad = mobile ? '0 16px 28px' : '0 36px 44px';

  const reviews = TESTIMONIALS[biz.id] ?? TESTIMONIALS._default;
  const visibleReviews = mobile ? reviews.slice(0, 1) : reviews.slice(0, 3);

  return (
    <div style={{ background: c.bg, color: c.fg, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, lineHeight: 1.5, WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: `1px solid ${c.line}`, padding: hPad, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {state.logoPhoto ? (
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundImage: `url(${state.logoPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${c.line}` }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: c.primary, color: c.btnFg, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, fontFamily: displayFont }}>{initials(name)}</div>
          )}
          <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: mobile ? 16 : 18, letterSpacing: '-0.01em' }}>{name}</span>
        </div>
        {!mobile && (
          <nav style={{ display: 'flex', gap: 20 }}>
            {[tpl.sectionsTitle, t('navAbout'), t('navGallery'), t('navContact')].map((item) => (
              <span key={item} style={{ fontSize: 13, fontWeight: 500, color: c.fg, opacity: 0.8, cursor: 'pointer' }}>{item}</span>
            ))}
          </nav>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangSwitch isDark={isDark} />
          {!mobile && (
            <button style={{ background: c.primary, color: c.btnFg, border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {tpl.ctaPrimary}
            </button>
          )}
          {mobile && <span style={{ color: c.fg }}><IconMenu size={18} /></span>}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      {(() => {
        // Live templates use two hero shapes: full-bleed image + overlay
        // (classic/bold/dark) and split-half image+text (warm/natural/medical).
        // Default ('auto') tracks biz.style; user can force 'split' or 'full'
        // via the toolbar toggle, in which case we render that shape regardless.
        const FULL_BLEED_STYLES: ReadonlyArray<CreateTemplateStyle> = ['classic', 'bold', 'dark'];
        const autoIsFullBleed = FULL_BLEED_STYLES.includes(biz.style);
        const isFullBleed =
            state.heroLayout === 'full'  ? true
          : state.heroLayout === 'split' ? false
          :                                 autoIsFullBleed;

        if (!isFullBleed) {
          // Split-half (warm / natural / medical) — preserved as-is
          return (
            <section style={{ padding: sPad, display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.1fr 1fr', gap: mobile ? 18 : 32, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: c.primary, fontWeight: 600, marginBottom: 12 }}>{tpl.heroKicker}</div>
                <h1 style={{ fontFamily: displayFont, fontSize: mobile ? 30 : 52, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 0 14px', whiteSpace: 'pre-line' }}>{tpl.heroTitle}</h1>
                <p style={{ color: c.muted, fontSize: mobile ? 14 : 16, lineHeight: 1.55, margin: '0 0 20px', maxWidth: 500 }}>{description}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button style={{ background: c.primary, color: c.btnFg, border: 'none', borderRadius: 9, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {tpl.ctaPrimary} <IconArrowRight size={14} />
                  </button>
                  <button style={{ background: 'transparent', color: c.fg, border: `1px solid ${c.line}`, borderRadius: 9, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {tpl.ctaSecondary}
                  </button>
                </div>
              </div>
              <div style={{ aspectRatio: mobile ? '16 / 11' : '5 / 6', borderRadius: 14, overflow: 'hidden', border: `1px solid ${c.line}`, background: c.card }}>
                {state.heroPhoto ? (
                  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${state.heroPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : (
                  <PhImg label={`HERO · ${biz.id.toUpperCase()}`} isDark={isDark} />
                )}
              </div>
            </section>
          );
        }

        // ── Full-bleed variants (classic / bold / dark) ─────────────────────
        const heroMinH = mobile ? 360 : 520;

        // When the user forced 'full' on a non-fullbleed biz.style (warm /
        // natural / medical), fall back to the 'bold' sub-variant — it's the
        // most universal full-bleed treatment (bare text on overlay).
        type FullBleedSubStyle = 'classic' | 'bold' | 'dark';
        const subStyle: FullBleedSubStyle =
          (FULL_BLEED_STYLES as ReadonlyArray<string>).includes(biz.style)
            ? (biz.style as FullBleedSubStyle)
            : 'bold';

        // classic = bottom-up gradient (text card sits over a brighter top);
        // bold/dark = flat overlay so the headline reads directly over image.
        const overlay =
          subStyle === 'classic'
            ? 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.40) 60%, rgba(0,0,0,0.15) 100%)'
            : subStyle === 'bold'
              ? 'rgba(0,0,0,0.50)'
              : 'rgba(0,0,0,0.55)';

        // Lighten primary for eyebrow so dark palette accents stay visible
        // over the dimming overlay. color-mix is already used elsewhere in
        // this file (testimonials section).
        const eyebrowColor = `color-mix(in srgb, ${c.primary} 60%, #ffffff)`;

        const titleSize =
          subStyle === 'bold' ? (mobile ? 36 : 64) :
          subStyle === 'dark' ? (mobile ? 32 : 56) :
          (mobile ? 30 : 52);

        const titleShadow =
          subStyle === 'bold' ? '0 2px 24px rgba(0,0,0,0.45)' :
          subStyle === 'dark' ? '0 2px 20px rgba(0,0,0,0.4)' :
          '0 1px 12px rgba(0,0,0,0.35)';

        const PrimaryCta = (
          <button style={{ background: c.primary, color: c.btnFg, border: 'none', borderRadius: 9, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {tpl.ctaPrimary} <IconArrowRight size={14} />
          </button>
        );
        const OutlineCta = (
          <button style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.45)', borderRadius: 9, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {tpl.ctaSecondary}
          </button>
        );

        const eyebrowEl = (
          <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: eyebrowColor, fontWeight: 600, marginBottom: 12 }}>{tpl.heroKicker}</div>
        );

        const headlineEl = (
          <h1 style={{ fontFamily: displayFont, fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 0 14px', whiteSpace: 'pre-line', color: '#ffffff', textShadow: titleShadow }}>{tpl.heroTitle}</h1>
        );

        const subEl = (
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: mobile ? 14 : 16, lineHeight: 1.55, margin: '0 0 20px', maxWidth: 520 }}>{description}</p>
        );

        // dark = centered content; classic/bold = left-aligned
        const isCentered = subStyle === 'dark';
        const contentJustify: 'flex-start' | 'center' = isCentered ? 'center' : 'flex-start';
        const innerTextAlign: 'left' | 'center' = isCentered ? 'center' : 'left';

        // classic wraps content in a glass card; bold/dark put text directly
        // on the image with text-shadow for legibility.
        const innerStyle: React.CSSProperties =
          subStyle === 'classic'
            ? {
                maxWidth: 680,
                padding: mobile ? 20 : 28,
                background: 'rgba(15,23,42,0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 16,
                textAlign: 'left' as const,
              }
            : isCentered
              ? { maxWidth: 800, textAlign: 'center' as const, margin: '0 auto' }
              : { maxWidth: 760, textAlign: 'left' as const };

        return (
          <section style={{ position: 'relative', minHeight: heroMinH, overflow: 'hidden' }}>
            {/* Background image */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              {state.heroPhoto ? (
                <div style={{ width: '100%', height: '100%', backgroundImage: `url(${state.heroPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              ) : (
                <PhImg label={`HERO · ${biz.id.toUpperCase()}`} isDark={isDark} />
              )}
            </div>
            {/* Overlay */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: overlay }} />
            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, padding: sPad, minHeight: heroMinH, display: 'flex', alignItems: 'center', justifyContent: contentJustify }}>
              <div style={innerStyle}>
                {eyebrowEl}
                {headlineEl}
                {subEl}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: innerTextAlign === 'center' ? 'center' : 'flex-start' }}>
                  {PrimaryCta}
                  {OutlineCta}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── Services / Menu ──────────────────────────────────────────────────── */}
      <section style={{ padding: secPad }}>
        <SectionHeader title={tpl.sectionsTitle} c={c} font={displayFont} mobile={mobile} viewAll={t('viewAll')} />
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {tpl.sections.map((s, i) => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: 18 }}>
              <div style={{ color: c.primary, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>0{i + 1}</div>
              <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{s.title}</div>
              <div style={{ color: c.muted, fontSize: 12, marginTop: 4, fontWeight: 500 }}>{s.meta}</div>
              <p style={{ color: c.fg, opacity: 0.8, fontSize: 12.5, lineHeight: 1.55, marginTop: 8, marginBottom: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gallery ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: secPad }}>
        <SectionHeader title={tpl.galleryLabel} c={c} font={displayFont} mobile={mobile} sub={t('galleryOf', { n: state.gallery.length })} />
        {mobile ? (
          /* Mobile: 3-col single row */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {Array.from({ length: 3 }).map((_, i) => {
              const src = state.gallery[i];
              return (
                <div key={i} style={{ aspectRatio: '1 / 1', borderRadius: 9, overflow: 'hidden', border: `1px solid ${c.line}`, background: c.card }}>
                  {src ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <PhImg label={`${i + 1}`} isDark={isDark} />}
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop: 4-col with 2 tall slots and 4 square slots — masonry feel */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '130px 130px', gap: 8 }}>
            {/* Slot 0: tall (spans 2 rows) */}
            <div style={{ gridRow: '1 / 3', borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.line}`, background: c.card }}>
              {state.gallery[0] ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${state.gallery[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <PhImg label="1" isDark={isDark} />}
            </div>
            {/* Slots 1–4: regular */}
            {[1, 2, 3, 4].map((i) => {
              const src = state.gallery[i];
              return (
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.line}`, background: c.card }}>
                  {src ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <PhImg label={`${i + 1}`} isDark={isDark} />}
                </div>
              );
            })}
            {/* Slot 5: wide (spans 2 cols, row 2) — only if we haven't filled */}
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.line}`, background: c.card }}>
              {state.gallery[5] ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${state.gallery[5]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <PhImg label="6" isDark={isDark} />}
            </div>
          </div>
        )}
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section style={{ padding: secPad, background: `color-mix(in srgb, ${c.primary} 5%, ${c.bg})` }}>
        <SectionHeader title={t('testimonialsTitle')} c={c} font={displayFont} mobile={mobile} />
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : `repeat(${visibleReviews.length}, 1fr)`, gap: 12 }}>
          {visibleReviews.map((review, i) => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 14, padding: mobile ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Stars */}
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 5 }).map((_, s) => <IconStar key={s} size={13} color={c.primary} />)}
              </div>
              {/* Quote icon + text */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: -4, left: -4, opacity: 0.15, color: c.primary }}>
                  <IconQuote color={c.primary} />
                </div>
                <p style={{ color: c.fg, fontSize: 13.5, lineHeight: 1.6, margin: 0, paddingLeft: 4 }}>{review.text}</p>
              </div>
              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `color-mix(in srgb, ${c.primary} 20%, ${c.card})`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: c.primary, flexShrink: 0 }}>
                  {review.name.slice(0, 1)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.fg }}>{review.name}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{review.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact + Map ─────────────────────────────────────────────────────── */}
      <section style={{ padding: mobile ? '0 16px 28px' : '0 36px 52px' }}>
        <SectionHeader title={t('contactTitle')} c={c} font={displayFont} mobile={mobile} sub={t('contactSub')} />
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1.3fr', gap: 16 }}>

          {/* Contact info */}
          <div style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: mobile ? 16 : 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: c.primary, marginBottom: 12 }}>
              {t('navContact')}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <InfoRow icon={<MapPinIcon />} text={address} c={c} />
              <InfoRow icon={<PhoneIcon />} text={phone} c={c} />
              <InfoRow icon={<MailIcon />} text={email} c={c} />
            </div>
          </div>

          {/* Hours */}
          <div style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: mobile ? 16 : 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: c.primary, marginBottom: 12 }}>
              {t('hoursLabel')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', alignItems: 'center' }}>
              {DAYS_PREVIEW.map((day: DayKey) => {
                const s = state.hoursSchedule[day];
                return [
                  <span key={`${day}-d`} style={{ fontSize: 11, fontWeight: 600, color: c.muted }}>{td(day)}</span>,
                  <span key={`${day}-t`} style={{ fontSize: 11.5, color: c.fg }}>{s.open ? `${s.from}–${s.to}` : td('closed')}</span>,
                ];
              })}
            </div>
          </div>

          {/* Map placeholder */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${c.line}`, minHeight: mobile ? 140 : 0 }}>
            <MapPlaceholder isDark={isDark} primary={c.primary} label={t('mapLabel')} openLabel={t('openInMaps')} />
          </div>

        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${c.line}`, padding: mobile ? '14px 16px' : '18px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: c.muted, fontSize: 11.5 }}>
        <div>© 2026 {name}</div>
        <div>{t('madeWith')}</div>
      </footer>
    </div>
  );
}

// ── Panel toolbar wrapper ─────────────────────────────────────────────────────

export default function PreviewPanel({ state, biz, palette, viewport, onViewportChange, onHeroLayoutChange }: PreviewPanelProps) {
  const t = useTranslations('create.preview');
  const isDark = hexLuminance(palette.bg) < 0.4;
  const domain = `${toSlug(state.businessName) || 'yoursite'}.vendshop.shop`;

  const maxWidths: Record<Viewport, string> = { desktop: '1180px', tablet: '720px', mobile: '380px' };
  const viewportIcons: Record<Viewport, React.ReactNode> = { desktop: <IconMonitor />, tablet: <IconTablet />, mobile: <IconMobile /> };

  return (
    <div style={{ background: '#060a14', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 56px)', flex: 1 }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #253349', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15,23,42,0.6)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, background: 'rgba(22,163,74,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
            {t('live')}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{isDark ? '◉' : '○'} {biz.style}</span>
          {/* Hero layout toggle — lets the user override the auto pick from biz.style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Hero</span>
            <div style={{ display: 'flex', gap: 3, padding: 3, background: '#0f1a2e', border: '1px solid #253349', borderRadius: 8 }}>
              {(['auto', 'split', 'full'] as const).map((opt) => {
                const labels: Record<CreateHeroLayout, string> = { auto: 'Auto', split: 'Split', full: 'Plný' };
                const active = state.heroLayout === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onHeroLayoutChange(opt)}
                    style={{ background: active ? '#243449' : 'transparent', border: 'none', color: active ? '#e2e8f0' : '#94a3b8', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* URL pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: '#0f1a2e', border: '1px solid #253349', borderRadius: 999, fontSize: 11.5, color: '#94a3b8', fontFamily: 'monospace' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e' }} />
          {domain}
        </div>
        {/* Viewport tabs */}
        <div style={{ display: 'flex', gap: 3, padding: 3, background: '#0f1a2e', border: '1px solid #253349', borderRadius: 8 }}>
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
            <button key={v} onClick={() => onViewportChange(v)} style={{ background: viewport === v ? '#243449' : 'transparent', border: 'none', color: viewport === v ? '#e2e8f0' : '#94a3b8', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
              {viewportIcons[v]}
              <span style={{ textTransform: 'capitalize' }}>{t(v)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'grid', placeItems: 'start center' }}>
        <div style={{ width: '100%', maxWidth: maxWidths[viewport], background: palette.bg, borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)', transition: 'max-width 0.2s' }}>
          <SitePreview state={state} biz={biz} palette={palette} viewport={viewport} />
        </div>
      </div>
    </div>
  );
}
