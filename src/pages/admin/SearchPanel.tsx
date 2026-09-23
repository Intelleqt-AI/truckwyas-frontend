import '@/pages/table-heading-roles.css';
import '@/pages/admin/admin-brand.css';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Cross-tenant lookup for support: "does quote/order #X exist, and whose is
// it" — no navigation, this app has no cross-tenant deep-links from an admin
// session, so the rows are just read-off info for the person on the call.

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 400,
  fontFamily: 'var(--font-sans)', minHeight: 40, width: '100%', maxWidth: 360,
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' };
const tdStyle: React.CSSProperties = {
  padding: '12px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'active',
  grace_period: 'active',
  suspended: 'delayed',
  cancelled: 'delayed',
  trialing: 'warning',
  none: 'warning',
};

function ResultTable({ title, rows, numberKey }: { title: string; rows: any[]; numberKey: 'quote_number' | 'load_number' }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0, marginBottom: 8 }}>
        {title} {rows.length > 0 ? `(${rows.length})` : ''}
      </h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>No matches.</div>
      ) : (
        <div className="admin-scroll-region" role="region" aria-label={title} tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Number</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Company</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...tdStyle, fontSize: 13, fontFamily: 'var(--font-mono)' }}>{r[numberKey]}</td>
                  <td style={tdStyle}>
                    <span className={`status-badge ${STATUS_BADGE_CLASS[String(r.status).toLowerCase()] || ''}`}>{r.status}</span>
                  </td>
                  <td style={tdStyle}>{r.company_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-search', debouncedQuery],
    queryFn: () => fetchData(`api/v1/admin/search/?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length > 0,
  });

  const quotes: any[] = data?.quotes || [];
  const loads: any[] = data?.loads || [];
  const hasSearched = debouncedQuery.length > 0;

  return (
    <div className="card" style={cardStyle}>
      <h2 style={sectionTitleStyle}>Quote and order lookup</h2>
      <input
        className="admin-control"
        style={{ ...inputStyle, marginBottom: 16 }}
        aria-label="Search quote or order number"
        placeholder="Search quote/order number…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {!hasSearched ? (
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>Enter a quote or order number to search across every company.</div>
      ) : isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, opacity: isFetching ? 0.6 : 1 }}>
          <ResultTable title="Quotes" rows={quotes} numberKey="quote_number" />
          <ResultTable title="Orders" rows={loads} numberKey="load_number" />
        </div>
      )}
    </div>
  );
}
