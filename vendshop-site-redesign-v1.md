# VendShop.shop — Site Redesign Plan v1

> Created: 2026-04-21
> Status: APPROVED — ready for implementation
> Source: Claude + Grok consultation (3 turns), approved by Vadym

## Page Structure (9 public pages)

### 1. / (Homepage) — Pure selling page
No onboarding. All CTAs → /create.

**Section order (conversion-optimized):**
1. Hero
2. Portfolio Preview (7+ live demo sites with "View live →")
3. How It Works (3 steps with icons)
4. Features (6 templates + multilingual + live preview)
5. Comparison Table (VendShop vs Durable vs Wix vs Developer) — NEW
6. Pricing (€0 / €19 / €39)
7. Testimonials
8. FAQ
9. Final CTA + WhatsApp button

AI Chat widget floating in corner (support only).

### 2. /create (Onboarding) — Constructor with live preview
Full-screen page. Layout: settings (left) + live preview (right).

**3 steps:**
- Step 1: Choose business type → instantly shows template + palette options
- Step 2: Your data (name, description, contacts) + photos → real-time preview updates
- Step 3: Choose plan + launch (deploy ~30 sec)

Preview = React component mimicking template (not iframe).
User sees their site from first click.

### 3. /blog + /blog/[slug] — SEO engine
Markdown-based (no CMS). EN + DE content.
JSON-LD structured data, sitemap.xml, OpenGraph.

### 4. /about — Credibility
Who's behind VendShop. Link to smartctx.dev.

### 5. /contact — Simple
Email, WhatsApp Business button, contact form.

### 6. /pricing — Standalone (SEO)
Expanded version of homepage pricing + competitor comparison.

### 7. /templates — Showcase all 6 templates
Business-type filters. Main differentiator page.
Future: /templates/[business-type] for long-tail SEO.

### 8. /impressum — LEGALLY REQUIRED (DACH)
### 9. /datenschutz — LEGALLY REQUIRED (GDPR)

---

## Hero Copy

### English:
**Headline:** Your Professional Website in Your Language — in Under 2 Minutes
**Subheadline:** 6 hand-crafted visual templates designed for real European businesses: Barbershops, Restaurants, Beauty Salons, Auto Services, Dentists & more. Multilingual from day one. No design skills required.
**Primary CTA:** See Your Template →
**Secondary CTA:** Watch how it works (30 sec)

### German (DACH):
**Headline:** Ihre professionelle Website in Ihrer Sprache — in unter 2 Minuten
**Subheadline:** 6 speziell gestaltete Vorlagen für echte europäische Unternehmen: Friseursalons, Restaurants, Kosmetikstudios, Autowerkstätten, Zahnärzte & mehr. Mehrsprachig ab Tag eins. Keine Designkenntnisse nötig.
**Primary CTA:** Zeigen Sie mir meine Vorlage →
**Secondary CTA:** So funktioniert es (30 Sek.)

---

## Comparison Table

**EN Title:** VendShop vs. Other Options – What Actually Works in 2026
**DE Title:** VendShop vs. Andere Lösungen – Was 2026 wirklich funktioniert

| Feature | VendShop | Durable/Mixo | Wix/Squarespace | Freelance Developer |
|---------|----------|--------------|-----------------|---------------------|
| Time to launch | Under 2 min | 1-5 min | Hours to days | 2-8 weeks |
| Multilingual (DE,SK,CS,UK) | Yes, native | Limited/EN only | Extra cost | Expensive |
| Business-type templates | 6 purpose-built | Generic | Generic | Custom (expensive) |
| Real-time live preview | Yes | No | No | No |
| Monthly price | €0/€19/€39 | $12-$49 | €16-€49 | €500-€3000 one-time |
| European business support | Built for DACH+CE | US-focused | Global | Varies |
| Best for | Small local biz | Quick generic | DIY users | Complex projects |

**CTA (EN):** Ready for a website that actually looks professional and speaks your language?
**CTA (DE):** Bereit für eine Website, die wirklich professionell aussieht und Ihre Sprache spricht?

---

## Impressum (template)

```
Impressum

Angaben gemäß § 5 TMG

Vadym Mak
[Full address — street, ZIP, city, country]
[Email]
[Phone]

Umsatzsteuer-ID:
Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz: [if applicable]

Haftungsausschluss:
Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können
wir jedoch keine Gewähr übernehmen.

Haftung für Links:
Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte
wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets
der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
```

---

## Datenschutz (structure)
- What data we collect (name, email, business info, uploaded photos)
- Stripe for payments
- Vercel for hosting
- No tracking cookies beyond functional
- GDPR compliant
- TODO: Get full German Datenschutz text from Grok

---

## DACH Trust Signals (add to homepage)
- "Made in Europe"
- "DSGVO-konform"
- "SSL-verschlüsselt"
- "Zahlung mit Stripe"

---

## Implementation Priority

### Week 1-2:
- [ ] /impressum + /datenschutz (legal — blocks DACH marketing)
- [ ] /pricing standalone page
- [ ] /templates page (grid of 6 templates)
- [ ] Homepage: reorder sections (Portfolio after Hero)
- [ ] Homepage: add Comparison Table
- [ ] Update pricing to €0/€19/€39 in constants.ts

### Week 3:
- [ ] Blog system (/blog + /blog/[slug]) — markdown-based
- [ ] First 4 blog posts (2 EN + 2 DE)
- [ ] Update Hero copy (EN + DE)

### Week 4:
- [ ] Launch updated vendshop.shop
- [ ] Start X Build in Public
- [ ] Register on German directories (Gelbe Seiten, Das Örtliche, MyHammer)
- [ ] WhatsApp Business setup

### Week 5+:
- [ ] /create redesign (constructor with live preview)
- [ ] More blog posts (target: 2/week)
- [ ] Product Hunt preparation
