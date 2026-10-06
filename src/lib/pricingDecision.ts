import { CHOICE_LABEL, likelihoodLabel, marginOf, type PickedChoice, type PricingDecision } from './pricing';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface DecisionView {
  picked: string | null;
  /** The choice the panel recommended when this was priced (shown_choices), if stored. */
  recommended: string | null;
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
  /** note: words shown in place of the amount ("None due (same day)"). */
  floorLines: { label: string; amount: number; source?: string | null; missing?: boolean; note?: string | null }[] | null;
  /** True when the lines were worked out from the quote's own lines (no stored breakdown). */
  floorLinesDerived: boolean;
}

const FLOOR_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  tolls: 'Tolls',
  driver_allowance: 'Driver allowance',
  border: 'Border fees',
  fixed_cost: 'Operating costs',
  return_leg: 'Empty return',
};

// The stored source_kind of a floor line, in plain words. Absent on older
// decisions (and "" before the builder sent it): no label is shown then.
const SOURCE_LABEL: Record<string, string> = {
  official: 'Official',
  calculated: 'Calculated',
  company_actuals: 'Your actuals',
  estimate: 'Estimate',
  user: 'You',
};

type QuoteLines = { fuel_surcharge?: unknown; toll_charges?: unknown; driver_allowance?: unknown; additional_charges?: unknown; estimated_duration_minutes?: unknown; trip_type?: unknown };

/**
 * Nights away, the cost floor's own rule: driving days = ceil(driving hours /
 * 9), nights = days − 1, both legs for a round trip. Null when the driving
 * time is not on the quote.
 */
function nightsAway(quote: QuoteLines): number | null {
  const minutes = num(quote.estimated_duration_minutes);
  if (minutes === null || minutes <= 0) return null;
  const legs = quote.trip_type === 'ROUND_TRIP' ? 2 : 1;
  return Math.max(Math.ceil((minutes * legs) / 60 / 9) - 1, 0);
}

/**
 * The floor's components. Prefers the breakdown saved with the decision
 * (`floor_lines`); else derives it from the quote's own cost lines, which the
 * floor consumes as-is, with the rest of the floor as operating costs. Null
 * when that remainder would be negative (the lines don't reconcile).
 */
function floorLinesOf(d: PricingDecision, quote: QuoteLines, floor: number | null, stale: boolean): { lines: DecisionView['floorLines']; derived: boolean } {
  const stored = (d as Record<string, unknown>).floor_lines;
  if (Array.isArray(stored) && stored.length) {
    const nights = nightsAway(quote);
    const lines = stored
      .map((l: { key?: string; label?: string; amount?: unknown; source_kind?: string }) => {
        const kind = String(l.source_kind || '');
        const amount = kind === 'missing' ? 0 : num(l.amount);
        // As the builder: a driver line of R 0 is "None due (same day)" when
        // the trip has no night away, and "Not set" when it has one and the
        // figure was not the user's own (older decisions saved that gap as R 0).
        const zeroDriver = l.key === 'driver_allowance' && kind !== 'missing' && amount === 0;
        const noneDue = zeroDriver && nights === 0;
        const missing = kind === 'missing' || (zeroDriver && kind !== 'user' && nights !== null && nights > 0);
        return {
          label: (l.key && FLOOR_LABEL[l.key]) || String(l.label || ''),
          amount,
          source: noneDue || missing ? null : SOURCE_LABEL[kind] ?? null,
          missing,
          note: noneDue ? 'None due (same day)' : null,
        };
      })
      .filter((l): l is { label: string; amount: number; source: string | null; missing: boolean; note: string | null } => !!l.label && l.amount !== null);
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
  return { lines: [...parts, ...(rest > 0 ? [{ label: 'Operating costs', amount: rest }] : [])], derived: true };
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
  const shown = Array.isArray(d.shown_choices) ? (d.shown_choices as { key?: string; recommended?: boolean }[]) : [];
  const recKey = shown.find((c) => c && c.recommended === true)?.key;
  const recommended = recKey && recKey in CHOICE_LABEL ? CHOICE_LABEL[recKey as PickedChoice] : null;

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
    recommended,
    finalPrice,
    floor,
    margin,
    belowFloor: floor !== null && finalPrice < floor,
    market,
    likelihood,
    stale,
  };
}


/**
 * The price the customer agreed when the quote was won, when it differs from
 * the quoted total (read-only, kept with the outcome; billing still uses the
 * quote total). Accepts the field under the names the API may use; null when
 * absent, not won, or equal to the quote (to the cent).
 */
export function agreedPriceOf(quote: Record<string, unknown> | null | undefined): number | null {
  if (!quote || quote.outcome !== 'accepted') return null;
  const nested = quote.outcome_detail && typeof quote.outcome_detail === 'object' ? (quote.outcome_detail as Record<string, unknown>).final_price : undefined;
  const agreed = num(quote.agreed_price ?? quote.final_price ?? quote.outcome_final_price ?? nested);
  const total = num(quote.total_amount);
  if (agreed === null || agreed <= 0 || total === null) return null;
  return Math.abs(agreed - total) >= 0.005 ? agreed : null;
}
