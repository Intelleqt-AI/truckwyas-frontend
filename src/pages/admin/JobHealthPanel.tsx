import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// "Is Celery beat actually running" at a glance. A task that has never
// started, or whose last_started_at looks old, is the signal that matters —
// we surface the raw timestamp and a status pill and let the human judge
// staleness rather than computing it client-side.

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

interface JobHealthRow {
  task_name: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success: boolean | null;
  last_error: string | null;
}

function StatusPill({ row }: { row: JobHealthRow }) {
  if (row.last_started_at === null) {
    return <span className="status-badge warning">Never run</span>;
  }
  if (row.last_success === true) return <span className="status-badge active">OK</span>;
  if (row.last_success === false) return <span className="status-badge delayed">Failed</span>;
  return <span className="status-badge warning">Unknown</span>;
}

export default function JobHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-job-health'],
    queryFn: () => fetchData('api/v1/admin/job-health/'),
    refetchInterval: 60_000,
  });

  const results: JobHealthRow[] = data?.results || [];

  return (
    <div className="card" style={cardStyle}>
      <div style={sectionTitleStyle}>Celery Beat Job Health</div>
      {isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last started</th>
                <th style={thStyle}>Last finished</th>
                <th style={thStyle}>Last error</th>
              </tr>
            </thead>
            <tbody>
              {results.map(row => (
                <tr key={row.task_name}>
                  <td style={tdStyle}>{row.task_name}</td>
                  <td style={tdStyle}><StatusPill row={row} /></td>
                  <td style={{ ...tdStyle, color: row.last_started_at ? 'var(--text-primary)' : 'var(--status-warning)' }}>
                    {fmt(row.last_started_at)}
                  </td>
                  <td style={tdStyle}>{fmt(row.last_finished_at)}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 320 }}>
                    {row.last_error || ''}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td style={tdStyle} colSpan={5}>No tracked tasks reported.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
