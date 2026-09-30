import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// OpenAI token/cost usage for the quote AI price-analysis feature only (not
// a platform-wide LLM-cost dashboard — Copilot chat and the other ~11 LLM
// call sites elsewhere in the app don't track usage/cost yet).

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};

// Sub-$1 amounts round to "$0.00" at 2dp, which hides real per-user cost —
// use 4dp below $1, 2dp otherwise.
const formatUsd = (n: number) =>
  `$${(Math.abs(n) < 1 ? n.toFixed(4) : n.toFixed(2))}`;
const formatTokens = (n: number) => new Intl.NumberFormat('en-US').format(n);
const fmtDate = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

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

function TotalsRow({ label, totals }: { label: string; totals: Totals }) {
  return (
    <div className="card metric-card">
      <div className="card-header"><span className="card-title">{label}</span></div>
      <div className="metric-value" style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{formatUsd(totals.total_cost_usd)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        {totals.calls} calls ({totals.success_calls} ok, {totals.failed_calls} failed) · {formatTokens(totals.total_tokens)} tokens
      </div>
    </div>
  );
}

export default function AiUsagePanel() {
  const { data, isLoading } = useQuery<AiUsageResponse>({
    queryKey: ['admin-ai-usage'],
    queryFn: () => fetchData('api/v1/admin/ai-usage/'),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Loader size={28} />;
  if (!data) return null;

  const byUser = [...data.by_user].sort((a, b) => b.total_cost_usd - a.total_cost_usd);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TotalsRow label="All time" totals={data.all_time} />
        <TotalsRow label="This month" totals={data.this_month} />
      </div>

      <div className="card" style={cardStyle}>
        <div style={sectionTitleStyle}>AI price analysis — usage by user</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Calls</th>
                <th style={thStyle}>Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {byUser.map(row => (
                <tr key={row.user_id}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>{row.email}</td>
                  <td style={tdStyle}>{row.company_name || '—'}</td>
                  <td style={tdStyle}>{row.calls}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{formatUsd(row.total_cost_usd)}</td>
                </tr>
              ))}
              {byUser.length === 0 && (
                <tr><td style={tdStyle} colSpan={5}>No AI price-analysis calls yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.recent_failures.length > 0 && (
        <div className="card" style={cardStyle}>
          <div style={sectionTitleStyle}>Recent failures</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                {data.recent_failures.map(f => (
                  <tr key={f.id}>
                    <td style={tdStyle}>{fmtDate(f.created_at)}</td>
                    <td style={tdStyle}>{f.triggered_by__username || '—'}</td>
                    <td style={tdStyle}>{f.quote_id ?? '—'}</td>
                    <td style={tdStyle}>{f.failed_at_call || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 320 }}>{f.error_message}</td>
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
