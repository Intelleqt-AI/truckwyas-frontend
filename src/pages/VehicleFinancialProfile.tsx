import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

const KPI = ({ label, value, sub, color }: any) => (
  <div className="card metric-card" style={{ padding: 16 }}>
    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: color || 'var(--text-primary)' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function VehicleFinancialProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle-finance', id],
    queryFn: () => fetchData(`api/v1/vehicles/${id}/`),
    enabled: !!id,
  });

  // Loads for this vehicle
  const { data: loadsData } = useQuery({
    queryKey: ['vehicle-loads', id],
    queryFn: () => fetchData(`api/v1/loads/?vehicle=${id}&page_size=50`),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (!vehicle) return <div style={{ padding: 40, fontSize: 13, color: 'var(--text-tertiary)' }}>Vehicle not found. <button onClick={() => navigate('/fleet')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>← Fleet</button></div>;

  const loads = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const delivered = loads.filter((l: any) => l.status === 'DELIVERED');
  const totalRevenue = delivered.reduce((s: number, l: any) => s + parseFloat(l.total_amount || '0'), 0);
  const avgRevPerTrip = delivered.length > 0 ? totalRevenue / delivered.length : 0;
  const totalDistance = delivered.reduce((s: number, l: any) => s + parseFloat(l.distance || '0'), 0);
  const revPerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

  const healthScore = vehicle.ai_health_score ?? 72;
  const uptimePct = vehicle.uptime_percentage ?? 85;
  const costPerKm = parseFloat(vehicle.cost_per_km || '0');
  const marginPerTrip = parseFloat(vehicle.margin_per_trip || '0');

  const statusColor = vehicle.status === 'IN_USE' ? 'var(--accent-primary)' : vehicle.status === 'AVAILABLE' ? 'var(--status-success)' : 'var(--status-warning)';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/fleet/vehicles')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO FLEET</button>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>VEHICLE FINANCIAL PROFILE</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.plate || vehicle.vin}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: statusColor, padding: '6px 12px', border: `1px solid ${statusColor}`, borderRadius: 2 }}>{vehicle.status?.replace('_', ' ')}</span>
          <button onClick={() => navigate(`/fleet/vehicles/${id}`)} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 12px', borderRadius: 2, cursor: 'pointer' }}>DIGITAL TWIN →</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPI label="REVENUE GENERATED" value={formatCurrency(totalRevenue)} sub={`${delivered.length} completed trips`} color="var(--accent-primary)" />
        <KPI label="AVG REVENUE / TRIP" value={formatCurrency(avgRevPerTrip)} sub="Delivered loads" />
        <KPI label="REVENUE / KM" value={`R ${revPerKm.toFixed(2)}`} sub={`${totalDistance.toFixed(0)} km total`} />
        <KPI label="AI HEALTH SCORE" value={`${healthScore}/100`} sub="Fleet intelligence" color={healthScore >= 80 ? 'var(--status-success)' : healthScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Performance Scores */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>PERFORMANCE SCORES</div>
          <ScoreBar label="AI Health Score" value={healthScore} color={healthScore >= 80 ? 'var(--status-success)' : 'var(--status-warning)'} />
          <ScoreBar label="Uptime Score" value={vehicle.uptime_score ?? 80} color="var(--accent-primary)" />
          <ScoreBar label="Fuel Efficiency" value={vehicle.fuel_efficiency_score ?? 70} color="var(--accent-secondary)" />
          <ScoreBar label="Maintenance Score" value={vehicle.maintenance_score ?? 75} color="var(--status-success)" />
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uptime</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{uptimePct}%</span>
            </div>
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>COST ANALYSIS</div>
          {[
            { label: 'Cost per km', value: costPerKm > 0 ? `R ${costPerKm.toFixed(2)}` : '—' },
            { label: 'Margin per trip', value: marginPerTrip > 0 ? formatCurrency(marginPerTrip) : '—' },
            { label: 'Fuel consumption', value: vehicle.fuel_consumption_per_km ? `${vehicle.fuel_consumption_per_km}L/km` : '—' },
            { label: 'Capacity', value: vehicle.capacity ? `${parseFloat(vehicle.capacity).toFixed(0)} kg` : '—' },
            { label: 'Fuel type', value: vehicle.fuel_type || '—' },
            { label: 'Mileage', value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Compliance */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>COMPLIANCE & MAINTENANCE</div>
          {[
            { label: 'Last Maintenance', value: vehicle.last_maintenance_date || '—' },
            { label: 'Next Due', value: vehicle.next_maintenance_due || '—', alert: vehicle.next_maintenance_due && new Date(vehicle.next_maintenance_due) < new Date() },
            { label: 'Insurance Expiry', value: vehicle.insurance_expiry || '—', alert: vehicle.insurance_expiry && new Date(vehicle.insurance_expiry) < new Date() },
            { label: 'Registration Expiry', value: vehicle.registration_expiry || '—', alert: vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date() },
            { label: 'VIN', value: vehicle.vin || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: (r as any).alert ? 'var(--status-danger)' : 'var(--text-primary)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Recent Loads */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>RECENT LOADS ({loads.length})</div>
          {loads.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>No loads recorded</div>
          ) : loads.slice(0, 6).map((load: any) => (
            <div key={load.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)', cursor: 'pointer' }} onClick={() => navigate(`/bookings/${load.id}`)}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{load.load_number}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.pickup_city} → {load.delivery_city}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                <div style={{ fontSize: 10, color: load.status === 'DELIVERED' ? 'var(--status-success)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{load.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
