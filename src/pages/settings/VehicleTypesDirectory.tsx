import { useState, useEffect } from "react";
import { fetchData, deleteData } from "@/lib/Api";

interface VehicleType {
  id: number;
  name: string;
  description?: string;
  capacity?: string | number;
  max_distance?: string | number;
  base_rate?: string | number;
  active: boolean;
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
};

export function VehicleTypesDirectory() {
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetchData('api/v1/vehicle-types/').then((d: any) => {
      setTypes(Array.isArray(d) ? d : (d?.results || []));
    }).catch(() => {
      fetchData('api/vehicle-types/').then((d: any) => {
        setTypes(Array.isArray(d) ? d : (d?.results || []));
      }).catch(() => setTypes([]));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = types.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this vehicle type?')) return;
    await deleteData({ url: `api/v1/vehicle-types/${id}/` }).catch(() => {});
    load();
  };

  const formatRate = (v: any) => v ? `R ${parseFloat(v).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Vehicle Types</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configure vehicle categories and rate settings</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
            ⚙ Vehicle Types ({types.length})
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none', width: 160,
              }}
            />
            <button className="btn-action">+ ADD TYPE</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Name', 'Description', 'Capacity', 'Base Rate', 'Status', ''].map(h => (
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
                <tr><td colSpan={6} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No vehicle types found</td></tr>
              ) : filtered.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {t.name}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220 }}>
                    {t.description || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t.capacity ? `${t.capacity} ton` : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                    {formatRate(t.base_rate)}<span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>/km</span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: t.active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      textTransform: 'uppercase' as const,
                    }}>{t.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <button
                      onClick={() => handleDelete(t.id)}
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
    </div>
  );
}
