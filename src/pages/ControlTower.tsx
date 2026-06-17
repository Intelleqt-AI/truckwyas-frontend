import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LiveBadge } from '@/components/LiveBadge';

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)', LOADING: 'var(--status-warning)',
  ASSIGNED: 'var(--text-secondary)', DELIVERED: 'var(--status-success)',
  AVAILABLE: 'var(--status-success)', IN_USE: 'var(--accent-primary)',
  MAINTENANCE: 'var(--status-warning)', OUT_OF_SERVICE: 'var(--status-danger)',
};
const ACTIVE_LOAD = ['IN_TRANSIT', 'LOADING', 'ASSIGNED'];

const EVENT_DOT: Record<string, string> = {
  success: 'var(--status-success)', warning: 'var(--status-warning)',
  alert: 'var(--status-danger)', info: 'var(--accent-primary)',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const label: React.CSSProperties = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 };
const cardTitle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 };

export default function ControlTower() {
  const navigate = useNavigate();
  const [loads, setLoads] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetchData('api/v1/loads/?limit=100').catch(() => []),
      fetchData('api/v1/vehicles/').catch(() => []),
      fetchData('api/v1/notifications/?limit=25').catch(() => []),
    ]).then(([l, v, n]: any[]) => {
      setLoads(Array.isArray(l) ? l : (l?.results || []));
      setVehicles(Array.isArray(v) ? v : (v?.results || []));
      setEvents(Array.isArray(n) ? n : (n?.results || []));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { document.title = 'Control Tower - TruckWys'; load(); }, [load]);
  useAutoRefresh(load, 20000); // 20s poll + instant on every tw:live-event (WebSocket)

  const active = loads.filter(l => ACTIVE_LOAD.includes(l.status));
  const vCount = (s: string[]) => vehicles.filter(v => s.includes(v.status)).length;

  const stats = [
    { label: 'In transit', value: loads.filter(l => l.status === 'IN_TRANSIT').length, color: 'var(--accent-primary)' },
    { label: 'Loading', value: loads.filter(l => l.status === 'LOADING').length, color: 'var(--status-warning)' },
    { label: 'Fleet active', value: vCount(['IN_USE', 'IN_TRANSIT']), color: 'var(--accent-primary)' },
    { label: 'In maintenance', value: vCount(['MAINTENANCE', 'OUT_OF_SERVICE']), color: 'var(--status-danger)' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={label}>Operations</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Control Tower</div>
            <LiveBadge />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{s.label}</span></div>
            <div className="metric-value" style={{ fontSize: 26, color: s.color }}>{loading ? '…' : s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Active operations */}
        <div className="card table-card">
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={cardTitle}>Active operations ({active.length})</span>
            <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 10, borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL BOOKINGS</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
          ) : active.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No active loads right now.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Load</th><th>Lane</th><th>Driver</th><th className="text-right">Status</th></tr></thead>
              <tbody>
                {active.map(l => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/${l.id}`)}>
                    <td className="mono">{l.load_number || `L-${l.id}`}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{l.pickup_city || l.pickup_location || '—'} → {l.delivery_city || l.delivery_location || '—'}</td>
                    <td>{l.driver_name || l.driver || '—'}</td>
                    <td className="text-right">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[l.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                        {(l.status || '—').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Live event feed */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={cardTitle}>Live feed</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
            ) : events.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No activity yet. Events appear here in real time.</div>
            ) : events.map((e, i) => (
              <div
                key={e.id ?? i}
                onClick={() => e.link && navigate(e.link)}
                style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border-row)', cursor: e.link ? 'pointer' : 'default' }}
              >
                <span style={{ marginTop: 5, flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: EVENT_DOT[e.type || 'info'] || 'var(--accent-primary)' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}</div>
                  {e.description && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{e.description}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{timeAgo(e.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
