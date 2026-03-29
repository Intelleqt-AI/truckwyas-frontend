import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

// ========== TYPES ==========

interface KPIData {
  revenue_mtd: number;
  net_margin_pct: number;
  outstanding_invoices: number;
  fleet_utilization_pct: number;
  dso: number;
  advances: number;
}

interface Recommendation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  action?: string;
}

interface InsightsData {
  recommendations: Recommendation[];
}

interface FinanceData {
  revenue: number;
  revenue_mtd: number;
  revenue_ytd: number;
  margin: number;
  net_margin_pct: number;
  weekly_trend?: { week: string; revenue: number; expenses: number }[];
  monthly_trend?: { month: string; revenue: number; expenses: number }[];
  top_customers?: { customer_name: string; revenue: number; pct_of_total: number }[];
  fuel_cost_ratio?: number;
}

interface CashFlowData {
  forecast: { week: string; expected_in: number; expected_out: number; net: number; running_balance: number }[];
}

interface Load {
  id: number;
  pickup_city?: string;
  delivery_city?: string;
  status: string;
  amount: number;
  weight?: number;
  distance_km?: number;
  vehicle?: { registration: string };
  driver?: { full_name: string };
}

interface Driver {
  id: number;
  full_name: string;
  status: string;
  revenue_generated: number;
  trip_count?: number;
  experience_years?: number;
}

interface Vehicle {
  id: number;
  registration: string;
  make?: string;
  model?: string;
  status: string;
  revenue_generated: number;
  health_score?: number;
  trip_count?: number;
  utilization_pct?: number;
}

interface Invoice {
  id: number;
  status: string;
  total_amount: number;
  due_date?: string;
  dso?: number;
  created_at: string;
}

type TabType = 'command' | 'revenue' | 'lanes' | 'fleet' | 'quotes' | 'cashflow';
type PeriodType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_6M' | 'LAST_12M' | 'CUSTOM';

const TABS = [
  { id: 'command' as TabType, label: 'Command Centre' },
  { id: 'revenue' as TabType, label: 'Revenue & Margins' },
  { id: 'lanes' as TabType, label: 'Lanes & Routes' },
  { id: 'fleet' as TabType, label: 'Fleet & Drivers' },
  { id: 'quotes' as TabType, label: 'Quotes & Pipeline' },
  { id: 'cashflow' as TabType, label: 'Cash Flow' },
];

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'LAST_MONTH', label: 'Last Month' },
  { id: 'LAST_3M', label: 'Last 3M' },
  { id: 'LAST_6M', label: 'Last 6M' },
  { id: 'LAST_12M', label: 'Last 12M' },
  { id: 'CUSTOM', label: 'Custom' },
];

export default function Insights() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('command');
  const [period, setPeriod] = useState<PeriodType>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fleetSubTab, setFleetSubTab] = useState<'vehicles' | 'drivers'>('vehicles');

  // Data states
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [cashflowData, setCashflowData] = useState<CashFlowData | null>(null);
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Build period params
  const getPeriodParams = (): string => {
    if (period === 'CUSTOM' && customFrom && customTo) {
      return `date_from=${customFrom}&date_to=${customTo}`;
    }
    const now = new Date();
    let from = '';
    let to = new Date().toISOString().slice(0, 10);

    switch (period) {
      case 'THIS_MONTH':
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        break;
      case 'LAST_MONTH':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = lastMonth.toISOString().slice(0, 10);
        to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
        break;
      case 'LAST_3M':
        from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
        break;
      case 'LAST_6M':
        from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10);
        break;
      case 'LAST_12M':
        from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
        break;
    }
    return `date_from=${from}&date_to=${to}`;
  };

  // Load data for current tab
  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true);
      setError(null);
      const params = getPeriodParams();

      try {
        switch (tab) {
          case 'command':
            const [kpi, insights, loadsResp] = await Promise.all([
              fetchData('api/v1/dashboard/kpi/').catch(() => null),
              fetchData('api/v1/dashboard/insights/').catch(() => ({ recommendations: [] })),
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setKpiData(kpi);
            setInsightsData(insights);
            setLoads(loadsResp?.results || []);
            break;

          case 'revenue':
            const finance = await fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null);
            setFinanceData(finance);
            break;

          case 'lanes':
            const lanesLoads = await fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] }));
            setLoads(lanesLoads?.results || []);
            break;

          case 'fleet':
            const [veh, drv] = await Promise.all([
              fetchData('api/v1/vehicles/?page_size=50').catch(() => ({ results: [] })),
              fetchData('api/v1/drivers/?page_size=50').catch(() => ({ results: [] })),
            ]);
            setVehicles(veh?.results || []);
            setDrivers(drv?.results || []);
            break;

          case 'quotes':
            // Quotes endpoint - if not available, will show message
            break;

          case 'cashflow':
            const [cf, inv] = await Promise.all([
              fetchData('api/v1/dashboard/cashflow/').catch(() => ({ forecast: [] })),
              fetchData('api/v1/invoices/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setCashflowData(cf);
            setInvoices(inv?.results || []);
            break;
        }
      } catch (err) {
        console.error('Failed to load insights data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadTabData();
  }, [tab, period, customFrom, customTo]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'var(--status-danger)';
      case 'MEDIUM': return 'var(--status-warning)';
      case 'LOW': return 'var(--status-success)';
      default: return 'var(--text-secondary)';
    }
  };

  const LoadingSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
          <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '70%' }} />
        </div>
      ))}
    </div>
  );

  const ErrorState = () => (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: 'var(--status-danger)', marginBottom: 16, fontSize: 14 }}>Failed to load data</div>
      <button className="btn-action" onClick={() => window.location.reload()}>RETRY</button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      {message}
    </div>
  );

  // Calculate route aggregations from loads
  const getRouteAnalytics = () => {
    const routeMap = new Map<string, { trips: number; totalRevenue: number; totalWeight: number; totalDistance: number }>();

    loads.forEach(load => {
      const route = `${load.pickup_city || 'Unknown'} → ${load.delivery_city || 'Unknown'}`;
      const existing = routeMap.get(route) || { trips: 0, totalRevenue: 0, totalWeight: 0, totalDistance: 0 };
      routeMap.set(route, {
        trips: existing.trips + 1,
        totalRevenue: existing.totalRevenue + (load.amount || 0),
        totalWeight: existing.totalWeight + (load.weight || 0),
        totalDistance: existing.totalDistance + (load.distance_km || 0),
      });
    });

    return Array.from(routeMap.entries())
      .map(([route, data]) => ({
        route,
        trips: data.trips,
        totalRevenue: data.totalRevenue,
        avgRevenue: data.trips > 0 ? data.totalRevenue / data.trips : 0,
        avgWeight: data.trips > 0 ? data.totalWeight / data.trips : 0,
        revenuePerKm: data.totalDistance > 0 ? data.totalRevenue / data.totalDistance : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  };

  // Calculate invoice aging buckets
  const getInvoiceAging = () => {
    const buckets = {
      current: { count: 0, amount: 0 },
      days31_60: { count: 0, amount: 0 },
      days61_90: { count: 0, amount: 0 },
      days90plus: { count: 0, amount: 0 },
    };

    invoices.forEach(inv => {
      const dso = inv.dso || 0;
      const amount = inv.total_amount || 0;

      if (dso <= 30) {
        buckets.current.count++;
        buckets.current.amount += amount;
      } else if (dso <= 60) {
        buckets.days31_60.count++;
        buckets.days31_60.amount += amount;
      } else if (dso <= 90) {
        buckets.days61_90.count++;
        buckets.days61_90.amount += amount;
      } else {
        buckets.days90plus.count++;
        buckets.days90plus.amount += amount;
      }
    });

    return buckets;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Insights</div>
          </div>
        </div>
      </div>

      {/* Period filters */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        {PERIOD_OPTIONS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              background: period === p.id ? 'var(--accent-primary)' : 'transparent',
              border: `1px solid ${period === p.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: period === p.id ? 'var(--bg-deep)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '6px 12px',
              cursor: 'pointer',
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
        {period === 'CUSTOM' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                borderRadius: 2,
              }}
            />
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                borderRadius: 2,
              }}
            />
          </>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.05em',
              fontWeight: tab === t.id ? 600 : 400,
              textTransform: 'uppercase',
              padding: '12px 0',
              marginRight: 24,
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? <LoadingSkeleton /> : error ? <ErrorState /> : (
        <>
          {/* TAB 1: COMMAND CENTRE */}
          {tab === 'command' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                {[
                  { label: 'Revenue MTD', value: formatCurrency(kpiData?.revenue_mtd || 0), color: 'var(--accent-primary)' },
                  { label: 'Net Margin %', value: `${(kpiData?.net_margin_pct || 0).toFixed(1)}%`, color: 'var(--status-success)' },
                  { label: 'DSO', value: `${Math.round(kpiData?.dso || 0)}d`, color: 'var(--text-primary)' },
                  { label: 'Fleet Utilisation', value: `${(kpiData?.fleet_utilization_pct || 0).toFixed(1)}%`, color: 'var(--status-success)' },
                  { label: 'Outstanding Invoices', value: formatCurrency(kpiData?.outstanding_invoices || 0), color: 'var(--status-warning)' },
                  { label: 'Advances This Month', value: formatCurrency(kpiData?.advances || 0), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* AI Signals Section */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header"><span className="card-title">AI Signals</span></div>
                {insightsData?.recommendations && insightsData.recommendations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    {insightsData.recommendations.map((signal, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        gap: 12,
                        padding: 12,
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2,
                        borderLeft: `3px solid ${getSeverityColor(signal.severity)}`
                      }}>
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: 2,
                          background: getSeverityColor(signal.severity),
                          color: 'white',
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          height: 'fit-content',
                        }}>
                          {signal.severity}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                            {signal.type.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{signal.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 16, color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                    All clear — no alerts
                  </div>
                )}
              </div>

              {/* Active Intelligence Feed */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header"><span className="card-title">Active Intelligence Feed</span></div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {loads.filter(l => l.status === 'in_transit' || l.status === 'assigned').slice(0, 5).map(load => (
                    <div key={load.id} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      → Truck <span style={{ color: 'var(--accent-primary)' }}>{load.vehicle?.registration || 'N/A'}</span> on{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{load.pickup_city || 'Unknown'}</span> →{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{load.delivery_city || 'Unknown'}</span> —{' '}
                      <span style={{ color: 'var(--status-success)' }}>{formatCurrency(load.amount)}</span> in transit
                    </div>
                  ))}
                  {(!loads || loads.filter(l => l.status === 'in_transit' || l.status === 'assigned').length === 0) && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No active loads</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REVENUE & MARGINS */}
          {tab === 'revenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Revenue', value: formatCurrency(financeData?.revenue || 0), color: 'var(--accent-primary)' },
                  { label: 'Revenue MTD', value: formatCurrency(financeData?.revenue_mtd || 0), color: 'var(--accent-primary)' },
                  { label: 'Net Margin %', value: `${(financeData?.net_margin_pct || 0).toFixed(1)}%`, color: 'var(--status-success)' },
                  { label: 'Revenue YTD', value: formatCurrency(financeData?.revenue_ytd || 0), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Revenue vs Expenses Chart */}
              {financeData?.monthly_trend && financeData.monthly_trend.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header">
                    <span className="card-title">Revenue vs Expenses (Last 6 Months)</span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Revenue
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: 'var(--status-danger)', display: 'inline-block', borderRadius: 1 }}/>Expenses
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const trend = financeData.monthly_trend.slice(-6);
                    const maxHeight = 120;
                    const maxValue = Math.max(...trend.map(m => Math.max(m.revenue, m.expenses)));

                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 16, height: maxHeight }}>
                        {trend.map((m, idx) => {
                          const revHeight = (m.revenue / maxValue) * maxHeight;
                          const expHeight = (m.expenses / maxValue) * maxHeight;
                          return (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: '100%', display: 'flex', gap: 4, alignItems: 'flex-end', height: maxHeight }}>
                                <div style={{ flex: 1, height: revHeight, background: 'var(--accent-primary)', borderRadius: '2px 2px 0 0' }} />
                                <div style={{ flex: 1, height: expHeight, background: 'var(--status-danger)', borderRadius: '2px 2px 0 0', opacity: 0.7 }} />
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                {m.month?.slice(5) || ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Top Customers Table */}
              {financeData?.top_customers && financeData.top_customers.length > 0 && (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Top Customers</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">% of Total</th>
                        <th className="text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeData.top_customers.map((c, idx) => (
                        <tr key={idx}>
                          <td>{c.customer_name}</td>
                          <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatCurrency(c.revenue)}
                          </td>
                          <td className="mono text-right">{(c.pct_of_total || 0).toFixed(1)}%</td>
                          <td className="text-right">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Margin Analysis */}
              {financeData?.fuel_cost_ratio !== undefined && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><span className="card-title">Margin Analysis</span></div>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Fuel Cost Ratio</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {(financeData.fuel_cost_ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${financeData.fuel_cost_ratio * 100}%`,
                        background: 'var(--status-warning)',
                        borderRadius: 2
                      }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LANES & ROUTES */}
          {tab === 'lanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(() => {
                const routes = getRouteAnalytics();
                return (
                  <>
                    {routes.length > 0 ? (
                      <div className="card table-card">
                        <div className="card-header" style={{ marginBottom: 16 }}>
                          <span className="card-title">Top 10 Routes by Revenue</span>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Route</th>
                              <th className="text-right">Trips</th>
                              <th className="text-right">Revenue</th>
                              <th className="text-right">Avg/Trip</th>
                              <th className="text-right">Rev/km</th>
                            </tr>
                          </thead>
                          <tbody>
                            {routes.map((r, idx) => (
                              <tr key={idx}>
                                <td>{r.route}</td>
                                <td className="mono text-right">{r.trips}</td>
                                <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                  {formatCurrency(r.totalRevenue)}
                                </td>
                                <td className="mono text-right">{formatCurrency(r.avgRevenue)}</td>
                                <td className="mono text-right">
                                  {r.revenuePerKm > 0 ? formatCurrency(r.revenuePerKm) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState message="No route data available. Routes will appear once loads are completed." />
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB 4: FLEET & DRIVERS */}
          {tab === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'vehicles' as const, label: 'Vehicles' },
                  { id: 'drivers' as const, label: 'Drivers' },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setFleetSubTab(st.id)}
                    style={{
                      background: fleetSubTab === st.id ? 'var(--accent-primary)' : 'transparent',
                      border: `1px solid ${fleetSubTab === st.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      color: fleetSubTab === st.id ? 'black' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      borderRadius: 2,
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {fleetSubTab === 'vehicles' ? (
                <>
                  {vehicles.length > 0 ? (
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Vehicles by Revenue</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Vehicle</th>
                            <th>Status</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">Health Score</th>
                            <th className="text-right">Trips</th>
                            <th className="text-right">Utilisation %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...vehicles].sort((a, b) => (b.revenue_generated || 0) - (a.revenue_generated || 0)).map((v) => (
                            <tr
                              key={v.id}
                              onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{v.registration}</td>
                              <td>
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '2px 6px',
                                  borderRadius: 2,
                                  background: v.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--bg-surface-hover)',
                                  color: v.status === 'ACTIVE' ? 'white' : 'var(--text-tertiary)',
                                }}>
                                  {v.status}
                                </span>
                              </td>
                              <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {formatCurrency(v.revenue_generated || 0)}
                              </td>
                              <td className="text-right">
                                {v.health_score !== undefined && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 60, height: 6, background: 'var(--bg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${v.health_score}%`,
                                        height: '100%',
                                        background: v.health_score > 70 ? 'var(--status-success)' : v.health_score > 40 ? 'var(--status-warning)' : 'var(--status-danger)'
                                      }} />
                                    </div>
                                    <span className="mono" style={{ fontSize: 11 }}>{v.health_score}%</span>
                                  </div>
                                )}
                              </td>
                              <td className="mono text-right">{v.trip_count || 0}</td>
                              <td className="mono text-right">{v.utilization_pct !== undefined ? `${v.utilization_pct.toFixed(1)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState message="No vehicles available" />
                  )}
                </>
              ) : (
                <>
                  {drivers.length > 0 ? (
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Drivers by Revenue</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Driver</th>
                            <th>Status</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">Avg/Trip</th>
                            <th className="text-right">Trips</th>
                            <th className="text-right">Experience</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...drivers].sort((a, b) => (b.revenue_generated || 0) - (a.revenue_generated || 0)).map((d) => (
                            <tr
                              key={d.id}
                              onClick={() => navigate(`/fleet/drivers/${d.id}/financial`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{d.full_name}</td>
                              <td>
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '2px 6px',
                                  borderRadius: 2,
                                  background: d.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--bg-surface-hover)',
                                  color: d.status === 'ACTIVE' ? 'white' : 'var(--text-tertiary)',
                                }}>
                                  {d.status}
                                </span>
                              </td>
                              <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {formatCurrency(d.revenue_generated || 0)}
                              </td>
                              <td className="mono text-right">
                                {d.trip_count ? formatCurrency((d.revenue_generated || 0) / d.trip_count) : '—'}
                              </td>
                              <td className="mono text-right">{d.trip_count || 0}</td>
                              <td className="mono text-right">{d.experience_years ? `${d.experience_years}y` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState message="No drivers available" />
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 5: QUOTES & PIPELINE */}
          {tab === 'quotes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <EmptyState message="Connect your quoting pipeline — quote analytics will appear once integrated." />
            </div>
          )}

          {/* TAB 6: CASH FLOW */}
          {tab === 'cashflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Weekly Cash Flow Forecast */}
              {cashflowData?.forecast && cashflowData.forecast.length > 0 && (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Weekly Cash Flow Forecast (Next 4 Weeks)</span>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Net: <span style={{
                        color: cashflowData.forecast.reduce((sum, w) => sum + w.net, 0) > 0 ? 'var(--status-success)' : 'var(--status-danger)',
                        fontWeight: 600
                      }}>
                        {formatCurrency(cashflowData.forecast.reduce((sum, w) => sum + w.net, 0))}
                      </span>
                    </div>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th className="text-right">Expected In</th>
                        <th className="text-right">Expected Out</th>
                        <th className="text-right">Net</th>
                        <th className="text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflowData.forecast.slice(0, 4).map((w, idx) => (
                        <tr key={idx}>
                          <td className="mono">{w.week}</td>
                          <td className="mono text-right" style={{ color: 'var(--status-success)' }}>
                            {formatCurrency(w.expected_in)}
                          </td>
                          <td className="mono text-right" style={{ color: 'var(--status-danger)' }}>
                            {formatCurrency(w.expected_out)}
                          </td>
                          <td className="mono text-right" style={{
                            color: w.net > 0 ? 'var(--status-success)' : 'var(--status-danger)',
                            fontWeight: 600
                          }}>
                            {formatCurrency(w.net)}
                          </td>
                          <td className="mono text-right" style={{ fontWeight: 600 }}>
                            {formatCurrency(w.running_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Invoice Aging */}
              {(() => {
                const aging = getInvoiceAging();
                const totalAmount = aging.current.amount + aging.days31_60.amount + aging.days61_90.amount + aging.days90plus.amount;

                return totalAmount > 0 ? (
                  <div className="card" style={{ padding: 20 }}>
                    <div className="card-header"><span className="card-title">Invoice Aging</span></div>
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'Current (0-30 days)', data: aging.current, color: 'var(--status-success)' },
                        { label: 'Overdue 31-60', data: aging.days31_60, color: 'var(--status-warning)' },
                        { label: 'Overdue 61-90', data: aging.days61_90, color: 'var(--status-danger)' },
                        { label: '90+ days', data: aging.days90plus, color: 'var(--status-danger)' },
                      ].map(bucket => {
                        const pct = totalAmount > 0 ? (bucket.data.amount / totalAmount) * 100 : 0;
                        return (
                          <div key={bucket.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div>
                                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{bucket.label}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                                  ({bucket.data.count} {bucket.data.count === 1 ? 'invoice' : 'invoices'})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{pct.toFixed(1)}%</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: bucket.color, fontFamily: 'var(--font-mono)' }}>
                                  {formatCurrency(bucket.data.amount)}
                                </span>
                              </div>
                            </div>
                            <div style={{ height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: bucket.color, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
