import { useState, useEffect } from "react";
import { fetchData, deleteData } from "@/lib/Api";

interface Customer {
  id: number;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  city?: string;
  payment_terms?: string;
  credit_limit?: string;
  total_revenue?: string;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent-primary)',
  INACTIVE: 'var(--status-danger)',
  PENDING: 'var(--status-warning)',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
};

export function CustomersDirectory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetchData('api/customers/').then((d: any) => {
      setCustomers(Array.isArray(d) ? d : (d?.results || []));
    }).catch(() => setCustomers([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this customer?')) return;
    await deleteData({ url: `api/customers/${id}/` }).catch(() => {});
    load();
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Customers</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your customer directory</div>
      </div>

      <div style={sectionStyle}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
            🏢 Customers ({customers.length})
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
            <button className="btn-action">+ ADD CUSTOMER</button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Customer', 'Contact', 'City', 'Payment Terms', 'Status', ''].map(h => (
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
                <tr><td colSpan={6} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No customers found</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 1 }}>{c.name}</div>
                    {c.company && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.company}</div>}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 1 }}>{c.email}</div>
                    {c.phone && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.phone}</div>}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{c.city || '—'}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {c.payment_terms || '30 days'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: STATUS_COLOR[c.status] || 'var(--text-tertiary)',
                      textTransform: 'uppercase' as const,
                    }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <button
                      onClick={() => handleDelete(c.id)}
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
