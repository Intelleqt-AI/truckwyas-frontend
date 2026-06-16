import { useState, useEffect } from "react";
import { fetchData, deleteData, postData } from "@/lib/Api";

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
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });

  const load = () => {
    setLoading(true);
    fetchData('api/v1/customers/').then((d: any) => {
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
    await deleteData({ url: `api/v1/customers/${id}/` }).catch(() => {});
    load();
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { setAddErr('Name is required'); return; }
    setSaving(true);
    setAddErr('');
    try {
      await postData({ url: 'api/v1/customers/', data: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        status: 'ACTIVE',
      }});
      setForm({ name: '', email: '', phone: '', city: '' });
      setShowAdd(false);
      load();
    } catch (e: any) {
      setAddErr(e?.message || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
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
            Customers ({customers.length})
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
            <button className="btn-action" onClick={() => { setShowAdd(s => !s); setAddErr(''); }}>
              {showAdd ? 'CLOSE' : '+ ADD CUSTOMER'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
              {([
                { k: 'name', ph: 'Name *' },
                { k: 'email', ph: 'Email' },
                { k: 'phone', ph: 'Phone' },
                { k: 'city', ph: 'City' },
              ] as const).map(f => (
                <input
                  key={f.k}
                  value={(form as any)[f.k]}
                  onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                  placeholder={f.ph}
                  style={{
                    background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                    borderRadius: 2, padding: '8px 10px', color: 'var(--text-primary)',
                    fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            {addErr && <div style={{ color: 'var(--status-danger)', fontSize: 12, marginBottom: 10 }}>{addErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-action" onClick={handleAdd} disabled={saving}>
                {saving ? 'SAVING...' : 'SAVE CUSTOMER'}
              </button>
            </div>
          </div>
        )}

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
