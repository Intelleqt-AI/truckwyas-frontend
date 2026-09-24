import './customers-directory-controls.css';
import { useState, useEffect } from "react";
import { fetchData, deleteData, postData, patchData } from "@/lib/Api";
import { PasteImportDrawer } from "@/components/import/PasteImportDrawer";
import { BulkDeleteBar, RowCheckbox, secondaryButtonStyle } from "@/components/BulkDeleteBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";

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

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', PENDING: 'Pending' };

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
  display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)',
  color: 'var(--text-tertiary)', letterSpacing: 'normal',
  marginBottom: 6, textTransform: 'none',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 6,
  fontSize: 16, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
};

export function CustomersDirectory() {
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleOne = (id: number, on: boolean) =>
    setSelected(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
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
    <div className="customer-directory-controls" style={{ maxWidth: 960, minWidth: 0, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Customers</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your customer directory</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Customers ({customers.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, gap: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 16, fontFamily: 'var(--font-sans)', outline: 'none', width: 180, maxWidth: '100%',
              }}
            />
            <button
              onClick={() => setShowImport(true)}
              disabled={isDemo}
              title={isDemo ? 'Not available in the demo' : 'Paste or upload a list'}
              style={{ ...secondaryButtonStyle, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', textTransform: 'none', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
            >Import</button>
            <button
              className="btn-action"
              onClick={() => { setShowAdd(s => !s); setAddErr(''); }}
              disabled={isDemo && !showAdd}
              title={isDemo && !showAdd ? 'Not available in the demo' : undefined}
              style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', ...(isDemo && !showAdd ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              {showAdd ? 'Close' : '+ Add customer'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>
            <div className="customer-directory-add-grid" style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
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
                    borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary)',
                    fontSize: 16, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            {addErr && <div style={{ color: 'var(--status-danger)', fontSize: 12, marginBottom: 10 }}>{addErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-action"
                onClick={handleAdd}
                disabled={saving || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              >
                {saving ? 'Saving...' : 'Save customer'}
              </button>
            </div>
          </div>
        )}

        <BulkDeleteBar
          entity="customers"
          selected={selected}
          onClear={() => setSelected([])}
          onDeleted={() => { setSelected([]); load(); }}
        />

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader size={32} /></div>
        ) : (
          <div role="region" aria-label="Customer directory table" tabIndex={0} style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 830, borderCollapse: 'collapse' as const, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 0 10px 16px', width: 32, borderBottom: '1px solid var(--border-subtle)' }}>
                  {filtered.length > 0 && (
                    <RowCheckbox
                      title="Select everything shown"
                      checked={selected.length > 0 && filtered.every((c: any) => selected.includes(c.id))}
                      onChange={on => setSelected(on ? filtered.map((c: any) => c.id) : [])}
                    />
                  )}
                </th>
                {['Customer', 'Contact', 'City', 'Payment terms', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left' as const,
                    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', textTransform: 'none' as const,
                    letterSpacing: 'normal', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No customers found</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ padding: '12px 0 12px 16px', width: 32 }}>
                    <RowCheckbox checked={selected.includes(c.id)} onChange={on => toggleOne(c.id, on)} />
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 1 }}>{c.name}</div>
                    {c.company_name && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.company_name}</div>}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 1 }}>{c.email}</div>
                    {c.phone && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.phone}</div>}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.city || '—'}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {c.payment_terms || '30 days'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13,
                      color: Object.prototype.hasOwnProperty.call(STATUS_COLOR, c.status) ? STATUS_COLOR[c.status] : 'var(--text-tertiary)',
                      textTransform: 'none' as const,
                    }}>{Object.prototype.hasOwnProperty.call(STATUS_LABEL, c.status) ? STATUS_LABEL[c.status] : c.status}</span>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(c)}
                        disabled={isDemo}
                        title={isDemo ? 'Not available in the demo' : undefined}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', padding: '4px 10px',
                          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer',
                          letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1,
                        }}
                      >Edit</button>
                      <button
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        disabled={isDemo}
                        title={isDemo ? 'Not available in the demo' : undefined}
                        style={{
                          background: 'none', border: '1px solid var(--status-danger)',
                          color: 'var(--status-danger)', padding: '4px 10px',
                          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer',
                          letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1,
                        }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete customer"
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
          <div style={{ position: 'relative', width: 'min(420px, 100vw)', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit customer</div>
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
                  {['ACTIVE', 'INACTIVE', 'PENDING'].map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s] || s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
              <button
                disabled={editSaving || isDemo}
                onClick={handleEditSave}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{ flex: '1 1 140px', padding: '10px 0', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 6, cursor: isDemo ? 'not-allowed' : editSaving ? 'wait' : 'pointer', fontWeight: 500, textTransform: 'none', opacity: isDemo ? 0.5 : 1 }}
              >
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditCustomer(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', textTransform: 'none' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <PasteImportDrawer
        entity="customers"
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => load()}
      />
    </div>
  );
}
