import './fleet-vehicles-brand.css';
import './ops-tiles.css';
import './bookings-section.css';
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import SectionHeader from "@/components/layout/SectionHeader";
import { KpiRow, KpiTile } from "@/components/ui/KpiTile";
import { InfoTip } from "@/components/ui/InfoTip";
import LoadError from "@/components/data/LoadError";
import { TilesSkeleton, BlockSkeleton } from "@/components/fleet-detail/ContentSkeleton";
import { fetchAllPages } from "@/components/insights/findings";
import { formatDate } from "@/lib/formatters";

/* Fleet status: what every truck and driver is doing right now. Not a second
   Vehicles list: trucks are grouped by what they are doing, with one line
   that reads as a sentence, and documents that need renewing are listed.

   Definitions (shared with Home's "Vehicles idle" signal, which counts
   vehicles with status Available):
     On a job        status In use
     Idle            status Available (free, with no load on the road)
     In maintenance  status Maintenance or Out of service
     Expiring        registration or insurance (trucks), licence or medical
                     (drivers) past, or due within 30 days */

const SOON_DAYS = 30;
const DAY = 86_400_000;

const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / DAY);
};

const dueText = (d: number) =>
  d < 0 ? `expired ${-d} ${d === -1 ? 'day' : 'days'} ago` : d === 0 ? 'expires today' : `expires in ${d} ${d === 1 ? 'day' : 'days'}`;

const driverName = (d: any) =>
  (d.user_details ? `${d.user_details.first_name || ''} ${d.user_details.last_name || ''}`.trim() : '') || d.name || `Driver ${d.id}`;

const ACTIVE_LOAD = ['ASSIGNED', 'LOADING', 'IN_TRANSIT'];

type Group = { key: string; title: string; tip: string; rows: { id: number; plate: string; note: string }[] };

export default function FleetDashboard() {
  const navigate = useNavigate();

  // Every page of each list (the endpoints return 20 a page), so the counts
  // match Vehicles and Insights. Loads give each busy truck its current job.
  const query = useQuery({
    queryKey: ["fleet-status"],
    queryFn: async () => {
      const [vehicles, drivers, loads] = await Promise.all([
        fetchAllPages<any>('api/v1/vehicles/'),
        fetchAllPages<any>('api/v1/drivers/'),
        fetchAllPages<any>('api/v1/loads/').catch(() => ({ rows: [], count: 0, complete: false })),
      ]);
      return { vehicles: vehicles.rows, drivers: drivers.rows, loads: loads.rows };
    },
  });
  const { data, isLoading, refetch } = query;

  useEffect(() => { document.title = 'Fleet status - TruckWys'; }, []);
  useAutoRefresh(refetch);

  const header = (
    <SectionHeader
      title="Fleet status"
      description="What every truck and driver is doing now"
      actions={<>
        <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate('/fleet/drivers')}>Drivers</button>
        <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate('/fleet/vehicles')}>Vehicles</button>
      </>}
    />
  );

  if (query.isError && !data) {
    return (
      <div className="fleet-page">
        {header}
        <LoadError what="the fleet" error={query.error} busy={query.isFetching} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="fleet-page">
        {header}
        <TilesSkeleton count={4} />
        <BlockSkeleton height={360} label="Loading fleet" />
      </div>
    );
  }

  const { vehicles, drivers, loads } = data;
  const plate = (v: any) => v.plate || v.registration || `Truck ${v.id}`;
  const activeLoadByVehicle = new Map<number, any>();
  for (const l of loads) if (l.vehicle != null && ACTIVE_LOAD.includes(l.status)) activeLoadByVehicle.set(l.vehicle, l);

  const onJob = vehicles.filter(v => v.status === 'IN_USE');
  const idle = vehicles.filter(v => v.status === 'AVAILABLE');
  const shop = vehicles.filter(v => v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE');
  const other = vehicles.filter(v => !['IN_USE', 'AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(v.status));

  const jobNote = (v: any) => {
    const l = activeLoadByVehicle.get(v.id);
    const driver = v.driver_name || l?.driver_name;
    const who = driver ? `${driver} driving` : 'No driver set';
    if (!l) return who;
    const to = l.delivery_city || l.delivery_location;
    return `${who}${to ? `, to ${to}` : ''}${l.customer_name ? ` for ${l.customer_name}` : ''}`;
  };
  const groups: Group[] = [
    { key: 'job', title: 'On a job', tip: 'Vehicles with status In use.', rows: onJob.map(v => ({ id: v.id, plate: plate(v), note: jobNote(v) })) },
    { key: 'idle', title: 'Idle', tip: 'Vehicles with status Available: free, with no load on the road. Same count as the "Vehicles idle" note on Home.', rows: idle.map(v => ({ id: v.id, plate: plate(v), note: activeLoadByVehicle.has(v.id)
      // Status says free but an open order names this truck: say so, do not hide it.
      ? `Marked available, but on open order ${activeLoadByVehicle.get(v.id).load_number}`
      : v.driver_name ? `Free, ${v.driver_name} assigned` : 'Free, no driver assigned' })) },
    { key: 'shop', title: 'In maintenance', tip: 'Vehicles with status Maintenance or Out of service.', rows: shop.map(v => ({ id: v.id, plate: plate(v), note: v.status === 'OUT_OF_SERVICE' ? 'Out of service' : v.last_maintenance_date ? `In the workshop since ${formatDate(v.last_maintenance_date)}` : 'In the workshop' })) },
    ...(other.length ? [{ key: 'other', title: 'Other', tip: 'Vehicles with any other status.', rows: other.map(v => ({ id: v.id, plate: plate(v), note: String(v.status || 'No status').replace(/_/g, ' ').toLowerCase().replace(/^./, (c: string) => c.toUpperCase()) })) }] : []),
  ];

  // Documents that need renewing, soonest (or most overdue) first.
  const docs: { key: string; who: string; what: string; days: number; date: string; to: string }[] = [];
  for (const v of vehicles) {
    for (const [what, iso] of [['Registration', v.registration_expiry], ['Insurance', v.insurance_expiry]] as const) {
      const d = daysUntil(iso);
      if (d != null && d <= SOON_DAYS) docs.push({ key: `v${v.id}${what}`, who: plate(v), what, days: d, date: iso as string, to: `/fleet/vehicles/${v.id}` });
    }
  }
  for (const dr of drivers) {
    for (const [what, iso] of [['Licence', dr.license_expiry], ['Medical', dr.medical_card_expiry]] as const) {
      const d = daysUntil(iso);
      if (d != null && d <= SOON_DAYS) docs.push({ key: `d${dr.id}${what}`, who: driverName(dr), what, days: d, date: iso as string, to: `/fleet/drivers/${dr.id}` });
    }
  }
  docs.sort((a, b) => a.days - b.days);
  const expired = docs.filter(d => d.days < 0).length;

  const activeDrivers = drivers.filter(d => d.status === 'ACTIVE');
  const onLeave = drivers.filter(d => d.status === 'ON_LEAVE').length;
  // A driver is on a job when an open order (assigned, loading, in transit) names them.
  const busyDriverIds = new Set(loads.filter(l => ACTIVE_LOAD.includes(l.status) && l.driver != null).map(l => l.driver));
  const driversFree = activeDrivers.filter(d => !busyDriverIds.has(d.id)).length;
  const onJobWithOrder = onJob.filter(v => activeLoadByVehicle.has(v.id)).length;

  return (
    <div className="fleet-page">
      {header}

      <KpiRow className="ops-kpis">
        <KpiTile
          aria-label="On a job"
          label="On a job"
          aside={<InfoTip>{groups[0].tip}</InfoTip>}
          figure={<>{onJob.length}<span className="tw-kpi__of"> of {vehicles.length}</span></>}
          note={onJob.length ? `${onJobWithOrder} with an open order` : 'No truck is out'}
        />
        <KpiTile
          aria-label="Idle"
          label="Idle"
          aside={<InfoTip>{groups[1].tip}</InfoTip>}
          figure={idle.length}
          note={idle.length ? 'Free to take a load' : 'Every truck is busy'}
        />
        <KpiTile
          aria-label="In maintenance"
          label="In maintenance"
          aside={<InfoTip>{groups[2].tip}</InfoTip>}
          figure={shop.length}
          note={shop.length ? `${shop.filter(v => v.status === 'OUT_OF_SERVICE').length} out of service` : 'None in the workshop'}
        />
        {docs.length > 0 && <KpiTile
          aria-label="Documents to renew"
          label="Documents to renew"
          aside={<InfoTip>Truck registration and insurance, driver licence and medical, expired or due within {SOON_DAYS} days.</InfoTip>}
          figure={docs.length}
          note={docs.length ? (expired ? `${expired} already expired` : `Due within ${SOON_DAYS} days`) : `None due in ${SOON_DAYS} days`}
          tone={expired ? 'danger' : 'neutral'}
        />}
      </KpiRow>

      <div className="fs-grid">
        <section className="bk-card fs-card" aria-labelledby="fs-trucks">
          <div className="bk-card__head">
            <h2 className="bk-card__title" id="fs-trucks">Trucks</h2>
            <span className="bk-toolbar__end">{vehicles.length} {vehicles.length === 1 ? 'truck' : 'trucks'}</span>
          </div>
          {groups.filter(g => g.rows.length).map(g => (
            <div key={g.key} className="fs-group">
              <h3 className="fs-group__title">{g.title} <span className="fs-group__count">{g.rows.length}</span></h3>
              <ul className="fs-list">
                {g.rows.map(r => (
                  <li key={r.id}>
                    <Link to={`/fleet/vehicles/${r.id}`} className="fs-row">
                      <span className="fs-row__id">{r.plate}</span>
                      <span className="fs-row__note">{r.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {vehicles.length === 0 && (
            <div className="bk-empty"><p className="bk-empty__text">No trucks yet. Add them on Vehicles.</p></div>
          )}
        </section>

        <div className="fs-side">
          <section className="bk-card fs-card" aria-labelledby="fs-docs">
            <div className="bk-card__head"><h2 className="bk-card__title" id="fs-docs">Documents to renew</h2></div>
            {docs.length === 0 ? (
              <p className="bk-help">Nothing expires in the next {SOON_DAYS} days.</p>
            ) : (
              <ul className="fs-list">
                {docs.map(d => (
                  <li key={d.key}>
                    <Link to={d.to} className="fs-row fs-row--stack">
                      <span className="fs-row__id">{d.who}</span>
                      <span className={`fs-row__note${d.days < 0 ? ' is-danger' : ''}`}>{d.what} {dueText(d.days)} ({formatDate(d.date)})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bk-card fs-card" aria-labelledby="fs-drivers">
            <div className="bk-card__head"><h2 className="bk-card__title" id="fs-drivers">Drivers</h2></div>
            <div className="bk-kv"><span className="bk-kv__label">Active</span><span className="bk-kv__value">{activeDrivers.length} of {drivers.length}</span></div>
            <div className="bk-kv"><span className="bk-kv__label">On an open order</span><span className="bk-kv__value">{activeDrivers.length - driversFree}</span></div>
            <div className="bk-kv"><span className="bk-kv__label">Active, not on a job</span><span className="bk-kv__value">{driversFree}</span></div>
            {onLeave > 0 && <div className="bk-kv"><span className="bk-kv__label">On leave</span><span className="bk-kv__value">{onLeave}</span></div>}
          </section>
        </div>
      </div>
    </div>
  );
}
