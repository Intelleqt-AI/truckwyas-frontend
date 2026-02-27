import { useState, useEffect } from "react";
import { fetchData, postData } from '../lib/api';

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  vehicle?: number;
  vehicle_registration?: string;
  status?: string;
}

interface Vehicle {
  id: number;
  registration: string;
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
  { value: 'OTHER', label: '📋 Other' },
];

const DATE_FILTERS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

function getCategoryLabel(cat: string) {
  const c = CATS.find(x => x.value === cat);
  return c?.label || cat;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('this_month');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const perPage = 10;

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchData('api/v1/expenses/'),
      fetchData('api/v1/vehicles/')
    ])
      .then(([expData, vehData]) => {
        setExpenses(Array.isArray(expData) ? expData : (expData?.results || []));
        setVehicles(Array.isArray(vehData) ? vehData : (vehData?.results || []));
        setError(null);
      })
      .catch(() => {
        setError('Failed to load expenses');
        setExpenses([]);
        setVehicles([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate date range
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateFilter === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (dateFilter === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  // Filter expenses
  const filtered = expenses.filter(e => {
    const catOk = categoryFilter === 'All' || e.category === categoryFilter;
    const srchOk = !search || e.description?.toLowerCase().includes(search.toLowerCase());

    let dateOk = true;
    if (startDate && endDate) {
      const eDate = new Date(e.date);
      dateOk = eDate >= startDate && eDate <= endDate;
    }

    return catOk && srchOk && dateOk;
  });

  // Sort by date desc
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Summary calculations
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMTD = thisMonth.reduce((s, e) => s + e.amount, 0);

  // Top 3 categories by spend this month
  const categoryTotals = thisMonth.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const totalPages = Math.ceil(sorted.length / perPage);
  const rows = sorted.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/expenses/${id}/`, { method: 'DELETE' });
      if (response.ok) {
        loadData();
        setDeletingId(null);
      } else {
        alert('Failed to delete expense');
        setDeletingId(null);
      }
    } catch (err) {
      alert('Failed to delete expense');
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40 }}>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
        <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
      </div>
    </div>
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

      {/* Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total This Month</span></div>
          <div className="metric-value" style={{ fontSize: 22 }}>{formatZAR(totalMTD)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {thisMonth.length} expenses
          </div>
        </div>
        {topCategories.map(([cat, amt], i) => (
          <div key={cat} className="card metric-card">
            <div className="card-header"><span className="card-title">{getCategoryLabel(cat)}</span></div>
            <div className="metric-value" style={{ fontSize: 18 }}>{formatZAR(amt)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {totalMTD > 0 ? ((amt / totalMTD) * 100).toFixed(1) : 0}% of total
            </div>
          </div>
        ))}
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
        <select
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', padding: '7px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
          }}
        >
          {DATE_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
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
              <th>Vehicle</th>
              <th className="text-right">Amount</th>
              <th>Actions</th>
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
                <td className="mono">{exp.vehicle_registration || '—'}</td>
                <td className="text-right mono">{formatZAR(exp.amount)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setEditingExpense(exp)}
                      className="btn-action"
                      style={{ fontSize: 10, padding: '4px 8px' }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={deletingId === exp.id}
                      style={{
                        fontSize: 10,
                        padding: '4px 8px',
                        background: 'none',
                        border: '1px solid var(--status-danger)',
                        color: 'var(--status-danger)',
                        fontFamily: 'var(--font-mono)',
                        cursor: deletingId === exp.id ? 'not-allowed' : 'pointer',
                        borderRadius: 2,
                      }}
                    >
                      {deletingId === exp.id ? '...' : 'DELETE'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of {sorted.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← PREV</button>
              <button className="btn-action" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Expense Modal */}
      {showAdd && <ExpenseModal vehicles={vehicles} onClose={() => { setShowAdd(false); loadData(); }} />}
      {editingExpense && <ExpenseModal expense={editingExpense} vehicles={vehicles} onClose={() => { setEditingExpense(null); loadData(); }} />}
    </div>
  );
}

function ExpenseModal({ expense, vehicles, onClose }: { expense?: Expense; vehicles: Vehicle[]; onClose: () => void }) {
  const [category, setCategory] = useState(expense?.category || '');
  const [amount, setAmount] = useState(expense?.amount.toString() || '');
  const [date, setDate] = useState(expense?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(expense?.description || '');
  const [vehicleId, setVehicleId] = useState(expense?.vehicle?.toString() || '');
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', padding: '8px 12px',
    fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 2, width: '100%', boxSizing: 'border-box' as const,
  };
  const labelStyle = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const data = {
      category,
      amount: parseFloat(amount),
      date,
      description,
      vehicle: vehicleId ? parseInt(vehicleId) : null,
    };

    try {
      if (expense) {
        // Update existing
        const response = await fetch(`/api/v1/expenses/${expense.id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          onClose();
        } else {
          alert('Failed to update expense');
          setSubmitting(false);
        }
      } else {
        // Create new
        await postData('/api/v1/expenses/', data);
        onClose();
      }
    } catch (err) {
      alert('Failed to save expense');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            {expense ? 'Edit Expense' : 'Add Expense'}
          </div>
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
            <label style={labelStyle}>Vehicle (optional)</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={inputStyle}>
              <option value="">No vehicle</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter expense details..." rows={3} required style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', borderRadius: 2 }}>CANCEL</button>
            <button type="submit" disabled={submitting} className="btn-action">
              {submitting ? (expense ? 'UPDATING...' : 'ADDING...') : (expense ? 'UPDATE' : 'ADD EXPENSE')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
