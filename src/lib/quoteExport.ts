// Quote working export: everything a quote was priced on, laid out to be
// checked by hand (route, every cost line and how it was worked out, each
// toll plaza and border charge, fuel, warnings, price, VAT, the analysis and
// the raw costing inputs). Opens as a print page; "Save as PDF" in the print
// dialog makes the file. Internal: never sent to a customer.
import type { Costing, CostingInputs } from "./quoteRules";
import type { BorderItem, TollItem } from "./routeTolls";
import type { PricingAnalysis } from "@/components/pricing/types";
import { formatCurrency, formatNumber } from "./formatters";

export interface QuoteExportData {
  quoteRef: string | null;
  company: string | null;
  customer: string | null;
  pickup: string; delivery: string; stops: string[];
  tripType: string; legs: number;
  distanceKm: number | null; durationMin: number | null;
  truck: string | null; weightKg: number | null; cargo: string | null;
  pickupDate: string | null; deliveryDate: string | null; validUntil: string | null;
  routeLabel: string | null;
  tolls: TollItem[];
  borderOut: BorderItem[]; borderBack: BorderItem[];
  costing: Costing; costingAtPrice: Costing; costingInputs: CostingInputs;
  price: number; priceSource: string;
  vat: { vat_registered: boolean; vat_label?: string; vat_amount: number; total_incl_vat: number };
  analysis: PricingAnalysis | null;
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const rand = (n: number | null | undefined) => (n == null || !Number.isFinite(Number(n)) ? "—" : formatCurrency(Number(n)));
const num = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(Number(n)) ? "—" : formatNumber(Number(n), { maximumFractionDigits: d }));
const row = (cells: unknown[], head = false) => `<tr>${cells.map((c) => (head ? `<th>${esc(c)}</th>` : `<td>${c ?? ""}</td>`)).join("")}</tr>`;
const table = (head: string[], rows: unknown[][]) =>
  rows.length ? `<table><thead>${row(head, true)}</thead><tbody>${rows.map((r) => row(r)).join("")}</tbody></table>` : `<p class="muted">None.</p>`;
const kv = (pairs: [string, unknown][]) =>
  `<table class="kv"><tbody>${pairs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v ?? "—"}</td></tr>`).join("")}</tbody></table>`;

export function buildQuoteExportHtml(d: QuoteExportData, now = new Date()): string {
  const c = d.costingAtPrice;
  const tr = c.trip, dz = c.diesel, v = c.vehicle;
  const lineRows = c.lines.map((l) => [esc(l.label), l.leg === "empty_return" ? "Trip home" : "Loaded", `<span class="r">${rand(l.amount)}</span>`, esc(l.basis)]);
  const tollTotal = d.tolls.reduce((s, t) => s + (Number(t.tariff) || 0), 0);
  const tollRows = d.tolls.map((t) => [esc(t.plaza), esc(t.route ?? ""), esc(t.plaza_type ?? ""), esc(t.country ?? "ZA"),
    t.location_km != null ? num(t.location_km, 0) : "—", esc(t.tariff_effective_from ?? ""),
    t.tariff_foreign != null ? `${esc(t.currency ?? "")} ${num(t.tariff_foreign)}` : "", `<span class="r">${rand(t.tariff)}</span>`]);
  const borderRows = (items: BorderItem[], leg: string) => items.filter((b) => Number(b.amount) > 0 || b.verified === false).map((b) => [
    leg, esc(b.description), b.amount_foreign != null ? `${esc(b.currency ?? "")} ${num(b.amount_foreign)}` : "",
    b.fx?.zar_per_unit != null ? `${num(b.fx.zar_per_unit, 4)} (${esc(b.fx.as_of ?? "")}${b.fx.is_fallback ? ", fallback" : ""})` : "",
    `<span class="r">${rand(b.amount)}</span>`, b.verified === false ? "Estimate" : b.verified ? "Verified" : "",
    b.source_url ? `<a href="${esc(b.source_url)}">${esc(b.source || b.source_url)}</a>` : esc(b.source ?? "")]);
  const warnRows = c.warnings.map((w) => [w.severity === "block" ? "<b>Blocks send</b>" : "Warning", esc(w.title), esc(w.detail ?? ""), w.impact_zar != null ? rand(w.impact_zar) : ""]);
  const a = d.analysis;
  const choiceRows = (a?.choices ?? []).map((ch) => [esc(ch.label) + (ch.recommended ? " (recommended)" : ""), `<span class="r">${rand(ch.price)}</span>`,
    rand(ch.margin), `${num(ch.marginPct, 1)}%`,
    ch.likelihood ? (ch.likelihood.level === "model" ? `${ch.likelihood.pct}%` : esc((ch.likelihood as { band?: string | null }).band ?? "—")) : "—"]);
  const floorLines = (a?.costFloor?.lines ?? []).map((l) => [esc(l.label), `<span class="r">${rand(l.amount)}</span>`, esc(l.source.label), esc(l.basis ?? "")]);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quote working ${esc(d.quoteRef ?? "(unsaved)")}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 11px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
  .muted { color: #666; } .sub { color: #555; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  thead th { background: #f3f3f3; font-weight: 600; }
  table.kv th { width: 32%; font-weight: 500; color: #444; background: none; }
  .r { display: block; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total td { font-weight: 700; border-top: 1px solid #999; }
  pre { white-space: pre-wrap; word-break: break-word; font: 9.5px/1.4 ui-monospace, Menlo, monospace; background: #f7f7f7; padding: 8px; border-radius: 4px; }
  a { color: #1a5fb4; }
  .noprint { margin: 12px 0; } @media print { .noprint { display: none; } }
</style></head><body>
<div class="noprint"><button onclick="window.print()">Save as PDF / Print</button></div>
<h1>Quote working${d.quoteRef ? ` · ${esc(d.quoteRef)}` : " · unsaved quote"}</h1>
<p class="sub">${esc(d.company ?? "")} · exported ${esc(now.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }))} SAST · rules ${esc(c.version)} · internal, for checking (not a customer document)</p>

<h2>1. Trip</h2>
${kv([
  ["Customer", esc(d.customer ?? "—")],
  ["Collection", esc(d.pickup)], ...d.stops.map((s, i) => [`Stop ${i + 1}`, esc(s)] as [string, unknown]),
  ["Delivery", esc(d.delivery)],
  ["Trip type", `${esc(d.tripType)} (${d.legs} loaded leg${d.legs === 1 ? "" : "s"})`],
  ["Route", esc(d.routeLabel ?? "—")],
  ["Distance one way", `${num(d.distanceKm, 1)} km`],
  ["Driving time one way", d.durationMin != null ? `${Math.floor(d.durationMin / 60)} h ${Math.round(d.durationMin % 60)} min` : "—"],
  ["Km loaded / empty / driven", `${num(tr.km_loaded, 1)} / ${num(tr.km_empty, 1)} / ${num(tr.km_driven, 1)} km`],
  ["Truck comes back", tr.empty_return_included ? "Empty (trip home costed)" : tr.type === "ROUND_TRIP" ? "Round trip (loaded both ways)" : "Loaded / not costed"],
  ["Nights away on the trip home", num(tr.return_nights, 0)],
  ["Truck", esc(d.truck ?? "—")],
  ["Load", d.weightKg != null ? `${num(d.weightKg / 1000, 2)} t` : "—"],
  ["Cargo", esc(d.cargo ?? "—")],
  ["Collection / delivery date", `${esc(d.pickupDate ?? "—")} / ${esc(d.deliveryDate ?? "—")}`],
  ["Valid until", esc(d.validUntil ?? "—")],
])}

<h2>2. Truck and fuel</h2>
${kv([
  ["Truck capacity / load", v ? `${num(v.capacity_t, 1)} t / ${num(v.load_t, 2)} t (${v.load_ratio != null ? num(v.load_ratio * 100, 0) + "%" : "—"} full)` : "—"],
  ["Rated burn", v ? `${num(v.rated_burn_l_per_100km, 1)} L/100 km` : "—"],
  ["Burn loaded / empty", v ? `${num(v.burn_loaded_l_per_100km, 2)} / ${num(v.burn_empty_l_per_100km, 2)} L/100 km` : "—"],
  ["Litres loaded / trip home / total", `${num(c.litres.loaded)} / ${num(c.litres.empty_return)} / ${num(c.litres.total)} L`],
  ["Fuel", `${esc(dz.fuel_type)}${dz.grade ? ` ${esc(dz.grade)}` : ""}, ${esc(dz.zone)}`],
  ["Price used", `${rand(dz.price)}/L · source: ${esc(dz.source)}`],
  ["Official price", `${rand(dz.official_price)}/L from ${esc(dz.official_effective_from ?? "—")}${dz.official_stale ? " (out of date)" : ""}`],
  ["Company's own price", dz.own_price != null ? `${rand(dz.own_price)}/L set ${esc(dz.own_set_at ?? "—")}` : "—"],
])}

<h2>3. Cost lines (the cost floor)</h2>
<table><thead>${row(["Line", "Leg", "Amount", "How it was worked out"], true)}</thead><tbody>
${lineRows.map((r) => row(r)).join("")}
<tr class="total"><td>Cost floor</td><td></td><td><span class="r">${rand(c.floor)}</span></td><td>${c.floor_complete === false ? "Incomplete: a cost is unknown" : ""}</td></tr>
</tbody></table>

<h2>4. Tolls (${d.tolls.length} plaza${d.tolls.length === 1 ? "" : "s"}, one way)</h2>
${table(["Plaza", "Road", "Type", "Country", "Km", "Tariff from", "Foreign", "Amount"], tollRows)}
${d.tolls.length ? `<p>Sum of plazas one way: <b>${rand(tollTotal)}</b></p>` : ""}

<h2>5. Border charges</h2>
${table(["Leg", "Charge", "Foreign", "Rate (R per unit)", "Amount", "Status", "Source"], [...borderRows(d.borderOut, "Out"), ...borderRows(d.borderBack, "Home")])}

<h2>6. Price</h2>
${kv([
  ["Price excl. VAT", `<b>${rand(d.price)}</b> (${esc(d.priceSource)})`],
  ["Target price (margin " + num(c.target_margin_pct, 1) + "%)", rand(c.target_price)],
  ["Rate price (company R/km)", c.default_price_per_km != null ? `${rand(c.rate_price)} at ${rand(c.default_price_per_km)}/km` : "—"],
  ["Minimum charge", rand(c.minimum_charge)],
  ["Suggested (default) price", rand(c.default_price)],
  ["Margin at this price", `${rand(c.margin)} · ${num(c.margin_pct, 1)}%`],
  [d.vat.vat_registered ? (d.vat.vat_label ?? "VAT") : "VAT", d.vat.vat_registered ? rand(d.vat.vat_amount) : "Not VAT-registered"],
  ["Total incl. VAT", `<b>${rand(d.vat.total_incl_vat)}</b>`],
])}

<h2>7. Warnings</h2>
${table(["Kind", "Warning", "Detail", "Impact"], warnRows)}

<h2>8. Pricing analysis</h2>
${a ? `${kv([
  ["Market", a.market?.available ? `${rand(a.market.p25)} – ${rand(a.market.p75)}, median ${rand(a.market.median)} · ${a.market.n} quotes · ${esc(a.market.tierLabel ?? "")}${a.market.isEstimate ? " (estimate)" : ""}` : "No market data"],
  ["Chance to win", a.likelihood?.level === "model" ? `Model: ${esc(a.likelihood.model?.basisLabel ?? "")}` : "Bands (no trained model)"],
  ["Recommendation", esc(a.recommendation?.reason ?? "—")],
])}
${table(["Choice", "Price", "Margin", "Margin %", "Chance"], choiceRows)}
<p class="muted">Server cost floor lines:</p>
${table(["Line", "Amount", "Source", "Basis"], floorLines)}` : `<p class="muted">Not loaded.</p>`}

<h2>9. Raw costing inputs (for re-running the calculation)</h2>
<pre>${esc(JSON.stringify(d.costingInputs, null, 2))}</pre>
</body></html>`;
}

/** Opens the working in a new tab and the print dialog ("Save as PDF"). False if the browser blocked the tab. */
export function openQuoteExport(d: QuoteExportData): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(buildQuoteExportHtml(d));
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* the page's own button still prints */ } }, 300);
  return true;
}
