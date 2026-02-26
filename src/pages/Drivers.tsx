import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent-primary)',
  ON_LEAVE: 'var(--status-warning)',
  INACTIVE: 'var(--text-tertiary)',
};

export default function Drivers() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['drivers'], queryFn: () => fetchData('api/drivers/') });
  const drivers = data?.results || data || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Drivers</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Drivers', value: drivers.length, color: 'var(--text-primary)' },
          { label: 'Active', value: drivers.filter((d: any) => d.status === 'ACTIVE').length, color: 'var(--accent-primary)' },
          { label: 'On Leave', value: drivers.filter((d: any) => d.status === 'ON_LEAVE').length, color: 'var(--status-warning)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 28, color: m.color }}>{isLoading ? '—' : m.value}</div>
          </div>
        ))}
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>License</th><th>Phone</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>Loading...</td></tr>
            ) : drivers.map((d: any) => (
              <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/drivers/${d.id}`)}>
                <td style={{ fontWeight: 500 }}>{d.first_name || d.user_name || d.username || d.name || `Driver ${d.id}`}</td>
                <td className="mono">{d.license_number || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{d.phone || '—'}</td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[d.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                    {d.status?.replace('_', ' ') || 'ACTIVE'}
                  </span>
                </td>
                <td className="text-right">
                  <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }} onClick={e => { e.stopPropagation(); navigate(`/fleet/drivers/${d.id}`); }}>VIEW</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
