// Pure quote display rules (no "@/" imports: node tests them).

/** A quote with no price yet (its costs aren't complete): never shown as
 *  "R 0" and never counted in totals. The server sends customer_price null
 *  for these; a zero total says the same on an older response. */
export function quoteIncomplete(q: { total_amount?: unknown; customer_price?: unknown; costing_inputs?: unknown } | null | undefined): boolean {
  if (!q) return false;
  const total = Number(q.total_amount);
  return !(Number.isFinite(total) && total > 0) || ("customer_price" in q && q.customer_price === null) || quoteTollsUnknown(q);
}

/** Saved with tolls unknown (the lookup failed and nobody entered or confirmed
 *  them): its floor leaves the tolls out, so the quote is incomplete. */
export function quoteTollsUnknown(q: { costing_inputs?: unknown } | null | undefined): boolean {
  const ci = (q?.costing_inputs ?? null) as { tolls_unknown?: unknown; tolls_confirmed_none?: unknown } | null;
  return !!ci && ci.tolls_unknown === true && ci.tolls_confirmed_none !== true;
}

/** "R 1 333 below official on this quote." for diesel_own_off (its impact_zar). */
export function ownDieselImpactText(w: { code: string; impact_zar?: number | null }): string | null {
  if (w.code !== "diesel_own_off" || w.impact_zar == null || Math.abs(w.impact_zar) < 0.5) return null;
  const rand = Math.floor(Math.abs(w.impact_zar) + 0.5).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `R\u00a0${rand} ${w.impact_zar < 0 ? "below" : "above"} official on this quote.`;
}
