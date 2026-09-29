import './insights-page-brand.css';
import { localDateISO } from '@/lib/dates';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Segmented } from '@/components/ui/Segmented';
import InsightCard from '@/components/insights/InsightCard';
import KpiTile from '@/components/insights/KpiTile';
import RankedList from '@/components/insights/RankedList';
import FindingsFeed, { useAllRows } from '@/components/insights/FindingsFeed';
import type { InvoiceRec, LoadRec } from '@/components/insights/findings';
import { resolvePeriod, periodText, useLedger, type PeriodId } from '@/components/reports/data';
import { marginFromLedger, chartMonths, type MarginMonth } from '@/components/insights/margin-ledger';
import { Waterfall, PaymentDotPlot, LaneScatter, Funnel, rand } from '@/components/viz';
import { paymentRows, lanePoints } from '@/components/insights/insight-series';
import { formatPercent } from '@/lib/formatters';

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
const monthYear = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;
/** "Apr to Jun 2026" or "Oct 2025 to Jun 2026". */
const monthSpan = (a: string, b: string) => (a === b ? monthYear(a) : a.slice(0, 4) === b.slice(0, 4) ? `${monthName(a)} to ${monthYear(b)}` : `${monthYear(a)} to ${monthYear(b)}`);

type TabType = 'findings' | 'margin' | 'paid' | 'fleet' | 'lanes';
type PeriodType = PeriodId;

const TABS: { id: TabType; label: string }[] = [
  { id: 'findings', label: 'Findings' },
  { id: 'margin', label: 'Margin' },
  { id: 'paid', label: 'Getting paid' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'lanes', label: 'Lanes' },
];

// The Profit and loss report's periods: whole calendar months, the current one included.
const PERIOD_OPTIONS: { value: PeriodType; label: string; ariaLabel?: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-3', label: '3M', ariaLabel: 'Last 3 months' },
  { value: 'last-6', label: '6M', ariaLabel: 'Last 6 months' },
  { value: 'last-12', label: '12M', ariaLabel: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

interface PeriodState {
  period: PeriodType; setPeriod: (p: PeriodType) => void;
  customFrom: string; setCustomFrom: (v: string) => void;
  customTo: string; setCustomTo: (v: string) => void;
}

interface Vehicle { id: number; plate: string; make: string; model: string; status: string; revenue_generated: number | string }

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
  // The Margin period (the P&L's periods) sits in the tab's toolbar, never in the head or a card.
  const [period, setPeriod] = useState<PeriodType>('last-12');
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

/**
 * Profit for the period and net margin month by month, on the Profit and loss
 * report's default basis (excl. VAT, cash basis) from the same full ledgers
 * (components/reports/data.ts), so the two pages print the same figures for
 * the same months. See components/insights/margin-ledger.ts.
 */
function MarginTab({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }: PeriodState) {
  const p = resolvePeriod(period, customFrom, customTo);
  const ledger = useLedger(['invoices', 'payments', 'expenses']);
  const plHref = `/finance/reports?report=pl&period=${p.id}${p.id === 'custom' ? `&from=${p.from}&to=${p.to}` : ''}`;
  const pickPeriod = (v: PeriodType) => {
    if (v === 'custom' && !(customFrom && customTo)) { setCustomFrom(p.from); setCustomTo(p.to); }
    setPeriod(v);
  };

  return (
    <Stack>
      {/* The period is the tab's first content block (R3 toolbar), not a head action, so the head keeps one shape on every tab. */}
      <div className="tw-toolbar insights-period">
        <Segmented label="Period" value={period} onChange={pickPeriod} options={PERIOD_OPTIONS} />
        {period === 'custom' && (
          <span className="insights-custom">
            <input type="month" className="tw-input insights-month" aria-label="From month" value={p.from} max={p.to} onChange={e => e.target.value && setCustomFrom(e.target.value)} />
            <span className="insights-custom__to">to</span>
            <input type="month" className="tw-input insights-month" aria-label="To month" value={p.to} min={p.from} onChange={e => e.target.value && setCustomTo(e.target.value)} />
          </span>
        )}
        <span className="tw-toolbar__meta">Excl. VAT, cash basis, as in the P&amp;L</span>
      </div>
      {(ledger.loading || ledger.error || !ledger.data) ? (
        ledger.loading || !ledger.error
          ? <><div className="insights-skel insights-skel--margin" aria-busy="true" aria-label="Loading" /><div className="insights-skel insights-skel--card" aria-hidden="true" /></>
          : <TabState loading={false} error onRetry={ledger.retry} />
      ) : (() => {
        const r = marginFromLedger(ledger.data, p);
        const { shown, before, after } = chartMonths(r.months);
        const span = periodText(p);
        const withPending = r.net - r.pending;
        const partial = ledger.data.partial.length ? ` Based on the ${ledger.data.partial.join(', ')}.` : '';
        const crossYear = shown.length > 0 && shown[0].ym.slice(0, 4) !== shown[shown.length - 1].ym.slice(0, 4);
        const label = (ym: string, k: number) => (crossYear && (k === 0 || ym.endsWith('-01')) ? monthYear(ym) : monthName(ym));
        const gap = (list: string[]) => (list.length === 1 ? monthYear(list[0]) : monthSpan(list[0], list[list.length - 1]));
        const empties = [before.length ? gap(before) : '', after.length ? gap(after) : ''].filter(Boolean);
        const trimNote = empties.length
          ? `No entries in ${empties.join(' or ')}, so ${before.length + after.length === 1 ? 'that month is' : 'those months are'} not drawn; the total covers all of ${span}.`
          : undefined;
        const extremes = shown.filter(m => m.revenue !== 0 || m.costs !== 0);
        const best = extremes.reduce<MarginMonth | null>((b, m) => (b == null || m.net > b.net ? m : b), null);
        const worst = extremes.reduce<MarginMonth | null>((b, m) => (b == null || m.net < b.net ? m : b), null);
        return (
          <>
            <InsightCard
              title="Profit this period"
              description={`${span} · excl. VAT, cash basis`}
              info={`The Profit and loss report's default basis, from the same ledgers. Revenue: money received from customers by payment date, less the VAT share of each invoice. Costs: approved expenses by expense date. Pending costs are expenses dated in the period still waiting for approval; the P&L lists them below the result and does not deduct them.${partial}`}
              action={<Link className="ic-text-button" to={plHref}>Open the P&amp;L</Link>}
            >
              {r.revenue === 0 && r.costs === 0 && r.pending === 0 ? (
                <div className="insights-empty">
                  <p>Nothing received or approved in {span}.</p>
                  {period !== 'last-12' && <button type="button" className="ic-text-button" onClick={() => setPeriod('last-12')}>Show the last 12 months</button>}
                </div>
              ) : (
                <>
                  <dl className="ic-kpis ic-kpis--4 insights-kpis">
                    <KpiTile label="Revenue" value={rand(r.revenue, 0)} note={plural(r.paymentCount, 'payment')} />
                    <KpiTile label="Approved costs" value={rand(r.costs, 0)} />
                    <KpiTile label="Net margin" value={r.pct != null ? formatPercent(r.pct) : rand(r.net, 0)} tone={r.net < 0 ? 'danger' : undefined} note={r.pct != null ? rand(r.net, 0) : undefined} />
                    {r.pending > 0
                      ? <KpiTile label="With pending costs" value={rand(withPending, 0)} tone={withPending < 0 ? 'danger' : undefined} note={`${rand(r.pending, 0)} not approved (${r.pendingCount})`} />
                      : <KpiTile label="Pending costs" value={rand(0, 0)} note="Every cost is approved" />}
                  </dl>
                  {/* The tiles above carry every figure; the bridge shows the shape, values live in the tooltip and table. */}
                  <Waterfall
                    height={220}
                    values="none"
                    valueHeader="Amount"
                    caption={`Revenue, costs and net margin, ${span}, excl. VAT, cash basis`}
                    ariaLabel={`Revenue ${rand(r.revenue)}, minus approved costs ${rand(r.costs)}, leaves ${rand(r.net)}.${r.pending > 0 ? ` Pending costs of ${rand(r.pending)} would leave ${rand(withPending)}.` : ''}`}
                    steps={[
                      { label: 'Revenue', value: r.revenue, kind: 'total' },
                      { label: 'Approved costs', value: -r.costs, kind: 'delta', tone: 'cost' },
                      { label: 'Net margin', value: r.net, kind: 'total' },
                      ...(r.pending > 0 ? [
                        { label: 'Pending costs', value: -r.pending, kind: 'delta' as const, tone: 'cost' as const },
                        { label: 'If approved', value: withPending, kind: 'total' as const },
                      ] : []),
                    ]}
                  />
                </>
              )}
            </InsightCard>

            {shown.length > 1 && (
              <InsightCard
                title="Net margin by month"
                description={`${span}, adding up to ${rand(r.net, 0)}`}
                info={`Each month's revenue (money received, excl. VAT) less approved expenses, added to the months before. The bars add up to the period's net margin above and to the Net profit line of the P&L.${partial}`}
              >
                <Waterfall
                  height={260}
                  values="all"
                  valueHeader="Net margin"
                  caption={`Net margin per month and the running total, ${span}, excl. VAT, cash basis`}
                  note={trimNote}
                  ariaLabel={`Net margin by month, ${span}, adding up to ${rand(r.net)}.${best && best.net > 0 ? ` Best month ${monthYear(best.ym)} ${rand(best.net)}.` : ''}${worst && worst.net < 0 ? ` Worst month ${monthYear(worst.ym)} ${rand(worst.net)}.` : ''}`}
                  steps={[
                    ...shown.map((m, k) => ({
                      label: label(m.ym, k),
                      value: m.net,
                      kind: 'delta' as const,
                      emptyText: m.revenue === 0 && m.costs === 0 ? 'Nothing received or approved' : undefined,
                      detail: `Revenue ${rand(m.revenue)}, costs ${rand(m.costs)}`,
                    })),
                    { label: 'Total', value: r.net, kind: 'total' as const },
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

/** One line: which lane to push and which sits below the fleet's rate (lanes with enough trips only). */
function laneTakeaway(points: ReturnType<typeof lanePoints>['points'], overall: number | null): string {
  const ev = points.filter(p => !p.thin).sort((a, b) => b.perKm - a.perKm);
  if (points.length === 0) return 'Revenue per kilometre against trip length';
  if (ev.length === 0 || !overall) return `No lane has ${MIN_TRIPS} trips yet, so none can be judged; each dot's rate is in the table.`;
  const vs = (v: number) => Math.round((v / overall - 1) * 100);
  const top = ev[0];
  const low = ev.length > 1 ? ev[ev.length - 1] : null;
  const head = vs(top.perKm) > 0
    ? `${top.label} earns ${rand(top.perKm, 0)}/km, ${vs(top.perKm)}% above your average`
    : `Your best-evidenced lane, ${top.label}, earns ${rand(top.perKm, 0)}/km, ${Math.abs(vs(top.perKm))}% below your average`;
  if (!low) return `${head}.`;
  return vs(low.perKm) < 0
    ? `${head}; ${low.label} is ${Math.abs(vs(low.perKm))}% below it.`
    : `${head}; ${low.label} earns ${rand(low.perKm, 0)}/km.`;
}

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
        description="Revenue per kilometre against trip length"
        info={`Revenue per kilometre against trip length, from every load with a pickup city, delivery city and distance. Shorter trips usually earn more per kilometre, so compare lanes of similar length. Lanes with fewer than ${MIN_TRIPS} trips are drawn hollow.${noDistance > 0 ? ` ${plural(noDistance, 'lane')} without a distance ${noDistance === 1 ? 'is' : 'are'} left out.` : ''}${partial}`}
      >
        {points.length === 0 ? (
          <div className="insights-empty">
            <p>No loads with a route and distance yet.</p>
            <Link className="ic-text-button" to="/bookings/quotes/new">Quote a load</Link>
          </div>
        ) : (
          <>
            <p className="insights-takeaway">{laneTakeaway(points, overall)}</p>
            <LaneScatter points={points} overallPerKm={overall} minTrips={MIN_TRIPS} />
          </>
        )}
      </InsightCard>
    </Stack>
  );
}
