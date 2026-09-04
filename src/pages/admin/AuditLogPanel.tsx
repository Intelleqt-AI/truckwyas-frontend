import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Who-did-what-when trail for every write action the rest of the admin
// dashboard performs (demo reset, etc.) — most recent first, up to 100 rows.

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

interface AuditLogRow {
  id: string | number;
  actor: string | null;
  action: string;
  resource_type: string;
  resource_id: string | number | null;
  details: Record<string, any> | null;
  created_at: string;
}

// Renders {a: 1, b: 'x'} as "a: 1, b: x" — compact key:value pairs rather
// than raw JSON, but falls back to JSON.stringify for anything that isn't a
// plain flat object (nested objects/arrays, etc).
function formatDetails(details: Record<string, any> | null): string {
  if (!details || typeof details !== 'object') return '';
  const entries = Object.entries(details);
  if (entries.length === 0) return '';
  const isFlat = entries.every(([, v]) => v === null || typeof v !== 'object');
  if (isFlat) {
    return entries.map(([k, v]) => `${k}: ${v === null ? '—' : v}`).join(', ');
  }
  return JSON.stringify(details);
}

export default function AuditLogPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: () => fetchData('api/v1/admin/audit-log/'),
  });

  const results: AuditLogRow[] = data?.results || [];

  return (
    <div className="card" style={cardStyle}>
      <div style={sectionTitleStyle}>Audit Log {results.length > 0 ? `(${results.length})` : ''}</div>
      {isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>When</th>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Resource</th>
                <th style={thStyle}>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map(row => (
                <tr key={row.id}>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmt(row.created_at)}</td>
                  <td style={tdStyle}>{row.actor || <span style={{ color: 'var(--text-tertiary)' }}>system</span>}</td>
                  <td style={tdStyle}>{row.action}</td>
                  <td style={tdStyle}>
                    {row.resource_type}
                    {row.resource_id != null && <span style={{ color: 'var(--text-tertiary)' }}> #{row.resource_id}</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', maxWidth: 360 }}>
                    {formatDetails(row.details)}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td style={tdStyle} colSpan={5}>No audit events recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
