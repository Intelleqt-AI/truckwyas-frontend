import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { money, moneyWhole, pct, plural } from './data';
import { Check, Empty, Info, ReportFrame, ReportState, StatementTable, Tiles, statementCsv, type SRow, type Statement } from './ui';

/* Lane margin from the backend (reports/margin-by-lane/): invoiced revenue
   excl. VAT net of credit notes, less load- and trip-linked expenses excl.
   VAT. Where a load has no expense, the backend's cost model fills in and
   says so; those figures are drawn as estimates, never like recorded ones. */

type Basis = 'actual' | 'estimate' | 'mixed';
interface LaneRow {
  lane: string; loads: number;
  revenue_excl_vat: number; revenue_basis: Basis; loads_invoiced: number; loads_uninvoiced: number;
  cost: number | null; margin: number | null; margin_pct: number | null;
  actual_cost: number | null; estimated_cost: number | null;
  cost_basis: Basis; loads_actual_cost: number; loads_estimated_cost: number; loads_no_cost: number;
  revenue_per_km: number | null;
}
interface LaneResponse {
  lanes: LaneRow[];
  summary: {
    lane_count: number; total_revenue_excl_vat: number; revenue_basis: Basis; cost_basis: Basis;
    loads_actual_cost: number; loads_estimated_cost: number; loads_no_cost: number;
    best_lane: { lane: string; margin_pct: number } | null; worst_lane: { lane: string; margin_pct: number } | null;
  };
}

const EST_COST = 'Estimated cost: no expense is linked to these loads yet, so TruckWys modelled the cost from distance, fuel price and your vehicle costs. Link expenses to loads to replace it with actuals.';
const EST_REV = 'Estimated revenue: these loads are not invoiced yet, so the agreed load price (excl. VAT) is used.';

/** "Actual", "Estimate", or "Mixed: 3 of 5 loads costed from expenses". */
function costBasisText(r: Pick<LaneRow, 'cost_basis' | 'loads_actual_cost' | 'loads_estimated_cost'>) {
  if (r.cost_basis === 'actual') return 'Actual';
  if (r.cost_basis === 'estimate') return 'Estimate';
  const n = r.loads_actual_cost + r.loads_estimated_cost;
  return `Mixed: ${r.loads_actual_cost} of ${plural(n, 'load')} costed from expenses`;
}

export function LaneMargin({ companyName }: { companyName?: string }) {
  const q = useQuery<LaneResponse>({
    queryKey: ['reports', 'margin-by-lane'],
    queryFn: () => fetchData('api/v1/reports/margin-by-lane/?limit=100'),
    staleTime: 5 * 60_000,
  });
  if (!q.data) return <ReportState loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} />;
  const { lanes, summary } = q.data;

  const rows: SRow[] = lanes.map(l => {
    const costEst = l.cost_basis !== 'actual';
    const revEst = l.revenue_basis !== 'actual';
    const costTip = l.cost_basis === 'mixed'
      ? `${costBasisText(l)}. ${l.estimated_cost != null ? `${money(l.estimated_cost)} of the cost is estimated. ` : ''}${EST_COST}`
      : EST_COST;
    const revTip = l.revenue_basis === 'mixed' ? `${l.loads_uninvoiced} of ${plural(l.loads, 'load')} not invoiced yet. ${EST_REV}` : EST_REV;
    return {
      key: l.lane,
      cells: [l.lane, l.loads, l.revenue_excl_vat, l.cost, l.margin, l.margin_pct, costBasisText(l)],
      flags: {
        ...(revEst ? { 2: { est: true, title: revTip } } : {}),
        ...(costEst && l.cost != null ? { 3: { est: true, title: costTip }, 4: { est: true, title: 'Margin uses an estimated cost or revenue; see the cost and revenue cells.' }, 5: { est: true, title: 'Margin uses an estimated cost or revenue.' }, 6: { est: false, title: costTip } } : {}),
        ...(!costEst && revEst && l.margin != null ? { 4: { est: true, title: revTip }, 5: { est: true, title: revTip } } : {}),
      },
    };
  });
  const totalRev = summary.total_revenue_excl_vat;
  const costed = lanes.filter(l => l.cost != null);
  const totalCost = costed.reduce((s, l) => s + (l.cost ?? 0), 0);
  const costedRev = costed.reduce((s, l) => s + l.revenue_excl_vat, 0);
  const totalMargin = costed.length ? costedRev - totalCost : null;
  const anyEst = summary.loads_estimated_cost > 0 || summary.revenue_basis !== 'actual';
  const table: Statement = {
    columns: [
      { label: 'Lane' }, { label: 'Loads', type: 'int', phone: false }, { label: 'Revenue excl. VAT', type: 'money' },
      { label: 'Cost excl. VAT', type: 'money' }, { label: 'Margin', type: 'money' }, { label: 'Margin %', type: 'pct' }, { label: 'Cost basis', phone: false },
    ],
    rows: [
      ...rows,
      {
        key: 'tot', kind: 'grand',
        cells: ['Total', lanes.reduce((s, l) => s + l.loads, 0), totalRev, costed.length ? totalCost : null, totalMargin, totalMargin != null && costedRev > 0 ? (totalMargin / costedRev) * 100 : null, costBasisText(summary)],
        flags: anyEst ? { 3: { est: summary.cost_basis !== 'actual', title: EST_COST }, 4: { est: true, title: 'Includes estimated figures.' } } : undefined,
      },
    ],
  };
  const totalLoads = summary.loads_actual_cost + summary.loads_estimated_cost + summary.loads_no_cost;

  return (
    <ReportFrame
      title="Lane margin"
      sub="All delivered loads · excl. VAT, actual vs estimate"
      companyName={companyName}
      info={<Info title="Lane margin" lines={[
        'Revenue: what was invoiced for the lane\'s loads, excl. VAT, less credit notes. A load not invoiced yet counts at its agreed price and is marked est.',
        'Cost: expenses linked to the load or its trip, excl. VAT. A load with no linked expense is costed by the cost model and marked est.',
        'Cost basis: Actual (every load costed from expenses), Estimate (none), or Mixed (some), with the count.',
        'Margin % is over the revenue of the loads that could be costed. Delivered, completed, invoiced and in-transit loads, all dates.',
      ]} />}
      tiles={lanes.length ? <Tiles table={table} tiles={[
        { label: 'Costed from expenses', value: `${summary.loads_actual_cost} of ${totalLoads}`, note: summary.loads_estimated_cost ? `${plural(summary.loads_estimated_cost, 'load')} estimated` : 'No estimates' },
        ...(summary.best_lane ? [{ label: 'Best lane', value: pct(summary.best_lane.margin_pct, 0), note: summary.best_lane.lane }] : []),
        ...(summary.worst_lane && summary.worst_lane.lane !== summary.best_lane?.lane ? [{ label: 'Weakest lane', value: pct(summary.worst_lane.margin_pct, 0), note: summary.worst_lane.lane }] : []),
        { label: 'Revenue excl. VAT', value: moneyWhole(totalRev), title: money(totalRev), amount: totalRev },
      ]} /> : undefined}
      gaps={summary.loads_estimated_cost > 0 ? [`${plural(summary.loads_estimated_cost, 'load')} ${summary.loads_estimated_cost === 1 ? 'has' : 'have'} no linked expense, so ${summary.loads_estimated_cost === 1 ? 'its' : 'their'} cost is estimated (shown as est.).`] : undefined}
      csv={() => statementCsv('Lane margin', 'Excl. VAT; est. = modelled cost or uninvoiced load price', {
        ...table,
        columns: [...table.columns, { label: 'Revenue basis' }, { label: 'Loads costed from expenses' }, { label: 'Loads with estimated cost' }],
        rows: table.rows.map((r, i) => (i < lanes.length
          ? { ...r, cells: [...r.cells, lanes[i].revenue_basis, lanes[i].loads_actual_cost, lanes[i].loads_estimated_cost] }
          : { ...r, cells: [...r.cells, summary.revenue_basis, summary.loads_actual_cost, summary.loads_estimated_cost] })),
      })}
      csvName="lane-margin"
    >
      {lanes.length === 0 ? <Empty line="No delivered loads with a route yet." action={{ label: 'See orders', to: '/bookings/orders' }} /> : (
        <StatementTable cue={null} table={table} caption="Lane margin"
          footer={<>
            <Check>Revenue is invoiced, excl. VAT and net of credit notes; costs are excl. VAT.</Check>
            {anyEst && <Check ok={false}>Figures marked est. are modelled, not recorded. Link expenses to loads to make them actual.</Check>}
          </>} />
      )}
    </ReportFrame>
  );
}

export default LaneMargin;
