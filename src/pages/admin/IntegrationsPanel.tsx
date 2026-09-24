import '@/pages/table-heading-roles.css';
import '@/pages/admin/admin-brand.css';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Platform-wide view of which companies have connected each third-party
// integration — a quick "who's on Xero / CtrlFleet" for support, not a
// per-company detail view.

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' };
const tdStyle: React.CSSProperties = {
  padding: '12px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

interface ConnectedCompany {
  id: string | number;
  company_name: string;
  xero_connected_at?: string | null;
  ctrlfleet_connected_at?: string | null;
}

function IntegrationTable({ title, count, companies, dateKey }: {
  title: string;
  count: number;
  companies: ConnectedCompany[];
  dateKey: 'xero_connected_at' | 'ctrlfleet_connected_at';
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
          {title}
        </h3>
        <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      </div>
      {companies.length === 0 ? (
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>No companies connected.</div>
      ) : (
        <div className="admin-scroll-region" role="region" aria-label={`${title} connected companies`} tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Connected since</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td style={tdStyle}>{c.company_name}</td>
                  <td style={tdStyle}>{fmt(c[dateKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-integrations-health'],
    queryFn: () => fetchData('api/v1/admin/integrations-health/'),
  });

  return (
    <div className="card" style={cardStyle}>
      <h2 style={sectionTitleStyle}>Integrations</h2>
      {isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          <IntegrationTable
            title="Xero"
            count={data?.xero_connected_count ?? 0}
            companies={data?.xero_connected_companies || []}
            dateKey="xero_connected_at"
          />
          <IntegrationTable
            title="CtrlFleet"
            count={data?.ctrlfleet_connected_count ?? 0}
            companies={data?.ctrlfleet_connected_companies || []}
            dateKey="ctrlfleet_connected_at"
          />
        </div>
      )}
    </div>
  );
}
