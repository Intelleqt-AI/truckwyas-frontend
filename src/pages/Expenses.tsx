import './expenses-type-roles.css';
import { localDateISO } from '@/lib/dates';
import './table-heading-roles.css';
import './finance-brand.css';
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { postData, putData, deleteData } from '@/lib/Api';
import { fetchAllPages } from '@/components/insights/findings';
import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import { KpiStats } from '@/components/ui/KpiTile';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCompact, formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import RowActions from '@/components/ui/RowActions';
import { InfoTip } from '@/components/ui/InfoTip';
import { wholeRand } from '@/components/finance/FinTile';
import { Segmented } from '@/components/ui/Segmented';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A toolbar filter on the shared select. `short` is the phone label shown
 *  while the filter is at its "all" value, so three filters fit one row. */
function FilterSelect({ label, value, onChange, options, short, allValue }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; short: string; allValue: string;
}) {
  const current = options.find(o => o.value === value) ?? options[0];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={`fin-filter${value !== allValue ? ' is-set' : ''}`} style={{ width: 'auto', padding: '0 10px 0 12px', fontSize: 13 }}>
        <SelectValue>
          {value === allValue
            ? <><span className="fin-filter__long">{current?.label}</span><span className="fin-filter__short">{short}</span></>
            : <span className="fin-filter__val">{current?.label}</span>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const expenseDate = (e: Expense) => new Date(e.expense_date || e.date);

export default function Expenses() {
  // Every expense (all pages), so tiles, charts and counts agree with the
  // P&L and Insights, never "the latest 20". Vehicles too (filter options).
  const expensesQuery = useQuery({
    queryKey: ["expenses-page"],
    queryFn: async () => {
      const [exp, veh] = await Promise.all([
        fetchAllPages<Expense>('api/v1/expenses/'),
        // A vehicles failure must not hide the expenses list.
        fetchAllPages<Vehicle>('api/v1/vehicles/').catch(() => ({ rows: [] as Vehicle[], count: 0, complete: true })),
      ]);
      return { expenses: exp.rows, total: exp.count, complete: exp.complete, vehicles: veh.rows };
    },
  });
  const { data, isError, refetch } = expensesQuery;
  // Failed (or failing and retrying) with nothing to show: say so, never R 0 figures.
  const failed = loadFailed(expensesQuery);
  const loading = expensesQuery.isLoading && !failed;

  const expenses = data?.expenses ?? [];
  const totalExpenseCount: number = data?.total ?? expenses.length;
  // Only false past 50 pages (1 000 expenses): then the figures say so.
  const complete = data?.complete ?? true;
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

  const resetPage = () => setPage(1);

  const header = (
    <SectionHeader
      eyebrow="Finance"
      title="Finance"
      tabs={FINANCE_TABS}
      actions={
        <>
          <button type="button" className="tw-btn" onClick={handleExportCSV} disabled={loading}>
            Export CSV
          </button>
          <button type="button" className="tw-btn tw-btn--primary" onClick={() => setShowAdd(true)}>Add expense</button>
        </>
      }
    />
  );

  // The toolbar renders at once (also while loading) so nothing below the
  // overview moves when the data arrives.
  const statusCount = (s: string) => (loading ? undefined : expenses.filter(e => s === 'ALL' || (e.status || 'PENDING').toUpperCase() === s).length);
  const toolbar = (
    <Toolbar
      className="fin-toolbar exp-toolbar"
      aria-label="Filter expenses"
      meta={loading ? ' ' : (
        <>
          {sorted.length} {sorted.length === 1 ? 'expense' : 'expenses'}
          {!complete && ` · first ${expenses.length} of ${totalExpenseCount}`}
        </>
      )}
    >
      <SearchInput
        wrapClassName="exp-search"
        placeholder="Search expenses"
        aria-label="Search expenses by description, vendor or reference"
        value={search}
        onChange={e => { setSearch(e.target.value); resetPage(); }}
      />
      <div className="exp-filters">
        <FilterSelect label="Category" short="Category" allValue="All" value={categoryFilter}
          onChange={v => { setCategoryFilter(v); resetPage(); }} options={CATS} />
        <FilterSelect label="Vehicle" short="Vehicle" allValue="All" value={vehicleFilter}
          onChange={v => { setVehicleFilter(v); resetPage(); }}
          options={[{ value: 'All', label: 'All vehicles' }, ...vehicles.map(v => ({ value: String(v.id), label: String(v.plate || v.registration || v.vehicle_number || `Vehicle ${v.id}`) }))]} />
        <FilterSelect label="Date range" short="Dates" allValue="all" value={dateFilter}
          onChange={v => { setDateFilter(v); resetPage(); }} options={DATE_FILTERS} />
      </div>
      {dateFilter === 'custom' && (
        <>
          <input type="date" className="fin-control tw-input" aria-label="From date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); resetPage(); }} />
          <input type="date" className="fin-control tw-input" aria-label="To date" value={customTo} onChange={e => { setCustomTo(e.target.value); resetPage(); }} />
        </>
      )}
      <Segmented
        label="Filter by status"
        className="fin-seg"
        value={statusFilter}
        onChange={s => { setStatusFilter(s); resetPage(); }}
        options={STATUS_FILTERS.map(s => ({
          value: s,
          label: s === 'ALL' ? 'All' : formatStatus(s),
          count: statusCount(s),
        }))}
      />
    </Toolbar>
  );

  if (failed) {
    return (
      <div className="fin-page expenses-type-roles">
        {header}
        <LoadError
          what="expenses"
          error={expensesQuery.error ?? expensesQuery.failureReason}
          busy={expensesQuery.isFetching}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (loading) {
    // Same boxes, same heights as the loaded page (no layout shift).
    return (
      <div className="fin-page expenses-type-roles exp-page">
        {header}
        <div className="exp-overview" aria-busy="true" aria-label="Loading expenses">
          <div className="tw-card exp-summary fin-skel-tile" aria-hidden="true" />
          <div className="card exp-cat fin-skel-tile" aria-hidden="true" />
          <div className="card exp-month fin-skel-tile" aria-hidden="true" />
        </div>
        {toolbar}
        <div key="table-skel" className="fin-skel fin-skel--card exp-table-skel" aria-hidden="true" />
      </div>
    );
  }

  // Money that counts as spend: approved and pending (rejected is not spend).
  const isRejected = (e: Expense) => (e.status || '').toUpperCase() === 'REJECTED';
  const spend = expenses.filter(e => !isRejected(e));
  const spendTotal = spend.reduce((sum, e) => sum + amountOf(e), 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  // Calendar months by expense date.
  const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const nowKey = monthKey(now);
  const monthLong = (key: number) => MONTH_NAMES[((key % 12) + 12) % 12];
  const monthShort = (key: number) => MONTHS[((key % 12) + 12) % 12];
  const yearOf = (key: number) => Math.floor(key / 12);
  const monthText = (key: number) => `${monthShort(key)} ${yearOf(key)}`;
  const inMonth = (e: Expense, key: number) => monthKey(expenseDate(e)) === key;
  const sumOf = (list: Expense[]) => list.reduce((s, e) => s + amountOf(e), 0);

  // Last 12 months (this month and the 11 before), as in Reports.
  const yearKeys = Array.from({ length: 12 }, (_, i) => nowKey - 11 + i);
  const inYear = (e: Expense) => { const k = monthKey(expenseDate(e)); return k >= yearKeys[0] && k <= nowKey; };
  const approvedYear = expenses.filter(e => (e.status || '').toUpperCase() === 'APPROVED' && inYear(e));
  const pendingExpenses = expenses.filter(e => (e.status || 'PENDING').toUpperCase() === 'PENDING');
  const pendingAmount = sumOf(pendingExpenses);

  // Months with spend inside the 12: leading and trailing empty months are
  // not drawn (inner empty months stay, a real zero), as in Reports.
  const withSpend = yearKeys.filter(k => spend.some(e => inMonth(e, k)));
  const chartKeys = withSpend.length ? yearKeys.slice(yearKeys.indexOf(withSpend[0]), yearKeys.indexOf(withSpend[withSpend.length - 1]) + 1) : [];
  const monthlyTrend = chartKeys.map(key => {
    const list = spend.filter(e => inMonth(e, key));
    return { key, amount: sumOf(list), count: list.length };
  });
  const maxMonthlyAmount = Math.max(1, ...monthlyTrend.map(m => m.amount));
  // Phones label only the highest and the latest month (the others are in
  // each bar's title and name); two neighbours would touch, so the highest wins.
  const labelled = (() => {
    const last = monthlyTrend.length - 1;
    const top = monthlyTrend.reduce((b, m, i) => (m.amount > monthlyTrend[b].amount ? i : b), 0);
    return new Set(last < 0 ? [] : last - top === 1 ? [top] : [top, last]);
  })();
  const latestKey = withSpend[withSpend.length - 1];
  const latestList = latestKey != null ? spend.filter(e => inMonth(e, latestKey)) : [];
  const prevList = latestKey != null ? spend.filter(e => inMonth(e, latestKey - 1)) : [];
  const vsPrev = (() => {
    if (latestKey == null) return null;
    const cur = sumOf(latestList); const prev = sumOf(prevList);
    if (prev === 0) return `None in ${monthLong(latestKey - 1)}`;
    const pct = ((cur - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : '−'}${formatPercent(Math.abs(pct), 0)} vs ${monthLong(latestKey - 1)}`;
  })();

  // Category totals across every expense, approved and pending.
  const byCategory = spend.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + amountOf(e); return acc; }, {} as Record<string, number>);
  const categoryCounts = spend.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, total]) => ({ category, label: catLabel(category), total }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
  // Six rows fit the card; the rest are summed in one line.
  const topCats = categoryBreakdown.length > 6 ? categoryBreakdown.slice(0, 5) : categoryBreakdown;
  const restCats = categoryBreakdown.slice(topCats.length);
  const maxCategory = categoryBreakdown[0]?.total || 1;

  return (
    <div className="fin-page expenses-type-roles exp-page">
      {header}

      {/* Overview: three figures in one card beside where the money goes and
          when, all from every expense. On a phone the charts follow the list. */}
      <div className="exp-overview">
        <KpiStats
          className="exp-summary"
          aria-label="Expense summary"
          items={[
            ...(latestKey != null ? [{
              label: latestKey === nowKey ? `Spent in ${monthLong(latestKey)}` : `Spent in ${monthText(latestKey)}`,
              aside: <InfoTip>{`Approved and pending expenses dated ${monthText(latestKey)}, amounts as entered.${latestKey !== nowKey ? ` Nothing is dated after ${monthText(latestKey)} yet.` : ''}`}</InfoTip>,
              figure: <span title={formatCurrency(sumOf(latestList))}>{wholeRand(sumOf(latestList))}</span>,
              note: vsPrev ?? plural(latestList.length, 'expense'),
            }] : []),
            {
              label: 'Approved, 12 months',
              aside: <InfoTip>{`Approved expenses dated ${monthText(yearKeys[0])} to ${monthText(nowKey)}: the costs in the profit and loss for the same period.`}</InfoTip>,
              figure: <span title={formatCurrency(sumOf(approvedYear))}>{wholeRand(sumOf(approvedYear))}</span>,
              note: plural(approvedYear.length, 'expense'),
            },
            {
              label: 'To approve',
              aside: <InfoTip>Pending expenses, any date, amounts as entered. They are not in the profit and loss until approved.</InfoTip>,
              figure: <span title={formatCurrency(pendingAmount)}>{wholeRand(pendingAmount)}</span>,
              note: pendingExpenses.length === 0 ? 'Nothing waiting' : (
                statusFilter !== 'PENDING'
                  ? <button type="button" className="exp-stat-link" onClick={() => { setStatusFilter('PENDING'); resetPage(); }}>{`Show ${plural(pendingExpenses.length, 'expense')}`}</button>
                  : plural(pendingExpenses.length, 'expense')
              ),
            },
          ]}
        />
        <section className="card exp-cat" aria-labelledby="exp-cat-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="exp-cat-title" className="fin-panel-title fin-panel-title--tip">
                Spend by category
                <InfoTip align="end">{formatCurrency(spendTotal)} across {plural(spend.length, 'expense')}, approved and pending, amounts as entered. Rejected expenses are left out.</InfoTip>
              </h2>
              <p className="fin-panel-desc">All {plural(spend.length, 'expense')}, approved and pending</p>
            </div>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No expenses recorded yet</div>
          ) : (
            <div className="fin-rank" role="list">
              {[...topCats, ...(restCats.length ? [{ category: '__rest', label: `${plural(restCats.length, 'other category', 'other categories')}`, total: restCats.reduce((s, c) => s + c.total, 0) }] : [])].map((cat, i) => {
                const n = cat.category === '__rest' ? restCats.reduce((s, c) => s + (categoryCounts[c.category] || 0), 0) : categoryCounts[cat.category] || 0;
                return (
                  <div key={cat.category} className="fin-rank__row fin-rank__row--compact" role="listitem" aria-label={`${cat.label}: ${formatCurrency(cat.total)}, ${plural(n, 'expense')}`}>
                    <span className="fin-rank__label">{cat.label}</span>
                    <span className="fin-rank__track" aria-hidden="true">
                      <span className={`fin-rank__bar${i === 0 ? ' fin-rank__bar--accent' : ''}`} style={{ display: 'block', width: `${(cat.total / maxCategory) * 100}%` }} />
                    </span>
                    <span className="fin-rank__value" title={formatCurrency(cat.total)}>{wholeRand(cat.total)}</span>
                    <span className="fin-rank__share">{formatPercent(spendTotal > 0 ? (cat.total / spendTotal) * 100 : 0, 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="card exp-month" aria-labelledby="exp-month-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="exp-month-title" className="fin-panel-title fin-panel-title--tip">
                Spend by month
                <InfoTip align="end">
                  Approved and pending expenses per calendar month, by expense date, over the last 12 months.
                  {chartKeys.length > 0 && chartKeys.length < 12 && ` Months before ${monthText(chartKeys[0])} or after ${monthText(chartKeys[chartKeys.length - 1])} have no expenses and are not drawn.`}
                </InfoTip>
              </h2>
              <p className="fin-panel-desc">
                {chartKeys.length
                  ? `${chartKeys.length === 1 ? monthText(chartKeys[0]) : `${monthText(chartKeys[0])} to ${monthText(chartKeys[chartKeys.length - 1])}`}, approved and pending`
                  : 'Last 12 months'}
              </p>
            </div>
          </div>
          {monthlyTrend.length === 0 ? (
            <div className="fin-empty fin-empty--compact">No expenses in the last 12 months</div>
          ) : (
            <div className="fin-months" role="list" aria-label="Expenses per month">
              {monthlyTrend.map((m, i) => (
                <div
                  key={m.key}
                  className={`fin-months__col${m.key === nowKey ? ' is-current' : ''}${labelled.has(i) ? ' is-labelled' : ''}`}
                  role="listitem"
                  aria-label={`${monthText(m.key)}: ${formatCurrency(m.amount)} across ${plural(m.count, 'expense')}`}
                  title={`${monthText(m.key)} · ${formatCurrency(m.amount)} · ${plural(m.count, 'expense')}`}
                >
                  <span className="fin-months__val" aria-hidden="true">{m.amount > 0 ? formatCompact(m.amount) : 'R 0'}</span>
                  <div className="fin-months__bar" style={{ height: `${Math.max(2, (m.amount / maxMonthlyAmount) * 100)}px` }} />
                  <span className="fin-months__lab" aria-hidden="true">
                    {monthShort(m.key)}
                    {/* The year under the first month and under each January. */}
                    <span className="fin-months__year">{i === 0 || m.key % 12 === 0 ? yearOf(m.key) : ' '}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toolbar}

      {/* Table */}
      <div key="table" className="card fin-table-card fin-table-card--fit fin-section">
        <div className="fin-table-scroll">
          <table className="fin-table fin-table--stack table-heading-roles">
            <thead>
              <tr>
                <th>Date</th>
                <th className="fin-cell-fill">Expense</th>
                <th>Category</th>
                <th className="fin-col-mid">Vehicle</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th className="actions"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="is-empty">
                  <td colSpan={7} style={{ padding: 0 }}>
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
                const busy = reviewingId === exp.id || deletingId === exp.id;
                return (
                  <tr key={exp.id}>
                    <td className="fin-date m-hide">{formatDate(exp.expense_date || exp.date)}</td>
                    <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                      <div className="fin-truncate fin-truncate--fill" title={exp.description}>{exp.description}</div>
                      <span className="fin-cell-sub">
                        <span className="fin-mobile-only">{formatDate(exp.expense_date || exp.date)} · {catLabel(exp.category)}</span>
                        <span className="m-hide-inline">{exp.expense_number ? <span className="fin-id">{exp.expense_number}</span> : 'No reference'}</span>
                      </span>
                    </td>
                    <td className="m-hide" style={{ whiteSpace: 'nowrap' }}>{catLabel(exp.category)}</td>
                    <td className="m-hide fin-col-mid fin-nowrap">{vehicleLabel(exp)}</td>
                    <td className="m-status"><StatusChip status={status} size="sm" /></td>
                    <td className="num m-amount">{formatCurrency(amountOf(exp))}</td>
                    <td className="actions">
                      <RowActions
                        label={`Expense ${exp.expense_number || exp.description || exp.id}`}
                        onEdit={() => setEditingExpense(exp)}
                        items={[
                          ...(status === 'PENDING'
                            ? [
                                { label: 'Approve', onSelect: () => handleReview(exp, 'approve'), disabled: busy },
                                { label: 'Reject', onSelect: () => handleReview(exp, 'reject'), disabled: busy },
                              ]
                            : []),
                          { label: 'Delete', onSelect: () => handleDelete(exp), danger: true, disabled: busy },
                        ]}
                      />
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
              <button type="button" className="tw-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
              <button type="button" className="tw-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            </div>
          </div>
        )}
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
  useFocusTrap(latestModal, true);
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
