// Shared pricing helpers: one margin definition everywhere (owner rule 6).
// margin = price − full cost floor; margin % = margin / price (excl. VAT).
// Small and pure: used by the quote builder, quote detail and the quotes list.
import { formatMoney, formatMoneyWhole } from './formatters';

export type LikelihoodBand = 'likely' | 'even' | 'less_likely';
export type PickedChoice = 'safe' | 'balanced' | 'stretch' | 'custom';

/** The pricing decision stored with a quote (additive `pricing_decision` field). */
export interface PricingDecision {
  version?: string | null;
  shown_choices?: unknown;
  picked_choice?: PickedChoice | string | null;
  final_price?: number | string | null;
  floor?: number | string | null;
  market?: { p25?: number | string | null; median?: number | string | null; p75?: number | string | null; tier?: string | null; n?: number | null; tier_label?: string | null; is_estimate?: boolean | null } | null;
  model_version?: string | null;
  likelihood_level?: 'model' | 'rules' | string | null;
  likelihood_at_final_pct?: number | string | null;
  band_at_final?: LikelihoodBand | string | null;
  n_closed?: number | null;
  [key: string]: unknown;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Margin in rand and whole-number %, or null when either side is unknown. */
export function marginOf(price: unknown, floor: unknown): { amount: number; pct: number | null } | null {
  const p = num(price);
  const f = num(floor);
  if (p === null || f === null) return null;
  const amount = Math.round(p - f);
  return { amount, pct: p > 0 ? Math.round(((p - f) / p) * 100) : null };
}

/** "R 25 100" when the cents are zero, else "R 1 448,78". U+2212 minus. */
export function formatRand(value: unknown): string {
  const n = num(value);
  if (n === null) return '—';
  return Math.abs(Math.round(n * 100)) % 100 === 0 ? formatMoneyWhole(n) : formatMoney(n);
}

/** A difference with its sign: "+R 1 200" / "−R 1 200" (U+2212), "R 0" at zero. */
export function formatSignedRand(value: unknown): string {
  const n = num(value);
  if (n === null) return '—';
  const body = formatRand(Math.abs(n));
  return Math.round(n * 100) === 0 ? body : `${n > 0 ? '+' : '\u2212'}${body}`;
}

/** "R 6 550 · 26%" (whole rand, whole %). */
export function formatMargin(m: { amount: number; pct: number | null } | null): string {
  if (!m) return '—';
  return m.pct === null ? formatMoneyWhole(m.amount) : `${formatMoneyWhole(m.amount)} · ${m.pct}%`;
}

const BAND_LABEL: Record<LikelihoodBand, string> = {
  likely: 'Likely',
  even: 'Even chance',
  less_likely: 'Less likely',
};

/**
 * The likelihood wording for one price. A % only at model level (owner rule 7);
 * rules level shows its band; anything else shows nothing (null).
 */
export function likelihoodLabel(level: string | null | undefined, value: number | string | null | undefined): string | null {
  if (level === 'model') {
    const pct = num(value);
    return pct === null ? null : `${Math.round(pct)}% chance to win`;
  }
  if (level === 'rules' && typeof value === 'string' && value in BAND_LABEL) {
    return BAND_LABEL[value as LikelihoodBand];
  }
  return null;
}

/** The short form beside a price: "72% to win" (model) or the band ("Likely"). */
export function likelihoodShort(level: string | null | undefined, value: number | string | null | undefined): string | null {
  if (level === 'model') {
    const pct = num(value);
    return pct === null ? null : `${Math.round(pct)}% to win`;
  }
  return likelihoodLabel(level, value);
}

/** One name for the p25–p75 range, in the builder and on the quote. */
export const MARKET_RANGE_LABEL = 'Middle half of the market';

export const CHOICE_LABEL: Record<PickedChoice, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  stretch: 'Stretch',
  custom: 'Custom',
};

/** Loss reasons captured when a quote is declined (additive `loss_reason`). */
export type LossReasonCode = 'price' | 'timing' | 'capacity' | 'relationship' | 'other';
export const LOSS_REASONS: { code: LossReasonCode; label: string }[] = [
  { code: 'price', label: 'Price' },
  { code: 'timing', label: 'Timing' },
  { code: 'capacity', label: 'Capacity' },
  { code: 'relationship', label: 'Relationship' },
  { code: 'other', label: 'Other' },
];

export interface LossReason {
  code: LossReasonCode | null;
  note: string;
}

/**
 * The fields for a decline (outcome, update_status and the public link): the
 * additive `loss_reason` code and `loss_reason_note`, both optional, and the
 * same reason as the free-text `rejection_reason` the API has always taken.
 */
export function lossReasonPayload(reason: LossReason): Record<string, unknown> {
  const note = reason.note.trim();
  if (!reason.code && !note) return {};
  const label = LOSS_REASONS.find((r) => r.code === reason.code)?.label;
  const text = [label, note].filter(Boolean).join(': ');
  return {
    ...(reason.code ? { loss_reason: reason.code } : {}),
    ...(note ? { loss_reason_note: note } : {}),
    rejection_reason: text,
  };
}

