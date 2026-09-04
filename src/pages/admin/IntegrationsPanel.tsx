import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Platform-wide view of which companies have connected each third-party
// integration — a quick "who's on Xero / CtrlFleet" for support, not a
// per-company detail view.

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
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{count}</div>
      </div>
      {companies.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No companies connected.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
      <div style={sectionTitleStyle}>Integrations</div>
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
