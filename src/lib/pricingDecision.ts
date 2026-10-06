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
  /** What the floor is made of, so the margin can be traced; null if unknown. */
  /** source: a short provenance label when the decision stored one; missing: no figure on record. */
  floorLines: { label: string; amount: number; source?: string | null; missing?: boolean }[] | null;
  /** True when the lines were worked out from the quote's own lines (no stored breakdown). */
  floorLinesDerived: boolean;
}

const FLOOR_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  tolls: 'Tolls',
  driver_allowance: 'Driver allowance',
  border: 'Border fees',
  fixed_cost: 'Operating costs (in base rate)',
  return_leg: 'Empty return',
};

// The stored source_kind of a floor line, in plain words. Absent on older
// decisions (and "" before the builder sent it): no label is shown then.
const SOURCE_LABEL: Record<string, string> = {
  official: 'Official',
  calculated: 'Calculated',
  company_actuals: 'Your costs',
  estimate: 'Estimate',
  user: 'You',
};

type QuoteLines = { fuel_surcharge?: unknown; toll_charges?: unknown; driver_allowance?: unknown; additional_charges?: unknown };

/**
 * The floor's components. Prefers the breakdown saved with the decision
 * (`floor_lines`); else derives it from the quote's own cost lines, which the
 * floor consumes as-is, with the rest of the floor as operating costs. Null
 * when that remainder would be negative (the lines don't reconcile).
 */
function floorLinesOf(d: PricingDecision, quote: QuoteLines, floor: number | null, stale: boolean): { lines: DecisionView['floorLines']; derived: boolean } {
  const stored = (d as Record<string, unknown>).floor_lines;
  if (Array.isArray(stored) && stored.length) {
    const lines = stored
      .map((l: { key?: string; label?: string; amount?: unknown; source_kind?: string }) => {
        const kind = String(l.source_kind || '');
        return {
          label: (l.key && FLOOR_LABEL[l.key]) || String(l.label || ''),
          amount: kind === 'missing' ? 0 : num(l.amount),
          source: SOURCE_LABEL[kind] ?? null,
          missing: kind === 'missing',
        };
      })
      .filter((l): l is { label: string; amount: number; source: string | null; missing: boolean } => !!l.label && l.amount !== null);
    return { lines: lines.length ? lines : null, derived: false };
  }
  if (floor === null || stale) return { lines: null, derived: false };
  const parts = [
    { label: 'Fuel', amount: num(quote.fuel_surcharge) ?? 0 },
    { label: 'Tolls', amount: num(quote.toll_charges) ?? 0 },
    { label: 'Driver allowance', amount: num(quote.driver_allowance) ?? 0 },
    { label: 'Border and other charges', amount: num(quote.additional_charges) ?? 0 },
  ].filter((p) => p.amount > 0);
  const rest = Math.round((floor - parts.reduce((a, p) => a + p.amount, 0)) * 100) / 100;
  if (rest < 0) return { lines: null, derived: false };
  return { lines: [...parts, ...(rest > 0 ? [{ label: 'Operating costs (in base rate)', amount: rest }] : [])], derived: true };
}

function marketLabel(m: NonNullable<PricingDecision['market']>): { label: string; estimate: boolean } {
  const n = num(m.n);
  const estimate = m.tier === 'estimate' || m.is_estimate === true;
  if (m.tier_label) return { label: String(m.tier_label), estimate };
  if (estimate) return { label: 'Estimate, not market data', estimate };
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
export function pricingDecisionOf(quote: ({ total_amount?: unknown; pricing_decision?: PricingDecision | null } & QuoteLines) | null | undefined): DecisionView | null {
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
    likelihood = { text: `${Math.round(pct)}%`, basis: typeof d.basis_label === 'string' && d.basis_label ? `Based on ${d.basis_label}` : n ? `Based on ${n} won and lost quotes` : 'From your win model', model: true };
  } else if (band) {
    likelihood = {
      text: band,
      basis: d.likelihood_level === 'model' ? 'Outside your usual prices, so a rough band' : 'A rough band, not a prediction',
      model: false,
    };
  }

  const total = num(quote?.total_amount);
  const stale = total !== null && Math.abs(total - finalPrice) > 0.5;
  const fl = floorLinesOf(d, quote || {}, floor, stale);
  return {
    floorLines: fl.lines,
    floorLinesDerived: fl.derived,
    picked,
    finalPrice,
    floor,
    margin,
    belowFloor: floor !== null && finalPrice < floor,
    market,
    likelihood,
    stale,
  };
}

