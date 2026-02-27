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
            {(invoice.fast_pay_eligible || invoice.early_pay_eligible) && invoice.status !== 'PAID' && (
              <button onClick={() => navigate('/capital')} className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>REQUEST FAST PAY</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
