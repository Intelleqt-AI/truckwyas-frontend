import { useState, useEffect } from "react";
import { fetchData, deleteData, patchData } from "@/lib/Api";
import { AddVehicleDrawer } from "@/components/AddVehicleDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Vehicle {
  id: number;
  plate: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  capacity?: string | number;
  mileage?: string | number;
  fuel_type?: string;
  status: string;
  vehicle_type?: number;
  vehicle_type_name?: string;
  driver?: number | null;
  driver_name?: string;
  last_maintenance_date?: string;
  registration_expiry?: string;
  service_interval_km?: number | null;
  last_service_mileage?: string | number | null;
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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)', letterSpacing: '0.06em',
  marginBottom: 6, };

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2,
  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
};

export function VehiclesDirectory() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<{ id: number; name: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);

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
    await deleteData({ url: `api/v1/vehicles/${id}/` }).catch(() => {});
    load();
  };

  const openEdit = async (v: Vehicle) => {
    setEditVehicle(v);
    setEditForm({
      vin: v.vin || '',
      plate: v.plate || '',
      make: v.make || '',
      model: v.model || '',
      year: v.year || '',
      capacity: v.capacity != null ? String(Number(v.capacity) / 1000) : '',
      mileage: v.mileage != null ? String(v.mileage) : '',
      fuel_type: v.fuel_type || 'Diesel',
      status: v.status || 'AVAILABLE',
      vehicle_type_name: v.vehicle_type_name || '',
      driver: v.driver != null ? String(v.driver) : '',
      registration_expiry: v.registration_expiry?.slice(0, 10) || '',
      last_maintenance_date: v.last_maintenance_date?.slice(0, 10) || '',
      service_interval_km: v.service_interval_km != null ? String(v.service_interval_km) : '',
      last_service_mileage: v.last_service_mileage != null ? String(v.last_service_mileage) : '',
    });
    setEditErr('');
    // Fetch types and drivers in parallel
    const [vtData, drData] = await Promise.all([
      fetchData('api/v1/vehicle-types/').catch(() => []),
      fetchData('api/v1/drivers/').catch(() => []),
    ]);
    setVehicleTypes(
      (Array.isArray(vtData) ? vtData : vtData?.results || []).map((vt: any) => ({ id: vt.id, name: vt.name }))
    );
    setDrivers(
      (Array.isArray(drData) ? drData : drData?.results || []).map((d: any) => ({
        id: d.id,
        name: [d.first_name || d.user_details?.first_name, d.last_name || d.user_details?.last_name].filter(Boolean).join(' ') || `Driver ${d.id}`,
      }))
    );
  };

  const handleEditSave = async () => {
    if (!editVehicle) return;
    setEditSaving(true);
    setEditErr('');
    try {
      const typeId = vehicleTypes.find(vt => vt.name === editForm.vehicle_type_name)?.id;
      const { vehicle_type_name, ...rest } = editForm;
      await patchData({
        url: `api/v1/vehicles/${editVehicle.id}/`,
        data: {
          ...rest,
          year: editForm.year ? Number(editForm.year) : undefined,
          capacity: editForm.capacity ? Number(editForm.capacity) * 1000 : undefined,
          mileage: editForm.mileage ? Number(editForm.mileage) : undefined,
          service_interval_km: editForm.service_interval_km ? Number(editForm.service_interval_km) : null,
          last_service_mileage: editForm.last_service_mileage ? Number(editForm.last_service_mileage) : null,
          driver: editForm.driver !== '' && editForm.driver != null ? Number(editForm.driver) : null,
          ...(typeId ? { vehicle_type: typeId } : {}),
        },
      });
      setEditVehicle(null);
      load();
    } catch (e: any) {
      setEditErr(e?.message || 'Failed to update vehicle');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Vehicles</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fleet vehicle directory</div>
      </div>

      <div style={sectionStyle}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                    fontFamily: 'var(--font-mono)', fontSize: 10,                     letterSpacing: '0.08em', color: 'var(--text-tertiary)',
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
                    }}>{v.status?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {v.driver_name || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {(() => {
                      if (v.service_interval_km && v.last_service_mileage && v.mileage) {
                        const nextAt = parseFloat(String(v.last_service_mileage)) + Number(v.service_interval_km);
                        const remaining = nextAt - parseFloat(String(v.mileage));
                        return remaining > 0
                          ? `${Math.round(remaining).toLocaleString('en-ZA')} km left`
                          : 'OVERDUE';
                      }
                      if (v.last_service_mileage) {
                        return `At ${parseFloat(String(v.last_service_mileage)).toLocaleString('en-ZA')} km`;
                      }
                      return v.last_maintenance_date || '—';
                    })()}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(v)}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >Edit</button>
                      <button
                        onClick={() => setDeleteTarget({ id: v.id, name: v.plate || `Vehicle ${v.id}` })}
                        style={{
                          background: 'none', border: '1px solid var(--status-danger)',
                          color: 'var(--status-danger)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >Delete</button>
                    </div>
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

      {deleteTarget && (
        <ConfirmModal
          title="Delete Vehicle"
          message={`Are you sure you want to delete vehicle "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Edit slide-out */}
      {editVehicle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditVehicle(null)} />
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Vehicle</div>
              <button onClick={() => setEditVehicle(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {editErr && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {editErr}
              </div>
            )}
            {([
              { key: 'vin', label: 'VIN Number', type: 'text' },
              { key: 'plate', label: 'Registration Plate', type: 'text' },
              { key: 'make', label: 'Make', type: 'text' },
              { key: 'model', label: 'Model', type: 'text' },
              { key: 'year', label: 'Year', type: 'number' },
              { key: 'capacity', label: 'Capacity (ton)', type: 'number' },
              { key: 'mileage', label: 'Mileage (km)', type: 'number' },
              { key: 'service_interval_km', label: 'Service Interval (km)', type: 'number' },
              { key: 'last_service_mileage', label: 'Last Service Odometer (km)', type: 'number' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type={f.type}
                  value={editForm[f.key] ?? ''}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            {([
              { key: 'registration_expiry', label: 'Registration Expiry' },
              { key: 'last_maintenance_date', label: 'Last Maintenance Date' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <DatePicker
                  value={editForm[f.key]}
                  onChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                />
              </div>
            ))}
            {([
              { key: 'vehicle_type_name', label: 'Vehicle Type', options: vehicleTypes.length > 0 ? vehicleTypes.map(vt => vt.name) : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck'] },
              { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <Select value={editForm[f.key] ?? ''} onValueChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Assigned Driver</label>
              <Select value={String(editForm.driver ?? '')} onValueChange={val => setEditForm((prev: any) => ({ ...prev, driver: val }))}>
                <SelectTrigger><SelectValue placeholder="— No driver assigned —" /></SelectTrigger>
                <SelectContent>
                  {drivers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
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
                onClick={() => setEditVehicle(null)}
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
