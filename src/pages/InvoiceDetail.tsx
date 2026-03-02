import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--accent-primary)',
  SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)',
  DRAFT: 'var(--text-tertiary)',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  const handleSendInvoice = async () => {
    if (!id) return;
    setSending(true);
    try {
      await postData({ url: `api/v1/invoices/${id}/send_invoice/` });
      setToast('Invoice sent!');
      setTimeout(() => setToast(null), 3000);
      refetch();
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast('Failed to send invoice');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!id) return;
    setDownloading(true);
    const url = `/api/v1/invoices/${id}/generate_pdf/`;
    window.open(import.meta.env.VITE_API_URL + url, '_blank');
    setToast('PDF downloading...');
    setTimeout(() => {
      setToast(null);
      setDownloading(false);
    }, 3000);
  };

  const handleRecordPayment = async () => {
    if (!id || !paymentAmount || !paymentDate) {
      setToast('Please fill in all required fields');
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
      setToast('Payment recorded!');
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDate('');
      setPaymentReference('');
      setTimeout(() => setToast(null), 3000);
      refetch();
    } catch (error) {
      console.error('Failed to record payment:', error);
      setToast('Failed to record payment');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRecordingPayment(false);
    }
  };

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (isError || !invoice) return <div style={{ padding: 40 }}><div style={{ color: 'var(--text-tertiary)' }}>Invoice not found.</div><button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/finance/invoices')}>← BACK</button></div>;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000, background: 'var(--accent-primary)', color: 'black', padding: '12px 20px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/finance/invoices')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO INVOICES</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Invoice</div>
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
      {invoice.items && invoice.items.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Line Items</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
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
              {invoice.items.map((item: any, idx: number) => (
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
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Payment History</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {invoice.payments.length} payment{invoice.payments.length !== 1 ? 's' : ''}
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
              {invoice.payments.map((payment: any, idx: number) => (
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
                  {formatCurrency(invoice.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0))}
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
            {invoice.status === 'DRAFT' && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={handleSendInvoice} disabled={sending}>
                {sending ? 'SENDING...' : 'SEND TO CUSTOMER'}
              </button>
            )}
            {invoice.status !== 'DRAFT' && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={handleDownloadPDF} disabled={downloading}>
                {downloading ? 'DOWNLOADING...' : 'DOWNLOAD PDF'}
              </button>
            )}
            {(invoice.status === 'SENT' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIALLY_PAID') && !showPaymentForm && (
              <button onClick={() => setShowPaymentForm(true)} className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>RECORD PAYMENT</button>
            )}
            {(invoice.fast_pay_eligible || invoice.early_pay_eligible) && invoice.status !== 'PAID' && (
              <button onClick={() => navigate('/capital')} className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>REQUEST FAST PAY</button>
            )}
          </div>

          {showPaymentForm && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="card-title" style={{ marginBottom: 12, fontSize: 12 }}>Record Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ padding: '8px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 2, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{ padding: '8px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 2, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ padding: '8px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 2, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                >
                  <option value="EFT">EFT</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
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
                    style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--accent-primary)', border: 'none', color: 'black' }}
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
