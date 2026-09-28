import './public-document.css';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader } from '@/components/Loader';

const BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/').replace(/\/$/, '');

function fmt(n: string | number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', minimumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Status presentation only; the API enum is unchanged.
const STATUS: Record<string, { label: string; tone: '' | 'success' | 'warning' | 'danger' }> = {
  PAID: { label: 'Paid', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  PARTIALLY_PAID: { label: 'Partly paid', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: '' },
};
const statusOf = (s?: string) =>
  STATUS[s || ''] || { label: s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Issued', tone: '' as const };

export default function PublicInvoice() {
  const { id, token } = useParams<{ id: string; token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', id, token],
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      const res = await fetch(`${BASE_URL}/api/v1/invoices/public/${id}/${token}/`);
      if (!res.ok) throw new Error('Invalid invoice link');
      return res.json();
    },
    retry: false,
    enabled: !!id,
  });

  const status = data ? statusOf(data.status) : null;
  const hasPayments = data && Number(data.paid_amount) > 0;
  const isOpen = data && data.status !== 'PAID' && data.status !== 'CANCELLED';

  return (
    <div className="pd">
      <main className="pd-page">
        {/* Sender identity on the page ground; the document itself below. */}
        <header className="pd-brand">
          <div style={{ minWidth: 0 }}>
            {data?.company_logo_url
              ? <><img className="pd-brand__logo" src={data.company_logo_url} alt={data.company_name || 'Company logo'} /><h1 className="sr-only">{data.company_name}</h1></>
              : <h1 className="pd-brand__name">{data?.company_name || 'Invoice'}</h1>}
          </div>
          {data && (
            <div className="pd-brand__doc">
              <div className="pd-brand__kind">Invoice</div>
              <div className="pd-brand__number">{data.invoice_number}</div>
            </div>
          )}
        </header>

        {isLoading && (
          <div className="pd-doc"><div className="pd-center"><Loader size={36} label="Loading invoice" /></div></div>
        )}

        {isError && (
          <div className="pd-state">
            <div className="pd-doc">
              <h1 className="pd-state__title">This invoice link is not valid</h1>
              <p className="pd-state__text">It may have expired or been replaced. Please ask the sender for a new link.</p>
            </div>
          </div>
        )}

        {data && status && (
          <article className="pd-doc" aria-label={`Invoice ${data.invoice_number}`}>
            {/* The figure the reader came for, with its due date. */}
            <section className="pd-section pd-hero">
              <div>
                <div className="pd-label">{data.status === 'PAID' ? 'Amount paid' : data.status === 'CANCELLED' ? 'Invoice total' : hasPayments ? 'Balance due' : 'Amount due'}</div>
                <div className="pd-hero__amount">{fmt(data.status === 'PAID' || data.status === 'CANCELLED' || !hasPayments ? data.total_amount : data.balance)}</div>
                <div className="pd-hero__line">
                  {data.status === 'PAID'
                    ? 'Paid in full. Thank you.'
                    : data.status === 'CANCELLED'
                    ? 'This invoice was cancelled. Nothing is due.'
                    : data.due_date ? `Due ${fmtDate(data.due_date)}` : 'Payment terms as agreed'}
                </div>
              </div>
              <span className={`pd-chip${status.tone ? ` pd-chip--${status.tone}` : ''}`}>{status.label}</span>
            </section>

            <section className="pd-section">
              <div className="pd-grid">
                <div className="pd-field">
                  <div className="pd-label">From</div>
                  <div className="pd-value pd-value--strong">{data.company_name}</div>
                  {data.company_address && <div className="pd-sub">{data.company_address}</div>}
                  {data.company_phone && <div className="pd-sub">{data.company_phone}</div>}
                  {data.company_email && <div className="pd-sub">{data.company_email}</div>}
                </div>
                <div className="pd-field">
                  <div className="pd-label">Billed to</div>
                  <div className="pd-value pd-value--strong">{data.customer_name}</div>
                </div>
                <div className="pd-field">
                  <div className="pd-label">Issue date</div>
                  <div className="pd-value">{data.issue_date ? fmtDate(data.issue_date) : '—'}</div>
                </div>
                <div className="pd-field">
                  <div className="pd-label">Due date</div>
                  <div className="pd-value">{data.due_date ? fmtDate(data.due_date) : '—'}</div>
                </div>
              </div>
            </section>

            {data.line_items && data.line_items.length > 0 ? (
              <section className="pd-section" aria-label="Line items">
                <div className="pd-table-wrap">
                  <table className="pd-table">
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col" className="is-num">Qty</th>
                        <th scope="col" className="is-num pd-hide-sm">Unit price</th>
                        <th scope="col" className="is-num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.line_items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td>{item.description}</td>
                          <td className="is-num">{item.quantity ?? 1}</td>
                          <td className="is-num pd-hide-sm">{fmt(item.unit_price ?? item.amount)}</td>
                          <td className="is-num">{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : data.description ? (
              <section className="pd-section">
                <div className="pd-label" style={{ marginBottom: 4 }}>Description</div>
                <p className="pd-prose">{data.description}</p>
              </section>
            ) : null}

            <section className="pd-section" aria-label="Totals">
              <div className="pd-totals">
                <div className="pd-total-row"><span>Subtotal</span><span>{fmt(data.subtotal)}</span></div>
                <div className="pd-total-row"><span>VAT (15%)</span><span>{fmt(data.vat_amount)}</span></div>
                {Number(data.discount) > 0 && (
                  <div className="pd-total-row"><span>Discount</span><span>−{fmt(data.discount)}</span></div>
                )}
                <div className="pd-total-row pd-total-row--grand"><span>Total</span><span>{fmt(data.total_amount)}</span></div>
                {hasPayments && (
                  <>
                    <div className="pd-total-row"><span>Paid</span><span>−{fmt(data.paid_amount)}</span></div>
                    <div className="pd-total-row pd-total-row--grand"><span>Balance due</span><span>{fmt(data.balance)}</span></div>
                  </>
                )}
              </div>
            </section>

            {data.notes && (
              <section className="pd-section">
                <h2 className="pd-h2">Notes</h2>
                <p className="pd-prose">{data.notes}</p>
              </section>
            )}

            {isOpen && (
              <section className="pd-section">
                <h2 className="pd-h2">How to pay</h2>
                <p className="pd-prose">Pay by EFT and use <strong>{data.invoice_number}</strong> as your payment reference.</p>
                <p className="pd-prose" style={{ color: 'var(--pd-muted)' }}>For banking details, contact {data.company_name}{data.company_email ? ` at ${data.company_email}` : ''}{data.company_phone ? ` or ${data.company_phone}` : ''}.</p>
              </section>
            )}
          </article>
        )}

        <footer className="pd-footer">Sent with TruckWys</footer>
      </main>
    </div>
  );
}
