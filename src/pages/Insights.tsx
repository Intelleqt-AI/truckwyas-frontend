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

interface CashFlowPeriod {
  label: string;
  confirmed: number;
  expected: number;
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

interface FinanceData {
  revenue_period: number;
  expenses_period: number;
  net_margin_period: number;
  net_margin_percent_period: number;
  dso: number;
  active_customers?: number;
  total_loads?: number;
  previous_period?: {
    revenue: number;
    margin_percent: number;
    active_customers?: number;
    total_loads?: number;
    deltas: {
      revenue_pct: number;
      margin_pct: number;
      customers_pct?: number;
      loads_pct?: number;
    };
  };
}

interface InsightsData {
  finance: FinanceData;
  top_routes: RouteData[];
  customer_health: CustomerHealthData[];
  cash_flow_forecast: CashFlowPeriod[];
}

// ========== HELPER FUNCTIONS ==========

const getRiskTierColor = (tier: string): string => {
  switch (tier.toUpperCase()) {
    case 'PRIME':
      return 'var(--status-success)';
    case 'STANDARD':
      return 'var(--accent-primary)';
    case 'WATCH':
      return 'var(--status-warning)';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);

  useEffect(() => {
    document.title = 'Insights - TruckWys';
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [insightsRes, signalsRes] = await Promise.all([
        fetchData('/api/v1/dashboard/insights/'),
        fetchData('/api/v1/dashboard/signals/'),
      ]);
      setInsightsData(insightsRes);
      setSignals((signalsRes?.signals || []).filter((s: Signal) =>
        s.severity.toLowerCase() === 'high' || s.severity.toLowerCase() === 'critical'
      ).slice(0, 5));
    } catch (err) {
      setError('Failed to load insights data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: 'var(--status-danger)', fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  const finance = insightsData?.finance;
  const revenue = finance?.revenue_period || 0;
  const margin = finance?.net_margin_percent_period || 0;
  const activeCustomers = finance?.active_customers || 0;
  const totalLoads = finance?.total_loads || 0;
  const revenueDelta = finance?.previous_period?.deltas?.revenue_pct || 0;
  const marginDelta = finance?.previous_period?.deltas?.margin_pct || 0;
  const customersDelta = finance?.previous_period?.deltas?.customers_pct || 0;
  const loadsDelta = finance?.previous_period?.deltas?.loads_pct || 0;

  const topRoutes = insightsData?.top_routes || [];
  const customerHealth = insightsData?.customer_health || [];
  const cashFlow = insightsData?.cash_flow_forecast || [];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
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
            <>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                {activeCustomers}
              </div>
              <TrendIndicator value={customersDelta} />
            </>
          )}
        </div>

        {/* Total Loads */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--card-radius)',
          padding: 24,
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>
            Total Loads
          </div>
          {loading ? (
            <div style={{ height: 32, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 8 }} />
          ) : (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                {totalLoads}
              </div>
              <TrendIndicator value={loadsDelta} />
            </>
          )}
        </div>
      </div>

      {/* Section 2: Revenue & Margin Trend (placeholder for now - can add charting later) */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        padding: 24,
        marginBottom: 32,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Revenue & Margin Trend
        </div>
        {loading ? (
          <div style={{ height: 200, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Trend visualization coming soon
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
            Top Performing Routes
          </div>
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
          Cash Flow Forecast (30/60/90 Days)
        </div>
        {loading ? (
          <div style={{ height: 160, background: 'var(--bg-surface-hover)', borderRadius: 4 }} />
        ) : cashFlow.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No cash flow data available
          </div>
        ) : (
          <div>
            {cashFlow.map((period, i) => {
              const maxVal = Math.max(...cashFlow.map(c => c.expected));
              return (
                <div key={i} style={{ marginBottom: i < cashFlow.length - 1 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {period.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {formatCompactNumber(period.expected)}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${(period.expected / maxVal) * 100}%`,
                        background: 'var(--accent-dim)',
                        borderRadius: 2,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${period.confirmed ? (period.confirmed / maxVal) * 100 : 0}%`,
                        background: 'var(--accent-primary)',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }} />
                Confirmed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 3, background: 'var(--accent-dim)', display: 'inline-block', borderRadius: 1 }} />
                Expected
              </span>
            </div>
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
  );
}
