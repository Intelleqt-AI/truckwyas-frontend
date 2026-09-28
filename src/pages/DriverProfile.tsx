import './table-heading-roles.css';
import './fleet-detail.css';
import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { Loader } from "@/components/Loader";
import SectionHeader from "@/components/layout/SectionHeader";

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

/** Label/value row used by every detail card. `mono` only for identifiers. */
const DetailRow = ({ label, value, mono, alert }: { label: string; value: any; mono?: boolean; alert?: boolean }) => (
  <div className="fd-row">
    <span className="fd-row__label">{label}</span>
    <span className={`fd-row__value${mono ? ' fd-id' : ''}`} style={alert ? { color: 'var(--status-danger-text, var(--status-danger))' } : undefined}>{value == null || value === '' ? '—' : value}</span>
  </div>
);

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ON_LEAVE: 'warning',
};
const DAY_MS = 24 * 60 * 60 * 1000;

// Sentence-case a status token for display: "ON_LEAVE" → "On leave".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function DriverProfile() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isFinancial = location.pathname.endsWith('/financial');
  const [updating, setUpdating] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: () => fetchData(`api/v1/drivers/${driverId}/`),
    enabled: !!driverId,
  });

  const { data: loadsData } = useQuery({
    queryKey: ['driver-loads', driverId],
    queryFn: () => fetchData(`api/v1/loads/?driver=${driverId}&page_size=50`),
    enabled: !!driverId,
  });

  if (isLoading) return <Loader fullScreen />;
  if (!driver) return (
    <div className="fleet-detail">
      <SectionHeader eyebrow="Fleet" title="Driver not found" description="This driver may have been removed, or the link is out of date." />
      <button className="btn-action" onClick={() => navigate('/fleet/drivers')}>Back to drivers</button>
    </div>
  );

  const ud = driver.user_details || {};
  const firstName = driver.first_name || ud.first_name || '';
  const lastName = driver.last_name || ud.last_name || '';
  const email = driver.email || ud.email || '';
  const phone = driver.phone || ud.phone || '';
  const name = (firstName && lastName)
    ? `${firstName} ${lastName}`
    : firstName || driver.name || ud.name || ud.username || `Driver ${driver.id}`;

  const loads = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const completedLoads = loads.filter((l: any) => l.status === 'DELIVERED' || l.status === 'INVOICED');
  const totalRevenue = completedLoads.reduce((s: number, l: any) => s + parseFloat(l.total_amount || '0'), 0);
  const totalTrips = loads.length;
  const completedTrips = completedLoads.length;
  const avgRevPerTrip = completedTrips > 0 ? totalRevenue / completedTrips : 0;
  const totalDistance = completedLoads.reduce((s: number, l: any) => s + parseFloat(l.distance || '0'), 0);

  // Financial metrics
  const totalDistanceKm = loads.reduce((s: number, l: any) => s + parseFloat(l.distance || '0'), 0);
  const revPerKm = totalDistanceKm > 0 ? totalRevenue / totalDistanceKm : 0;
  const bestTripAmount = loads.length > 0 ? Math.max(...loads.map((l: any) => parseFloat(l.total_amount || '0'))) : 0;

  // The driver stats job fills revenue_generated / avg_revenue_per_trip; until
  // it has run the API sends 0.00, so fall back to the loads on this page
  // rather than show a false R 0.
  const recordedRevenue = Number(driver.revenue_generated) > 0 ? Number(driver.revenue_generated) : totalRevenue;
  const recordedAvg = Number(driver.avg_revenue_per_trip) > 0 ? Number(driver.avg_revenue_per_trip) : avgRevPerTrip;
  const licenceT = driver.license_expiry ? new Date(driver.license_expiry).getTime() : null;
  const licenceExpired = licenceT !== null && licenceT < Date.now();
  const licenceDays = licenceT !== null ? Math.ceil((licenceT - Date.now()) / DAY_MS) : null;
  const loadsBasis = loadsData?.count && loadsData.count > loads.length ? `the latest ${loads.length} of ${loadsData.count} loads` : `${totalTrips} assigned ${totalTrips === 1 ? 'load' : 'loads'}`;

  return (
    <div className="fleet-detail">
      <button className="fd-back" onClick={() => navigate('/fleet/drivers')}>← Back to drivers</button>

      <SectionHeader
        eyebrow="Driver"
        title={name}
        titleAdornment={<span className={`fd-chip fd-chip--${STATUS_TONE[driver.status] || 'neutral'}`}>{formatStatus(driver.status)}</span>}
        description={phone ? (
          driver.license_number
            ? <><span className="fd-id">{driver.license_number}</span> · {phone}</>
            : phone
        ) : undefined}
        tabs={[
          { label: 'Overview', to: `/fleet/drivers/${driverId}`, end: true },
          { label: 'Financial profile', to: `/fleet/drivers/${driverId}/financial` },
        ]}
        actions={
          <div className="fd-status-group" role="group" aria-label="Set driver status">
            {DRIVER_STATUSES.map(s => {
              const isCurrentStatus = driver.status === s;
              return (
                <button
                  key={s}
                  className="fd-button fd-status"
                  aria-pressed={isCurrentStatus}
                  disabled={isCurrentStatus || updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await patchData({ url: `api/v1/drivers/${driverId}/`, data: { status: s } });
                      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                  }}
                  style={isCurrentStatus ? undefined : { opacity: updating ? 0.5 : 1 }}
                >
                  {formatStatus(s)}
                </button>
              );
            })}
          </div>
        }
      />

      {/* ── Overview tab ── */}
      {!isFinancial && (
        <>
          {/* Key figure first: what this driver has delivered, then compliance. */}
          <section className="card fd-kpis" aria-label="Driver summary">
            <div className="fd-kpi fd-kpi--lead">
              <div className="fd-kpi__label">Revenue from completed loads</div>
              <div className="fd-kpi__value">{completedTrips > 0 ? formatZAR(totalRevenue) : '—'}</div>
              <div className="fd-kpi__note">{completedTrips > 0 ? `${formatZAR(avgRevPerTrip)} per load on average.` : 'No completed loads yet.'}</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Completed loads</div>
              <div className="fd-kpi__value">{completedTrips}<span className="fd-kpi__of">of {totalTrips}</span></div>
              <div className="fd-kpi__note">Delivered or invoiced, from {loadsBasis}.</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Licence valid until</div>
              <div className={`fd-kpi__value${licenceExpired ? ' is-danger' : ''}`}>{driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
              <div className="fd-kpi__note">
                {licenceDays === null ? 'No expiry date recorded.' : licenceExpired ? 'Expired. Renew before assigning loads.' : `${licenceDays} days from today.`}
              </div>
            </div>
          </section>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">Details</h2>
              <DetailRow label="Licence number" value={driver.license_number} mono />
              <DetailRow label="Licence province" value={driver.license_state} />
              <DetailRow label="Phone" value={phone || undefined} />
              <DetailRow label="Email" value={email || undefined} />
              <DetailRow label="Address" value={ud.address} />
              <DetailRow label="Hire date" value={driver.hire_date?.slice(0, 10)} />
              <DetailRow label="Emergency contact" value={driver.emergency_contact || driver.emergency_phone} />
              <DetailRow label="Vehicle" value={driver.assigned_vehicle} mono />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Performance</h2>
              <DetailRow label="Efficiency score" value={driver.efficiency_score || '—'} />
              <DetailRow label="On-time rate" value={Number(driver.on_time_rate) ? `${Number(driver.on_time_rate).toFixed(0)}%` : '—'} />
              <DetailRow label="Average rating" value={Number(driver.avg_rating) ? `${driver.avg_rating}` : '—'} />
              <DetailRow label="Trips this month" value={driver.trips_this_month ?? 0} />
              <DetailRow label="Total trips" value={driver.total_trips ?? totalTrips} />
              <DetailRow label="Total distance" value={Number(driver.total_distance) ? `${parseFloat(driver.total_distance).toLocaleString('en-ZA')} km` : totalDistance > 0 ? `${Math.round(totalDistance).toLocaleString('en-ZA')} km` : '—'} />
              
            </section>
          </div>

          <section className="card fd-card fd-table-card" style={{ marginTop: 24 }}>
            <h2 className="fd-card__title">Recent loads ({loads.length})</h2>
            {loads.length === 0 ? (
              <div className="fd-empty">No loads recorded</div>
            ) : (
              <div className="fd-table-scroll" role="region" aria-label="Recent loads" tabIndex={0}>
                <table className="table-heading-roles fd-table">
                  <thead>
                    <tr>
                      {['Load', 'Route', 'Distance', 'Revenue', 'Status', 'Date'].map(h => (
                        <th key={h} className={h === 'Distance' || h === 'Revenue' ? 'is-numeric' : undefined}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loads.slice(0, 10).map((load: any) => (
                      <tr
                        key={load.id}
                        onClick={() => navigate(`/bookings/${load.id}`)}
                      >
                        <td><span className="fd-id" style={{ color: 'var(--text-primary)' }}>{load.load_number}</span></td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${load.pickup_city || '—'} → ${load.delivery_city || '—'}`}>
                          {load.pickup_city || '—'} → {load.delivery_city || '—'}
                        </td>
                        <td className="is-numeric">{load.distance ? `${parseFloat(load.distance).toFixed(0)} km` : '—'}</td>
                        <td className="is-numeric" style={{ color: 'var(--text-primary)' }}>{load.total_amount ? formatZAR(parseFloat(load.total_amount)) : '—'}</td>
                        <td>{formatStatus(load.status)}</td>
                        <td>{load.created_at ? new Date(load.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Financial profile tab ── */}
      {isFinancial && (
        <>
          <section className="card fd-kpis" aria-label="Earnings summary">
            <div className="fd-kpi fd-kpi--lead">
              <div className="fd-kpi__label">Revenue generated</div>
              <div className="fd-kpi__value">{recordedRevenue > 0 ? formatCurrency(recordedRevenue) : '—'}</div>
              <div className="fd-kpi__note">{driver.total_trips ?? totalTrips} completed loads.</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Revenue per load</div>
              <div className="fd-kpi__value">{recordedAvg > 0 ? formatCurrency(recordedAvg) : '—'}</div>
              <div className="fd-kpi__note">Average across completed loads.</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Revenue per km</div>
              <div className="fd-kpi__value">{revPerKm > 0 ? `R ${revPerKm.toFixed(2)}` : '—'}</div>
              <div className="fd-kpi__note">{totalDistanceKm > 0 ? `Over ${Math.round(totalDistanceKm).toLocaleString('en-ZA')} km across all assigned loads.` : 'No distance recorded on these loads.'}</div>
            </div>
          </section>

          <div className="fd-grid">
            <section className="card fd-card">
              {/* Recorded facts only. The old safety, experience and compliance
                  "scores" were invented formulas over these same fields. */}
              <h2 className="fd-card__title">What is on their record?</h2>
              <DetailRow label="On-time rate" value={Number(driver.on_time_rate) ? `${Number(driver.on_time_rate).toFixed(0)}%` : '—'} />
              <DetailRow label="Violations" value={(driver.violation_count ?? 0).toString()} />
              <DetailRow label="Accidents" value={(driver.accident_history ?? 0).toString()} />
              <DetailRow label="Experience" value={driver.experience_years ? `${driver.experience_years} years` : '—'} />
              <DetailRow label="Hire date" value={driver.hire_date?.slice(0, 10) || '—'} />
              <DetailRow label="Licence expiry" value={driver.license_expiry?.slice(0, 10) || '—'} alert={licenceExpired} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Earnings breakdown</h2>
              <DetailRow label="Total revenue" value={recordedRevenue > 0 ? formatCurrency(recordedRevenue) : '—'} />
              <DetailRow label="Completed loads" value={(driver.total_trips ?? totalTrips).toString()} />
              <DetailRow label="Average per load" value={recordedAvg > 0 ? formatCurrency(recordedAvg) : '—'} />
              <DetailRow label="Highest load value" value={bestTripAmount > 0 ? formatCurrency(bestTripAmount) : '—'} />
              <DetailRow label="Total distance" value={totalDistanceKm > 0 ? `${Math.round(totalDistanceKm).toLocaleString('en-ZA')} km` : '—'} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">How much did they carry each month?</h2>
              <p className="fd-card__desc">Load totals by month the load was created, last six months with loads.</p>
              {(() => {
                const monthMap: Record<string, number> = {};
                loads.forEach((l: any) => {
                  if (!l.created_at) return;
                  const d = new Date(l.created_at);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  monthMap[key] = (monthMap[key] || 0) + parseFloat(l.total_amount || '0');
                });
                const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
                const maxVal = Math.max(...months.map(([, v]) => v), 1);
                if (months.length === 0) return (
                  <div className="fd-empty">No loads assigned yet.</div>
                );
                return months.map(([key, val]) => {
                  const [yr, mo] = key.split('-');
                  const label = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('en-ZA', { month: 'short', year: 'numeric' });
                  const pct = (val / maxVal) * 100;
                  return (
                    <div key={key} className="fd-score">
                      <div className="fd-score__row">
                        <span className="fd-row__label">{label}</span>
                        <span className="fd-row__value">R {val.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="fd-score__track" aria-hidden="true">
                        <div style={{ height: 6, width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Recent loads ({loads.length})</h2>
              {loads.length === 0 ? (
                <div className="fd-empty">No loads recorded</div>
              ) : loads.slice(0, 8).map((load: any) => (
                <div
                  key={load.id}
                  className="fd-row fd-row--link"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/bookings/${load.id}`); }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fd-id" style={{ color: 'var(--text-primary)' }}>{load.load_number}</div>
                    <div className="fd-row__label">{load.pickup_city || '—'} → {load.delivery_city || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fd-row__value">{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                    <div className="fd-row__label">{formatStatus(load.status)}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
