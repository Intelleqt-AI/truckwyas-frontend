import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { isSubscriptionBlocked, subscriptionStatusDetail } from '@/lib/subscriptionStatus';
import { ExpandableRouteMap } from "@/components/ExpandableRouteMap";
import { Loader } from '@/components/Loader';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--text-tertiary)',
  LOADING: 'var(--status-warning)',
  ASSIGNED: 'var(--status-warning)',
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: 'var(--status-success)',
  INVOICED: 'var(--accent-primary)',
  CANCELLED: 'var(--status-danger)',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['ASSIGNED', 'LOADING', 'CANCELLED'],
  LOADING:    ['ASSIGNED', 'IN_TRANSIT', 'CANCELLED'],
  ASSIGNED:   ['LOADING', 'IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  ['INVOICED'],
  INVOICED:   [],
  CANCELLED:  ['PENDING'],
};

const fmt = (dateStr?: string) =>
  dateStr ? new Date(dateStr).toLocaleDateString('en-ZA') : '—';

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function Bookings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const podModalFileRef = useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);

  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [podUploading, setPodUploading] = useState(false);
  const [podSkipping, setPodSkipping] = useState(false);
  const [podButtonUploading, setPodButtonUploading] = useState(false);
  const [podPreviewOpen, setPodPreviewOpen] = useState(false);

  const { data: load, isLoading } = useQuery({
    queryKey: ['load', id],
    queryFn: () => fetchData(`api/v1/loads/${id}/`),
    enabled: !!id,
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: () => fetchData('api/v1/drivers/?status=ACTIVE'),
    enabled: editingAssignment || assignModalOpen,
  });
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-available'],
    queryFn: () => fetchData('api/v1/vehicles/?status=AVAILABLE'),
    enabled: editingAssignment || assignModalOpen,
  });
  const { data: vehicleDetail } = useQuery({
    queryKey: ['vehicle-detail', load?.vehicle],
    queryFn: () => fetchData(`api/v1/vehicles/${load.vehicle}/`),
    enabled: !!load?.vehicle,
  });
  const [syncingLocation, setSyncingLocation] = useState(false);
  const handleSyncLocation = async () => {
    setSyncingLocation(true);
    try {
      const result: any = await postData({
        url: 'api/v1/integrations/ctrlfleet/sync-positions/',
        data: { vehicle_id: load?.vehicle },
      });
      toast.success(
        result?.sync?.updated
          ? `Position updated for ${vehicleDetail?.plate || 'this vehicle'}`
          : 'No live position available for this vehicle right now'
      );
      qc.invalidateQueries({ queryKey: ['vehicle-detail', load?.vehicle] });
    } catch (err: any) {
      toast.error(err?.message || 'Location sync failed');
    } finally {
      setSyncingLocation(false);
    }
  };

  const assignableDrivers: { id: number; user_details?: { name?: string; username?: string } }[] =
    driversData?.results || driversData || [];
  const assignableVehicles: { id: number; make?: string; model?: string; plate?: string }[] =
    vehiclesData?.results || vehiclesData || [];

  // Every mutation below changes something the Bookings/Orders list also
  // displays (status, driver, vehicle, invoice) — invalidate that cache too,
  // not just this detail view, so the list doesn't sit stale until its own
  // 30s auto-refresh happens to catch up.
  const invalidateLoad = () => {
    qc.invalidateQueries({ queryKey: ['load', id] });
    qc.invalidateQueries({ queryKey: ['loads-list'] });
    qc.invalidateQueries({ queryKey: ['loads'] });
  };

  const updateStatus = async (newStatus: string) => {
    // Dropdown is already disabled when blocked — this is defense in depth,
    // since a PATCH here would just 402 anyway.
    if (billingBlocked) return;

    const currentStatus = load?.status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      toast.error(`Cannot transition from ${currentStatus} to ${newStatus.replace('_', ' ')}`);
      return;
    }

    // A load can't be marked Assigned without a vehicle (driver is optional)
    // — rather than let the PATCH 400, open the assign flow right here so
    // the user can pick one and land on Assigned in one step.
    if (newStatus === 'ASSIGNED' && !load?.vehicle) {
      setAssignDriverId(load?.driver ? String(load.driver) : '');
      setAssignVehicleId(load?.vehicle ? String(load.vehicle) : '');
      setAssignModalOpen(true);
      return;
    }

    // Give the user a chance to attach the POD right at the point of
    // delivery, since that's normally when it's in hand — but don't force
    // it, since a PATCH straight to DELIVERED is still perfectly valid.
    if (newStatus === 'DELIVERED') {
      setPodModalOpen(true);
      return;
    }

    if (newStatus === 'CANCELLED' && !['PENDING', 'LOADING'].includes(currentStatus)) {
      setConfirmOpts({
        title: 'Cancel Load',
        message: `Cancel this load? The load is currently ${currentStatus.replace('_', ' ')}. This action is difficult to reverse.`,
        confirmLabel: 'Cancel Load',
        danger: true,
        onConfirm: async () => {
          try {
            await patchData({ url: `api/v1/loads/${id}/`, data: { status: newStatus } });
            invalidateLoad();
            toast.success('Load cancelled');
          } catch (e: any) {
            toast.error(e?.message || 'Failed to update status');
          }
        },
      });
      return;
    }

    try {
      await patchData({ url: `api/v1/loads/${id}/`, data: { status: newStatus } });
      invalidateLoad();
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    }
  };

  const uploadPOD = async (file: File) => {
    setPodButtonUploading(true);
    const formData = new FormData();
    formData.append('pod_document', file);
    try {
      const data = await postData({ url: `api/v1/loads/${id}/upload_pod/`, data: formData });
      invalidateLoad();
      toast.success(`POD uploaded: ${data.filename}`);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setPodButtonUploading(false);
    }
  };

  const uploadPODFromModal = async (file: File) => {
    setPodUploading(true);
    try {
      const data = await postData({
        url: `api/v1/loads/${id}/upload_pod/`,
        data: (() => { const fd = new FormData(); fd.append('pod_document', file); return fd; })(),
      });
      invalidateLoad();
      setPodModalOpen(false);
      toast.success(`POD uploaded (${data.filename}) — status set to Delivered`);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setPodUploading(false);
    }
  };

  const skipPodMarkDelivered = async () => {
    setPodSkipping(true);
    try {
      await patchData({ url: `api/v1/loads/${id}/`, data: { status: 'DELIVERED' } });
      invalidateLoad();
      setPodModalOpen(false);
      toast.success('Status updated to Delivered');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setPodSkipping(false);
    }
  };

  const startEditAssignment = () => {
    setAssignDriverId(load?.driver ? String(load.driver) : '');
    setAssignVehicleId(load?.vehicle ? String(load.vehicle) : '');
    setEditingAssignment(true);
  };

  const saveAssignment = async () => {
    if (billingBlocked) return;
    setAssignSaving(true);
    try {
      await postData({ url: `api/v1/loads/${id}/assign_driver/`, data: {
        driver_id: assignDriverId || null,
        vehicle_id: assignVehicleId || null,
      }});
      invalidateLoad();
      setEditingAssignment(false);
      toast.success('Assignment updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update assignment');
    } finally {
      setAssignSaving(false);
    }
  };

  const submitAssignAndActivate = async () => {
    if (billingBlocked) return;
    if (!assignVehicleId) {
      toast.error('Select a vehicle');
      return;
    }
    setAssignSaving(true);
    try {
      await postData({ url: `api/v1/loads/${id}/assign_driver/`, data: {
        driver_id: assignDriverId,
        vehicle_id: assignVehicleId,
      }});
      // assign_driver only auto-promotes PENDING -> ASSIGNED; force it
      // explicitly so this also works from LOADING, the other status that
      // can lead to ASSIGNED.
      await patchData({ url: `api/v1/loads/${id}/`, data: { status: 'ASSIGNED' } });
      invalidateLoad();
      setAssignModalOpen(false);
      toast.success('Driver and vehicle assigned — status set to Assigned');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign driver and vehicle');
    } finally {
      setAssignSaving(false);
    }
  };

  if (isLoading) return <Loader fullScreen />;

  if (!load) return (
    <div style={{ padding: 40 }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Load not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/bookings')}>← Back</button>
    </div>
  );

  const hasPOD = !!(load.pod_signature || load.pod_received_by);
  const invoiceId = load.invoice_id;
  // Driver/vehicle are locked in once the load has moved past Assigned —
  // editing them mid-transit (or after delivery/invoicing/cancellation)
  // would rewrite history that's already in motion.
  const assignmentLocked = !['PENDING', 'ASSIGNED'].includes(load.status);
  const hasInvoice = !!invoiceId;
  const allowedNextStatuses = VALID_TRANSITIONS[load.status] || [];

  return (
    <>
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← Back to loads</button>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Load Detail</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{load.load_number}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{load.customer_name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <Select value={load.status} onValueChange={updateStatus} disabled={billingBlocked}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={load.status}>{titleCase(load.status)}</SelectItem>
              {allowedNextStatuses.map(s => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          {billingBlocked && (
            <div style={{ fontSize: 11, color: 'var(--status-danger)', textAlign: 'right', maxWidth: 220 }} title={subscriptionStatusDetail(authUser?.subscription_status)}>
              Status changes are blocked —{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/settings/billing')}>
                go to billing
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      {(() => {
        const STEPS = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED'];
        const currentIdx = STEPS.indexOf(load.status);
        return (
          <div className="card" style={{ padding: '12px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {STEPS.map((step, stepIdx) => {
                const isActive = stepIdx === currentIdx;
                const isPast   = stepIdx <= currentIdx;
                // Forward-only: a step is clickable when it's a valid next
                // status from where the load is now — this also naturally
                // blocks skipping ahead, since VALID_TRANSITIONS only ever
                // lists the immediate next step(s).
                const isClickable = !billingBlocked && allowedNextStatuses.includes(step);
                return (
                  <div key={step} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 3, background: isPast ? 'var(--accent-primary)' : 'var(--border-subtle)', transition: 'background 0.3s' }} />
                    <div
                      onClick={isClickable ? () => updateStatus(step) : undefined}
                      title={isClickable ? `Mark as ${titleCase(step)}` : undefined}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 8px',
                        cursor: isClickable ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{
                        width: isActive ? 12 : 10,
                        height: isActive ? 12 : 10,
                        borderRadius: '50%',
                        background: isPast ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        boxShadow: isActive ? '0 0 0 3px rgba(77,158,255,0.25)' : (isClickable ? '0 0 0 3px rgba(77,158,255,0.12)' : 'none'),
                        transition: 'all 0.3s',
                      }} />
                      <div style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        color: isPast ? 'var(--accent-primary)' : (isClickable ? 'var(--text-secondary)' : 'var(--text-tertiary)'),
                        fontWeight: isActive ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}>
                        {step.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Amount', value: formatCurrency(parseFloat(load.total_amount || '0')), color: 'var(--accent-primary)' },
          { label: 'Distance', value: `${parseFloat(load.distance || '0').toFixed(0)} km`, color: 'var(--text-primary)' },
          { label: 'Weight', value: `${parseFloat(load.weight || '0').toFixed(0)} kg`, color: 'var(--text-primary)' },
          { label: 'Rate/km', value: `R ${(parseFloat(load.rate || '0') / Math.max(parseFloat(load.distance || '1'), 1)).toFixed(2)}`, color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Route */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>PICKUP</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.pickup_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.pickup_city}, {load.pickup_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{fmt(load.pickup_date)}</div>
            </div>
            {Array.isArray(load.stops) && load.stops.length > 0 && (
              <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>STOPS ({load.stops.length})</div>
                {load.stops.map((s: { location: string }, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{i + 1}</span>
                    {s.location}
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.cargo_description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>DELIVERY</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.delivery_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.delivery_city}, {load.delivery_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{fmt(load.delivery_date)}</div>
            </div>
          </div>

          {/* Live map — pickup, delivery, and (if the assigned vehicle is CtrlFleet-linked) its last known position */}
          <div style={{ marginTop: 16 }}>
            <ExpandableRouteMap
              pickup={`${load.pickup_location}, ${load.pickup_city}`}
              delivery={`${load.delivery_location}, ${load.delivery_city}`}
              pickupCoords={load.pickup_lat ? { lat: Number(load.pickup_lat), lon: Number(load.pickup_lng) } : undefined}
              deliveryCoords={load.delivery_lat ? { lat: Number(load.delivery_lat), lon: Number(load.delivery_lng) } : undefined}
              stops={Array.isArray(load.stops) ? load.stops.map((s: { location: string; lat: number; lon: number }) => ({ lat: Number(s.lat), lon: Number(s.lon), label: s.location })) : undefined}
              geometry={Array.isArray(load.route_geometry) && load.route_geometry.length > 1 ? load.route_geometry.map((p: { lat: number; lon: number }) => [Number(p.lat), Number(p.lon)] as [number, number]) : undefined}
              dialogStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
              currentLocation={
                vehicleDetail?.latitude && vehicleDetail?.longitude
                  ? { lat: parseFloat(vehicleDetail.latitude), lon: parseFloat(vehicleDetail.longitude) }
                  : null
              }
              currentLocationLabel={
                vehicleDetail?.last_location_at
                  ? `${vehicleDetail.plate} — last seen ${new Date(vehicleDetail.last_location_at).toLocaleString()}`
                  : undefined
              }
              height={220}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {!load.vehicle
                  ? 'No vehicle assigned yet'
                  : !vehicleDetail?.ctrlfleet_vehicle_code
                    ? 'Assigned vehicle isn’t linked to CtrlFleet — no live tracking'
                    : vehicleDetail?.last_location_at
                      ? `Last synced ${new Date(vehicleDetail.last_location_at).toLocaleString()}`
                      : 'Linked to CtrlFleet — no position synced yet'}
              </div>
              {load.vehicle && vehicleDetail?.ctrlfleet_vehicle_code && (
                <button
                  onClick={handleSyncLocation}
                  disabled={syncingLocation}
                  className="btn-action"
                  style={{ fontSize: 10 }}
                >
                  {syncingLocation ? 'SYNCING...' : 'SYNC LOCATION'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Financials */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Financials</div>
            {[
              { label: 'Base Rate', value: formatCurrency(parseFloat(load.rate || '0')) },
              { label: 'Fuel Surcharge', value: formatCurrency(parseFloat(load.fuel_surcharge || '0')) },
              { label: 'Additional', value: formatCurrency(parseFloat(load.additional_charges || '0')) },
              { label: 'Total', value: formatCurrency(parseFloat(load.total_amount || '0')), highlight: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: r.highlight ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: r.highlight ? 600 : 400 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Actions — nothing to do here before the load has a vehicle, so
              hide the whole card until it's at least Assigned. Invoicing
              itself is automatic on delivery (see convert_to_invoice from
              the delivery signal) — no manual "create invoice" trigger. */}
          {load.status !== 'PENDING' && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hasInvoice && (
                  <button
                    className="btn-action"
                    style={{ width: '100%', background: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
                  >
                    <span>✓ Invoice created</span>
                    <span style={{ opacity: 0.7, fontSize: 10 }}>—</span>
                    <span>See invoice →</span>
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) uploadPOD(e.target.files[0]); }}
                />
                <button
                  onClick={() => (hasPOD ? setPodPreviewOpen(true) : fileRef.current?.click())}
                  disabled={podButtonUploading}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: hasPOD ? 'var(--status-success-dim)' : 'var(--bg-surface)',
                    border: `1px solid ${hasPOD ? 'var(--status-success)' : 'var(--border-subtle)'}`,
                    color: hasPOD ? 'var(--status-success)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    cursor: podButtonUploading ? 'not-allowed' : 'pointer',
                    opacity: podButtonUploading ? 0.6 : 1,
                    borderRadius: 2,
                  }}
                >
                  {podButtonUploading ? 'UPLOADING…' : hasPOD ? `✓ POD: ${load.pod_received_by || 'Uploaded'}` : '↑ Upload POD'}
                </button>
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="card-title">Assignment</div>
              {!editingAssignment && !billingBlocked && !assignmentLocked && (
                <button
                  onClick={startEditAssignment}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', cursor: 'pointer', padding: 0 }}
                >
                  EDIT
                </button>
              )}
            </div>
            {billingBlocked && (
              <div style={{ fontSize: 11, color: 'var(--status-danger)', marginBottom: 8 }} title={subscriptionStatusDetail(authUser?.subscription_status)}>
                Assignment is locked —{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/settings/billing')}>
                  go to billing
                </span>
              </div>
            )}

            {!editingAssignment || assignmentLocked ? (
              [
                { label: 'Vehicle', value: load.vehicle_info || '—' },
                { label: 'Driver', value: load.driver_name || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                </div>
              ))
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Vehicle</div>
                  <Select value={assignVehicleId} onValueChange={setAssignVehicleId}>
                    <SelectTrigger><SelectValue placeholder="— No vehicle —" /></SelectTrigger>
                    <SelectContent>
                      {assignableVehicles.map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Driver (optional)</div>
                  <Select value={assignDriverId} onValueChange={setAssignDriverId}>
                    <SelectTrigger><SelectValue placeholder="— No driver —" /></SelectTrigger>
                    <SelectContent>
                      {assignableDrivers.map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(!!assignDriverId && !assignVehicleId) && (
                  <div style={{ fontSize: 11, color: 'var(--status-warning)', marginBottom: 8 }}>
                    A driver needs a vehicle — select a vehicle too, or clear the driver.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn-action"
                    style={{ flex: 1, opacity: assignSaving || (!!assignDriverId && !assignVehicleId) ? 0.6 : 1 }}
                    disabled={assignSaving || (!!assignDriverId && !assignVehicleId)}
                    onClick={saveAssignment}
                  >
                    {assignSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingAssignment(false)}
                    style={{ padding: '10px 16px', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {confirmOpts && (
      <ConfirmModal
        title={confirmOpts.title}
        message={confirmOpts.message}
        confirmLabel={confirmOpts.confirmLabel}
        danger={confirmOpts.danger}
        onConfirm={confirmOpts.onConfirm}
        onCancel={() => setConfirmOpts(null)}
      />
    )}

    {assignModalOpen && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={() => setAssignModalOpen(false)}
      >
        <div
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Assign Driver & Vehicle</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            This order needs a vehicle before it can be marked <b>Assigned</b>. A driver is optional.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Vehicle</div>
            <Select value={assignVehicleId} onValueChange={setAssignVehicleId}>
              <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
              <SelectContent>
                {assignableVehicles.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableVehicles.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 5 }}>No available vehicles — check the Fleet page.</div>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Driver (optional)</div>
            <Select value={assignDriverId} onValueChange={setAssignDriverId}>
              <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                {assignableDrivers.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableDrivers.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 5 }}>No available drivers — check the Fleet page.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              onClick={() => setAssignModalOpen(false)}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <button
              onClick={submitAssignAndActivate}
              disabled={assignSaving || !assignVehicleId}
              style={{
                padding: '8px 18px', background: 'var(--accent-primary)', border: 'none', color: '#fff',
                borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.06em',
                cursor: (assignSaving || !assignVehicleId) ? 'not-allowed' : 'pointer',
                opacity: (assignSaving || !assignVehicleId) ? 0.5 : 1,
              }}
            >
              {assignSaving ? 'ASSIGNING…' : 'ASSIGN & SET ASSIGNED'}
            </button>
          </div>
        </div>
      </div>
    )}

    {podModalOpen && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={() => (!podUploading && !podSkipping) && setPodModalOpen(false)}
      >
        <div
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Proof of Delivery</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            Attach a POD before marking this order <b>Delivered</b>, or skip and mark it delivered anyway.
          </div>

          <input
            ref={podModalFileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) uploadPODFromModal(e.target.files[0]); }}
          />
          <button
            onClick={() => podModalFileRef.current?.click()}
            disabled={podUploading || podSkipping}
            style={{
              width: '100%', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              cursor: (podUploading || podSkipping) ? 'not-allowed' : 'pointer', opacity: (podUploading || podSkipping) ? 0.6 : 1,
              marginBottom: 20,
            }}
          >
            {podUploading ? 'UPLOADING…' : '↑ UPLOAD POD & SET DELIVERED'}
          </button>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setPodModalOpen(false)}
              disabled={podUploading || podSkipping}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', cursor: (podUploading || podSkipping) ? 'not-allowed' : 'pointer' }}
            >
              CANCEL
            </button>
            <button
              onClick={skipPodMarkDelivered}
              disabled={podUploading || podSkipping}
              style={{
                padding: '8px 18px', background: 'var(--accent-primary)', border: 'none', color: '#fff',
                borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.06em',
                cursor: (podUploading || podSkipping) ? 'not-allowed' : 'pointer',
                opacity: (podUploading || podSkipping) ? 0.5 : 1,
              }}
            >
              {podSkipping ? 'UPDATING…' : 'SKIP & SET DELIVERED'}
            </button>
          </div>
        </div>
      </div>
    )}

    {podPreviewOpen && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={() => setPodPreviewOpen(false)}
      >
        <div
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 24, maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Proof of Delivery</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {load.pod_received_by || 'Received'}
              </div>
            </div>
            <button
              onClick={() => setPodPreviewOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-canvas, #f4f4f5)', borderRadius: 2, border: '1px solid var(--border-subtle)' }}>
            {load.pod_document ? (
              /\.pdf($|\?)/i.test(load.pod_document) ? (
                <iframe src={load.pod_document} title="POD document" style={{ width: '100%', height: '60vh', border: 'none' }} />
              ) : (
                <img src={load.pod_document} alt="Proof of delivery" style={{ width: '100%', height: 'auto', display: 'block' }} />
              )
            ) : (
              <div style={{ padding: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>No document file was attached — only a receipt name is on record.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            {load.pod_document && (
              <a
                href={load.pod_document}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textDecoration: 'none' }}
              >
                OPEN IN NEW TAB
              </a>
            )}
            <button
              onClick={() => { setPodPreviewOpen(false); fileRef.current?.click(); }}
              style={{ padding: '8px 18px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              REPLACE
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
