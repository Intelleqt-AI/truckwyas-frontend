import { CHOICE_LABEL, likelihoodLabel, marginOf, type PickedChoice, type PricingDecision } from './pricing';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface DecisionView {
  picked: string | null;
  finalPrice: number;
  floor: number | null;
  margin: { amount: number; pct: number | null } | null;
  belowFloor: boolean;
  market: { low: number; high: number; median: number | null; label: string; estimate: boolean } | null;
  likelihood: { text: string; basis: string | null; model: boolean } | null;
  /** The quote total no longer matches the price this decision was made at. */
  stale: boolean;
}

function marketLabel(m: NonNullable<PricingDecision['market']>): { label: string; estimate: boolean } {
  const n = num(m.n);
  const estimate = m.tier === 'estimate' || m.is_estimate === true;
  if (m.tier_label) return { label: String(m.tier_label), estimate };
  if (estimate) return { label: 'Estimate, not market evidence', estimate };
  const quotes = n ? `${n} quote${n === 1 ? '' : 's'}` : null;
  if (m.tier === 'platform') return { label: ['TruckWys platform', quotes].filter(Boolean).join(', '), estimate };
  if (m.tier === 'company') return { label: ['Your own quotes', quotes].filter(Boolean).join(', '), estimate };
  return { label: quotes || 'Market range', estimate };
}

/**
 * The stored pricing decision, read honestly: only what was saved with the
 * quote, never a recomputed or heuristic figure. Null when the quote has no
 * decision (older quotes), so callers show no margin or likelihood at all.
 */
export function pricingDecisionOf(quote: { total_amount?: unknown; pricing_decision?: PricingDecision | null } | null | undefined): DecisionView | null {
  const d = quote?.pricing_decision;
  if (!d || typeof d !== 'object') return null;
  const finalPrice = num(d.final_price);
  if (finalPrice === null) return null;
  const floor = num(d.floor);
  const margin = marginOf(finalPrice, floor);
  const picked = d.picked_choice && d.picked_choice in CHOICE_LABEL ? CHOICE_LABEL[d.picked_choice as PickedChoice] : null;

  let market: DecisionView['market'] = null;
  const m = d.market;
  if (m && num(m.p25) !== null && num(m.p75) !== null) {
    market = { low: num(m.p25)!, high: num(m.p75)!, median: num(m.median), ...marketLabel(m) };
  }

  let likelihood: DecisionView['likelihood'] = null;
  const pct = num(d.likelihood_at_final_pct);
  const band = likelihoodLabel('rules', d.band_at_final as string | null);
  if (d.likelihood_level === 'model' && pct !== null) {
    // The basis count, when the saved decision carries it.
    const n = num(d.n_closed ?? (d as Record<string, unknown>).model_n_closed);
    likelihood = { text: `${Math.round(pct)}%`, basis: n ? `Based on ${n} closed quote${n === 1 ? '' : 's'}` : 'From your win model', model: true };
  } else if (band) {
    likelihood = {
      text: band,
      basis: d.likelihood_level === 'model' ? 'Outside the range the model has seen; a rules-based band' : 'A rules-based band, not a prediction',
      model: false,
    };
  }

  const total = num(quote?.total_amount);
  return {
    picked,
    finalPrice,
    floor,
    margin,
    belowFloor: floor !== null && finalPrice < floor,
    market,
    likelihood,
    stale: total !== null && Math.abs(total - finalPrice) > 0.5,
  };
}

