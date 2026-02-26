import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { INVOICES } from "@/mocks/simple-invoice-data";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  PAID: '#22c55e', SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)', DRAFT: 'var(--text-tertiary)',
};
const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: '#22c55e',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)', ineligible: 'var(--text-tertiary)',
};

const PAGE_SIZE = 10;

export default function Invoices() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];

  const filtered = INVOICES.filter(inv => {
    const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
    const matchSearch = !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || inv.customerName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Outstanding', value: formatCurrency(outstanding), color: 'var(--status-warning)' },
          { label: 'Overdue', value: formatCurrency(overdue), color: 'var(--status-danger)' },
          { label: 'Collected', value: formatCurrency(paid), color: '#22c55e' },
          { label: 'Fast Pay Eligible', value: fpCount, color: 'var(--accent-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

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
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
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
            ) : rows.map(inv => (
              <tr
                key={inv.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/finance/invoices/${inv.id}`)}
              >
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.customerName}</td>
                <td className="mono">{formatCurrency(inv.amount)}</td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[inv.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                    {inv.status}
                  </span>
                </td>
                <td style={{ color: inv.status === 'OVERDUE' ? 'var(--status-danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{inv.dueDate}</td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TIER_COLOR[inv.tier], padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2, textTransform: 'uppercase' }}>
                    {inv.tier}
                  </span>
                </td>
                <td className="text-right" onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {inv.fastPay && inv.status !== 'PAID' && (
                      <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => navigate('/capital')}>FAST PAY</button>
                    )}
                    <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }} onClick={() => navigate(`/finance/invoices/${inv.id}`)}>VIEW</button>
                  </div>
                </td>
              </tr>
            ))}
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
