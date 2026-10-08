// Trip economics display rules: job / return-pair margins, booking choices,
// invoice mismatch and quote actuals (backend core.services.trip_economics,
// docs/QUOTE-RULES.md "Trip economics"). Pure: no "@/" imports, node tests it.
import { formatMoneyWhole, formatDateShort } from "./formatters.ts";

export type Basis = "actual" | "estimate" | "mixed" | null;

export interface Missing { code: string; prompt: string; pending?: boolean }

export interface QuotedFigures { price: number | null; cost_floor: number | null; margin_pct: number | null }

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

/** "R 2 710 · 8%", or null when the margin isn't known. */
export function marginText(margin: unknown, pct: unknown): string | null {
  const m = num(margin);
  if (m === null) return null;
  return `${formatMoneyWhole(m)} · ${pctText(pct)}`;
}

export function roleLabel(role: EconomicsLeg["role"]): string {
  return role === "outbound" ? "Outbound" : role === "return" ? "Return" : "This job";
}

// Short names for the estimate bases (the server's label is the long form).
const ESTIMATE_SHORT: Record<string, string> = {
  snapshot: "quote costing",
  snapshot_return_linked: "no empty return",
  legacy_deadhead: "standard, empty return",
  legacy_paired: "standard, no empty return",
};

/** What the cost figure is: actual expenses, or which estimate. */
export function costBasisLabel(leg: Pick<EconomicsLeg, "cost_basis" | "estimate_label" | "estimate_basis">): string {
  if (leg.cost_basis === "actual") return "Actual costs";
  if (leg.cost_basis === "estimate") return `Estimate · ${ESTIMATE_SHORT[leg.estimate_basis] ?? leg.estimate_label ?? "quote costing"}`;
  return "No estimate";
}

export function revenueBasisLabel(basis: Basis): string {
  return basis === "actual" ? "Invoiced" : basis === "mixed" ? "Part invoiced" : "Job price";
}

/** Combined cost basis in a word ("Actual", "Estimate", "Actual and estimate"). */
export function combinedBasisLabel(basis: Basis): string {
  return basis === "actual" ? "Actual" : basis === "estimate" ? "Estimate" : basis === "mixed" ? "Actual and estimate" : "Incomplete";
}

/** The line shown when the pair's empty return came out of the estimates. */
export function emptyReturnNote(e: Pick<Economics, "pair" | "combined"> | null | undefined): string | null {
  if (!e?.pair) return null;
  const saved = num(e.combined?.empty_return_removed) ?? 0;
  if (saved <= 0) return null;
  return `Empty return removed: return load linked (${formatMoneyWhole(saved)} less cost)`;
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

/** How a booking is made for a choice: ONE convert_to_load call carries
 *  return_of_load_id / expect_return; only "an existing job brings this
 *  truck home" needs a follow-up link on the new job (convert_to_load has no
 *  parameter for it). Both calls are idempotent. */
export function bookingPlan(choice: ReturnChoice, quoteId: number | string, base: Record<string, unknown>): {
  convert: { url: string; data: Record<string, unknown> };
  after: ((loadId: number | string) => { url: string; data: Record<string, unknown> }) | null;
} {
  const url = `api/v1/quotes/${quoteId}/convert_to_load/`;
  const clean = Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  switch (choice.kind) {
    case "outbound": return { convert: { url, data: { ...clean, return_of_load_id: choice.loadId } }, after: null };
    case "expect": return { convert: { url, data: { ...clean, expect_return: true } }, after: null };
    case "return": {
      const ret = choice.loadId;
      return { convert: { url, data: clean }, after: (loadId) => ({ url: `api/v1/loads/${loadId}/link-return/`, data: { return_load_id: ret } }) };
    }
    default: return { convert: { url, data: clean }, after: null };
  }
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
    ? `${name} is ${formatMoneyWhole(inv)} excl. VAT; the job is now ${formatMoneyWhole(job)}${diff ? ` (${formatMoneyWhole(Math.abs(diff))} ${diff > 0 ? "more" : "less"})` : ""}. Issue a credit note or a new invoice.`
    : `${name} no longer matches the job's rate. Issue a credit note or a new invoice.`;
  return { title: "Invoice differs from the job's rate", detail };
}

export interface QuoteActuals {
  actual_margin_pct: number | null; actual_revenue: number | null; actual_cost: number | null;
  actual_cost_basis: string; backhaul_found: boolean | null; recorded_at?: string | null;
}

/** "Actual margin R 2 010 · 6%" with what it rests on, or null. */
export function actualsText(a: QuoteActuals | null | undefined): { line: string; basis: string } | null {
  if (!a) return null;
  const rev = num(a.actual_revenue);
  const cost = num(a.actual_cost);
  if (rev === null || cost === null) return null;
  const line = `Actual margin ${formatMoneyWhole(rev - cost)} · ${pctText(a.actual_margin_pct ?? (rev ? ((rev - cost) / rev) * 100 : null))}`;
  const costWord = a.actual_cost_basis === "actual" ? "Actual costs" : a.actual_cost_basis === "mixed" ? "Part actual costs" : "Estimated costs";
  const back = a.backhaul_found === true ? "came back loaded" : a.backhaul_found === false ? "came back empty" : null;
  return { line, basis: [costWord, back].filter(Boolean).join(" · ") };
}

/** The lane's return-load history sentence from the pricing analysis. */
export function returnHistoryText(h: unknown): string | null {
  const t = (h as { text?: unknown } | null)?.text;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}
