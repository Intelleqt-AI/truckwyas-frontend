import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';

interface Props {
  quoteNumber?: string;
  busy?: boolean;
  onConfirm: (driverId: string, vehicleId: string) => void;
  onCancel: () => void;
}

interface DriverOption {
  id: number;
  user_details?: { name?: string; username?: string };
}

interface VehicleOption {
  id: number;
  make?: string;
  model?: string;
  plate?: string;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2000,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const boxStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  padding: 28,
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
};

const titleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 };
const messageStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 };

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)',
  letterSpacing: '0.06em', cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg, var(--bg-surface))',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  padding: '9px 11px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 5,
};

// One confirmation modal. The driver/vehicle fields stay collapsed behind a
// text toggle — most conversions don't need them right this second — and the
// action button's label reflects whatever's chosen: nothing picked converts
// and leaves the booking unassigned (pick it up later from Bookings), both
// picked converts pre-assigned.
export function ConvertToBookingModal({ quoteNumber, busy, onConfirm, onCancel }: Props) {
  const [showAssign, setShowAssign] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const { data: driversData } = useQuery({
    queryKey: ['drivers-available-for-booking'],
    queryFn: () => fetchData('api/v1/drivers/?status=ACTIVE'),
    enabled: showAssign,
  });
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-available-for-booking'],
    queryFn: () => fetchData('api/v1/vehicles/?status=AVAILABLE'),
    enabled: showAssign,
  });
  const drivers: DriverOption[] = driversData?.results || driversData || [];
  const vehicles: VehicleOption[] = vehiclesData?.results || vehiclesData || [];

  const bothSelected = !!driverId && !!vehicleId;
  const noneSelected = !driverId && !vehicleId;
  const canProceed = (bothSelected || noneSelected) && !busy;

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={titleStyle}>Convert to Booking</div>
        <div style={messageStyle}>
          Convert {quoteNumber ? <b>{quoteNumber}</b> : 'this quote'} to an active booking?
        </div>

        {!showAssign ? (
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', cursor: 'pointer', marginBottom: 20 }}
          >
            + Assign driver and vehicle
          </button>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>Driver</div>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={selectStyle}>
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 5 }}>
                  No available drivers — check the Fleet page.
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={fieldLabelStyle}>Vehicle</div>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={selectStyle}>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                  </option>
                ))}
              </select>
              {vehicles.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 5 }}>
                  No available vehicles — check the Fleet page.
                </div>
              )}
            </div>

            {!bothSelected && !noneSelected && (
              <div style={{ fontSize: 11, color: 'var(--status-warning)', marginBottom: 12 }}>
                Select both, or clear both to assign later.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onCancel} style={cancelBtnStyle}>CANCEL</button>
          <button
            onClick={() => canProceed && onConfirm(driverId, vehicleId)}
            disabled={!canProceed}
            style={{
              padding: '8px 18px',
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#fff',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.5,
            }}
          >
            {busy ? 'CONVERTING…' : bothSelected ? 'ASSIGN & CONFIRM' : 'CONFIRM — ASSIGN LATER'}
          </button>
        </div>
      </div>
    </div>
  );
}
