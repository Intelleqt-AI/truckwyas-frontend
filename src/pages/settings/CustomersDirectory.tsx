import { useState, useEffect } from "react";
import { fetchData, deleteData, postData, patchData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Customer {
  id: number;
  name: string;
  company_name?: string;
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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)', letterSpacing: '0.06em',
  marginBottom: 6, textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2,
  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
};

export function CustomersDirectory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', city: '', status: 'ACTIVE' });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');

  const load = () => {
    setLoading(true);
    fetchData('api/v1/customers/').then((d: any) => {
      setCustomers(Array.isArray(d) ? d : (d?.results || []));
    }).catch(() => setCustomers([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    await deleteData({ url: `api/v1/customers/${id}/` }).catch(() => {});
    load();
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { setAddErr('Name is required'); return; }
    if (!form.email.trim()) { setAddErr('Email is required'); return; }
    if (!form.phone.trim()) { setAddErr('Phone is required'); return; }
    if (!form.city.trim()) { setAddErr('City is required'); return; }
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

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      city: c.city || '',
      status: c.status || 'ACTIVE',
    });
    setEditErr('');
  };

  const handleEditSave = async () => {
    if (!editCustomer) return;
    if (!editForm.name.trim()) { setEditErr('Name is required'); return; }
    if (!editForm.email.trim()) { setEditErr('Email is required'); return; }
    setEditSaving(true);
    setEditErr('');
    try {
      await patchData({ url: `api/v1/customers/${editCustomer.id}/`, data: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        city: editForm.city.trim(),
        status: editForm.status,
      }});
      setEditCustomer(null);
      load();
    } catch (e: any) {
      setEditErr(e?.message || 'Failed to update customer');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Customers</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your customer directory</div>
      </div>

      <div style={sectionStyle}>
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
                { k: 'email', ph: 'Email *' },
                { k: 'phone', ph: 'Phone *' },
                { k: 'city', ph: 'City *' },
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
                    {c.company_name && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.company_name}</div>}
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
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(c)}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >EDIT</button>
                      <button
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        style={{
                          background: 'none', border: '1px solid var(--status-danger)',
                          color: 'var(--status-danger)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >DELETE</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Customer"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Edit slide-out */}
      {editCustomer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditCustomer(null)} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Customer</div>
              <button onClick={() => setEditCustomer(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {editErr && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {editErr}
              </div>
            )}
            {([
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'city', label: 'City' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  value={editForm[f.key]}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Status</label>
              <Select value={editForm.status} onValueChange={val => setEditForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ACTIVE', 'INACTIVE', 'PENDING'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={editSaving}
                onClick={handleEditSave}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: editSaving ? 'wait' : 'pointer', fontWeight: 600, textTransform: 'uppercase' }}
              >
                {editSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button
                onClick={() => setEditCustomer(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
