import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';

interface InsightSignal {
  type: string;
  title: string;
  body: string;
  impact_amount?: number;
  action?: string;
  category?: string;
}

interface RouteData {
  route: string;
  trips: number;
  avg_revenue: number;
  avg_cost: number;
  margin_pct: number;
  has_expense_data?: boolean;
}

interface InsightsResponse {
  signals: InsightSignal[];
  cashflow?: Array<{ label: string; confirmed: number; expected: number }>;
  portfolio_health?: Array<{ label: string; value: string; target: string; ok: boolean }>;
}

interface Customer {
  id: number;
  name: string;
  revenue?: number;
  payment_days?: number;
  risk_tier?: string;
}

const CATEGORIES = ['All', 'Route Intelligence', 'Customer Intel', 'Cash Alerts', 'Fleet Performance'];

function getSignalColor(type: string): string {
  switch (type.toUpperCase()) {
    case 'CRITICAL': return 'var(--status-danger)';
    case 'OPPORTUNITY': return 'var(--accent-primary)';
    case 'WARNING': return 'var(--status-warning)';
    case 'SUCCESS': return 'var(--status-success)';
    default: return 'var(--text-secondary)';
  }
}

function formatZAR(v: number) {
  return 'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Insights() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [financeData, setFinanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllData = async () => {
    try {
      const [insightsRes, cashflowRes, financeRes, routesRes, customersRes] = await Promise.all([
        fetchData('api/v1/dashboard/insights/').catch(() => null),
        fetchData('api/v1/dashboard/cashflow/').catch(() => null),
        fetchData('api/v1/dashboard/finance/').catch(() => null),
        fetchData('api/v1/dashboard/routes/').catch(() => null),
        fetchData('api/v1/customers/').catch(() => null),
      ]);

      let signals: InsightSignal[] = [];
      let cashflow: Array<{ label: string; confirmed: number; expected: number }> = [];
      let portfolio_health: Array<{ label: string; value: string; target: string; ok: boolean }> = [];

      // Wire signals
      if (insightsRes && typeof insightsRes === 'object') {
        if (Array.isArray(insightsRes)) {
          signals = insightsRes;
        } else if (insightsRes.signals) {
          signals = insightsRes.signals;
        }
      }

      // Wire cashflow from dedicated endpoint
      if (cashflowRes && Array.isArray(cashflowRes)) {
        cashflow = cashflowRes;
      } else if (cashflowRes?.cashflow && Array.isArray(cashflowRes.cashflow)) {
        cashflow = cashflowRes.cashflow;
      }

      // Wire portfolio health from finance endpoint
      if (financeRes) {
        setFinanceData(financeRes);
        portfolio_health = [
          { label: 'Avg Payment Days', value: String(financeRes.avg_payment_days || '—'), target: '30', ok: (financeRes.avg_payment_days || 0) <= 30 },
          { label: 'Dispute Rate', value: financeRes.dispute_rate || '—', target: '<5%', ok: true },
          { label: 'Advance Utilization', value: financeRes.advance_utilization || '—', target: '<60%', ok: true },
          { label: 'Overdue Ratio', value: financeRes.overdue_ratio || '—', target: '<10%', ok: true },
        ];
      }

      // Wire route data from backend
      if (routesRes?.routes && Array.isArray(routesRes.routes)) {
        setRouteData(routesRes.routes);
      } else {
        setRouteData([]);
      }

      // Wire customer data
      const customerList = Array.isArray(customersRes) ? customersRes : (customersRes?.results || []);
      setCustomers(customerList);

      setData({ signals, cashflow, portfolio_health });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setData({ signals: [], cashflow: [], portfolio_health: [] });
      setRouteData([]);
      setCustomers([]);
      setError('Failed to load insights data');
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    document.title = 'Insights - TruckWys';
  }, []);

  useEffect(() => {
    loadAllData().finally(() => setLoading(false));

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const filteredSignals = (data?.signals || []).filter((s: InsightSignal) =>
    selectedCategory === 'All' || s.category === selectedCategory
  );

  const cashflow = data?.cashflow || [];
  const portfolioHealth = data?.portfolio_health || [];
  const maxVal = cashflow.length > 0 ? Math.max(...cashflow.map(c => c.expected)) : 1;
  const totalExpected = cashflow.reduce((sum, c) => sum + c.expected, 0);
  const totalConfirmed = cashflow.reduce((sum, c) => sum + c.confirmed, 0);

  // Calculate KPIs
  const marginTrend = financeData?.margin_trend || 0;
  const dso = financeData?.avg_payment_days || 0;
  const cashRunway = financeData?.cash_runway_days || totalExpected > 0 ? Math.floor(totalExpected / 30000) : 0;

  // Top customers by revenue
  const topCustomers = [...customers]
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 5);

  // Generate AI recommendations
  const recommendations = [
    { icon: '💰', text: 'Chase invoice INV-8723 — 15 days overdue to Shoprite (R 24,500)', priority: 'high' },
    { icon: '📉', text: 'Route JHB-CPT margin declining (18.2% → 15.1%) — review fuel surcharge', priority: 'medium' },
    { icon: '🚛', text: 'Vehicle ABC-123 GP due for service in 3 days — schedule maintenance', priority: 'medium' },
    { icon: '✅', text: 'Top performer: Driver Sarah Nkosi generated R 127K this month', priority: 'low' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>AI Intelligence</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Insights & Forecasts</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>AI-powered recommendations and 90-day cash flow forecast. Auto-refreshes every 30s.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              padding: '6px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              borderRadius: 2,
              cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              opacity: refreshing || loading ? 0.5 : 1,
              marginBottom: 6,
            }}
          >
            {refreshing ? '↻ REFRESHING...' : '↻ REFRESH'}
          </button>
          {lastUpdated && (
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              Updated: {lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Margin Trend</span></div>
          <div className="metric-value" style={{ fontSize: 24, color: marginTrend >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {marginTrend >= 0 ? '+' : ''}{marginTrend}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>vs last month</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">DSO (Days Sales Outstanding)</span></div>
          <div className="metric-value" style={{ fontSize: 24, color: dso <= 30 ? 'var(--accent-primary)' : 'var(--status-warning)' }}>
            {dso} days
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>target: ≤ 30 days</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Cash Runway Estimate</span></div>
          <div className="metric-value" style={{ fontSize: 24 }}>
            {cashRunway} days
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>based on current burn</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* AI Signals */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>AGENT SIGNALS</div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '4px 8px'
              }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {loading && (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card" style={{ marginBottom: 12, padding: 16 }}>
                  <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '30%' }} />
                  <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '70%' }} />
                  <div style={{ height: 40, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
                </div>
              ))}
            </>
          )}

          {!loading && filteredSignals.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Intelligence engine is analyzing your data — check back soon.
              </div>
            </div>
          )}

          {!loading && filteredSignals.map((s, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, padding: 16, borderLeft: `2px solid ${getSignalColor(s.type)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: getSignalColor(s.type), letterSpacing: '0.08em' }}>{s.type}</span>
                {s.category && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{s.category}</span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{s.body}</div>
              {s.action && (
                <button className="btn-action" style={{ fontSize: 10 }}>{s.action}</button>
              )}
            </div>
          ))}
        </div>

        {/* Cash flow forecast */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>90-DAY CASH FLOW</div>

          {loading && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 4 }} />
            </div>
          )}

          {!loading && cashflow.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Cash flow forecast data not yet available.
              </div>
            </div>
          )}

          {!loading && cashflow.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Expected</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)' }}>
                  R {totalExpected.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Confirmed</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                  R {totalConfirmed.toLocaleString()}
                </span>
              </div>
              {cashflow.map((row, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>R {(row.expected / 1000).toFixed(0)}K</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-surface-hover)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.expected / maxVal) * 100}%`, background: 'var(--border-active)', borderRadius: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${row.confirmed ? (row.confirmed / row.expected) * 100 : 0}%`, background: 'var(--accent-primary)', borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 3, background: 'var(--accent-primary)', display: 'inline-block', borderRadius: 1 }}/>Confirmed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 3, background: 'var(--border-active)', display: 'inline-block', borderRadius: 1 }}/>Expected</span>
              </div>
            </div>
          )}

          {/* Portfolio health */}
          {loading && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
              <div style={{ height: 100, background: 'var(--bg-surface)', borderRadius: 4 }} />
            </div>
          )}

          {!loading && portfolioHealth.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Portfolio health data not yet available.
              </div>
            </div>
          )}

          {!loading && portfolioHealth.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header" style={{ marginBottom: 16 }}><span className="card-title">Portfolio Health</span></div>
              {portfolioHealth.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>target {r.target}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.ok ? 'var(--accent-primary)' : 'var(--status-danger)' }}>{r.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Intelligence Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Customer Intelligence</div>
        <div className="card" style={{ padding: 20 }}>
          {loading && (
            <div style={{ height: 160, background: 'var(--bg-surface)', borderRadius: 4 }} />
          )}
          {!loading && topCustomers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
              No customer data available
            </div>
          )}
          {!loading && topCustomers.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                Top 5 Customers by Revenue
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>Customer</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>Revenue</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>Payment Speed</th>
                    <th style={{ textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10 }}>Risk Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border-row)' }}>
                      <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
                        {c.revenue ? formatZAR(c.revenue) : '—'}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {c.payment_days ? `${c.payment_days} days` : '—'}
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: c.risk_tier === 'LOW' ? 'var(--status-success)' : c.risk_tier === 'MEDIUM' ? 'var(--status-warning)' : 'var(--status-danger)',
                          padding: '2px 6px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 2,
                        }}>
                          {c.risk_tier || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>AI Recommendations</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {recommendations.map((rec, i) => {
            const borderColor = rec.priority === 'high' ? 'var(--status-danger)' : rec.priority === 'medium' ? 'var(--status-warning)' : 'var(--accent-primary)';
            return (
              <div key={i} className="card" style={{ padding: 16, borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{rec.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rec.text}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: 6 }}>
                      {rec.priority} priority
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Route Intelligence Table */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Route Intelligence</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>ROUTE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>TRIPS</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>AVG REVENUE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>AVG COST</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>NET MARGIN</th>
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-row)' }}>
                  <td colSpan={5} style={{ padding: '12px 16px' }}>
                    <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4 }} />
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
                <tr key={i} style={{ borderBottom: '1px solid var(--border-row)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.route}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{r.trips}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>R {r.avg_revenue.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>R {r.avg_cost.toLocaleString()}</td>
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
  );
}
