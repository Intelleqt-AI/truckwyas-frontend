import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/Api";

import { formatCurrency } from "@/lib/formatters";

const MC_URL =
  "https://getstarted.merchantcapital.co.za?actiontype=C_C&channel=Part_Trad&who=IA_SP";
const MC_STORAGE_KEY = "mc_applied_invoice_ids";

function loadAppliedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MC_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAppliedId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current).add(id);
  localStorage.setItem(MC_STORAGE_KEY, JSON.stringify([...next]));
  return next;
}
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--accent-primary)',
  SENT: 'var(--status-warning)',
  VIEWED: 'var(--status-info, #6366f1)',
  OVERDUE: 'var(--status-danger)',
  PARTIALLY_PAID: 'var(--status-warning)',
  DRAFT: 'var(--text-tertiary)',
};

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
  const payments = Array.isArray(paymentsResp) ? paymentsResp : (paymentsResp?.results ?? []);

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

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (isError || !invoice) return <div style={{ padding: 40 }}><div style={{ color: 'var(--text-tertiary)' }}>Invoice not found.</div><button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/finance/invoices')}>← BACK</button></div>;

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 1000,
          background: toast.isError ? 'var(--status-danger, #e53935)' : 'var(--accent-primary)',
          color: toast.isError ? '#fff' : 'black',
          padding: '12px 20px', borderRadius: 2, fontSize: 12,
          fontFamily: 'var(--font-mono)', fontWeight: 600,
          maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/finance/invoices')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO INVOICES</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>Invoice</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{invoice.invoice_number}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{invoice.customer_name}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: STATUS_COLOR[invoice.status] || 'var(--text-secondary)', padding: '6px 12px', border: `1px solid ${STATUS_COLOR[invoice.status] || 'var(--border-subtle)'}`, borderRadius: 2 }}>
            {invoice.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Amount', value: formatCurrency(parseFloat(invoice.total_amount || invoice.amount || '0')), color: 'var(--accent-primary)' },
          { label: 'Due Date', value: invoice.due_date?.slice(0, 10) || '—', color: 'var(--text-primary)' },
          { label: 'Issued', value: invoice.created_at?.slice(0, 10) || '—', color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 18, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Line Items */}
      {invoice.line_items && invoice.line_items.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Line Items</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {invoice.line_items.length} item{invoice.line_items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td>{item.description || item.item_description || '—'}</td>
                  <td className="mono text-right">{item.quantity || 1}</td>
                  <td className="mono text-right">{formatCurrency(item.unit_price || item.price || 0)}</td>
                  <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, padding: '12px 0', fontSize: 13 }}>Total:</td>
                <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 16, padding: '12px 0' }}>
                  {formatCurrency(parseFloat(invoice.total_amount || invoice.amount || '0'))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Payment History</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any, idx: number) => (
                <tr key={idx}>
                  <td className="mono">{payment.payment_date?.slice(0, 10) || payment.date?.slice(0, 10) || '—'}</td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      padding: '2px 6px',
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 2,
                      color: 'var(--text-secondary)'
                    }}>
                      {payment.payment_method || payment.method || 'EFT'}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {payment.reference || '—'}
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                    {formatCurrency(payment.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, padding: '12px 0', fontSize: 13 }}>Total Paid:</td>
                <td className="mono text-right" style={{ color: 'var(--status-success)', fontWeight: 700, fontSize: 16, padding: '12px 0' }}>
                  {formatCurrency(payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Invoice Details</div>
          {[
            { label: 'Invoice Number', value: invoice.invoice_number },
            { label: 'Customer', value: invoice.customer_name },
            { label: 'Status', value: invoice.status },
            { label: 'Amount', value: formatCurrency(parseFloat(invoice.total_amount || invoice.amount || '0')) },
            { label: 'Due Date', value: invoice.due_date?.slice(0, 10) || '—' },
            { label: 'Created', value: invoice.created_at?.slice(0, 10) || '—' },
            {
              label: 'Reminders Sent',
              value: invoice.reminder_count
                ? `${invoice.reminder_count} — last ${new Date(invoice.last_reminder_at).toLocaleDateString('en-ZA')}`
                : 'None sent',
            },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(invoice.status === 'DRAFT' || invoice.status === 'SENT' || invoice.status === 'VIEWED') && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={handleSendInvoice} disabled={sending}>
                {sending ? 'SENDING...' : invoice.status === 'VIEWED' ? 'RESEND TO CUSTOMER' : 'SEND TO CUSTOMER'}
              </button>
            )}
            <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? 'DOWNLOADING...' : 'DOWNLOAD PDF'}
            </button>
            {(invoice.status === 'SENT' || invoice.status === 'VIEWED' || invoice.status === 'OVERDUE') && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', background: 'transparent', border: '1px solid var(--status-warning)', color: 'var(--status-warning)' }} onClick={handleSendReminder} disabled={sendingReminder}>
                {sendingReminder ? 'SENDING...' : 'SEND REMINDER'}
              </button>
            )}
            {(invoice.status === 'SENT' || invoice.status === 'VIEWED' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIALLY_PAID') && !showPaymentForm && (
              <button onClick={() => setShowPaymentForm(true)} className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>RECORD PAYMENT</button>
            )}
            {capitalEntry && (
              <a
                href={MC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-action"
                onClick={() => setAppliedIds((prev) => saveAppliedId(String(id), prev))}
                style={{
                  width: '100%', padding: '10px', fontSize: 12,
                  background: 'transparent',
                  border: `1px solid ${appliedIds.has(String(id)) ? 'var(--status-success)' : 'var(--accent-primary)'}`,
                  color: appliedIds.has(String(id)) ? 'var(--status-success)' : 'var(--accent-primary)',
                  textDecoration: 'none', textAlign: 'center', display: 'block', boxSizing: 'border-box',
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                }}>
                {appliedIds.has(String(id)) ? 'Applied ✓' : 'APPLY FOR CAPITAL →'}
              </a>
            )}
            {ineligibleEntry && (
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '8px 10px', lineHeight: 1.4 }}>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 3, fontSize: 10, letterSpacing: '0.05em' }}>NOT ELIGIBLE FOR CAPITAL</div>
                {ineligibleEntry.reason}
              </div>
            )}
          </div>

          {showPaymentForm && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="card-title" style={{ marginBottom: 12, fontSize: 12 }}>Record Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Amount (balance: ${formatCurrency(invoice.balance)})`}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    style={{ flex: 1, padding: '8px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 2, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(invoice.balance))}
                    style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 2, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    FULL
                  </button>
                </div>
                <DatePicker
                  value={paymentDate}
                  onChange={setPaymentDate}
                  style={{ padding: '8px', fontSize: 12 }}
                  maxDate={new Date()}
                />
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFT">EFT</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  type="text"
                  placeholder="Reference (optional)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  style={{ padding: '8px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 2, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleRecordPayment}
                    disabled={recordingPayment}
                    className="btn-action"
                    style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--accent-primary)', border: 'none', color: 'white' }}
                  >
                    {recordingPayment ? 'RECORDING...' : 'SAVE'}
                  </button>
                  <button
                    onClick={() => setShowPaymentForm(false)}
                    className="btn-action"
                    style={{ flex: 1, padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
