import './insights-page-brand.css';
import { localDateISO } from '@/lib/dates';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency as formatCurrencyBase } from '@/lib/formatters';
import { DatePicker } from '@/components/ui/date-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Loader } from '@/components/Loader';
import ExecutiveBriefing, { RecommendationGroups, formatDay, type BriefingResponse, type RecommendationDetail } from '@/components/insights/ExecutiveBriefing';
import InsightCard from '@/components/insights/InsightCard';
import KpiTile from '@/components/insights/KpiTile';
import RankedList, { type RankedRow } from '@/components/insights/RankedList';

/* Insights page. Presentation only: every API call, query key and calculation
   below is unchanged from the previous version. Where the API returns decimal
   strings, values are coerced with Number() so sums are numeric, not
   concatenated text. Each panel states its basis in its description. */

// Missing or non-numeric amounts render as the unavailable placeholder, never as
// a fabricated R 0,00. Valid numbers use the shared formatter unchanged.
const formatCurrency = (amount: number | string | null | undefined, options?: Intl.NumberFormatOptions) =>
  amount == null || amount === '' || !Number.isFinite(Number(amount)) ? '—' : formatCurrencyBase(Number(amount), options);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const tripsLabel = (n: number) => plural(n, 'trip', 'trips');
/** Minimum sample before a lane, cargo type, band or driver is ranked. */
const MIN_TRIPS = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] || ym;
const routeText = (route: string) => route.replace(' → ', ' to ');
// Display only: drop trailing punctuation left by the two-word cargo grouping ("Chemicals -").
const cargoText = (s: string) => s.replace(/[\s&\-–:,/]+$/, '') || s;
const shortMoney = (v: number) => {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}R ${(a / 1_000_000).toFixed(1)}m`;
  if (a >= 1_000) return `${sign}R ${(a / 1_000).toFixed(0)}k`;
  return `${sign}R ${a.toFixed(0)}`;
};
/** Names the sample behind a panel. The list endpoints return one page (20
 *  rows today), so say so when there are more records than were loaded. */
const sampleText = (shown: number, total: number | undefined, noun: string, recent = false) =>
  total != null && total > shown
    ? recent ? `your ${shown} most recent ${noun} (of ${total})` : `${shown} of your ${total} ${noun}`
    : `all ${shown} ${noun}`;

// Chart series tokens (page-scoped in insights-page-brand.css).
const SERIES_ACCENT = 'var(--accent-primary)';
const SERIES_NEUTRAL = 'var(--ins-series-neutral)';
const SERIES_DANGER = 'var(--status-danger)';
const axisTick = { fontFamily: 'var(--font-sans)', fontSize: 13, fill: 'var(--text-secondary)' };
const tooltipStyle = {
  contentStyle: { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', boxShadow: 'none' },
  labelStyle: { color: 'var(--text-secondary)', marginBottom: 4 },
  itemStyle: { color: 'var(--text-primary)', padding: 0 },
  cursor: { fill: 'var(--bg-surface-hover)' },
};

function Stack({ children }: { children: ReactNode }) {
  return <div className="insights-stack">{children}</div>;
}
// ========== TYPES ==========

interface KPIData {
  revenue_mtd: number;
  revenue_prev_month: number;
  revenue_change_pct: number;
  net_margin_pct: number;
  outstanding_invoices: number;
  overdue_invoices: number;
  dso: number;
  active_vehicles: number;
  fleet_utilization_pct: number;
  advances_this_month: number;
  total_advance_amount: number;
}

interface Recommendation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  customer_name?: string;
  amount?: number;
  days_overdue?: number;
  dso?: number;
  link?: string;
}

interface InsightsData {
  recommendations: Recommendation[];
}

interface TopCustomer {
  customer_id: number;
  customer_name: string;
  revenue: number;
  invoice_count: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  margin: number;
}

interface CashFlowForecast {
  next_30_days: number;
  next_60_days: number;
  next_90_days: number;
}

interface FinanceData {
  revenue_period: number;
  expenses_period: number;
  net_margin_period: number;
  net_margin_percent_period: number;
  revenue_ytd: number;
  total_revenue: number;
  total_expenses: number;
  dso: number;
  fuel_cost_ratio: number;
  outstanding_invoices_total: number;
  overdue_invoices_total: number;
  top_customers: TopCustomer[];
  monthly_trend: MonthlyTrend[];
  cash_flow_forecast: CashFlowForecast;
}

interface CashFlowPeriod {
  period: string;
  start_date: string;
  end_date: string;
  expected_in: number;
  expected_out: number;
  net: number;
}

interface CashFlowData {
  forecast: CashFlowPeriod[];
}

interface Load {
  id: number;
  load_number: string;
  pickup_city: string;
  delivery_city: string;
  total_amount: number;
  status: string;
  distance: number;
  weight: number;
  driver_name: string;
  vehicle_info: string;
  cargo_description: string;
  fuel_surcharge: number;
  rate: number;
  created_at: string;
  pickup_date: string;
}

interface Invoice {
  id: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  due_date: string;
  issue_date: string;
  early_pay_eligible: boolean;
}

interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  vehicle_info: string;
  driver_name: string;
}

interface Driver {
  id: number;
  revenue_generated: number;
  total_trips: number;
  avg_revenue_per_trip: number;
  experience_years: number;
  violation_count: number;
  accident_history: number;
  status: string;
  user_details: {
    name: string;
    first_name?: string;
    last_name?: string;
  };
}

interface Vehicle {
  id: number;
  plate: string;
  make: string;
  model: string;
  status: string;
  ai_health_score: number;
  fuel_efficiency_score: number;
  uptime_score: number;
  maintenance_score: number;
  uptime_percentage: number;
  cost_per_km: number;
  margin_per_trip: number;
  mileage: number;
  revenue_generated: number;
}

type TabType = 'briefing' | 'margin' | 'cash' | 'fleet' | 'lanes';
type PeriodType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_6M' | 'LAST_12M' | 'CUSTOM';

const TABS = [
  { id: 'briefing' as TabType, label: 'Briefing' },
  { id: 'margin' as TabType, label: 'Margin engine' },
  { id: 'cash' as TabType, label: 'Cash flow' },
  { id: 'fleet' as TabType, label: 'Fleet' },
  { id: 'lanes' as TabType, label: 'Lanes' },
];

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
  { id: 'LAST_3M', label: 'Last 3M' },
  { id: 'LAST_6M', label: 'Last 6M' },
  { id: 'LAST_12M', label: 'Last 12M' },
  { id: 'CUSTOM', label: 'Custom' },
];

// Sentence-case a raw token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function Insights() {
  const [tab, setTab] = useState<TabType>('briefing');
  const [period, setPeriod] = useState<PeriodType>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // AI executive briefing (LLM when configured, deterministic summary otherwise),
  // grounded in the company's DB via RAG. Period-aware: re-fetches when the filter
  // changes so the narrative matches the selected window. getPeriodParams() is only
  // called inside queryFn (it's declared below), never synchronously in the key.
  // Same endpoint and key as before; failures now surface as an explicit error
  // state with retry instead of silently hiding the briefing.
  const {
    data: briefing = null,
    isLoading: briefingLoading,
    isError: briefingError,
    refetch: refetchBriefing,
  } = useQuery<BriefingResponse | null>({
    queryKey: ['insights-briefing', period, customFrom, customTo],
    queryFn: () => fetchData(`api/v1/dashboard/briefing/?${getPeriodParams()}`),
    retry: 1,
  });

  // Build period params
  const getPeriodParams = (): string => {
    if (period === 'CUSTOM' && customFrom && customTo) {
      return `from=${customFrom}&to=${customTo}`;
    }
    const now = new Date();
    let from = '';
    let to = localDateISO();

    switch (period) {
      case 'THIS_MONTH':
        from = localDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
        break;
      case 'LAST_MONTH':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = localDateISO(lastMonth);
        to = localDateISO(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      case 'LAST_3M':
        from = localDateISO(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
        break;
      case 'LAST_6M':
        from = localDateISO(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
        break;
      case 'LAST_12M':
        from = localDateISO(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
        break;
    }
    return `from=${from}&to=${to}`;
  };

  // Per-tab data, cached per (tab, period, range) combination — revisiting a tab
  // with the same filters serves cache instead of refetching every navigation.
  const { data: tabData, isLoading: loading } = useQuery({
    queryKey: ['insights-tab', tab, period, customFrom, customTo],
    queryFn: async () => {
      const params = getPeriodParams();
      switch (tab) {
        case 'briefing': {
          const [kpi, insights, loadsResp] = await Promise.all([
            fetchData(`api/v1/dashboard/kpi/?${params}`).catch(() => null),
            fetchData('api/v1/dashboard/insights/').catch(() => ({ recommendations: [] })),
            fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
          ]);
          return { kpiData: kpi, insightsData: insights, loads: loadsResp?.results || [], loadsTotal: loadsResp?.count };
        }
        case 'margin': {
          const [finance, loadsData, expensesData] = await Promise.all([
            fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null),
            fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
            fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
          ]);
          return { financeData: finance, loads: loadsData?.results || [], expenses: expensesData?.results || [], loadsTotal: loadsData?.count, expensesTotal: expensesData?.count };
        }
        case 'cash': {
          const [cf, finData, invData] = await Promise.all([
            fetchData('api/v1/dashboard/cashflow/').catch(() => ({ forecast: [] })),
            fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null),
            fetchData('api/v1/invoices/?page_size=100').catch(() => ({ results: [] })),
          ]);
          return { cashflowData: cf, financeData: finData, invoices: invData?.results || [], invoicesTotal: invData?.count };
        }
        case 'fleet': {
          const [veh, drv, exp] = await Promise.all([
            fetchData('api/v1/vehicles/?page_size=50').catch(() => ({ results: [] })),
            fetchData('api/v1/drivers/?page_size=50').catch(() => ({ results: [] })),
            fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
          ]);
          return {
            vehicles: (veh?.results || []).map((v: any) => ({
              ...v,
              uptime_percentage: parseFloat(v.uptime_percentage || '0'),
              cost_per_km: parseFloat(v.cost_per_km || '0'),
              margin_per_trip: parseFloat(v.margin_per_trip || '0'),
              mileage: parseFloat(v.mileage || '0'),
            })),
            drivers: drv?.results || [],
            expenses: exp?.results || [],
            vehiclesTotal: veh?.count,
            driversTotal: drv?.count,
          };
        }
        case 'lanes': {
          const [lds, exps] = await Promise.all([
            fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
            fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
          ]);
          return { loads: lds?.results || [], expenses: exps?.results || [], loadsTotal: lds?.count };
        }
        default:
          return {};
      }
    },
  });

  // Cached data drives the view; defaults keep each tab's first render safe.
  const td = tabData as any;
  const kpiData = (td?.kpiData ?? null) as KPIData | null;
  const insightsData = (td?.insightsData ?? null) as InsightsData | null;
  const financeData = (td?.financeData ?? null) as FinanceData | null;
  const cashflowData = (td?.cashflowData ?? null) as CashFlowData | null;
  const loads = (td?.loads ?? []) as Load[];
  const invoices = (td?.invoices ?? []) as Invoice[];
  const expenses = (td?.expenses ?? []) as Expense[];
  const drivers = (td?.drivers ?? []) as Driver[];
  const vehicles = (td?.vehicles ?? []) as Vehicle[];
  const loadsTotal = td?.loadsTotal as number | undefined;
  const expensesTotal = td?.expensesTotal as number | undefined;
  const invoicesTotal = td?.invoicesTotal as number | undefined;
  const vehiclesTotal = td?.vehiclesTotal as number | undefined;
  const driversTotal = td?.driversTotal as number | undefined;

  // Length of the selected window, for naming the KPI comparison period. Read
  // from the same params the API received, so the label matches the backend.
  const periodDays = (() => {
    const m = /from=(\d{4}-\d{2}-\d{2})&to=(\d{4}-\d{2}-\d{2})/.exec(getPeriodParams());
    if (!m) return null;
    const d = Math.round((Date.parse(m[2]) - Date.parse(m[1])) / 86400000) + 1;
    return d > 0 ? d : null;
  })();
  const notFiltered = 'The period filter does not apply to this panel.';
  const longerPeriod = period !== 'LAST_12M' ? () => setPeriod('LAST_12M') : undefined;

  return (
    <div className="insights-page-brand">
      {/* Header */}
      <div className="insights-header">
        <p className="insights-eyebrow">Intelligence</p>
        <h1 className="insights-title">Insights</h1>
        <p className="insights-intro">What your own records say about revenue, cash, the fleet and your lanes. Each panel states which records it uses.</p>
      </div>

      {/* Period filters */}
      <div className="insights-periods" role="group" aria-label="Period">
        {PERIOD_OPTIONS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className="insights-period-control"
            aria-pressed={period === p.id}
          >
            {p.label}
          </button>
        ))}
        {period === 'CUSTOM' && (
          <>
            <DatePicker
              value={customFrom}
              onChange={setCustomFrom}
              placeholder="From"
              style={{ width: 160, maxWidth: '100%', padding: 0, fontSize: 14, lineHeight: '20px' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: '20px' }}>to</span>
            <DatePicker
              value={customTo}
              onChange={setCustomTo}
              placeholder="To"
              style={{ width: 160, maxWidth: '100%', padding: 0, fontSize: 14, lineHeight: '20px' }}
            />
          </>
        )}
      </div>

      {/* Tab bar */}
      <nav className="insights-tabs" aria-label="Insights sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className="insights-brand-tab"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader size={32} /></div>
      ) : (
        <>
          {/* ============ BRIEFING ============ */}
          {tab === 'briefing' && (
            <Stack>
              <ExecutiveBriefing
                data={briefing}
                isLoading={briefingLoading}
                isError={briefingError}
                onRetry={() => { refetchBriefing(); }}
                details={(insightsData?.recommendations || []) as RecommendationDetail[]}
                onShowLongerPeriod={period === 'THIS_MONTH' || period === 'LAST_MONTH' ? () => setPeriod('LAST_3M') : undefined}
              />

              {/* Revenue trend and collection speed: the two KPI figures the
                  briefing does not already show. Net margin and outstanding
                  are in the briefing; fleet availability is on the Fleet tab;
                  Fast Pay advances are not live, so they are not shown. */}
              {kpiData && (() => {
                const rev = num(kpiData.revenue_mtd);
                const prev = num(kpiData.revenue_prev_month);
                const pct = num(kpiData.revenue_change_pct);
                const dso = num(kpiData.dso);
                const prevWindow = periodDays ? `the previous ${periodDays} days` : 'the previous period';
                // The paid-revenue total itself is the briefing's "Collected"
                // figure, so only its change is shown, and only when there is
                // a previous window to compare with.
                const hasDelta = prev > 0;
                // Nothing measurable: omit the panel rather than show an empty tile.
                if (!hasDelta && dso === 0) return null;
                return (
                  <InsightCard
                    title={hasDelta ? 'Is revenue growing, and how fast do customers pay' : 'How fast do customers pay'}
                    description={hasDelta
                      ? `Revenue is paid invoices including VAT, by payment date, compared with ${prevWindow}. Days to collect is measured over the last 90 days.`
                      : 'Measured over the last 90 days. There were no paid invoices in the window before this period, so revenue growth is not shown.'}
                  >
                    <dl className={hasDelta ? 'ic-kpis ic-kpis--2' : 'ic-kpis'}>
                      {hasDelta && (
                        <KpiTile
                          label="Change in paid revenue"
                          value={`${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                          tone={pct < 0 ? 'danger' : undefined}
                          note={`${formatCurrency(rev)} against ${formatCurrency(prev)} in ${prevWindow}`}
                        />
                      )}
                      <KpiTile
                        label="Days to collect"
                        value={`${Math.round(dso)} days`}
                        empty={dso === 0 ? 'Not measured for the last 90 days.' : undefined}
                        note={dso !== 0 ? 'Average time from invoice to payment' : undefined}
                      />
                    </dl>
                  </InsightCard>
                );
              })()}

              {/* Everything else that needs attention: the full list, minus the
                  items the briefing already shows. */}
              {(() => {
                const all = insightsData?.recommendations || [];
                const shownTitles = new Set((briefing?.metrics?.top_recommendations || []).map(r => r.title));
                const rest = [...all].filter(r => !shownTitles.has(r.title)).sort((a, b) => (b.amount || 0) - (a.amount || 0));
                if (rest.length === 0) return null;
                const restTotal = rest.reduce((s, r) => s + num(r.amount), 0);
                return (
                  <InsightCard
                    title="What else needs attention"
                    description={`${plural(rest.length, 'more item', 'more items')} beyond the briefing above${restTotal > 0 ? `, worth ${formatCurrency(restTotal)} in total` : ''}. Largest amount first.`}
                  >
                    <RecommendationGroups
                      recommendations={rest}
                      details={rest as RecommendationDetail[]}
                      initialRows={5}
                      headingLevel={3}
                    />
                  </InsightCard>
                );
              })()}
            </Stack>
          )}

          {/* ============ MARGIN ENGINE ============ */}
          {tab === 'margin' && (
            <Stack>
              {(() => {
                const f = financeData as (FinanceData & { from_date?: string; to_date?: string }) | null;
                if (!f) {
                  return (
                    <InsightCard title="Did the business make money in this period">
                      <p className="ic-note">The finance summary did not load. Your data is unchanged; choose the period again to retry.</p>
                    </InsightCard>
                  );
                }
                const rev = num(f.revenue_period);
                const cost = num(f.expenses_period);
                const margin = num(f.net_margin_period);
                const range = f.from_date && f.to_date ? `${formatDay(f.from_date)} to ${formatDay(f.to_date)}` : 'the selected period';
                return (
                  <InsightCard
                    title="Did the business make money in this period"
                    description={`${range}. Revenue is paid invoices including VAT, by payment date. Costs are approved expenses, by expense date.`}
                  >
                    {rev === 0 && cost === 0 ? (
                      <div>
                        <p className="ic-note">No invoices were paid and no expenses were approved in this period.</p>
                        {longerPeriod && <button type="button" className="ic-text-button" onClick={longerPeriod}>Show the last 12 months</button>}
                      </div>
                    ) : (
                      <dl className="ic-kpis">
                        <KpiTile label="Revenue" value={formatCurrency(rev)} />
                        <KpiTile label="Approved costs" value={formatCurrency(cost)} note={rev > 0 ? `${((cost / rev) * 100).toFixed(1)}% of revenue` : undefined} />
                        <KpiTile
                          label="Net margin"
                          value={formatCurrency(margin)}
                          tone={margin < 0 ? 'danger' : undefined}
                          note={rev > 0 ? `${num(f.net_margin_percent_period).toFixed(1)}% of revenue${margin < 0 ? ', a loss' : ''}` : margin < 0 ? 'A loss: costs with no paid revenue' : undefined}
                        />
                      </dl>
                    )}
                  </InsightCard>
                );
              })()}

              {financeData?.monthly_trend && financeData.monthly_trend.length > 0 && (() => {
                const trend = [...financeData.monthly_trend].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
                const data = trend.map(m => ({ month: monthName(m.month), revenue: num(m.revenue), expenses: num(m.expenses), margin: num(m.margin) }));
                const last = data[data.length - 1];
                const prev = data[data.length - 2];
                const summary = last && prev
                  ? last.margin === prev.margin
                    ? `Net margin in ${last.month} was ${formatCurrency(last.margin)}, level with ${prev.month}.`
                    : `Net margin in ${last.month} was ${formatCurrency(last.margin)}, ${last.margin > prev.margin ? 'up' : 'down'} from ${formatCurrency(prev.margin)} in ${prev.month}.`
                  : null;
                return (
                  <InsightCard
                    title="How revenue and costs moved over six months"
                    description={`Paid invoices including VAT, by payment date, against approved expenses, by expense date. Calendar months. ${notFiltered}`}
                  >
                    <div className="ic-legend" aria-hidden="true">
                      <span className="ic-legend__item"><span className="ic-legend__swatch" style={{ background: SERIES_ACCENT }} />Revenue</span>
                      <span className="ic-legend__item"><span className="ic-legend__swatch" style={{ background: SERIES_NEUTRAL }} />Approved costs</span>
                    </div>
                    <div aria-hidden="true">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                          <CartesianGrid stroke="var(--border-row)" vertical={false} />
                          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={80} tickFormatter={shortMoney} />
                          <Tooltip
                            {...tooltipStyle}
                            formatter={(value: number, name: string) => [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Approved costs']}
                          />
                          <Bar dataKey="revenue" fill={SERIES_ACCENT} radius={[3, 3, 0, 0]} maxBarSize={28} />
                          <Bar dataKey="expenses" fill={SERIES_NEUTRAL} radius={[3, 3, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <table className="ic-sr">
                      <caption>Revenue, approved costs and net margin by month</caption>
                      <thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Approved costs</th><th scope="col">Net margin</th></tr></thead>
                      <tbody>{data.map(d => <tr key={d.month}><th scope="row">{d.month}</th><td>{formatCurrency(d.revenue)}</td><td>{formatCurrency(d.expenses)}</td><td>{formatCurrency(d.margin)}</td></tr>)}</tbody>
                    </table>
                    <div className="insights-month-margins" aria-hidden="true">
                      <span className="insights-month-margins__label">Net margin</span>
                      {data.map(d => (
                        <div key={d.month} className="insights-month-margin">
                          <span className="insights-month-margin__m">{d.month}</span>
                          <strong className={d.margin < 0 ? 'ic-text--danger' : undefined}>{formatCurrency(d.margin)}</strong>
                        </div>
                      ))}
                    </div>
                    {summary && <p className="ic-foot">{summary}</p>}
                  </InsightCard>
                );
              })()}

              {(() => {
                // Same grouping as before; amounts coerced from decimal strings
                // so the per-category sums are numeric.
                const categoryMap = new Map<string, { amount: number; count: number }>();
                expenses.forEach(exp => {
                  const e = categoryMap.get(exp.category) || { amount: 0, count: 0 };
                  categoryMap.set(exp.category, { amount: e.amount + num(exp.amount), count: e.count + 1 });
                });
                const rows: RankedRow[] = Array.from(categoryMap.entries()).map(([category, d]) => ({
                  id: category,
                  label: titleCase(category),
                  value: d.amount,
                  count: d.count,
                }));
                const total = rows.reduce((s, r) => s + num(r.value), 0);
                return (
                  <InsightCard
                    title="Where does the money go"
                    description={`Expenses by category from ${sampleText(expenses.length, expensesTotal, 'expenses', true)}, pending and approved. ${notFiltered}`}
                  >
                    <RankedList
                      rows={rows}
                      format={v => formatCurrency(v)}
                      formatCount={n => plural(n, 'entry', 'entries')}
                      showShare
                      topN={6}
                      ariaLabel="Expenses by category"
                      empty="No expenses recorded yet."
                    />
                    {rows.length > 0 && <p className="ic-foot">These entries total <strong>{formatCurrency(total)}</strong>.</p>}
                  </InsightCard>
                );
              })()}
            </Stack>
          )}

          {/* ============ CASH FLOW ============ */}
          {tab === 'cash' && (
            <Stack>
              <InsightCard
                title="How much cash should arrive over the next 8 weeks"
                description={`Each unpaid invoice is placed on the date that customer usually pays, less expected costs based on your approved expenses over the last 90 days. Weeks start on Monday. ${notFiltered}`}
              >
                {cashflowData?.forecast && cashflowData.forecast.length > 0 ? (() => {
                  const data = cashflowData.forecast.slice(0, 8).map(f => ({
                    week: formatDay(f.start_date, false) || f.period,
                    net: Math.round(f.net),
                    in: Math.round(f.expected_in),
                    out: Math.round(f.expected_out),
                  }));
                  const runningBalance = data.reduce((sum, d) => sum + d.net, 0);
                  const shortfalls = data.filter(d => d.net < 0).length;
                  const peak = data.reduce((m, d) => (d.net > m.net ? d : m), data[0]);
                  return (
                    <>
                      <div aria-hidden="true">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="30%">
                            <CartesianGrid stroke="var(--border-row)" vertical={false} />
                            <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={shortMoney} />
                            <Tooltip
                              {...tooltipStyle}
                              labelFormatter={(l) => `Week of ${l}`}
                              formatter={(value: number) => [formatCurrency(value), 'Net expected']}
                            />
                            <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
                            <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={40}>
                              {data.map((entry, index) => (
                                <Cell key={index} fill={entry.net < 0 ? SERIES_DANGER : SERIES_ACCENT} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <table className="ic-sr">
                        <caption>Expected cash by week</caption>
                        <thead><tr><th scope="col">Week of</th><th scope="col">Expected in</th><th scope="col">Expected out</th><th scope="col">Net</th></tr></thead>
                        <tbody>{data.map(d => <tr key={d.week}><th scope="row">{d.week}</th><td>{formatCurrency(d.in)}</td><td>{formatCurrency(d.out)}</td><td>{formatCurrency(d.net)}</td></tr>)}</tbody>
                      </table>
                      <dl className="ic-kpis insights-divided">
                        <KpiTile label="Net over 8 weeks" value={formatCurrency(runningBalance)} tone={runningBalance < 0 ? 'danger' : undefined} />
                        <KpiTile
                          label="Weeks with a shortfall"
                          value={`${shortfalls} of ${data.length}`}
                          note={shortfalls > 0 ? <span className="ic-text--danger">Costs expected to exceed receipts</span> : 'Receipts cover expected costs every week'}
                        />
                        <KpiTile label="Largest week" value={formatCurrency(peak?.net)} note={peak ? `Week of ${peak.week}` : undefined} />
                      </dl>
                    </>
                  );
                })() : (
                  <p className="ic-note">No forecast yet. It appears once there are unpaid invoices or recent approved expenses.</p>
                )}
              </InsightCard>

              {(() => {
                const cf = financeData?.cash_flow_forecast;
                const d30 = num(cf?.next_30_days), d60 = num(cf?.next_60_days), d90 = num(cf?.next_90_days);
                return (
                  <InsightCard
                    title="How much falls due in the next 90 days"
                    description="Unpaid balances by invoice due date. Invoices already overdue are not counted here; they appear in who owes you, below."
                  >
                    {!cf ? (
                      <p className="ic-note">The finance summary did not load. Your data is unchanged; choose the period again to retry.</p>
                    ) : d30 === 0 && d60 === 0 && d90 === 0 ? (
                      <p className="ic-note">No unpaid invoice falls due in the next 90 days.</p>
                    ) : (
                      <dl className="ic-kpis">
                        <KpiTile label="Due in the next 30 days" value={formatCurrency(d30)} />
                        <KpiTile label="Due in 31 to 60 days" value={formatCurrency(d60)} />
                        <KpiTile label="Due in 61 to 90 days" value={formatCurrency(d90)} />
                      </dl>
                    )}
                  </InsightCard>
                );
              })()}

              {(() => {
                // Same grouping as before; balances coerced from decimal strings.
                const customerMap = new Map<string, { total_outstanding: number; oldest_days: number; invoice_count: number }>();
                const now = new Date();
                invoices.forEach(inv => {
                  if (inv.status !== 'PAID' && num(inv.balance) > 0) {
                    const issueDate = new Date(inv.issue_date);
                    const daysOld = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
                    const existing = customerMap.get(inv.customer_name) || { total_outstanding: 0, oldest_days: 0, invoice_count: 0 };
                    customerMap.set(inv.customer_name, {
                      total_outstanding: existing.total_outstanding + num(inv.balance),
                      oldest_days: Math.max(existing.oldest_days, daysOld),
                      invoice_count: existing.invoice_count + 1,
                    });
                  }
                });
                const customers = Array.from(customerMap.entries())
                  .map(([name, data]) => ({ customer_name: name, ...data }))
                  .sort((a, b) => b.total_outstanding - a.total_outstanding);
                const rows: RankedRow[] = customers.map(c => {
                  const risk = c.oldest_days > 60 ? 'danger' : c.oldest_days > 30 ? 'warning' : null;
                  return {
                    id: c.customer_name,
                    label: c.customer_name,
                    value: c.total_outstanding,
                    count: c.invoice_count,
                    meta: (
                      <span className={risk === 'danger' ? 'ic-text--danger' : risk === 'warning' ? 'ic-text--warning' : undefined}>
                        Oldest invoice issued {plural(c.oldest_days, 'day', 'days')} ago
                      </span>
                    ),
                  };
                });
                const total = customers.reduce((s, c) => s + c.total_outstanding, 0);
                const top3sum = customers.slice(0, 3).reduce((sum, c) => sum + c.total_outstanding, 0);
                return (
                  <InsightCard
                    title="Who owes you the most"
                    description={`Unpaid balances by customer from ${sampleText(invoices.length, invoicesTotal, 'invoices')}, drafts included. Age is days since the invoice was issued. ${notFiltered}`}
                  >
                    <RankedList
                      rows={rows}
                      format={v => formatCurrency(v)}
                      formatCount={n => plural(n, 'invoice', 'invoices')}
                      showShare
                      topN={8}
                      ariaLabel="Outstanding balance by customer"
                      empty="No customer has an unpaid balance."
                    />
                    {customers.length > 3 && total > 0 && (
                      <p className="ic-foot">
                        Your 3 largest balances add up to <strong>{formatCurrency(top3sum)}</strong>, {((top3sum / total) * 100).toFixed(0)}% of the {formatCurrency(total)} listed.
                      </p>
                    )}
                  </InsightCard>
                );
              })()}
            </Stack>
          )}

          {/* ============ FLEET ============ */}
          {tab === 'fleet' && (
            <Stack>
              {(() => {
                const active = vehicles.filter(v => ['IN_USE', 'AVAILABLE'].includes(v.status.toUpperCase())).length;
                const avgHealth = vehicles.length > 0 ? vehicles.reduce((sum, v) => sum + (v.ai_health_score || 0), 0) / vehicles.length : 0;
                const atRisk = vehicles.filter(v => (v.ai_health_score || 100) < 60).length;
                const avgCostKm = vehicles.length > 0 ? vehicles.reduce((sum, v) => sum + (v.cost_per_km || 0), 0) / vehicles.length : 0;
                const unscored = vehicles.filter(v => !v.ai_health_score).length;
                const noCost = vehicles.filter(v => !v.cost_per_km).length;
                return (
                  <InsightCard
                    title="Is the fleet ready to work"
                    description={`From ${sampleText(vehicles.length, vehiclesTotal, 'vehicles')}. Current status, not filtered by period.`}
                  >
                    {vehicles.length === 0 ? (
                      <p className="ic-note">No vehicles yet. Add vehicles in Fleet to see availability and running costs.</p>
                    ) : (
                      <dl className="ic-kpis ic-kpis--4">
                        <KpiTile label="Available or in use" value={`${active} of ${vehicles.length}`} note={`${vehicles.length - active} in maintenance or other status`} />
                        <KpiTile label="Average health score" value={avgHealth.toFixed(0)} note={unscored > 0 ? `Out of 100. ${unscored} without a score count as 0` : 'Out of 100'} />
                        <KpiTile label="Health score below 60" value={String(atRisk)} empty={atRisk === 0 ? 'None of the scored vehicles.' : undefined} note={unscored > 0 ? 'Vehicles without a score are not counted' : undefined} />
                        <KpiTile label="Average cost per km" value={formatCurrency(avgCostKm)} note={noCost > 0 ? `${noCost} without a cost count as R 0` : undefined} />
                      </dl>
                    )}
                  </InsightCard>
                );
              })()}

              <InsightCard
                title="Which vehicles earn the most"
                description={`Revenue recorded against each vehicle, from ${sampleText(vehicles.length, vehiclesTotal, 'vehicles')}. Trip counts are not available here, so compare with care.`}
              >
                <RankedList
                  rows={vehicles.map(v => ({
                    id: String(v.id),
                    label: v.plate,
                    labelText: v.plate,
                    mono: true,
                    value: num(v.revenue_generated),
                    meta: [
                      [v.make, v.model].filter(Boolean).join(' '),
                      v.cost_per_km ? `${formatCurrency(v.cost_per_km)}/km` : null,
                      v.ai_health_score ? `Health ${v.ai_health_score}` : null,
                      v.uptime_percentage ? `Uptime ${v.uptime_percentage.toFixed(0)}%` : null,
                    ].filter(Boolean).join(' · '),
                    href: `/fleet/vehicles/${v.id}`,
                  }))}
                  format={v => formatCurrency(v)}
                  zeroIsEmpty
                  noValueLabel="No revenue recorded"
                  showShare
                  topN={8}
                  ariaLabel="Revenue by vehicle"
                  empty="No vehicles yet."
                  noRankedMessage="No vehicle has revenue recorded yet."
                />
              </InsightCard>

              <InsightCard
                title="Which drivers bring in the most revenue"
                description={`Revenue recorded per driver, from ${sampleText(drivers.length, driversTotal, 'drivers')}. Drivers with fewer than ${MIN_TRIPS} trips are not ranked.`}
              >
                <RankedList
                  rows={drivers.map(d => {
                    const flags = [
                      d.violation_count > 0 ? plural(d.violation_count, 'violation', 'violations') : null,
                      d.accident_history > 0 ? plural(d.accident_history, 'accident', 'accidents') : null,
                    ].filter(Boolean).join(', ');
                    return {
                      id: String(d.id),
                      label: d.user_details?.name || 'Unnamed driver',
                      value: num(d.revenue_generated),
                      count: num(d.total_trips),
                      meta: (
                        <>
                          {titleCase(d.status)}
                          {num(d.avg_revenue_per_trip) > 0 && <> · {formatCurrency(d.avg_revenue_per_trip)} per trip</>}
                          {flags && <> · <span className="ic-text--danger">{flags}</span></>}
                        </>
                      ),
                      href: `/fleet/drivers/${d.id}/financial`,
                    };
                  })}
                  format={v => formatCurrency(v)}
                  formatCount={tripsLabel}
                  minCount={MIN_TRIPS}
                  zeroIsEmpty
                  thinLabel="Too few trips to rank"
                  noValueLabel="No revenue recorded"
                  showShare
                  topN={8}
                  ariaLabel="Revenue by driver"
                  empty="No drivers yet."
                  noRankedMessage={`No driver has ${MIN_TRIPS} or more trips with revenue recorded yet, so there is no ranking.`}
                />
              </InsightCard>

              {(() => {
                const atRisk = vehicles.filter(v => (v.ai_health_score || 100) < 70).sort((a, b) => a.ai_health_score - b.ai_health_score);
                return (
                  <InsightCard
                    title="Which vehicles need a service check"
                    description="Vehicles with a health score below 70, lowest first. Below 50 means book a service now. Vehicles without a score are not checked."
                  >
                    {atRisk.length > 0 ? (
                      <ul className="ic-rows" aria-label="Vehicles with a low health score">
                        {atRisk.map(v => {
                          const urgent = v.ai_health_score < 50;
                          return (
                            <li key={v.id}>
                              <Link className="ic-row" to={`/fleet/vehicles/${v.id}`}>
                                <span className="ic-row__main">
                                  <span className="ic-row__title ic-row__title--mono">{v.plate}</span>
                                  <span className="ic-row__meta">{[[v.make, v.model].filter(Boolean).join(' '), titleCase(v.status)].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span className="ic-row__value">Health {v.ai_health_score}</span>
                                <span className={`ic-chip ${urgent ? 'ic-chip--danger' : 'ic-chip--warning'}`}>{urgent ? 'Book a service' : 'Keep an eye on it'}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="ic-note">No scored vehicle is below 70.</p>
                    )}
                  </InsightCard>
                );
              })()}
            </Stack>
          )}

          {/* ============ LANES ============ */}
          {tab === 'lanes' && (
            <Stack>
              {(() => {
                const routeMap = new Map<string, { trips: number; total_revenue: number; total_distance: number; total_fuel: number }>();
                loads.forEach(load => {
                  if (!load.pickup_city || !load.delivery_city) return;
                  const route = `${load.pickup_city} → ${load.delivery_city}`;
                  const e = routeMap.get(route) || { trips: 0, total_revenue: 0, total_distance: 0, total_fuel: 0 };
                  routeMap.set(route, {
                    trips: e.trips + 1,
                    total_revenue: e.total_revenue + (parseFloat(String(load.total_amount)) || 0),
                    total_distance: e.total_distance + (parseFloat(String(load.distance)) || 0),
                    total_fuel: e.total_fuel + (parseFloat(String(load.fuel_surcharge)) || 0),
                  });
                });
                const routes = Array.from(routeMap.entries())
                  .map(([route, d]) => ({
                    route, trips: d.trips,
                    total_revenue: d.total_revenue,
                    rev_per_km: d.total_distance > 0 ? d.total_revenue / d.total_distance : 0,
                    margin_pct: d.total_revenue > 0 ? ((d.total_revenue - d.total_fuel) / d.total_revenue) * 100 : 0,
                  }))
                  .filter(r => r.rev_per_km > 0);
                const noDistance = routeMap.size - routes.length;
                return (
                  <InsightCard
                    title="Which lanes earn the most per kilometre"
                    description={`Revenue divided by recorded distance, from ${sampleText(loads.length, loadsTotal, 'loads', true)}. Lanes with fewer than ${MIN_TRIPS} trips are not ranked${noDistance > 0 ? `; ${plural(noDistance, 'lane', 'lanes')} without a distance ${noDistance === 1 ? 'is' : 'are'} left out` : ''}. ${notFiltered}`}
                  >
                    <RankedList
                      rows={routes.map(r => ({
                        id: r.route,
                        label: routeText(r.route),
                        value: r.rev_per_km,
                        count: r.trips,
                        meta: `${formatCurrency(r.total_revenue)} revenue · ${r.margin_pct.toFixed(0)}% left after fuel surcharge`,
                      }))}
                      format={v => `${formatCurrency(v)}/km`}
                      formatCount={tripsLabel}
                      minCount={MIN_TRIPS}
                      thinLabel="Too few trips to rank"
                      topN={8}
                      ariaLabel="Lanes by revenue per kilometre"
                      empty="No loads with a pickup and delivery city yet."
                      noRankedMessage={`No lane has ${MIN_TRIPS} or more trips with a recorded distance yet, so there is no ranking. Each lane's figures are listed below for reference.`}
                    />
                  </InsightCard>
                );
              })()}

              {(() => {
                const cargoMap = new Map<string, { count: number; total: number }>();
                loads.forEach(load => {
                  const words = (load.cargo_description || 'Unknown').trim().split(/\s+/).slice(0, 2);
                  const key = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                  const e = cargoMap.get(key) || { count: 0, total: 0 };
                  cargoMap.set(key, { count: e.count + 1, total: e.total + (parseFloat(String(load.total_amount)) || 0) });
                });
                const types = Array.from(cargoMap.entries())
                  .map(([cargo, d]) => ({ cargo, trips: d.count, avg: d.total / d.count, total: d.total }));
                return (
                  <InsightCard
                    title="Which cargo pays the most per trip"
                    description={`Average revenue per trip, grouped by the first two words of the cargo description, from ${sampleText(loads.length, loadsTotal, 'loads', true)}. Types with fewer than ${MIN_TRIPS} trips are not ranked. ${notFiltered}`}
                  >
                    <RankedList
                      rows={types.map(c => ({
                        id: c.cargo,
                        label: cargoText(c.cargo),
                        value: c.avg,
                        count: c.trips,
                        meta: `${formatCurrency(c.total)} in total`,
                      }))}
                      format={v => formatCurrency(v)}
                      formatCount={tripsLabel}
                      minCount={MIN_TRIPS}
                      thinLabel="Too few trips to rank"
                      topN={8}
                      ariaLabel="Cargo types by average revenue per trip"
                      empty="No loads yet."
                      noRankedMessage={`No cargo type has ${MIN_TRIPS} or more trips yet, so there is no ranking.`}
                    />
                  </InsightCard>
                );
              })()}

              {(() => {
                const pending = loads.filter(l => ['PENDING', 'ASSIGNED'].includes((l.status || '').toUpperCase()));
                const inMotion = loads.filter(l => ['IN_TRANSIT'].includes((l.status || '').toUpperCase().replace(' ', '_')));
                const completed = loads.filter(l => ['DELIVERED', 'INVOICED'].includes((l.status || '').toUpperCase()));
                const pRev = pending.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                const mRev = inMotion.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                const cRev = completed.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                const other = loads.length - pending.length - inMotion.length - completed.length;
                return (
                  <InsightCard
                    title="How much work is in the pipeline"
                    description={`Load value by stage, from ${sampleText(loads.length, loadsTotal, 'loads', true)}.${other > 0 ? ` ${plural(other, 'load', 'loads')} in other statuses, such as loading or cancelled, ${other === 1 ? 'is' : 'are'} not counted.` : ''}`}
                  >
                    <dl className="ic-stages">
                      {[
                        { label: 'Waiting to dispatch', sub: 'Pending or assigned', count: pending.length, rev: pRev },
                        { label: 'In transit', sub: 'On the road now', count: inMotion.length, rev: mRev },
                        { label: 'Delivered', sub: 'Delivered or invoiced', count: completed.length, rev: cRev },
                      ].map(s => (
                        <div key={s.label} className="ic-stage">
                          <dt className="ic-kpi__label">{s.label}</dt>
                          <dd className="ic-kpi__value">{formatCurrency(s.rev)}</dd>
                          <dd className="ic-kpi__note">{plural(s.count, 'load', 'loads')} · {s.sub.toLowerCase()}</dd>
                        </div>
                      ))}
                    </dl>
                  </InsightCard>
                );
              })()}

              {(() => {
                const bins = [
                  { label: 'Under 5 t', filter: (w: number) => w < 5000 },
                  { label: '5 to 10 t', filter: (w: number) => w >= 5000 && w < 10000 },
                  { label: '10 to 20 t', filter: (w: number) => w >= 10000 && w < 20000 },
                  { label: '20 t and over', filter: (w: number) => w >= 20000 },
                ].map(b => {
                  const bl = loads.filter(l => b.filter(parseFloat(String(l.weight)) || 0));
                  const avg = bl.length > 0 ? bl.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0) / bl.length : 0;
                  return { ...b, count: bl.length, avg };
                });
                return (
                  <InsightCard
                    title="Do heavier loads pay more per trip"
                    description={`Average revenue per trip by load weight, from ${sampleText(loads.length, loadsTotal, 'loads', true)}. Loads without a weight fall under 5 t. Bands with fewer than ${MIN_TRIPS} trips are shown without a bar. ${notFiltered}`}
                  >
                    <RankedList
                      rows={bins.map(b => ({ id: b.label, label: b.label, value: b.count > 0 ? b.avg : null, count: b.count }))}
                      format={v => formatCurrency(v)}
                      formatCount={tripsLabel}
                      minCount={MIN_TRIPS}
                      preserveOrder
                      thinLabel="Too few trips to compare"
                      noValueLabel="No loads in this band"
                      ariaLabel="Average revenue per trip by weight band"
                      empty="No loads yet."
                      noRankedMessage={`No weight band has ${MIN_TRIPS} or more trips yet.`}
                    />
                  </InsightCard>
                );
              })()}
            </Stack>
          )}
        </>
      )}
    </div>
  );
}
