import './insights-page-brand.css';
import { localDateISO } from '@/lib/dates';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency as formatCurrencyBase } from '@/lib/formatters';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader } from '@/components/Loader';
import ExecutiveBriefing, { RecommendationGroups, formatDay, type BriefingResponse, type RecommendationDetail } from '@/components/insights/ExecutiveBriefing';
import InsightCard from '@/components/insights/InsightCard';
import KpiTile from '@/components/insights/KpiTile';
import RankedList, { type RankedRow } from '@/components/insights/RankedList';
import { Waterfall, CashRunway, AgeingStrip, PaymentDotPlot, LaneScatter } from '@/components/viz';
import { ageingBuckets, ageingByCustomer, paymentRows, lanePoints } from '@/components/insights/insight-series';

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
// Display only: drop trailing punctuation left by the two-word cargo grouping ("Chemicals -").
const cargoText = (s: string) => s.replace(/[\s&\-–:,/]+$/, '') || s;
/** Names the sample behind a panel. The list endpoints return one page (20
 *  rows today), so say so when there are more records than were loaded. */
const sampleText = (shown: number, total: number | undefined, noun: string, recent = false) =>
  total != null && total > shown
    ? recent ? `your ${shown} most recent ${noun} (of ${total})` : `${shown} of your ${total} ${noun}`
    : `all ${shown} ${noun}`;

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
                      <>
                        <Waterfall
                          height={240}
                          maxWidth={560}
                          labelAll
                          valueHeader="Amount"
                          caption="Revenue, approved costs and net margin for the period"
                          ariaLabel={`Revenue ${formatCurrency(rev)}, minus approved costs ${formatCurrency(cost)}, leaves a net margin of ${formatCurrency(margin)}.`}
                          steps={[
                            { label: 'Revenue', value: rev, kind: 'total' },
                            { label: 'Approved costs', value: -cost, kind: 'delta' },
                            { label: 'Net margin', value: margin, kind: 'total' },
                          ]}
                        />
                        <p className="ic-foot">
                          {rev > 0
                            ? <>Costs took <strong>{((cost / rev) * 100).toFixed(1)}%</strong> of revenue, leaving <strong>{num(f.net_margin_percent_period).toFixed(1)}%</strong>{margin < 0 ? <>, <span className="ic-text--danger">a loss</span></> : ''}.</>
                            : <><span className="ic-text--danger">A loss</span>: costs with no paid revenue.</>}
                        </p>
                      </>
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
                const totalNet = data.reduce((sum, d) => sum + d.margin, 0);
                return (
                  <InsightCard
                    title="Where did the last six months leave you?"
                    description={`Each month's net margin (paid invoices including VAT, by payment date, less approved expenses, by expense date) added to the months before it. Calendar months. ${notFiltered}`}
                  >
                    <Waterfall
                      height={260}
                      valueHeader="Net margin"
                      caption="Net margin per month and the running total"
                      ariaLabel={`Net margin by month from ${data[0]?.month} to ${last?.month}, adding up to ${formatCurrency(totalNet)}.`}
                      steps={[
                        ...data.map(d => ({
                          label: d.month,
                          value: d.margin,
                          kind: 'delta' as const,
                          emptyText: d.revenue === 0 && d.expenses === 0 ? 'No paid revenue and no approved costs' : undefined,
                          detail: `Revenue ${formatCurrency(d.revenue)}, costs ${formatCurrency(d.expenses)}`,
                        })),
                        { label: `${data.length} months`, value: totalNet, kind: 'total' as const },
                      ]}
                    />
                    {<p className="ic-foot">{last && (last.revenue !== 0 || last.expenses !== 0) ? `${summary} ` : ''}Over the {data.length} months the business is <strong>{formatCurrency(Math.abs(totalNet))}</strong> {totalNet >= 0 ? 'ahead' : 'behind'}.</p>}
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
                title="Will you run short of cash in the next 8 weeks?"
                description={`Each unpaid invoice is placed on the date that customer usually pays; expected costs are based on your approved expenses over the last 90 days. The line adds each week to the ones before, starting from zero today: it does not include your bank balance. Weeks start on Monday. ${notFiltered}`}
              >
                {cashflowData?.forecast && cashflowData.forecast.length > 0 ? (() => {
                  const data = cashflowData.forecast.slice(0, 8).map(f => ({
                    week: formatDay(f.start_date, false) || f.period,
                    in: num(f.expected_in),
                    out: num(f.expected_out),
                  }));
                  let pos = 0;
                  const running = data.map(d => (pos += d.in - d.out));
                  const shortWeeks = running.filter(v => v < 0).length;
                  const lowIdx = running.reduce((m, v, i) => (v < running[m] ? i : m), 0);
                  return (
                    <>
                      <CashRunway weeks={data.map(d => ({ label: d.week, in: d.in, out: d.out }))} />
                      <p className="ic-foot">
                        {shortWeeks > 0
                          ? <><span className="ic-text--danger">Short in {shortWeeks} of {data.length} weeks.</span> The lowest point is <strong>{formatCurrency(running[lowIdx])}</strong> in the week of {data[lowIdx].week}, before your bank balance.</>
                          : <>Expected receipts stay ahead of expected costs every week, ending <strong>{formatCurrency(running[running.length - 1])}</strong> up after {data.length} weeks.</>}
                      </p>
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
                const buckets = ageingBuckets(invoices);
                const perCustomer = ageingByCustomer(invoices);
                const maxOwed = Math.max(0, ...customers.map(c => c.total_outstanding));
                const pastDue = buckets.filter(b => b.key !== 'current').reduce((s2, b) => s2 + b.amount, 0);
                const agedTotal = buckets.reduce((s2, b) => s2 + b.amount, 0);
                rows.forEach(r => {
                  const b = perCustomer.get(r.id);
                  if (b) r.bar = <AgeingStrip buckets={b} scaleTo={maxOwed} ariaLabel={`${r.id}: ${formatCurrency(Number(r.value))} owed, by how late it is`} />;
                });
                return (
                  <InsightCard
                    title="Where is your cash stuck, and with whom?"
                    description={`Unpaid balances from ${sampleText(invoices.length, invoicesTotal, 'invoices')}, drafts included, split by how far past the due date they are today. Each customer's bar is their balance, shaded by the same lateness bands. ${notFiltered}`}
                  >
                    {agedTotal > 0 && (
                      <>
                        <AgeingStrip buckets={buckets} ariaLabel={`Of ${formatCurrency(agedTotal)} unpaid, ${Math.round((pastDue / agedTotal) * 100)}% is past its due date`} />
                        <h3 className="insights-subhead">By customer</h3>
                      </>
                    )}
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

              {(() => {
                const { rows: payRows, paid, open, drafts } = paymentRows(invoices);
                const marks = paid + open;
                return (
                  <InsightCard
                    title="Which customers pay late?"
                    description={`Every sent invoice from ${sampleText(invoices.length, invoicesTotal, 'invoices')}, placed at the days since it was issued: paid ones at the day payment was recorded, unpaid ones at today. The tick is the customer's usual terms (due date less issue date). ${drafts > 0 ? `${plural(drafts, 'draft is', 'drafts are')} left out because they have not been sent. ` : ''}${notFiltered}`}
                  >
                    {marks === 0 ? (
                      <p className="ic-note">No sent invoices to measure yet. Payment timing appears once invoices are sent.</p>
                    ) : (
                      <>
                        <PaymentDotPlot rows={payRows} maxRows={10} />
                        {paid < 3 && (
                          <p className="ic-foot">Only {plural(paid, 'paid invoice', 'paid invoices')} in this sample, so typical payment times are not settled yet. Unpaid invoices are shown so late payers are visible now.</p>
                        )}
                      </>
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
                const { points, overall, noDistance } = lanePoints(loads, MIN_TRIPS);
                const evidenced = points.filter(p => !p.thin).length;
                return (
                  <InsightCard
                    title="Which lanes are worth running?"
                    description={`Revenue per kilometre against the length of a trip, from ${sampleText(loads.length, loadsTotal, 'loads', true)} with a recorded distance. Shorter trips usually earn more per kilometre, so compare a lane with lanes of similar length. Point size is the lane's total revenue.${noDistance > 0 ? ` ${plural(noDistance, 'lane', 'lanes')} without a distance ${noDistance === 1 ? 'is' : 'are'} left out.` : ''} ${notFiltered}`}
                  >
                    {points.length === 0 ? (
                      <p className="ic-note">No loads with a pickup city, delivery city and distance yet.</p>
                    ) : (
                      <>
                        <LaneScatter points={points} overallPerKm={overall} minTrips={MIN_TRIPS} />
                        {evidenced === 0 && (
                          <p className="ic-foot">No lane has {MIN_TRIPS} or more trips yet, so every lane is drawn hollow: read them as early signals, not a verdict.</p>
                        )}
                      </>
                    )}
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
