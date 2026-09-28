import './expenses-type-roles.css';
import { localDateISO } from '@/lib/dates';
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
      const list = (Array.isArray(expData) ? expData : (expData?.results || [])) as Expense[];
      return {
        expenses: list,
        // Paginated endpoint: `count` is the full total, used to say how much
        // of it this page is based on.
        total: typeof expData?.count === 'number' ? expData.count : list.length,
        vehicles: (Array.isArray(vehData) ? vehData : (vehData?.results || [])) as Vehicle[],
      };
    },
  });

  const expenses = data?.expenses ?? [];
  const totalExpenseCount: number = data?.total ?? expenses.length;
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
    a.download = `expenses-${localDateISO()}.csv`;
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
  const truncated = totalExpenseCount > expenses.length;
  const validDates = expenses.map(expenseDate).filter(d => !isNaN(d.getTime()));
  const oldestLoaded = validDates.length ? new Date(Math.min(...validDates.map(d => d.getTime()))) : null;
  const newestLoaded = validDates.length ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null;

  // Calendar months by expense date.
  const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const nowKey = monthKey(now);
  const monthLong = (key: number) => new Date(Math.floor(key / 12), key % 12, 1).toLocaleString('en-GB', { month: 'long' });
  const inMonth = (e: Expense, key: number) => monthKey(expenseDate(e)) === key;
  const thisMonthExpenses = expenses.filter(e => inMonth(e, nowKey));
  const lastMonthExpenses = expenses.filter(e => inMonth(e, nowKey - 1));
  const sumApproved = (list: Expense[]) => list.filter(e => e.status === 'APPROVED').reduce((s, e) => s + amountOf(e), 0);
  const sumFuel = (list: Expense[]) => list.filter(e => e.category === 'FUEL').reduce((s, e) => s + amountOf(e), 0);
  const approvedMtd = sumApproved(thisMonthExpenses);
  const fuelMtd = sumFuel(thisMonthExpenses);
  const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
  const pendingAmount = pendingExpenses.reduce((s, e) => s + amountOf(e), 0);
  const mtdCategoryTotals: Record<string, number> = {};
  thisMonthExpenses.forEach(e => { mtdCategoryTotals[e.category] = (mtdCategoryTotals[e.category] || 0) + amountOf(e); });
  const topMtd = Object.entries(mtdCategoryTotals).sort((a, b) => b[1] - a[1])[0];
  const mtdTotal = thisMonthExpenses.reduce((s, e) => s + amountOf(e), 0);

  // A previous-month comparison is only honest when last month is fully loaded.
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthCovered = !truncated || (!!oldestLoaded && oldestLoaded < lastMonthStart);
  const vsLastMonth = (current: number, previous: number) => {
    if (!lastMonthCovered) return null;
    const name = monthLong(nowKey - 1);
    if (previous === 0) return current === 0 ? `Same as ${name} (none)` : `None in ${name}`;
    const pct = ((current - previous) / previous) * 100;
    return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs ${name} (${formatCurrency(previous)})`;
  };

  // Last six calendar months, current month last. Months older than the
  // loaded page are marked, not shown as zero.
  const oldestKey = oldestLoaded ? monthKey(oldestLoaded) : nowKey;
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => nowKey - 5 + i).map(key => {
    const amount = expenses.filter(e => inMonth(e, key)).reduce((s, e) => s + amountOf(e), 0);
    const count = expenses.filter(e => inMonth(e, key)).length;
    const state: 'complete' | 'partial' | 'unloaded' =
      !truncated || key > oldestKey ? 'complete' : key === oldestKey ? 'partial' : 'unloaded';
    return { key, label: `${MONTHS[key % 12]} ${String(Math.floor(key / 12)).slice(2)}`, amount, count, state };
  });
  const maxMonthlyAmount = Math.max(1, ...monthlyTrend.map(m => m.amount));
  const compactRand = (n: number) => n >= 1000 ? `R${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : formatCurrency(n);

  const categoryCounts = expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const maxCategory = categoryBreakdown[0]?.total || 1;
  const basisLabel = truncated
    ? `the ${expenses.length} most recent of ${totalExpenseCount} expenses`
    : `all ${expenses.length} recorded ${expenses.length === 1 ? 'expense' : 'expenses'}`;

  const resetPage = () => setPage(1);

  return (
    <div className="fin-page expenses-type-roles">
      {header}

      {/* Headline: this month's spend, or one sentence when there is none */}
      {thisMonthExpenses.length === 0 ? (
        <div className="fin-kpis fin-kpis--3">
          <div className="card fin-kpi fin-kpi--wide">
            <p className="fin-summary__title">No expenses recorded in {monthLong(nowKey)} yet</p>
            <p className="fin-summary__body">
              {newestLoaded
                ? `The most recent expense is dated ${formatDate(newestLoaded)}. Add fuel, tolls and other costs as they happen so margins stay current.`
                : 'Add fuel, tolls and other costs as they happen so margins stay current.'}
            </p>
            <div className="fin-kpi__action">
              <button type="button" className="fin-link" onClick={() => setShowAdd(true)}>Add expense</button>
            </div>
          </div>
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Waiting for approval</span>
            <span className="fin-kpi__value">{pendingExpenses.length > 0 ? formatCurrency(pendingAmount) : 'None'}</span>
            <span className="fin-kpi__sub">
              {pendingExpenses.length > 0
                ? `${pendingExpenses.length} ${pendingExpenses.length === 1 ? 'expense' : 'expenses'}${truncated ? ' in the loaded list' : ''}`
                : 'Every loaded expense has been reviewed'}
            </span>
            {pendingExpenses.length > 0 && (
              <div className="fin-kpi__action">
                <button type="button" className="fin-link" onClick={() => { setStatusFilter('PENDING'); resetPage(); }}>Review pending</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="fin-kpis">
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Approved in {monthLong(nowKey)}</span>
            <span className="fin-kpi__value">{formatCurrency(approvedMtd)}</span>
            <span className="fin-kpi__delta">{vsLastMonth(approvedMtd, sumApproved(lastMonthExpenses)) ?? 'By expense date'}</span>
          </div>
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Waiting for approval</span>
            <span className="fin-kpi__value">{pendingExpenses.length > 0 ? formatCurrency(pendingAmount) : 'None'}</span>
            <span className="fin-kpi__sub">
              {pendingExpenses.length > 0
                ? `${pendingExpenses.length} ${pendingExpenses.length === 1 ? 'expense' : 'expenses'}`
                : 'Every loaded expense has been reviewed'}
            </span>
            {pendingExpenses.length > 0 && (
              <div className="fin-kpi__action">
                <button type="button" className="fin-link" onClick={() => { setStatusFilter('PENDING'); resetPage(); }}>Review pending</button>
              </div>
            )}
          </div>
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Fuel in {monthLong(nowKey)}</span>
            <span className="fin-kpi__value">{formatCurrency(fuelMtd)}</span>
            <span className="fin-kpi__delta">{vsLastMonth(fuelMtd, sumFuel(lastMonthExpenses)) ?? 'All statuses, by expense date'}</span>
          </div>
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Largest cost in {monthLong(nowKey)}</span>
            <span className="fin-kpi__value">{topMtd ? catLabel(topMtd[0]) : '—'}</span>
            <span className="fin-kpi__sub">
              {topMtd ? `${formatCurrency(topMtd[1])}, ${mtdTotal > 0 ? Math.round((topMtd[1] / mtdTotal) * 100) : 0}% of this month` : ''}
            </span>
          </div>
        </div>
      )}

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
      {truncated && (
        <p className="fin-coverage">
          This page holds the {expenses.length} most recent of {totalExpenseCount} expenses. Search, filters, totals and charts
          on this page use these {expenses.length}; Export CSV exports the filtered list.
        </p>
      )}

      {/* Table */}
      <div className="card fin-table-card fin-section">
        <div className="fin-table-scroll">
          <table className="fin-table table-heading-roles">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Category</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th className="num">Amount</th>
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
                    <td className="fin-strong"><div className="fin-truncate" title={exp.description}>{exp.description}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{catLabel(exp.category)}</td>
                    <td><div className="fin-truncate" style={{ maxWidth: 220 }} title={vehicleLabel(exp)}>{vehicleLabel(exp)}</div></td>
                    <td><span className={`fin-chip${tone ? ` fin-chip--${tone}` : ''}`}>{formatStatus(status)}</span></td>
                    <td className="num">{formatCurrency(amountOf(exp))}</td>
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
            <span>{(page - 1) * perPage + 1} to {Math.min(page * perPage, sorted.length)} of {sorted.length}</span>
            <div className="fin-table-foot__nav">
              <button className="btn-action fin-btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
              <button className="btn-action fin-btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics: monthly trend + category ranking */}
      <div className="fin-grid-2">
        <section className="card" aria-labelledby="exp-month-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="exp-month-title" className="fin-panel-title">How has spending moved over six months?</h2>
              <p className="fin-panel-desc">
                Total recorded per calendar month by expense date, all statuses, amounts as entered.
                {monthlyTrend.some(m => m.state !== 'complete') && ' Faded months are only partly loaded on this page.'}
              </p>
            </div>
          </div>
          {expenses.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No expenses recorded yet</div>
          ) : (
            <div className="fin-months" role="list" aria-label="Expenses per month">
              {monthlyTrend.map(m => (
                <div
                  key={m.key}
                  className={`fin-months__col${m.key === nowKey ? ' is-current' : ''}${m.state !== 'complete' ? ' is-partial' : ''}`}
                  role="listitem"
                  aria-label={`${m.label}: ${m.state === 'unloaded' ? 'not loaded' : `${formatCurrency(m.amount)} across ${m.count} ${m.count === 1 ? 'expense' : 'expenses'}${m.state === 'partial' ? ', partly loaded' : ''}`}`}
                  title={m.state === 'unloaded' ? 'Not loaded on this page' : `${formatCurrency(m.amount)} · ${m.count} ${m.count === 1 ? 'expense' : 'expenses'}`}
                >
                  <span className="fin-months__val" aria-hidden="true">
                    {m.state === 'unloaded' ? '—' : m.amount > 0 ? compactRand(m.amount) : 'R0'}
                  </span>
                  {m.state !== 'unloaded' && (
                    <div className="fin-months__bar" style={{ height: `${Math.max(2, (m.amount / maxMonthlyAmount) * 120)}px` }} />
                  )}
                  <span className="fin-months__lab" aria-hidden="true">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="exp-cat-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="exp-cat-title" className="fin-panel-title">Where does the money go?</h2>
              <p className="fin-panel-desc">
                {formatCurrency(totalExpenses)} across {basisLabel}, all statuses, by category.
              </p>
            </div>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No expenses recorded yet</div>
          ) : (
            <div className="fin-rank" role="list">
              {categoryBreakdown.map((cat, i) => (
                <div key={cat.category} className="fin-rank__row fin-rank__row--compact" role="listitem">
                  <span className="fin-rank__label">
                    {cat.label}
                    <small>{categoryCounts[cat.category] || 0} {(categoryCounts[cat.category] || 0) === 1 ? 'expense' : 'expenses'}</small>
                  </span>
                  <span className="fin-rank__track" aria-hidden="true">
                    <span className={`fin-rank__bar${i === 0 ? ' fin-rank__bar--accent' : ''}`} style={{ display: 'block', width: `${(cat.total / maxCategory) * 100}%` }} />
                  </span>
                  <span className="fin-rank__value">{formatCurrency(cat.total)}</span>
                  <span className="fin-rank__share">{totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
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
  const [date, setDate] = useState(expense?.expense_date || expense?.date || localDateISO());
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
