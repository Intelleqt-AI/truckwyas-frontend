import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import SendPreviewDialog, { type SendPreviewRow } from '@/components/SendPreviewDialog';
import { quoteLapsed } from '@/components/overview/today';

export interface QuotePreviewData {
  quote_number?: string | null;
  customer_name?: string | null;
  /** `undefined` while unknown, `null`/'' when the customer has no email on file. */
  customer_email?: string | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
  origin?: string | null;
  destination?: string | null;
  /** The price the customer will see (excl. VAT). */
  total_amount?: number | string | null;
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
 * server's quote email (core/services/email_service.send_quote_share_email):
 * same recipient, subject and summary rows. `onConfirm` runs the caller's
 * existing send call unchanged.
 */
export default function QuoteSendPreview({ quote, sending, confirmLabel = 'Send quote', onConfirm, onCancel }: {
  quote: QuotePreviewData;
  sending?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const company = (user?.company_name as string | undefined) || 'TruckWys';
  const email = quote.customer_email === undefined ? undefined : (quote.customer_email ? String(quote.customer_email) : null);
  const amount = quote.total_amount == null || quote.total_amount === '' ? null : Number(quote.total_amount);
  const from = quote.pickup_location || quote.origin;
  const to = quote.delivery_location || quote.destination;

  // Past its valid-until date (the board's one expiry rule): sending is still
  // allowed, but the customer's link would open on an expired offer, so the
  // preview says so right above the Send button (R11).
  const expired = quoteLapsed(quote);

  const rows: SendPreviewRow[] = [
    ...(quote.quote_number ? [{ label: 'Quote', value: quote.quote_number }] : []),
    ...(from || to ? [{ label: 'Route', value: `${from || '—'} to ${to || '—'}` }] : []),
    ...(quote.pickup_date ? [{ label: 'Collection', value: safeDate(quote.pickup_date) }] : []),
    { label: 'Price', value: amount == null || Number.isNaN(amount) ? '—' : `${formatCurrency(amount)} excl. VAT` },
    ...(quote.valid_until ? [{ label: 'Valid until', value: expired
      ? <>{safeDate(quote.valid_until)} <span className="send-preview__warn">· expired</span></>
      : safeDate(quote.valid_until) }] : []),
  ];

  return (
    <SendPreviewDialog
      title="Send quote to customer"
      to={email}
      toName={quote.customer_name || undefined}
      subject={quote.quote_number ? `Your freight quote ${quote.quote_number} from ${company}` : undefined}
      rows={rows}
      note={expired ? <>
        <span className="send-preview__warn" role="alert" style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
          This quote expired on {safeDate(quote.valid_until)}. Edit it to set a new valid-until date before sending.
        </span>
        The email links to the quote so they can accept or decline it online.
      </> : 'The email links to the quote so they can accept or decline it online.'}
      noEmailHint="No email will go out. The quote is marked as sent and you can share its link yourself."
      noEmailConfirmLabel="Mark as sent"
      confirmLabel={confirmLabel}
      sending={sending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
