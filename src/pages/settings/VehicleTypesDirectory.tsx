import { useState, useEffect } from "react";
import { fetchData, deleteData, postData, patchData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";

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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)', letterSpacing: '0.06em',
  marginBottom: 6, };

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2,
  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
};

export function VehicleTypesDirectory() {
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', capacity: '', base_rate: '' });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editType, setEditType] = useState<VehicleType | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', capacity: '', base_rate: '', active: 'true' });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');

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
    await deleteData({ url: `api/v1/vehicle-types/${id}/` }).catch(() => {});
    load();
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await Promise.all([...selected].map(id => deleteData({ url: `api/v1/vehicle-types/${id}/` }).catch(() => {})));
    setSelected(new Set());
    setShowBulkConfirm(false);
    setBulkDeleting(false);
    load();
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(t => t.id)));

  const handleAdd = async () => {
    if (!form.name.trim()) { setAddErr('Name is required'); return; }
    setSaving(true);
    setAddErr('');
    try {
      await postData({ url: 'api/v1/vehicle-types/', data: {
        name: form.name.trim(),
        description: form.description.trim(),
        capacity: form.capacity ? Number(form.capacity) : 0,
        base_rate: form.base_rate ? Number(form.base_rate) : 0,
        active: true,
      }});
      setForm({ name: '', description: '', capacity: '', base_rate: '' });
      setShowAdd(false);
      load();
    } catch (e: any) {
      setAddErr(e?.message || 'Failed to add vehicle type');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t: VehicleType) => {
    setEditType(t);
    setEditForm({
      name: t.name || '',
      description: t.description || '',
      capacity: t.capacity != null ? String(t.capacity) : '',
      base_rate: t.base_rate != null ? String(t.base_rate) : '',
      active: t.active ? 'true' : 'false',
    });
    setEditErr('');
  };

  const handleEditSave = async () => {
    if (!editType) return;
    if (!editForm.name.trim()) { setEditErr('Name is required'); return; }
    setEditSaving(true);
    setEditErr('');
    try {
      await patchData({ url: `api/v1/vehicle-types/${editType.id}/`, data: {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        capacity: editForm.capacity ? Number(editForm.capacity) : 0,
        base_rate: editForm.base_rate ? Number(editForm.base_rate) : 0,
        active: editForm.active === 'true',
      }});
      setEditType(null);
      load();
    } catch (e: any) {
      setEditErr(e?.message || 'Failed to update vehicle type');
    } finally {
      setEditSaving(false);
    }
  };

  const formatRate = (v: any) => v ? `R ${parseFloat(v).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Vehicle Types</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configure vehicle categories and rate settings</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
            ⚙ Vehicle Types ({types.length})
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {selected.size > 0 && (
              <button
                onClick={() => setShowBulkConfirm(true)}
                style={{
                  background: 'var(--status-danger)', border: 'none', color: '#fff',
                  padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
                  borderRadius: 2, cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >
                DELETE ({selected.size})
              </button>
            )}
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
            <button className="btn-action" onClick={() => { setShowAdd(s => !s); setAddErr(''); }}>
              {showAdd ? 'CLOSE' : '+ ADD TYPE'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {([
                { k: 'name', ph: 'Name *', type: 'text' },
                { k: 'description', ph: 'Description', type: 'text' },
                { k: 'capacity', ph: 'Capacity (ton)', type: 'number' },
                { k: 'base_rate', ph: 'Base rate /km', type: 'number' },
              ] as const).map(f => (
                <input
                  key={f.k}
                  type={f.type}
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
                {saving ? 'SAVING...' : 'SAVE TYPE'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Name', 'Description', 'Capacity', 'Base Rate', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left' as const,
                    fontFamily: 'var(--font-mono)', fontSize: 10,                     letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No vehicle types found</td></tr>
              ) : filtered.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none', background: selected.has(t.id) ? 'var(--bg-elevated)' : 'transparent' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} style={{ cursor: 'pointer' }} />
                  </td>
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
                    }}>{t.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(t)}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >EDIT</button>
                      <button
                        onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
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
          title="Delete Vehicle Type"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showBulkConfirm && (
        <ConfirmModal
          title={`Delete ${selected.size} Vehicle Type${selected.size > 1 ? 's' : ''}`}
          message={`Are you sure you want to delete ${selected.size} vehicle type${selected.size > 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel={bulkDeleting ? 'Deleting...' : 'Delete All'}
          danger
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkConfirm(false)}
        />
      )}

      {/* Edit slide-out */}
      {editType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditType(null)} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Vehicle Type</div>
              <button onClick={() => setEditType(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {editErr && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {editErr}
              </div>
            )}
            {([
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'description', label: 'Description', type: 'text' },
              { key: 'capacity', label: 'Capacity (ton)', type: 'number' },
              { key: 'base_rate', label: 'Base Rate (R/km)', type: 'number' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type={f.type}
                  value={editForm[f.key]}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Status</label>
              <Select value={editForm.active} onValueChange={val => setEditForm(prev => ({ ...prev, active: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={editSaving}
                onClick={handleEditSave}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: editSaving ? 'wait' : 'pointer', fontWeight: 600, }}
              >
                {editSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button
                onClick={() => setEditType(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer', }}
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
