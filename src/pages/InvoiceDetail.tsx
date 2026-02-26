import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
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

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchData(`api/invoices/${id}/`),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (!invoice) return <div style={{ padding: 40 }}><div style={{ color: 'var(--text-tertiary)' }}>Invoice not found.</div><button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/invoices')}>← BACK</button></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/invoices')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO INVOICES</button>
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
            {invoice.status !== 'PAID' && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12 }}>MARK AS PAID</button>
            )}
            {invoice.status === 'DRAFT' && (
              <button className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>SEND TO CUSTOMER</button>
            )}
            <button onClick={() => navigate('/capital')} className="btn-action" style={{ width: '100%', padding: '10px', fontSize: 12, background: 'transparent', border: '1px solid #22c55e', color: '#22c55e' }}>REQUEST FAST PAY</button>
          </div>
        </div>
      </div>
    </div>
  );
}
