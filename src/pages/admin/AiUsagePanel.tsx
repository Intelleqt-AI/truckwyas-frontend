import '@/pages/table-heading-roles.css';
import '@/pages/admin/admin-brand.css';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import { KpiStats } from '@/components/ui/KpiTile';
import { InfoTip } from '@/components/ui/InfoTip';
import { formatDateTime, formatNumber, MISSING } from '@/lib/formatters';

// OpenAI token/cost usage for the quote AI price-analysis feature only (not
// a platform-wide LLM-cost dashboard: Copilot chat and the other ~11 LLM
// call sites elsewhere in the app don't track usage/cost yet).

// Same table recipe as the other admin panels (JobHealthPanel, UsersTable).
const cardStyle: React.CSSProperties = { padding: 'var(--card-pad, 20px)' };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' };
const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const numStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const numThStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' };

// Sub-$1 amounts round to "$0,00" at 2dp, which hides real per-user cost:
// use 4dp below $1, 2dp otherwise. en-ZA figures ("US$ 0,0123").
const formatUsd = (n: number) => {
  const dp = Math.abs(n) < 1 ? 4 : 2;
  return `US$\u00A0${formatNumber(n, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};
const formatCount = (n: number) => formatNumber(n, { maximumFractionDigits: 0 });
const fmtDate = (dateStr?: string | null) => (dateStr ? formatDateTime(dateStr) : MISSING);

interface Totals { calls: number; success_calls: number; failed_calls: number; total_cost_usd: number; total_tokens: number; }
interface ByUserRow {
  user_id: number; name: string; email: string; company_id: number | null; company_name: string | null;
  calls: number; total_cost_usd: number;
}
interface RecentFailure {
  id: number; created_at: string; quote_id: number | null; failed_at_call: string; error_message: string; triggered_by__username: string | null;
}
interface AiUsageResponse {
  all_time: Totals; this_month: Totals;
  by_month: { month: string; total_calls: number; total_cost_usd: number }[];
  by_user: ByUserRow[];
  recent_failures: RecentFailure[];
}

const totalsNote = (t: Totals) =>
  `${formatCount(t.calls)} calls · ${formatCount(t.failed_calls)} failed · ${formatCount(t.total_tokens)} tokens`;

export default function AiUsagePanel() {
  const { data, isLoading } = useQuery<AiUsageResponse>({
    queryKey: ['admin-ai-usage'],
    queryFn: () => fetchData('api/v1/admin/ai-usage/'),
    refetchInterval: 60_000,
  });

  const byUser = [...(data?.by_user ?? [])].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  const failures = data?.recent_failures ?? [];

  return (
    <div style={{ display: 'grid', gap: 'var(--card-gap, 16px)' }}>
      {data && (
        <KpiStats
          title="AI price check cost"
          aria-label="AI price check cost"
          items={[
            { label: 'This month', figure: formatUsd(data.this_month.total_cost_usd), note: totalsNote(data.this_month) },
            { label: 'All time', figure: formatUsd(data.all_time.total_cost_usd), note: totalsNote(data.all_time) },
          ]}
        />
      )}

      <div className="card" style={cardStyle}>
        <h2 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          Usage by user
          <InfoTip label="What this counts">
            OpenAI cost of the quote builder's AI price check only. Copilot chat and other AI features aren't tracked here yet.
          </InfoTip>
        </h2>
        <div className="admin-scroll-region" role="region" aria-label="AI price check usage by user" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Company</th>
                <th style={numThStyle}>Calls</th>
                <th style={numThStyle}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows rows={5} cols={5} />}
              {byUser.map(row => (
                <tr key={row.user_id}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{row.email}</td>
                  <td style={tdStyle}>{row.company_name || MISSING}</td>
                  <td style={numStyle}>{formatCount(row.calls)}</td>
                  <td style={numStyle}>{formatUsd(row.total_cost_usd)}</td>
                </tr>
              ))}
              {!isLoading && byUser.length === 0 && (
                <tr><td style={{ ...tdStyle, color: 'var(--text-secondary)' }} colSpan={5}>No AI price checks yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="card" style={cardStyle}>
          <h2 style={sectionTitleStyle}>Recent failures</h2>
          <div className="admin-scroll-region" role="region" aria-label="Recent AI price check failures" tabIndex={0} style={{ overflowX: 'auto' }}>
            <table className="table-heading-roles admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Quote</th>
                  <th style={thStyle}>Failed at</th>
                  <th style={thStyle}>Error</th>
                </tr>
              </thead>
              <tbody>
                {failures.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(f.created_at)}</td>
                    <td style={tdStyle}>{f.triggered_by__username || MISSING}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{f.quote_id ?? MISSING}</td>
                    <td style={tdStyle}>{f.failed_at_call || MISSING}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--text-secondary)' }}>{f.error_message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
