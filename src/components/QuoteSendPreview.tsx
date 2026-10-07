import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import SendPreviewDialog, { type SendPreviewRow } from '@/components/SendPreviewDialog';
import { quoteLapsed } from '@/components/overview/today';
import type { QuoteWarning } from '@/lib/dieselPrice';

export interface QuotePreviewData {
  /** Saved quotes: lets an expired quote's preview lead to its edit form. */
  id?: number | string | null;
  quote_number?: string | null;
  customer_name?: string | null;
  /** `undefined` while unknown, `null`/'' when the customer has no email on file. */
  customer_email?: string | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
  origin?: string | null;
  destination?: string | null;
  /** The price excl. VAT. */
  total_amount?: number | string | null;
  /** VAT and total incl. VAT the customer is sent (backend quote_vat, or the
   *  builder's own figure for an unsaved quote). */
  customer_price?: { vat_registered: boolean; vat_label?: string; vat_amount: string | number; total_incl_vat: string | number } | null;
  valid_until?: string | null;
  pickup_date?: string | null;
}

const safeDate = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : formatDate(t);
};

/**
 * Preview-and-confirm before a quote is emailed to the customer. Mirrors the
 * server's quote email (core/services/email_service.send_quote_share_email).
 * §11: any `block` warning stops the send (one line, Edit quote leads);
 * a `warn` is one line above the buttons.
 */
export default function QuoteSendPreview({ quote, sending, confirmLabel = 'Send quote', warnings = [], onConfirm, onCancel }: {
  quote: QuotePreviewData;
  sending?: boolean;
  confirmLabel?: string;
  warnings?: QuoteWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const company = (user?.company_name as string | undefined) || 'TruckWys';
  const email = quote.customer_email === undefined ? undefined : (quote.customer_email ? String(quote.customer_email) : null);
  const amount = quote.total_amount == null || quote.total_amount === '' ? null : Number(quote.total_amount);
  const vat = quote.customer_price || null;
  const from = quote.pickup_location || quote.origin;
  const to = quote.delivery_location || quote.destination;

  const expired = quoteLapsed(quote);
  const block = warnings.find((w) => w.severity === 'block') ?? null;
  const warn = warnings.find((w) => w.severity !== 'block') ?? null;
  // Expired or blocked: "Edit quote" leads. A saved quote opens its edit
  // form; the builder (no id yet) just closes the preview back onto it.
  const editAction = expired || block
    ? { label: 'Edit quote', onClick: () => { if (quote.id != null && quote.id !== '') { onCancel(); navigate(`/bookings/quotes/${quote.id}/edit`); } else onCancel(); } }
    : undefined;

  const rows: SendPreviewRow[] = [
    ...(quote.quote_number ? [{ label: 'Quote', value: quote.quote_number }] : []),
    ...(from || to ? [{ label: 'Route', value: `${from || '—'} to ${to || '—'}` }] : []),
    ...(quote.pickup_date ? [{ label: 'Collection', value: safeDate(quote.pickup_date) }] : []),
    ...(amount == null || Number.isNaN(amount)
      ? [{ label: 'Price', value: '—' }]
      : !vat
        ? [{ label: 'Price', value: `${formatCurrency(amount)} excl. VAT` }]
        : vat.vat_registered
          ? [
              { label: 'Excl. VAT', value: formatCurrency(amount) },
              { label: vat.vat_label || 'VAT', value: formatCurrency(Number(vat.vat_amount)) },
              { label: 'Total', value: <strong>{formatCurrency(Number(vat.total_incl_vat))}</strong> },
            ]
          : [{ label: 'Total', value: `${formatCurrency(Number(vat.total_incl_vat))} (no VAT)` }]),
    ...(quote.valid_until ? [{ label: 'Valid until', value: expired
      ? <>{safeDate(quote.valid_until)} <span className="send-preview__warn">· expired</span></>
      : safeDate(quote.valid_until) }] : []),
  ];

  const line = block ?? (expired ? { title: `Expired ${safeDate(quote.valid_until)}` } : warn);
  return (
    <SendPreviewDialog
      title="Send quote"
      to={email}
      toName={quote.customer_name || undefined}
      subject={quote.quote_number ? `Your freight quote ${quote.quote_number} from ${company}` : undefined}
      rows={rows}
      note={line
        ? <span className={block || expired ? 'send-preview__warn' : undefined} role={block ? 'alert' : 'status'} style={{ fontWeight: 500 }}>{line.title}</span>
        : 'They can accept or decline online.'}
      noEmailHint="No email on file. It is marked sent; share the link yourself."
      noEmailConfirmLabel={expired ? 'Mark sent anyway' : 'Mark as sent'}
      confirmLabel={expired ? 'Send anyway' : confirmLabel}
      confirmBlocked={!!block}
      preferredAction={editAction}
      sending={sending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
