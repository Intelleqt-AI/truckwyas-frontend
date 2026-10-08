// "Quotes short on diesel" (Insights finding 7), like for like (QUOTE-RULES.md §9):
// each quote's own snapshot — the OFFICIAL price in force when it was priced
// (fuel_official_at_pricing), its zone (fuel_zone) and the litres priced in
// (fuel_litres) — against today's official price for THAT zone. Quotes
// without the snapshot are skipped: never the un-zoned, sometimes-own
// fuel_price_at_creation. Pure (no "@/" imports) so node tests it.

export interface DieselShortQuote {
  id: number; status: string; valid_until: string | null;
  fuel_official_at_pricing?: string | number | null; fuel_zone?: string | null; fuel_litres?: string | number | null;
}
export interface DieselShortRow<Q> { q: Q; price: number; litres: number; short: number; zone: "INLAND" | "COASTAL" }

const num = (v: unknown) => { const n = Number(v); return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : 0; };

/** `official`: today's official prices by zone. `liveLoad`: whether an accepted quote's job is still open. */
export function dieselShortRows<Q extends DieselShortQuote>(
  quotes: Q[], official: { INLAND: number | null; COASTAL: number | null }, todayIso: string,
  jobOpen: (q: Q) => boolean, minDelta = 0.2,
): DieselShortRow<Q>[] {
  const out: DieselShortRow<Q>[] = [];
  for (const q of quotes) {
    const zoneRaw = String(q.fuel_zone || "").toUpperCase();
    if (zoneRaw !== "INLAND" && zoneRaw !== "COASTAL") continue;
    const zone = zoneRaw as "INLAND" | "COASTAL";
    const price = num(q.fuel_official_at_pricing);
    const litres = num(q.fuel_litres);
    const today = official[zone];
    if (price <= 0 || litres <= 0 || !today || today <= 0) continue;
    const st = (q.status || "").toUpperCase();
    const live = (st === "ACCEPTED" && jobOpen(q)) || (st === "SENT" && !!q.valid_until && q.valid_until >= todayIso);
    const delta = today - price;
    if (!live || delta < minDelta) continue;
    out.push({ q, price, litres, short: litres * delta, zone });
  }
  return out;
}
