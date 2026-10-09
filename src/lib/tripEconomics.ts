// Trip economics display rules: job / return-pair margins, booking choices,
// invoice mismatch and quote actuals (backend core.services.trip_economics,
// docs/QUOTE-RULES.md "Trip economics"). Pure: no "@/" imports, node tests it.
import { l100 } from "./fleetFuel.ts";
import { formatMoney, formatMoneyWhole, formatDateShort } from "./formatters.ts";

export type Basis = "actual" | "estimate" | "mixed" | "part_actual" | null;

export interface Missing { code: string; prompt: string; pending?: boolean }

export interface QuotedFigures { price: number | null; cost_floor: number | null; margin_pct: number | null }

/** One cost group of a leg: what was recorded vs estimated, and which counts.
 *  basis "recorded_in_operating_estimate" = maintenance / insurance /
 *  overhead slips, shown but already inside the running-cost estimate. */
export interface CostGroup {
  group: string;
  /** fuel group only: the truck fuel figure the estimate was costed on. */
  rated_burn?: { value: number | null; source?: string | null } | null;
  estimated: number | null;
  actual: number | null;
  used: number | null;
  basis: "actual" | "estimate" | "none" | "recorded_in_operating_estimate" | string;
}

export interface EconomicsLeg {
  load_id: number;
  load_number: string;
  role: "single" | "outbound" | "return";
  status?: string;
  lane?: string;
  revenue: number | null;
  revenue_basis: Basis;
  actual_cost: number | null;
  estimated_cost: number | null;
  estimate_basis: string;
  estimate_label: string;
  cost: number | null;
  cost_basis: Basis;
  margin: number | null;
  margin_pct: number | null;
  quoted: QuotedFigures;
  margin_vs_quoted_pts: number | null;
  empty_return_removed: number | null;
  missing: Missing[];
  cost_groups?: CostGroup[];
  cost_complete?: boolean;
  costs_closed?: boolean;
  costing_source?: string;
}

export interface EconomicsCombined {
  revenue: number | null;
  revenue_basis: Basis;
  cost: number | null;
  cost_basis: Basis;
  margin: number | null;
  margin_pct: number | null;
  quoted: QuotedFigures;
  margin_vs_quoted_pts: number | null;
  empty_return_removed: number;
  cost_complete?: boolean;
}

export interface Economics {
  pair: boolean;
  outbound_id?: number;
  return_id?: number;
  legs: EconomicsLeg[];
  combined: EconomicsCombined;
  expecting_return?: boolean;
}

const MINUS = "−";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Whole per cent, half away from zero, with a real minus: "−19%". */
export function pctText(p: unknown): string {
  const n = num(p);
  if (n === null) return "—";
  const r = Math.sign(n) * Math.round(Math.abs(n));
  return `${r < 0 ? MINUS : ""}${Math.abs(r)}%`;
}

/** Percentage points against the quote: "+4,4 pts", "−3 pts", "0 pts". */
export function ptsText(p: unknown): string {
  const n = num(p);
  if (n === null) return "—";
  const r = Math.round(Math.abs(n) * 10) / 10;
  if (r === 0) return "0 pts";
  const body = Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
  return `${n < 0 ? MINUS : "+"}${body} pts`;
}

/** Money on trip figures is to the cent so revenue − cost = margin on screen
 *  and matches the invoice ("R 31 234,56"). */
export const money = (v: unknown): string | null => (num(v) === null ? null : formatMoney(num(v)));

/** "R 2 710,40 · 8%", or null when the margin isn't known. */
export function marginText(margin: unknown, pct: unknown): string | null {
  const m = num(margin);
  if (m === null) return null;
  return `${formatMoney(m)} · ${pctText(pct)}`;
}

export function roleLabel(role: EconomicsLeg["role"]): string {
  return role === "outbound" ? "Outbound" : role === "return" ? "Return" : "This job";
}

// Short names for the estimate bases (the server's label is the long form).
// A job never quoted (TMS) is costed from its own data, not "quote costing".
const ESTIMATE_SHORT: Record<string, string> = {
  snapshot: "quote costing",
  snapshot_return_linked: "no empty return",
  legacy_deadhead: "standard, empty return",
  legacy_paired: "standard, no empty return",
};
const ESTIMATE_SHORT_COMPUTED: Record<string, string> = {
  snapshot: "job costing",
  snapshot_return_linked: "job costing, no empty return",
};

/** THE cost label (job card and quote outcome use it alike): what the cost
 *  rests on, and whether it is final. Operating (running cost) estimated =
 *  never "Actual", unless the costs are closed (the server's basis says so). */
export function costLabel(basis: Basis | string | null | undefined, complete: boolean | undefined): string {
  if (basis === "actual") return complete ? "Actual costs" : "Actual so far · not final";
  if (basis === "part_actual" || basis === "mixed") return complete ? "Part actual · running cost estimated" : "Part actual · not final";
  if (basis === "estimate") return "Estimate";
  return "No estimate";
}

/** What the cost figure is: actual expenses, or which estimate. */
export function costBasisLabel(leg: Pick<EconomicsLeg, "cost_basis" | "estimate_label" | "estimate_basis"> & Partial<Pick<EconomicsLeg, "cost_complete" | "costing_source">>): string {
  if (leg.cost_basis === "estimate") {
    const short = leg.costing_source === "computed" ? ESTIMATE_SHORT_COMPUTED[leg.estimate_basis] : undefined;
    return `Estimate · ${short ?? ESTIMATE_SHORT[leg.estimate_basis] ?? leg.estimate_label ?? "quote costing"}`;
  }
  return costLabel(leg.cost_basis, leg.cost_complete);
}

const GROUP_NAMES: Record<string, string> = {
  fuel: "fuel", tolls: "tolls", driver: "driver", operating: "running cost", border: "border",
  other: "other", subcontractor: "subcontractor", operating_recorded: "maintenance & overheads",
};

/** Which cost groups are actual and which are estimated, plus slips already
 *  inside the running-cost estimate: "Actual: fuel, tolls · Estimated: running cost". */
export function costGroupsText(groups: CostGroup[] | null | undefined): { line: string | null; recordedNote: string | null } {
  const g = groups ?? [];
  const actual = g.filter((x) => x.basis === "actual").map((x) => GROUP_NAMES[x.group] ?? x.group);
  const est = g.filter((x) => x.basis === "estimate").map((x) => GROUP_NAMES[x.group] ?? x.group);
  const parts = [actual.length ? `Actual: ${actual.join(", ")}` : "", est.length ? `Estimated: ${est.join(", ")}` : ""].filter(Boolean);
  const rec = g.find((x) => x.basis === "recorded_in_operating_estimate");
  const recAmt = rec ? num(rec.actual) : null;
  return {
    line: actual.length ? parts.join(" · ") : null,
    recordedNote: recAmt ? `Maintenance and overheads recorded ${formatMoney(recAmt)}: inside the running cost, not added again` : null,
  };
}

/** Under the cost, while fuel is still an estimate: the figure it used
 *  ("Fuel estimated on 40,2 L/100 km measured by Cartrack"). */
export function fuelBurnNote(groups: CostGroup[] | null | undefined): string | null {
  const f = (groups ?? []).find((x) => x.group === "fuel");
  const rb = f?.rated_burn;
  if (!f || f.basis !== "estimate" || !rb) return null;
  const v = l100(rb.value);
  if (!v) return null;
  if (rb.source === "measured") return `Fuel estimated on ${v} measured by Cartrack`;
  if (rb.source === "standard") return `Fuel estimated on the standard ${v}`;
  return `Fuel estimated on your figure, ${v}`;
}

export function revenueBasisLabel(basis: Basis): string {
  const what = basis === "actual" ? "Invoiced" : basis === "mixed" || basis === "part_actual" ? "Part invoiced" : "Job price";
  return `${what}, excl. VAT`;
}

/** Combined cost basis in a word ("Actual", "Estimate", "Actual and estimate"). */
export function combinedBasisLabel(basis: Basis): string {
  return basis === "actual" ? "Actual" : basis === "estimate" ? "Estimate" : basis === "mixed" || basis === "part_actual" ? "Part actual" : "Incomplete";
}

/** The line shown when the pair's empty return came out of the estimates. */
export function emptyReturnNote(e: Pick<Economics, "pair" | "combined"> | null | undefined): string | null {
  if (!e?.pair) return null;
  const saved = num(e.combined?.empty_return_removed) ?? 0;
  if (saved <= 0) return null;
  return `Empty return removed: return load linked (${formatMoney(saved)} less cost)`;
}

/** One list of what to add to cost the job(s), each prompt once. */
export function missingPrompts(e: Pick<Economics, "legs"> | null | undefined): Missing[] {
  const seen = new Set<string>();
  const out: Missing[] = [];
  for (const leg of e?.legs ?? []) {
    for (const m of leg.missing ?? []) {
      if (!m?.prompt || seen.has(m.prompt)) continue;
      seen.add(m.prompt);
      out.push(m);
    }
  }
  return out;
}

/** The pair's combined figures recomputed from its legs (the server's rule:
 *  sums; margin % of revenue; quoted margin = (Σ price − Σ floor) / Σ price).
 *  Used to check what the server sends and in tests. */
export function combineLegs(legs: Pick<EconomicsLeg, "revenue" | "cost" | "quoted">[]): {
  revenue: number | null; cost: number | null; margin: number | null; marginPct: number | null; quotedMarginPct: number | null;
} {
  const sum = (xs: (number | null)[]) => (xs.some((x) => x === null) ? null : Math.round(xs.reduce<number>((a, b) => a + (b as number), 0) * 100) / 100);
  const revenue = sum(legs.map((l) => num(l.revenue)));
  const cost = sum(legs.map((l) => num(l.cost)));
  const margin = revenue !== null && cost !== null ? Math.round((revenue - cost) * 100) / 100 : null;
  const marginPct = margin !== null && revenue ? Math.round((margin / revenue) * 10000) / 100 : null;
  const qp = sum(legs.map((l) => num(l.quoted?.price)));
  const qf = sum(legs.map((l) => num(l.quoted?.cost_floor)));
  const quotedMarginPct = qp && qf !== null ? Math.round(((qp - qf) / qp) * 10000) / 100 : null;
  return { revenue, cost, margin, marginPct, quotedMarginPct };
}

// ---------------------------------------------------------------------------
// Return-load candidates and the booking choice
// ---------------------------------------------------------------------------

export interface LinkWarning { code: string; title: string; detail?: string }

export interface Candidate {
  load_id: number;
  load_number: string;
  customer_name?: string;
  pickup?: string;
  delivery?: string;
  pickup_date?: string | null;
  delivery_date?: string | null;
  total_amount?: number;
  status?: string;
  pickup_km_from_drop?: number | null;
  delivery_km_from_home?: number | null;
  reverses_lane?: boolean;
  warnings?: LinkWarning[];
}

/** "Durban → Johannesburg · 12 Oct · R 21 500". */
export function candidateSummary(c: Candidate, direction: "return" | "outbound" = "return"): string {
  const lane = [c.pickup, c.delivery].filter(Boolean).join(" → ");
  const day = direction === "return" ? c.pickup_date : c.delivery_date;
  return [lane, day ? formatDateShort(day) : "", num(c.total_amount) ? formatMoneyWhole(c.total_amount) : ""]
    .filter(Boolean).join(" · ");
}

/** The candidate's fit, in a few words: "Reverses the lane" or the distance. */
export function candidateFit(c: Candidate): string | null {
  if (c.reverses_lane) return "Reverses the lane";
  const km = num(c.pickup_km_from_drop);
  return km !== null ? `Collects ${Math.round(km)} km from the drop` : null;
}

export type ReturnChoice =
  | { kind: "none" }
  | { kind: "expect" }
  | { kind: "return"; loadId: number }    // an existing job brings this one's truck home
  | { kind: "outbound"; loadId: number }; // this job is the return of an existing one

/** Which convert_to_load field links a job from each suggestion list
 *  (the server's `link_fields`; these are its values). */
export const DEFAULT_LINK_FIELDS = { outbound_candidates: "return_of_load_id", return_candidates: "return_load_id" };

/** The ONE convert_to_load call for a choice: the link (either direction) or
 *  the "expecting a return" flag rides on the booking itself, atomically. */
export function bookingRequest(choice: ReturnChoice, quoteId: number | string, base: Record<string, unknown>,
  linkFields: Partial<typeof DEFAULT_LINK_FIELDS> | null | undefined = null): { url: string; data: Record<string, unknown> } {
  const url = `api/v1/quotes/${quoteId}/convert_to_load/`;
  const f = { ...DEFAULT_LINK_FIELDS, ...(linkFields || {}) };
  const data = Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  if (choice.kind === "return") data[f.return_candidates] = choice.loadId;
  if (choice.kind === "outbound") data[f.outbound_candidates] = choice.loadId;
  if (choice.kind === "expect") data.expect_return = true;
  return { url, data };
}

/** A costing-missing item that is being worked out (no action, refresh). */
export function isPending(m: Missing | null | undefined): boolean {
  return !!m?.pending;
}

/** Margin of the job as it would be booked: price − cost floor. */
export function previewMargin(price: unknown, floor: unknown): { amount: number; pct: number } | null {
  const p = num(price);
  const f = num(floor);
  if (p === null || f === null || p <= 0) return null;
  return { amount: Math.round((p - f) * 100) / 100, pct: ((p - f) / p) * 100 };
}

/** Warnings from either answer (link-return, or booking.return_link). */
export function linkWarnings(res: unknown): LinkWarning[] {
  const r = res as { warnings?: unknown; booking?: { return_link?: { warnings?: unknown } } } | null;
  const list = r?.warnings ?? r?.booking?.return_link?.warnings;
  return Array.isArray(list) ? (list as LinkWarning[]).filter((w) => w && w.title) : [];
}

/** A link the repeat booking couldn't make (it reports instead of failing). */
export function linkRefusal(res: unknown): string | null {
  const link = (res as { booking?: { return_link?: { linked?: boolean; detail?: string; error?: string } } } | null)?.booking?.return_link;
  return link && link.linked === false && (link.detail || link.error) ? (link.detail || "That job can't be linked.") : null;
}

// ---------------------------------------------------------------------------
// Invoice preview, mismatch, quote actuals, lane history
// ---------------------------------------------------------------------------

export interface InvoicePreview {
  state: "on_delivery" | "manual" | "raised" | "not_invoiceable";
  lines?: { description: string; net_amount: number }[];
  subtotal?: number; vat_amount?: number; total?: number;
  payment_terms?: string; terms_days?: number | null; auto_email?: boolean;
  invoice_number?: string; reason?: string;
}

/** "Raised on delivery · 30 days · emailed to the customer". */
export function invoiceWhenText(p: InvoicePreview | null | undefined): string | null {
  if (!p) return null;
  if (p.state === "raised") return p.invoice_number ? `Invoice ${p.invoice_number} raised` : "Invoice raised";
  if (p.state === "not_invoiceable") return p.reason === "no_amount" ? "No price on the job, so no invoice" : "No invoice";
  const when = p.state === "on_delivery" ? "Raised on delivery" : "Raised by hand";
  const terms = num(p.terms_days) !== null ? (p.terms_days === 0 ? "due on receipt" : `${p.terms_days} days`) : null;
  const email = p.state === "on_delivery" ? (p.auto_email ? "emailed to the customer" : "you send it") : null;
  return [when, terms, email].filter(Boolean).join(" · ");
}

export interface InvoiceMismatch {
  code?: string; invoice_id?: number; invoice_number?: string;
  invoice_excl_vat?: number; load_total_excl_vat?: number; difference?: number; title?: string;
}

/** Banner text for a job whose rate changed after it was invoiced, or null. */
export function invoiceMismatchText(m: InvoiceMismatch | null | undefined): { title: string; detail: string } | null {
  if (!m || m.code !== "invoice_differs_from_rate") return null;
  const inv = num(m.invoice_excl_vat);
  const job = num(m.load_total_excl_vat);
  const diff = num(m.difference) ?? (inv !== null && job !== null ? job - inv : null);
  const name = m.invoice_number ? `Invoice ${m.invoice_number}` : "The invoice";
  const detail = inv !== null && job !== null
    ? `${name} is ${formatMoney(inv)} excl. VAT; the job is now ${formatMoney(job)}${diff ? ` (${formatMoney(Math.abs(diff))} ${diff > 0 ? "more" : "less"})` : ""}. Issue a credit note or a new invoice.`
    : `${name} no longer matches the job's rate. Issue a credit note or a new invoice.`;
  return { title: "Invoice differs from the job's rate", detail };
}

export interface QuoteActuals {
  actual_margin_pct: number | null; actual_revenue: number | null; actual_cost: number | null;
  actual_cost_basis: string; backhaul_found: boolean | null; recorded_at?: string | null;
  /** Costs final (delivered + key costs recorded, or closed): actual_* set. */
  complete?: boolean;
  estimated_cost?: number | null; estimated_margin_pct?: number | null;
}

/** One decimal, comma: "22,5%". */
const pct1 = (p: number) => `${p < 0 ? MINUS : ""}${Math.abs(Math.round(p * 10) / 10).toFixed(1).replace(".", ",")}%`;

/** Quote outcome: "Actual margin R 2 010,01 · 6%" once costs are final, else
 *  "Margin so far ~22,5% · costs not final"; the basis uses the job card's rule. */
export function actualsText(a: QuoteActuals | null | undefined): { line: string; basis: string; final: boolean; negative: boolean } | null {
  if (!a) return null;
  const back = a.backhaul_found === true ? "came back loaded" : a.backhaul_found === false ? "came back empty" : null;
  const rev = num(a.actual_revenue);
  const cost = num(a.actual_cost);
  const complete = a.complete ?? (rev !== null && cost !== null);
  if (complete && rev !== null && cost !== null) {
    const line = `Actual margin ${formatMoney(rev - cost)} · ${pctText(a.actual_margin_pct ?? (rev ? ((rev - cost) / rev) * 100 : null))}`;
    return { line, basis: [costLabel(a.actual_cost_basis, true), back].filter(Boolean).join(" · "), final: true, negative: rev - cost < 0 };
  }
  const est = num(a.estimated_margin_pct);
  if (est === null) return null;
  return {
    line: `Margin so far ~${pct1(est)} · costs not final`,
    basis: [costLabel(a.actual_cost_basis || "estimate", false), back].filter(Boolean).join(" · "),
    final: false, negative: est < 0,
  };
}

/** The lane's return-load history sentence from the pricing analysis. */
export function returnHistoryText(h: unknown): string | null {
  const t = (h as { text?: unknown } | null)?.text;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}
