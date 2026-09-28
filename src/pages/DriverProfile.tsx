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

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div className="fd-score">
    <div className="fd-score__row">
      <span className="fd-row__label">{label}</span>
      <span className="fd-row__value">{value ?? '—'}</span>
    </div>
    <div className="fd-score__track" aria-hidden="true">
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

/** Label/value row used by every detail card. `mono` only for identifiers. */
const DetailRow = ({ label, value, mono, alert }: { label: string; value: any; mono?: boolean; alert?: boolean }) => (
  <div className="fd-row">
    <span className="fd-row__label">{label}</span>
    <span className={`fd-row__value${mono ? ' fd-id' : ''}`} style={alert ? { color: 'var(--status-danger-text, var(--status-danger))' } : undefined}>{value ?? '—'}</span>
  </div>
);

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--status-success-text, var(--status-success))',
  INACTIVE: 'var(--text-secondary)',
  ON_LEAVE: 'var(--status-warning-text, var(--status-warning))',
};

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

  // Performance scores
  const onTimeRate = driver.on_time_rate ?? 0;
  const safetyScore = Math.max(0, Math.min(100, 100 - (driver.violation_count ?? 0) * 10 - (driver.accident_history ?? 0) * 20));
  const experienceScore = Math.min(100, ((driver.experience_years ?? 0) / 15) * 100);
  const complianceScore = driver.license_expiry && new Date(driver.license_expiry) > new Date() ? 100 : 0;

  const loadStatusColor = (st: string) =>
    st === 'DELIVERED' || st === 'INVOICED' ? 'var(--status-success-text, var(--status-success))'
      : st === 'IN_TRANSIT' ? 'var(--status-warning-text, var(--status-warning))'
      : 'var(--text-secondary)';

  return (
    <div className="fleet-detail">
      <button className="fd-back" onClick={() => navigate('/fleet/drivers')}>← Back to drivers</button>

      <SectionHeader
        eyebrow="Driver"
        title={name}
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
          <div className="fd-status-group" role="group" aria-label="Driver status">
            {DRIVER_STATUSES.map(s => {
              const isCurrentStatus = driver.status === s;
              const btnColor = STATUS_COLOR[s] || 'var(--text-secondary)';
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
                  style={isCurrentStatus ? { color: btnColor, borderColor: btnColor } : { opacity: updating ? 0.5 : 1 }}
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
          <div className="fd-metrics">
            {[
              { label: 'Total revenue', value: formatZAR(totalRevenue) },
              { label: 'Total trips', value: totalTrips },
              { label: 'Avg revenue per trip', value: formatZAR(avgRevPerTrip) },
              { label: 'Completed trips', value: completedTrips },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value">{m.value}</div>
              </div>
            ))}
          </div>

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
              <DetailRow label="Efficiency score" value={driver.efficiency_score ?? '—'} />
              <DetailRow label="On-time rate" value={driver.on_time_rate ? `${driver.on_time_rate}%` : '—'} />
              <DetailRow label="Average rating" value={driver.avg_rating ? `${driver.avg_rating}` : '—'} />
              <DetailRow label="Trips this month" value={driver.trips_this_month ?? 0} />
              <DetailRow label="Total trips" value={driver.total_trips ?? totalTrips} />
              <DetailRow label="Total distance" value={driver.total_distance ? `${parseFloat(driver.total_distance).toLocaleString('en-ZA')} km` : totalDistance > 0 ? `${Math.round(totalDistance).toLocaleString('en-ZA')} km` : '—'} />
              <DetailRow label="Licence expiry" value={driver.license_expiry?.slice(0, 10) || '—'} alert={!!(driver.license_expiry && new Date(driver.license_expiry) < new Date())} />
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
                        <td style={{ color: loadStatusColor(load.status) }}>{formatStatus(load.status)}</td>
                        <td>{load.created_at?.slice(0, 10) || '—'}</td>
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
          <div className="fd-metrics">
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue generated</span></div>
              <div className="metric-value">{formatCurrency(driver.revenue_generated ?? totalRevenue)}</div>
              <div className="fd-metric-sub">{driver.total_trips ?? totalTrips} completed trips</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Avg revenue per trip</span></div>
              <div className="metric-value">{formatCurrency(driver.avg_revenue_per_trip ?? avgRevPerTrip)}</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue per km</span></div>
              <div className="metric-value">R {(revPerKm || 0).toFixed(2)}</div>
              <div className="fd-metric-sub">{(totalDistanceKm || 0).toFixed(0)} km total</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Experience</span></div>
              <div className="metric-value">{driver.experience_years ?? 0}<span className="fd-suffix"> years</span></div>
              <div className="fd-metric-sub">Hired {driver.hire_date?.slice(0, 10) || '—'}</div>
            </div>
          </div>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">Performance scores</h2>
              <ScoreBar label="On-time rate" value={onTimeRate} color="var(--accent-primary)" />
              <ScoreBar label="Safety score" value={safetyScore} color={safetyScore >= 80 ? 'var(--status-success)' : safetyScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)'} />
              <ScoreBar label="Experience score" value={experienceScore} />
              <ScoreBar label="Compliance" value={complianceScore} color={complianceScore === 100 ? 'var(--status-success)' : 'var(--status-danger)'} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Earnings breakdown</h2>
              <DetailRow label="Total revenue" value={formatCurrency(driver.revenue_generated ?? totalRevenue)} />
              <DetailRow label="Total trips" value={(driver.total_trips ?? totalTrips).toString()} />
              <DetailRow label="Avg per trip" value={formatCurrency(driver.avg_revenue_per_trip ?? avgRevPerTrip)} />
              <DetailRow label="Best trip" value={formatCurrency(bestTripAmount)} />
              <DetailRow label="Total distance" value={`${(totalDistanceKm || 0).toFixed(0)} km`} />
              <DetailRow label="Violations" value={(driver.violation_count ?? 0).toString()} />
              <DetailRow label="Accidents" value={(driver.accident_history ?? 0).toString()} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Monthly earnings</h2>
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
                  <div className="fd-empty">No data available</div>
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
                        <div style={{ height: 4, width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.5s ease' }} />
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
                    <div className="fd-row__label" style={{ color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--status-success-text, var(--status-success))' : undefined }}>{formatStatus(load.status)}</div>
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
