import { useState, useEffect } from 'react';
import { fetchData, patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Vehicle {
  id: number;
  vin?: string;
  make?: string;
  model?: string;
  year?: number | string;
  plate?: string;
  registration?: string; // legacy fallback field some vehicle records still carry instead of plate
  type?: string;
  vehicle_type_name?: string;
  capacity?: number | string;
  mileage?: number | string;
  fuel_type?: string;
  status?: string;
  driver?: number | null;
  registration_expiry?: string;
  last_maintenance_date?: string;
  service_interval_km?: number | string | null;
  last_service_mileage?: number | string | null;
  cartrack_current_driver_ref?: string;
}

interface Props {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onUpdated: () => void;
}

// Same field set, order, and required markers as AddVehicleDrawer — the two
// forms must stay in lockstep, so this mirrors it deliberately rather than
// each page keeping its own copy that can quietly drift.
const TEXT_FIELDS = [
  { key: 'vin', label: 'VIN Number', placeholder: 'e.g. WDB9634031L123456', required: true },
  { key: 'make', label: 'Make', placeholder: 'e.g. Mercedes-Benz', required: true },
  { key: 'model', label: 'Model', placeholder: 'e.g. Actros 2645', required: true },
  { key: 'year', label: 'Year', placeholder: '2024', type: 'number', required: true },
  { key: 'plate', label: 'Registration Plate', placeholder: 'e.g. GP 567 ZAB', required: true },
  { key: 'capacity', label: 'Capacity (ton)', placeholder: 'e.g. 30', type: 'number', required: true },
  { key: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 150000', type: 'number' },
  { key: 'registration_expiry', label: 'Registration Expiry', type: 'date' },
  { key: 'last_maintenance_date', label: 'Last Maintenance Date', type: 'date' },
  { key: 'service_interval_km', label: 'Service Interval (km)', placeholder: 'e.g. 10000', type: 'number' },
  { key: 'last_service_mileage', label: 'Last Service Odometer (km)', placeholder: 'e.g. 145000', type: 'number' },
];

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

export function EditVehicleDrawer({ open, vehicle, onClose, onUpdated }: Props) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: number; name: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!open || !vehicle) return;
    setSubmitError(null);
    setForm({
      vin: vehicle.vin || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ?? '',
      plate: vehicle.plate || vehicle.registration || '',
      capacity: vehicle.capacity != null ? String(Number(vehicle.capacity) / 1000) : '',
      mileage: vehicle.mileage != null ? String(vehicle.mileage) : '',
      registration_expiry: vehicle.registration_expiry?.slice(0, 10) || '',
      last_maintenance_date: vehicle.last_maintenance_date?.slice(0, 10) || '',
      service_interval_km: vehicle.service_interval_km != null ? String(vehicle.service_interval_km) : '',
      last_service_mileage: vehicle.last_service_mileage != null ? String(vehicle.last_service_mileage) : '',
      type: vehicle.type || vehicle.vehicle_type_name || '',
      fuel_type: vehicle.fuel_type || 'Diesel',
      status: vehicle.status || 'AVAILABLE',
      driver: vehicle.driver != null ? String(vehicle.driver) : '',
    });
    fetchData('api/v1/vehicle-types/').then((d: any) => {
      const arr = Array.isArray(d) ? d : (d?.results || []);
      setVehicleTypes(arr.map((vt: any) => ({ id: vt.id, name: vt.name })));
    }).catch(() => {});
    fetchData('api/v1/drivers/').then((d: any) => {
      const arr = Array.isArray(d) ? d : (d?.results || []);
      setDrivers(arr.map((dr: any) => ({
        id: dr.id,
        name: [dr.first_name || dr.user_details?.first_name, dr.last_name || dr.user_details?.last_name].filter(Boolean).join(' ') || dr.name || dr.username || `Driver ${dr.id}`,
      })));
    }).catch(() => {});
  }, [open, vehicle]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const canSave = !!(form.vin && form.make && form.model && form.year && form.plate && form.capacity && form.type && form.fuel_type);

  const handleSave = async () => {
    if (!vehicle) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const vehicleTypeId = vehicleTypes.find(vt => vt.name === form.type)?.id;
      const { type: _t, ...rest } = form;
      await patchData({
        url: `api/v1/vehicles/${vehicle.id}/`,
        data: {
          ...rest,
          year: Number(form.year),
          capacity: (Number(form.capacity) || 0) * 1000,
          mileage: form.mileage ? Number(form.mileage) : undefined,
          service_interval_km: form.service_interval_km ? Number(form.service_interval_km) : null,
          last_service_mileage: form.last_service_mileage ? Number(form.last_service_mileage) : null,
          driver: form.driver ? Number(form.driver) : null,
          ...(vehicleTypeId ? { vehicle_type: vehicleTypeId } : {}),
        },
      });
      onUpdated();
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to update vehicle';
      setSubmitError(msg);
      toast.error(msg);
    }
    setSaving(false);
  };

  if (!open || !vehicle) return null;

  const typeOptions = vehicleTypes.length > 0
    ? vehicleTypes.map(vt => vt.name)
    : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Vehicle</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {submitError && (
          <div style={{
            marginBottom: 20, padding: '12px 14px',
            background: 'var(--status-danger-bg, #fef2f2)',
            border: '1px solid var(--status-danger, #dc2626)',
            borderRadius: 4, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ color: 'var(--status-danger, #dc2626)', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>!</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-danger, #dc2626)', marginBottom: 2 }}>
                Failed to update vehicle
              </div>
              <div style={{ fontSize: 12, color: 'var(--status-danger, #dc2626)', opacity: 0.85 }}>
                {submitError}
              </div>
            </div>
          </div>
        )}

        {TEXT_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
            </label>
            {f.type === 'date' ? (
              <DatePicker
                value={form[f.key] ?? ''}
                onChange={val => set(f.key, val)}
              />
            ) : (
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        {[
          { key: 'type', label: 'Vehicle Type', options: typeOptions, required: true },
          { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'], required: true },
          { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
            </label>
            <Select value={form[f.key] ?? ''} onValueChange={val => set(f.key, val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Assigned Driver</label>
          <Select value={form.driver ?? ''} onValueChange={val => set('driver', val)}>
            <SelectTrigger><SelectValue placeholder="— No driver assigned —" /></SelectTrigger>
            <SelectContent>
              {drivers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {vehicle.cartrack_current_driver_ref && (
            <div style={{ marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              Cartrack reports: {vehicle.cartrack_current_driver_ref} (informational only — doesn't change the assignment above)
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          * Required.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            disabled={saving || !canSave}
            onClick={handleSave}
            style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : canSave ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: canSave ? 1 : 0.5 }}
          >
            {saving ? 'SAVING...' : 'UPDATE VEHICLE'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
