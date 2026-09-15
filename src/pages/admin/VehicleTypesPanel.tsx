import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData, patchData, deleteData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';

// Platform-wide vehicle type catalog (company=None rows) — every company's
// New Quote / Add Vehicle pickers show these plus whatever custom types that
// company added on their own Settings > Vehicle Types page. An edit here
// applies to every company at once (same DB row, not a per-company copy —
// see core/services/company_setup.py for why per-company copies were
// retired). Deliberately a separate page from the tenant-facing directory:
// that one now blocks writes to these rows server-side (core/views.py's
// VehicleTypeViewSet._forbid_shared_type_write), this is the only place they
// can actually be changed.

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
  borderRadius: 2, fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase',
};
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', width: '100%', boxSizing: 'border-box',
};

interface AdminVehicleType {
  id: number;
  name: string;
  description: string;
  capacity: string | number;
  max_distance: string | number;
  base_rate: string | number;
  fuel_consumption_l_per_100km: string | number;
  fuel_consumption_sensitivity_pct: string | number;
  fuel_type: string;
  active: boolean;
}

const emptyForm = {
  name: '', description: '', capacity: '', max_distance: '', base_rate: '',
  fuel_consumption_l_per_100km: '', fuel_consumption_sensitivity_pct: '2.0', fuel_type: 'Diesel', active: true,
};

const fmtRate = (v: any) => (v || v === 0) ? `R${parseFloat(v).toFixed(2)}` : '—';

export default function VehicleTypesPanel() {
  const qc = useQueryClient();
  const queryKey = ['admin-vehicle-types'];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchData('api/v1/admin/vehicle-types/'),
  });
  const types: AdminVehicleType[] = data?.results || [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const [editTarget, setEditTarget] = useState<AdminVehicleType | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminVehicleType | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey });

  const toPayload = (f: typeof emptyForm) => ({
    name: f.name.trim(),
    description: f.description.trim(),
    capacity: f.capacity === '' ? 0 : Number(f.capacity),
    max_distance: f.max_distance === '' ? 0 : Number(f.max_distance),
    base_rate: f.base_rate === '' ? 0 : Number(f.base_rate),
    fuel_consumption_l_per_100km: f.fuel_consumption_l_per_100km === '' ? 36 : Number(f.fuel_consumption_l_per_100km),
    fuel_consumption_sensitivity_pct: f.fuel_consumption_sensitivity_pct === '' ? 2 : Number(f.fuel_consumption_sensitivity_pct),
    fuel_type: f.fuel_type,
    active: f.active,
  });

  const handleAdd = async () => {
    if (!form.name.trim()) { setFormErr('Name is required'); return; }
    setSaving(true);
    setFormErr('');
    try {
      await postData({ url: 'api/v1/admin/vehicle-types/', data: toPayload(form) });
      toast.success(`"${form.name.trim()}" added — every company can now select it`);
      setForm(emptyForm);
      setShowAdd(false);
      refresh();
    } catch (e: any) {
      setFormErr(e?.message || 'Failed to add vehicle type');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t: AdminVehicleType) => {
    setEditTarget(t);
    setEditForm({
      name: t.name, description: t.description || '',
      capacity: String(t.capacity ?? ''), max_distance: String(t.max_distance ?? ''), base_rate: String(t.base_rate ?? ''),
      fuel_consumption_l_per_100km: String(t.fuel_consumption_l_per_100km ?? ''),
      fuel_consumption_sensitivity_pct: String(t.fuel_consumption_sensitivity_pct ?? '2.0'),
      fuel_type: t.fuel_type || 'Diesel', active: t.active,
    });
    setFormErr('');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) { setFormErr('Name is required'); return; }
    setSaving(true);
    setFormErr('');
    try {
      await patchData({ url: `api/v1/admin/vehicle-types/${editTarget.id}/`, data: toPayload(editForm) });
      toast.success('Saved — every company sees the update immediately');
      setEditTarget(null);
      refresh();
    } catch (e: any) {
      setFormErr(e?.message || 'Failed to update vehicle type');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: AdminVehicleType) => {
    setPending(t.id);
    try {
      await patchData({ url: `api/v1/admin/vehicle-types/${t.id}/`, data: { active: !t.active } });
      qc.setQueryData(queryKey, (old: any) => old?.results
        ? { ...old, results: old.results.map((r: AdminVehicleType) => r.id === t.id ? { ...r, active: !t.active } : r) }
        : old);
      toast.success(t.active ? `${t.name} deactivated — hidden from new selections platform-wide` : `${t.name} reactivated`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPending(deleteTarget.id);
    try {
      await deleteData({ url: `api/v1/admin/vehicle-types/${deleteTarget.id}/` });
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete — it may still be in use');
    } finally {
      setPending(null);
    }
  };

  const renderFields = (f: typeof emptyForm, setF: (updater: (prev: typeof emptyForm) => typeof emptyForm) => void) => (
    <>
      {([
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'capacity', label: 'Payload (tonnes)', type: 'number' },
        { key: 'max_distance', label: 'Max Distance (km)', type: 'number' },
        { key: 'base_rate', label: 'Base Rate (R/km)', type: 'number' },
        { key: 'fuel_consumption_l_per_100km', label: 'Fuel Consumption (L/100km)', type: 'number' },
        { key: 'fuel_consumption_sensitivity_pct', label: 'Fuel Sensitivity (%/tonne over payload)', type: 'number' },
      ] as const).map(fld => (
        <div key={fld.key} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{fld.label}</label>
          <input
            type={fld.type}
            value={(f as any)[fld.key]}
            onChange={e => setF(prev => ({ ...prev, [fld.key]: e.target.value }))}
            style={inputStyle}
          />
        </div>
      ))}
    </>
  );

  return (
    <div className="card" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Truck Types {data ? `(${types.length})` : ''}</div>
        <button className="btn-action" style={{ fontSize: 11 }} onClick={() => { setShowAdd(s => !s); setFormErr(''); }}>
          {showAdd ? 'Cancel' : '+ Add Type'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
        Shared across every company — capacity is always payload, never GVM. Changes here apply platform-wide immediately.
      </div>

      {showAdd && (
        <div style={{
          padding: 16, marginBottom: 16, background: 'var(--bg-surface-hover, var(--bg-surface))',
          border: '1px solid var(--border-subtle)', borderRadius: 2,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12,
        }}>
          {formErr && (
            <div style={{ gridColumn: '1 / -1', padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, fontSize: 12 }}>
              {formErr}
            </div>
          )}
          {renderFields(form, setForm)}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button className="btn-action" style={{ fontSize: 11 }} disabled={saving} onClick={handleAdd}>
              {saving ? 'Saving…' : 'Save Type'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader size={24} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Payload</th>
                <th style={thStyle}>Base Rate</th>
                <th style={thStyle}>Fuel</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
                  <td style={tdStyle}>
                    <div>{t.name}</div>
                    {t.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.description}</div>}
                  </td>
                  <td style={tdStyle}>{t.capacity}t</td>
                  <td style={tdStyle}>{fmtRate(t.base_rate)}<span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>/km</span></td>
                  <td style={tdStyle}>{t.fuel_consumption_l_per_100km}L/100km</td>
                  <td style={tdStyle}>
                    <span className={`status-badge ${t.active ? 'active' : 'delayed'}`}>{t.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button style={secondaryBtnStyle} disabled={pending === t.id} onClick={() => openEdit(t)}>Edit</button>
                      <button style={secondaryBtnStyle} disabled={pending === t.id} onClick={() => toggleActive(t)}>
                        {t.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        style={{ ...secondaryBtnStyle, color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                        disabled={pending === t.id}
                        onClick={() => setDeleteTarget(t)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr><td style={tdStyle} colSpan={6}>No shared vehicle types.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditTarget(null)} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Truck Type</div>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {formErr && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {formErr}
              </div>
            )}
            {renderFields(editForm, setEditForm)}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                disabled={saving}
                onClick={handleEditSave}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, textTransform: 'uppercase' }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditTarget(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete truck type"
          message={`Delete "${deleteTarget.name}" for every company on the platform? Blocked automatically if any vehicle is still using it — deactivate it instead in that case.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
