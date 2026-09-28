import './insights-page-brand.css';
import { localDateISO } from '@/lib/dates';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { DatePicker } from '@/components/ui/date-picker';
import { Segmented } from '@/components/ui/Segmented';
import InsightCard from '@/components/insights/InsightCard';
import KpiTile from '@/components/insights/KpiTile';
import RankedList from '@/components/insights/RankedList';
import FindingsFeed, { RETRY, useAllRows } from '@/components/insights/FindingsFeed';
import type { ExpenseRec, InvoiceRec, LoadRec } from '@/components/insights/findings';
import { Waterfall, PaymentDotPlot, LaneScatter, Funnel, rand } from '@/components/viz';
import { paymentRows, lanePoints } from '@/components/insights/insight-series';

/* Insights. The first tab is the findings feed: what to change and what it is
   worth. The other tabs keep the charts that answer one question each, with a
   short title, a one-line subtitle and the method behind an info icon
   (DESIGN-PRINCIPLES section 9). Receivables lists, cost-mix lists and fleet
   rankings that other pages already own are not repeated here. Reads only. */

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MIN_TRIPS = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] || ym;
const formatDay = (iso?: string, withYear = true) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
};

type TabType = 'findings' | 'margin' | 'paid' | 'fleet' | 'lanes';
type PeriodType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_6M' | 'LAST_12M' | 'CUSTOM';

const TABS: { id: TabType; label: string }[] = [
  { id: 'findings', label: 'Findings' },
  { id: 'margin', label: 'Margin' },
  { id: 'paid', label: 'Getting paid' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'lanes', label: 'Lanes' },
];

const PERIOD_OPTIONS: { value: PeriodType; label: string; ariaLabel?: string }[] = [
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'LAST_3M', label: '3M', ariaLabel: 'Last 3 months' },
  { value: 'LAST_6M', label: '6M', ariaLabel: 'Last 6 months' },
  { value: 'LAST_12M', label: '12M', ariaLabel: 'Last 12 months' },
  { value: 'CUSTOM', label: 'Custom' },
];

interface PeriodState {
  period: PeriodType; setPeriod: (p: PeriodType) => void;
  customFrom: string; setCustomFrom: (v: string) => void;
  customTo: string; setCustomTo: (v: string) => void;
}

interface MonthlyTrend { month: string; revenue: number; expenses: number; margin: number }
interface FinanceData {
  revenue_period: number; expenses_period: number; net_margin_period: number; net_margin_percent_period: number;
  from_date?: string; to_date?: string; monthly_trend?: MonthlyTrend[];
}
interface Vehicle { id: number; plate: string; make: string; model: string; status: string; revenue_generated: number | string }

function periodRange(period: PeriodType, customFrom: string, customTo: string): { from: string; to: string } {
  if (period === 'CUSTOM' && customFrom && customTo) return { from: customFrom, to: customTo };
  const now = new Date();
  let from = '';
  let to = localDateISO();
  switch (period) {
    case 'THIS_MONTH': from = localDateISO(new Date(now.getFullYear(), now.getMonth(), 1)); break;
    case 'LAST_MONTH':
      from = localDateISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      to = localDateISO(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    case 'LAST_3M': from = localDateISO(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())); break;
    case 'LAST_6M': from = localDateISO(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())); break;
    default: from = localDateISO(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())); break;
  }
  return { from, to };
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="insights-stack">{children}</div>;
}

function TabState({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <div className="insights-skel" aria-busy="true" aria-label="Loading" />;
  if (error) {
    return (
      <div className="insights-state" role="alert">
        <p>This did not load.</p>
        <button type="button" className="insights-state__action" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  return null;
}

export default function Insights() {
  const [params, setParams] = useSearchParams();
  // The old Cash flow tab moved: actual cash is Finance > Reports > Cash movement,
  // a predicted shortfall is a finding. Its payment panels live under Getting paid.
  const rawTab = params.get('tab');
  const tabParam = (rawTab === 'cash' ? 'paid' : rawTab) as TabType | null;
  const tab: TabType = TABS.some(t => t.id === tabParam) ? tabParam! : 'findings';
  const setTab = (t: TabType) => setParams(p => { const n = new URLSearchParams(p); if (t === 'findings') n.delete('tab'); else n.set('tab', t); return n; }, { replace: true });
  // The Margin period lives in the page head: one segmented control per page, never in a card.
  const [period, setPeriod] = useState<PeriodType>('LAST_12M');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const periodState: PeriodState = { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo };

  return (
    <div className="insights-page-brand">
      <header className="tw-page-head insights-header">
        <div className="tw-page-head__titles">
          <h1 className="tw-title">Insights</h1>
          <p className="tw-subtitle">Findings worth money, each with one next step.</p>
        </div>
        {tab === 'margin' && (
          <div className="tw-page-head__actions insights-head-actions">
            <div className="insights-seg-scroll">
              <Segmented label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            </div>
            {period === 'CUSTOM' && (
              <div className="insights-custom">
                <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="From" style={{ width: 150, maxWidth: '100%', padding: 0, fontSize: 14, lineHeight: '20px' }} />
                <span className="insights-custom__to">to</span>
                <DatePicker value={customTo} onChange={setCustomTo} placeholder="To" style={{ width: 150, maxWidth: '100%', padding: 0, fontSize: 14, lineHeight: '20px' }} />
              </div>
            )}
          </div>
        )}
      </header>

      <nav className="insights-tabs" aria-label="Insights sections">
        {TABS.map(t => (
          <button key={t.id} type="button" className="insights-brand-tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'findings' && <FindingsFeed />}
      {tab === 'margin' && <MarginTab {...periodState} />}
      {tab === 'paid' && <PaidTab />}
      {tab === 'fleet' && <FleetTab />}
      {tab === 'lanes' && <LanesTab />}
    </div>
  );
}

// ------------------------------------------------------------------ margin

function MarginTab({ period, setPeriod, customFrom, customTo }: PeriodState) {
  const { from, to } = periodRange(period, customFrom, customTo);
  const finance = useQuery<FinanceData | null>({
    queryKey: ['insights-finance', from, to],
    queryFn: () => fetchData(`api/v1/dashboard/finance/?from=${from}&to=${to}`),
    staleTime: 5 * 60_000,
    ...RETRY,
  });
  const expenses = useAllRows<ExpenseRec>('expenses', 'api/v1/expenses/');
  const f = finance.data;

  const pendingInPeriod = (expenses.data?.rows ?? [])
    .filter(e => (e.status || '').toUpperCase() === 'PENDING' && e.expense_date >= (f?.from_date ?? from) && e.expense_date <= (f?.to_date ?? to))
    .reduce((s, e) => s + num(e.amount), 0);

  return (
    <Stack>
      {(finance.isLoading || finance.isError) ? (
        <TabState loading={finance.isLoading} error={finance.isError} onRetry={() => finance.refetch()} />
      ) : !f ? null : (() => {
        const rev = num(f.revenue_period);
        const cost = num(f.expenses_period);
        const margin = num(f.net_margin_period);
        const range = f.from_date && f.to_date ? `${formatDay(f.from_date)} to ${formatDay(f.to_date)}` : 'Selected period';
        const withPending = margin - pendingInPeriod;
        const pct = rev > 0 ? (margin / rev) * 100 : null;
        const trend = [...(f.monthly_trend ?? [])].sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
          .map(m => ({ month: monthName(m.month), revenue: num(m.revenue), expenses: num(m.expenses), margin: num(m.margin) }));
        const totalNet = trend.reduce((s, d) => s + d.margin, 0);
        return (
          <>
            <InsightCard
              title="Profit this period"
              description={range}
              info={`Revenue is paid invoices including VAT, by payment date. Costs are approved expenses, by expense date. Pending costs are expenses dated in the period and still waiting for approval; reports leave them out.`}
            >
              {rev === 0 && cost === 0 && pendingInPeriod === 0 ? (
                <div className="insights-empty">
                  <p>Nothing paid or approved in this period.</p>
                  {period !== 'LAST_12M' && <button type="button" className="ic-text-button" onClick={() => setPeriod('LAST_12M')}>Show the last 12 months</button>}
                </div>
              ) : (
                <>
                  <dl className="ic-kpis ic-kpis--4 insights-kpis">
                    <KpiTile label="Revenue" value={rand(rev, 0)} />
                    <KpiTile label="Approved costs" value={rand(cost, 0)} />
                    <KpiTile label="Net margin" value={pct != null ? `${pct.toFixed(1).replace('.', ',')}%` : rand(margin, 0)} tone={margin < 0 ? 'danger' : undefined} note={pct != null ? rand(margin, 0) : undefined} />
                    {pendingInPeriod > 0
                      ? <KpiTile label="With pending costs" value={rand(withPending, 0)} tone={withPending < 0 ? 'danger' : undefined} note={`${rand(pendingInPeriod, 0)} not approved`} />
                      : <KpiTile label="Pending costs" value="None" note="Every cost is approved" />}
                  </dl>
                  {/* The tiles above carry every figure; the bridge shows the shape, values live in the tooltip and table. */}
                  <Waterfall
                    height={220}
                    values="none"
                    valueHeader="Amount"
                    caption="Revenue, costs and net margin for the period"
                    ariaLabel={`Revenue ${rand(rev)}, minus approved costs ${rand(cost)}, leaves ${rand(margin)}.${pendingInPeriod > 0 ? ` Pending costs of ${rand(pendingInPeriod)} would leave ${rand(withPending)}.` : ''}`}
                    steps={[
                      { label: 'Revenue', value: rev, kind: 'total' },
                      { label: 'Approved costs', value: -cost, kind: 'delta' },
                      { label: 'Net margin', value: margin, kind: 'total' },
                      ...(pendingInPeriod > 0 ? [
                        { label: 'Pending costs', value: -pendingInPeriod, kind: 'delta' as const },
                        { label: 'If approved', value: withPending, kind: 'total' as const },
                      ] : []),
                    ]}
                  />
                </>
              )}
            </InsightCard>

            {trend.length > 0 && trend.some(d => d.revenue !== 0 || d.expenses !== 0) && (
              <InsightCard
                title="Net margin by month"
                description="Last 6 months, adding up"
                info="Each month's paid invoices (including VAT, by payment date) less approved expenses (by expense date), added to the months before. Calendar months. Not affected by the period buttons."
              >
                <Waterfall
                  height={260}
                  valueHeader="Net margin"
                  caption="Net margin per month and the running total"
                  ariaLabel={`Net margin by month from ${trend[0]?.month} to ${trend[trend.length - 1]?.month}, adding up to ${rand(totalNet)}.`}
                  steps={[
                    ...trend.map(d => ({
                      label: d.month,
                      value: d.margin,
                      kind: 'delta' as const,
                      emptyText: d.revenue === 0 && d.expenses === 0 ? 'Nothing paid or approved' : undefined,
                      detail: `Revenue ${rand(d.revenue)}, costs ${rand(d.expenses)}`,
                    })),
                    { label: `${trend.length} months`, value: totalNet, kind: 'total' as const },
                  ]}
                />
              </InsightCard>
            )}
          </>
        );
      })()}
    </Stack>
  );
}

// ------------------------------------------------------------ getting paid

function PaidTab() {
  const invoices = useAllRows<InvoiceRec>('invoices', 'api/v1/invoices/');
  const inv = invoices.data?.rows ?? [];
  const partial = invoices.data && !invoices.data.complete ? ` Based on the first ${inv.length} of ${invoices.data.count} invoices.` : '';

  return (
    <Stack>
      {invoices.isLoading || invoices.isError ? (
        <TabState loading={invoices.isLoading} error={invoices.isError} onRetry={() => invoices.refetch()} />
      ) : (() => {
        const live = inv.filter(i => !['CANCELLED', 'VOID'].includes((i.status || '').toUpperCase()));
        const sent = live.filter(i => (i.status || '').toUpperCase() !== 'DRAFT');
        const paid = sent.filter(i => (i.status || '').toUpperCase() === 'PAID');
        const sum = (l: InvoiceRec[], k: 'total_amount' | 'balance' = 'total_amount') => l.reduce((s, i) => s + num(i[k]), 0);
        const today = localDateISO();
        const overdue = sent.filter(i => (i.status || '').toUpperCase() !== 'PAID' && num(i.balance) > 0 && i.due_date && i.due_date < today);
        const chased = overdue.filter(i => num(i.reminder_count) > 0 || !!i.last_reminder_at).length;
        const { rows: payRows, paid: paidCount, open } = paymentRows(inv as any);
        return (
          <>
            <InsightCard
              title="Invoice to cash"
              description="Every invoice, by the furthest stage reached"
              info={`Raised: every invoice that is not cancelled. Sent: no longer a draft. Paid in full: status Paid. Amounts include VAT.${partial}`}
            >
              {live.length === 0 ? (
                <div className="insights-empty">
                  <p>No invoices yet.</p>
                  <Link className="ic-text-button" to="/finance/invoices/new">Create an invoice</Link>
                </div>
              ) : (
                <>
                  <Funnel
                    noun="invoice"
                    ariaLabel="Invoices by how far they got, from raised to paid"
                    stages={[
                      { key: 'raised', label: 'Raised', sub: rand(sum(live), 0), count: live.length },
                      { key: 'sent', label: 'Sent', sub: rand(sum(sent), 0), count: sent.length, dropNote: 'still drafts' },
                      { key: 'paid', label: 'Paid in full', sub: rand(sum(paid), 0), count: paid.length, dropNote: 'sent, not yet paid' },
                    ]}
                  />
                  {overdue.length > 0 && (
                    <dl className="insights-stats">
                      <div><dt>Overdue</dt><dd>{overdue.length}</dd></div>
                      <div><dt>Reminded</dt><dd className={chased === 0 ? 'ic-text--danger' : undefined}>{chased}</dd></div>
                      <div><dt>Overdue balance</dt><dd>{rand(sum(overdue, 'balance'), 0)}</dd></div>
                    </dl>
                  )}
                </>
              )}
            </InsightCard>

            <InsightCard
              title="Who pays late"
              description="Days to pay, each sent invoice"
              info={`Each sent invoice is placed at the days since it was issued: paid ones at the day payment was recorded, unpaid ones at today. The tick is the customer's usual terms. Drafts are left out.${partial}`}
            >
              {paidCount + open === 0 ? (
                <p className="ic-note">No sent invoices yet.</p>
              ) : (
                <PaymentDotPlot rows={payRows} maxRows={10} />
              )}
            </InsightCard>
          </>
        );
      })()}
    </Stack>
  );
}

// ------------------------------------------------------------------- fleet

function FleetTab() {
  const vehicles = useAllRows<Vehicle>('vehicles', 'api/v1/vehicles/');
  if (vehicles.isLoading || vehicles.isError) {
    return <TabState loading={vehicles.isLoading} error={vehicles.isError} onRetry={() => vehicles.refetch()} />;
  }
  const list = vehicles.data?.rows ?? [];
  if (list.length === 0) {
    return (
      <div className="insights-state">
        <p>No trucks yet.</p>
        <Link className="insights-state__action" to="/fleet/vehicles">Add a truck</Link>
      </div>
    );
  }
  const status = (v: Vehicle) => (v.status || '').toUpperCase();
  const working = list.filter(v => ['IN_USE', 'AVAILABLE'].includes(status(v))).length;
  const earning = list.filter(v => num(v.revenue_generated) > 0);
  const partial = vehicles.data && !vehicles.data.complete ? ` Based on the first ${list.length} of ${vehicles.data.count} trucks.` : '';
  return (
    <Stack>
      <InsightCard
        title="Revenue by truck"
        description="Revenue recorded against each truck"
        info={`Revenue recorded on each truck's profile. Trip counts and costs are not included, so compare with care.${partial}`}
      >
        {/* Fleet counts are attributes, not decisions: one line in the card, not three tiles. */}
        <dl className="insights-stats insights-stats--head">
          <div><dt>Trucks</dt><dd>{list.length}</dd></div>
          <div><dt>Available or in use</dt><dd>{working}<span className="insights-stats__note">{list.length - working} in maintenance or other</span></dd></div>
          <div><dt>With revenue recorded</dt><dd>{earning.length}<span className="insights-stats__note">{list.length - earning.length} with none yet</span></dd></div>
        </dl>
        <RankedList
          rows={list.map(v => ({
            id: String(v.id),
            label: v.plate,
            labelText: v.plate,
            mono: true,
            value: num(v.revenue_generated),
            meta: [v.make, v.model].filter(Boolean).join(' '),
            href: `/fleet/vehicles/${v.id}`,
          }))}
          format={v => rand(v, 0)}
          zeroIsEmpty
          noValueLabel="No revenue recorded"
          showShare
          topN={8}
          ariaLabel="Revenue by truck"
          empty="No trucks yet."
          noRankedMessage="No truck has revenue recorded yet."
        />
      </InsightCard>
    </Stack>
  );
}

// ------------------------------------------------------------------- lanes

function LanesTab() {
  const loads = useAllRows<LoadRec & { distance?: unknown }>('loads', 'api/v1/loads/');
  if (loads.isLoading || loads.isError) {
    return <TabState loading={loads.isLoading} error={loads.isError} onRetry={() => loads.refetch()} />;
  }
  const rows = loads.data?.rows ?? [];
  const { points, overall, noDistance } = lanePoints(rows, MIN_TRIPS);
  const partial = loads.data && !loads.data.complete ? ` Based on the first ${rows.length} of ${loads.data.count} loads.` : '';
  return (
    <Stack>
      <InsightCard
        title="Revenue per km by lane"
        description="Dot size is the lane's revenue"
        info={`Revenue per kilometre against trip length, from every load with a pickup city, delivery city and distance. Shorter trips usually earn more per kilometre, so compare lanes of similar length. Lanes with fewer than ${MIN_TRIPS} trips are drawn hollow.${noDistance > 0 ? ` ${plural(noDistance, 'lane')} without a distance ${noDistance === 1 ? 'is' : 'are'} left out.` : ''}${partial}`}
      >
        {points.length === 0 ? (
          <div className="insights-empty">
            <p>No loads with a route and distance yet.</p>
            <Link className="ic-text-button" to="/bookings/quotes/new">Quote a load</Link>
          </div>
        ) : (
          <LaneScatter points={points} overallPerKm={overall} minTrips={MIN_TRIPS} />
        )}
      </InsightCard>
    </Stack>
  );
}
