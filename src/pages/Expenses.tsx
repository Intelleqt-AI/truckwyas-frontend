import { useState, useEffect } from "react";
import { fetchData, postData, deleteData } from '@/lib/Api';

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  expense_date?: string;
  vehicle?: number;
  vehicle_registration?: string;
  status?: string;
}

interface Vehicle {
  id: number;
  registration: string;
}

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CATS = [
  { value: 'All', label: 'All Categories', icon: '📊' },
  { value: 'FUEL', label: 'Fuel', icon: '⛽' },
  { value: 'TOLLS', label: 'Tolls', icon: '🛣️' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: '🔧' },
  { value: 'DRIVER', label: 'Driver', icon: '👤' },
  { value: 'INSURANCE', label: 'Insurance', icon: '🛡️' },
  { value: 'OVERHEAD', label: 'Overhead', icon: '📋' },
  { value: 'OTHER', label: 'Other', icon: '📋' },
];

const DATE_FILTERS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

function getCategoryLabel(cat: string) {
  const c = CATS.find(x => x.value === cat);
  return c ? `${c.icon} ${c.label}` : cat;
}

function getCategoryIcon(cat: string) {
  const c = CATS.find(x => x.value === cat);
  return c?.icon || '📋';
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('this_month');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
    const vehOk = vehicleFilter === 'All' || (e.vehicle && e.vehicle.toString() === vehicleFilter);
    const srchOk = !search || e.description?.toLowerCase().includes(search.toLowerCase());

    let dateOk = true;
    if (startDate && endDate) {
      const eDate = new Date(e.expense_date || e.date);
      dateOk = eDate >= startDate && eDate <= endDate;
    }

    return catOk && vehOk && srchOk && dateOk;
  });

  // Sort by date desc
  const sorted = [...filtered].sort((a, b) => new Date(b.expense_date || b.date).getTime() - new Date(a.expense_date || a.date).getTime());

  // Summary calculations - ALL categories breakdown
  const allCategoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  // Get all category breakdowns in order
  const categoryBreakdown = CATS.slice(1).map(cat => ({
    category: cat.value,
    label: cat.label,
    icon: cat.icon,
    total: allCategoryTotals[cat.value] || 0,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const totalPages = Math.ceil(sorted.length / perPage);
  const rows = sorted.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    setDeletingId(id);
    try {
      await deleteData({ url: `/api/v1/expenses/${id}/` });
      loadData();
    } catch (err) {
      alert('Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected expense(s)?`)) return;

    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          deleteData({ url: `/api/v1/expenses/${id}/` })
        )
      );
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      alert('Some expenses failed to delete');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(e => e.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Vehicle', 'Amount', 'Status'];
    const csvRows = [
      headers.join(','),
      ...sorted.map(e => [
        formatDate(e.expense_date || e.date),
        e.category,
        `"${e.description}"`,
        e.vehicle_registration || '',
        e.amount,
        e.status || 'PENDING',
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status?: string) => {
    const s = status?.toUpperCase() || 'PENDING';
    let color = 'var(--status-warning)';
    let bg = 'var(--status-warning-bg)';

    if (s === 'APPROVED') {
      color = 'var(--accent-primary)';
      bg = 'var(--status-success-bg)';
    } else if (s === 'REJECTED') {
      color = 'var(--status-danger)';
      bg = 'var(--status-danger-bg)';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '100px',
        background: bg,
        fontSize: 10,
        color: color,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
      }}>
        {s}
      </span>
    );
  };

  if (loading) return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
        <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
      </div>
    </div>
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate monthly trend data (last 6 months)
  const monthlyTrend = (() => {
    const months: Record<string, number> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    expenses.forEach(e => {
      const date = new Date(e.expense_date || e.date);
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      months[key] = (months[key] || 0) + e.amount;
    });

    const allMonths = Object.entries(months).slice(-6);
    return allMonths;
  })();

  const maxMonthlyAmount = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(([_, amt]) => amt)) : 1;

  // Budget vs Actual (mock budgets for now)
  const budgetData = [
    { category: 'FUEL', budget: 150000, actual: allCategoryTotals['FUEL'] || 0 },
    { category: 'MAINTENANCE', budget: 80000, actual: allCategoryTotals['MAINTENANCE'] || 0 },
    { category: 'TOLLS', budget: 40000, actual: allCategoryTotals['TOLLS'] || 0 },
    { category: 'DRIVER', budget: 60000, actual: allCategoryTotals['DRIVER'] || 0 },
    { category: 'INSURANCE', budget: 50000, actual: allCategoryTotals['INSURANCE'] || 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Expenses</div>
          {categoryBreakdown.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{categoryBreakdown[0].icon}</span>
              <strong style={{ color: 'var(--accent-primary)' }}>{categoryBreakdown[0].label}</strong>
              <span>is your #1 expense this month</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>({formatZAR(categoryBreakdown[0].total)})</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn-action"
            onClick={handleExportCSV}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            EXPORT CSV
          </button>
          <button className="btn-action" onClick={() => setShowAdd(true)}>+ ADD EXPENSE</button>
        </div>
      </div>

      {/* Category Breakdown Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {categoryBreakdown.map(cat => {
          const percentage = totalExpenses > 0 ? (cat.total / totalExpenses * 100).toFixed(1) : '0.0';
          return (
            <div key={cat.category} className="card metric-card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{cat.icon}</span>
                  {cat.label}
                </span>
              </div>
              <div className="metric-value" style={{ fontSize: 20 }}>{formatZAR(cat.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                {percentage}% of total
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Section: Monthly Trend + Category Breakdown + Budget vs Actual */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Monthly Trend Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Monthly Expense Trend (Last 6 Months)
          </div>
          {monthlyTrend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>
              No monthly data available
            </div>
          ) : (
            <svg width="100%" height="200" style={{ overflow: 'visible' }}>
              {monthlyTrend.map(([month, amount], i) => {
                const barHeight = (amount / maxMonthlyAmount) * 160;
                const barWidth = Math.min(60, (100 / monthlyTrend.length) - 10);
                const x = i * (100 / monthlyTrend.length) + (100 / monthlyTrend.length / 2) - (barWidth / 2);

                return (
                  <g key={i}>
                    <rect
                      x={`${x}%`}
                      y={180 - barHeight}
                      width={barWidth}
                      height={barHeight}
                      fill="var(--accent-primary)"
                      rx="2"
                    />
                    <text
                      x={`${x + barWidth / 2}%`}
                      y="195"
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--text-tertiary)"
                      fontFamily="var(--font-mono)"
                    >
                      {month}
                    </text>
                    <text
                      x={`${x + barWidth / 2}%`}
                      y={175 - barHeight}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--text-primary)"
                      fontFamily="var(--font-mono)"
                      fontWeight="600"
                    >
                      {(amount / 1000).toFixed(0)}K
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Category Breakdown Donut Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Category Breakdown
          </div>
          {categoryBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>
              No category data
            </div>
          ) : (
            <div>
              <svg width="100%" height="180" viewBox="0 0 200 180">
                {(() => {
                  const colors = ['var(--accent-primary)', 'var(--status-success)', 'var(--status-warning)', 'var(--status-danger)', 'var(--text-secondary)'];
                  let cumulativePercent = 0;

                  return categoryBreakdown.slice(0, 5).map((cat, i) => {
                    const percent = (cat.total / totalExpenses) * 100;
                    const angle = (percent / 100) * 360;
                    const startAngle = (cumulativePercent / 100) * 360;
                    cumulativePercent += percent;

                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (startAngle + angle - 90) * (Math.PI / 180);

                    const x1 = 100 + 70 * Math.cos(startRad);
                    const y1 = 90 + 70 * Math.sin(startRad);
                    const x2 = 100 + 70 * Math.cos(endRad);
                    const y2 = 90 + 70 * Math.sin(endRad);

                    const largeArc = angle > 180 ? 1 : 0;

                    return (
                      <path
                        key={i}
                        d={`M 100 90 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={colors[i % colors.length]}
                        opacity={0.9}
                      />
                    );
                  });
                })()}
                <circle cx="100" cy="90" r="40" fill="var(--bg-deep)" />
                <text x="100" y="85" textAnchor="middle" fontSize="20" fill="var(--text-primary)" fontWeight="700">
                  {formatZAR(totalExpenses).replace('R ', '')}
                </text>
                <text x="100" y="100" textAnchor="middle" fontSize="10" fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                  TOTAL
                </text>
              </svg>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categoryBreakdown.slice(0, 5).map((cat, i) => {
                  const colors = ['var(--accent-primary)', 'var(--status-success)', 'var(--status-warning)', 'var(--status-danger)', 'var(--text-secondary)'];
                  const percent = (cat.total / totalExpenses) * 100;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length] }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{cat.label}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget vs Actual Section */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Budget vs Actual
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {budgetData.map((item, i) => {
            const percentUsed = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
            const isOverBudget = percentUsed > 100;
            const catInfo = CATS.find(c => c.value === item.category);

            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{catInfo?.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{catInfo?.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>ACTUAL</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: isOverBudget ? 'var(--status-danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                        {formatZAR(item.actual)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>BUDGET</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {formatZAR(item.budget)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: isOverBudget ? 'var(--status-danger)' : percentUsed > 80 ? 'var(--status-warning)' : 'var(--status-success)',
                      fontWeight: 600,
                      minWidth: 50,
                      textAlign: 'right'
                    }}>
                      {percentUsed.toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(percentUsed, 100)}%`,
                    background: isOverBudget ? 'var(--status-danger)' : percentUsed > 80 ? 'var(--status-warning)' : 'var(--accent-primary)',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', padding: '6px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
            }}
          >
            {CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          <select
            value={vehicleFilter}
            onChange={e => { setVehicleFilter(e.target.value); setPage(1); }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', padding: '6px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
            }}
          >
            <option value="All">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration}</option>)}
          </select>
          <select
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', padding: '6px 10px',
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
              color: 'var(--text-primary)', padding: '6px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, width: 240,
            }}
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            style={{
              fontSize: 11,
              padding: '6px 12px',
              background: 'var(--status-danger)',
              border: 'none',
              color: 'white',
              fontFamily: 'var(--font-mono)',
              cursor: bulkDeleting ? 'not-allowed' : 'pointer',
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            {bulkDeleting ? 'DELETING...' : `DELETE ${selectedIds.size} SELECTED`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No expenses found</td></tr>
            ) : rows.map(exp => (
              <tr key={exp.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(exp.id)}
                    onChange={() => toggleSelect(exp.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td className="mono">{formatDate(exp.expense_date || exp.date)}</td>
                <td>{getCategoryLabel(exp.category)}</td>
                <td>{exp.description}</td>
                <td className="mono">{exp.vehicle_registration || '—'}</td>
                <td>{getStatusBadge(exp.status)}</td>
                <td className="text-right mono">{formatZAR(exp.amount)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setEditingExpense(exp)}
                      className="btn-action"
                      style={{ fontSize: 10, padding: '4px 12px' }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={deletingId === exp.id}
                      style={{
                        fontSize: 10,
                        padding: '4px 10px',
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
        // Update existing via Api wrapper (includes auth token)
        const { putData } = await import('@/lib/Api');
        await putData({ url: `/api/v1/expenses/${expense.id}/`, data });
        onClose();
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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 20, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
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
