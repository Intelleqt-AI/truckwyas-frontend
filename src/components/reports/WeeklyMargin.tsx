import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { actualMarginText, ptsText, reportMoney, reportPct } from '@/lib/followups';
import { formatDateShort, formatDate } from '@/lib/formatters';
import '@/components/followups/followups.css';
import { Empty, Info, ReportFrame, ReportState, Seg, StatementTable, Tiles, statementCsv, type Statement } from './ui';

/* Weekly margin (quote follow-ups §5): exactly the figures the Monday 07:00
   email shows (GET reports/weekly-margin/). Null is no data ("—", never 0);
   actual margin counts only loads with recorded costs. */

interface GroupRow {
  name: string; loads: number; quoted_loads: number; quoted_margin_zar: number | null; quoted_margin_pct: number | null;
  actual_loads: number; actual_revenue_zar: number | null; actual_margin_zar: number | null; actual_margin_pct: number | null;
}
interface Block {
  totals: GroupRow; enough_data: boolean; enough_actuals: boolean;
  by_lane: GroupRow[]; lanes_total: number; by_customer: GroupRow[]; customers_total: number;
}
interface QuoteStats {
  won: number; lost: number; won_value_zar: number; win_rate_pct: number | null;
  avg_quoted_margin_won_pct: number | null; target_margin_pct: number; vs_target_pts: number | null;
}
interface WeeklyMarginData {
  week: { start: string; end: string }; four_weeks: { start: string; end: string }; target_margin_pct: number;
  last_week: Block; last_4_weeks: Block; worst_lanes: GroupRow[];
  quotes: { last_week: QuoteStats; last_4_weeks: QuoteStats };
  average_margin: { quoted_won_4_weeks_pct: number | null; actual_4_weeks_pct: number | null; target_pct: number; actual_vs_target_pts: number | null };
  has_activity: boolean; notes: { actual_cost: string; revenue: string };
}

type Span = 'week' | 'four';
const range = (a: string, b: string) => `${formatDateShort(a)} to ${formatDate(b)}`;

function groupTable(rows: GroupRow[], first: string, block: Block): Statement {
  return {
    columns: [{ label: first }, { label: 'Loads', type: 'int', phone: false }, { label: 'Quoted margin' }, { label: 'Actual margin' }],
    rows: rows.map(r => ({
      key: r.name,
      cells: [r.name, r.loads, reportPct(r.quoted_margin_pct),
        block.enough_actuals ? actualMarginText(r) : 'No actual costs recorded yet'],
    })),
  };
}

export function WeeklyMargin({ companyName }: { companyName?: string }) {
  const [span, setSpan] = useState<Span>('week');
  const q = useQuery<WeeklyMarginData>({
    queryKey: ['reports', 'weekly-margin'],
    queryFn: () => fetchData('api/v1/reports/weekly-margin/'),
    staleTime: 5 * 60_000,
  });
  if (!q.data) return <ReportState loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} />;
  const d = q.data;
  const block = span === 'week' ? d.last_week : d.last_4_weeks;
  const quotes = span === 'week' ? d.quotes.last_week : d.quotes.last_4_weeks;
  const period = span === 'week' ? range(d.week.start, d.week.end) : range(d.four_weeks.start, d.four_weeks.end);
  const lanes = groupTable(block.by_lane, 'Lane', block);
  const customers = groupTable(block.by_customer, 'Customer', block);
  const avg = d.average_margin;

  return (
    <ReportFrame
      title="Weekly margin"
      sub={`${period} · excl. VAT · target ${reportPct(d.target_margin_pct).replace(',0%', '%')}`}
      companyName={companyName}
      info={<Info title="Weekly margin" lines={[d.notes.actual_cost, d.notes.revenue, 'The same figures as the Monday email to admins.']} />}
      controls={<Seg<Span> label="Period" value={span} onChange={setSpan} options={[{ id: 'week', label: 'Last week' }, { id: 'four', label: 'Last 4 weeks' }]} />}
      tiles={d.has_activity ? <Tiles tiles={[
        { label: 'Quoted margin on won quotes', value: reportPct(quotes.avg_quoted_margin_won_pct), note: quotes.vs_target_pts != null ? `${ptsText(quotes.vs_target_pts)} against target` : undefined },
        { label: 'Actual margin, 4 weeks', value: block.enough_actuals || d.last_4_weeks.enough_actuals ? reportPct(avg.actual_4_weeks_pct) : '—', note: avg.actual_vs_target_pts != null ? `${ptsText(avg.actual_vs_target_pts)} against target` : 'No actual costs recorded yet' },
        { label: 'Quotes won', value: `${quotes.won} of ${quotes.won + quotes.lost}`, note: quotes.win_rate_pct != null ? `${reportPct(quotes.win_rate_pct)} win rate` : undefined },
        { label: 'Won value', value: reportMoney(quotes.won_value_zar) },
      ]} /> : undefined}
      gaps={d.worst_lanes.length ? [`Losing money over 4 weeks: ${d.worst_lanes.map(l => `${l.name} (${reportMoney(l.actual_margin_zar)})`).join(', ')}.`] : undefined}
      csv={() => [...statementCsv('Weekly margin by lane', period, lanes), [], ...statementCsv('Weekly margin by customer', period, customers)]}
      csvName="weekly-margin"
    >
      {!d.has_activity ? <Empty line="Nothing quoted or delivered in the last 4 weeks." action={{ label: 'See quotes', to: '/bookings/quotes' }} />
        : !block.enough_data ? <Empty line="Not enough data yet." />
        : (
          <>
            <StatementTable cue={null} table={lanes} caption="By lane" />
            <StatementTable cue={null} table={customers} caption="By customer" footer={<p className="fu-report-note">{d.notes.actual_cost} {d.notes.revenue}</p>} />
          </>
        )}
    </ReportFrame>
  );
}

export default WeeklyMargin;
