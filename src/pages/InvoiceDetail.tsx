import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/Api";

import { formatCurrency, formatDate } from "@/lib/formatters";
import "./finance-brand.css";
import "./table-heading-roles.css";
import { Loader } from "@/components/Loader";

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
      setToast({ msg: 'Invoice sent!' });
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
      setToast({ msg: 'Reminder sent successfully!' });
      setTimeout(() => setToast(null), 3000);
      refetch();
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setToast({ msg: 'Reminder recorded — customer will be contacted' });
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
      setToast({ msg: 'Please fill in all required fields', isError: true });
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
      setToast({ msg: 'Payment recorded!' });
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

  const details = [
    { label: 'Invoice number', value: invoice.invoice_number, id: true },
    { label: 'Customer', value: invoice.customer_name },
    ...(invoice.load_number ? [{ label: 'Load', value: invoice.load_number, id: true }] : []),
    { label: 'Status', value: formatStatus(status) },
    { label: 'Total', value: formatCurrency(total), money: true },
    { label: 'Due date', value: safeDate(invoice.due_date) },
    { label: 'Created', value: safeDate(invoice.created_at) },
    {
      label: 'Reminders sent',
      value: invoice.reminder_count
        ? `${invoice.reminder_count} — last ${safeDate(invoice.last_reminder_at)}`
        : 'None sent',
    },
  ];

  return (
    <div className="fin-page">
      {toast && (
        <div className="fin-toast" role={toast.isError ? 'alert' : 'status'} style={toast.isError ? { borderLeftColor: 'var(--status-danger)' } : undefined}>
          {toast.msg}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/finance/invoices')}
        className="fin-back"
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, lineHeight: '20px', fontWeight: 500, minHeight: 40, marginBottom: 8, padding: 0 }}>
        ← Back to invoices
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Invoice</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
              {invoice.invoice_number}
            </h1>
            <span className={`fin-chip${tone === 'neutral' ? '' : ` fin-chip--${tone}`}`}>{formatStatus(status)}</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 4 }}>{invoice.customer_name}</div>
        </div>
      </header>

      <div className="fin-grid-2" style={{ alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* Key amount */}
          <section className="card" aria-label="Amount summary">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div className="fin-kpi__label">{showBalance ? 'Balance due' : 'Invoice total'}</div>
                <div className="fin-kpi__value">{formatCurrency(showBalance ? balance : total)}</div>
                {showBalance && balance !== total && (
                  <div className="fin-kpi__sub">of {formatCurrency(total)} invoiced</div>
                )}
              </div>
              <dl style={{ display: 'flex', gap: 32, margin: 0, flexWrap: 'wrap' }}>
                <div>
                  <dt className="fin-kpi__label">Due date</dt>
                  <dd className={status === 'OVERDUE' ? 'fin-text-danger' : ''} style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{safeDate(invoice.due_date)}</dd>
                </div>
                <div>
                  <dt className="fin-kpi__label">Issued</dt>
                  <dd style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{safeDate(invoice.issue_date || invoice.created_at)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Line items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <section className="card fin-table-card" aria-labelledby="line-items-title">
              <div className="fin-table-card__head">
                <h2 id="line-items-title" className="fin-h2">Line items</h2>
                <span className="fin-support">
                  {invoice.line_items.length} item{invoice.line_items.length !== 1 ? 's' : ''}
                </span>
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
                    {(invoice.vat_amount ?? invoice.tax_amount) != null && (
                      <tr>
                        <td colSpan={3} className="num">VAT</td>
                        <td className="num">{formatCurrency(num(invoice.vat_amount ?? invoice.tax_amount))}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="num" style={{ fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' }}>Total</td>
                      <td className="num" style={{ fontWeight: 600, borderTop: '1px solid var(--border-subtle)' }}>
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* Payment history */}
          {payments && payments.length > 0 && (
            <section className="card fin-table-card" aria-labelledby="payments-title">
              <div className="fin-table-card__head">
                <h2 id="payments-title" className="fin-h2">Payment history</h2>
                <span className="fin-support">
                  {payments.length} payment{payments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="fin-table-scroll">
                <table className="fin-table table-heading-roles">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment: any, idx: number) => {
                      const ref = payment.reference || payment.reference_number;
                      return (
                        <tr key={idx}>
                          <td className="fin-date">{safeDate(payment.payment_date || payment.date)}</td>
                          <td><span className="fin-chip">{methodLabel(payment.payment_method || payment.method || 'EFT')}</span></td>
                          <td>{ref ? <span className="fin-id">{ref}</span> : '—'}</td>
                          <td className="num">{formatCurrency(num(payment.amount))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="num" style={{ fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' }}>Total paid</td>
                      <td className="num" style={{ fontWeight: 600, borderTop: '1px solid var(--border-subtle)' }}>
                        {formatCurrency(totalPaid)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <section className="card" aria-labelledby="actions-title">
            <h2 id="actions-title" className="fin-h2" style={{ marginBottom: 16 }}>Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canSend && (
                <button className="btn-action" style={{ width: '100%' }} onClick={handleSendInvoice} disabled={sending}>
                  {sending ? 'Sending…' : status === 'VIEWED' ? 'Resend to customer' : 'Send to customer'}
                </button>
              )}
              {canRecordPayment && !showPaymentForm && (
                <button onClick={() => setShowPaymentForm(true)} className={`btn-action ${canSend ? 'fin-btn-secondary' : ''}`} style={{ width: '100%' }}>
                  Record payment
                </button>
              )}
              {canRemind && (
                <button className="btn-action fin-btn-secondary" style={{ width: '100%' }} onClick={handleSendReminder} disabled={sendingReminder}>
                  {sendingReminder ? 'Sending…' : 'Send reminder'}
                </button>
              )}
              <button className="btn-action fin-btn-secondary" style={{ width: '100%' }} onClick={handleDownloadPDF} disabled={downloading}>
                {downloading ? 'Downloading…' : 'Download PDF'}
              </button>
              {capitalEntry && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {applied ? 'Applied for Fast Pay' : 'Eligible for Fast Pay'}
                  </div>
                  {applied ? 'Your earlier application is on record.' : 'Fast Pay is being set up. Early settlement for this invoice will be available here soon.'}
                </div>
              )}
              {ineligibleEntry && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Not eligible for Fast Pay</div>
                  {ineligibleEntry.reason}
                </div>
              )}
            </div>

            {showPaymentForm && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, margin: '0 0 12px' }}>Record payment</h3>
                <div className="fin-form" style={{ gap: 12 }}>
                  <div>
                    <label className="fin-label" htmlFor="pay-amount">Amount (ZAR)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        id="pay-amount"
                        className="fin-control"
                        type="text"
                        inputMode="decimal"
                        placeholder={`Balance ${formatCurrency(invoice.balance)}`}
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowPaymentForm(false)}
                      className="btn-action fin-btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRecordPayment}
                      disabled={recordingPayment}
                      className="btn-action"
                      style={{ flex: 1 }}
                    >
                      {recordingPayment ? 'Recording…' : 'Save payment'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="details-title">
            <h2 id="details-title" className="fin-h2" style={{ marginBottom: 8 }}>Invoice details</h2>
            <dl style={{ margin: 0 }}>
              {details.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <dt style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{r.label}</dt>
                  <dd
                    className={r.id ? 'fin-id' : undefined}
                    style={{ margin: 0, fontSize: r.id ? 13 : 14, lineHeight: '20px', color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: r.money ? 'tabular-nums' : undefined, overflowWrap: 'anywhere' }}>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
