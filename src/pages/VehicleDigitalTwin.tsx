import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--accent-primary)',
  IN_USE: 'var(--status-warning)',
  MAINTENANCE: 'var(--status-danger)',
  OUT_OF_SERVICE: 'var(--text-tertiary)',
};

export default function VehicleDigitalTwin() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => fetchData(`api/v1/vehicles/${id}/`),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>;
  if (!vehicle) return <div style={{ padding: 40 }}><div style={{ color: 'var(--text-tertiary)' }}>Vehicle not found.</div><button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/fleet/vehicles')}>← BACK TO FLEET</button></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/fleet/vehicles')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO FLEET</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Vehicle</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.make} {vehicle.model} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{vehicle.plate}</span></div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{vehicle.vehicle_type_name} · {vehicle.year} · {vehicle.fuel_type}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: STATUS_COLOR[vehicle.status] || 'var(--text-secondary)', padding: '6px 12px', border: `1px solid ${STATUS_COLOR[vehicle.status] || 'var(--border-subtle)'}`, borderRadius: 2 }}>
            {vehicle.status?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'AI Health Score', value: vehicle.ai_health_score || 0, suffix: '/100' },
          { label: 'Fuel Efficiency', value: vehicle.fuel_efficiency_score || 0, suffix: '/100' },
          { label: 'Uptime', value: parseFloat(vehicle.uptime_percentage || '0').toFixed(1), suffix: '%' },
          { label: 'Mileage', value: parseFloat(vehicle.mileage || '0').toLocaleString(), suffix: ' km' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 24 }}>{m.value}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{m.suffix}</span></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Specs */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Specifications</div>
          {[
            { label: 'VIN', value: vehicle.vin },
            { label: 'Plate', value: vehicle.plate },
            { label: 'Type', value: vehicle.type },
            { label: 'Capacity', value: `${parseFloat(vehicle.capacity || '0').toFixed(0)} kg` },
            { label: 'Fuel Type', value: vehicle.fuel_type },
            { label: 'Year', value: vehicle.year },
            { label: 'Driver', value: vehicle.driver || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Economics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Economics</div>
            {[
              { label: 'Cost per km', value: `R ${parseFloat(vehicle.cost_per_km || '0').toFixed(2)}` },
              { label: 'Margin per trip', value: formatCurrency(parseFloat(vehicle.margin_per_trip || '0')) },
              { label: 'Fuel consumption', value: `${parseFloat(vehicle.fuel_consumption_per_km || '0').toFixed(2)} L/km` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Maintenance</div>
            {[
              { label: 'Last Maintenance', value: vehicle.last_maintenance_date?.slice(0, 10) || '—' },
              { label: 'Next Due', value: vehicle.next_maintenance_due?.slice(0, 10) || '—' },
              { label: 'Insurance Expiry', value: vehicle.insurance_expiry?.slice(0, 10) || '—' },
              { label: 'Registration Expiry', value: vehicle.registration_expiry?.slice(0, 10) || '—' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
