import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';
import PaginationControls from '@/pages/admin/PaginationControls';

// Who-did-what-when trail for every write action the rest of the admin
// dashboard performs (demo reset, etc.) — most recent first, searchable and
// paginated server-side since this can grow well past a single page.

const PAGE_SIZE = 20;

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', width: 260,
};
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A narrower search can leave `page` pointing past the new result set's
  // end — reset to page 1 whenever it changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-log', debouncedSearch, page],
    queryFn: () =>
      fetchData(
        `api/v1/admin/audit-log/?search=${encodeURIComponent(debouncedSearch)}&page=${page}&page_size=${PAGE_SIZE}`
      ),
  });

  const results: AuditLogRow[] = data?.results || [];

  return (
    <div className="card" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Audit Log {data ? `(${data.count})` : ''}</div>
        <input
          style={inputStyle}
          placeholder="Search actor, action, resource…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
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
                <tr><td style={tdStyle} colSpan={5}>No audit events match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <PaginationControls
          page={data.page || 1}
          numPages={data.num_pages || 1}
          count={data.count || 0}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => p + 1)}
        />
      )}
    </div>
  );
}
