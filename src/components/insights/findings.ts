/* Findings engine (client side, read only).

   Every finding is computed from records the app already fetches through
   existing GET endpoints. Each one carries the records behind it (evidence),
   so every rand figure can be traced to invoices, expenses, loads or quotes.
   Nothing here writes data or performs an action: an action is a link to the
   page where the owner does it.

   Rules follow docs/product/review/01-MONEY.md section 5, kept conservative:
   a finding fires only on a clear trigger and above a R 1 000 threshold. */

import { formatMoney, formatMoneyWhole, formatPercent } from '@/lib/formatters';
import { saDateISO, saDaysBetween } from '@/lib/dates';
import { STALE_AFTER_DAYS, staleAction, staleLabel, staleLoads, staleWork } from '@/lib/staleWork';
import { fetchData } from '@/lib/Api';
import { resolvePeriod, periodText, type Ledger } from '@/components/reports/data';
import { marginFromLedger } from './margin-ledger';

// ---------------------------------------------------------------- fetching

/** Loads every page of a DRF list endpoint by following `next` (GET only).
 *  The API ignores page_size and returns 20 rows a page, so a single request
 *  is never the whole list. Stops after `maxPages` and says so. */
export async function fetchAllPages<T>(path: string, maxPages = 50): Promise<{ rows: T[]; count: number; complete: boolean }> {
  const rows: T[] = [];
  let url: string | null = path;
  let count = 0;
  let pages = 0;
  while (url && pages < maxPages) {
    const res: any = await fetchData(url);
    pages += 1;
    if (Array.isArray(res)) return { rows: res as T[], count: res.length, complete: true };
    rows.push(...((res?.results ?? []) as T[]));
    count = Number(res?.count ?? rows.length);
    url = res?.next ? toRelative(res.next) : null;
  }
  return { rows, count, complete: !url };
}

/** The API returns absolute `next` links on its own host; keep path and query
 *  so the request goes through the configured client and auth. */
function toRelative(next: string): string {
  try {
    const u = new URL(next);
    return `${u.pathname.replace(/^\//, '')}${u.search}`;
  } catch {
    return next;
  }
}

// ------------------------------------------------------------------- types

export interface InvoiceRec {
  id: number; invoice_number: string; customer: number | null; customer_name: string;
  status: string; issue_date: string; due_date: string; created_at: string;
  total_amount: string | number; paid_amount: string | number; balance: string | number;
  sent_at: string | null; paid_at: string | null; last_reminder_at: string | null; reminder_count: number | null;
  load: number | null;
}
export interface PaymentRec { id: number; invoice: number | null; amount: string | number; payment_date: string }
export interface ExpenseRec { id: number; expense_number?: string; category: string; description?: string; amount: string | number; expense_date: string; status: string; created_at: string }
export interface LoadRec {
  id: number; load_number: string; customer: number | null; customer_name: string; status: string; total_amount: string | number;
  delivery_date: string | null; pickup_date?: string | null; created_at?: string | null; pickup_city?: string; delivery_city?: string; pickup_location?: string; delivery_location?: string;
  pod_document: string | null; pod_signature: string | null; pod_received_by: string | null; quote: number | null;
}
export interface QuoteRec {
  id: number; quote_number: string; customer_name: string; status: string; total_amount: string | number;
  fuel_surcharge: string | number | null; fuel_price_at_creation: string | number | null; valid_until: string | null;
  pickup_location?: string; delivery_location?: string;
}
export interface FinanceRec { total_revenue?: number; total_expenses?: number }
export interface FuelRec { inland_price?: number; coastal_price?: number; date?: string; last_updated?: string; source?: string }
export interface CompanyRec { fuel_zone?: string; fuel_price_per_litre?: string | number | null }
export interface CashflowWeek { period: string; start_date: string; end_date: string; expected_in: number | string; expected_out: number | string }
export interface CashflowRec { forecast?: CashflowWeek[] }

export interface Source<T> { rows: T[]; count: number; complete: boolean }

export interface FindingInputs {
  invoices: Source<InvoiceRec>;
  payments: Source<PaymentRec> | null;
  expenses: Source<ExpenseRec> | null;
  loads: Source<LoadRec> | null;
  quotes: Source<QuoteRec> | null;
  /** No longer read: margin comes from the ledgers (margin-ledger.ts). Kept optional for callers. */
  finance?: FinanceRec | null;
  fuel: FuelRec | null;
  company: CompanyRec | null;
  /** Weekly cash forecast (dashboard/cashflow). Optional: only the shortfall finding uses it. */
  cashflow?: CashflowRec | null;
}

export type Severity = 'high' | 'medium' | 'low';
export type Category = 'Get paid' | 'Know your margin' | 'Quote better' | 'Bill your work' | 'Clear old orders' | 'Cash ahead';

export interface EvidenceRow {
  id: string;
  /** Record number, e.g. an invoice number. */
  ref: string;
  label: string;
  /** Short fact about the record, e.g. "112 days late". */
  note: string;
  amount: number;
  href: string;
}

export interface Finding {
  id: string;
  kind: 'never_sent' | 'stopped_paying' | 'never_chased' | 'short_paid' | 'no_pod' | 'pending_costs' | 'diesel' | 'open_loads' | 'pending_loads' | 'expired_quotes' | 'cash_shortfall';
  category: Category;
  severity: Severity;
  confidence: 'high' | 'medium' | 'low';
  basis: 'Measured' | 'Estimated';
  amount: number;
  /** 2 to 6 words that follow the figure. */
  headline: string;
  /** One supporting line, at most 15 words. */
  line: string;
  action: { label: string; href: string };
  /** How it was calculated (the info icon). */
  method: string;
  evidence: EvidenceRow[];
  evidenceNoun: [string, string];
  /** Invoice ids carried by the finding (for the de-duplicated total). */
  invoiceIds: number[];
  /** Load ids carried by the finding (unbilled work). */
  loadIds: number[];
  /** Counts toward "cash held up": money owed or unbilled, measured. */
  cash: boolean;
}

// ----------------------------------------------------------------- helpers

export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
/**
 * Whole days from a to b (b later is positive), as South African calendar
 * days: the Debtors report's count (todayISO in Africa/Johannesburg), so
 * "N days late" here is the same number as on Debtors in any time zone.
 */
export const daysBetween = (a: string | Date, b: string | Date) => saDaysBetween(a, b) ?? 0;
const dateOnly = (s: string | null | undefined) => (s ? s.slice(0, 10) : '');
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Whole rand, e.g. "R 127 621". Used in headlines and lines, where cents are noise. */
export const randWhole = (v: number) => formatMoneyWhole(Math.round(v));
const perLitre = (v: number) => formatMoney(v, 2);
const shortName = (s: string) => s.replace(/\s+(\(Pty\)\s*)?(Ltd|Limited|Holdings|Group|Beverages SA|Industries)\.?$/i, '').replace(/\s+(Ltd|Limited|Holdings)\.?$/i, '').trim() || s;

const CLOSED = new Set(['PAID', 'CANCELLED', 'CANCELED', 'VOID', 'WRITTEN_OFF', 'DRAFT']);
/** Sent and not fully paid. Drafts are not owed: the customer has not seen them. */
const isOpen = (i: InvoiceRec) => !CLOSED.has((i.status || '').toUpperCase()) && num(i.balance) > 0;
const neverReminded = (i: InvoiceRec) => !num(i.reminder_count) && !i.last_reminder_at;

const THRESHOLD = 1000;
const SHORTFALL_WEEKS = 8;
const SHORTFALL_MIN = 5000;
const MONTH3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "26 Oct" */
const shortDay = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTH3[Number(iso.slice(5, 7)) - 1] ?? ''}`;
const invHref = (i: InvoiceRec) => `/finance/invoices/${i.id}`;

// ---------------------------------------------------------------- findings

export function computeFindings(input: FindingInputs, now = new Date()): Finding[] {
  const today = now;
  const invoices = input.invoices.rows;
  const out: Finding[] = [];
  const invCompleteNote = input.invoices.complete ? '' : ` Based on the first ${input.invoices.rows.length} of ${input.invoices.count} invoices.`;
  const lateDays = (i: InvoiceRec) => (i.due_date ? daysBetween(i.due_date, today) : 0);
  const invoiceRow = (i: InvoiceRec, note: string, amount = num(i.balance)): EvidenceRow => ({
    id: `inv-${i.id}`, ref: i.invoice_number, label: i.customer_name, note, amount, href: invHref(i),
  });

  // 1. Invoices created but never sent ------------------------------------
  const drafts = invoices
    .filter(i => (i.status || '').toUpperCase() === 'DRAFT' && num(i.total_amount) > 0 && daysBetween(i.created_at, today) >= 2)
    .sort((a, b) => num(b.total_amount) - num(a.total_amount));
  const draftTotal = drafts.reduce((s, i) => s + num(i.total_amount), 0);
  if (drafts.length && draftTotal >= THRESHOLD) {
    const oldest = Math.max(...drafts.map(i => daysBetween(i.created_at, today)));
    out.push({
      id: 'never_sent', kind: 'never_sent', category: 'Get paid', basis: 'Measured', confidence: 'high',
      severity: oldest > 30 ? 'high' : 'medium',
      amount: draftTotal,
      headline: 'Invoiced, never sent',
      line: `${plural(drafts.length, 'draft invoice')}, the oldest ${oldest} days old. Customers have not seen them.`,
      action: { label: drafts.length === 1 ? 'Review and send' : `Review ${drafts.length} drafts`, href: '/finance/invoices?status=DRAFT' },
      method: `Invoices still in Draft at least 2 days after they were created. Value is each invoice total including VAT. Drafts are not counted as owed anywhere in this feed.${invCompleteNote}`,
      evidence: drafts.map(i => invoiceRow(i, `created ${daysBetween(i.created_at, today)} days ago`, num(i.total_amount))),
      evidenceNoun: ['draft invoice', 'draft invoices'],
      invoiceIds: drafts.map(i => i.id), loadIds: [], cash: true,
    });
  }

  // Payments per invoice (for part-payments).
  const lastPayment = new Map<number, string>();
  (input.payments?.rows ?? []).forEach(p => {
    if (p.invoice == null) return;
    const prev = lastPayment.get(p.invoice);
    if (!prev || p.payment_date > prev) lastPayment.set(p.invoice, p.payment_date);
  });

  // 2. Customers who stopped paying (one card per customer) ----------------
  const byCustomer = new Map<string, InvoiceRec[]>();
  invoices.forEach(i => {
    const k = i.customer != null ? `c${i.customer}` : `n${i.customer_name}`;
    const a = byCustomer.get(k) || []; a.push(i); byCustomer.set(k, a);
  });
  const stoppedCustomers = new Set<string>();
  byCustomer.forEach((list, key) => {
    const paid = list.filter(i => (i.status || '').toUpperCase() === 'PAID' && i.paid_at && i.due_date);
    const onTime = paid.filter(i => dateOnly(i.paid_at) <= i.due_date);
    const open = list.filter(isOpen);
    const openTotal = open.reduce((s, i) => s + num(i.balance), 0);
    const stuck = open.filter(i => lateDays(i) >= 30);
    if (!stuck.length || openTotal < 20000) return;
    // Skipped: a newer invoice was paid while an older one is still open.
    const skipped = open
      .filter(o => paid.some(p => p.issue_date > o.issue_date))
      .sort((a, b) => a.issue_date.localeCompare(b.issue_date));
    const goodHistory = paid.length >= 2 && onTime.length === paid.length;
    if (!goodHistory) return;
    stoppedCustomers.add(key);
    const maxLate = Math.max(...stuck.map(lateDays));
    const skip = skipped[0];
    const name = list[0].customer_name;
    const customerId = list[0].customer;
    out.push({
      id: `stopped_${key}`, kind: 'stopped_paying', category: 'Get paid', basis: 'Measured',
      confidence: skip ? 'high' : 'medium', severity: 'high',
      amount: openTotal,
      headline: `${shortName(name)} stopped paying`,
      line: skip
        ? `Paid ${plural(onTime.length, 'invoice')} on time, then skipped ${skip.invoice_number}. Now ${maxLate} days late.`
        : `Paid ${plural(onTime.length, 'invoice')} on time. Now ${plural(stuck.length, 'invoice')} up to ${maxLate} days late.`,
      action: { label: skip ? 'Call about the skipped invoice' : 'Call their accounts team', href: customerId != null ? `/customers/${customerId}` : '/finance/invoices' },
      method: `A customer who paid at least 2 invoices by their due date and now has at least R 20 000 unpaid, with an invoice 30 or more days late${skip ? ', and who paid a newer invoice while an older one is still open (often a dispute or a missing proof of delivery)' : ''}. Value is their open balance on sent invoices.${invCompleteNote}`,
      evidence: [...list]
        .sort((a, b) => a.issue_date.localeCompare(b.issue_date))
        .filter(i => (i.status || '').toUpperCase() !== 'DRAFT')
        .map(i => {
          const isPaid = (i.status || '').toUpperCase() === 'PAID';
          const note = isPaid
            ? `paid ${i.paid_at && i.due_date ? (dateOnly(i.paid_at) <= i.due_date ? 'on time' : `${daysBetween(i.due_date, dateOnly(i.paid_at))} days late`) : ''}`
            : `${i === skip ? 'skipped, ' : ''}${lateDays(i) > 0 ? `${lateDays(i)} days late` : 'not yet due'}`;
          return invoiceRow(i, note, isPaid ? num(i.total_amount) : num(i.balance));
        }),
      evidenceNoun: ['invoice', 'invoices'],
      invoiceIds: open.map(i => i.id), loadIds: [], cash: true,
    });
  });

  // 3. Part-paid invoices (short-paid) -------------------------------------
  const shortPaid = invoices.filter(i => {
    if (!isOpen(i)) return false;
    const total = num(i.total_amount); const paidAmt = num(i.paid_amount);
    if (paidAmt <= 0 || paidAmt >= 0.9 * total) return false;
    const key = i.customer != null ? `c${i.customer}` : `n${i.customer_name}`;
    if (stoppedCustomers.has(key)) return false;
    const last = lastPayment.get(i.id);
    return last ? daysBetween(last, today) >= 14 : false;
  }).sort((a, b) => num(b.balance) - num(a.balance));
  const shortTotal = shortPaid.reduce((s, i) => s + num(i.balance), 0);
  const shortIds = new Set(shortPaid.map(i => i.id));
  if (shortPaid.length && shortTotal >= THRESHOLD) {
    const quiet = Math.min(...shortPaid.map(i => daysBetween(lastPayment.get(i.id)!, today)));
    out.push({
      id: 'short_paid', kind: 'short_paid', category: 'Get paid', basis: 'Measured', confidence: 'medium',
      severity: 'medium',
      amount: shortTotal,
      headline: 'Unpaid after part-payments',
      line: `${plural(shortPaid.length, 'invoice')} part-paid, then nothing for at least ${quiet} days.`,
      action: { label: 'Ask for remittance advice', href: shortPaid.length === 1 ? invHref(shortPaid[0]) : '/finance/invoices' },
      method: `Sent invoices where less than 90% has been paid and no further payment has been recorded for 14 days. A small or partial payment often means a query on the invoice or a payment allocated to the wrong invoice. Value is the unpaid remainder.${invCompleteNote}`,
      evidence: shortPaid.map(i => invoiceRow(i, `${Math.round((num(i.paid_amount) / num(i.total_amount)) * 100)}% paid`)),
      evidenceNoun: ['invoice', 'invoices'],
      invoiceIds: shortPaid.map(i => i.id), loadIds: [], cash: true,
    });
  }

  // 4. Overdue and never chased (grouped) ----------------------------------
  const unchased = invoices.filter(i => {
    if (!isOpen(i) || lateDays(i) <= 7 || !neverReminded(i) || shortIds.has(i.id)) return false;
    const key = i.customer != null ? `c${i.customer}` : `n${i.customer_name}`;
    return !stoppedCustomers.has(key);
  }).sort((a, b) => num(b.balance) - num(a.balance));
  const unchasedTotal = unchased.reduce((s, i) => s + num(i.balance), 0);
  if (unchased.length && unchasedTotal >= THRESHOLD) {
    const customers = new Set(unchased.map(i => i.customer ?? i.customer_name)).size;
    // Days past the due date, weighted by balance: the Debtors report's "Average days late" basis.
    const avgLate = Math.round(unchased.reduce((s, i) => s + lateDays(i) * num(i.balance), 0) / unchasedTotal);
    // The line quotes the oldest invoice: the same day count as its row on Debtors "By invoice"
    // (an average over this subset would sit next to Debtors' whole-book average and disagree).
    const maxLate = Math.max(...unchased.map(lateDays));
    out.push({
      id: 'never_chased', kind: 'never_chased', category: 'Get paid', basis: 'Measured', confidence: 'high',
      severity: avgLate > 60 ? 'high' : 'medium',
      amount: unchasedTotal,
      headline: 'Overdue, never chased',
      line: `${plural(customers, 'customer')}, up to ${maxLate} days past the due date. No reminder sent on any.`,
      action: { label: 'Send reminders', href: '/finance/invoices' },
      method: `Sent invoices more than 7 days past their due date with no reminder ever recorded. Customers and invoices already in a card above are left out. Value is the unpaid balance. Days late are whole days since each invoice's due date, counted as on the Debtors report.${invCompleteNote}`,
      evidence: unchased.map(i => invoiceRow(i, `${lateDays(i)} days late`)),
      evidenceNoun: ['invoice', 'invoices'],
      invoiceIds: unchased.map(i => i.id), loadIds: [], cash: true,
    });
  }

  // 5. Unpaid with no proof of delivery -----------------------------------
  if (input.loads) {
    const loadById = new Map(input.loads.rows.map(l => [l.id, l]));
    const noPod = invoices.filter(i => {
      if (!isOpen(i) || lateDays(i) <= 0 || i.load == null) return false;
      const l = loadById.get(i.load);
      return !!l && !l.pod_document && !(l.pod_signature || '').trim() && !(l.pod_received_by || '').trim();
    }).sort((a, b) => num(b.balance) - num(a.balance));
    const podTotal = noPod.reduce((s, i) => s + num(i.balance), 0);
    const linked = invoices.filter(i => isOpen(i) && i.load != null).length;
    const openCount = invoices.filter(isOpen).length;
    if (noPod.length && podTotal >= THRESHOLD) {
      const first = loadById.get(noPod[0].load!)!;
      out.push({
        id: 'no_pod', kind: 'no_pod', category: 'Get paid', basis: 'Measured', confidence: 'high',
        severity: 'medium',
        amount: podTotal,
        headline: 'Overdue, no proof of delivery',
        line: `${plural(noPod.length, 'overdue invoice')} without a POD. Customers ask for it first.`,
        action: { label: noPod.length === 1 ? 'Attach the POD' : 'Attach PODs, largest first', href: `/bookings/${first.id}` },
        method: `Overdue invoices whose load has no POD document, signature or received-by name. Only invoices linked to a load can be checked: ${linked} of ${openCount} open invoices are. Some invoices here may also appear in another card, so values are not added across cards.${invCompleteNote}${input.loads.complete ? '' : ' Not every load could be loaded.'}`,
        evidence: noPod.map(i => ({ ...invoiceRow(i, `${loadById.get(i.load!)!.load_number}, ${lateDays(i)} days late`), href: `/bookings/${i.load}` })),
        evidenceNoun: ['invoice', 'invoices'],
        invoiceIds: noPod.map(i => i.id), loadIds: [], cash: true,
      });
    }
  }

  // 6. Costs waiting for approval distort the margin ----------------------
  // The margin is the Margin tab's and the P&L's (margin-ledger.ts, last 12
  // months, excl. VAT, cash basis), never the backend finance endpoint, so the
  // three pages print the same percentage and the same "with pending" figure.
  if (input.expenses && input.payments) {
    const pending = input.expenses.rows
      .filter(e => (e.status || '').toUpperCase() === 'PENDING' && num(e.amount) > 0 && daysBetween(e.created_at || e.expense_date, today) >= 7)
      .sort((a, b) => num(b.amount) - num(a.amount));
    const pendingTotal = pending.reduce((s, e) => s + num(e.amount), 0);
    const period = resolvePeriod('last-12');
    const m = marginFromLedger({
      invoices: invoices as unknown as Ledger['invoices'],
      payments: input.payments.rows as unknown as Ledger['payments'],
      expenses: input.expenses.rows as unknown as Ledger['expenses'],
    }, period);
    const withPending = m.net - m.pending;
    const flips = m.net >= 0 && withPending < 0;
    if (pending.length && pendingTotal >= THRESHOLD && (flips || pendingTotal > 0.05 * m.costs)) {
      out.push({
        id: 'pending_costs', kind: 'pending_costs', category: 'Know your margin', basis: 'Measured', confidence: 'high',
        severity: flips ? 'high' : 'medium',
        amount: pendingTotal,
        headline: 'Costs left out of profit',
        line: flips && m.pct != null
          ? `Counted, your ${formatPercent(m.pct)} margin becomes a ${randWhole(Math.abs(withPending))} loss.`
          : `${plural(pending.length, 'expense')} waiting for approval, not in your margin yet.`,
        action: { label: `Review ${plural(pending.length, 'expense')}`, href: '/finance/expenses' },
        method: `Expenses still Pending 7 or more days after they were entered. Reports count approved expenses only. Margin, ${periodText(period)}, excl. VAT, cash basis (as on the Margin tab and the P&L): revenue ${randWhole(m.revenue)} less approved costs ${randWhole(m.costs)} is ${randWhole(m.net)}; less the ${randWhole(m.pending)} pending in those months it is ${randWhole(withPending)}.${input.expenses.complete ? '' : ` Based on the first ${input.expenses.rows.length} of ${input.expenses.count} expenses.`}`,
        evidence: pending.map(e => ({
          id: `exp-${e.id}`, ref: e.expense_number || `#${e.id}`, label: (e.category || '').charAt(0) + (e.category || '').slice(1).toLowerCase(),
          note: `dated ${e.expense_date}`, amount: num(e.amount), href: '/finance/expenses',
        })),
        evidenceNoun: ['expense', 'expenses'],
        invoiceIds: [], loadIds: [], cash: false,
      });
    }
  }

  // 7. Quotes priced on old diesel ----------------------------------------
  if (input.quotes && input.fuel) {
    const zone = (input.company?.fuel_zone || 'INLAND').toUpperCase();
    const official = num(zone === 'COASTAL' ? input.fuel.coastal_price : input.fuel.inland_price);
    const loadByQuote = new Map((input.loads?.rows ?? []).filter(l => l.quote != null).map(l => [l.quote!, l]));
    const todayIso = saDateISO(today)!;
    const rows = official > 0 ? input.quotes.rows.map(q => {
      const st = (q.status || '').toUpperCase();
      const price = num(q.fuel_price_at_creation); const fuel = num(q.fuel_surcharge);
      if (price <= 0 || fuel <= 0) return null;
      const load = loadByQuote.get(q.id);
      const done = load && ['DELIVERED', 'INVOICED', 'CANCELLED', 'COMPLETED'].includes((load.status || '').toUpperCase());
      const live = (st === 'ACCEPTED' && !done) || (st === 'SENT' && !!q.valid_until && q.valid_until >= todayIso);
      const delta = official - price;
      if (!live || delta < 0.2) return null;
      const litres = fuel / price;
      return { q, price, litres, short: litres * delta };
    }).filter(Boolean) as { q: QuoteRec; price: number; litres: number; short: number }[] : [];
    const total = rows.reduce((s, r) => s + r.short, 0);
    if (rows.length && total >= THRESHOLD) {
      const lo = Math.min(...rows.map(r => r.price));
      // Company settings shows the live zone price while the saved diesel is
      // still the 23,50 factory default (CompanySettings loadLivePrice), so a
      // default is not "your setting": only a price the company chose is quoted.
      const saved = num(input.company?.fuel_price_per_litre);
      const setting = saved > 0 && Math.abs(saved - 23.5) >= 0.001 ? saved : 0;
      out.push({
        id: 'diesel', kind: 'diesel', category: 'Quote better', basis: 'Estimated', confidence: 'high',
        severity: 'medium',
        amount: total,
        headline: 'Quotes short on diesel',
        line: `Diesel is ${perLitre(official)}/L; ${rows.length === 1 ? `this quote used ${perLitre(lo)}` : `these quotes used from ${perLitre(lo)}`}.${setting > 0 && Math.abs(setting - official) > 0.5 ? ` Your setting: ${perLitre(setting)}.` : ''}`,
        action: { label: 'Update your diesel price', href: '/settings/company' },
        method: `Accepted quotes not yet delivered, and sent quotes still valid. Litres = the quote's fuel line divided by the diesel price it used. Shortfall = litres x (today's ${zone === 'COASTAL' ? 'coastal' : 'inland'} 50ppm price ${perLitre(official)}${input.fuel.source ? `, ${input.fuel.source}` : ''} less the quote's price). An estimate.`,
        evidence: rows.sort((a, b) => b.short - a.short).map(r => ({
          id: `q-${r.q.id}`, ref: r.q.quote_number, label: r.q.customer_name,
          note: `${Math.round(r.litres)} L at ${perLitre(r.price)}`, amount: r.short, href: `/bookings/quotes/${r.q.id}`,
        })),
        evidenceNoun: ['quote', 'quotes'],
        invoiceIds: [], loadIds: [], cash: false,
      });
    }
  }

  // 8. Loads left open (R6: the one stale-work rule, src/lib/staleWork.ts) --
  // The same loads Orders, Home and the fleet pages flag: open (Pending,
  // Assigned, Loading, In transit) and past the delivery date or open more
  // than 30 days. Together the two cards below count every such load, so they
  // match Home. R7: only loads that already have a vehicle (Assigned, Loading,
  // In transit) can still be delivered and invoiced, so only they are "cash
  // held up". A Pending load was never picked up: it can only be assigned or
  // cancelled, so it gets its own card with that action and no cash value.
  if (input.loads) {
    const stale = staleLoads(input.loads.rows, today);
    const isPending = (l: LoadRec) => (l.status || '').toUpperCase() === 'PENDING';
    const billable = stale.filter(l => !isPending(l));
    const pending = stale.filter(isPending);
    const evidenceOf = (rows: LoadRec[]) => rows.map(l => {
      const st = staleWork(l, today)!;
      return {
        id: `load-${l.id}`, ref: l.load_number, label: l.customer_name,
        note: st.overdue ? `due ${st.since}, ${st.days} days ago` : `open since ${st.since} (${st.days} days)`, amount: num(l.total_amount), href: `/bookings/${l.id}`,
      };
    });
    const total = billable.reduce((s, l) => s + num(l.total_amount), 0);
    if (billable.length && total >= THRESHOLD) {
      const by = new Map<string, number>();
      billable.forEach(l => { const k = (l.status || '').toUpperCase(); by.set(k, (by.get(k) || 0) + 1); });
      const words: Record<string, string> = { IN_TRANSIT: 'in transit', LOADING: 'loading', ASSIGNED: 'assigned' };
      const mix = ['IN_TRANSIT', 'LOADING', 'ASSIGNED'].filter(k => by.get(k)).map(k => `${by.get(k)} ${words[k]}`).join(', ');
      const oldest = staleLabel(staleWork(billable[0], today)!);
      const statuses = [...by.keys()];
      out.push({
        id: 'open_loads', kind: 'open_loads', category: 'Bill your work', basis: 'Measured', confidence: 'medium',
        severity: 'medium',
        amount: total,
        headline: billable.length === 1 ? 'Load left open' : 'Loads left open',
        line: `${plural(billable.length, 'load')} left open (${mix}); the oldest ${oldest.text}.`,
        // R8: none of these is delivered, so none can be invoiced yet. The
        // action is staleAction's move for the status (said of them all when
        // they share one), else "Update or cancel each load".
        action: { label: statuses.length === 1 ? staleAction(billable[0]).replace(/ it$/, billable.length === 1 ? ' it' : ' them') : 'Update or cancel each load', href: '/bookings/orders' },
        method: `Loads with a vehicle (Assigned, Loading or In transit) past their delivery date, or open more than ${STALE_AFTER_DAYS} days: the same rule as Orders, Home and the fleet pages. None is delivered, so none can be invoiced yet. In transit: mark it delivered (then invoice it) or cancel it. Loading: mark it in transit or cancel it. Assigned: start it, reassign it or cancel it. Value is the load total, excluding VAT. Pending loads were never picked up, so they are not counted here.` + (input.loads.complete ? '' : ' Not every load could be loaded.'),
        evidence: evidenceOf(billable),
        evidenceNoun: ['load', 'loads'],
        invoiceIds: [], loadIds: billable.map(l => l.id), cash: true,
      });
    }
    const pendingTotal = pending.reduce((s, l) => s + num(l.total_amount), 0);
    if (pending.length && pendingTotal >= THRESHOLD) {
      const oldest = staleLabel(staleWork(pending[0], today)!);
      // "Assign a vehicle or cancel it" (staleAction), said of every load in the card.
      const act = staleAction(pending[0]).replace(/ it$/, pending.length === 1 ? ' it' : ' them');
      out.push({
        id: 'pending_loads', kind: 'pending_loads', category: 'Clear old orders', basis: 'Measured', confidence: 'medium',
        severity: 'low',
        amount: pendingTotal,
        headline: pending.length === 1 ? 'Order never picked up' : 'Orders never picked up',
        line: `${plural(pending.length, 'pending load')} past ${pending.length === 1 ? 'its dates' : 'their dates'}; the oldest ${oldest.text}.`,
        action: { label: act, href: '/bookings/orders' },
        method: `Pending loads (no vehicle yet) past their delivery date, or open more than ${STALE_AFTER_DAYS} days: the same rule as Orders, Home and the fleet pages. They were never picked up, so there is nothing to invoice: assign a vehicle or cancel each one. Value is the order total, excluding VAT. Not money owed, so it is not counted in cash held up.` + (input.loads.complete ? '' : ' Not every load could be loaded.'),
        evidence: evidenceOf(pending),
        evidenceNoun: ['load', 'loads'],
        invoiceIds: [], loadIds: [], cash: false,
      });
    }
  }

  // 9. Sent quotes that lapsed without a reply (worth checking) -----------
  if (input.quotes) {
    const todayIso = saDateISO(today)!;
    const lapsed = input.quotes.rows
      .filter(q => (q.status || '').toUpperCase() === 'SENT' && q.valid_until && q.valid_until < todayIso && num(q.total_amount) > 0)
      .sort((a, b) => num(b.total_amount) - num(a.total_amount));
    const total = lapsed.reduce((s, q) => s + num(q.total_amount), 0);
    if (lapsed.length && total >= THRESHOLD) {
      out.push({
        id: 'expired_quotes', kind: 'expired_quotes', category: 'Quote better', basis: 'Measured', confidence: 'low',
        severity: 'low',
        amount: total,
        headline: 'Quotes lapsed, no reply',
        line: `${plural(lapsed.length, 'sent quote')} expired with no answer from the customer.`,
        action: { label: 'Follow up on quotes', href: '/bookings/quotes' },
        method: 'Quotes in Sent status whose valid-until date has passed, with no acceptance or rejection recorded. Value is the quoted total. Not money owed, so it is not counted in cash held up.',
        evidence: lapsed.map(q => ({
          id: `q-${q.id}`, ref: q.quote_number, label: q.customer_name,
          note: `expired ${q.valid_until}`, amount: num(q.total_amount), href: `/bookings/quotes/${q.id}`,
        })),
        evidenceNoun: ['quote', 'quotes'],
        invoiceIds: [], loadIds: [], cash: false,
      });
    }
  }

  // 10. Predicted cash shortfall (forecast, before the bank balance) ---------
  // Same rule the Insights runway used: the next 8 weeks from the weekly
  // forecast, added up from zero today. Fires only when that running position
  // falls at least R 5 000 below zero, so small timing gaps stay quiet.
  const weeks = (input.cashflow?.forecast ?? []).slice(0, SHORTFALL_WEEKS).map(w => ({
    start: w.start_date, in: num(w.expected_in), out: num(w.expected_out),
  }));
  if (weeks.length) {
    let pos = 0;
    const run = weeks.map(w => ({ ...w, pos: (pos += w.in - w.out) }));
    const firstIdx = run.findIndex(w => w.pos < 0);
    const lowest = run.reduce((m, w) => (w.pos < m.pos ? w : m), run[0]);
    if (firstIdx >= 0 && -lowest.pos >= SHORTFALL_MIN) {
      const first = run[firstIdx];
      const overdueOpen = invoices.filter(i => isOpen(i) && lateDays(i) > 0);
      const weeksAway = Math.max(0, Math.round(daysBetween(today, first.start) / 7));
      out.push({
        id: 'cash_shortfall', kind: 'cash_shortfall', category: 'Cash ahead', basis: 'Estimated', confidence: 'medium',
        severity: weeksAway <= 4 ? 'high' : 'medium',
        amount: -lowest.pos,
        headline: `Short of cash from ${shortDay(first.start)}`,
        line: `Week of ${shortDay(first.start)}: expected costs pass receipts. Excludes your bank balance.`,
        action: overdueOpen.length
          ? { label: 'Chase overdue invoices', href: '/finance/invoices?status=OVERDUE' }
          : { label: 'See cash movement', href: '/finance/reports?report=cash' },
        method: `Forecast for the next ${weeks.length} weeks. Each unpaid invoice is placed on the date that customer usually pays; expected costs come from approved expenses over the last 90 days. Weeks are added up from zero today, so your bank balance is not included: check it covers the gap. Shows only when the running position falls R 5 000 or more below zero. Value is the lowest point. An estimate.`,
        evidence: run.map(w => ({
          id: `wk-${w.start}`, ref: `Week of ${shortDay(w.start)}`, label: `In ${randWhole(w.in)}, out ${randWhole(w.out)}`,
          note: w.pos < 0 ? 'short' : 'covered', amount: w.pos, href: '/finance/reports?report=cash',
        })),
        evidenceNoun: ['week', 'weeks'],
        invoiceIds: [], loadIds: [], cash: false,
      });
    }
  }

  // Rank by rand value. Low-confidence findings sit in "Worth checking".
  return out.sort((a, b) => b.amount - a.amount);
}

/** Summary across findings. Each invoice and load is counted once, even when
 *  it appears in two cards (e.g. never chased and no proof of delivery). */
export function summarise(findings: Finding[], input: FindingInputs) {
  const invById = new Map(input.invoices.rows.map(i => [i.id, i]));
  const loadById = new Map((input.loads?.rows ?? []).map(l => [l.id, l]));
  const invIds = new Set<number>(); const loadIds = new Set<number>();
  findings.filter(f => f.cash).forEach(f => { f.invoiceIds.forEach(id => invIds.add(id)); f.loadIds.forEach(id => loadIds.add(id)); });
  let cash = 0;
  const customers = new Set<string>();
  invIds.forEach(id => {
    const i = invById.get(id); if (!i) return;
    cash += (i.status || '').toUpperCase() === 'DRAFT' ? num(i.total_amount) : num(i.balance);
    customers.add(String(i.customer ?? i.customer_name));
  });
  loadIds.forEach(id => { const l = loadById.get(id); if (l) { cash += num(l.total_amount); customers.add(String(l.customer ?? l.customer_name)); } });
  const open = input.invoices.rows.filter(isOpen);
  const oldestLate = open.length ? Math.max(0, ...open.map(i => (i.due_date ? daysBetween(i.due_date, new Date()) : 0))) : 0;
  const overdue = open.filter(i => i.due_date && daysBetween(i.due_date, new Date()) > 0);
  const reminded = overdue.filter(i => !neverReminded(i)).length;
  return { cash, invoiceCount: invIds.size, loadCount: loadIds.size, customerCount: customers.size, oldestLate, overdueCount: overdue.length, reminded };
}
