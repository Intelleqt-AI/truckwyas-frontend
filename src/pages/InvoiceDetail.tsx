import { useState } from "react";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/Api";

import { formatCurrency, formatDate } from "@/lib/formatters";
import "./finance-brand.css";
import "./table-heading-roles.css";
import { Loader } from "@/components/Loader";
import RowActions from "@/components/ui/RowActions";
import { InfoTip } from "@/components/ui/InfoTip";
import { FinTile, FinTiles, wholeRand } from "@/components/finance/FinTile";

// External Fast Pay application link. The applied-state key is unchanged so
// invoices already marked "Applied" stay marked.
const FAST_PAY_STORAGE_KEY = "mc_applied_invoice_ids";

function loadAppliedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAST_PAY_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAppliedId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current).add(id);
  localStorage.setItem(FAST_PAY_STORAGE_KEY, JSON.stringify([...next]));
  return next;
}
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const STATUS_TONE: Record<string, string> = {
  PAID: 'success',
  SENT: 'warning',
  VIEWED: 'info',
  OVERDUE: 'danger',
  PARTIALLY_PAID: 'warning',
  DRAFT: 'neutral',
};

// "BANK_TRANSFER" → "Bank transfer"; short acronyms (EFT) stay as-is.
const methodLabel = (m: string) => (m.length <= 4 ? m : formatStatus(m));

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

const safeDate = (d?: string | null) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};

// Sentence-case a status/token for display: "PARTIALLY_PAID" → "Partially paid".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(loadAppliedIds);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFT');
  const [paymentReference, setPaymentReference] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const { data: invoice, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchData(`api/v1/invoices/${id}/`),
    enabled: !!id,
    retry: 2,
  });

  // Capital eligibility — shared cache with invoices list
  const { data: capitalData } = useQuery({
    queryKey: ['capital-eligible'],
    queryFn: () => fetchData('api/v1/capital/eligible/').catch(() => null),
  });
  const eligibleInvoices: any[] = capitalData?.invoices || [];
  const capitalEntry = eligibleInvoices.find((e: any) => String(e.id) === String(id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ineligibleInvoices: any[] = capitalData?.ineligible_invoices || [];
  const ineligibleEntry = !capitalEntry
    ? ineligibleInvoices.find((e: any) => String(e.id) === String(id))
    : null;

  // Payments aren't embedded on the invoice serializer — fetch them.
  const { data: paymentsResp } = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn: () => fetchData(`api/v1/payments/?invoice=${id}`),
    enabled: !!id,
  });
  const allPayments = Array.isArray(paymentsResp) ? paymentsResp : (paymentsResp?.results ?? []);
  // Only show payments that belong to this invoice (guards against the list
  // endpoint returning payments for other invoices).
  const payments = allPayments.filter((p: any) => p?.invoice == null || String(p.invoice) === String(id));

  const handleSendInvoice = async () => {
    if (!id) return;
    setSending(true);
    try {
      await postData({ url: `api/v1/invoices/${id}/send_invoice/` });
      setToast({ msg: 'Invoice sent' });
      setTimeout(() => setToast(null), 3000);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['capital-eligible'] });
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast({ msg: error instanceof Error ? error.message : 'Failed to send invoice', isError: true });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      let pdfUrl: string | null = null;

      if (invoice?.pdf_file) {
        const file: string = invoice.pdf_file;
        if (file.startsWith('http://') || file.startsWith('https://')) {
          pdfUrl = file;
        } else {
          const base = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
          pdfUrl = `${base}/media/${file}`;
        }
      } else {
        const result: any = await postData({ url: `api/v1/invoices/${id}/generate_pdf/`, data: {} });
        pdfUrl = result?.pdf_url ?? null;
        if (pdfUrl) refetch();
      }

      if (pdfUrl) {
        // Fetch as blob so the `download` attribute works cross-origin
        // (browsers ignore `download` on cross-origin hrefs).
        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `Invoice_${invoice?.invoice_number || id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        setToast({ msg: 'PDF downloaded' });
      } else {
        setToast({ msg: 'Failed to get PDF URL', isError: true });
      }
    } catch {
      setToast({ msg: 'Failed to generate PDF', isError: true });
    } finally {
      setTimeout(() => {
        setToast(null);
        setDownloading(false);
      }, 3000);
    }
  };

  const handleSendReminder = async () => {
    if (!id) return;
    setSendingReminder(true);
    try {
      await postData({ url: `api/v1/invoices/${id}/send_reminder/`, data: {} });
      setToast({ msg: 'Reminder sent' });
      setTimeout(() => setToast(null), 3000);
      refetch();
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setToast({ msg: 'Reminder recorded. The customer will be contacted.' });
      } else {
        setToast({ msg: error instanceof Error ? error.message : 'Failed to send reminder', isError: true });
      }
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingReminder(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!id || !paymentAmount || !paymentDate) {
      setToast({ msg: 'Enter the amount and payment date', isError: true });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setRecordingPayment(true);
    try {
      await postData({
        url: 'api/v1/payments/',
        data: {
          invoice: id,
          amount: parseFloat(paymentAmount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference: paymentReference
        }
      });
      setToast({ msg: 'Payment recorded' });
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDate('');
      setPaymentReference('');
      setTimeout(() => setToast(null), 3000);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', id] });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to record payment';
      setToast({ msg, isError: true });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setRecordingPayment(false);
    }
  };

  if (isLoading) return <Loader fullScreen />;
  if (isError || !invoice) {
    return (
      <div className="fin-page">
        <div className="card fin-empty">
          <h1 className="fin-empty__title" style={{ fontSize: 22, lineHeight: '28px' }}>Invoice not found</h1>
          <p className="fin-empty__body">It may have been removed, or the link is wrong.</p>
          <button className="btn-action" onClick={() => navigate('/finance/invoices')}>Back to invoices</button>
        </div>
      </div>
    );
  }

  const status: string = invoice.status || '';
  const tone = STATUS_TONE[status] ?? 'neutral';
  const total = parseFloat(invoice.total_amount || invoice.amount || '0');
  const hasBalance = invoice.balance !== undefined && invoice.balance !== null;
  const balance = num(invoice.balance);
  const showBalance = hasBalance && status !== 'PAID' && status !== 'DRAFT';
  const applied = appliedIds.has(String(id));
  const canSend = status === 'DRAFT' || status === 'SENT' || status === 'VIEWED';
  const canRemind = status === 'SENT' || status === 'VIEWED' || status === 'OVERDUE';
  const canRecordPayment = status === 'SENT' || status === 'VIEWED' || status === 'OVERDUE' || status === 'PARTIALLY_PAID';
  const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + num(p.amount), 0);
  const paidToDate = invoice.paid_amount != null ? num(invoice.paid_amount) : null;
  const vat = (invoice.vat_amount ?? invoice.tax_amount) != null ? num(invoice.vat_amount ?? invoice.tax_amount) : null;
  const taxRate = invoice.tax_rate != null ? num(invoice.tax_rate) : null;
  const daysLate = invoice.due_date && showBalance
    ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
    : null;
  const paidShare = showBalance && total > 0 ? Math.min(100, Math.max(0, ((total - balance) / total) * 100)) : 0;
  const terms = invoice.payment_terms ? String(invoice.payment_terms).replace(/^NET(\d+)$/i, '$1 days') : null;

  const heroLabel = status === 'PAID' ? 'Paid in full' : showBalance ? 'Balance due' : 'Invoice total';

  const activity = [
    { label: 'Created', value: safeDate(invoice.created_at) },
    { label: 'Sent to customer', value: invoice.sent_at ? safeDate(invoice.sent_at) : 'Not sent' },
    ...(invoice.viewed_at ? [{ label: 'Viewed by customer', value: safeDate(invoice.viewed_at) }] : []),
    {
      label: 'Reminders',
      value: invoice.reminder_count
        ? `${invoice.reminder_count} sent, last on ${safeDate(invoice.last_reminder_at)}`
        : 'None sent',
    },
    ...(invoice.paid_at ? [{ label: 'Paid', value: safeDate(invoice.paid_at) }] : []),
  ];

  const primary = canSend ? 'send' : canRecordPayment ? 'pay' : null;
  const moreActions = [
    ...(primary !== 'pay' && canRecordPayment
      ? [{ label: 'Record payment', onSelect: () => setShowPaymentForm(true), disabled: showPaymentForm }]
      : []),
    ...(canRemind
      ? [{ label: sendingReminder ? 'Sending…' : 'Send reminder', onSelect: handleSendReminder, disabled: sendingReminder }]
      : []),
    ...(primary !== null
      ? [{ label: downloading ? 'Downloading…' : 'Download PDF', onSelect: handleDownloadPDF, disabled: downloading }]
      : []),
  ];

  return (
    <div className="fin-page">
      {toast && (
        <div className={`fin-toast${toast.isError ? ' fin-toast--error' : ''}`} role={toast.isError ? 'alert' : 'status'}>
          {toast.msg}
        </div>
      )}

      <button type="button" onClick={() => navigate('/finance/invoices')} className="fin-back">
        <span aria-hidden="true">←</span> Back to invoices
      </button>

      <header className="fin-detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="fin-detail-head__eyebrow">Invoice</div>
          <div className="fin-detail-head__title-row">
            <h1>{invoice.invoice_number}</h1>
            <span className={`fin-chip${tone === 'neutral' ? '' : ` fin-chip--${tone}`}`}>{formatStatus(status)}</span>
          </div>
          <p className="fin-detail-head__sub">
            {invoice.customer_name}
            {invoice.load_number && (
              <>
                {' · Load '}
                <span className="fin-id">{invoice.load_number}</span>
              </>
            )}
          </p>
        </div>
        <div className="fin-detail-head__actions">
          {/* One primary action; everything else sits behind one menu. */}
          {primary === 'send' ? (
            <button className="btn-action" onClick={handleSendInvoice} disabled={sending}>
              {sending ? 'Sending…' : status === 'VIEWED' ? 'Resend to customer' : 'Send to customer'}
            </button>
          ) : primary === 'pay' ? (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="btn-action"
              disabled={showPaymentForm}
              aria-expanded={showPaymentForm}
              aria-controls="record-payment">
              Record payment
            </button>
          ) : (
            <button className="btn-action fin-btn-secondary" onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
          )}
          {moreActions.length > 0 && <RowActions label={`Invoice ${invoice.invoice_number}`} items={moreActions} />}
        </div>
      </header>

      <FinTiles label="Invoice figures">
        <FinTile
          label={heroLabel}
          info={showBalance ? 'Invoice total incl. VAT, less payments recorded.' : 'Invoice total incl. VAT.'}
          value={wholeRand(showBalance ? balance : total)}
          valueTitle={formatCurrency(showBalance ? balance : total)}
          sub={showBalance && balance !== total
            ? `Of ${formatCurrency(total)} incl. VAT`
            : vat != null
              ? `Incl. ${formatCurrency(vat)} VAT`
              : 'Invoice total'}
        />
        <FinTile
          label="Issued"
          value={safeDate(invoice.issue_date || invoice.created_at)}
          small
          sub={terms ? `${terms} terms` : undefined}
        />
        <FinTile
          label="Due"
          value={safeDate(invoice.due_date)}
          small
          sub={daysLate != null && daysLate > 0 ? `${daysLate} ${daysLate === 1 ? 'day' : 'days'} late` : undefined}
          subTone={daysLate != null && daysLate > 0 ? 'danger' : undefined}
        />
        {paidToDate != null && status !== 'DRAFT' && (
          <FinTile
            label="Paid to date"
            value={wholeRand(paidToDate)}
            valueTitle={formatCurrency(paidToDate)}
            sub={showBalance && paidShare > 0 ? `${Math.round(paidShare)}% of the total` : undefined}
          />
        )}
      </FinTiles>

      <div className="fin-grid-2" style={{ alignItems: 'start' }}>
        {/* Main column */}
        <div className="fin-stack" style={{ minWidth: 0 }}>
          {/* How the total is made up */}
          {invoice.line_items && invoice.line_items.length > 0 ? (
            <section className="card fin-table-card" aria-labelledby="line-items-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="line-items-title" className="fin-panel-title">Charges</h2>
                  <p className="fin-panel-desc">
                    {invoice.line_items.length} {invoice.line_items.length === 1 ? 'line' : 'lines'}, excl. VAT
                  </p>
                </div>
              </div>
              <div className="fin-table-scroll">
                <table className="fin-table table-heading-roles">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="num">Quantity</th>
                      <th className="num">Unit price</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.line_items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="fin-strong"><div className="fin-truncate" style={{ maxWidth: 360 }} title={item.description || item.item_description || ''}>{item.description || item.item_description || '—'}</div></td>
                        <td className="num">{item.quantity || 1}</td>
                        <td className="num">{formatCurrency(item.unit_price || item.price || 0)}</td>
                        <td className="num">{formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {invoice.subtotal != null && (
                      <tr>
                        <td colSpan={3} className="num" style={{ borderTop: '1px solid var(--border-subtle)' }}>Subtotal</td>
                        <td className="num" style={{ borderTop: '1px solid var(--border-subtle)' }}>{formatCurrency(num(invoice.subtotal))}</td>
                      </tr>
                    )}
                    {num(invoice.discount) > 0 && (
                      <tr>
                        <td colSpan={3} className="num">Discount</td>
                        <td className="num">−{formatCurrency(num(invoice.discount))}</td>
                      </tr>
                    )}
                    {vat != null && (
                      <tr>
                        <td colSpan={3} className="num">VAT{taxRate != null ? ` (${taxRate}%)` : ''}</td>
                        <td className="num">{formatCurrency(vat)}</td>
                      </tr>
                    )}
                    <tr className="fin-total-row">
                      <td colSpan={3} className="num">Total</td>
                      <td className="num">{formatCurrency(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ) : (invoice.subtotal != null || vat != null) && (
            <section className="card" aria-labelledby="breakdown-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="breakdown-title" className="fin-panel-title">Charges</h2>
                  <p className="fin-panel-desc">No separate line items</p>
                </div>
              </div>
              <dl className="fin-dl">
                {invoice.subtotal != null && (
                  <div className="fin-dl__row"><dt>Subtotal, excl. VAT</dt><dd>{formatCurrency(num(invoice.subtotal))}</dd></div>
                )}
                {num(invoice.discount) > 0 && (
                  <div className="fin-dl__row"><dt>Discount</dt><dd>−{formatCurrency(num(invoice.discount))}</dd></div>
                )}
                {vat != null && (
                  <div className="fin-dl__row"><dt>VAT{taxRate != null ? ` (${taxRate}%)` : ''}</dt><dd>{formatCurrency(vat)}</dd></div>
                )}
                <div className="fin-dl__row is-total"><dt>Total</dt><dd>{formatCurrency(total)}</dd></div>
              </dl>
              {invoice.notes && <p className="fin-note" style={{ marginTop: 12 }}>Note: {invoice.notes}</p>}
            </section>
          )}

          {/* Payment history */}
          {payments && payments.length > 0 && (
            <section className="card fin-table-card" aria-labelledby="payments-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="payments-title" className="fin-panel-title">Payments</h2>
                  <p className="fin-panel-desc">
                    {payments.length} recorded, by payment date
                  </p>
                </div>
              </div>
              <div className="fin-table-scroll">
                <table className="fin-table table-heading-roles">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Method</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment: any, idx: number) => {
                      const ref = payment.reference || payment.reference_number || payment.payment_number;
                      return (
                        <tr key={idx}>
                          <td className="fin-date">{safeDate(payment.payment_date || payment.date)}</td>
                          <td>{ref ? <span className="fin-id">{ref}</span> : '—'}</td>
                          <td>{methodLabel(payment.payment_method || payment.method || 'EFT')}</td>
                          <td className="num">{formatCurrency(num(payment.amount))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="fin-total-row">
                      <td colSpan={3} className="num">Total paid</td>
                      <td className="num">{formatCurrency(totalPaid)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="fin-stack" style={{ minWidth: 0 }}>
          {showPaymentForm && (
            <section className="card" id="record-payment" aria-labelledby="record-payment-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="record-payment-title" className="fin-panel-title">Record a payment</h2>
                  <p className="fin-panel-desc">Balance due {formatCurrency(balance)}, incl. VAT.</p>
                </div>
              </div>
              <div className="fin-form" style={{ gap: 12 }}>
                <div>
                  <label className="fin-label" htmlFor="pay-amount">Amount (ZAR)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="pay-amount"
                      className="fin-control"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      style={{ flex: 1, minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
                    />
                    <button
                      type="button"
                      className="btn-action fin-btn-secondary"
                      onClick={() => setPaymentAmount(String(invoice.balance))}
                      aria-label="Use full balance"
                    >
                      Full balance
                    </button>
                  </div>
                </div>
                <div>
                  <label className="fin-label">Payment date</label>
                  <DatePicker
                    value={paymentDate}
                    onChange={setPaymentDate}
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label className="fin-label" id="pay-method-label">Method</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger aria-labelledby="pay-method-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFT">EFT</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="fin-label" htmlFor="pay-ref">Reference (optional)</label>
                  <input
                    id="pay-ref"
                    className="fin-control"
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowPaymentForm(false)} className="btn-action fin-btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleRecordPayment} disabled={recordingPayment} className="btn-action">
                    {recordingPayment ? 'Saving…' : 'Save payment'}
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="activity-title">
            <div className="fin-panel-head" style={{ marginBottom: 4 }}>
              <div className="fin-panel-head__text">
                <h2 id="activity-title" className="fin-panel-title">Activity</h2>
              </div>
            </div>
            <dl className="fin-dl">
              {activity.map(r => (
                <div key={r.label} className="fin-dl__row">
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {(capitalEntry || ineligibleEntry) && (
            <section className="card" aria-labelledby="fastpay-title">
              <div className="fin-panel-head">
                <div className="fin-panel-head__text">
                  <h2 id="fastpay-title" className="fin-panel-title fin-panel-title--tip">
                    Fast Pay
                    {!CAPITAL_LAUNCHED && <InfoTip align="end">{CAPITAL_COMING_SOON}</InfoTip>}
                  </h2>
                  {!CAPITAL_LAUNCHED && <p className="fin-panel-desc">Not live yet</p>}
                </div>
              </div>
              {capitalEntry && (
                applied ? (
                  <div className="fin-inset">
                    <p className="fin-note"><strong>Applied for Fast Pay</strong>Your earlier application is on record.</p>
                  </div>
                ) : (
                  <button type="button" className="btn-action fin-btn-secondary" style={{ width: '100%' }}
                    disabled={!CAPITAL_LAUNCHED} title={CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON}>
                    {CAPITAL_LAUNCHED ? 'Apply for Fast Pay' : 'Apply for Fast Pay (coming soon)'}
                  </button>
                )
              )}
              {ineligibleEntry && (
                <div className="fin-inset">
                  <p className="fin-note"><strong>This invoice would not qualify</strong>{ineligibleEntry.reason}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
