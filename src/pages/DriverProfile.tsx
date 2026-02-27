import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";

export default function DriverProfile() {
  const { driverId } = useParams();
  const navigate = useNavigate();

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: () => fetchData(`api/v1/drivers/${driverId}/`),
    enabled: !!driverId,
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (!driver) return <div style={{ padding: 40 }}><div style={{ color: 'var(--text-tertiary)' }}>Driver not found.</div><button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/fleet/drivers')}>← BACK</button></div>;

  const name = driver.first_name && driver.last_name
    ? `${driver.first_name} ${driver.last_name}`
    : driver.user_name || driver.username || driver.name || `Driver ${driver.id}`;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/fleet/drivers')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO DRIVERS</button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Driver Profile</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{driver.status || 'ACTIVE'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Details</div>
          {[
            { label: 'License Number', value: driver.license_number || '—' },
            { label: 'Phone', value: driver.phone || '—' },
            { label: 'Email', value: driver.email || '—' },
            { label: 'Status', value: driver.status || 'ACTIVE' },
            { label: 'ID Number', value: driver.id_number || '—' },
            { label: 'Date of Birth', value: driver.date_of_birth?.slice(0,10) || '—' },
            { label: 'Address', value: driver.address || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Performance</div>
          {[
            { label: 'Total Trips', value: driver.total_trips || '—' },
            { label: 'On-Time Rate', value: driver.on_time_rate ? `${driver.on_time_rate}%` : '—' },
            { label: 'Avg Rating', value: driver.avg_rating ? `★ ${driver.avg_rating}` : '—' },
            { label: 'Total Distance', value: driver.total_distance ? `${driver.total_distance} km` : '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
