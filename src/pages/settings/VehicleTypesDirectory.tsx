import '@/pages/table-heading-roles.css';
import '@/pages/settings/settings-brand.css';
import { useState, useEffect } from "react";
import { fetchData, deleteData, postData, patchData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";

interface VehicleType {
  id: number;
  name: string;
  description?: string;
  capacity?: string | number;
  max_distance?: string | number;
  base_rate?: string | number;
  fuel_consumption_l_per_100km?: string | number;
  fuel_consumption_sensitivity_pct?: string | number;
  fuel_type?: string;
  active: boolean;
  // null = still the shared platform default (company=None) — same row
  // every company without their own override sees. Editing one of these
  // clones it into this company's own row (see the backend's
  // VehicleTypeViewSet.update) rather than changing it in place, so it never
  // affects any other company.
  company?: number | null;
  // True only for a company-owned row that shadows a shared default of the
  // same name — i.e. the result of editing one. Lets the UI offer "Reset to
  // shared default" instead of "Delete" for these specifically.
  overrides_shared_default?: boolean;
}

const FUEL_TYPE_OPTIONS = ['Diesel', 'Petrol', 'Electric', 'Hybrid'];

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6,
  fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', minHeight: 40, boxSizing: 'border-box',
};

const rowActionStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', padding: '8px 12px',
  fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500,
  borderRadius: 6, minHeight: 40,
};

const drawerPrimaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', minHeight: 40, fontFamily: 'var(--font-sans)',
  fontSize: 14, lineHeight: '20px', fontWeight: 500, background: 'var(--accent-primary)',
  color: 'var(--btn-action-color, var(--bg-deep))', border: 'none', borderRadius: 6,
};

const drawerSecondaryBtnStyle: React.CSSProperties = {
  padding: '8px 20px', minHeight: 40, fontFamily: 'var(--font-sans)',
  fontSize: 14, lineHeight: '20px', fontWeight: 500, background: 'none',
  border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer',
};

const drawerErrorStyle: React.CSSProperties = {
  padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)',
  color: 'var(--status-danger)', borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: '20px',
};

export function VehicleTypesDirectory() {
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', capacity: '', base_rate: '', fuel_consumption_l_per_100km: '', fuel_consumption_sensitivity_pct: '2.0', fuel_type: 'Diesel', active: 'true' });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; isReset: boolean } | null>(null);
  const [editType, setEditType] = useState<VehicleType | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', capacity: '', base_rate: '', fuel_consumption_l_per_100km: '', fuel_consumption_sensitivity_pct: '2.0', fuel_type: 'Diesel', active: 'true' });
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

  // Shared (company=null) types can't be bulk-selected — they're read-only here.
  const selectableFiltered = filtered.filter(t => t.company != null);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every(t => selected.has(t.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableFiltered.map(t => t.id)));

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
        fuel_consumption_l_per_100km: form.fuel_consumption_l_per_100km ? Number(form.fuel_consumption_l_per_100km) : 36,
        fuel_consumption_sensitivity_pct: form.fuel_consumption_sensitivity_pct ? Number(form.fuel_consumption_sensitivity_pct) : 2,
        fuel_type: form.fuel_type,
        active: form.active === 'true',
      }});
      setForm({ name: '', description: '', capacity: '', base_rate: '', fuel_consumption_l_per_100km: '', fuel_consumption_sensitivity_pct: '2.0', fuel_type: 'Diesel', active: 'true' });
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
      fuel_consumption_l_per_100km: t.fuel_consumption_l_per_100km != null ? String(t.fuel_consumption_l_per_100km) : '',
      fuel_consumption_sensitivity_pct: t.fuel_consumption_sensitivity_pct != null ? String(t.fuel_consumption_sensitivity_pct) : '2.0',
      fuel_type: t.fuel_type || 'Diesel',
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
        fuel_consumption_l_per_100km: editForm.fuel_consumption_l_per_100km ? Number(editForm.fuel_consumption_l_per_100km) : 36,
        fuel_consumption_sensitivity_pct: editForm.fuel_consumption_sensitivity_pct ? Number(editForm.fuel_consumption_sensitivity_pct) : 2,
        fuel_type: editForm.fuel_type,
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
        <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 4 }}>Vehicle types</h2>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Configure vehicle categories and rate settings</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Vehicle types ({types.length})
          </span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {selected.size > 0 && (
              <button
                className="settings-control"
                onClick={() => setShowBulkConfirm(true)}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{
                  background: 'var(--status-danger)', border: 'none', color: '#fff',
                  padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px',
                  fontWeight: 500, borderRadius: 6, minHeight: 40,
                  cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                }}
              >
                Delete ({selected.size})
              </button>
            )}
            <input
              className="settings-control"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search vehicle types"
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px',
                minHeight: 40, width: 160,
              }}
            />
            <button
              className="btn-action settings-control"
              onClick={() => { setShowAdd(true); setAddErr(''); }}
              disabled={isDemo}
              title={isDemo ? 'Not available in the demo' : undefined}
              style={{ minHeight: 40, borderRadius: 6, ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              Add type
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader size={32} /></div>
        ) : (
          <div className="settings-scroll-region" role="region" aria-label="Vehicle types" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', width: 36 }}>
                  <input type="checkbox" aria-label="Select all vehicle types" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Name', 'Description', 'Payload (t)', 'Base rate', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px', textAlign: 'left' as const,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' as const, padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>No vehicle types found</td></tr>
              ) : filtered.map((t, i) => {
                // Three states: still on the shared default (editable —
                // saving clones it into this company's own row), a company's
                // own override of a shared default (editable in place,
                // "Reset" instead of "Delete"), or a fully custom type
                // (editable and deletable as always).
                const isShared = t.company == null;
                const isOverride = !isShared && !!t.overrides_shared_default;
                const badgeTitle = isShared
                  ? 'TruckWys platform default — editing it creates your own copy, used only by your company'
                  : isOverride
                    ? "Your company's own version of a shared default — Reset drops back to TruckWys's current version"
                    : undefined;
                const editDisabled = isDemo;
                const deleteDisabled = isDemo || isShared; // nothing to delete/reset until this company has diverged
                return (
                <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-row)' : 'none', background: selected.has(t.id) ? 'var(--bg-elevated)' : 'transparent' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      disabled={isShared}
                      title={isShared ? badgeTitle : undefined}
                      onChange={() => toggleSelect(t.id)}
                      style={{ cursor: isShared ? 'not-allowed' : 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {t.name}
                    {(isShared || isOverride) && (
                      <span style={{
                        marginLeft: 8, fontFamily: 'var(--font-sans)', fontSize: 11, lineHeight: '16px',
                        color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                        padding: '1px 6px',
                      }} title={badgeTitle}>{isShared ? 'Platform default' : 'Customized'}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', maxWidth: 220 }}>
                    {t.description || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {t.capacity ? `${t.capacity}t` : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatRate(t.base_rate)}<span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>/km</span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontWeight: 500,
                      color: t.active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    }}>{t.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="settings-control"
                        onClick={() => openEdit(t)}
                        disabled={editDisabled}
                        title={isDemo ? 'Not available in the demo' : (isShared ? badgeTitle : undefined)}
                        style={{
                          ...rowActionStyle,
                          cursor: editDisabled ? 'not-allowed' : 'pointer', opacity: editDisabled ? 0.5 : 1,
                        }}
                      >Edit</button>
                      <button
                        className="settings-control"
                        onClick={() => setDeleteTarget({ id: t.id, name: t.name, isReset: isOverride })}
                        disabled={deleteDisabled}
                        title={isDemo ? 'Not available in the demo' : (isShared ? badgeTitle : undefined)}
                        style={{
                          ...rowActionStyle,
                          border: '1px solid var(--status-danger)', color: 'var(--status-danger)',
                          cursor: deleteDisabled ? 'not-allowed' : 'pointer', opacity: deleteDisabled ? 0.5 : 1,
                        }}
                      >{isOverride ? 'Reset' : 'Delete'}</button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.isReset ? 'Reset to shared default' : 'Delete vehicle type'}
          message={
            deleteTarget.isReset
              ? `Discard your company's customized "${deleteTarget.name}" and go back to using TruckWys's current shared version? This can't be undone, but you can always customize it again later.`
              : `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
          }
          confirmLabel={deleteTarget.isReset ? 'Reset' : 'Delete'}
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showBulkConfirm && (
        <ConfirmModal
          title={`Delete ${selected.size} vehicle type${selected.size > 1 ? 's' : ''}`}
          message={`Are you sure you want to delete ${selected.size} vehicle type${selected.size > 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel={bulkDeleting ? 'Deleting…' : 'Delete all'}
          danger
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkConfirm(false)}
        />
      )}

      {/* Add slide-out — same shape as the Edit drawer below, deliberately kept
          in lockstep with it (same 7 fields, same order) rather than each
          keeping its own copy that can quietly drift. */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setShowAdd(false)} />
          <div style={{ position: 'relative', width: 420, maxWidth: '100%', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Add vehicle type</h2>
              <button
                className="settings-control"
                aria-label="Close"
                onClick={() => setShowAdd(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, minWidth: 44, minHeight: 44 }}
              >✕</button>
            </div>
            {addErr && (
              <div style={drawerErrorStyle}>
                {addErr}
              </div>
            )}
            {([
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'description', label: 'Description', type: 'text', required: false },
              { key: 'capacity', label: 'Payload (tonnes)', type: 'number', required: false },
              { key: 'base_rate', label: 'Base rate (R/km)', type: 'number', required: false },
              { key: 'fuel_consumption_l_per_100km', label: 'Fuel consumption (L/100km)', type: 'number', required: false },
              { key: 'fuel_consumption_sensitivity_pct', label: 'Fuel sensitivity (%/ton over capacity)', type: 'number', required: false },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
                </label>
                <input
                  className="settings-control"
                  type={f.type}
                  value={(form as any)[f.key]}
                  aria-describedby={f.key === 'base_rate' ? 'create-base-rate-help' : undefined}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
                {f.key === 'base_rate' && (
                  <p id="create-base-rate-help" style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    Used to prefill quotes for this vehicle type. Check the rate on each quote.
                  </p>
                )}
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Fuel type</label>
              <Select value={form.fuel_type} onValueChange={val => setForm(prev => ({ ...prev, fuel_type: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Status</label>
              <Select value={form.active} onValueChange={val => setForm(prev => ({ ...prev, active: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                className="settings-control"
                disabled={saving || isDemo}
                onClick={handleAdd}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{ ...drawerPrimaryBtnStyle, cursor: isDemo ? 'not-allowed' : saving ? 'wait' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
              >
                {saving ? 'Saving…' : 'Save type'}
              </button>
              <button
                className="settings-control"
                onClick={() => setShowAdd(false)}
                style={drawerSecondaryBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit slide-out */}
      {editType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditType(null)} />
          <div style={{ position: 'relative', width: 420, maxWidth: '100%', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Edit vehicle type</h2>
              <button
                className="settings-control"
                aria-label="Close"
                onClick={() => setEditType(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, minWidth: 44, minHeight: 44 }}
              >✕</button>
            </div>
            {editErr && (
              <div style={drawerErrorStyle}>
                {editErr}
              </div>
            )}
            {([
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'description', label: 'Description', type: 'text' },
              { key: 'capacity', label: 'Payload (tonnes)', type: 'number' },
              { key: 'base_rate', label: 'Base rate (R/km)', type: 'number' },
              { key: 'fuel_consumption_l_per_100km', label: 'Fuel consumption (L/100km)', type: 'number' },
              { key: 'fuel_consumption_sensitivity_pct', label: 'Fuel sensitivity (%/ton over capacity)', type: 'number' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  className="settings-control"
                  type={f.type}
                  value={editForm[f.key]}
                  aria-describedby={f.key === 'base_rate' ? 'edit-base-rate-help' : undefined}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
                {f.key === 'base_rate' && (
                  <p id="edit-base-rate-help" style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    Used to prefill quotes for this vehicle type. Check the rate on each quote.
                  </p>
                )}
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Fuel type</label>
              <Select value={editForm.fuel_type} onValueChange={val => setEditForm(prev => ({ ...prev, fuel_type: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                className="settings-control"
                disabled={editSaving || isDemo}
                onClick={handleEditSave}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{ ...drawerPrimaryBtnStyle, cursor: isDemo ? 'not-allowed' : editSaving ? 'wait' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                className="settings-control"
                onClick={() => setEditType(null)}
                style={drawerSecondaryBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
