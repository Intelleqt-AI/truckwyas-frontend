// Tolls and border charges from /route/calculate/, as the builder shows them.
// Display only: the amounts the costing uses are the route's own totals.
import { fmtNum, fmtRand } from "./quoteRules.ts";

export interface TollItem {
  plaza: string; route?: string; location_km?: number; tariff: number;
  tariff_excl_vat?: number; tariff_incl_vat?: number;
  plaza_type?: string | null; operator?: string | null; country?: string | null;
  tariff_effective_from?: string | null; currency?: string | null;
  tariff_foreign?: number | null; fx?: Fx | null; class_mapping_verified?: boolean;
}
export interface Fx { currency?: string; zar_per_unit?: number; as_of?: string | null; source?: string | null; is_fallback?: boolean; label?: string | null }
export interface BorderItem {
  type?: string; code?: string; description: string; amount: number;
  currency?: string | null; amount_foreign?: number | null; fx?: Fx | null;
  verified?: boolean; label?: string | null; source?: string | null; source_url?: string | null;
  as_of?: string | null; detail?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-03-01" -> "1 Mar 2026" (the date as written, no time zone). */
export function dayLabel(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** How toll amounts are stated: a VAT vendor claims SA toll VAT back. */
export function tollVatBasis(includesVat: boolean | null | undefined): string {
  return includesVat ? "incl. VAT — you're not VAT registered" : "excl. VAT";
}

/** "Class 4 · SANRAL · ramp · from 1 Mar 2026" (MZ: "class mapped", tariff in MZN). */
export function plazaMeta(t: TollItem, sanralClass: number | null | undefined): string {
  const parts: string[] = [];
  if (sanralClass) parts.push(`Class ${sanralClass}${t.class_mapping_verified === false ? " (mapped)" : ""}`);
  if (t.operator) parts.push(t.operator);
  if (t.plaza_type) parts.push(t.plaza_type === "ramp" ? "ramp" : "mainline");
  const from = dayLabel(t.tariff_effective_from);
  if (from) parts.push(`from ${from}`);
  if (t.currency && t.currency !== "ZAR" && t.tariff_foreign != null) parts.push(foreignText(t.currency, t.tariff_foreign, t.fx));
  return parts.join(" · ");
}

function foreignText(currency: string, amount: number, fx: Fx | null | undefined): string {
  const rate = fx?.zar_per_unit;
  const asOf = fx?.is_fallback ? dayLabel(fx.as_of) : null;
  return `${currency} ${fmtNum(amount, amount % 1 ? 2 : 0)}${rate ? ` at R${fmtNum(rate, 4)}` : ""}${asOf ? ` (rate as of ${asOf})` : ""}`;
}

/** Route option chip: "Fastest · via N17/N3 · tolls R 887" (plazas on hover). */
export function routeChipLabel(r: { toll_summary?: string | null; toll_cost_zar?: number | null; tolls_unknown?: boolean; tolls_unavailable?: boolean; distance_km?: number }, index: number): string {
  if (r.toll_summary) {
    // "Fastest · via N17/N3 (Gosforth Ramp (W), Wilge, …) · tolls R 887": the plaza list goes to the hover.
    return r.toll_summary.replace(/\u00a0/g, " ").split(" · ")
      .map((part) => (part.startsWith("via ") && part.includes(" (") ? part.slice(0, part.indexOf(" (")) : part)).join(" · ");
  }
  const name = index === 0 ? "Fastest" : `Alternative ${index}`;
  const tolls = r.tolls_unknown || r.tolls_unavailable || r.toll_cost_zar == null ? "tolls unknown" : `tolls ${fmtRand(r.toll_cost_zar)}`;
  return `${name} · ${tolls}`;
}

export type BorderKind = "published" | "estimate" | "unverified" | "agent";
export function borderKind(b: BorderItem): BorderKind {
  if (b.code === "zw_clearing_agent" || /agent/i.test(String(b.source ?? "")) && /enter your agent/i.test(String(b.source ?? b.detail ?? ""))) return "agent";
  if (b.verified || b.label === "published") return "published";
  if (b.label === "unverified") return "unverified";
  return "estimate";
}
export const BORDER_KIND_LABEL: Record<BorderKind, string> = {
  published: "Published", estimate: "Estimate", unverified: "Unverified", agent: "Agent estimate",
};

/** "USD 375 at R16,6391 · as of 28 Apr 2026" (rate date said only when it is a fallback). */
export function borderMeta(b: BorderItem): string {
  const parts: string[] = [];
  if (b.currency && b.currency !== "ZAR" && b.amount_foreign != null) parts.push(foreignText(b.currency, b.amount_foreign, b.fx));
  const asOf = dayLabel(b.as_of);
  if (asOf) parts.push(`as of ${asOf}`);
  return parts.join(" · ");
}

/** "(estimate)" and similar are said by the label chip, not in the name. */
export function borderName(b: BorderItem): string {
  return String(b.description || "").replace(/\s*\((estimate|unverified|published)\)\s*$/i, "");
}

/** The route's border total with the user's own clearing-agent fee in place
 *  of the agent estimate (null fee: the estimate stands). */
export function borderTotalWithAgentFee(items: BorderItem[] | null | undefined, routeTotal: number, agentFee: number | null): number {
  if (agentFee == null || !items?.length) return routeTotal;
  const agent = items.filter((b) => borderKind(b) === "agent").reduce((s, b) => s + (Number(b.amount) || 0), 0);
  if (!items.some((b) => borderKind(b) === "agent")) return routeTotal;
  const n = items.filter((b) => borderKind(b) === "agent").length;
  return Math.round((routeTotal - agent + agentFee * n) * 100) / 100;
}

/** The estimated part of a border total (for the costing's basis text). */
export function borderEstimate(items: BorderItem[] | null | undefined, agentFee: number | null): number {
  return Math.round((items || []).filter((b) => borderKind(b) !== "published" && !(agentFee != null && borderKind(b) === "agent"))
    .reduce((s, b) => s + (Number(b.amount) || 0), 0) * 100) / 100;
}
