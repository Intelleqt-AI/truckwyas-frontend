import './table-heading-roles.css';
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { CAPITAL_LAUNCHED } from '@/lib/features';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Loader } from '@/components/Loader';
import SectionHeader, { FINANCE_TABS } from '@/components/layout/SectionHeader';
import './finance-brand.css';

// Chart text in the sans scale; colours come from theme tokens so both themes work.
const axisTick = { fontFamily: 'var(--font-sans)', fontSize: 13, fill: 'var(--text-tertiary)' };
const tooltipStyle = {
  fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px',
  background: 'var(--bg-surface)', color: 'var(--text-primary)',
  border: '1px solid var(--border-subtle)', borderRadius: 8,
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Lanes with fewer loads than this are listed, muted, but never ranked.
const MIN_SAMPLE = 3;

// Sentence-case a status/token for display: "FUNDED" → "Funded".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

const compactRand = (v: number) =>
  Math.abs(v) >= 1000 ? `R${(v / 1000).toFixed(0)}k` : `R${Math.round(v)}`;

const monthLabel = (m: string) =>
  /^\d{4}-\d{2}/.test(m || '') ? `${MONTHS[parseInt(m.slice(5, 7), 10) - 1]} ${m.slice(2, 4)}` : (m || '');

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const AGING_LABELS: Record<string, string> = {
  current: 'Not yet due', '1-30': '1 to 30 days late', '31-60': '31 to 60 days late', '61-90': '61 to 90 days late', '90+': 'More than 90 days late',
};

function normaliseAging(a: any) {
  if (!a) return a;
  const buckets = Array.isArray(a.buckets)
    ? a.buckets.map((b: any) => ({
        ...b,
        label: b.label ?? AGING_LABELS[b.bucket_name] ?? b.bucket_name,
        amount: toNum(b.amount ?? b.total_amount),
        count: b.count ?? b.invoice_count ?? 0,
      }))
    : a.buckets;
  return { ...a, buckets };
}

function normaliseFacility(f: any) {
  if (!f) return f;
  return {
    ...f,
    facility_limit: f.facility_limit ?? (f.limit != null ? toNum(f.limit) : undefined),
    outstanding_advances: f.outstanding_advances ?? (f.outstanding != null ? toNum(f.outstanding) : undefined),
  };
}

const ADVANCE_TONE: Record<string, string> = {
  REQUESTED: 'info', APPROVED: 'success', DISBURSED: 'success', FUNDED: 'warning', ACTIVE: 'warning',
  SETTLED: '', REPAID: '', DENIED: 'danger',
};

const TABS = [
  { id: 'pl', label: 'Profit and loss' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'aging', label: 'Receivables' },
  { id: 'customer', label: 'Customers' },
  { id: 'lanes', label: 'Lanes' },
  { id: 'fastpay', label: 'Fast Pay' },
];

/** Card with the title and its one-line basis inside it. */
function Panel({ id, title, desc, children, table = false }: { id: string; title: string; desc?: ReactNode; children: ReactNode; table?: boolean }) {
  return (
    <section className={`card${table ? ' fin-table-card' : ''}`} aria-labelledby={id}>
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id={id} className="fin-panel-title">{title}</h2>
          {desc && <p className="fin-panel-desc">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode }) {
  return (
    <div className="card fin-kpi">
      <span className="fin-kpi__label">{label}</span>
      <span className="fin-kpi__value">{value}</span>
      {delta && <span className="fin-kpi__delta">{delta}</span>}
      {sub && <span className="fin-kpi__sub">{sub}</span>}
    </div>
  );
}

interface RankRow { key: string; label: string; note?: string; value: number; display: string; share?: string; tone?: 'accent' | 'danger'; thin?: boolean }

/** Ranked list: the bar encodes the same value the rows are sorted by. */
function RankList({ rows, max, valueHead, shareHead, labelHead, hideHead = false }: { rows: RankRow[]; max: number; valueHead: string; shareHead?: string; labelHead: string; hideHead?: boolean }) {
  return (
    <div className="fin-rank" role="table" aria-label={labelHead}>
      {!hideHead && (
        <div className="fin-rank__row fin-rank__head" role="row">
          <span role="columnheader">{labelHead}</span>
          <span aria-hidden="true" />
          <span role="columnheader" className="fin-rank__value">{valueHead}</span>
          <span role="columnheader" className="fin-rank__share">{shareHead ?? ''}</span>
        </div>
      )}
      {rows.map(r => (
        <div key={r.key} className={`fin-rank__row${r.thin ? ' is-thin' : ''}`} role="row">
          <span className="fin-rank__label" role="cell" title={r.label}>
            {r.label}
            {r.note && <small>{r.note}</small>}
          </span>
          <span className="fin-rank__track" aria-hidden="true">
            <span
              className={`fin-rank__bar${r.tone ? ` fin-rank__bar--${r.tone}` : ''}`}
              style={{ display: 'block', width: `${max > 0 ? Math.min(100, (Math.abs(r.value) / max) * 100) : 0}%` }}
            />
          </span>
          <span className="fin-rank__value" role="cell">{r.display}</span>
          <span className="fin-rank__share" role="cell">{r.share ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function FinanceReports() {
  const [tab, setTab] = useState('pl');
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  // All report data is fetched + derived inside the queryFn so the result is
  // cached by TanStack Query and survives navigation — revisiting the page no
  // longer refires these 8 requests until the cache goes stale.
  const { data, isLoading: loading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["finance-reports"],
    queryFn: async () => {
      const [finance, cashflow, cust, aging, fac, adv, lanes, fastpay] = await Promise.all([
        fetchData('api/v1/dashboard/finance/').catch(() => null),
        fetchData('api/v1/dashboard/cashflow/').catch(() => null),
        fetchData('api/v1/customers/').catch(() => []),
        fetchData('api/v1/invoices/aging/').catch(() => null),
        fetchData('api/v1/facilities/').catch(() => null),
        fetchData('api/v1/advances/').catch(() => []),
        fetchData('api/v1/reports/margin-by-lane/').catch(() => null),
        fetchData('api/v1/reports/fastpay-savings/').catch(() => null),
      ]);
      const facList = Array.isArray(fac) ? fac : (fac?.results || []);
      const customerList = Array.isArray(cust) ? cust : (cust?.results || []);
      return {
        financeData: finance,
        cashflowData: cashflow,
        customers: customerList,
        agingData: aging,
        facilities: facList[0] || null,
        advances: Array.isArray(adv) ? adv : (adv?.results || []),
        laneData: lanes,
        fastpayData: fastpay,
      };
    },
  });

  const error = isError ? 'Failed to load data' : null;
  const financeData = data?.financeData ?? null;
  const cashflowData = data?.cashflowData ?? null;
  const customers = data?.customers ?? [];
  // Presentation-only field mapping: the aging, facility and advance endpoints
  // return decimals as strings and use different field names from the ones
  // this screen was written against. Values are read as-is, never recalculated.
  const agingData = normaliseAging(data?.agingData ?? null);
  const facilities = normaliseFacility(data?.facilities ?? null);
  const advances = (data?.advances ?? []).map((a: any) => ({
    ...a,
    fee_amount: toNum(a.fee_amount),
    advanced_amount: a.advanced_amount == null ? undefined : toNum(a.advanced_amount),
  }));
  const totalAdvanced = advances.reduce((sum: number, a: any) => sum + (a.advanced_amount || 0), 0);
  const totalFees = advances.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0);
  const laneData = data?.laneData ?? null;
  const fastpayData = data?.fastpayData ?? null;

  const custDays = (c: any): number | null => (c?.avg_payment_days == null ? null : toNum(c.avg_payment_days));

  const topCustomers: any[] = financeData?.top_customers || customers
    .map((c: any) => ({ customer_id: c.id, customer_name: c.name || c.customer_name, revenue: c.total_revenue || 0, invoice_count: c.invoice_count || 0 }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    switch(tab) {
      case 'pl':
        filename = 'PL_Report.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Total Revenue,${financeData?.total_revenue || 0}\n`;
        csvContent += `Total Expenses,${financeData?.total_expenses || 0}\n`;
        csvContent += `Net Margin %,${financeData?.net_margin_percent || 0}\n`;
        csvContent += `Net Profit,${(financeData?.total_revenue || 0) - (financeData?.total_expenses || 0)}\n\n`;
        csvContent += 'Month,Revenue,Expenses,Margin\n';
        (financeData?.monthly_trend || []).forEach((m: any) => {
          csvContent += `${m.month},${m.revenue || 0},${m.expenses || 0},${m.margin || 0}\n`;
        });
        if (financeData?.expense_breakdown) {
          csvContent += '\nCategory,Amount\n';
          Object.entries(financeData.expense_breakdown).forEach(([category, amount]: [string, any]) => {
            csvContent += `${category},${amount}\n`;
          });
        }
        break;

      case 'cashflow':
        filename = 'Cashflow_Forecast.csv';
        csvContent = 'Period,Week Starting,Expected In,Expected Out,Net\n';
        (cashflowData?.forecast || []).forEach((f: any) => {
          const net = (f.expected_in || 0) - (f.expected_out || 0);
          csvContent += `${f.period},${f.start_date},${f.expected_in || 0},${f.expected_out || 0},${net}\n`;
        });
        break;

      case 'customer':
        filename = 'Customer_Report.csv';
        csvContent = 'Rank,Customer Name,Revenue,Invoice Count,Avg Payment Days\n';
        topCustomers.forEach((c: any, idx: number) => {
          const matchingCustomer = customers.find((cust: any) => cust.id === c.customer_id || cust.name === c.customer_name);
          csvContent += `${idx + 1},"${c.customer_name}",${c.revenue},${c.invoice_count},${custDays(matchingCustomer) ?? ''}\n`;
        });
        break;

      case 'aging':
        filename = 'Aging_Report.csv';
        csvContent = 'Category,Amount,Count,Percentage\n';
        const totalAmount = (agingData?.buckets || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        (agingData?.buckets || []).forEach((b: any) => {
          const pct = totalAmount > 0 ? ((b.amount / totalAmount) * 100).toFixed(1) : '0.0';
          csvContent += `${b.label},${b.amount || 0},${b.count || 0},${pct}\n`;
        });
        break;

      case 'lanes':
        filename = 'Margin_By_Lane.csv';
        csvContent = 'Lane,Loads,Revenue,Est Cost,Est Margin,Margin %,Avg Distance (km),Revenue/km\n';
        (laneData?.lanes || []).forEach((l: any) => {
          csvContent += `"${l.lane}",${l.loads},${l.revenue || 0},${l.est_cost ?? ''},${l.est_margin ?? ''},${l.margin_pct ?? ''},${l.avg_distance_km ?? ''},${l.revenue_per_km ?? ''}\n`;
        });
        break;

      case 'fastpay':
        filename = 'FastPay_Value.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Advances Settled/Disbursed,${fastpayData?.count || 0}\n`;
        csvContent += `Cash Accelerated,${fastpayData?.cash_accelerated || 0}\n`;
        csvContent += `Avg Days Early,${fastpayData?.avg_days_early || 0}\n`;
        csvContent += `Total Fees,${fastpayData?.total_fees || 0}\n`;
        csvContent += `Avg Fee %,${fastpayData?.avg_fee_pct || 0}\n`;
        csvContent += `Effective APR %,${fastpayData?.effective_apr ?? ''}\n\n`;
        csvContent += 'Invoice #,Customer,Advanced,Fee,Date,Status\n';
        advances.slice(0, 10).forEach((adv: any) => {
          csvContent += `${adv.invoice_number},"${adv.customer_name}",${adv.advanced_amount || 0},${adv.fee_amount || 0},${adv.advanced_date || adv.created_at?.slice(0, 10)},${adv.status || 'ACTIVE'}\n`;
        });
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const Empty = ({ title, body }: { title: string; body?: string }) => (
    <div className="fin-empty fin-empty--compact" style={{ padding: '24px 0' }}>
      <p className="fin-empty__title" style={{ fontSize: 14, lineHeight: '20px' }}>{title}</p>
      {body && <p className="fin-empty__body" style={{ margin: 0 }}>{body}</p>}
    </div>
  );

  /* ---------- Profit and loss ---------- */
  const renderPL = () => {
    const revenue = financeData?.total_revenue || 0;
    const expenses = financeData?.total_expenses || 0;
    const profit = revenue - expenses;
    // The API's margin % is month to date when this month has revenue,
    // otherwise all time; the label follows whichever it is.
    const marginIsMtd = (financeData?.revenue_mtd || 0) > 0;
    const trend = (financeData?.monthly_trend || []).map((m: any) => ({ ...m, label: monthLabel(m.month) }));
    const lastIdx = trend.length - 1;
    const hasTrend = trend.some((m: any) => (m.revenue || 0) > 0 || (m.expenses || 0) > 0);

    return (
      <div className="fin-stack">
        <div className="fin-kpis fin-kpis--3" style={{ marginBottom: 0 }}>
          <Kpi
            label="Revenue received, all time"
            value={formatCurrency(revenue)}
            delta={financeData?.revenue_change_pct != null
              ? `${financeData.revenue_change_pct >= 0 ? '+' : '−'}${Math.abs(financeData.revenue_change_pct).toFixed(1)}% last 30 days vs the 30 before`
              : undefined}
            sub="Paid invoices incl. VAT, counted when paid"
          />
          <Kpi label="Approved expenses, all time" value={formatCurrency(expenses)} sub="Approved expenses only, by expense date" />
          <Kpi
            label="Net profit, all time"
            value={formatCurrency(profit)}
            sub={`${formatPercent(financeData?.net_margin_percent || 0)} margin${marginIsMtd ? ' this month' : ' all time'}; revenue less approved expenses`}
          />
        </div>

        <Panel
          id="pl-trend"
          title="Did money in cover costs each month?"
          desc="Last six months. Revenue is paid invoices incl. VAT by payment date; costs are approved expenses by expense date. The current month is highlighted."
        >
          {!hasTrend ? (
            <Empty title="No paid invoices or approved expenses in the last six months" />
          ) : (
            <>
              <div className="fin-legend-inline" style={{ marginBottom: 12 }}>
                <span><i style={{ background: 'var(--accent-primary)' }} />Revenue</span>
                <span><i style={{ background: 'var(--text-tertiary)' }} />Expenses</span>
              </div>
              <div role="img" aria-label={`Monthly revenue and expenses: ${trend.map((m: any) => `${m.label} revenue ${formatCurrency(m.revenue || 0)}, expenses ${formatCurrency(m.expenses || 0)}`).join('; ')}`}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="var(--border-row)" />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => compactRand(v)} />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-surface-hover)' }}
                      contentStyle={tooltipStyle}
                      formatter={(value: any, name: string) => [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Expenses']}
                    />
                    <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                      {trend.map((_: any, i: number) => (
                        <Cell key={i} fill="var(--accent-primary)" fillOpacity={i === lastIdx ? 1 : 0.55} />
                      ))}
                    </Bar>
                    <Bar dataKey="expenses" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                      {trend.map((_: any, i: number) => (
                        <Cell key={i} fill="var(--text-tertiary)" fillOpacity={i === lastIdx ? 0.9 : 0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Panel>
      </div>
    );
  };

  /* ---------- Cash flow ---------- */
  const renderCashflow = () => {
    const forecast: any[] = cashflowData?.forecast || [];
    const next4 = forecast.slice(0, 4); // ~4 weeks
    const totalIn = next4.reduce((sum: number, f: any) => sum + (f.expected_in || 0), 0);
    const totalOut = next4.reduce((sum: number, f: any) => sum + (f.expected_out || 0), 0);
    const netPosition = totalIn - totalOut;
    const allOut = forecast.reduce((s: number, f: any) => s + (f.expected_out || 0), 0);
    const active = forecast.filter((f: any) => (f.expected_in || 0) !== 0 || (f.expected_out || 0) !== 0);
    const quiet = forecast.length - active.length;
    const chart = forecast.map((f: any) => ({ ...f, label: fmtDate(f.start_date).replace(/ \d{4}$/, '') }));

    return (
      <div className="fin-stack">
        <Panel
          id="cf-weeks"
          title={`When will cash arrive over the next ${plural(forecast.length, 'week')}?`}
          desc="Each unpaid invoice is placed in the week it is expected to be paid: its due date, or the customer's usual payment time. Overdue invoices are assumed to be paid within two weeks. Outgoings are future-dated expenses plus a baseline from the last three months."
        >
          {forecast.length === 0 ? (
            <Empty title="No forecast available" body="The forecast appears once invoices are sent." />
          ) : (
            <>
              <dl className="fin-facts" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: 20 }}>
                <div>
                  <dt>Expected in, next 4 weeks</dt>
                  <dd className="fin-hero-amount">{formatCurrency(totalIn)}</dd>
                </div>
                <div>
                  <dt>Expected out, next 4 weeks</dt>
                  <dd className="fin-hero-amount" style={totalOut > 0 ? undefined : { color: 'var(--text-secondary)' }}>
                    {totalOut > 0 ? formatCurrency(totalOut) : 'None forecast'}
                  </dd>
                </div>
                {totalOut > 0 && (
                  <div>
                    <dt>Net, next 4 weeks</dt>
                    <dd className={`fin-hero-amount ${netPosition < 0 ? 'fin-text-danger' : ''}`}>{formatCurrency(netPosition)}</dd>
                  </div>
                )}
              </dl>
              {allOut === 0 && (
                <p className="fin-note" style={{ marginBottom: 12 }}>Nothing is forecast going out: there are no future-dated expenses and none in the last three months to project from.</p>
              )}
              <div className="fin-legend-inline" style={{ marginBottom: 12 }}>
                <span><i style={{ background: 'var(--accent-primary)' }} />Expected in</span>
                <span><i style={{ background: 'var(--text-tertiary)' }} />Expected out</span>
              </div>
              <div role="img" aria-label={`Weekly expected cash: ${active.map((f: any) => `week of ${fmtDate(f.start_date)} in ${formatCurrency(f.expected_in || 0)}, out ${formatCurrency(f.expected_out || 0)}`).join('; ') || 'no movement'}`}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chart} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke="var(--border-row)" />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => compactRand(v)} />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-surface-hover)' }}
                      contentStyle={tooltipStyle}
                      labelFormatter={(l) => `Week of ${l}`}
                      formatter={(value: any, name: string) => [formatCurrency(value), name === 'expected_in' ? 'Expected in' : 'Expected out']}
                    />
                    <Bar dataKey="expected_in" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                    <Bar dataKey="expected_out" fill="var(--text-tertiary)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Panel>

        {active.length > 0 && (
          <Panel
            id="cf-table"
            table
            title="Which weeks have money moving?"
            desc={quiet > 0 ? `${plural(quiet, 'week')} with nothing expected in or out ${quiet === 1 ? 'is' : 'are'} left out.` : undefined}
          >
            <div className="fin-table-scroll">
              <table className="fin-table table-heading-roles">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th className="num">Expected in</th>
                    <th className="num">Expected out</th>
                    <th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((f: any) => {
                    const net = (f.expected_in || 0) - (f.expected_out || 0);
                    return (
                      <tr key={f.period}>
                        <td className="fin-date">{fmtDate(f.start_date)} to {fmtDate(f.end_date)}</td>
                        <td className="num">{formatCurrency(f.expected_in || 0)}</td>
                        <td className="num">{formatCurrency(f.expected_out || 0)}</td>
                        <td className={`num ${net < 0 ? 'fin-text-danger' : ''}`} style={{ fontWeight: 500 }}>{formatCurrency(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    );
  };

  /* ---------- Receivables (aging) ---------- */
  const renderAging = () => {
    const summary = agingData?.summary || {};
    const buckets: any[] = agingData?.buckets || [];
    const totalAmount = buckets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    const outstanding = summary.total_outstanding ?? totalAmount;
    const maxBucket = Math.max(0, ...buckets.map((b: any) => b.amount || 0));
    const custRows: any[] = [...(agingData?.customers || [])].sort((a, b) => toNum(b.total_outstanding) - toNum(a.total_outstanding));
    const shownCust = showAllCustomers ? custRows : custRows.slice(0, 8);
    const maxCust = toNum(custRows[0]?.total_outstanding);
    const oldestBucket = (c: any) =>
      toNum(c.days_90_plus) > 0 ? 'Oldest over 90 days late'
        : toNum(c.days_61_90) > 0 ? 'Oldest 61 to 90 days late'
          : toNum(c.days_31_60) > 0 ? 'Oldest 31 to 60 days late'
            : toNum(c.days_1_30) > 0 ? 'Oldest up to 30 days late' : 'Nothing late yet';

    return (
      <div className="fin-stack">
        <Panel
          id="ag-buckets"
          title="How late is the money customers owe you?"
          desc={`Unpaid balances incl. VAT on sent invoices, grouped by days past the due date.${summary.total_invoice_count != null ? ` ${plural(summary.total_invoice_count, 'invoice')} across ${plural(summary.customer_count ?? 0, 'customer')}.` : ''}`}
        >
          {buckets.length === 0 || totalAmount === 0 ? (
            <Empty title="Nobody owes you money right now" body="Sent invoices with an unpaid balance appear here." />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="fin-kpi__label">Outstanding today</div>
                <p className="fin-hero-amount">{formatCurrency(outstanding)}</p>
              </div>
              <RankList
                labelHead="Days past due"
                valueHead="Unpaid"
                shareHead="Share"
                max={maxBucket}
                rows={buckets.map((b: any) => ({
                  key: b.bucket_name || b.label,
                  label: b.label,
                  note: plural(b.count || 0, 'invoice'),
                  value: b.amount || 0,
                  display: formatCurrency(b.amount || 0),
                  share: `${totalAmount > 0 ? Math.round((b.amount / totalAmount) * 100) : 0}%`,
                  tone: (b.bucket_name === '90+' && b.amount > 0 ? 'danger' : undefined) as RankRow['tone'],
                  thin: !(b.count > 0),
                }))}
              />
            </>
          )}
        </Panel>

        {custRows.length > 0 && (
          <Panel
            id="ag-customers"
            title="Who owes you the most?"
            desc={`Customers ranked by unpaid balance incl. VAT, with the number of open invoices behind each. ${plural(custRows.length, 'customer')} owe money.`}
          >
            <RankList
              labelHead="Customer"
              valueHead="Unpaid"
              shareHead="Share"
              max={maxCust}
              rows={shownCust.map((c: any, i: number) => ({
                key: String(c.customer_id ?? c.customer_name),
                label: c.customer_name,
                note: `${plural(c.invoice_count || 0, 'invoice')} · ${oldestBucket(c)}`,
                value: toNum(c.total_outstanding),
                display: formatCurrency(toNum(c.total_outstanding)),
                share: `${totalAmount > 0 ? Math.round((toNum(c.total_outstanding) / totalAmount) * 100) : 0}%`,
                tone: (i === 0 ? 'accent' : undefined) as RankRow['tone'],
              }))}
            />
            {custRows.length > 8 && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="fin-link" onClick={() => setShowAllCustomers(v => !v)}>
                  {showAllCustomers ? 'Show top 8' : `Show all ${custRows.length}`}
                </button>
              </div>
            )}
          </Panel>
        )}

        {agingData?.overdue_invoices && agingData.overdue_invoices.length > 0 && (
          <Panel id="ag-overdue" table title="Which invoices are overdue?" desc={`${plural(agingData.overdue_invoices.length, 'invoice')} past the due date.`}>
            <div className="fin-table-scroll">
              <table className="fin-table table-heading-roles">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Due</th>
                    <th className="num">Days late</th>
                    <th className="num">Amount incl. VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {agingData.overdue_invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td><span className="fin-id">{inv.invoice_number}</span></td>
                      <td><div className="fin-truncate" title={inv.customer_name}>{inv.customer_name}</div></td>
                      <td className="fin-date">{fmtDate(inv.due_date)}</td>
                      <td className="num fin-text-danger">{inv.days_overdue || 0}</td>
                      <td className="num">{formatCurrency(inv.total_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    );
  };

  /* ---------- Customers ---------- */
  const renderCustomers = () => {
    const ytd = financeData?.revenue_ytd || 0;
    const topTotal = topCustomers.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
    const denom = ytd > 0 ? ytd : topTotal;
    const maxRev = Math.max(0, ...topCustomers.map((c: any) => c.revenue || 0));
    const yearStart = `1 Jan ${new Date().getFullYear()}`;


    return (
      <div className="fin-stack">
        <Panel
          id="cu-revenue"
          title="Which customers paid you the most this year?"
          desc={`Paid invoices incl. VAT by payment date since ${yearStart}. ${formatCurrency(ytd || topTotal)} received in total.`}
        >
          {topCustomers.length === 0 ? (
            <Empty title="No paid invoices this year yet" body="Customers appear here once their invoices are paid." />
          ) : (
            <RankList
              labelHead="Customer"
              valueHead="Received"
              shareHead="Share"
              max={maxRev}
              rows={topCustomers.map((c: any, i: number) => ({
                key: String(c.customer_id ?? c.customer_name),
                label: c.customer_name,
                note: plural(c.invoice_count || 0, 'paid invoice'),
                value: c.revenue || 0,
                display: formatCurrency(c.revenue || 0),
                share: denom > 0 ? `${Math.round(((c.revenue || 0) / denom) * 100)}%` : '',
                tone: (i === 0 ? 'accent' : undefined) as RankRow['tone'],
              }))}
            />
          )}
        </Panel>

      </div>
    );
  };

  /* ---------- Lanes ---------- */
  const renderLanes = () => {
    const lanes: any[] = laneData?.lanes || [];
    const withMargin = lanes.filter(l => l.est_margin != null);
    const ranked = withMargin.filter(l => (l.loads || 0) >= MIN_SAMPLE).sort((a, b) => b.est_margin - a.est_margin);
    const thin = lanes.filter(l => !ranked.includes(l)).sort((a, b) => (b.est_margin ?? -Infinity) - (a.est_margin ?? -Infinity));
    const maxAbs = Math.max(0, ...withMargin.map(l => Math.abs(l.est_margin)));
    const totalLoads = lanes.reduce((s, l) => s + (l.loads || 0), 0);

    const row = (l: any, isThin: boolean): RankRow => {
      const pct = l.margin_pct;
      return {
        key: l.lane,
        label: l.lane,
        note: `${plural(l.loads || 0, 'load')}${l.revenue_per_km != null ? ` · ${formatCurrency(l.revenue_per_km)} per km` : ''}`,
        value: l.est_margin ?? 0,
        display: l.est_margin == null ? '—' : formatCurrency(l.est_margin),
        share: pct == null ? '—' : formatPercent(pct),
        tone: (l.est_margin != null && l.est_margin < 0 ? 'danger' : undefined) as RankRow['tone'],
        thin: isThin,
      };
    };

    return (
      <div className="fin-stack">
        <Panel
          id="ln-margin"
          title="Which lanes make you money?"
          desc={`Estimated margin per lane: load revenue less the quoting tool's modelled cost (fuel, driver, tolls, wear, empty return) for an articulated truck, not your recorded expenses. ${plural(lanes.length, 'lane')}, ${plural(totalLoads, 'load')}, ${formatCurrency(laneData?.summary?.total_revenue || 0)} revenue. Lanes with fewer than ${MIN_SAMPLE} loads are listed but not ranked.`}
        >
          {lanes.length === 0 ? (
            <Empty title="No delivered loads to analyse yet" body="Lanes appear once loads are delivered." />
          ) : (
            <>
              <RankList
                labelHead={`Ranked lanes (${MIN_SAMPLE} or more loads)`}
                valueHead="Est. margin"
                shareHead="Margin"
                max={maxAbs}
                rows={ranked.map((l, i) => { const r = row(l, false); return i === 0 && (l.est_margin ?? 0) > 0 ? { ...r, tone: 'accent' as const } : r; })}
              />
              {ranked.length === 0 && (
                <p className="fin-note" style={{ padding: '12px 0' }}>No lane has {MIN_SAMPLE} or more loads yet, so none is ranked.</p>
              )}
              {thin.length > 0 && (
                <>
                  <div className="fin-rank__row fin-rank__head" style={{ marginTop: 16 }}>
                    <span>Too few loads to rank</span>
                    <span aria-hidden="true" />
                    <span />
                    <span />
                  </div>
                  <RankList hideHead labelHead="Lanes with too few loads to rank" valueHead="Est. margin" shareHead="Margin" max={maxAbs} rows={thin.map(l => row(l, true))} />
                </>
              )}
            </>
          )}
        </Panel>
      </div>
    );
  };

  /* ---------- Fast Pay ---------- */
  const renderFastPay = () => {
    if (!CAPITAL_LAUNCHED) {
      const openCount = agingData?.summary?.total_invoice_count ?? 0;
      const openCustomers = agingData?.summary?.customer_count ?? 0;
      return (
        <div className="fin-stack">
          <Panel id="fp-live" title="Fast Pay is not live yet" desc="Advances, facility limits and fees will be reported here once Fast Pay launches. Nothing on this page means money is available today.">
            <div className="fin-stack fin-stack--16">
              {openCount > 0 && (
                <div className="fin-inset">
                  <p className="fin-note">
                    <strong>What you are waiting on today</strong>
                    {plural(openCount, 'unpaid invoice')} from {plural(openCustomers, 'customer')} {openCount === 1 ? 'is' : 'are'} waiting on payment. Fast Pay is being built so you can draw on eligible invoices instead of waiting.
                  </p>
                </div>
              )}
              <p className="fin-note" style={{ maxWidth: '72ch' }}>
                How it will work: you pick a sent invoice that has proof of delivery and is under 90 days old, see the fee and the amount you would receive before confirming, and get part of its value before the customer pays.
              </p>
              <div>
                <button type="button" className="btn-action fin-btn-secondary" onClick={() => setTab('aging')}>View receivables</button>
              </div>
            </div>
          </Panel>
        </div>
      );
    }

    const advancesThisMonth = advances.filter((a: any) => {
      const date = new Date(a.created_at || a.advanced_date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    return (
      <div className="fin-stack">
        <div className="fin-kpis" style={{ marginBottom: 0 }}>
          <Kpi label="Facility limit" value={formatCurrency(facilities?.facility_limit || 0)} />
          <Kpi label="Available to draw" value={formatCurrency((facilities?.facility_limit || 0) - (facilities?.outstanding_advances || 0))} sub="Limit less advances in use" />
          <Kpi label="In use" value={formatCurrency(facilities?.outstanding_advances || 0)} />
          <Kpi label="Advances this month" value={advancesThisMonth} sub="By request date" />
        </div>

        <Panel id="fp-value" title="What has Fast Pay delivered?" desc="Disbursed and settled advances. Days early compares the advance date with when the customer actually paid.">
          {(fastpayData?.count || 0) > 0 ? (
            <dl className="fin-facts" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              <div><dt>Cash received early</dt><dd>{formatCurrency(fastpayData.cash_accelerated || 0)}</dd></div>
              <div><dt>Advances</dt><dd>{fastpayData.count}</dd></div>
              <div><dt>Average days early</dt><dd>{fastpayData.avg_days_early}</dd></div>
              <div><dt>Fees paid</dt><dd>{formatCurrency(fastpayData.total_fees || 0)}</dd></div>
              <div><dt>Average fee</dt><dd>{formatPercent(fastpayData.avg_fee_pct || 0)}</dd></div>
              <div><dt>Annualised cost</dt><dd>{fastpayData.effective_apr == null ? '—' : formatPercent(fastpayData.effective_apr)}</dd></div>
            </dl>
          ) : (
            <Empty title="No advances settled yet" body="Value appears once you draw and settle an advance." />
          )}
          {totalAdvanced > 0 && (
            <p className="fin-note" style={{ marginTop: 16 }}>
              Across all {plural(advances.length, 'advance')} on record, fees come to {formatCurrency(totalFees)}, an average rate of {((totalFees / totalAdvanced) * 100).toFixed(2)}%.
            </p>
          )}
        </Panel>

        {advances.length > 0 && (
          <Panel id="fp-list" table title="Recent advances" desc={`The 10 most recent of ${advances.length}.`}>
            <div className="fin-table-scroll">
              <table className="fin-table table-heading-roles">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Fee</th>
                    <th className="num">Advanced</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.slice(0, 10).map((adv: any) => (
                    <tr key={adv.id}>
                      <td className="fin-date">{fmtDate(adv.advanced_date || adv.created_at?.slice(0, 10))}</td>
                      <td><span className="fin-id">{adv.invoice_number}</span></td>
                      <td><div className="fin-truncate" title={adv.customer_name}>{adv.customer_name}</div></td>
                      <td>
                        <span className={`fin-chip${ADVANCE_TONE[adv.status || 'ACTIVE'] ? ` fin-chip--${ADVANCE_TONE[adv.status || 'ACTIVE']}` : ''}`}>
                          {formatStatus(adv.status || 'ACTIVE')}
                        </span>
                      </td>
                      <td className="num">{formatCurrency(adv.fee_amount || 0)}</td>
                      <td className="num">{adv.advanced_amount == null ? '—' : formatCurrency(adv.advanced_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    );
  };

  const exportDisabled = loading || !!error || (tab === 'fastpay' && !CAPITAL_LAUNCHED);

  return (
    <div className="fin-page">
      <SectionHeader
        eyebrow="Finance"
        title="Finance"
        tabs={FINANCE_TABS}
        actions={
          <button className="btn-action" onClick={exportToCSV} disabled={exportDisabled}>
            Export CSV
          </button>
        }
      />

      {/* Report switcher: second-level, in-page selection */}
      <div className="fin-subnav" role="group" aria-label="Report">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className="fin-chip-filter"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {dataUpdatedAt > 0 && (
          <span className="fin-subnav__meta">
            Figures as at {new Date(dataUpdatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size={32} />
        </div>
      ) : error ? (
        <div className="card fin-empty">
          <p className="fin-empty__title">Couldn’t load the reports</p>
          <p className="fin-empty__body">Check your connection and try again.</p>
          <div><button className="btn-action" onClick={() => window.location.reload()}>Retry loading</button></div>
        </div>
      ) : (
        <>
          {tab === 'pl' && renderPL()}
          {tab === 'cashflow' && renderCashflow()}
          {tab === 'aging' && renderAging()}
          {tab === 'customer' && renderCustomers()}
          {tab === 'lanes' && renderLanes()}
          {tab === 'fastpay' && renderFastPay()}
        </>
      )}
    </div>
  );
}
