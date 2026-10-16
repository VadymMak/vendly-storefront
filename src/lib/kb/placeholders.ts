import { renderPricingPlaceholders } from '@/lib/pricing';
import { PLAN_CREDITS, STUDIO_CREDIT_PACKS, STUDIO_PLAN_PRICES_EUR, reelsForCredits } from '@/lib/constants';

/**
 * Renders every number placeholder in a KB doc (scripts/ingest-kb.ts) — the docs never hold a price:
 * - {{cost:<op>}} / {{credits:<op>}} / {{sum:<op>+<op>}} — operation costs (src/lib/pricing.ts)
 * - {{plan:<plan>:images|videos|price|photoReels|videoReels}} — plan allowance, €/month or reels it covers
 * - {{pack:<pack>:images|videos|price}} — credit pack contents or € (STUDIO_CREDIT_PACKS)
 * Unknown ids or fields throw, so a typo fails the ingest.
 */
export function renderKbPlaceholders(text: string): string {
  const withPlans = text.replace(/\{\{(plan|pack):([a-z_]+):(images|videos|price|photoReels|videoReels)\}\}/g, (_m, kind: string, id: string, field: string) => {
    if (kind === 'plan') {
      if (!(id in PLAN_CREDITS)) throw new Error(`Unknown plan in KB doc: ${id}`);
      const plan = id as keyof typeof PLAN_CREDITS;
      if (field === 'price') return String(STUDIO_PLAN_PRICES_EUR[plan]);
      if (field === 'photoReels') return String(reelsForCredits(PLAN_CREDITS[plan].images, 'images'));
      if (field === 'videoReels') return String(reelsForCredits(PLAN_CREDITS[plan].videos, 'video'));
      return String(PLAN_CREDITS[plan][field as 'images' | 'videos']);
    }
    const pack = STUDIO_CREDIT_PACKS.find((p) => p.id === id);
    if (!pack) throw new Error(`Unknown credit pack in KB doc: ${id}`);
    if (field === 'photoReels' || field === 'videoReels') throw new Error(`KB {{pack:${id}:${field}}} is not supported`);
    return String(field === 'price' ? pack.priceEur : pack[field as 'images' | 'videos']);
  });
  return renderPricingPlaceholders(withPlans);
}
