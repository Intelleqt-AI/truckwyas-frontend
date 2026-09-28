import '@/pages/table-heading-roles.css';
import '@/pages/admin/admin-brand.css';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import { formatDateTime } from '@/lib/formatters';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';

// "Is Celery beat actually running" at a glance. A task that has never
// started, or whose last_started_at looks old, is the signal that matters —
// we surface the raw timestamp and a status pill and let the human judge
// staleness rather than computing it client-side.

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' };
const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};

const fmt = (dateStr?: string | null) => (dateStr ? formatDateTime(dateStr) : 'Never');

// "run_monthly_subscription_billing" -> "Run monthly subscription billing".
const taskLabel = (name: string) => {
  const t = name.replace(/_task$/, '').replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

interface JobHealthRow {
  task_name: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success: boolean | null;
  last_error: string | null;
}

function StatusPill({ row }: { row: JobHealthRow }) {
  if (row.last_started_at === null) {
    return <StatusChip tone="neutral" label="Never run" size="sm" />;
  }
  if (row.last_success === true) return <StatusChip tone="success" label="OK" size="sm" />;
  if (row.last_success === false) return <StatusChip tone="danger" label="Failed" size="sm" />;
  return <StatusChip tone="neutral" label="Unknown" size="sm" />;
}

export default function JobHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-job-health'],
    queryFn: () => fetchData('api/v1/admin/job-health/'),
    refetchInterval: 60_000,
  });

  const results: JobHealthRow[] = data?.results || [];
  // Columns that would be empty on every row are left out, so the table
  // fits its card and nothing is clipped.
  const anyFinished = results.some(r => r.last_finished_at);
  const anyError = results.some(r => r.last_error);
  const colCount = 3 + (anyFinished ? 1 : 0) + (anyError ? 1 : 0);
  const neverRun = results.filter(r => r.last_started_at === null).length;

  return (
    <div className="card" style={cardStyle}>
      <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Scheduled job health</h2>
      <p className="admin-job-summary" style={{ margin: '0 0 16px', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
        {isLoading ? <span className="ops-skel" style={{ display: 'inline-block', width: '70%', height: 12 }} /> : results.length === 0 ? 'No tracked tasks reported.'
          : neverRun === results.length ? `None of the ${results.length} tasks has run yet. Check that the scheduler is running.`
          : neverRun ? `${neverRun} of ${results.length} tasks have never run.` : `All ${results.length} tasks have run.`}
      </p>
      {(
        <div className="admin-scroll-region" role="region" aria-label="Scheduled job health" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last started</th>
                {anyFinished && <th style={thStyle}>Last finished</th>}
                {anyError && <th style={thStyle}>Last error</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows rows={9} cols={3} />}
              {results.map(row => (
                <tr key={row.task_name}>
                  <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${taskLabel(row.task_name)} (${row.task_name})`}>{taskLabel(row.task_name)}</td>
                  <td style={tdStyle}><StatusPill row={row} /></td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: row.last_started_at ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {fmt(row.last_started_at)}
                  </td>
                  {anyFinished && <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: row.last_finished_at ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{fmt(row.last_finished_at)}</td>}
                  {anyError && (
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.last_error || undefined}>
                      {row.last_error || <span style={{ color: 'var(--text-tertiary)' }}>None</span>}
                    </td>
                  )}
                </tr>
              ))}
              {!isLoading && results.length === 0 && (
                <tr><td style={tdStyle} colSpan={colCount}>No tracked tasks reported.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
