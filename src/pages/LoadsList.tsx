import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

interface Load {
  id: number;
  load_number: string;
  pickup_location: string;
  delivery_location: string;
  status: string;
  total_amount: string;
  driver_name?: string;
  vehicle_info?: string;
  pickup_date?: string;
  customer_name?: string;
}

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: 'var(--status-success)',
  INVOICED: 'var(--accent-primary)',
  LOADING: 'var(--status-warning)',
  SCHEDULED: 'var(--text-secondary)',
  DELAYED: 'var(--status-error)',
};

export default function LoadsList() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData('/api/v1/loads/')
      .then((data: any) => {
        // Handle both paginated and non-paginated responses
        const loadsData = data?.results || data || [];
        setLoads(loadsData);
      })
      .catch(() => {
        setError('Failed to load bookings');
        setLoads([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Loads / Bookings</div>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 13, color: 'var(--status-error)', marginBottom: 12 }}>{error}</div>
        <button className="btn-action" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Loads / Bookings</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>All Active Loads</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{loads.length} loads in system</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Loads', value: loads.length, color: 'var(--text-primary)' },
          { label: 'In Transit', value: loads.filter(l => l.status === 'IN_TRANSIT').length, color: 'var(--accent-primary)' },
          { label: 'Delivered', value: loads.filter(l => l.status === 'DELIVERED').length, color: 'var(--status-success)' },
          { label: 'Total Revenue', value: formatCurrency(loads.reduce((sum, l) => sum + parseFloat(l.total_amount || '0'), 0)), color: 'var(--accent-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Loads Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>LOAD #</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>CUSTOMER</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>ROUTE</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>DRIVER</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>VEHICLE</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.1em' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load, idx) => (
              <tr
                key={load.id}
                onClick={() => navigate(`/bookings/${load.id}`)}
                style={{
                  borderBottom: idx < loads.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>{load.load_number}</td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-primary)' }}>{load.customer_name || '—'}</td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {load.pickup_location} → {load.delivery_location}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{load.driver_name || '—'}</td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{load.vehicle_info || '—'}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: STATUS_COLOR[load.status] || 'var(--text-secondary)',
                    padding: '4px 8px',
                    border: `1px solid ${STATUS_COLOR[load.status] || 'var(--border-subtle)'}`,
                    borderRadius: 2,
                  }}>
                    {load.status?.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                  {formatCurrency(parseFloat(load.total_amount || '0'))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loads.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No loads found
          </div>
        )}
      </div>
    </div>
  );
}
