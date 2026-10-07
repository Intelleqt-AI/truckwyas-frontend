import "./bookings-typography.css";
import "./bookings-section.css";
import SectionHeader from '@/components/layout/SectionHeader';
import { StatusChip } from "@/components/ui/StatusChip";
import { useStickyRail } from "@/components/fleet-detail/useStickyRail";
import { InfoTip } from "@/components/ui/InfoTip";
import { useState, useRef, useCallback } from "react";
import { FileSearch, Upload, X } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, patchData } from "@/lib/Api";
import { formatCurrency, formatDate, formatDateTime, formatDistance, formatMoney, formatNumber } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { isSubscriptionBlocked, subscriptionStatusDetail } from '@/lib/subscriptionStatus';
import { ExpandableRouteMap } from "@/components/ExpandableRouteMap";
import { StatusMenu } from '@/components/fleet-detail/StatusMenu';
import { BlockSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import { staleWork, staleLabel, staleAction } from './bookings-stale';
import { useMapFill } from './useMapFill';
import { cargoText as cargoOf } from '@/lib/cargo';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  LOADING: 'warning',
  ASSIGNED: 'warning',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  INVOICED: 'info',
  CANCELLED: 'danger',
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
  dateStr ? formatDate(dateStr) : 'Not set';

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

// "UD Trucks Quon GW26.450 - MP 567 MNO": the plate first and never broken
// across lines, then the make and model (R6).
const vehicleValue = (info?: string | null): React.ReactNode => {
  if (!info) return null;
  const parts = info.split(' - ');
  if (parts.length < 2) return <span className="bk-plate">{info}</span>;
  const plate = parts.pop()!.trim();
  return <><span className="bk-plate">{plate}</span> <span className="bk-vehicle-model">· {parts.join(' - ')}</span></>;
};

export default function Bookings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const podModalFileRef = useRef<HTMLInputElement>(null);
  const stickyRail = useStickyRail<HTMLDivElement>();
  // Columns end together (R6, within 48px): the route map takes up the
  // difference between the Route card and the rail, before paint.
  const [factsInRail, setFactsInRail] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const fill = useMapFill({ base: 240, min: 240, max: 380, paused: editingAssignment, onStuck: () => setFactsInRail(true) });
  const railRef = useCallback((node: HTMLDivElement | null) => { fill.sideRef.current = node; stickyRail(node); }, [stickyRail, fill.sideRef]);
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);

  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [podUploading, setPodUploading] = useState(false);
  const [podSkipping, setPodSkipping] = useState(false);
  const [podButtonUploading, setPodButtonUploading] = useState(false);
  const [podPreviewOpen, setPodPreviewOpen] = useState(false);
  // Dialogs: focus moves in, Tab stays inside, focus returns on close.
  useFocusTrap(latestModal, assignModalOpen);
  useFocusTrap(latestModal, podModalOpen);
  useFocusTrap(latestModal, podPreviewOpen);

  const loadQuery = useQuery({
    queryKey: ['load', id],
    queryFn: () => fetchData(`api/v1/loads/${id}/`),
    enabled: !!id,
  });
  const { data: load, isLoading } = loadQuery;
  const loadFailedNow = loadFailed(loadQuery);
  const loadError = (loadQuery.error ?? loadQuery.failureReason) as { status?: number } | null;

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
  // The driver's own status: an inactive driver still on this order is said
  // once, on the Driver row (R7).
  const { data: driverDetail } = useQuery({
    queryKey: ['driver', String(load?.driver ?? '')],
    queryFn: () => fetchData(`api/v1/drivers/${load.driver}/`),
    enabled: !!load?.driver,
    retry: false,
  });
  const driverInactive = !!load?.driver && driverDetail?.status === 'INACTIVE';
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
        title: 'Cancel load',
        message: `Cancel this load? The load is currently ${currentStatus.replace('_', ' ')}. This action is difficult to reverse.`,
        confirmLabel: 'Cancel load',
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
      toast.success(`POD uploaded (${data.filename}). Status set to Delivered.`);
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
      toast.success('Driver and vehicle assigned. Status set to Assigned.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign driver and vehicle');
    } finally {
      setAssignSaving(false);
    }
  };

  // A failed request is not a missing record: only a 404 says "not found".
  if (loadFailedNow && loadError?.status !== 404) return (
    <div className="bk-detail bookings-typography">
      <SectionHeader title="Order" back={{ to: '/bookings/orders', label: 'Orders' }} />
      <LoadError what="this order" error={loadError} busy={loadQuery.isFetching} onRetry={() => loadQuery.refetch()} />
    </div>
  );

  // Loading: keep the back link and page frame; only the content waits.
  if (isLoading && !loadFailedNow) return (
    <div className="bk-detail bookings-typography">
      <SectionHeader
        title="Loading order"
        back={{ to: '/bookings/orders', label: 'Orders' }}
      />
      <BlockSkeleton height={96} label="Loading order" />
      <div style={{ height: 24 }} />
      <BlockSkeleton height={360} label="Loading order" />
    </div>
  );

  // Not found (404): head and back link stay; message and action share a row.
  if (!load) return (
    <div className="bk-detail bookings-typography">
      <SectionHeader title="Order not found" back={{ to: '/bookings/orders', label: 'Orders' }} />
      <div className="load-error bk-missing" role="status">
        <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
        <div className="load-error__text">
          <p className="load-error__title">There is no order at this link</p>
          <p className="load-error__hint">It may have been deleted, or the link is wrong.</p>
        </div>
        <button type="button" className="tw-btn load-error__retry" onClick={() => navigate('/bookings/orders')}>All orders</button>
      </div>
    </div>
  );

  const jobFacts = (cls: string) => {
    const distance = parseFloat(load.distance || '0');
    const weight = parseFloat(load.weight || '0');
    const distanceText = distance > 0 ? formatDistance(distance) : 'Not recorded';
    // The builder's "28t <truck>" placeholder names the truck, not the cargo.
    // No cargo reads "Not specified", as on the quote (cargo.ts).
    const cargoName = cargoOf(load.cargo_description);
    const cargoText = cargoName
      ? [weight > 0 ? `${formatNumber(weight)} kg` : '', cargoName].filter(Boolean).join(', ')
      : weight > 0 ? `${formatNumber(weight)} kg, not specified` : 'Not specified';
    if (cls === 'rail') return [{ label: 'Distance', value: distanceText }, { label: 'Cargo', value: cargoText }].map(r => (
      <div key={r.label} className="bk-kv">
        <span className="bk-kv__label">{r.label}</span>
        <span className={`bk-kv__value${r.value === 'Not recorded' || r.value === 'Not specified' ? ' bk-muted' : ''}`}>{r.value}</span>
      </div>
    ));
    return (
      <dl className={cls} aria-label="Job figures">
        <div>
          <dt className="bk-fact__label">Distance</dt>
          <dd className="bk-fact__value">{distance > 0 ? formatDistance(distance) : 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="bk-fact__label">Cargo</dt>
          <dd className="bk-fact__value">{cargoText}</dd>
        </div>
      </dl>
    );
  };

  // A plain upload sets only pod_document; signature and "received by" may stay empty.
  const hasPOD = !!(load.pod_document || load.pod_signature);
  const invoiceId = load.invoice_id;
  // Driver/vehicle are locked in once the load has moved past Assigned —
  // editing them mid-transit (or after delivery/invoicing/cancellation)
  // would rewrite history that's already in motion.
  const assignmentLocked = !['PENDING', 'ASSIGNED'].includes(load.status);
  const hasInvoice = !!invoiceId;
  const allowedNextStatuses = VALID_TRANSITIONS[load.status] || [];
  const noVehicleFlag = !load.vehicle && ['LOADING', 'IN_TRANSIT'].includes(load.status) && !editingAssignment;

  return (
    <>
    <div className="bk-detail bookings-typography">
      {/* Header */}
      <SectionHeader
        title={load.load_number}
        back={{ to: '/bookings/orders', label: 'Orders' }}
        // Phones: the stepper below already marks the current status, so the
        // chip steps aside and the load number keeps the title row whole.
        titleAdornment={<span className={['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED'].includes(load.status) ? 'bk-head-chip bk-head-chip--stepper' : 'bk-head-chip'}><StatusChip status={load.status} /></span>}
        description={<>{load.customer_name}</>}
        actions={<>
          <StatusMenu
            subject={load.load_number}
            current={load.status}
            options={[
              { value: load.status, label: titleCase(load.status) },
              ...allowedNextStatuses.map(s => ({
                value: s,
                label: titleCase(s),
                hint: s === 'DELIVERED' ? 'Asks for the proof of delivery'
                  : s === 'ASSIGNED' && !load.vehicle ? 'Asks for a vehicle first'
                  : s === 'CANCELLED' ? 'Hard to reverse' : undefined,
              })),
            ]}
            disabledReason={billingBlocked ? 'Status changes are blocked until billing is sorted.' : allowedNextStatuses.length === 0 ? 'No further status for this order.' : undefined}
            // These steps open their own dialog (vehicle, proof of delivery,
            // cancel warning), so they skip the generic confirmation.
            intercept={(v) => {
              const own = v === 'DELIVERED' || (v === 'ASSIGNED' && !load.vehicle) || (v === 'CANCELLED' && !['PENDING', 'LOADING'].includes(load.status));
              if (own) updateStatus(v);
              return own;
            }}
            onChange={updateStatus}
          />
        </>}
      />

      {/* Status bar */}
      {(() => {
        const STEPS = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED'];
        const currentIdx = STEPS.indexOf(load.status);
        // Passed Assigned without a vehicle (the app's rule for Assigned):
        // the step is shown as skipped, not done (R5).
        const assignedSkipped = currentIdx >= 1 && !load.vehicle;
        // Stale work (R5): still Assigned, Loading or In transit past the
        // delivery date, or older than 30 days. Same loads Home and Findings
        // call out; one neutral line with one amber dot.
        const stale = staleWork(load);
        // The one step this page can actually take (R6). Assignment is
        // locked once a load is Loading or In transit, so those are closed
        // through Change status, never "reassigned".
        // The shared action words (staleAction), plus where on this page to
        // do it. Loading cannot go straight to Delivered here, so it says
        // "in transit" instead.
        // Phones: Change status lives in the title row's ⋯ menu, so the
        // line says where to find it (R7).
        const viaStatus = <>Change status<span className="bk-phone-note"> in the ⋯ menu</span></>;
        // An Assigned load whose driver is marked inactive can't be started:
        // say only what is possible (R8).
        const staleAct = load.status === 'LOADING'
          ? <>Mark it in transit or cancel it via {viaStatus}</>
          : load.status === 'ASSIGNED' && driverInactive
            ? (billingBlocked ? <>Reassign it or cancel it via {viaStatus}</> : <>Reassign it with Edit or cancel it via {viaStatus}</>)
          : ['PENDING', 'ASSIGNED'].includes(load.status) && !billingBlocked
            ? <>{staleAction(load)} with Edit or {viaStatus}</>
            : <>{staleAction(load)} via {viaStatus}</>;
        return (
          <section className="bk-card bk-progress" aria-label="Order progress">
          {/* One grid column per step: the dot sits at the column centre and
              each connector runs from the previous dot to this one, so line
              segments always meet the dots. Status changes go through
              "Change status"; the steps only show progress. */}
          <ol className="bk-steps" aria-label="Order progress">
            {STEPS.map((step, stepIdx) => {
              const isActive = stepIdx === currentIdx;
              const isPast = stepIdx <= currentIdx;
              const skipped = step === 'ASSIGNED' && assignedSkipped;
              return (
                <li key={step} aria-current={isActive ? 'step' : undefined} className={`bk-step${isPast ? ' is-done' : ''}${isActive ? ' is-current' : ''}${skipped ? ' is-skipped' : ''}`} title={skipped ? 'Skipped: no vehicle or driver was assigned' : undefined}>
                  <span className="bk-step__dot" aria-hidden="true" />
                  <span className="bk-step__label">{titleCase(step)}{skipped && <span className="sr-only"> (skipped, nothing assigned)</span>}</span>
                </li>
              );
            })}
          </ol>
          {stale && (
            <p className="bk-stale" role="status">
              <span className="bk-dot bk-dot--warning" aria-hidden="true" />
              <span>
                {/* Overdue: the delivery date is already on the route, so
                    the line gives the day count only (R9). */}
                Still {titleCase(load.status).toLowerCase()},{' '}
                {stale.overdue
                  ? <><b>{staleLabel(stale).days}</b> past its delivery date</>
                  : <>open <b>{staleLabel(stale).text}</b></>}. {staleAct}.
              </span>
            </p>
          )}
          {billingBlocked && (
            <p className="bk-help bk-help--danger bk-progress__note" title={subscriptionStatusDetail(authUser?.subscription_status)}>
              Status changes are blocked.{' '}
              <button type="button" className="bk-link" onClick={() => navigate('/settings/billing')}>Go to billing</button>
            </p>
          )}
          </section>
        );
      })()}


      {/* Main column plus a sticky rail, so unequal heights read as a rail. */}
      <div className="bk-detail-grid bk-detail-grid--rail">
        {/* Route */}
        <section ref={fill.mainRef} className="bk-card" aria-labelledby="bk-route-title">
          <div className="bk-card__head"><h2 className="bk-card__title" id="bk-route-title">Route</h2></div>
          <ol className="bk-route">
            <li className="bk-route__stop">
              <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
              <div>
                <div className="bk-route__label">Pickup</div>
                <div className="bk-route__place">{load.pickup_location}</div>
                <div className="bk-route__meta">{[load.pickup_city, load.pickup_state].filter(Boolean).join(', ')}{load.pickup_date ? ` · ${fmt(load.pickup_date)}` : ''}</div>
              </div>
            </li>
            {Array.isArray(load.stops) && load.stops.map((s: { location: string }, i: number) => (
              <li key={i} className="bk-route__stop">
                <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                <div>
                  <div className="bk-route__label">Stop {i + 1}</div>
                  <div className="bk-route__place">{s.location}</div>
                </div>
              </li>
            ))}
            <li className="bk-route__stop">
              <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
              <div>
                <div className="bk-route__label">Delivery</div>
                <div className="bk-route__place">{load.delivery_location}</div>
                <div className="bk-route__meta">{[load.delivery_city, load.delivery_state].filter(Boolean).join(', ')}{load.delivery_date ? ` · ${fmt(load.delivery_date)}` : ''}</div>
              </div>
            </li>
          </ol>

          {!factsInRail && jobFacts('bk-facts bk-facts--job')}

          {/* Live map — pickup, delivery, and (if the assigned vehicle is CtrlFleet-linked) its last known position */}
          <div style={{ marginTop: 16 }}>
            <ExpandableRouteMap
              pickup={`${load.pickup_location}, ${load.pickup_city}`}
              delivery={`${load.delivery_location}, ${load.delivery_city}`}
              pickupCoords={load.pickup_lat ? { lat: Number(load.pickup_lat), lon: Number(load.pickup_lng) } : undefined}
              deliveryCoords={load.delivery_lat ? { lat: Number(load.delivery_lat), lon: Number(load.delivery_lng) } : undefined}
              stops={Array.isArray(load.stops) ? load.stops.map((s: { location: string; lat: number; lon: number }) => ({ lat: Number(s.lat), lon: Number(s.lon), label: s.location })) : undefined}
              geometry={Array.isArray(load.route_geometry) && load.route_geometry.length > 1 ? load.route_geometry.map((p: { lat: number; lon: number }) => [Number(p.lat), Number(p.lon)] as [number, number]) : undefined}
              dialogStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-dialog, 16px)', boxShadow: 'none' }}
              currentLocation={
                vehicleDetail?.latitude && vehicleDetail?.longitude
                  ? { lat: parseFloat(vehicleDetail.latitude), lon: parseFloat(vehicleDetail.longitude) }
                  : null
              }
              currentLocationLabel={
                vehicleDetail?.last_location_at
                  ? `${vehicleDetail.plate}, last seen ${formatDateTime(vehicleDetail.last_location_at)}`
                  : undefined
              }
              height={fill.height}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <p className="bk-help">
                {!load.vehicle
                  ? assignmentLocked
                    // The Assignment flag already names the missing vehicle (R9).
                    ? 'No live position for this order.'
                    : 'Live position shows once a vehicle is assigned.'
                  : !vehicleDetail?.ctrlfleet_vehicle_code
                    ? 'The assigned vehicle is not linked to CtrlFleet, so there is no live tracking.'
                    : vehicleDetail?.last_location_at
                      ? `Last synced ${formatDateTime(vehicleDetail.last_location_at)}`
                      : 'Linked to CtrlFleet. No position synced yet.'}
              </p>
              {load.vehicle && vehicleDetail?.ctrlfleet_vehicle_code && (
                <button
                  type="button"
                  onClick={handleSyncLocation}
                  disabled={syncingLocation}
                  className="bk-btn bk-btn--secondary"
                >
                  {syncingLocation ? 'Syncing…' : 'Sync location'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right column: sticky rail */}
        <div ref={railRef} className="bk-stack">
          {/* Financials */}
          <section className="bk-card" aria-labelledby="bk-fin-title">
            <div className="bk-card__head"><h2 className="bk-card__title" id="bk-fin-title">Financials</h2></div>
            {(() => {
              // The shown lines must add up to the total (R9). When the stored
              // total carries charges not broken down on the order, say so in
              // one muted line instead of leaving a gap.
              const rate = parseFloat(load.rate || '0') || 0;
              const fuel = parseFloat(load.fuel_surcharge || '0') || 0;
              const extra = parseFloat(load.additional_charges || '0') || 0;
              // Tolls and the driver allowance, copied from the quote on
              // conversion (newer API; older loads have neither, or 0).
              const tolls = parseFloat(load.toll_charges || '0') || 0;
              const driver = parseFloat(load.driver_allowance || '0') || 0;
              const total = parseFloat(load.total_amount || '0') || 0;
              const gap = Math.round((total - (rate + fuel + tolls + driver + extra)) * 100) / 100;
              // The per-km figure is a rate, not a summand, so it sits as a
              // note under Base rate rather than among the lines (R10).
              const dist = parseFloat(load.distance || '0') || 0;
              const perKm = dist > 0 ? `${formatMoney(rate / Math.max(dist, 1))}/km` : null;
              const rows: { label: React.ReactNode; key?: string; value: string; note?: React.ReactNode; noteTitle?: string; muted?: boolean }[] = [
              { label: 'Base rate', value: formatCurrency(rate), note: perKm, noteTitle: 'Base rate divided by distance, before surcharges' },
              { label: 'Fuel', value: formatCurrency(fuel) },
              ...(tolls > 0 ? [{ label: 'Tolls', value: formatCurrency(tolls) }] : []),
              ...(driver > 0 ? [{ label: 'Driver allowance', value: formatCurrency(driver) }] : []),
              { label: 'Cross-border and other charges', value: formatCurrency(extra) },
              ];
              // Normal weight: when it is a large share of the total it is the
              // line a reader most needs to see, never the faintest one.
              if (Math.abs(gap) > 0.5) rows.push({
                key: 'not-itemised',
                label: <>Not itemised <InfoTip>{load.quote_number
                  ? `The order total includes charges not broken down here. Quote ${load.quote_number} has the full breakdown.`
                  : 'Set on the order when it was created: its total includes charges that were not entered as separate lines.'}</InfoTip></>,
                value: formatCurrency(gap),
                // The tip names the quote; this line takes you there (R11).
                note: load.quote != null && load.quote_number ? (
                  <a className="bk-link bk-link--sm" style={{ display: 'inline-block', padding: '12px 0', margin: '-12px 0', whiteSpace: 'nowrap' }} title="Open the quote with the full breakdown" href={`/bookings/quotes/${load.quote}`} onClick={(e) => { e.preventDefault(); navigate(`/bookings/quotes/${load.quote}`); }}>
                    Quote {load.quote_number}
                  </a>
                ) : null,
              });
              return rows.map(r => (
                <div key={r.key ?? String(r.label)} className={`bk-kv${r.muted ? ' bk-muted' : ''}`}>
                  <span className="bk-kv__label">{r.label}</span>
                  <span className={`bk-kv__value${r.muted || r.value === 'Not recorded' ? ' bk-muted' : ''}`}>
                    {r.value}
                    {r.note && <span className="bk-kv__note" title={r.noteTitle}>{r.note}</span>}
                  </span>
                </div>
              ));
            })()}
            {(() => {
              // Total excl. VAT, then VAT and the total incl. VAT (same rule
              // as the quote: 15%, or 0% for international; backend quote_vat).
              const vat = load.customer_price as { vat_registered: boolean; vat_label: string; vat_amount: string; total_incl_vat: string } | undefined;
              const excl = (
                <div className={`bk-kv${vat?.vat_registered ? '' : ' bk-kv--total'}`}>
                  <span className="bk-kv__label">{vat?.vat_registered ? 'Total excl. VAT' : 'Total'}</span>
                  <span className="bk-kv__value">{formatCurrency(parseFloat(load.total_amount || '0'))}</span>
                </div>
              );
              if (!vat?.vat_registered) return excl;
              return (
                <>
                  {excl}
                  <div className="bk-kv">
                    <span className="bk-kv__label">{vat.vat_label}</span>
                    <span className="bk-kv__value">{formatCurrency(parseFloat(vat.vat_amount))}</span>
                  </div>
                  <div className="bk-kv bk-kv--total">
                    <span className="bk-kv__label">Total incl. VAT</span>
                    <span className="bk-kv__value">{formatCurrency(parseFloat(vat.total_incl_vat))}</span>
                  </div>
                </>
              );
            })()}
            {/* What fuel was expected to cost vs what was spent (expenses on
                this order's trips). Hidden when there's neither figure. */}
            {(() => {
              const est: number | null = load.fuel_cost_estimated ?? null;
              const act: number | null = load.fuel_cost_actual ?? null;
              if (est == null && act == null) return null;
              const diff = est != null && act != null ? Math.round((act - est) * 100) / 100 : null;
              return (
                <div className="bk-fuel">
                  <div className="bk-fuel__title">
                    Fuel cost
                    <InfoTip label="About fuel cost">Estimated is the fuel line of the quote this order came from. Actual is the approved fuel expenses logged against this order's trips. Fuel bought without a trip on the expense isn't counted here.</InfoTip>
                  </div>
                  <div className="bk-kv">
                    <span className="bk-kv__label">Estimated</span>
                    <span className={`bk-kv__value${est == null ? ' bk-muted' : ''}`}>{est != null ? formatCurrency(est) : 'Not recorded'}</span>
                  </div>
                  <div className="bk-kv">
                    <span className="bk-kv__label">Actual</span>
                    <span className={`bk-kv__value${act == null ? ' bk-muted' : ''}`}>{act != null ? formatCurrency(act) : 'Not recorded'}</span>
                  </div>
                  {diff != null && Math.abs(diff) >= 0.5 && (
                    <div className="bk-kv">
                      <span className="bk-kv__label">Difference</span>
                      <span className={`bk-kv__value${diff > 0 ? ' bk-fuel__over' : ''}`}>
                        {diff > 0 ? `${formatCurrency(diff)} over` : `${formatCurrency(-diff)} under`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Job figures join the rail when the main column would otherwise
              run long even with the smallest map (Pending loads have no
              document buttons, so their rail is short). */}
          {factsInRail && (
            <section className="bk-card" aria-labelledby="bk-job-title">
              <div className="bk-card__head"><h2 className="bk-card__title" id="bk-job-title">Job</h2></div>
              {jobFacts('rail')}
            </section>
          )}

          {/* Assignment and the order's documents */}
          <section className="bk-card" aria-labelledby="bk-assign-title">
            <div className="bk-card__head">
              <h2 className="bk-card__title" id="bk-assign-title">Assignment</h2>
              {!editingAssignment && !billingBlocked && !assignmentLocked && (
                <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={startEditAssignment} style={{ margin: '-6px 0' }}>
                  Edit
                </button>
              )}
            </div>
            {billingBlocked && (
              <p className="bk-help bk-help--danger" style={{ marginBottom: 8 }} title={subscriptionStatusDetail(authUser?.subscription_status)}>
                Assignment is locked.{' '}
                <button type="button" className="bk-link" onClick={() => navigate('/settings/billing')}>Go to billing</button>
              </p>
            )}

            {/* An order on the move with no vehicle is not a normal state: say so once, calmly. */}
            {noVehicleFlag && (
              <div className="bk-assign__flag">
                <StatusChip tone="warning" size="sm" label={`${load.status === 'IN_TRANSIT' ? 'In transit' : 'Loading'} · no vehicle${load.driver_name ? '' : ' or driver'} assigned`} />
                <p className="bk-help">
                  {load.status === 'LOADING'
                    ? 'To add the vehicle, move it back to Assigned via Change status; that asks for one.'
                    : `The vehicle can't be changed once a load is in transit.${staleWork(load) ? '' : ' Mark it delivered or cancel it via Change status.'}`}
                </p>
              </div>
            )}
            {!editingAssignment || assignmentLocked ? (
              [
                { label: 'Vehicle', value: load.vehicle_info || 'Not assigned', node: vehicleValue(load.vehicle_info) },
                { label: 'Driver', value: load.driver_name || 'Not assigned', node: load.driver_name && driverInactive ? <>{load.driver_name} <span className="bk-muted">· marked inactive</span></> : undefined },
              ]
                // The flag above already says what is missing (R9): say it once.
                .filter(r => !(noVehicleFlag && r.value === 'Not assigned'))
                .map((r: { label: string; value: string; node?: React.ReactNode }) => (
                <div key={r.label} className="bk-kv">
                  <span className="bk-kv__label">{r.label}</span>
                  <span className={`bk-kv__value${r.value === 'Not assigned' ? ' bk-muted' : ''}`}>{r.node ?? r.value}</span>
                </div>
              ))
            ) : (
              <>
                <div className="bk-field">
                  <span className="bk-field__label" id="bk-assign-vehicle">Vehicle</span>
                  <Select value={assignVehicleId} onValueChange={setAssignVehicleId}>
                    <SelectTrigger aria-labelledby="bk-assign-vehicle"><SelectValue placeholder="No vehicle" /></SelectTrigger>
                    <SelectContent>
                      {assignableVehicles.map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bk-field">
                  <span className="bk-field__label" id="bk-assign-driver">Driver (optional)</span>
                  <Select value={assignDriverId} onValueChange={setAssignDriverId}>
                    <SelectTrigger aria-labelledby="bk-assign-driver"><SelectValue placeholder="No driver" /></SelectTrigger>
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
                  <p className="bk-help bk-help--warning" style={{ marginBottom: 8 }}>
                    A driver needs a vehicle. Select a vehicle too, or clear the driver.
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="bk-btn bk-btn--primary"
                    style={{ flex: 1 }}
                    disabled={assignSaving || (!!assignDriverId && !assignVehicleId)}
                    onClick={saveAssignment}
                  >
                    {assignSaving ? 'Saving…' : 'Save assignment'}
                  </button>
                  <button
                    type="button"
                    className="bk-btn bk-btn--secondary"
                    onClick={() => setEditingAssignment(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
            {/* Documents for the order (was a separate one-button Actions card).
                Nothing to do before the load has a vehicle, so hidden while
                Pending. Invoicing itself is automatic on delivery. */}
            {load.status !== 'PENDING' && !editingAssignment && (
              <div className="bk-assign__actions">
                {hasInvoice && (
                  <button
                    type="button"
                    className="bk-btn bk-btn--primary bk-btn--block"
                    onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
                  >
                    View invoice
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
                  type="button"
                  className="bk-btn bk-btn--block bk-btn--secondary"
                  onClick={() => (hasPOD ? setPodPreviewOpen(true) : fileRef.current?.click())}
                  disabled={podButtonUploading}
                >
                  {podButtonUploading ? 'Uploading…' : hasPOD ? (load.pod_received_by ? `View POD, received by ${load.pod_received_by}` : 'View POD') : <><Upload size={16} aria-hidden="true" /> Upload POD</>}
                </button>
              </div>
            )}
          </section>
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
      <div className="bk-dialog-backdrop" onClick={() => setAssignModalOpen(false)}>
        <div className="bk-dialog" role="dialog" aria-modal="true" aria-labelledby="bk-assign-dialog-title" onClick={e => e.stopPropagation()}>
          <h2 className="bk-dialog__title" id="bk-assign-dialog-title">Assign driver and vehicle</h2>
          <p className="bk-dialog__body">
            This order needs a vehicle before it can be marked <b>Assigned</b>. A driver is optional.
          </p>

          <div className="bk-field">
            <span className="bk-field__label" id="bk-modal-vehicle">Vehicle</span>
            <Select value={assignVehicleId} onValueChange={setAssignVehicleId}>
              <SelectTrigger aria-labelledby="bk-modal-vehicle"><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
              <SelectContent>
                {assignableVehicles.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {[v.make, v.model].filter(Boolean).join(' ')}{v.plate ? ` · ${v.plate}` : ` #${v.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableVehicles.length === 0 && (
              <p className="bk-help bk-help--warning">No vehicles are available. Check the Fleet page.</p>
            )}
          </div>

          <div className="bk-field" style={{ marginBottom: 0 }}>
            <span className="bk-field__label" id="bk-modal-driver">Driver (optional)</span>
            <Select value={assignDriverId} onValueChange={setAssignDriverId}>
              <SelectTrigger aria-labelledby="bk-modal-driver"><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                {assignableDrivers.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableDrivers.length === 0 && (
              <p className="bk-help bk-help--warning">No drivers are available. Check the Fleet page.</p>
            )}
          </div>

          <div className="bk-dialog__footer">
            <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="bk-btn bk-btn--primary"
              onClick={submitAssignAndActivate}
              disabled={assignSaving || !assignVehicleId}
            >
              {assignSaving ? 'Assigning…' : 'Assign and mark assigned'}
            </button>
          </div>
        </div>
      </div>
    )}

    {podModalOpen && (
      <div className="bk-dialog-backdrop" onClick={() => (!podUploading && !podSkipping) && setPodModalOpen(false)}>
        <div className="bk-dialog" role="dialog" aria-modal="true" aria-labelledby="bk-pod-dialog-title" onClick={e => e.stopPropagation()}>
          <h2 className="bk-dialog__title" id="bk-pod-dialog-title">Proof of delivery</h2>
          <p className="bk-dialog__body">
            Attach a POD before marking this order <b>Delivered</b>, or skip and mark it delivered anyway.
          </p>

          <input
            ref={podModalFileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) uploadPODFromModal(e.target.files[0]); }}
          />
          <button
            type="button"
            className="bk-btn bk-btn--secondary bk-btn--block"
            onClick={() => podModalFileRef.current?.click()}
            disabled={podUploading || podSkipping}
          >
            {podUploading ? 'Uploading…' : <><Upload size={16} aria-hidden="true" /> Upload POD and mark delivered</>}
          </button>

          <div className="bk-dialog__footer">
            <button
              type="button"
              className="bk-btn bk-btn--secondary"
              onClick={() => setPodModalOpen(false)}
              disabled={podUploading || podSkipping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bk-btn bk-btn--primary"
              onClick={skipPodMarkDelivered}
              disabled={podUploading || podSkipping}
            >
              {podSkipping ? 'Updating…' : 'Skip and mark delivered'}
            </button>
          </div>
        </div>
      </div>
    )}

    {podPreviewOpen && (
      <div className="bk-dialog-backdrop" onClick={() => setPodPreviewOpen(false)}>
        <div
          className="bk-dialog"
          role="dialog" aria-modal="true" aria-labelledby="bk-pod-preview-title"
          style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 className="bk-dialog__title" id="bk-pod-preview-title" style={{ marginBottom: 0 }}>Proof of delivery</h2>
              <p className="bk-help">{load.pod_received_by || 'Received'}</p>
            </div>
            <button type="button" className="bk-icon-btn" aria-label="Close" onClick={() => setPodPreviewOpen(false)} style={{ margin: '-8px -8px 0 0' }}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-deep)', borderRadius: 'var(--radius-nested, 8px)', border: '1px solid var(--border-subtle)' }}>
            {load.pod_document ? (
              /\.pdf($|\?)/i.test(load.pod_document) ? (
                <iframe src={load.pod_document} title="POD document" style={{ width: '100%', height: '60vh', border: 'none' }} />
              ) : (
                <img src={load.pod_document} alt="Proof of delivery" style={{ width: '100%', height: 'auto', display: 'block' }} />
              )
            ) : (
              <p className="bk-help" style={{ padding: 24 }}>No document file was attached. Only the name of the person who received it is on record.</p>
            )}
          </div>

          <div className="bk-dialog__footer" style={{ marginTop: 16 }}>
            {load.pod_document && (
              <a className="bk-btn bk-btn--secondary" href={load.pod_document} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            )}
            <button
              type="button"
              className="bk-btn bk-btn--primary"
              onClick={() => { setPodPreviewOpen(false); fileRef.current?.click(); }}
            >
              Replace POD
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
