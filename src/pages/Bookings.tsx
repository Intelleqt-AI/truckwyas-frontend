import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: '#22c55e',
  LOADING: 'var(--status-warning)',
  SCHEDULED: 'var(--text-secondary)',
  DELAYED: 'var(--status-danger)',
};

export default function Bookings() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: load, isLoading } = useQuery({
    queryKey: ['load', id],
    queryFn: () => fetchData(`api/v1/loads/${id}/`),
    enabled: !!id,
  });

  if (isLoading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
  );

  if (!load) return (
    <div style={{ padding: 40 }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Load not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/quotes')}>← BACK</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO LOADS</button>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Load Detail</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{load.load_number}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{load.customer_name}</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: STATUS_COLOR[load.status] || 'var(--text-secondary)', padding: '6px 12px', border: `1px solid ${STATUS_COLOR[load.status] || 'var(--border-subtle)'}`, borderRadius: 2 }}>
          {load.status?.replace('_', ' ')}
        </span>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Amount', value: formatCurrency(parseFloat(load.total_amount || '0')), color: 'var(--accent-primary)' },
          { label: 'Distance', value: `${parseFloat(load.distance || '0').toFixed(0)} km`, color: 'var(--text-primary)' },
          { label: 'Weight', value: `${parseFloat(load.weight || '0').toFixed(0)} kg`, color: 'var(--text-primary)' },
          { label: 'Rate/km', value: `R ${(parseFloat(load.rate || '0') / Math.max(parseFloat(load.distance || '1'), 1)).toFixed(2)}`, color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Route */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>PICKUP</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.pickup_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.pickup_city}, {load.pickup_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{load.pickup_date?.slice(0, 10)}</div>
            </div>
            <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16, paddingTop: 8, paddingBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.cargo_description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>DELIVERY</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.delivery_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.delivery_city}, {load.delivery_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{load.delivery_date?.slice(0, 10)}</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Assignment</div>
            {[
              { label: 'Driver', value: load.driver_name || '—' },
              { label: 'Vehicle', value: load.vehicle_info || '—' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Financials</div>
            {[
              { label: 'Base Rate', value: formatCurrency(parseFloat(load.rate || '0')) },
              { label: 'Fuel Surcharge', value: formatCurrency(parseFloat(load.fuel_surcharge || '0')) },
              { label: 'Additional', value: formatCurrency(parseFloat(load.additional_charges || '0')) },
              { label: 'Total', value: formatCurrency(parseFloat(load.total_amount || '0')), highlight: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: r.highlight ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: r.highlight ? 600 : 400 }}>{r.value}</span>
              </div>
            ))}
          </div>
          {load.notes && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Notes</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{load.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
