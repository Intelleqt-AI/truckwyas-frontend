import './fleet-detail.css';
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import {
  AlertsPanel, DetailMessage, MiniStats, DetailSkeleton, Group, InfoTip, Kpi, KpiStrip, Panel, RecordHeader, Row, StatusChip,
  StatusControl, Tag, dateText, daysUntil, expiryAlert, formatStatus, isNotFound, kmText, monthlySeries, num, plural,
  randCents, randWhole, type AlertItem, type Tone,
} from '@/components/fleet-detail/parts';
import { MonthlyBars } from '@/components/fleet-detail/MonthlyBars';
import { LoadsTable } from '@/components/fleet-detail/LoadsTable';
import { useStickyRail } from '@/components/fleet-detail/useStickyRail';
import LoadError, { loadFailed } from '@/components/data/LoadError';

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ON_LEAVE: 'warning',
};

/** Licence renewal reminder window, in days. */
const LICENCE_SOON_DAYS = 60;

/* One page per driver: identity and status, the money strip, revenue by
   month and recent loads on the left, every stored field and real alerts on
   the right. /fleet/drivers/:driverId and /fleet/drivers/:driverId/financial
   both land here. */
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

  const { data: loadsData } = useQuery({
    queryKey: ['driver-loads', driverId],
    queryFn: () => fetchData(`api/v1/loads/?driver=${driverId}&page_size=50`),
    enabled: !!driverId,
  });

  if (isError && !isNotFound(loadError)) return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <button type="button" className="tw-btn tw-btn--ghost" onClick={() => navigate('/fleet/drivers')}>Back to drivers</button>
      </div>
      <LoadError what="this driver" error={loadError} busy={driverQuery.isFetching} onRetry={() => refetch()} />
    </div>
  );
  if (isLoading && !isError) return <DetailSkeleton />;
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

  const loads: any[] = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const loadsTotal: number = loadsData?.count ?? loads.length;
  const partial = loadsTotal > loads.length;
  const completedLoads = loads.filter((l: any) => l.status === 'DELIVERED' || l.status === 'INVOICED');
  const totalRevenue = completedLoads.reduce((s: number, l: any) => s + num(l.total_amount), 0);
  const totalTrips = loads.length;
  const completedTrips = completedLoads.length;
  const avgRevPerTrip = completedTrips > 0 ? totalRevenue / completedTrips : 0;
  const totalDistance = completedLoads.reduce((s: number, l: any) => s + num(l.distance), 0);
  const totalDistanceKm = loads.reduce((s: number, l: any) => s + num(l.distance), 0);
  const bestTripAmount = loads.length > 0 ? Math.max(...loads.map((l: any) => num(l.total_amount))) : 0;
  const months = monthlySeries(completedLoads);
  const monthLabels = months.map(m => m.label);

  // The driver stats job fills revenue_generated / avg_revenue_per_trip; until
  // it has run the API sends 0.00, so fall back to the loads on this page
  // rather than show a false R 0.
  const statsRevenue = Number(driver.revenue_generated) > 0;
  const recordedRevenue = statsRevenue ? Number(driver.revenue_generated) : totalRevenue;
  const recordedAvg = Number(driver.avg_revenue_per_trip) > 0 ? Number(driver.avg_revenue_per_trip) : avgRevPerTrip;
  const revPerKm = totalDistanceKm > 0 ? totalRevenue / totalDistanceKm : 0;
  const onTime = Number(driver.on_time_rate);

  const licenceDays = daysUntil(driver.license_expiry);
  const licenceExpired = licenceDays !== null && licenceDays < 0;
  const licenceSoon = licenceDays !== null && !licenceExpired && licenceDays <= LICENCE_SOON_DAYS;

  const alerts = [
    expiryAlert('licence', 'Licence', driver.license_expiry, LICENCE_SOON_DAYS),
    expiryAlert('medical', 'Medical card', driver.medical_card_expiry, 30),
  ].filter(Boolean) as AlertItem[];

  const setStatus = async (s: string) => {
    setUpdating(true);
    try {
      await patchData({ url: `api/v1/drivers/${driverId}/`, data: { status: s } });
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
    } catch (e) { console.error(e); }
    setUpdating(false);
  };

  const hasCompleted = completedTrips > 0 || recordedRevenue > 0;
  const wideLayout = !hasCompleted || loads.length < 6;

  const emergency = [driver.emergency_contact, driver.emergency_phone].filter(Boolean).join(' · ');

  return (
    <div className="fleet-detail">
      <RecordHeader
        crumb="Drivers"
        crumbTo="/fleet/drivers"
        title={name}
        chip={<StatusChip status={driver.status} />}
        meta={(driver.license_number || phone) ? <>
          {driver.license_number && <span className="fd-mono">{driver.license_number}</span>}
          {driver.license_number && phone && ' · '}
          {phone}
        </> : undefined}
        actions={<StatusControl label="Set driver status" options={DRIVER_STATUSES} current={driver.status} busy={updating} onPick={setStatus} />}
      />

      {hasCompleted ? (
      <KpiStrip label="Driver summary">
        <Kpi
          label="Revenue"
          value={recordedRevenue > 0 ? randWhole(recordedRevenue) : null}
          empty="No completed loads"
          sub={recordedAvg > 0 ? <>{randWhole(recordedAvg)} per load</> : undefined}
          info={statsRevenue
            ? <>Recorded by the driver stats job across all their completed loads. The chart below uses the latest {loads.length} loads.</>
            : <>Delivered and invoiced loads{partial ? `, latest ${loads.length} of ${loadsTotal}` : ''}.</>}
        />
        <Kpi
          label="Loads completed"
          value={completedTrips.toLocaleString('en-ZA')}
          sub={<>of {plural(totalTrips, 'load')}{partial ? ` (latest of ${loadsTotal})` : ''}</>}
          info="Delivered or invoiced."
        />
        <Kpi
          label="On time"
          value={onTime ? `${onTime.toFixed(0)}%` : null}
          empty="Not tracked yet"
          sub={onTime ? 'Of completed loads' : undefined}
          info="Completed loads with an actual delivery time on or before the planned date. Needs actual delivery times to be recorded."
        />
      </KpiStrip>
      ) : (
        <section className="fd-panel fd-empty-line" aria-label="Driver summary">
          <p className="fd-empty-line__text">No completed loads yet. {loads.length > 0 ? `${plural(loads.length, 'load')} in progress.` : `Assign ${firstName || name} to a load to track their work.`}</p>
          <button type="button" className="fd-button" onClick={() => navigate('/bookings/orders')}>Open orders</button>
        </section>
      )}

      {/* Few loads: one column, with Details laid out across the width, so the
          two columns never end hundreds of pixels apart. Otherwise the side
          rail is sticky beside the longer main column. */}
      <div className={`fd-body${wideLayout ? ' fd-body--wide' : ''}`}>
        {(hasCompleted || loads.length > 0) && (
        <div className="fd-main">
          {hasCompleted && (
          <Panel
            title="Revenue by month"
            sub="Completed loads, last 12 months"
            info={<>Delivered and invoiced loads, in the month of their delivery date (pickup or created date when missing).{partial ? ` Based on the latest ${loads.length} of ${loadsTotal} loads.` : ''}</>}
            aside={completedTrips > 0 ? <span className="fd-aside-figure">{randWhole(months.reduce((s, m) => s + m.revenue, 0))}</span> : undefined}
          >
            {completedTrips > 0
              ? <MonthlyBars data={months} caption="Completed-load revenue by month" />
              : <p className="fd-empty">No completed loads yet.</p>}
            <MiniStats items={[
              { label: 'Trips this month', value: (driver.trips_this_month ?? 0).toLocaleString('en-ZA') },
              { label: 'Total trips', value: (driver.total_trips ?? totalTrips).toLocaleString('en-ZA') },
              { label: 'Total distance', value: Number(driver.total_distance) ? kmText(parseFloat(driver.total_distance)) : totalDistance > 0 ? kmText(totalDistance) : totalDistanceKm > 0 ? kmText(totalDistanceKm) : null },
              { label: 'Revenue per km', value: revPerKm > 0 ? randCents(revPerKm) : null },
              { label: 'Highest load', value: bestTripAmount > 0 ? randWhole(bestTripAmount) : null },
            ]} />
          </Panel>
          )}

          {loads.length > 0 && (
          <Panel title="Recent loads" sub={plural(loadsTotal, 'load')} flush>
            <LoadsTable loads={loads} />
          </Panel>
          )}
        </div>
        )}

        <aside ref={railRef} className="fd-side">
          <AlertsPanel items={alerts} />

          <Panel title="Details">
            <Group title="Contact" rows={[
              { label: 'Phone', value: phone || null },
              { label: 'Email', value: email || null },
              { label: 'Address', value: ud.address || null },
              { label: 'Emergency contact', value: emergency || null },
            ]} />

            <Group title="Licence" rows={[
              { label: 'Licence number', value: driver.license_number, mono: true },
              { label: 'Province', value: driver.license_state },
              { label: 'Valid until', value: dateText(driver.license_expiry), tone: licenceExpired ? 'danger' : licenceSoon ? 'warning' : undefined },
              { label: 'Medical card', value: dateText(driver.medical_card_expiry), derived: !driver.medical_card_expiry },
            ]} />

            <Group title="Employment" rows={[
              { label: 'Hire date', value: dateText(driver.hire_date) },
              { label: 'Experience', value: driver.experience_years ? plural(Number(driver.experience_years), 'year') : null },
              { label: 'Vehicle', value: driver.assigned_vehicle, mono: true },
            ]} />

            <Group
              title="Record"
              extra={<InfoTip label="record">Violations and accidents are entered by hand. The efficiency score is rule-based: the average fuel score of the trucks this driver has driven. Ratings are not collected yet.</InfoTip>}
              rows={[
                { label: 'Violations', value: (driver.violation_count ?? 0).toString() },
                { label: 'Accidents', value: (driver.accident_history ?? 0).toString() },
                { label: 'Efficiency score', value: Number(driver.efficiency_score) ? `${driver.efficiency_score}` : null, note: <Tag>Rule-based</Tag> },
                { label: 'Average rating', value: Number(driver.avg_rating) ? `${driver.avg_rating}` : null },
              ]}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
