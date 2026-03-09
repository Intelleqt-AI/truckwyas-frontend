import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent-primary)',
  INACTIVE: 'var(--text-tertiary)',
  ON_LEAVE: 'var(--status-warning)',
};

const Row = ({ label, value, mono = true, alert = false }: { label: string; value: any; mono?: boolean; alert?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-row)' }}>
    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{
      fontSize: 12,
      color: alert ? 'var(--status-danger)' : 'var(--text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      maxWidth: 260, textAlign: 'right',
    }}>{value ?? '—'}</span>
  </div>
);

export default function DriverProfile() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: () => fetchData(`api/v1/drivers/${driverId}/`),
    enabled: !!driverId,
  });

  const { data: loadsData } = useQuery({
    queryKey: ['driver-loads', driverId],
    queryFn: () => fetchData(`api/v1/loads/?driver=${driverId}&page_size=50`),
    enabled: !!driverId,
  });

  if (isLoading) return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 10, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '12%' }} />
        <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '10%' }} />
        <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '25%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ height: 10, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '50%' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[1, 2].map(i => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 16, width: '30%' }} />
            {[1, 2, 3, 4, 5].map(j => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-row)' }}>
                <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, width: '35%' }} />
                <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, width: '25%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  if (!driver) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
        <circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>Driver not found</div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 20 }}>This driver may have been removed or the link is incorrect</div>
      <button className="btn-action" onClick={() => navigate('/fleet/drivers')}>← BACK TO DRIVERS</button>
    </div>
  );

  const name = driver.first_name && driver.last_name
    ? `${driver.first_name} ${driver.last_name}`
    : driver.name || driver.username || `Driver ${driver.id}`;

  const loads = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const delivered = loads.filter((l: any) => l.status === 'DELIVERED');
  const totalRevenue = delivered.reduce((s: number, l: any) => s + parseFloat(l.total_amount || '0'), 0);
  const totalDistance = delivered.reduce((s: number, l: any) => s + parseFloat(l.distance || '0'), 0);
  const avgRevPerTrip = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  const statusColor = STATUS_COLOR[driver.status] || 'var(--text-tertiary)';

  const kpis = [
    { label: 'Total Trips', value: driver.total_trips ?? delivered.length, color: 'var(--text-primary)', suffix: '' },
    { label: 'Revenue Generated', value: formatZAR(driver.revenue_generated ?? totalRevenue), color: 'var(--accent-primary)', suffix: '' },
    { label: 'Avg per Trip', value: formatZAR(driver.avg_revenue_per_trip ?? avgRevPerTrip), color: 'var(--text-primary)', suffix: '' },
    { label: 'Total Distance', value: driver.total_distance ?? Math.round(totalDistance), color: 'var(--text-primary)', suffix: ' km' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate('/fleet/drivers')}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >← BACK TO DRIVERS</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Driver</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
            {driver.license_number && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {driver.license_number}
                {driver.phone ? ` · ${driver.phone}` : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DRIVER_STATUSES.map(s => {
              const isCurrentStatus = driver.status === s;
              const btnColor = STATUS_COLOR[s] || 'var(--text-tertiary)';
              return (
                <button
                  key={s}
                  disabled={isCurrentStatus || updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await patchData({ url: `api/v1/drivers/${driverId}/`, data: { status: s } });
                      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
                    } catch (_) { /* handled by query invalidation */ }
                    setUpdating(false);
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: isCurrentStatus ? 'var(--bg-deep)' : btnColor,
                    background: isCurrentStatus ? btnColor : 'transparent',
                    padding: '5px 10px',
                    border: `1px solid ${btnColor}`, borderRadius: 2,
                    cursor: isCurrentStatus || updating ? 'default' : 'pointer',
                    opacity: updating && !isCurrentStatus ? 0.5 : 1,
                    letterSpacing: '0.04em',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="card metric-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>
              {k.value}{k.suffix && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{k.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Details */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Details</div>
          <Row label="License Number" value={driver.license_number} />
          <Row label="Phone" value={driver.phone} mono={false} />
          <Row label="Email" value={driver.email} mono={false} />
          <Row label="ID Number" value={driver.id_number} />
          <Row label="Date of Birth" value={driver.date_of_birth?.slice(0, 10)} />
          <Row label="Address" value={driver.address} mono={false} />
          <Row label="Vehicle" value={driver.vehicle_plate || driver.assigned_vehicle || '—'} />
        </div>

        {/* Performance */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Performance</div>
          <Row label="Efficiency Score" value={driver.efficiency_score ?? '—'} />
          <Row label="On-Time Rate" value={driver.on_time_rate ? `${driver.on_time_rate}%` : '—'} />
          <Row label="Avg Rating" value={driver.avg_rating ? `★ ${driver.avg_rating}` : '—'} />
          <Row label="Trips This Month" value={driver.trips_this_month ?? 0} />
          <Row label="Total Trips" value={driver.total_trips ?? delivered.length} />
          <Row label="Total Distance" value={driver.total_distance ? `${parseFloat(driver.total_distance).toLocaleString('en-ZA')} km` : totalDistance > 0 ? `${Math.round(totalDistance).toLocaleString('en-ZA')} km` : '—'} />
          <Row
            label="License Expiry"
            value={driver.license_expiry?.slice(0, 10) || '—'}
            alert={driver.license_expiry && new Date(driver.license_expiry) < new Date()}
          />
        </div>
      </div>

      {/* Recent Loads */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Recent Loads ({loads.length})</div>
        {loads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }}>
              <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-1" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>No loads recorded yet</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loads assigned to this driver will appear here</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Load #', 'Route', 'Distance', 'Revenue', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loads.slice(0, 10).map((load: any, idx: number) => (
                <tr
                  key={load.id}
                  style={{ cursor: 'pointer', borderBottom: idx < Math.min(loads.length, 10) - 1 ? '1px solid var(--border-row)' : 'none' }}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                    {load.load_number}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {load.pickup_city || '—'} → {load.delivery_city || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {load.distance ? `${parseFloat(load.distance).toFixed(0)} km` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>
                    {load.total_amount ? formatZAR(parseFloat(load.total_amount)) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                      color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--accent-primary)' : load.status === 'IN_TRANSIT' ? 'var(--status-warning)' : 'var(--text-tertiary)',
                    }}>{load.status?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {load.created_at?.slice(0, 10) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
