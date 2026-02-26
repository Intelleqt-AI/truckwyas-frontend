import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--accent-primary)',
  IN_USE: 'var(--status-warning)',
  MAINTENANCE: 'var(--status-danger)',
  OUT_OF_SERVICE: 'var(--text-tertiary)',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: () => fetchData('api/vehicles/') });
  const vehicles = data?.results || data || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Vehicles</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total', value: vehicles.length, color: 'var(--text-primary)' },
          { label: 'Available', value: vehicles.filter((v: any) => v.status === 'AVAILABLE').length, color: 'var(--accent-primary)' },
          { label: 'In Use', value: vehicles.filter((v: any) => v.status === 'IN_USE').length, color: 'var(--status-warning)' },
          { label: 'Maintenance', value: vehicles.filter((v: any) => v.status === 'MAINTENANCE').length, color: 'var(--status-danger)' },
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
            <tr><th>Plate</th><th>Make / Model</th><th>Type</th><th>Year</th><th>Capacity</th><th>Status</th><th className="text-right">Health</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>Loading...</td></tr>
            ) : vehicles.map((v: any) => (
              <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                <td className="mono">{v.plate}</td>
                <td>{v.make} {v.model}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{v.vehicle_type_name || v.type}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{v.year}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{parseFloat(v.capacity || '0').toFixed(0)} kg</td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[v.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                    {v.status?.replace('_', ' ')}
                  </span>
                </td>
                <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: v.ai_health_score > 70 ? 'var(--accent-primary)' : v.ai_health_score > 40 ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>
                  {v.ai_health_score || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
