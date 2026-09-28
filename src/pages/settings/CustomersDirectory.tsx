import './customers-directory-controls.css';
import { useState, useEffect } from "react";
import { fetchData, deleteData, postData, patchData } from "@/lib/Api";
import { PasteImportDrawer } from "@/components/import/PasteImportDrawer";
import { BulkDeleteBar, RowCheckbox, secondaryButtonStyle } from "@/components/BulkDeleteBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";
import { settingsCardTitleStyle, settingsLabelStyle, settingsInputStyle } from "./settingsUi";

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
  INACTIVE: 'var(--status-danger-text, var(--status-danger))',
  PENDING: 'var(--status-warning-text, var(--status-warning))',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
};

const labelStyle = settingsLabelStyle;
const inputStyle = settingsInputStyle;

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
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Customers</h1>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Your customer directory</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '12px 20px', minHeight: 64, boxSizing: 'border-box', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={settingsCardTitleStyle}>
            Customers <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>({customers.length})</span>
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, gap: 12 }}>
            <input
              className="settings-control"
              aria-label="Search customers"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ ...settingsInputStyle, width: 180, maxWidth: '100%' }}
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
            <div className="customer-directory-add-grid" style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
              {([
                { k: 'name', ph: 'Name *' },
                { k: 'email', ph: 'Email *' },
                { k: 'phone', ph: 'Phone *' },
                { k: 'city', ph: 'City *' },
              ] as const).map(f => (
                <input
                  key={f.k}
                  className="settings-control"
                  aria-label={f.ph.replace(' *', ' (required)')}
                  value={(form as any)[f.k]}
                  onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                  placeholder={f.ph}
                  style={settingsInputStyle}
                />
              ))}
            </div>
            {addErr && <div role="alert" style={{ color: 'var(--status-danger-text, var(--status-danger))', fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>{addErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-action settings-control"
                onClick={handleAdd}
                disabled={saving || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              >
                {saving ? 'Saving…' : 'Save customer'}
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
          <table className="table-heading-roles settings-table" style={{ minWidth: 830, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px' }}>
            <thead>
              <tr>
                <th style={{ width: 32, fontSize: 13, lineHeight: '20px', fontWeight: 500, }}>
                  {filtered.length > 0 && (
                    <RowCheckbox
                      title="Select everything shown"
                      checked={selected.length > 0 && filtered.every((c: any) => selected.includes(c.id))}
                      onChange={on => setSelected(on ? filtered.map((c: any) => c.id) : [])}
                    />
                  )}
                </th>
                {['Customer', 'Contact', 'City', 'Payment terms', 'Status', 'Actions'].map(h => (
                  <th key={h || 'actions'} scope="col" style={{ textAlign: (h === 'Actions') ? 'right' : 'left' }}>{h || <span className="sr-only">Actions</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No customers found</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                  <td style={{ width: 32 }}>
                    <RowCheckbox checked={selected.includes(c.id)} onChange={on => toggleOne(c.id, on)} />
                  </td>
                  <td>
                    <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                    {c.company_name && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.company_name}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 1 }}>{c.email}</div>
                    {c.phone && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.phone}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.city || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {c.payment_terms || '30 days'}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13,
                      color: Object.prototype.hasOwnProperty.call(STATUS_COLOR, c.status) ? STATUS_COLOR[c.status] : 'var(--text-tertiary)',
                      textTransform: 'none' as const,
                    }}>{Object.prototype.hasOwnProperty.call(STATUS_LABEL, c.status) ? STATUS_LABEL[c.status] : c.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' as const }}>
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
                          color: 'var(--status-danger-text, var(--status-danger))', padding: '4px 10px',
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
          <div style={{ position: 'relative', width: 'min(420px, 100vw)', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ ...settingsCardTitleStyle }}>Edit customer</h2>
              <button type="button" className="settings-control" aria-label="Close" onClick={() => setEditCustomer(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, width: 40, height: 40, borderRadius: 6 }}>✕</button>
            </div>
            {editErr && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger-text, var(--status-danger))', borderRadius: 6, marginBottom: 16, fontSize: 13, lineHeight: '20px' }}>
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
                <label htmlFor={`customer-edit-${f.key}`} style={labelStyle}>{f.label}</label>
                <input
                  id={`customer-edit-${f.key}`}
                  className="settings-control"
                  value={editForm[f.key]}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="customer-edit-status" style={labelStyle}>Status</label>
              <Select value={editForm.status} onValueChange={val => setEditForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger id="customer-edit-status" style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['ACTIVE', 'INACTIVE', 'PENDING'].map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s] || s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
              <button
                disabled={editSaving || isDemo}
                onClick={handleEditSave}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="settings-control"
                style={{ flex: '1 1 140px', minHeight: 40, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', background: 'var(--accent-primary)', color: 'var(--btn-action-color, var(--bg-deep))', border: 'none', borderRadius: 6, cursor: isDemo ? 'not-allowed' : editSaving ? 'wait' : 'pointer', fontWeight: 500, textTransform: 'none', opacity: isDemo ? 0.5 : 1 }}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                className="settings-control"
                onClick={() => setEditCustomer(null)}
                style={{ minHeight: 40, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', textTransform: 'none' }}
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
