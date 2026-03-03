import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';
import { formatCurrency, formatPercent, formatDate, formatCompactNumber } from '@/lib/formatters';

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
  previous_period?: {
    revenue: number;
    margin_percent: number;
    deltas: {
      revenue_pct: number;
      margin_pct: number;
    };
  };
}

// ========== HELPER FUNCTIONS ==========

const getSignalColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'high':
    case 'critical':
      return 'var(--status-danger)';
    case 'medium':
    case 'warning':
      return 'var(--status-warning)';
    case 'low':
    case 'info':
      return 'var(--accent-primary)';
    default:
      return 'var(--text-secondary)';
  }
};

const getRiskTierColor = (tier: string): string => {
  switch (tier.toUpperCase()) {
    case 'PRIME':
      return 'var(--accent-primary)';
    case 'STANDARD':
      return 'var(--status-success)';
    case 'ELEVATED':
      return 'var(--status-warning)';
    case 'HIGH':
      return 'var(--status-danger)';
    default:
      return 'var(--text-secondary)';
  }
};

const presets = ['7D', '30D', '90D', 'YTD', 'ALL'] as const;

const getDateRangeForPreset = (preset: string): { from: string; to: string } | null => {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  let from: string;

  switch (preset) {
    case '7D':
      from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '30D':
      from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '90D':
      from = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'YTD':
      from = `${today.getFullYear()}-01-01`;
      break;
    case 'ALL':
      from = '2020-01-01'; // Far enough back to capture all data
      break;
    default:
      return null;
  }

  return { from, to };
};

// ========== MAIN COMPONENT ==========

export default function Insights() {
  // State
  const [datePreset, setDatePreset] = useState('30D');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowPeriod[]>([]);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [customerHealth, setCustomerHealth] = useState<CustomerHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Calculate active date range
  const getActiveDateRange = (): { from: string; to: string } => {
    if (datePreset === 'CUSTOM') {
      return { from: customFrom, to: customTo };
    }
    return getDateRangeForPreset(datePreset) || { from: '', to: '' };
  };

  // Load all data
  const loadData = async () => {
    const range = getActiveDateRange();
    if (!range.from || !range.to) return;

    try {
      const [signalsRes, financeRes, cashflowRes, routesRes, customerHealthRes] = await Promise.all([
        fetchData(`api/v1/dashboard/signals/?from=${range.from}&to=${range.to}`).catch(() => ({ signals: [] })),
        fetchData(`api/v1/dashboard/finance/?from=${range.from}&to=${range.to}&compare=previous_period`).catch(() => null),
        fetchData(`api/v1/dashboard/cashflow/?from=${range.from}&to=${range.to}`).catch(() => ({ forecast: [] })),
        fetchData(`api/v1/dashboard/routes/?from=${range.from}&to=${range.to}`).catch(() => ({ routes: [] })),
        fetchData(`api/v1/dashboard/customer-health/?from=${range.from}&to=${range.to}`).catch(() => ({ customers: [] })),
      ]);

      setSignals(signalsRes?.signals || []);
      setFinanceData(financeRes);
      setCashFlowData(cashflowRes?.forecast || []);
      setRouteData(routesRes?.routes || []);
      setCustomerHealth(customerHealthRes?.customers || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load insights data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    document.title = 'Insights - TruckWys';
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [datePreset, customFrom, customTo]);

  // Calculate derived data
  const filteredSignals = signals.filter(
    (s) => selectedCategory === 'All' || s.category === selectedCategory
  );

  const cashFlowSummary = {
    confirmed: cashFlowData.reduce((sum, c) => sum + c.confirmed, 0),
    expected: cashFlowData.reduce((sum, c) => sum + c.expected, 0),
  };

  // KPIs from finance data with previous period comparison
  const revenue = financeData?.revenue_period || 0;
  const margin = financeData?.net_margin_percent_period || 0;
  const dso = financeData?.dso || 0;
  const revenueDelta = financeData?.previous_period?.deltas?.revenue_pct || 0;
  const marginDelta = financeData?.previous_period?.deltas?.margin_pct || 0;

  // Calculate cash runway (simple estimate: cash available / monthly burn rate)
  const estimatedMonthlyCosts = (financeData?.expenses_period || 0) / ((financeData?.expenses_period || 1) > 0 ? 1 : 30);
  const cashRunway = cashFlowSummary.confirmed > 0 && estimatedMonthlyCosts > 0
    ? Math.floor(cashFlowSummary.confirmed / estimatedMonthlyCosts)
    : 0;

  // Fleet utilization (placeholder - would need actual fleet data)
  const fleetUtilization = 85; // %

  // Fast Pay Draw Rate (placeholder - would need advances data)
  const fastPayDrawRate = 12; // %

  // CSV Export handler
  const handleExport = () => {
    const range = getActiveDateRange();
    window.location.href = `/api/v1/reports/export/?type=finance&format=csv&from=${range.from}&to=${range.to}`;
  };

  // ========== RENDER ==========

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4
          }}>
            AI INTELLIGENCE
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
            Insights & Analytics
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Date range selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                style={{
                  background: datePreset === p ? 'var(--accent-primary)' : 'transparent',
                  border: `1px solid ${datePreset === p ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  color: datePreset === p ? 'white' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              padding: '4px 12px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              borderRadius: 2,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            ↻ REFRESH
          </button>

          <button
            onClick={handleExport}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              padding: '5px 12px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              borderRadius: 2,
              cursor: 'pointer',
            }}
          >
            EXPORT CSV
          </button>

          {lastUpdated && (
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              marginLeft: 8
            }}>
              Updated: {lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Executive KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Revenue */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Revenue
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {formatCurrency(revenue)}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: revenueDelta >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
          }}>
            {revenueDelta >= 0 ? '↑' : '↓'} {Math.abs(revenueDelta).toFixed(1)}%
          </div>
        </div>

        {/* Net Margin % */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Net Margin %
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {formatPercent(margin, 1)}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: marginDelta >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
          }}>
            {marginDelta >= 0 ? '↑' : '↓'} {Math.abs(marginDelta).toFixed(1)}%
          </div>
        </div>

        {/* DSO */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            DSO
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: dso <= 30 ? 'var(--status-success)' : 'var(--status-warning)', marginBottom: 4 }}>
            {Math.round(dso)} days
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            target: 30d
          </div>
        </div>

        {/* Cash Runway */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Cash Runway
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {cashRunway} days
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            estimate
          </div>
        </div>

        {/* Fleet Utilisation */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Fleet Util %
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {fleetUtilization}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            active vehicles
          </div>
        </div>

        {/* Fast Pay Draw Rate */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Fast Pay Draw %
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {fastPayDrawRate}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            advances rate
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* LEFT COLUMN */}
        <div>
          {/* AI Signals Panel */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AI SIGNALS
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 2,
                  padding: '4px 8px',
                }}
              >
                <option value="All">All</option>
                <option value="Cash Alerts">Cash Alerts</option>
                <option value="Route Intelligence">Route Intelligence</option>
                <option value="Fleet Performance">Fleet Performance</option>
                <option value="Customer Intel">Customer Intel</option>
              </select>
            </div>

            {loading && (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card" style={{ marginBottom: 12, padding: 16 }}>
                    <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '30%' }} className="skeleton-pulse" />
                    <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '70%' }} className="skeleton-pulse" />
                    <div style={{ height: 40, background: 'var(--bg-surface)', borderRadius: 4 }} className="skeleton-pulse" />
                  </div>
                ))}
              </>
            )}

            {!loading && filteredSignals.length === 0 && (
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Intelligence engine is analyzing your data
                </div>
              </div>
            )}

            {!loading && filteredSignals.map((signal, i) => (
              <div
                key={i}
                className="card"
                style={{
                  marginBottom: 12,
                  padding: 16,
                  borderLeft: `3px solid ${getSignalColor(signal.severity)}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: getSignalColor(signal.severity),
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    {signal.type}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                  }}>
                    {signal.category}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {signal.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                  {signal.body}
                </div>
                {signal.action && (
                  <button
                    style={{
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '4px 10px',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    {signal.action}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Route Profitability Table */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 12
            }}>
              ROUTE PROFITABILITY
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      ROUTE ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      TRIPS ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      AVG REV ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      AVG COST ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      MARGIN % ↕
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && [1, 2, 3].map((i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-row)' }}>
                      <td colSpan={5} style={{ padding: '12px 16px' }}>
                        <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4 }} className="skeleton-pulse" />
                      </td>
                    </tr>
                  ))}
                  {!loading && routeData.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                        No route data available
                      </td>
                    </tr>
                  )}
                  {!loading && routeData.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-row)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {r.route}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {r.trips}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                        {formatCurrency(r.avg_revenue)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {formatCurrency(r.avg_cost)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          color: r.margin_pct >= 20 ? 'var(--status-success)' : r.margin_pct >= 10 ? 'var(--status-warning)' : 'var(--status-danger)',
                        }}>
                          {r.margin_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Cash Flow Forecast */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 12
            }}>
              CASH FLOW FORECAST (30/60/90)
            </div>
            <div className="card" style={{ padding: 20 }}>
              {loading && (
                <div style={{ height: 160, background: 'var(--bg-surface)', borderRadius: 4 }} className="skeleton-pulse" />
              )}
              {!loading && cashFlowData.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Cash flow forecast data not available
                </div>
              )}
              {!loading && cashFlowData.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Expected</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {formatCompactNumber(cashFlowSummary.expected)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Confirmed</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCompactNumber(cashFlowSummary.confirmed)}
                    </span>
                  </div>
                  {cashFlowData.map((period, i) => {
                    const maxVal = Math.max(...cashFlowData.map((c) => c.expected));
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {period.label}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {formatCompactNumber(period.expected)}
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-surface-hover)', borderRadius: 1, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${(period.expected / maxVal) * 100}%`,
                              background: 'var(--border-active)',
                              borderRadius: 1,
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${period.confirmed ? (period.confirmed / period.expected) * 100 : 0}%`,
                                background: 'var(--accent-primary)',
                                borderRadius: 1,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }} />
                      Confirmed
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 3, background: 'var(--border-active)', display: 'inline-block', borderRadius: 1 }} />
                      Expected
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Portfolio Health Indicators */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 12
            }}>
              PORTFOLIO HEALTH
            </div>
            <div className="card" style={{ padding: 20 }}>
              {loading && (
                <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 4 }} className="skeleton-pulse" />
              )}
              {!loading && (
                <>
                  {[
                    { label: 'Avg Payment Days', value: Math.round(dso), target: 30, ok: dso <= 30 },
                    { label: 'Dispute Rate', value: '2.1%', target: '<5%', ok: true },
                    { label: 'Advance Utilization', value: `${fastPayDrawRate}%`, target: '<60%', ok: true },
                    { label: 'Overdue Ratio', value: '8.3%', target: '<10%', ok: true },
                  ].map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: i < 3 ? '1px solid var(--border-row)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>target {row.target}</span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          color: row.ok ? 'var(--status-success)' : 'var(--status-danger)',
                        }}>
                          {row.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Customer Intelligence Table */}
          <div>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 12
            }}>
              CUSTOMER INTELLIGENCE (TOP 10)
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      CUSTOMER ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      REVENUE ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      DSO ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      CONCENTRATION ↕
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      RISK ↕
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && [1, 2, 3].map((i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-row)' }}>
                      <td colSpan={5} style={{ padding: '12px 16px' }}>
                        <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4 }} className="skeleton-pulse" />
                      </td>
                    </tr>
                  ))}
                  {!loading && customerHealth.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                        No customer data available
                      </td>
                    </tr>
                  )}
                  {!loading && customerHealth.slice(0, 10).map((customer, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-row)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {customer.customer_name}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                        {formatCurrency(customer.revenue)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {Math.round(customer.dso)}d
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ position: 'relative', height: 4, background: 'var(--bg-surface-hover)', borderRadius: 1, overflow: 'hidden' }}>
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: `${Math.min(customer.concentration_pct, 100)}%`,
                              background: 'var(--accent-primary)',
                              borderRadius: 1,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
                          {customer.concentration_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                            color: getRiskTierColor(customer.risk_tier),
                            padding: '2px 6px',
                            background: 'var(--bg-surface-hover)',
                            borderRadius: 2,
                            fontWeight: 600,
                          }}
                        >
                          {customer.risk_tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Bottom Section - Fleet Performance Summary */}
      <div style={{ marginTop: 24 }}>
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 12
        }}>
          FLEET PERFORMANCE SUMMARY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>Total Vehicles</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>24</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>Active %</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--status-success)' }}>{fleetUtilization}%</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>Idle Count</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--status-warning)' }}>4</div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>Avg Fuel Efficiency</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>3.2 km/L</div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Top 5 Vehicles by Revenue
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>
                  Vehicle
                </th>
                <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>
                  Revenue
                </th>
                <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>
                  Trips
                </th>
                <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {['TRK-001', 'TRK-007', 'TRK-012', 'TRK-045', 'TRK-023'].map((vehicle, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-row)' }}>
                  <td style={{ padding: '12px 0', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {vehicle}
                  </td>
                  <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                    {formatCurrency((145000 - i * 15000))}
                  </td>
                  <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {32 - i * 3}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: i < 3 ? 'var(--status-success)' : 'var(--text-tertiary)',
                      padding: '2px 6px',
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 2,
                    }}>
                      {i < 3 ? 'EN ROUTE' : 'IDLE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
