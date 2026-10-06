import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

interface Props {
  quoteNumber?: string;
  vehicleType?: string;
  busy?: boolean;
  /** The quote's own dates (YYYY-MM-DD), when it has them. */
  pickupDate?: string | null;
  deliveryDate?: string | null;
  /** dates: only when the quote lacks them and the suggested dates are shown. */
  onConfirm: (driverId: string, vehicleId: string, dates?: { pickup_date: string; delivery_date: string }) => void;
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
  background: 'var(--modal-backdrop, rgba(0,0,0,0.65))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const boxStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-dialog)',
  padding: 24,
  maxWidth: 420,
  fontFamily: 'var(--font-sans)',
  width: '100%',
};

const titleStyle: React.CSSProperties = { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 };
const messageStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', lineHeight: '20px', marginBottom: 16 };

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', minHeight: 40, background: 'transparent', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', borderRadius: 'var(--radius-control)', fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)',
  fontWeight: 500, letterSpacing: 'normal', cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg, var(--bg-surface))',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-control)',
  padding: '8px 12px',
  minHeight: 40,
  color: 'var(--text-primary)',
  fontSize: 14,
  lineHeight: '20px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

// One confirmation modal. The driver/vehicle fields stay collapsed behind a
// text toggle — most conversions don't need them right this second — and the
// action button's label reflects whatever's chosen: nothing picked converts
// and leaves the booking unassigned (pick it up later from Bookings); a
// vehicle picked (driver optional) converts pre-assigned.
// YYYY-MM-DD in local time, n days from today.
const isoInDays = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ConvertToBookingModal({ quoteNumber, vehicleType, busy, pickupDate, deliveryDate, onConfirm, onCancel }: Props) {
  useFocusTrap(latestModal, true);
  // A booking needs dates. When the quote has none, the suggested ones are
  // shown and editable here, never filled in silently.
  const needsDates = !pickupDate || !deliveryDate;
  const [pickup, setPickup] = useState(pickupDate || isoInDays(2));
  const [delivery, setDelivery] = useState(deliveryDate || isoInDays(4));
  const datesBad = needsDates && (!pickup || !delivery || delivery < pickup);
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
    queryKey: ['vehicles-available-for-booking', vehicleType],
    queryFn: () => fetchData(
      `api/v1/vehicles/?status=AVAILABLE${vehicleType ? `&vehicle_type__name=${encodeURIComponent(vehicleType)}` : ''}`
    ),
    enabled: showAssign,
  });
  const drivers: DriverOption[] = driversData?.results || driversData || [];
  const vehicles: VehicleOption[] = vehiclesData?.results || vehiclesData || [];

  // Vehicle is required to assign now; driver is optional. A driver without
  // a vehicle is ambiguous (a driver needs a truck) — same rule the backend
  // enforces on convert_to_load.
  const driverWithoutVehicle = !!driverId && !vehicleId;
  const canProceed = !driverWithoutVehicle && !datesBad && !busy;

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={boxStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="convert-booking-title">
        <h2 id="convert-booking-title" style={titleStyle}>Convert to booking</h2>
        <div style={messageStyle}>
          Convert {quoteNumber ? <b>{quoteNumber}</b> : 'this quote'} to an active booking?
        </div>

        {needsDates && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ ...messageStyle, marginBottom: 10 }}>The quote has no {!pickupDate && !deliveryDate ? 'collection or delivery date' : !pickupDate ? 'collection date' : 'delivery date'}. A booking needs both: check these suggested dates.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="convert-pickup" style={fieldLabelStyle}>Collection{pickupDate ? '' : ' (suggested)'}</label>
                <input id="convert-pickup" type="date" value={pickup} onChange={e => setPickup(e.target.value)} style={selectStyle} disabled={!!pickupDate} />
              </div>
              <div>
                <label htmlFor="convert-delivery" style={fieldLabelStyle}>Delivery{deliveryDate ? '' : ' (suggested)'}</label>
                <input id="convert-delivery" type="date" value={delivery} min={pickup || undefined} onChange={e => setDelivery(e.target.value)} style={selectStyle} disabled={!!deliveryDate} />
              </div>
            </div>
            {datesBad && <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-warning-text, var(--status-warning))', marginTop: 6 }}>Delivery can't be before collection.</div>}
          </div>
        )}

        {!showAssign ? (
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', fontSize: 14, lineHeight: '20px', minHeight: 40, fontFamily: 'var(--font-sans)', letterSpacing: 'normal', cursor: 'pointer', marginBottom: 12 }}
          >
            + Assign driver and vehicle
          </button>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="convert-vehicle" style={fieldLabelStyle}>Vehicle{vehicleType ? ` (${vehicleType})` : ''}</label>
              <select id="convert-vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={selectStyle}>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                  </option>
                ))}
              </select>
              {vehicles.length === 0 && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-warning-text, var(--status-warning))', marginTop: 6 }}>
                  {vehicleType
                    ? `No available ${vehicleType} vehicles. Check the Fleet page.`
                    : 'No available vehicles. Check the Fleet page.'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="convert-driver" style={fieldLabelStyle}>Driver (optional)</label>
              <select id="convert-driver" value={driverId} onChange={e => setDriverId(e.target.value)} style={selectStyle}>
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-warning-text, var(--status-warning))', marginTop: 6 }}>
                  No available drivers. Check the Fleet page.
                </div>
              )}
            </div>

            {driverWithoutVehicle && (
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-warning-text, var(--status-warning))', marginBottom: 12 }}>
                A driver needs a vehicle. Select a vehicle too, or clear the driver.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={() => canProceed && onConfirm(driverId, vehicleId, needsDates ? { pickup_date: pickup, delivery_date: delivery } : undefined)}
            disabled={!canProceed}
            style={{
              padding: '8px 16px',
              minHeight: 40,
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'var(--btn-action-color, #fff)',
              borderRadius: 'var(--radius-control)',
              fontSize: 14,
              lineHeight: '20px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              letterSpacing: 'normal',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.5,
            }}
          >
            {busy ? 'Converting…' : vehicleId ? 'Assign and confirm' : 'Confirm, assign later'}
          </button>
        </div>
      </div>
    </div>
  );
}
