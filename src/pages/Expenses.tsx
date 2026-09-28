import './expenses-type-roles.css';
import './table-heading-roles.css';
import './expense-row-actions.css';
import './finance-brand.css';
import { useEffect, useState } from "react";
import { X, Ellipsis } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { fetchData, postData, putData, deleteData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Loader } from '@/components/Loader';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';

interface Expense {
  id: number;
  expense_number?: string;
  category: string;
  description: string;
  // The API serialises decimals as strings ("1480.50"); always read via amountOf().
  amount: number | string;
  date: string;
  expense_date?: string;
  vehicle?: number | null;
  vehicle_info?: string;
  vehicle_registration?: string;
  vendor?: string;
  receipt_number?: string;
  notes?: string;
  status?: string;
}

interface Vehicle {
  id: number;
  plate?: string;
  registration?: string;
  vehicle_number?: string;
}

const amountOf = (e: Pick<Expense, 'amount'>) => {
  const n = parseFloat(String(e.amount ?? 0));
  return isNaN(n) ? 0 : n;
};

// Sentence-case a status/token for display: "DRIVER_COST" → "Driver cost".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

// Filter / display categories. DRIVER is a legacy value still present in
// stored data; new expenses use the API's DRIVER_COST choice.
const CATS = [
  { value: 'All', label: 'All categories' },
  { value: 'FUEL', label: 'Fuel' },
  { value: 'TOLLS', label: 'Tolls' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DRIVER_COST', label: 'Driver cost' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'OTHER', label: 'Other' },
];
// Choices accepted by POST/PUT /api/v1/expenses/.
const FORM_CATS = CATS.filter(c => c.value !== 'All' && c.value !== 'DRIVER');
const catLabel = (v: string) => CATS.find(c => c.value === v)?.label ?? formatStatus(v);

const DATE_FILTERS = [
  { value: 'all', label: 'All dates' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];
const STATUS_TONE: Record<string, string> = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' };
const CHART_COLORS = ['var(--accent-primary)', 'var(--status-warning)', 'var(--status-danger)', '#22C55E', 'var(--text-tertiary)', '#A78BFA', '#14B8A6', '#F472B6'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const expenseDate = (e: Expense) => new Date(e.expense_date || e.date);

export default function Expenses() {
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ["expenses-page"],
    queryFn: async () => {
      const [expData, vehData] = await Promise.all([
        fetchData('api/v1/expenses/'),
        // A vehicles failure must not hide the expenses list.
        fetchData('api/v1/vehicles/').catch(() => []),
      ]);
      return {
        expenses: (Array.isArray(expData) ? expData : (expData?.results || [])) as Expense[],
        vehicles: (Array.isArray(vehData) ? vehData : (vehData?.results || [])) as Vehicle[],
      };
    },
  });

  const expenses = data?.expenses ?? [];
  const vehicles = data?.vehicles ?? [];

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);
  const perPage = 10;

  useEffect(() => {
    document.title = "Expenses - TruckWys";
  }, []);

  // Live-refresh on the auto-refresh tick / focus / live events.
  useAutoRefresh(() => { refetch(); });

  // Calculate date range
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateFilter === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (dateFilter === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (dateFilter === 'custom') {
    startDate = customFrom ? new Date(customFrom) : null;
    endDate = customTo ? new Date(`${customTo}T23:59:59`) : null;
  }

  const vehicleLabel = (e: Expense) => {
    if (!e.vehicle) return '—';
    const v = vehicles.find(x => x.id === e.vehicle);
    return e.vehicle_registration || v?.plate || v?.registration || v?.vehicle_number || e.vehicle_info || '—';
  };

  // Filter expenses
  const q = search.trim().toLowerCase();
  const filtered = expenses.filter(e => {
    const catOk = categoryFilter === 'All' || e.category === categoryFilter;
    const vehOk = vehicleFilter === 'All' || (e.vehicle && e.vehicle.toString() === vehicleFilter);
    const srchOk = !q
      || e.description?.toLowerCase().includes(q)
      || e.vendor?.toLowerCase().includes(q)
      || e.expense_number?.toLowerCase().includes(q);
    const statOk = statusFilter === 'ALL' || (e.status || 'PENDING').toUpperCase() === statusFilter;

    let dateOk = true;
    if (startDate || endDate) {
      const eDate = expenseDate(e);
      dateOk = (!startDate || eDate >= startDate) && (!endDate || eDate <= endDate);
    }

    return catOk && vehOk && srchOk && statOk && dateOk;
  });

  // Sort by date desc
  const sorted = [...filtered].sort((a, b) => expenseDate(b).getTime() - expenseDate(a).getTime());

  // Category totals across all expenses
  const allCategoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + amountOf(e);
    return acc;
  }, {} as Record<string, number>);

  const categoryBreakdown = Object.entries(allCategoryTotals)
    .map(([category, total]) => ({ category, label: catLabel(category), total }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalPages = Math.ceil(sorted.length / perPage);
  const rows = sorted.slice((page - 1) * perPage, page * perPage);

  const handleDelete = (exp: Expense) => {
    setConfirmOpts({
      title: 'Delete expense',
      message: `Delete ${exp.expense_number || 'this expense'}${exp.description ? ` (${exp.description})` : ''}? This cannot be undone.`,
      confirmLabel: 'Delete expense',
      danger: true,
      onConfirm: async () => {
        setConfirmOpts(null);
        setDeletingId(exp.id);
        try {
          await deleteData({ url: `/api/v1/expenses/${exp.id}/` });
          toast.success('Expense deleted');
          refetch();
        } catch {
          toast.error('Could not delete the expense. Try again.');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleReview = async (exp: Expense, action: 'approve' | 'reject') => {
    setReviewingId(exp.id);
    try {
      await postData({ url: `/api/v1/expenses/${exp.id}/${action}/` });
      toast.success(action === 'approve' ? 'Expense approved' : 'Expense rejected');
      refetch();
    } catch {
      toast.error(`Could not ${action} the expense. Try again.`);
    } finally {
      setReviewingId(null);
    }
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

  const header = (
    <SectionHeader
      eyebrow="Finance"
      title="Finance"
      tabs={FINANCE_TABS}
      actions={
        <>
          <button className="btn-action fin-btn-secondary" onClick={handleExportCSV} disabled={loading}>
            Export CSV
          </button>
          <button className="btn-action" onClick={() => setShowAdd(true)}>Add expense</button>
        </>
      }
    />
  );

  if (loading) {
    return (
      <div className="fin-page expenses-type-roles">
        {header}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Loader size={28} /></div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + amountOf(e), 0);

  // KPIs for the current calendar month
  const thisMonthExpenses = expenses.filter(e => {
    const d = expenseDate(e);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const approvedMtd = thisMonthExpenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + amountOf(e), 0);
  const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
  const pendingAmount = pendingExpenses.reduce((s, e) => s + amountOf(e), 0);
  const fuelMtd = thisMonthExpenses.filter(e => e.category === 'FUEL').reduce((s, e) => s + amountOf(e), 0);
  const mtdCategoryTotals: Record<string, number> = {};
  thisMonthExpenses.forEach(e => { mtdCategoryTotals[e.category] = (mtdCategoryTotals[e.category] || 0) + amountOf(e); });
  const topMtd = Object.entries(mtdCategoryTotals).sort((a, b) => b[1] - a[1])[0];

  const kpis = [
    { label: 'Approved this month', value: formatCurrency(approvedMtd), sub: 'Month to date' },
    {
      label: 'Pending approval',
      value: formatCurrency(pendingAmount),
      sub: `${pendingExpenses.length} ${pendingExpenses.length === 1 ? 'expense' : 'expenses'}`,
      tone: pendingExpenses.length > 0 ? 'fin-text-warning' : '',
    },
    { label: 'Fuel this month', value: formatCurrency(fuelMtd), sub: 'Month to date' },
    {
      label: 'Top category this month',
      value: topMtd ? catLabel(topMtd[0]) : '—',
      sub: topMtd ? formatCurrency(topMtd[1]) : 'No expenses this month',
    },
  ];

  // Monthly trend: the six most recent months that have expenses, oldest first.
  const monthlyTrend = (() => {
    const months = new Map<number, number>();
    expenses.forEach(e => {
      const d = expenseDate(e);
      if (isNaN(d.getTime())) return;
      const key = d.getFullYear() * 12 + d.getMonth();
      months.set(key, (months.get(key) || 0) + amountOf(e));
    });
    return [...months.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-6)
      .map(([key, amt]) => ({ label: `${MONTHS[key % 12]} ${Math.floor(key / 12)}`, amount: amt }));
  })();
  const maxMonthlyAmount = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(m => m.amount), 1) : 1;
  const compactRand = (n: number) => n >= 1000 ? `R${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : formatCurrency(n);

  // Budget vs actual — fixed placeholder targets (no budget API exists yet).
  const budgetData = [
    { category: 'FUEL', budget: 150000, actual: allCategoryTotals['FUEL'] || 0 },
    { category: 'MAINTENANCE', budget: 80000, actual: allCategoryTotals['MAINTENANCE'] || 0 },
    { category: 'TOLLS', budget: 40000, actual: allCategoryTotals['TOLLS'] || 0 },
    { category: 'DRIVER', budget: 60000, actual: allCategoryTotals['DRIVER'] || 0 },
    { category: 'INSURANCE', budget: 50000, actual: allCategoryTotals['INSURANCE'] || 0 },
  ];

  const resetPage = () => setPage(1);

  return (
    <div className="fin-page expenses-type-roles">
      {header}

      {/* KPIs */}
      <div className="fin-kpis">
        {kpis.map(m => (
          <div key={m.label} className="card fin-kpi">
            <span className="fin-kpi__label">{m.label}</span>
            <span className={`fin-kpi__value ${m.tone ?? ''}`}>{m.value}</span>
            <span className="fin-kpi__sub">{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Filters — same toolbar layout as Invoices */}
      <div className="fin-toolbar expenses-filter-bar">
        <input
          type="search"
          className="fin-control fin-control--search"
          placeholder="Search expenses"
          aria-label="Search expenses by description, vendor or reference"
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage(); }}
        />
        <select className="fin-control" aria-label="Category" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); resetPage(); }}>
          {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="fin-control" aria-label="Vehicle" value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); resetPage(); }}>
          <option value="All">All vehicles</option>
          {vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.plate || v.registration || v.vehicle_number}</option>)}
        </select>
        <select className="fin-control" aria-label="Date range" value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage(); }}>
          {DATE_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {dateFilter === 'custom' && (
          <>
            <input type="date" className="fin-control" aria-label="From date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); resetPage(); }} />
            <input type="date" className="fin-control" aria-label="To date" value={customTo} onChange={e => { setCustomTo(e.target.value); resetPage(); }} />
          </>
        )}
        <div className="fin-toolbar__group" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              type="button"
              className="fin-chip-filter"
              aria-pressed={statusFilter === s}
              onClick={() => { setStatusFilter(s); resetPage(); }}
            >
              {s === 'ALL' ? 'All' : formatStatus(s)}
            </button>
          ))}
        </div>
        <span className="fin-toolbar__count">{sorted.length} {sorted.length === 1 ? 'expense' : 'expenses'}</span>
      </div>

      {/* Table */}
      <div className="card fin-table-card fin-section">
        <div className="fin-table-scroll">
          <table className="fin-table table-heading-roles">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vehicle</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th className="actions"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="is-empty">
                  <td colSpan={8} style={{ padding: 0 }}>
                    {isError ? (
                      <div className="fin-empty">
                        <p className="fin-empty__title">Couldn’t load expenses</p>
                        <p className="fin-empty__body">Check your connection and try again.</p>
                        <button className="btn-action" onClick={() => refetch()}>Retry loading</button>
                      </div>
                    ) : expenses.length === 0 ? (
                      <div className="fin-empty">
                        <p className="fin-empty__title">No expenses yet</p>
                        <p className="fin-empty__body">Add your first expense to track costs.</p>
                        <button className="btn-action" onClick={() => setShowAdd(true)}>Add expense</button>
                      </div>
                    ) : (
                      <div className="fin-empty fin-empty--compact">No expenses match your filters</div>
                    )}
                  </td>
                </tr>
              ) : rows.map(exp => {
                const status = (exp.status || 'PENDING').toUpperCase();
                const tone = STATUS_TONE[status];
                const busy = reviewingId === exp.id || deletingId === exp.id;
                return (
                  <tr key={exp.id}>
                    <td className="fin-date">{formatDate(exp.expense_date || exp.date)}</td>
                    <td>{exp.expense_number ? <span className="fin-id">{exp.expense_number}</span> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{catLabel(exp.category)}</td>
                    <td className="fin-strong"><div className="fin-truncate" title={exp.description}>{exp.description}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{vehicleLabel(exp)}</td>
                    <td className="num">{formatCurrency(amountOf(exp))}</td>
                    <td><span className={`fin-chip${tone ? ` fin-chip--${tone}` : ''}`}>{formatStatus(status)}</span></td>
                    <td className="actions" onKeyDown={e => { if (e.key === 'Escape') setOpenMenuId(null); }}>
                      <div className="expense-row-actions">
                        <button
                          type="button"
                          className="expense-menu-trigger"
                          aria-label={`Expense actions for ${exp.expense_number || exp.description || exp.id}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === exp.id}
                          disabled={busy}
                          onClick={() => setOpenMenuId(openMenuId === exp.id ? null : exp.id)}
                        >
                          {busy ? <Loader size={14} /> : <Ellipsis size={16} aria-hidden="true" />}
                        </button>
                        {openMenuId === exp.id && (
                          <>
                            {/* click-away overlay */}
                            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenuId(null)} />
                            <div className="expense-menu" role="menu">
                              {status === 'PENDING' && (
                                <>
                                  <button type="button" role="menuitem" className="expense-menu-item fin-text-success"
                                    onClick={() => { setOpenMenuId(null); handleReview(exp, 'approve'); }}>
                                    Approve
                                  </button>
                                  <button type="button" role="menuitem" className="expense-menu-item fin-text-danger"
                                    onClick={() => { setOpenMenuId(null); handleReview(exp, 'reject'); }}>
                                    Reject
                                  </button>
                                </>
                              )}
                              <button type="button" role="menuitem" className="expense-menu-item"
                                onClick={() => { setOpenMenuId(null); setEditingExpense(exp); }}>
                                Edit
                              </button>
                              <button type="button" role="menuitem" className="expense-menu-item fin-text-danger"
                                onClick={() => { setOpenMenuId(null); handleDelete(exp); }}>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="fin-table-foot">
            <span>{(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of {sorted.length}</span>
            <div className="fin-table-foot__nav">
              <button className="btn-action fin-btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
              <button className="btn-action fin-btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics: monthly trend + category breakdown (all recorded expenses) */}
      <div className="fin-grid-2">
        <div className="card">
          <div className="fin-card-head">
            <h2 className="fin-h2">Monthly expenses</h2>
            <p className="fin-support">Last 6 months with expenses</p>
          </div>
          {monthlyTrend.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No monthly data yet</div>
          ) : (
            <div className="fin-bars" role="list" aria-label="Monthly expense totals">
              {monthlyTrend.map(m => (
                <div key={m.label} className="fin-bars__col" role="listitem" aria-label={`${m.label}: ${formatCurrency(m.amount)}`} title={formatCurrency(m.amount)}>
                  <span className="fin-bars__val" aria-hidden="true">{compactRand(m.amount)}</span>
                  <div className="fin-bars__bar" style={{ height: `${Math.max(2, (m.amount / maxMonthlyAmount) * 140)}px` }} />
                  <span className="fin-bars__lab" aria-hidden="true">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="fin-card-head">
            <h2 className="fin-h2">By category</h2>
            <p className="fin-support">All recorded expenses</p>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No category data yet</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width="96" height="96" viewBox="0 0 200 200" aria-hidden="true" style={{ flex: 'none' }}>
                  {(() => {
                    let cumulative = 0;
                    return categoryBreakdown.map((cat, i) => {
                      const percent = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                      if (percent >= 99.999) {
                        return <circle key={i} cx="100" cy="100" r="90" fill={CHART_COLORS[i % CHART_COLORS.length]} />;
                      }
                      const angle = (percent / 100) * 360;
                      const startAngle = (cumulative / 100) * 360;
                      cumulative += percent;
                      const startRad = (startAngle - 90) * (Math.PI / 180);
                      const endRad = (startAngle + angle - 90) * (Math.PI / 180);
                      const x1 = 100 + 90 * Math.cos(startRad);
                      const y1 = 100 + 90 * Math.sin(startRad);
                      const x2 = 100 + 90 * Math.cos(endRad);
                      const y2 = 100 + 90 * Math.sin(endRad);
                      const largeArc = angle > 180 ? 1 : 0;
                      return (
                        <path key={i} d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      );
                    });
                  })()}
                  <circle cx="100" cy="100" r="54" fill="var(--bg-surface)" />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div className="fin-kpi__label">Total expenses</div>
                  <div className="fin-kpi__value">{formatCurrency(totalExpenses)}</div>
                </div>
              </div>
              <div className="fin-legend">
                {categoryBreakdown.map((cat, i) => (
                  <div key={cat.category} className="fin-legend__row">
                    <span className="fin-legend__dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="fin-legend__name">{cat.label}</span>
                    <span className="fin-legend__amt">{formatCurrency(cat.total)}</span>
                    <span className="fin-legend__pct">{totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget vs actual */}
      <div className="card fin-section">
        <div className="fin-card-head">
          <h2 className="fin-h2">Budget vs actual</h2>
          <p className="fin-support">Targets are fixed placeholders, not budgets you have set.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {budgetData.map(item => {
            const percentUsed = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
            const isOverBudget = percentUsed > 100;
            const toneClass = isOverBudget ? 'fin-text-danger' : percentUsed > 80 ? 'fin-text-warning' : '';
            return (
              <div key={item.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{catLabel(item.category)}</span>
                  <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    <span className={toneClass} style={{ color: toneClass ? undefined : 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(item.actual)}</span>
                    {' '}of {formatCurrency(item.budget)} ·{' '}
                    <span className={toneClass}>{percentUsed.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="fin-meter" role="presentation">
                  <div className="fin-meter__fill" style={{
                    width: `${Math.min(percentUsed, 100)}%`,
                    background: isOverBudget ? 'var(--status-danger)' : percentUsed > 80 ? 'var(--status-warning)' : 'var(--accent-primary)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {showAdd && <ExpenseModal vehicles={vehicles} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refetch(); }} />}
      {editingExpense && <ExpenseModal expense={editingExpense} vehicles={vehicles} onClose={() => setEditingExpense(null)} onSaved={() => { setEditingExpense(null); refetch(); }} />}

      {confirmOpts && (
        <ConfirmModal
          title={confirmOpts.title}
          message={confirmOpts.message}
          confirmLabel={confirmOpts.confirmLabel}
          danger={confirmOpts.danger}
          onConfirm={confirmOpts.onConfirm}
          onCancel={() => setConfirmOpts(null)}
        />
      )}
    </div>
  );
}

// Fuel details are stored as a prefix on notes: "Fuel: 120L @ R 23,50/L".
const FUEL_NOTE = /^Fuel: ([\d.,]+)L @ R\s?([\d\s., ]+)\/L\n?/;
const parseLocaleNumber = (s: string) => s.replace(/[\s ]/g, '').replace(',', '.');

function ExpenseModal({ expense, vehicles, onClose, onSaved }: { expense?: Expense; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const fuelMatch = expense?.category === 'FUEL' && expense.notes ? expense.notes.match(FUEL_NOTE) : null;
  const [category, setCategory] = useState(expense?.category || 'FUEL');
  const [amount, setAmount] = useState(expense ? String(amountOf(expense)) : '');
  const [date, setDate] = useState(expense?.expense_date || expense?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(expense?.description || '');
  const [vehicleId, setVehicleId] = useState(expense?.vehicle ? String(expense.vehicle) : '');
  const [vendor, setVendor] = useState(expense?.vendor || '');
  const [receiptNumber, setReceiptNumber] = useState(expense?.receipt_number || '');
  const [notes, setNotes] = useState(expense?.notes ? expense.notes.replace(FUEL_NOTE, '') : '');
  const [litres, setLitres] = useState(fuelMatch ? parseLocaleNumber(fuelMatch[1]) : '');
  const [pricePerLitre, setPricePerLitre] = useState(fuelMatch ? parseLocaleNumber(fuelMatch[2]) : '');
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape (unless a save is in flight).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, submitting]);

  const isFuel = category === 'FUEL';
  const fuelComputed = isFuel && !!litres && !!pricePerLitre;

  const updateFuel = (l: string, p: string) => {
    const lv = parseFloat(l) || 0;
    const pv = parseFloat(p) || 0;
    if (lv > 0 && pv > 0) setAmount((lv * pv).toFixed(2));
  };

  // Current category may be a legacy value not offered for new expenses.
  const categoryOptions = expense && !FORM_CATS.some(c => c.value === expense.category)
    ? [...FORM_CATS, { value: expense.category, label: catLabel(expense.category) }]
    : FORM_CATS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const data: Record<string, unknown> = {
      category,
      amount: parseFloat(amount),
      expense_date: date,
      description,
      vehicle: vehicleId ? parseInt(vehicleId) : null,
    };
    // Optional text fields: send when filled, or when clearing a stored value.
    if (vendor || expense?.vendor) data.vendor = vendor;
    if (receiptNumber || expense?.receipt_number) data.receipt_number = receiptNumber;
    let fullNotes = notes;
    if (fuelComputed) {
      fullNotes = `Fuel: ${litres}L @ ${formatCurrency(parseFloat(pricePerLitre))}/L${notes ? '\n' + notes : ''}`;
    }
    if (fullNotes || expense?.notes) data.notes = fullNotes;

    try {
      if (expense) {
        await putData({ url: `api/v1/expenses/${expense.id}/`, data });
        toast.success('Expense updated');
      } else {
        // expense_number is auto-generated server-side
        await postData({ url: 'api/v1/expenses/', data });
        toast.success('Expense added');
      }
      onSaved();
    } catch {
      toast.error('Could not save the expense. Check the fields and try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fin-dialog-backdrop fin-page" role="presentation">
      <div className="fin-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-dialog-title">
        <div className="fin-dialog__head">
          <h2 id="expense-dialog-title" className="fin-dialog__title">{expense ? 'Edit expense' : 'Add expense'}</h2>
          <button type="button" className="fin-dialog__close" onClick={onClose} aria-label="Close" disabled={submitting}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="fin-form">
          <div>
            <label className="fin-label" id="exp-cat-label">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-labelledby="exp-cat-label">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="fin-label" htmlFor="exp-desc">Description</label>
            <input id="exp-desc" className="fin-control" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Diesel refill, Shell N3" required />
          </div>
          {isFuel && (
            <div className="fin-form__row">
              <div>
                <label className="fin-label" htmlFor="exp-litres">Litres</label>
                <input id="exp-litres" className="fin-control" type="number" step="0.01" inputMode="decimal" value={litres} placeholder="0.00"
                  onChange={e => { setLitres(e.target.value); updateFuel(e.target.value, pricePerLitre); }} />
              </div>
              <div>
                <label className="fin-label" htmlFor="exp-ppl">Price per litre (ZAR)</label>
                <input id="exp-ppl" className="fin-control" type="number" step="0.01" inputMode="decimal" value={pricePerLitre} placeholder="0.00"
                  onChange={e => { setPricePerLitre(e.target.value); updateFuel(litres, e.target.value); }} />
              </div>
            </div>
          )}
          <div className="fin-form__row">
            <div>
              <label className="fin-label" htmlFor="exp-amount">Amount (ZAR)</label>
              <input id="exp-amount" className="fin-control" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount}
                onChange={e => setAmount(e.target.value)} readOnly={fuelComputed} required aria-describedby={fuelComputed ? 'exp-amount-help' : undefined}
                style={{ fontVariantNumeric: 'tabular-nums' }} />
              {fuelComputed && <p id="exp-amount-help" className="fin-help">Calculated from litres × price per litre.</p>}
            </div>
            <div>
              <label className="fin-label">Date</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
          <div className="fin-form__row">
            <div>
              <label className="fin-label" id="exp-veh-label">Vehicle (optional)</label>
              <Select value={vehicleId || "none"} onValueChange={v => setVehicleId(v === "none" ? "" : v)}>
                <SelectTrigger aria-labelledby="exp-veh-label">
                  <SelectValue placeholder="No vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vehicle</SelectItem>
                  {/* Keep the stored vehicle selectable even when it isn't in the loaded vehicle page. */}
                  {expense?.vehicle && !vehicles.some(v => v.id === expense.vehicle) && (
                    <SelectItem value={String(expense.vehicle)}>{expense.vehicle_registration || expense.vehicle_info || `Vehicle ${expense.vehicle}`}</SelectItem>
                  )}
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.plate || v.registration || v.vehicle_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="fin-label" htmlFor="exp-vendor">Vendor (optional)</label>
              <input id="exp-vendor" className="fin-control" type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. Shell, Engen" />
            </div>
          </div>
          <div>
            <label className="fin-label" htmlFor="exp-receipt">Receipt number (optional)</label>
            <input id="exp-receipt" className="fin-control" type="text" value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} />
          </div>
          <div>
            <label className="fin-label" htmlFor="exp-notes">Notes (optional)</label>
            <textarea id="exp-notes" className="fin-control" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="fin-dialog__foot">
            <button className="btn-action fin-btn-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" disabled={submitting || !category || !description || !amount || !date} className="btn-action">
              {submitting ? (expense ? 'Saving…' : 'Adding…') : (expense ? 'Save changes' : 'Add expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
