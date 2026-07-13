import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', }}>{label}</span>
      <span style={{ fontSize: 13, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--status-success)',
  INACTIVE: 'var(--text-tertiary)',
  ON_LEAVE: 'var(--status-warning)',
};

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

  if (isLoading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
  );
  if (!driver) return (
    <div style={{ padding: 40 }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Driver not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/fleet/drivers')}>← BACK</button>
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.05em',
    fontWeight: active ? 600 : 400,
    padding: '12px 0', marginRight: 24, cursor: 'pointer', marginBottom: -1,
    transition: 'all 0.2s ease',
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/fleet/drivers')}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >← BACK TO DRIVERS</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>DRIVER</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{name}</div>
            {phone && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {driver.license_number ? `${driver.license_number} · ${phone}` : phone}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DRIVER_STATUSES.map(s => {
              const isCurrentStatus = driver.status === s;
              const btnColor = STATUS_COLOR[s] || 'var(--text-tertiary)';
              return (
                <button
                  key={s}
                  disabled={isCurrentStatus || updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await patchData({ url: `api/v1/drivers/${driverId}/`, data: { status: s } });
                      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: isCurrentStatus ? 'var(--bg-deep)' : btnColor,
                    background: isCurrentStatus ? btnColor : 'transparent',
                    padding: '6px 12px',
                    border: `1px solid ${btnColor}`, borderRadius: 2,
                    cursor: isCurrentStatus || updating ? 'default' : 'pointer',
                    opacity: updating && !isCurrentStatus ? 0.5 : 1,
                    letterSpacing: '0.08em',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, display: 'flex' }}>
        <button style={tabStyle(!isFinancial)} onClick={() => navigate(`/fleet/drivers/${driverId}`)}>Overview</button>
        <button style={tabStyle(isFinancial)} onClick={() => navigate(`/fleet/drivers/${driverId}/financial`)}>Financial Profile</button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {!isFinancial && (
        <>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Revenue</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
            {formatZAR(totalRevenue)}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Trips</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {totalTrips}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Avg Revenue per Trip</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {formatZAR(avgRevPerTrip)}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Completed Trips</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {completedTrips}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Details */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>DETAILS</div>
          {[
            { label: 'LICENSE NUMBER', value: driver.license_number },
            { label: 'LICENSE STATE', value: driver.license_state },
            { label: 'PHONE', value: phone },
            { label: 'EMAIL', value: email },
            { label: 'ADDRESS', value: ud.address },
            { label: 'HIRE DATE', value: driver.hire_date?.slice(0, 10) },
            { label: 'EMERGENCY CONTACT', value: driver.emergency_contact || driver.emergency_phone },
            { label: 'VEHICLE', value: driver.assigned_vehicle },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', }}>{r.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: r.label === 'LICENSE NUMBER' || r.label === 'ID NUMBER' || r.label === 'VEHICLE' ? 'var(--font-mono)' : 'var(--font-sans)', maxWidth: 260, textAlign: 'right' }}>
                {r.value ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Performance */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>PERFORMANCE</div>
          {[
            { label: 'EFFICIENCY SCORE', value: driver.efficiency_score ?? '—' },
            { label: 'ON-TIME RATE', value: driver.on_time_rate ? `${driver.on_time_rate}%` : '—' },
            { label: 'AVG RATING', value: driver.avg_rating ? `★ ${driver.avg_rating}` : '—' },
            { label: 'TRIPS THIS MONTH', value: driver.trips_this_month ?? 0 },
            { label: 'TOTAL TRIPS', value: driver.total_trips ?? totalTrips },
            { label: 'TOTAL DISTANCE', value: driver.total_distance ? `${parseFloat(driver.total_distance).toLocaleString('en-ZA')} km` : totalDistance > 0 ? `${Math.round(totalDistance).toLocaleString('en-ZA')} km` : '—' },
            { label: 'LICENSE EXPIRY', value: driver.license_expiry?.slice(0, 10) || '—', alert: driver.license_expiry && new Date(driver.license_expiry) < new Date() },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', }}>{r.label}</span>
              <span style={{ fontSize: 13, color: r.alert ? 'var(--status-danger)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Loads */}
      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>RECENT LOADS ({loads.length})</div>
        {loads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No loads recorded</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Load #', 'Route', 'Distance', 'Revenue', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: 10,                     letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loads.slice(0, 10).map((load: any, idx: number) => (
                <tr
                  key={load.id}
                  style={{ cursor: 'pointer', borderBottom: idx < Math.min(loads.length, 10) - 1 ? '1px solid var(--border-row)' : 'none' }}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                    {load.load_number}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {load.pickup_city || '—'} → {load.delivery_city || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {load.distance ? `${parseFloat(load.distance).toFixed(0)} km` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>
                    {load.total_amount ? formatZAR(parseFloat(load.total_amount)) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,                       color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--status-success)' : load.status === 'IN_TRANSIT' ? 'var(--status-warning)' : 'var(--text-tertiary)',
                    }}>{load.status?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {load.created_at?.slice(0, 10) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      )}

      {/* ── FINANCIAL PROFILE TAB ── */}
      {isFinancial && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue Generated</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {formatCurrency(driver.revenue_generated ?? totalRevenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{driver.total_trips ?? totalTrips} completed trips</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Avg Revenue / Trip</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(driver.avg_revenue_per_trip ?? avgRevPerTrip)}
              </div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue / km</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>
                R {(revPerKm || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{(totalDistanceKm || 0).toFixed(0)} km total</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Experience</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>
                {driver.experience_years ?? 0} years
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Hire: {driver.hire_date?.slice(0, 10) || '—'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Performance Scores */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 20 }}>PERFORMANCE SCORES</div>
              <ScoreBar label="ON-TIME RATE" value={onTimeRate} color="var(--accent-primary)" />
              <ScoreBar label="SAFETY SCORE" value={safetyScore} color={safetyScore >= 80 ? 'var(--status-success)' : safetyScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)'} />
              <ScoreBar label="EXPERIENCE SCORE" value={experienceScore} />
              <ScoreBar label="COMPLIANCE" value={complianceScore} color={complianceScore === 100 ? 'var(--status-success)' : 'var(--status-danger)'} />
            </div>

            {/* Earnings Breakdown */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>EARNINGS BREAKDOWN</div>
              {[
                { label: 'TOTAL REVENUE', value: formatCurrency(driver.revenue_generated ?? totalRevenue) },
                { label: 'TOTAL TRIPS', value: (driver.total_trips ?? totalTrips).toString() },
                { label: 'AVG PER TRIP', value: formatCurrency(driver.avg_revenue_per_trip ?? avgRevPerTrip) },
                { label: 'BEST TRIP', value: formatCurrency(bestTripAmount) },
                { label: 'TOTAL DISTANCE', value: `${(totalDistanceKm || 0).toFixed(0)} km` },
                { label: 'VIOLATIONS', value: (driver.violation_count ?? 0).toString() },
                { label: 'ACCIDENTS', value: (driver.accident_history ?? 0).toString() },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Monthly Earnings */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>MONTHLY EARNINGS</div>
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
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>No data available</div>
                );
                return months.map(([key, val]) => {
                  const [yr, mo] = key.split('-');
                  const label = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('en-ZA', { month: 'short', year: '2-digit' });
                  const pct = (val / maxVal) * 100;
                  return (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', }}>{label}</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>R {val.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
                        <div style={{ height: 4, width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Recent Loads */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>RECENT LOADS ({loads.length})</div>
              {loads.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>No loads recorded</div>
              ) : loads.slice(0, 8).map((load: any) => (
                <div
                  key={load.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)', cursor: 'pointer' }}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{load.load_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.pickup_city || '—'} → {load.delivery_city || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                    <div style={{ fontSize: 10, color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--status-success)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{load.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
