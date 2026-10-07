/**
 * Live, client-side reading of the price in the bar against the last
 * analysis, so margin and likelihood follow every keystroke without a
 * round-trip. The endpoint stays the authority: it is re-called (debounced)
 * and its figures replace these as soon as they land.
 *
 * One margin definition everywhere: margin = price − full cost floor;
 * margin % = margin / price (excl. VAT).
 */
import { BAND_LABEL, type Band, type Choice, type ChoiceKey, type Likelihood, type PricingAnalysis } from "./types";

export type LiveLikelihood =
  | { level: "model"; pct: number }
  /** band null: not enough data to judge. */
  | { level: "rules"; band: Band | null; label: string; note: string | null }
  | null;

export interface LiveReading {
  price: number;
  floor: number | null;
  margin: number | null;
  marginPct: number | null;
  belowFloor: boolean;
  likelihood: LiveLikelihood;
  /** The choice whose price this is, if any. */
  matchedChoice: ChoiceKey | null;
}

const NO_BAND = "Not enough data yet";

export function likelihoodAt(a: PricingAnalysis | null, price: number): LiveLikelihood {
  const lk = a?.likelihood;
  if (!lk || !(price > 0)) return null;
  // Rules thresholds (sent whenever they exist, at model level too).
  const rulesBand = (): Band | null => {
    const t = lk.rules;
    if (!t || t.likelyMax == null || t.evenMax == null) return null;
    return price <= t.likelyMax ? "likely" : price <= t.evenMax ? "even" : "less_likely";
  };
  if (lk.level === "model" && lk.model) {
    const { range, curve } = lk.model;
    if (price >= range[0] && price <= range[1]) {
      // Linear interpolation between the two curve points either side.
      let i = curve.findIndex((p) => p.price >= price);
      if (i <= 0) i = 1;
      const a0 = curve[i - 1], a1 = curve[i];
      const t = a1.price === a0.price ? 0 : (price - a0.price) / (a1.price - a0.price);
      const pct = a0.pct + (a1.pct - a0.pct) * Math.max(0, Math.min(1, t));
      return { level: "model", pct: Math.round(pct) };
    }
    // Outside what the model has seen: a band, never an extrapolated %.
    const band = rulesBand();
    return { level: "rules", band, label: band ? BAND_LABEL[band] : NO_BAND, note: "Outside the prices we've seen you quote" };
  }
  const band = rulesBand();
  return { level: "rules", band, label: band ? BAND_LABEL[band] : NO_BAND, note: null };
}

export function readPrice(a: PricingAnalysis | null, price: number): LiveReading {
  const floor = a?.costFloor?.total ?? null;
  const margin = floor != null ? price - floor : null;
  // A choice only when the price IS that choice's price, to the cent: R 27 999,99
  // is a custom price, never "Stretch".
  const matchedChoice = a?.choices.find((c) => Math.abs(c.price - price) < 0.005) ?? null;
  const matched = matchedChoice?.key ?? null;
  // At a choice's own price, say exactly what its card says.
  // The server's reading wins at the exact price it was asked about; the
  // curve is only interpolated while a newer price is being typed.
  // `<= 0.5` so an older server that echoed whole rand (R 23 322,50 → 23 323)
  // still counts as an answer for this price; a current one echoes it exactly.
  const yp = a?.yourPrice && Math.abs(a.yourPrice.price - price) <= 0.5 ? a.yourPrice.likelihood : null;
  const cl = matchedChoice?.likelihood ?? yp;
  const likelihood: LiveLikelihood = cl
    ? (cl.level === "model" ? { level: "model", pct: Math.round(cl.pct) } : { level: "rules", band: cl.band, label: cl.label, note: cl.outsideModelRange ? "Outside the prices we've seen you quote" : null })
    : likelihoodAt(a, price);
  return {
    price,
    floor,
    margin,
    marginPct: margin != null && price > 0 ? (margin / price) * 100 : null,
    belowFloor: margin != null && margin < 0,
    likelihood,
    matchedChoice: matched,
  };
}

/** The additive `pricing_decision` saved with the quote (see CONTRACT.md). */
export function pricingDecision(a: PricingAnalysis, finalPrice: number, picked: ChoiceKey | "custom", priceAdjustment = 0) {
  const live = readPrice(a, finalPrice);
  const lk = live.likelihood;
  return {
    version: a.version,
    shown_choices: a.choices.map((c) => ({
      key: c.key,
      price: Math.round(c.price),
      margin_pct: Math.round(c.marginPct),
      recommended: c.recommended,
      likelihood: c.likelihood?.level === "model"
        ? { level: "model", pct: Math.round(c.likelihood.pct) }
        : c.likelihood ? { level: "rules", band: c.likelihood.band } : null,
    })),
    picked_choice: picked,
    // So quote detail can reconcile the floor line by line.
    floor_lines: (a.costFloor?.lines ?? []).map((l) => (l.needsInput
      ? { key: l.key, label: l.label, amount: 0, source_kind: "missing" }
      : { key: l.key, label: l.label, amount: l.amount, source_kind: l.source.kind })),
    price_adjustment: Math.round(priceAdjustment * 100) / 100,
    final_price: Math.round(finalPrice * 100) / 100,
    floor: a.costFloor ? Math.round(a.costFloor.total * 100) / 100 : null,
    market: a.market?.available
      ? { p25: a.market.p25, median: a.market.median, p75: a.market.p75, tier: a.market.tier, n: a.market.n,
          tier_label: a.market.tierLabel, is_estimate: a.market.isEstimate }
      : null,
    model_version: a.likelihood?.level === "model" ? a.likelihood.model?.version || null : null,
    n_closed: a.likelihood?.level === "model" ? a.likelihood.model?.nClosed ?? null : null,
    basis_label: a.likelihood?.level === "model" ? a.likelihood.model?.basisLabel || null : null,
    likelihood_level: a.likelihood?.level ?? null,
    // A choice's own figure (from the server) is kept; for a custom price the
    // server computes it at save, so nothing client-side is sent as fact.
    likelihood_at_final_pct: picked !== "custom" && lk?.level === "model" ? lk.pct : null,
    band_at_final: picked !== "custom" && lk?.level === "rules" ? lk.band : null,
  };
}

/**
 * The three cards' chance to win in ONE format: when any choice is a band
 * (outside the model's range), every choice is shown as its band, read from
 * the same rules thresholds — never "14% / 11% / Less likely" in one row.
 */
export function rowLikelihoods(a: PricingAnalysis | null, choices: Choice[]): Map<ChoiceKey, Likelihood | null> {
  const out = new Map<ChoiceKey, Likelihood | null>();
  const mixed = choices.some((c) => c.likelihood?.level === "model") && choices.some((c) => c.likelihood?.level === "rules");
  for (const c of choices) {
    if (!mixed || c.likelihood?.level !== "model") { out.set(c.key, c.likelihood); continue; }
    const t = a?.likelihood?.rules;
    const band: Band | null = !t || t.likelyMax == null || t.evenMax == null ? null
      : c.price <= t.likelyMax ? "likely" : c.price <= t.evenMax ? "even" : "less_likely";
    out.set(c.key, { level: "rules", band, label: band ? BAND_LABEL[band] : NO_BAND, outsideModelRange: false });
  }
  return out;
}
