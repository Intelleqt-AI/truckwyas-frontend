import { useState, useEffect } from 'react';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY_FORM = {
  vin: '', make: '', model: '', year: new Date().getFullYear(), plate: '',
  type: 'Rigid Truck', capacity: '', mileage: '', fuel_type: 'Diesel', status: 'AVAILABLE',
  registration_expiry: '', last_maintenance_date: '',
  service_interval_km: '', last_service_mileage: '',
  driver: '',
};

const TEXT_FIELDS = [
  { key: 'vin', label: 'VIN Number', placeholder: 'e.g. WDB9634031L123456' },
  { key: 'make', label: 'Make', placeholder: 'e.g. Mercedes-Benz' },
  { key: 'model', label: 'Model', placeholder: 'e.g. Actros 2645' },
  { key: 'year', label: 'Year', placeholder: '2024', type: 'number' },
  { key: 'plate', label: 'Registration Plate', placeholder: 'e.g. GP 567 ZAB' },
  { key: 'capacity', label: 'Capacity (kg)', placeholder: 'e.g. 30000', type: 'number' },
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

export function AddVehicleDrawer({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: number; name: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!open) { setSubmitError(null); return; }
    fetchData('api/v1/vehicle-types/').then((d: any) => {
      const arr = Array.isArray(d) ? d : (d?.results || []);
      setVehicleTypes(arr.map((vt: any) => ({ id: vt.id, name: vt.name })));
    }).catch(() => {});
    fetchData('api/v1/drivers/').then((d: any) => {
      const arr = Array.isArray(d) ? d : (d?.results || []);
      setDrivers(arr.map((dr: any) => ({
        id: dr.id,
        name: [dr.first_name, dr.last_name].filter(Boolean).join(' ') || dr.name || dr.username || `Driver ${dr.id}`,
      })));
    }).catch(() => {});
  }, [open]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCreate = async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const vehicleTypeId = vehicleTypes.find(vt => vt.name === form.type)?.id;
      const { type: _t, ...rest } = form;
      await postData({
        url: 'api/v1/vehicles/',
        data: {
          ...rest,
          year: Number(form.year),
          capacity: Number(form.capacity) || 0,
          mileage: form.mileage ? Number(form.mileage) : undefined,
          service_interval_km: form.service_interval_km ? Number(form.service_interval_km) : null,
          last_service_mileage: form.last_service_mileage ? Number(form.last_service_mileage) : null,
          driver: form.driver ? Number(form.driver) : null,
          ...(vehicleTypeId ? { vehicle_type: vehicleTypeId } : {}),
        },
      });
      setForm(EMPTY_FORM);
      setSubmitError(null);
      onCreated();
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to create vehicle';
      setSubmitError(msg);
      toast.error(msg);
    }
    setSaving(false);
  };

  if (!open) return null;

  const typeOptions = vehicleTypes.length > 0
    ? vehicleTypes.map(vt => vt.name)
    : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Add Vehicle</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {submitError && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            background: 'var(--status-danger-bg, #fef2f2)',
            border: '1px solid var(--status-danger, #dc2626)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{ color: 'var(--status-danger, #dc2626)', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>!</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-danger, #dc2626)', marginBottom: 2 }}>
                Failed to create vehicle
              </div>
              <div style={{ fontSize: 12, color: 'var(--status-danger, #dc2626)', opacity: 0.85 }}>
                {submitError}
              </div>
            </div>
          </div>
        )}

        {TEXT_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{f.label}</label>
            {f.type === 'date' ? (
              <DatePicker
                value={(form as any)[f.key]}
                onChange={val => set(f.key, val)}
              />
            ) : (
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => set(f.key, e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        {[
          { key: 'type', label: 'Vehicle Type', options: typeOptions },
          { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
          { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{f.label}</label>
            <Select value={(form as any)[f.key]} onValueChange={val => set(f.key, val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Assigned Driver</label>
          <Select value={form.driver} onValueChange={val => set('driver', val)}>
            <SelectTrigger><SelectValue placeholder="— No driver assigned —" /></SelectTrigger>
            <SelectContent>
              {drivers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            disabled={saving}
            onClick={handleCreate}
            style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
          >
            {saving ? 'SAVING...' : 'CREATE VEHICLE'}
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
