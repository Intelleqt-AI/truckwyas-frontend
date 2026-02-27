import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--status-success)', SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)', DRAFT: 'var(--text-tertiary)',
};
const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: 'var(--status-success)',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)', ineligible: 'var(--text-tertiary)',
};

const PAGE_SIZE = 10;

export default function Invoices() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];

  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      try {
        const data = await fetchData('/api/v1/invoices/');
        // API returns paginated {count, results} — extract results
        setInvoices(Array.isArray(data) ? data : (data?.results || []));
      } catch (error) {
        console.error('Failed to load invoices:', error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  const handleSendInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingId(invoiceId);
    try {
      await postData({ url: `/api/v1/invoices/${invoiceId}/send_invoice/` });
      setToast('Invoice sent!');
      setTimeout(() => setToast(null), 3000);
      // Optimistically update status
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'SENT' } : inv));
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast('Failed to send invoice');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPDF = (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    const url = `/api/v1/invoices/${invoiceId}/generate_pdf/`;
    window.open(import.meta.env.VITE_API_URL + url, '_blank');
    setToast('PDF downloading...');
    setTimeout(() => setToast(null), 3000);
  };

  // Never fall back to mock data — show empty state if API returns nothing
  const allInvoices = invoices;

  const filtered = allInvoices.filter(inv => {
    const invStatus = inv.status?.toUpperCase();
    const matchStatus = statusFilter === 'All' || invStatus === statusFilter;
    const invNumber = inv.invoice_number || inv.invoiceNumber || '';
    const custName = inv.customer_name || inv.customerName || '';
    const matchSearch = !search || invNumber.toLowerCase().includes(search.toLowerCase()) || custName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const outstanding = allInvoices.filter(i => i.status === 'SENT').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const overdue = allInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const paid = allInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const fpCount = allInvoices.filter(i => (i.fast_pay_eligible || i.fastPay) && i.status !== 'PAID').length;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000, background: 'var(--accent-primary)', color: 'black', padding: '12px 20px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Invoices</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Last updated: {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button className="btn-action" onClick={() => navigate('/finance/invoices/new')}>+ NEW INVOICE</button>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
              <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Outstanding', value: formatCurrency(outstanding), color: 'var(--status-warning)' },
            { label: 'Overdue', value: formatCurrency(overdue), color: 'var(--status-danger)' },
            { label: 'Collected', value: formatCurrency(paid), color: 'var(--status-success)' },
            { label: 'Fast Pay Eligible', value: fpCount, color: 'var(--accent-primary)' },
          ].map(m => (
            <div key={m.label} className="card metric-card">
              <div className="card-header"><span className="card-title">{m.label}</span></div>
              <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text" placeholder="Search invoices..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 220, fontFamily: 'var(--font-sans)' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: `1px solid ${statusFilter === s ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: statusFilter === s ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              padding: '6px 10px', borderRadius: 2, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {filtered.length} invoices
        </span>
      </div>

      {/* Table — 10 per page, clickable */}
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Risk Tier</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No invoices found</td></tr>
            ) : rows.map(inv => {
              const invStatus = inv.status?.toUpperCase();
              const tier = inv.risk_tier || inv.tier || 'standard';
              const amount = parseFloat(inv.total_amount || inv.amount) || 0;
              const invNumber = inv.invoice_number || inv.invoiceNumber;
              const custName = inv.customer_name || inv.customerName;
              const dueDate = inv.due_date || inv.dueDate;
              const isFastPayEligible = inv.fast_pay_eligible || inv.early_pay_eligible || inv.fastPay;
              // Aging indicator
              const ageDays = dueDate ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;
              const agingColor = ageDays <= 0 ? 'var(--status-success)' : ageDays <= 30 ? 'var(--status-warning)' : ageDays <= 60 ? 'var(--accent-primary)' : 'var(--status-danger)';
              const agingLabel = ageDays <= 0 ? `Due in ${Math.abs(ageDays)}d` : `${ageDays}d overdue`;

              return (
                <tr
                  key={inv.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                >
                  <td className="mono">{invNumber}</td>
                  <td>{custName}</td>
                  <td className="mono">{formatCurrency(amount)}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[invStatus] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {invStatus}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: invStatus === 'OVERDUE' ? 'var(--status-danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{dueDate}</span>
                      {invStatus !== 'PAID' && dueDate && (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: agingColor, padding: '1px 5px', border: `1px solid ${agingColor}`, borderRadius: 2, whiteSpace: 'nowrap' }}>
                          {agingLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[tier], padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2, textTransform: 'uppercase' }}>
                      {tier}
                    </span>
                  </td>
                  <td className="text-right" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {invStatus === 'DRAFT' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={(e) => handleSendInvoice(e, inv.id)} disabled={sendingId === inv.id}>
                          {sendingId === inv.id ? 'SENDING...' : 'SEND'}
                        </button>
                      )}
                      {invStatus !== 'DRAFT' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={(e) => handleDownloadPDF(e, inv.id)}>
                          PDF
                        </button>
                      )}
                      {isFastPayEligible && invStatus !== 'PAID' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => navigate('/capital')}>FAST PAY</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Page {page} of {totalPages} · showing {rows.length} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← PREV</button>
              <button className="btn-action" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
