import { useState, useEffect } from "react";
import { fetchData, deleteData } from "@/lib/Api";
import { AddVehicleDrawer } from "@/components/AddVehicleDrawer";

interface Vehicle {
  id: number;
  plate: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  vehicle_type_name?: string;
  status: string;
  driver_name?: string;
  last_maintenance_date?: string;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--accent-primary)',
  MAINTENANCE: 'var(--status-warning)',
  IN_USE: 'var(--accent-primary)',
  IN_TRANSIT: 'var(--accent-primary)',
  OUT_OF_SERVICE: 'var(--status-danger)',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
};

export function VehiclesDirectory() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const load = () => {
    setLoading(true);
    fetchData('api/v1/vehicles/').then((d: any) => {
      setVehicles(Array.isArray(d) ? d : (d?.results || []));
    }).catch(() => setVehicles([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v =>
    v.plate?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_type_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this vehicle?')) return;
    await deleteData({ url: `api/v1/vehicles/${id}/` }).catch(() => {});
    load();
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Vehicles</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fleet vehicle directory</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Vehicles ({vehicles.length})
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none', width: 180,
              }}
            />
            <button className="btn-action" onClick={() => setShowAddDrawer(true)}>+ ADD VEHICLE</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Plate', 'Make / Model', 'Type', 'Status', 'Driver', 'Last Service', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left' as const,
                    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No vehicles found</td></tr>
              ) : filtered.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {v.plate || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {v.vehicle_type_name || v.vehicle_type || '—'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: STATUS_COLOR[v.status] || 'var(--text-tertiary)',
                      textTransform: 'uppercase' as const,
                    }}>{v.status?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {v.driver_name || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {v.last_maintenance_date || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        background: 'none', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-tertiary)', padding: '4px 8px',
                        fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                      }}
                    >···</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AddVehicleDrawer
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onCreated={load}
      />
    </div>
  );
}
