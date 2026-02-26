import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { INVOICES } from "@/mocks/simple-invoice-data";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--accent-primary)', SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)', DRAFT: 'var(--text-tertiary)',
};
const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: '#22c55e',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)', ineligible: 'var(--text-tertiary)',
};

export default function Invoices() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];

  const filtered = INVOICES.filter(inv => {
    const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
    const matchSearch = !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || inv.customerName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const outstanding = INVOICES.filter(i => i.status === 'SENT').reduce((s, i) => s + i.amount, 0);
  const overdue = INVOICES.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0);
  const paid = INVOICES.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
  const fpCount = INVOICES.filter(i => i.fastPay && i.status !== 'PAID').length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Invoices</div>
          <button className="btn-action" onClick={() => navigate('/finance/invoices/new')}>+ NEW INVOICE</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Outstanding', value: formatCurrency(outstanding), color: 'var(--status-warning)' },
          { label: 'Overdue', value: formatCurrency(overdue), color: 'var(--status-danger)' },
          { label: 'Collected', value: formatCurrency(paid), color: 'var(--accent-primary)' },
          { label: 'Fast Pay Eligible', value: fpCount, color: '#22c55e' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 220, fontFamily: 'var(--font-sans)' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: `1px solid ${statusFilter === s ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: statusFilter === s ? '#000' : 'var(--text-secondary)',
              padding: '6px 10px', borderRadius: 2, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Risk Tier</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.customerName}</td>
                <td>{formatCurrency(inv.amount)}</td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[inv.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>{inv.status}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{inv.dueDate}</td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[inv.tier], padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2, textTransform: 'uppercase' }}>{inv.tier}</span></td>
                <td className="text-right">
                  {inv.fastPay && inv.status !== 'PAID' && (
                    <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => navigate('/capital')}>FAST PAY</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No invoices found</div>}
      </div>
    </div>
  );
}
