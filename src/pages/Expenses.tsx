import { useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  trip_id?: number;
  trip_number?: string;
  status: string;
}

const formatZAR = (v: number) =>
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATS = [
  { value: 'All', label: 'All Categories' },
  { value: 'FUEL', label: '⛽ Fuel' },
  { value: 'TOLLS', label: '🛣️ Tolls' },
  { value: 'MAINTENANCE', label: '🔧 Maintenance' },
  { value: 'DRIVER', label: '👤 Driver' },
  { value: 'INSURANCE', label: '🛡️ Insurance' },
  { value: 'OVERHEAD', label: '📋 Overhead' },
];

const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#22c55e',
  PENDING: 'var(--status-warning)',
  REJECTED: 'var(--status-danger)',
};

function getCategoryLabel(cat: string) {
  const c = EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES];
  return c ? `${(c as any).icon || ''} ${(c as any).label || cat}` : cat;
}

export default function Expenses() {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const perPage = 10;

  const { data: expensesData, isLoading, refetch } = useFetch<{ results: Expense[]; count: number }>('/api/expenses/');
  const expenses: Expense[] = expensesData?.results || [];

  const now = new Date();
  const mtd = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMTD = mtd.reduce((s, e) => s + e.amount, 0);
  const fuelMTD = mtd.filter(e => e.category === 'FUEL').reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'PENDING');
  const pendingAmt = pending.reduce((s, e) => s + e.amount, 0);

  const filtered = expenses.filter(e => {
    const catOk = categoryFilter === 'All' || e.category === categoryFilter;
    const srchOk = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.trip_number?.toLowerCase().includes(search.toLowerCase());
    return catOk && srchOk;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  if (isLoading) return (
    <div style={{ padding: 40, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>LOADING...</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Expenses</div>
        </div>
        <button className="btn-action" onClick={() => setShowAdd(true)}>+ ADD EXPENSE</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Expenses MTD</span></div>
          <div className="metric-value" style={{ fontSize: 22 }}>{formatZAR(totalMTD)}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Fuel Costs MTD</span></div>
          <div className="metric-value" style={{ fontSize: 22 }}>{formatZAR(fuelMTD)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {totalMTD > 0 ? ((fuelMTD / totalMTD) * 100).toFixed(1) : 0}% of total
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Pending Approval</span></div>
          <div className="metric-value" style={{ fontSize: 22, color: 'var(--status-warning)' }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{formatZAR(pendingAmt)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', padding: '7px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
          }}
        >
          {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input
          placeholder="Search expenses..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', padding: '7px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, width: 240,
          }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Trip</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No expenses found</td></tr>
            ) : rows.map(exp => (
              <tr key={exp.id}>
                <td className="mono">{new Date(exp.date).toLocaleDateString('en-ZA')}</td>
                <td>{getCategoryLabel(exp.category)}</td>
                <td>{exp.description}</td>
                <td className="mono">{exp.trip_number || (exp.trip_id ? `TRIP-${exp.trip_id}` : '—')}</td>
                <td className="text-right mono">{formatZAR(exp.amount)}</td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: STATUS_COLOR[exp.status] || 'var(--text-secondary)' }}>
                    {exp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← PREV</button>
              <button className="btn-action" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAdd && <AddExpenseModal onClose={() => { setShowAdd(false); refetch(); }} />}
    </div>
  );
}

function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [tripId, setTripId] = useState('');

  const { mutate: createExpense, isPending } = usePost();
  const { data: tripsData } = useFetch<{ results: any[] }>('/api/trips/');

  const inputStyle = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', padding: '8px 12px',
    fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 2, width: '100%', boxSizing: 'border-box' as const,
  };
  const labelStyle = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createExpense(
      { url: '/api/expenses/', data: { category, amount: parseFloat(amount), date, description, trip_id: tripId ? parseInt(tripId) : null, status: 'PENDING' } },
      { onSuccess: onClose }
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Add Expense</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} required style={inputStyle}>
              <option value="">Select category</option>
              {CATS.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Amount (ZAR)</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Trip (optional)</label>
            <select value={tripId} onChange={e => setTripId(e.target.value)} style={inputStyle}>
              <option value="">No trip</option>
              {tripsData?.results?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.trip_number || `TRIP-${t.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter expense details..." rows={3} required style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', borderRadius: 2 }}>CANCEL</button>
            <button type="submit" disabled={isPending} className="btn-action">{isPending ? 'ADDING...' : 'ADD EXPENSE'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
