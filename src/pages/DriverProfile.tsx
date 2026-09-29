import './fleet-detail.css';
import { useCallback, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import {
  DetailMessage, DetailSkeleton, Panel, RecordHeader, StatusChip, StatusControl, dateText, formatStatus, isNotFound, kmText, plural,
} from '@/components/fleet-detail/parts';
import {
  ComplianceCard, FactsCard, LinkCard, LoadLink, NowLine, PerformanceCard,
  dateToDo, daysSince, fleetPerKm, isDelivered, isOpenLoad, latest, perfFigures, perfLine, performance, staleWork, staleAction, staleLabel, type ToDo,
} from '@/components/fleet-detail/record';
import { useBalancedColumns } from '@/components/fleet-detail/useBalancedColumns';
import { LoadsTable } from '@/components/fleet-detail/LoadsTable';
import { useStickyRail } from '@/components/fleet-detail/useStickyRail';
import { useLedger } from '@/components/reports/data';
import LoadError, { loadFailed } from '@/components/data/LoadError';

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

/** Licence renewal reminder window, in days. */
const LICENCE_SOON_DAYS = 60;

/* One page per driver, mirroring the vehicle page (round 4): initials and
   name, what they are doing now, what they have driven (Performance, then
   their loads with money), and in the rail what the owner acts on
   (licence and medical countdowns), their truck, contact and record.
   /fleet/drivers/:driverId and /:driverId/financial both land here. Figures
   come from this driver's loads only (not the driver stats job). */
export default function DriverProfile() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const railRef = useStickyRail<HTMLElement>();

  const driverQuery = useQuery({
    queryKey: ['driver', driverId],
    queryFn: () => fetchData(`api/v1/drivers/${driverId}/`),
    enabled: !!driverId,
    // A missing record is final; only retry transient failures.
    retry: (count: number, err: unknown) => !isNotFound(err) && count < 2,
  });
  const { data: driver, isLoading, error: queryError, refetch } = driverQuery;
  const loadError = queryError ?? driverQuery.failureReason;
  // Failing (even while retrying) with nothing to show: say so straight away.
  const isError = loadFailed(driverQuery);

  const { data: loadsData, isLoading: loadsLoading } = useQuery({
    queryKey: ['driver-loads', driverId],
    queryFn: () => fetchData(`api/v1/loads/?driver=${driverId}&page_size=50`),
    enabled: !!driverId,
  });

  // The truck assigned to this driver (vehicle.driver), from the shared vehicles
  // list; every load, for the fleet's revenue per km (the comparison).
  const ledger = useLedger(['vehicles', 'loads']);

  // The truck, contact and licence cards may drop into the main column when
  // the rail would otherwise run far past it (R5 column balance).
  const bal = useBalancedColumns({ toMain: ['truck', 'contact', 'facts'] }, `${driverId}-${isLoading}-${loadsLoading}-${ledger.loading}`);
  const sideRef = useCallback((n: HTMLElement | null) => { railRef(n); bal.sideRef.current = n; }, [railRef, bal.sideRef]);

  if (isError && !isNotFound(loadError)) return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <button type="button" className="tw-btn tw-btn--ghost" onClick={() => navigate('/fleet/drivers')}>Back to drivers</button>
      </div>
      <LoadError what="this driver" error={loadError} busy={driverQuery.isFetching} onRetry={() => refetch()} />
    </div>
  );
  // Wait for the loads and the truck list too: they decide the cards, so
  // drawing before they land would make the page jump.
  if ((isLoading || loadsLoading || ledger.loading) && !isError) return <DetailSkeleton crumb="Drivers" crumbTo="/fleet/drivers" />;
  if (!driver) return (
    <DetailMessage
      title="Driver not found"
      body="They may have been removed, or the link is out of date."
      primary={{ label: 'Back to drivers', onClick: () => navigate('/fleet/drivers') }}
    />
  );

  const ud = driver.user_details || {};
  const firstName = driver.first_name || ud.first_name || '';
  const lastName = driver.last_name || ud.last_name || '';
  const email = driver.email || ud.email || '';
  const phone = driver.phone || ud.phone || '';
  const name = (firstName && lastName)
    ? `${firstName} ${lastName}`
    : firstName || driver.name || ud.name || ud.username || `Driver ${driver.id}`;
  const did = Number(driverId);
  const status = String(driver.status || '').toUpperCase();
  const edit = () => navigate(`/fleet/drivers?edit=${did}`);

  const loads: any[] = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const loadsTotal: number = loadsData?.count ?? loads.length;
  const partial = loadsTotal > loads.length;
  const perf = performance(loads, null);
  const deliveredCount = perf.delivered.length;
  const thin = deliveredCount > 0 && deliveredCount < 3;

  // On time, only where it can be measured: an actual delivery time against the planned date.
  const timed = perf.delivered.filter((l: any) => l.actual_delivered_at && l.delivery_date);
  const onTime = timed.filter((l: any) => new Date(l.actual_delivered_at).getTime() <= new Date(l.delivery_date).setHours(23, 59, 59, 999)).length;

  // ---- Truck: assigned on the vehicle record, else the one on their open load.
  const vehicles: any[] = (ledger.data?.vehicles as any[] | undefined) ?? [];
  const truck = vehicles.find((v: any) => v.driver === did);
  const openLoad = loads.filter(isOpenLoad).sort((a, b) => String(b.pickup_date || '').localeCompare(String(a.pickup_date || '')))[0];
  const plateOf = (l: any) => (String(l?.vehicle_info || '').split(' - ').pop() || '').trim() || null;

  // ---- Now
  const lastDelivered = latest(loads.filter(isDelivered));
  const lastWhen = lastDelivered ? dateText(lastDelivered.delivery_date || lastDelivered.pickup_date) : null;
  const openOrders = <button type="button" className="fd-ghost" onClick={() => navigate('/bookings/orders')}>Open orders</button>;
  const verb: Record<string, string> = { IN_TRANSIT: 'Driving', LOADING: 'Loading', ASSIGNED: 'Assigned to' };
  let now: JSX.Element;
  const stale = staleWork(openLoad);
  if (openLoad && stale) {
    // Stale work (R6 shared rule): an order left open is not current work.
    // Neutral text, one amber dot, and the action the order page allows.
    const plate = plateOf(openLoad);
    now = (
      <NowLine dot action={<Link className="fd-ghost" to={`/bookings/${openLoad.id}`}>Open order</Link>}>
        {status !== 'ACTIVE' ? <><strong>Marked {formatStatus(status).toLowerCase()}</strong>, still on </> : <>Still on </>}
        <LoadLink load={openLoad} />
        {plate ? <> with {plate}</> : null}
        {openLoad.delivery_city ? <> to {openLoad.delivery_city}</> : null}
        {' '}{staleLabel(stale).text} — {staleAction(openLoad).toLowerCase()} on the order
      </NowLine>
    );
  } else if (openLoad) {
    const to = openLoad.delivery_city || openLoad.delivery_location;
    const plate = plateOf(openLoad);
    now = (
      <NowLine flag={status !== 'ACTIVE' ? `Marked ${formatStatus(status).toLowerCase()}` : undefined} action={undefined}>
        <strong>{verb[String(openLoad.status).toUpperCase()] ?? 'On'}</strong>
        {plate ? <> {openLoad.vehicle ? <Link className="fd-inline-link" to={`/fleet/vehicles/${openLoad.vehicle}`}>{plate}</Link> : plate}</> : null}
        {to ? <> to {to}</> : null}
        {openLoad.customer_name ? <> for {openLoad.customer_name}</> : null}
        {' · '}<LoadLink load={openLoad} />
      </NowLine>
    );
  } else if (status === 'ON_LEAVE') {
    now = <NowLine>On leave{lastWhen ? `, last load delivered ${lastWhen}` : ''}</NowLine>;
  } else if (status === 'INACTIVE') {
    now = <NowLine>Inactive{lastWhen ? `, last load delivered ${lastWhen}` : ''}</NowLine>;
  } else if (lastDelivered) {
    const idle = daysSince(lastDelivered.delivery_date || lastDelivered.pickup_date);
    now = (
      <NowLine action={openOrders}>
        <strong>Free{idle !== null && idle > 0 ? ` for ${plural(idle, 'day')}` : ''}</strong>, last load delivered {lastWhen}
        {lastDelivered.delivery_city ? ` in ${lastDelivered.delivery_city}` : ''}
      </NowLine>
    );
  } else {
    now = <NowLine action={openOrders}>Free, no loads yet</NowLine>;
  }

  // ---- Compliance
  const todos = [
    dateToDo('licence', 'Licence', driver.license_expiry, LICENCE_SOON_DAYS, { label: 'Add', onClick: edit, aria: 'Add licence expiry' }),
    dateToDo('medical', 'Medical card', driver.medical_card_expiry, 30, { label: 'Add', onClick: edit, aria: 'Add medical card expiry' }),
  ].filter(Boolean) as ToDo[];

  // ---- Performance
  const figures = perfFigures(perf, { revenueLabel: 'Revenue driven', thin, fleetKm: fleetPerKm(ledger.data?.loads) });
  if (timed.length > 0) figures.push({ label: 'On time', value: `${Math.round((onTime / timed.length) * 100)}%`, note: `${onTime} of ${timed.length} timed` });
  const basis = <>
    Delivered and invoiced loads this driver drove, counted in the month of delivery, over the last 12 months (the Reports definition).
    {' '}Revenue per km uses loads with a distance{perf.km > 0 ? ` (${kmText(perf.km)} here)` : ''}; the fleet figure is every delivered load with a distance over the same 12 months, the basis Insights uses. Days on a job count calendar days from pickup to delivery.
    {' '}On time needs an actual delivery time{timed.length === 0 ? ', and none is recorded yet, so it is not shown' : ''}.
    {partial ? ` Based on the latest ${loads.length} of ${loadsTotal} loads.` : ''}
    {perf.older > 0 ? ` ${plural(perf.older, 'older delivered load')} fall outside the 12 months.` : ''}
  </>;

  const setStatus = async (s: string) => {
    setUpdating(true);
    try {
      await patchData({ url: `api/v1/drivers/${driverId}/`, data: { status: s } });
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
    } catch (e) { console.error(e); }
    setUpdating(false);
  };

  // Years of service are said once, here (R5: a fact appears once per page).
  const meta = driver.hire_date && dateText(driver.hire_date) ? `Driving for you since ${dateText(driver.hire_date)}` : '';

  // The truck on the vehicle record, else the truck on their open order
  // (the one the Now line names, said the same way: "On LOAD-… with CA 789
  // TUV"), else none. Only a truck on the vehicle record is "theirs".
  const openPlate = openLoad ? plateOf(openLoad) : null;
  const truckCard = truck ? (
    <LinkCard title="Truck" className="fd-o-driver"
      primary={<Link className="fd-inline-link" to={`/fleet/vehicles/${truck.id}`}>{truck.plate || `Vehicle ${truck.id}`}</Link>}
      secondary={[truck.make, truck.model].filter(Boolean).join(' ') || 'Assigned to this driver'} />
  ) : openLoad && openPlate ? (
    <LinkCard title="Truck" className="fd-o-driver"
      primary={openLoad.vehicle ? <Link className="fd-inline-link" to={`/fleet/vehicles/${openLoad.vehicle}`}>{openPlate}</Link> : openPlate}
      secondary={<>On {openLoad.load_number || 'an open order'}{stale ? `, ${staleLabel(stale).text}` : ''} · no regular truck</>} />
  ) : (
    <LinkCard title="Truck" className="fd-o-driver" primary={<span className="fd-muted">No truck assigned</span>}
      action={<button type="button" className="fd-ghost" onClick={edit}>Assign</button>} />
  );

  const contactCard = (
    <FactsCard className="fd-o-contact" wide={bal.inMain('contact')} title="Contact" facts={[
      { label: 'Phone', value: phone ? <a className="fd-inline-link" href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a> : null, add: edit },
      { label: 'Email', value: email ? <a className="fd-inline-link fd-break" href={`mailto:${email}`}>{email}</a> : null, add: edit },
      { label: 'Address', value: ud.address || null },
      { label: 'Emergency contact', value: [driver.emergency_contact, driver.emergency_phone].filter(Boolean).join(' · ') || null, add: edit },
    ]} />
  );
  const factsCard = (
    <FactsCard className="fd-o-facts" wide={bal.inMain('facts')} title="Licence and record" facts={[
      { label: 'Licence number', value: driver.license_number, mono: true, add: edit },
      { label: 'Province', value: driver.license_state },
      { label: 'Violations', value: String(driver.violation_count ?? 0) },
      { label: 'Accidents', value: String(driver.accident_history ?? 0) },
    ]} />
  );

  return (
    <div className="fleet-detail">
      <RecordHeader
        crumb="Drivers"
        crumbTo="/fleet/drivers"
        title={name}
        chip={<StatusChip status={driver.status} />}
        meta={meta || undefined}
        actions={<>
          <button type="button" className="fd-button fd-head-secondary" onClick={edit}>Edit driver</button>
          <StatusControl label="Set driver status" subject={name} options={DRIVER_STATUSES} current={driver.status} busy={updating} onPick={setStatus} />
        </>}
      />

      {now}

      <div className="fd-record">
        <div className="fd-main" ref={bal.mainRef}>
          {/* With loads but none delivered in the window, Performance has one
              sentence: it becomes the Loads card's sub line (R6: no card
              holding a single line). */}
          {(deliveredCount > 0 || loads.length === 0) && (
            <PerformanceCard
              className="fd-o-perf"
              perf={perf}
              figures={figures}
              basis={basis}
              thinLine={perfLine(perf)}
              empty={deliveredCount === 0 ? {
                text: <>No loads yet. Assign {firstName || name} to a load to track their work.</>,
                action: <button type="button" className="fd-ghost" onClick={() => navigate('/bookings/orders')}>Open orders</button>,
              } : undefined}
            />
          )}

          {loads.length > 0 && (
            <Panel
              title="Loads"
              sub={deliveredCount > 0
                ? (loadsTotal > 1 ? plural(loadsTotal, 'load') : undefined)
                : `${plural(loadsTotal, 'load')} · none delivered in the last 12 months${perf.older > 0 ? ` (${perf.older} earlier)` : ''}`}
              flush
              className="fd-o-loads"
            >
              <LoadsTable loads={loads} />
            </Panel>
          )}
          {bal.inMain('truck') && truckCard}
          {bal.inMain('contact') && contactCard}
          {bal.inMain('facts') && factsCard}
        </div>

        <aside ref={sideRef} className="fd-side">
          <ComplianceCard className="fd-o-todo" items={todos} />
          {!bal.inMain('truck') && truckCard}
          {!bal.inMain('contact') && contactCard}
          {!bal.inMain('facts') && factsCard}
        </aside>
      </div>
    </div>
  );
}
