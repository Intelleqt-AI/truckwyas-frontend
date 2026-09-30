/**
 * One frontend definition of "overdue" for invoices, used by the Invoices
 * filter, the Overdue tile (when the full list is loaded), row menus and the
 * invoice detail page, so they can never disagree with each other.
 *
 * Overdue = the invoice has gone to the customer (not a draft, not cancelled,
 * not paid), still has an unpaid balance, and its due date has passed. The
 * status string (SENT, VIEWED, OVERDUE, PARTIALLY_PAID) does not matter: the
 * backend only flips SENT to OVERDUE on a schedule, and part-paid invoices keep
 * their own status however late they are.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvoiceLike = Record<string, any>;

const NOT_SENT = new Set(['DRAFT', 'CANCELLED', 'VOID']);

/** Statuses the backend's send_reminder endpoint accepts (core/views_finance.py). */
export const REMINDER_STATUSES = new Set(['SENT', 'VIEWED', 'OVERDUE', 'PARTIALLY_PAID']);

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Unpaid balance incl. VAT: the API's `balance`, else total minus paid. */
export function invoiceBalance(inv: InvoiceLike): number {
  const status = String(inv.status ?? '').toUpperCase();
  if (status === 'PAID') return 0;
  const balance = toNumber(inv.balance);
  if (balance !== null) return balance;
  const total = toNumber(inv.total_amount ?? inv.amount) ?? 0;
  const paid = toNumber(inv.paid_amount) ?? 0;
  return total - paid;
}

/** Start of today, local time. A due date of today is not yet late. */
function startOfToday(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function parseDue(d: unknown): number | null {
  if (!d) return null;
  const s = String(d);
  // "YYYY-MM-DD" parses as UTC midnight; read it as a local calendar date.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const t = m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export function isInvoiceOverdue(inv: InvoiceLike, now: Date = new Date()): boolean {
  const status = String(inv.status ?? '').toUpperCase();
  if (!status || NOT_SENT.has(status) || status === 'PAID') return false;
  if (!(invoiceBalance(inv) > 0)) return false;
  const due = parseDue(inv.due_date ?? inv.dueDate);
  return due !== null && due < startOfToday(now);
}

/** A reminder can be sent: overdue by the definition above and a status the backend accepts. */
export function canSendReminder(inv: InvoiceLike, now: Date = new Date()): boolean {
  return isInvoiceOverdue(inv, now) && REMINDER_STATUSES.has(String(inv.status ?? '').toUpperCase());
}
