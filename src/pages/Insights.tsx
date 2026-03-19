import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';
import { formatCurrency, formatPercent, formatCompactNumber } from '@/lib/formatters';

// ========== INTERFACES ==========

interface Signal {
  type: string;
  category: string;
  title: string;
  body: string;
  action?: string;
  action_url?: string;
  severity: string;
  created_at: string;
}

interface RouteData {
  route: string;
  trips: number;
  avg_revenue: number;
  avg_cost: number;
  margin_pct: number;
}

interface CustomerHealthData {
  customer_name: string;
  customer_id: number;
  revenue: number;
  invoice_count: number;
  avg_payment_days: number;
  dso: number;
  overdue_count: number;
  risk_tier: string;
  concentration_pct: number;
}

interface CashFlowForecast {
  next_30_days: number;
  next_60_days: number;
  next_90_days: number;
}

interface FinanceData {
  revenue_period: number;
  expenses_period: number;
  net_margin_period: number;
  net_margin_percent_period: number;
  dso: number;
  outstanding_invoices_total?: number;
  overdue_invoices_total?: number;
  fuel_cost_ratio?: number;
  cash_flow_forecast: CashFlowForecast;
  monthly_trend: { month: string; revenue: number; expenses: number; margin: number }[];
  top_customers: { customer_id: number; customer_name: string; revenue: number; invoice_count: number }[];
  previous_period?: {
    revenue: number;
    margin_percent: number;
    deltas: {
      revenue_pct: number;
      margin_pct: number;
    };
  };
}

interface ExpenseCategory {
  category: string;
  total: number;
  count: number;
}

interface VehicleInsight {
  vehicle_id: number;
  registration: string;
  revenue: number;
  trips: number;
  utilization: number;
  avg_margin: number;
}

interface DriverLeaderboard {
  driver_id: number;
  driver_name: string;
  trips: number;
  revenue: number;
  avg_rating: number;
  on_time_pct: number;
}

type TabType = 'overview' | 'customers' | 'routes' | 'assets' | 'costs';
type PeriodType = '7D' | '30D' | '90D' | '6M' | '1YR' | 'ALL';
type AssetsSubTab = 'vehicles' | 'drivers';
type SortField = string;
type SortDirection = 'asc' | 'desc';

// ========== HELPER FUNCTIONS ==========

const getRiskTierColor = (tier: string): string => {
  switch (tier.toUpperCase()) {
    case 'PRIME':
      return 'var(--status-success)';
    case 'STANDARD':
      return 'var(--accent-primary)';
    case 'ELEVATED':
    case 'WATCH':
      return 'var(--status-warning)';
    case 'HIGH':
    case 'CRITICAL':
      return 'var(--status-danger)';
    default:
      return 'var(--text-secondary)';
  }
};

const getMarginColor = (margin: number): string => {
  if (margin >= 15) return 'var(--status-success)';
  if (margin >= 10) return 'var(--status-warning)';
  return 'var(--status-danger)';
};

const getPeriodParam = (period: PeriodType): string => {
  return `period=${period}`;
};

const getPeriodLabel = (period: PeriodType): string => {
  return period;
};

const TrendIndicator = ({ value, showArrow = true }: { value: number; showArrow?: boolean }) => {
  const isPositive = value >= 0;
  const color = isPositive ? 'var(--status-success)' : 'var(--status-danger)';
  return (
    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
      {showArrow && (isPositive ? '↑ ' : '↓ ')}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

// ========== MAIN COMPONENT ==========

export default function Insights() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [period, setPeriod] = useState<PeriodType>('30D');
  const [assetsSubTab, setAssetsSubTab] = useState<AssetsSubTab>('vehicles');

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [topRoutes, setTopRoutes] = useState<RouteData[]>([]);
  const [customerHealth, setCustomerHealth] = useState<CustomerHealthData[]>([]);
  const [vehicleInsights, setVehicleInsights] = useState<VehicleInsight[]>([]);
  const [driverLeaderboard, setDriverLeaderboard] = useState<DriverLeaderboard[]>([]);
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerHealthData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  // Sorting states
  const [customerSort, setCustomerSort] = useState<{ field: SortField; direction: SortDirection }>({ field: 'revenue', direction: 'desc' });
  const [routeSort, setRouteSort] = useState<{ field: SortField; direction: SortDirection }>({ field: 'margin_pct', direction: 'desc' });

  useEffect(() => {
    document.title = 'Insights - TruckWys';
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const periodParam = getPeriodParam(period);

    try {
      const [financeRes, routesRes, customerRes, signalsRes, vehiclesRes, driversRes, expenseRes] = await Promise.all([
        fetchData(`api/v1/dashboard/finance/?compare=previous_period&${periodParam}`).catch(() => null),
        fetchData(`api/v1/dashboard/routes/?${periodParam}`).catch(() => null),
        fetchData(`api/v1/dashboard/customer-health/?${periodParam}`).catch(() => null),
        fetchData(`api/v1/dashboard/signals/?${periodParam}`).catch(() => null),
        fetchData(`api/v1/fleet/insights/?${periodParam}`).catch(() => null),
        fetchData(`api/v1/drivers/leaderboard/?${periodParam}`).catch(() => null),
        fetchData(`api/v1/expenses/report/?${periodParam}`).catch(() => null),
      ]);

      if (financeRes) setFinance(financeRes);
      const routes = routesRes?.routes || [];
      setTopRoutes(routes.slice(0, 8));
      setAllRoutes(routes);
      const customers = customerRes?.customers || [];
      setCustomerHealth(customers.slice(0, 8));
      setAllCustomers(customers);
      setSignals((signalsRes?.signals || []).filter((s: Signal) =>
        s.severity?.toLowerCase() === 'high' || s.severity?.toLowerCase() === 'critical'
      ).slice(0, 5));
      setVehicleInsights(vehiclesRes?.vehicles || []);
      setDriverLeaderboard(driversRes?.drivers || []);
      if (expenseRes?.by_category) {
        setExpenseCategories(expenseRes.by_category);
      }
    } catch (err) {
      setError('Failed to load insights data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSort = (field: SortField) => {
    const direction = customerSort.field === field && customerSort.direction === 'desc' ? 'asc' : 'desc';
    setCustomerSort({ field, direction });
  };

  const handleRouteSort = (field: SortField) => {
    const direction = routeSort.field === field && routeSort.direction === 'desc' ? 'asc' : 'desc';
    setRouteSort({ field, direction });
  };

  const getSortedCustomers = () => {
    return [...allCustomers].sort((a, b) => {
      const aVal = a[customerSort.field as keyof CustomerHealthData];
      const bVal = b[customerSort.field as keyof CustomerHealthData];
      const modifier = customerSort.direction === 'asc' ? 1 : -1;
      return aVal < bVal ? -modifier : modifier;
    });
  };

  const getSortedRoutes = () => {
    return [...allRoutes].sort((a, b) => {
      const aVal = a[routeSort.field as keyof RouteData];
      const bVal = b[routeSort.field as keyof RouteData];
      const modifier = routeSort.direction === 'asc' ? 1 : -1;
      return aVal < bVal ? -modifier : modifier;
    });
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: 'var(--status-danger)', fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  const revenue = finance?.revenue_period || 0;
  const margin = finance?.net_margin_percent_period || 0;
  const activeCustomers = customerHealth.length;
  const dso = finance?.dso || 0;
  const revenueDelta = finance?.previous_period?.deltas?.revenue_pct || 0;
  const marginDelta = finance?.previous_period?.deltas?.margin_pct || 0;
  const cashFlow = finance?.cash_flow_forecast;
  const monthlyTrend = finance?.monthly_trend || [];

  const handleExport = async () => {
    try {
      const response = await fetchData(`api/v1/insights/export/?${getPeriodParam(period)}`);
      // Create download link
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insights-export-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Export unavailable');
      console.error(err);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 6
          }}>
            INTELLIGENCE DASHBOARD
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
            Business Insights
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          style={{
            background: 'transparent',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            padding: '8px 16px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-primary)';
            e.currentTarget.style.color = 'var(--bg-deep)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
        >
          EXPORT CSV
        </button>
      </div>

      {/* Global Date Filter Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 4,
        padding: '12px 16px',
        marginBottom: 24,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        {(['7D', '30D', '90D', '6M', '1YR', 'ALL'] as PeriodType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              background: period === p ? 'var(--accent-primary)' : 'transparent',
              border: `1px solid ${period === p ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: period === p ? 'var(--bg-deep)' : 'var(--text-secondary)',
              padding: '6px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              borderRadius: 20,
              cursor: 'pointer',
              fontWeight: period === p ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (period !== p) {
                e.currentTarget.style.borderColor = 'var(--accent-dim)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (period !== p) {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 32,
        display: 'flex',
        gap: 32,
      }}>
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'customers', label: 'Customers' },
          { id: 'routes', label: 'Routes' },
          { id: 'assets', label: 'Assets' },
          { id: 'costs', label: 'Costs' },
        ] as { id: TabType; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '12px 0',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Section 1: Business Pulse - 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {/* Monthly Net Revenue */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Monthly Net Revenue
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {formatCurrency(revenue)}
                  </div>
                  <TrendIndicator value={revenueDelta} />
                </>
              )}
            </div>

            {/* Gross Margin % */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Gross Margin
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {formatPercent(margin, 1)}
                  </div>
                  <TrendIndicator value={marginDelta} />
                </>
              )}
            </div>

            {/* Active Customers */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Active Customers
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 8 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {activeCustomers}
                </div>
              )}
            </div>

            {/* DSO */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Days Sales Outstanding
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 8 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: dso > 45 ? 'var(--status-danger)' : dso > 30 ? 'var(--status-warning)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {Math.round(dso)}
                  <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>days</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Revenue & Margin Trend */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Revenue & Margin Trend (6 Months)
            </div>
            {loading ? (
              <div style={{ height: 200, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : monthlyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                No trend data available
              </div>
            ) : (
              <div>
                {/* Bar chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginBottom: 12 }}>
                  {(() => {
                    const maxRevenue = Math.max(...monthlyTrend.map(m => m.revenue), 1);
                    return monthlyTrend.map((month, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {formatCompactNumber(month.revenue)}
                        </div>
                        <div style={{
                          width: '100%',
                          maxWidth: 60,
                          height: `${(month.revenue / maxRevenue) * 120}px`,
                          background: month.margin >= 0 ? 'var(--accent-dim)' : 'var(--status-danger-bg)',
                          borderRadius: '2px 2px 0 0',
                          position: 'relative',
                        }}>
                          {/* Margin overlay */}
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${Math.min((month.margin / month.revenue) * 100, 100)}%`,
                            background: 'var(--accent-primary)',
                            borderRadius: '0 0 0 0',
                            opacity: 0.6,
                          }} />
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          {month.month.slice(5)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 3, background: 'var(--accent-dim)', display: 'inline-block', borderRadius: 1 }} />
                    Revenue
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1, opacity: 0.6 }} />
                    Margin
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Two-Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            {/* Left: Top Performing Routes */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Route Performance
              </div>

              {/* Route KPI Cards */}
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: 60, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
                  ))}
                </div>
              ) : topRoutes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Top Route
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {topRoutes[0]?.route.split(' - ')[0] || 'N/A'}
                    </div>
                    <div style={{ fontSize: 10, color: getMarginColor(topRoutes[0]?.margin_pct || 0), fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {topRoutes[0]?.margin_pct.toFixed(1)}% margin
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Total Trips
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {allRoutes.reduce((sum, r) => sum + r.trips, 0)}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Avg Margin
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {(allRoutes.reduce((sum, r) => sum + r.margin_pct, 0) / allRoutes.length || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ height: 240, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : topRoutes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No route data available
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Route
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Trips
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Revenue
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRoutes.slice(0, 8).map((route, i) => (
                      <tr key={i} style={{ borderBottom: i < topRoutes.slice(0, 8).length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                        <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {route.route}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {route.trips}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                          {formatCurrency(route.avg_revenue)}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: getMarginColor(route.margin_pct), textAlign: 'right' }}>
                          {route.margin_pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right: Customer Health */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Customer Health
              </div>

              {/* Customer KPI Cards */}
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ height: 60, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
                  ))}
                </div>
              ) : allCustomers.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Total
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {allCustomers.length}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      At-Risk
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--status-warning)', fontFamily: 'var(--font-mono)' }}>
                      {allCustomers.filter(c => c.risk_tier.toUpperCase() === 'HIGH' || c.risk_tier.toUpperCase() === 'CRITICAL' || c.risk_tier.toUpperCase() === 'ELEVATED').length}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Avg DSO
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(allCustomers.reduce((sum, c) => sum + c.dso, 0) / allCustomers.length || 0)}d
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Best
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-success)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {allCustomers.filter(c => c.risk_tier.toUpperCase() === 'PRIME')[0]?.customer_name.split(' ')[0] || 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ height: 240, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : customerHealth.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No customer data available
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Customer
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Revenue
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        DSO
                      </th>
                      <th style={{ textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerHealth.slice(0, 8).map((customer, i) => (
                      <tr key={i} style={{ borderBottom: i < customerHealth.slice(0, 8).length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                        <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {customer.customer_name}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                          {formatCurrency(customer.revenue)}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {Math.round(customer.dso)}d
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                            color: getRiskTierColor(customer.risk_tier),
                            padding: '3px 8px',
                            background: 'var(--bg-surface-hover)',
                            borderRadius: 2,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}>
                            {customer.risk_tier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Section 4: Cash Flow Forecast */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Cash Flow
            </div>

            {/* Cash Flow KPI Cards */}
            {loading || !cashFlow ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ height: 60, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Collected MTD
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(finance?.revenue_period || 0)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Outstanding
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(finance?.outstanding_invoices_total || 0)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Overdue
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--status-danger)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(finance?.overdue_invoices_total || 0)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Next 30d
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(cashFlow?.next_30_days || 0)}
                  </div>
                </div>
              </div>
            )}

            {loading || !cashFlow ? (
              <div style={{ height: 100, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : (
              <div>
                {(() => {
                  const periods = [
                    { label: 'Next 30 Days', value: cashFlow.next_30_days },
                    { label: '31–60 Days', value: cashFlow.next_60_days },
                    { label: '61–90 Days', value: cashFlow.next_90_days },
                  ];
                  const maxVal = Math.max(...periods.map(p => p.value), 1);
                  return periods.map((period, i) => (
                    <div key={i} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {period.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatCurrency(period.value)}
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(period.value / maxVal) * 100}%`,
                          background: i === 0 ? 'var(--accent-primary)' : i === 1 ? 'var(--accent-dim)' : 'var(--text-tertiary)',
                          borderRadius: 2,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Section 5: Action Items */}
          {signals.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Action Items
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {signals.map((signal, i) => {
                  const severityColor = signal.severity.toLowerCase() === 'critical' ? 'var(--status-danger)' : 'var(--status-warning)';
                  return (
                    <div
                      key={i}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: `3px solid ${severityColor}`,
                        borderRadius: 'var(--card-radius)',
                        padding: 16,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <div style={{ fontSize: 18, marginTop: 2 }}>⚠️</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {signal.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: signal.action ? 8 : 0 }}>
                          {signal.body}
                        </div>
                        {signal.action && (
                          <button style={{
                            background: 'transparent',
                            border: '1px solid var(--accent-primary)',
                            color: 'var(--accent-primary)',
                            padding: '4px 10px',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            borderRadius: 2,
                            cursor: 'pointer',
                          }}>
                            {signal.action}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Customer Performance — {getPeriodLabel(period)}
            </div>
            {loading ? (
              <div style={{ height: 400, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : allCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                No customer data available
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th onClick={() => handleCustomerSort('customer_name')} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Customer {customerSort.field === 'customer_name' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('revenue')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Revenue {customerSort.field === 'revenue' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('invoice_count')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Invoices {customerSort.field === 'invoice_count' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('avg_payment_days')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Avg Days {customerSort.field === 'avg_payment_days' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('dso')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      DSO {customerSort.field === 'dso' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('overdue_count')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Overdue {customerSort.field === 'overdue_count' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('risk_tier')} style={{ textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Risk {customerSort.field === 'risk_tier' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleCustomerSort('concentration_pct')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Conc. % {customerSort.field === 'concentration_pct' && (customerSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedCustomers().map((customer, i) => (
                    <tr key={i} style={{ borderBottom: i < allCustomers.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                      <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {customer.customer_name}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                        {formatCurrency(customer.revenue)}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {customer.invoice_count}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {Math.round(customer.avg_payment_days)}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {Math.round(customer.dso)}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: customer.overdue_count > 0 ? 'var(--status-danger)' : 'var(--text-secondary)', textAlign: 'right', fontWeight: customer.overdue_count > 0 ? 600 : 400 }}>
                        {customer.overdue_count}
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: getRiskTierColor(customer.risk_tier),
                          padding: '3px 8px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 2,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}>
                          {customer.risk_tier}
                        </span>
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {customer.concentration_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'routes' && (
        <div>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Route Performance — {getPeriodLabel(period)}
            </div>
            {loading ? (
              <div style={{ height: 400, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : allRoutes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                No route data available
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th onClick={() => handleRouteSort('route')} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Route {routeSort.field === 'route' && (routeSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleRouteSort('trips')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Trips {routeSort.field === 'trips' && (routeSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleRouteSort('avg_revenue')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Avg Revenue {routeSort.field === 'avg_revenue' && (routeSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleRouteSort('avg_cost')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Avg Cost {routeSort.field === 'avg_cost' && (routeSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleRouteSort('margin_pct')} style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}>
                      Margin % {routeSort.field === 'margin_pct' && (routeSort.direction === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedRoutes().map((route, i) => (
                    <tr key={i} style={{ borderBottom: i < allRoutes.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                      <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {route.route}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {route.trips}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                        {formatCurrency(route.avg_revenue)}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {formatCurrency(route.avg_cost)}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: getMarginColor(route.margin_pct), textAlign: 'right' }}>
                        {route.margin_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <div>
          {/* Sub-tab toggle */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => setAssetsSubTab('vehicles')}
              style={{
                background: assetsSubTab === 'vehicles' ? 'var(--accent-primary)' : 'transparent',
                border: `1px solid ${assetsSubTab === 'vehicles' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                color: assetsSubTab === 'vehicles' ? 'var(--bg-deep)' : 'var(--text-secondary)',
                padding: '8px 16px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: assetsSubTab === 'vehicles' ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Vehicles
            </button>
            <button
              onClick={() => setAssetsSubTab('drivers')}
              style={{
                background: assetsSubTab === 'drivers' ? 'var(--accent-primary)' : 'transparent',
                border: `1px solid ${assetsSubTab === 'drivers' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                color: assetsSubTab === 'drivers' ? 'var(--bg-deep)' : 'var(--text-secondary)',
                padding: '8px 16px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: assetsSubTab === 'drivers' ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Drivers
            </button>
          </div>

          {assetsSubTab === 'vehicles' && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Vehicle Performance
              </div>
              {loading ? (
                <div style={{ height: 400, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : vehicleInsights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No vehicle data available
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Registration
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Revenue
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Trips
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Utilization
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Avg Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleInsights.map((vehicle, i) => (
                      <tr key={i} style={{ borderBottom: i < vehicleInsights.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                        <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {vehicle.registration}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                          {formatCurrency(vehicle.revenue)}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {vehicle.trips}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {vehicle.utilization.toFixed(1)}%
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: getMarginColor(vehicle.avg_margin), textAlign: 'right' }}>
                          {vehicle.avg_margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {assetsSubTab === 'drivers' && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Driver Leaderboard
              </div>
              {loading ? (
                <div style={{ height: 400, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : driverLeaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No driver data available
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Driver
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Trips
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Revenue
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        Rating
                      </th>
                      <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                        On-Time %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverLeaderboard.map((driver, i) => (
                      <tr key={i} style={{ borderBottom: i < driverLeaderboard.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                        <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {driver.driver_name}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {driver.trips}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                          {formatCurrency(driver.revenue)}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {driver.avg_rating.toFixed(1)} ★
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: driver.on_time_pct >= 90 ? 'var(--status-success)' : driver.on_time_pct >= 75 ? 'var(--status-warning)' : 'var(--status-danger)', textAlign: 'right', fontWeight: 600 }}>
                          {driver.on_time_pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'costs' && (
        <div>
          {/* Cost Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Total Revenue
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {formatCurrency(finance?.revenue_period || 0)}
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Total Expenses
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--status-danger)', letterSpacing: '-0.02em' }}>
                  {formatCurrency(finance?.expenses_period || 0)}
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Net Margin
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--status-success)', letterSpacing: '-0.02em' }}>
                  {formatCurrency(finance?.net_margin_period || 0)}
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Margin %
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: getMarginColor(finance?.net_margin_percent_period || 0), letterSpacing: '-0.02em' }}>
                  {formatPercent(finance?.net_margin_percent_period || 0, 1)}
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
                Fuel Cost Ratio
              </div>
              {loading ? (
                <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {formatPercent(finance?.fuel_cost_ratio || 0, 1)}
                </div>
              )}
            </div>
          </div>

          {/* Expense Breakdown by Category */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Expense Breakdown by Category
            </div>
            {loading ? (
              <div style={{ height: 200, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : expenseCategories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                No expense data available
              </div>
            ) : (
              <div>
                {(() => {
                  const maxTotal = Math.max(...expenseCategories.map(c => c.total), 1);
                  const categoryColors: { [key: string]: string } = {
                    'FUEL': 'var(--accent-primary)',
                    'MAINTENANCE': 'var(--status-warning)',
                    'DRIVER_COST': 'var(--status-success)',
                    'TOLLS': 'var(--status-danger)',
                    'INSURANCE': 'var(--text-secondary)',
                    'OVERHEAD': 'var(--text-secondary)',
                    'OTHER': 'var(--text-secondary)',
                  };
                  return expenseCategories.map((cat, i) => (
                    <div key={i} style={{ marginBottom: i < expenseCategories.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                          {cat.category.replace('_', ' ')} ({cat.count})
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                      <div style={{ height: 10, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(cat.total / maxTotal) * 100}%`,
                          background: categoryColors[cat.category] || 'var(--text-secondary)',
                          borderRadius: 2,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Monthly Cost Trend */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Revenue vs Expenses Trend
            </div>
            {loading ? (
              <div style={{ height: 200, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
            ) : monthlyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
                No trend data available
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginBottom: 12 }}>
                  {(() => {
                    const maxVal = Math.max(...monthlyTrend.map(m => Math.max(m.revenue, m.expenses)), 1);
                    return monthlyTrend.map((month, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {formatCompactNumber(month.revenue)}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, width: '100%', maxWidth: 60 }}>
                          <div style={{
                            flex: 1,
                            height: `${(month.revenue / maxVal) * 120}px`,
                            background: 'var(--accent-primary)',
                            borderRadius: '2px 2px 0 0',
                          }} />
                          <div style={{
                            flex: 1,
                            height: `${(month.expenses / maxVal) * 120}px`,
                            background: 'var(--status-danger)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.7,
                          }} />
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          {month.month.slice(5)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }} />
                    Revenue
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 3, background: 'var(--status-danger)', display: 'inline-block', borderRadius: 1, opacity: 0.7 }} />
                    Expenses
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Outstanding Invoices
              </div>
              {loading ? (
                <div style={{ height: 100, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {formatCurrency(finance?.outstanding_invoices_total || 0)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Awaiting payment
                  </div>
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--card-radius)',
              padding: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Overdue Invoices
              </div>
              {loading ? (
                <div style={{ height: 100, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
              ) : (
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--status-danger)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {formatCurrency(finance?.overdue_invoices_total || 0)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Past due date
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
