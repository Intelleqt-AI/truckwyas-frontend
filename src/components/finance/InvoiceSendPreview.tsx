import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import { formatDate, formatDays, formatMoney } from '@/lib/formatters';
import { invoiceBalance } from '@/lib/invoiceStatus';
import SendPreviewDialog, { type SendPreviewRow } from '@/components/SendPreviewDialog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoice = Record<string, any>;

export type InvoiceMessageKind = 'invoice' | 'reminder';

const toNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/** Python's f"R {amount:,.2f}", exactly as the server writes amounts into
 *  email subjects. The preview shows what the customer will receive, so it
 *  stays literal until the backend subject uses the house format. */
const serverRand = (n: number) =>
  `R ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function daysLate(due: unknown): number {
  if (!due) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(due));
  if (!m) return 0;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
}

/**
 * Mirrors core/services/collections.py `_tone_for` and the subject line in
 * resend_email.send_payment_reminder_email, so the preview shows the tone and
 * subject the customer will actually receive.
 */
function reminderTone(days: number, count: number) {
  if (days > 30 || count >= 3) return { heading: 'Final notice: payment overdue', tone: 'Final notice' };
  if (days > 0 || count >= 1) return { heading: 'Payment overdue', tone: 'Firm' };
  return { heading: 'Payment reminder', tone: 'Friendly' };
}

/**
 * Preview-and-confirm before an invoice or a payment reminder is emailed.
 * The recipient is the invoice's customer's email on file (the same address
 * the server sends to); `onConfirm` runs the page's existing send call.
 */
export default function InvoiceSendPreview({ kind, invoice, sending, onConfirm, onCancel }: {
  kind: InvoiceMessageKind;
  invoice: Invoice;
  sending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const customerId = invoice.customer != null && typeof invoice.customer === 'object' ? invoice.customer.id : invoice.customer;
  const customerQ = useQuery({
    queryKey: ['customer', String(customerId)],
    queryFn: () => fetchData(`api/v1/customers/${customerId}/`),
    enabled: customerId != null && customerId !== '',
    retry: 1,
  });
  const email: string | null | undefined = customerQ.data
    ? (customerQ.data.email ? String(customerQ.data.email) : null)
    : customerId == null ? null : undefined;

  const number = invoice.invoice_number || invoice.invoiceNumber || `#${invoice.id}`;
  const customerName = invoice.customer_name || invoice.customerName || customerQ.data?.name;
  const company = (user?.company_name as string | undefined) || '';
  const total = toNum(invoice.total_amount ?? invoice.amount);
  const balance = invoiceBalance(invoice);
  const due = invoice.due_date || invoice.dueDate;
  const dueLabel = due ? formatDate(due) : 'On receipt';

  let subject: string | undefined;
  let rows: SendPreviewRow[];
  let note: string;
  if (kind === 'reminder') {
    const days = daysLate(due);
    const count = toNum(invoice.reminder_count);
    const { heading, tone } = reminderTone(days, count);
    const subjectAmount = toNum(invoice.balance) ? toNum(invoice.balance) : total;
    subject = `${heading}: invoice ${number} — ${serverRand(subjectAmount)}`;
    rows = [
      { label: 'Invoice', value: number },
      { label: 'Outstanding', value: formatMoney(balance) },
      { label: 'Due', value: days > 0 ? `${dueLabel} · ${formatDays(days)} late` : dueLabel },
      { label: 'Tone', value: tone },
      {
        label: 'Reminders',
        value: count > 0
          ? `${count} sent${invoice.last_reminder_at ? `, last on ${formatDate(invoice.last_reminder_at)}` : ''}`
          : 'This is the first',
      },
    ];
    note = 'The email links to the invoice so they can view and pay it.';
  } else {
    subject = company ? `Invoice ${number} from ${company}` : undefined;
    rows = [
      { label: 'Invoice', value: number },
      { label: 'Amount', value: `${formatMoney(total)} incl. VAT` },
      { label: 'Due', value: dueLabel },
    ];
    note = 'The invoice PDF is attached and the email links to the online copy.';
  }

  return (
    <SendPreviewDialog
      title={kind === 'reminder' ? 'Send payment reminder' : 'Send invoice'}
      to={customerQ.isError ? undefined : email}
      toError={customerQ.isError}
      toName={customerName}
      subject={subject}
      rows={rows}
      note={note}
      noEmailHint="Add an email address on the customer's page, then send."
      confirmLabel={kind === 'reminder' ? 'Send reminder' : 'Send invoice'}
      sending={sending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
