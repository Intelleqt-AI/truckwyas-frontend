import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

// ========== TYPES ==========

interface KPIData {
  revenue_mtd: number;
  revenue_prev_month: number;
  revenue_change_pct: number;
  net_margin_pct: number;
  outstanding_invoices: number;
  overdue_invoices: number;
  dso: number;
  active_vehicles: number;
  fleet_utilization_pct: number;
  advances_this_month: number;
  total_advance_amount: number;
}

interface Recommendation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  customer_name?: string;
  amount?: number;
  days_overdue?: number;
  dso?: number;
  link?: string;
}

interface InsightsData {
  recommendations: Recommendation[];
}

interface TopCustomer {
  customer_id: number;
  customer_name: string;
  revenue: number;
  invoice_count: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  margin: number;
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
  revenue_ytd: number;
  total_revenue: number;
  total_expenses: number;
  dso: number;
  fuel_cost_ratio: number;
  outstanding_invoices_total: number;
  overdue_invoices_total: number;
  top_customers: TopCustomer[];
  monthly_trend: MonthlyTrend[];
  cash_flow_forecast: CashFlowForecast;
}

interface CashFlowPeriod {
  period: string;
  start_date: string;
  end_date: string;
  expected_in: number;
  expected_out: number;
  net: number;
}

interface CashFlowData {
  forecast: CashFlowPeriod[];
}

interface Load {
  id: number;
  load_number: string;
  pickup_city: string;
  delivery_city: string;
  total_amount: number;
  status: string;
  distance: number;
  weight: number;
  driver_name: string;
  vehicle_info: string;
  cargo_description: string;
  fuel_surcharge: number;
  rate: number;
  created_at: string;
  pickup_date: string;
}

interface Invoice {
  id: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  due_date: string;
  issue_date: string;
  early_pay_eligible: boolean;
}

interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  vehicle_info: string;
  driver_name: string;
}

interface Driver {
  id: number;
  revenue_generated: number;
  total_trips: number;
  avg_revenue_per_trip: number;
  experience_years: number;
  violation_count: number;
  accident_history: number;
  status: string;
  user_details: {
    name: string;
    first_name?: string;
    last_name?: string;
  };
}

interface Vehicle {
  id: number;
  plate: string;
  make: string;
  model: string;
  status: string;
  ai_health_score: number;
  fuel_efficiency_score: number;
  uptime_score: number;
  maintenance_score: number;
  uptime_percentage: number;
  cost_per_km: number;
  margin_per_trip: number;
  mileage: number;
  revenue_generated: number;
}

type TabType = 'briefing' | 'margin' | 'cash' | 'fleet' | 'lanes';
type PeriodType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_6M' | 'LAST_12M' | 'CUSTOM';

const TABS = [
  { id: 'briefing' as TabType, label: 'Briefing' },
  { id: 'margin' as TabType, label: 'Margin Engine' },
  { id: 'cash' as TabType, label: 'Cash Flow' },
  { id: 'fleet' as TabType, label: 'Fleet' },
  { id: 'lanes' as TabType, label: 'Lanes' },
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
  const [tab, setTab] = useState<TabType>('briefing');
  const [period, setPeriod] = useState<PeriodType>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);

  // Data states
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [cashflowData, setCashflowData] = useState<CashFlowData | null>(null);
  const [loads, setLoads] = useState<Load[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [briefing, setBriefing] = useState<{ narrative?: string; ai_available?: boolean } | null>(null);

  // AI executive briefing (Claude when configured, deterministic summary otherwise)
  useEffect(() => {
    fetchData('api/v1/dashboard/briefing/')
      .then(setBriefing)
      .catch(() => setBriefing(null));
  }, []);

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
      const params = getPeriodParams();

      try {
        switch (tab) {
          case 'briefing':
            const [kpi, insights, loadsResp] = await Promise.all([
              fetchData('api/v1/dashboard/kpi/').catch(() => null),
              fetchData('api/v1/dashboard/insights/').catch(() => ({ recommendations: [] })),
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setKpiData(kpi);
            setInsightsData(insights);
            setLoads(loadsResp?.results || []);
            break;

          case 'margin':
            const [finance, loadsData, expensesData] = await Promise.all([
              fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null),
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
              fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setFinanceData(finance);
            setLoads(loadsData?.results || []);
            setExpenses(expensesData?.results || []);
            break;

          case 'cash':
            const [cf, finData, invData] = await Promise.all([
              fetchData('api/v1/dashboard/cashflow/').catch(() => ({ forecast: [] })),
              fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null),
              fetchData('api/v1/invoices/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setCashflowData(cf);
            setFinanceData(finData);
            setInvoices(invData?.results || []);
            break;

          case 'fleet':
            const [veh, drv, exp] = await Promise.all([
              fetchData('api/v1/vehicles/?page_size=50').catch(() => ({ results: [] })),
              fetchData('api/v1/drivers/?page_size=50').catch(() => ({ results: [] })),
              fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setVehicles((veh?.results || []).map((v: any) => ({
              ...v,
              uptime_percentage: parseFloat(v.uptime_percentage || '0'),
              cost_per_km: parseFloat(v.cost_per_km || '0'),
              margin_per_trip: parseFloat(v.margin_per_trip || '0'),
              mileage: parseFloat(v.mileage || '0'),
            })));
            setDrivers(drv?.results || []);
            setExpenses(exp?.results || []);
            break;

          case 'lanes':
            const [lds, exps] = await Promise.all([
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
              fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setLoads(lds?.results || []);
            setExpenses(exps?.results || []);
            break;
        }
      } catch (err) {
        console.error('Failed to load insights data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTabData();
  }, [tab, period, customFrom, customTo]);

  // Helper functions
  const getMarginColor = (pct: number) => {
    if (pct > 50) return 'var(--status-success)';
    if (pct >= 30) return 'var(--status-warning)';
    return 'var(--status-danger)';
  };

  const getDSOColor = (dso: number) => {
    if (dso < 30) return 'var(--status-success)';
    if (dso <= 60) return 'var(--status-warning)';
    return 'var(--status-danger)';
  };

  const getSeverityDot = (severity: string) => {
    if (severity === 'HIGH' || severity === 'CRITICAL') return 'var(--status-danger)';
    if (severity === 'MEDIUM') return 'var(--status-warning)';
    return 'var(--status-success)';
  };

  const SectionHeader = ({ children }: { children: string }) => (
    <div style={{
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-tertiary)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 16,
    }}>
      {children}
    </div>
  );

  const StatusBadge = ({ children }: { children: string }) => (
    <div style={{
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 2,
      background: 'var(--bg-surface-hover)',
      color: 'var(--text-secondary)',
      display: 'inline-block',
    }}>
      {children}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 4
        }}>
          Intelligence
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Insights</div>
      </div>

      {/* Period filters */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
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
      {loading ? (
        <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: 40 }}>—</div>
      ) : (
        <>
          {/* TAB 1: BRIEFING */}
          {tab === 'briefing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* AI EXECUTIVE BRIEFING */}
              {briefing?.narrative && (
                <div style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: 20,
                  background: 'var(--bg-surface)',
                }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>AI Executive Briefing</span>
                    <span style={{ color: briefing.ai_available ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                      {briefing.ai_available ? 'CLAUDE' : 'SUMMARY'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {briefing.narrative}
                  </div>
                </div>
              )}

              {/* SECTION 1: BUSINESS PULSE */}
              <div>
                <SectionHeader>BUSINESS PULSE</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                  {/* Revenue MTD */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {formatCurrency(kpiData?.revenue_mtd || 0)}
                    </div>
                    {kpiData?.revenue_change_pct !== undefined && (
                      <div style={{
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        color: kpiData.revenue_change_pct >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                        marginBottom: 8,
                      }}>
                        {kpiData.revenue_change_pct >= 0 ? '+' : ''}{kpiData.revenue_change_pct.toFixed(1)}%
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Revenue MTD
                    </div>
                  </div>

                  {/* Net Margin */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: getMarginColor(kpiData?.net_margin_pct || 0),
                      marginBottom: 12,
                    }}>
                      {(kpiData?.net_margin_pct || 0).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Net Margin
                    </div>
                  </div>

                  {/* DSO */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: getDSOColor(kpiData?.dso || 0),
                      marginBottom: 4,
                    }}>
                      {Math.round(kpiData?.dso || 0)}d
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      avg days to collect
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      DSO
                    </div>
                  </div>

                  {/* Fleet Utilisation */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}>
                      {(kpiData?.fleet_utilization_pct || 0).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      of fleet active
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Fleet Utilisation
                    </div>
                  </div>

                  {/* Cash in 30 Days */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--status-success)',
                      marginBottom: 12,
                    }}>
                      {formatCurrency(kpiData?.total_advance_amount || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Cash Available
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ACTION REQUIRED */}
              <div>
                <SectionHeader>ACTION REQUIRED</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {insightsData?.recommendations && insightsData.recommendations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...insightsData.recommendations]
                        .sort((a, b) => {
                          const impactA = a.amount || 0;
                          const impactB = b.amount || 0;
                          return impactB - impactA;
                        })
                        .map((rec, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            background: 'var(--bg-surface)',
                            borderRadius: 2,
                          }}>
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: getSeverityDot(rec.severity),
                              flexShrink: 0,
                            }} />
                            <div style={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 2,
                              background: 'var(--bg-surface-hover)',
                              color: 'var(--text-secondary)',
                            }}>
                              {rec.type.replace(/_/g, ' ')}
                            </div>
                            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                              {rec.message}
                            </div>
                            {rec.amount && (
                              <div style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}>
                                {formatCurrency(rec.amount)}
                              </div>
                            )}
                            {rec.days_overdue && (
                              <div style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                              }}>
                                {rec.days_overdue}d
                              </div>
                            )}
                            {rec.link && (
                              <div
                                onClick={() => navigate(rec.link || '')}
                                style={{
                                  fontSize: 18,
                                  color: 'var(--accent-primary)',
                                  cursor: 'pointer',
                                }}
                              >
                                →
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--status-success)',
                      }} />
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        All systems normal — no alerts
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: LIVE OPERATIONS */}
              <div>
                <SectionHeader>LIVE OPERATIONS</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {(() => {
                    const inTransit = loads.filter(l => ['IN_TRANSIT', 'ASSIGNED'].includes(l.status.toUpperCase().replace(' ', '_')));
                    const inTransitRevenue = inTransit.reduce((sum, l) => sum + l.total_amount, 0);

                    const delivered = loads.filter(l => ['DELIVERED', 'INVOICED'].includes(l.status.toUpperCase()));
                    const deliveredRevenue = delivered.reduce((sum, l) => sum + l.total_amount, 0);

                    const routeMap = new Map<string, number>();
                    loads.forEach(l => {
                      const route = `${l.pickup_city} → ${l.delivery_city}`;
                      routeMap.set(route, (routeMap.get(route) || 0) + 1);
                    });
                    const topRoute = Array.from(routeMap.entries()).sort((a, b) => b[1] - a[1])[0];

                    return (
                      <>
                        <div className="card" style={{ padding: 20, borderLeft: '3px solid var(--accent-primary)' }}>
                          <div style={{
                            fontSize: 24,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                          }}>
                            {inTransit.length}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            loads in motion
                          </div>
                          <div style={{
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-primary)',
                          }}>
                            {formatCurrency(inTransitRevenue)} revenue in transit
                          </div>
                        </div>

                        <div className="card" style={{ padding: 20, borderLeft: '3px solid var(--status-success)' }}>
                          <div style={{
                            fontSize: 24,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                          }}>
                            {delivered.length}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            loads completed
                          </div>
                          <div style={{
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--status-success)',
                          }}>
                            {formatCurrency(deliveredRevenue)} revenue realised
                          </div>
                        </div>

                        <div className="card" style={{ padding: 20, borderLeft: '3px solid var(--text-secondary)' }}>
                          <div style={{
                            fontSize: 16,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                          }}>
                            {topRoute ? topRoute[0] : 'No routes'}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            most active route
                          </div>
                          <div style={{
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-tertiary)',
                          }}>
                            {topRoute ? `${topRoute[1]} trips this period` : ''}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MARGIN ENGINE */}
          {tab === 'margin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* SECTION 1: P&L SUMMARY */}
              <div>
                <SectionHeader>P&L SUMMARY</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 12,
                    }}>
                      {formatCurrency(financeData?.revenue_period || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Revenue Period
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--status-danger)',
                      marginBottom: 12,
                    }}>
                      {formatCurrency(financeData?.expenses_period || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Total Costs
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: (financeData?.net_margin_period || 0) >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                      marginBottom: 12,
                    }}>
                      {formatCurrency(financeData?.net_margin_period || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Net Margin R
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 24,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: getMarginColor(financeData?.net_margin_percent_period || 0),
                      marginBottom: 12,
                    }}>
                      {(financeData?.net_margin_percent_period || 0).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Net Margin %
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ROUTE PROFITABILITY RANKING */}
              <div>
                <SectionHeader>ROUTE EFFICIENCY RANKING — Revenue per km driven</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const routeMap = new Map<string, {
                      trips: number;
                      total_revenue: number;
                      total_distance: number;
                      total_fuel: number;
                    }>();

                    loads.forEach(load => {
                      const route = `${load.pickup_city} → ${load.delivery_city}`;
                      const existing = routeMap.get(route) || {
                        trips: 0,
                        total_revenue: 0,
                        total_distance: 0,
                        total_fuel: 0,
                      };
                      routeMap.set(route, {
                        trips: existing.trips + 1,
                        total_revenue: existing.total_revenue + load.total_amount,
                        total_distance: existing.total_distance + load.distance,
                        total_fuel: existing.total_fuel + (load.fuel_surcharge || 0),
                      });
                    });

                    const routes = Array.from(routeMap.entries())
                      .map(([route, data]) => ({
                        route,
                        trips: data.trips,
                        total_revenue: data.total_revenue,
                        total_distance: data.total_distance,
                        total_fuel: data.total_fuel,
                        true_margin: data.total_revenue - data.total_fuel,
                        margin_pct: data.total_revenue > 0 ? ((data.total_revenue - data.total_fuel) / data.total_revenue) * 100 : 0,
                        rev_per_km: data.total_distance > 0 ? data.total_revenue / data.total_distance : 0,
                      }))
                      .sort((a, b) => b.rev_per_km - a.rev_per_km)
                      .slice(0, 10);

                    const maxRevPerKm = Math.max(...routes.map(r => r.rev_per_km), 1);

                    return routes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {routes.map((r, idx) => {
                          const isTop3 = idx < 3;
                          const isBottom2 = idx >= routes.length - 2 && routes.length >= 5;

                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 12,
                                background: 'var(--bg-surface)',
                                borderRadius: 2,
                                borderLeft: `3px solid ${isTop3 ? 'var(--status-success)' : isBottom2 ? 'var(--status-danger)' : 'transparent'}`,
                              }}
                            >
                              <div style={{
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                minWidth: 20,
                              }}>
                                #{idx + 1}
                              </div>
                              <div style={{ minWidth: 200, fontSize: 13, color: 'var(--text-primary)' }}>
                                {r.route}
                              </div>
                              <div style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 60,
                              }}>
                                {r.trips} trips
                              </div>
                              <div style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-primary)',
                                minWidth: 100,
                              }}>
                                {formatCurrency(r.total_revenue)}
                              </div>
                              <div style={{
                                fontSize: 14,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                minWidth: 100,
                              }}>
                                {formatCurrency(r.rev_per_km)}/km
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  flex: 1,
                                  height: 16,
                                  background: 'var(--bg-surface-hover)',
                                  borderRadius: 2,
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${r.margin_pct}%`,
                                    height: '100%',
                                    background: r.margin_pct > 50 ? 'var(--status-success)' : r.margin_pct > 30 ? 'var(--status-warning)' : 'var(--status-danger)',
                                    borderRadius: 2,
                                  }} />
                                </div>
                                <div style={{
                                  fontSize: 12,
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-secondary)',
                                  minWidth: 50,
                                }}>
                                  {r.margin_pct.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        No data for this period
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SECTION 3: MONTHLY P&L TREND */}
              {financeData?.monthly_trend && financeData.monthly_trend.length > 0 && (
                <div>
                  <SectionHeader>MONTHLY P&L TREND</SectionHeader>
                  <div className="card" style={{ padding: 20 }}>
                    {(() => {
                      const trend = [...financeData.monthly_trend].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
                      const maxValue = Math.max(...trend.map(m => Math.max(m.revenue, m.expenses)));
                      const isImproving = trend.length >= 2 && trend[trend.length - 1].margin > trend[trend.length - 2].margin;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {trend.map((m, idx) => {
                            const revWidth = maxValue > 0 ? (m.revenue / maxValue) * 100 : 0;
                            const expWidth = maxValue > 0 ? (m.expenses / maxValue) * 100 : 0;

                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                  width: 40,
                                  fontSize: 11,
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-tertiary)',
                                  textTransform: 'uppercase',
                                }}>
                                  {new Date(m.month + '-01').toLocaleString('en-ZA', { month: 'short' }).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{
                                    height: 16,
                                    background: 'var(--accent-primary)',
                                    width: `${revWidth}%`,
                                    borderRadius: 2,
                                  }} />
                                  <div style={{
                                    height: 16,
                                    background: 'var(--status-danger)',
                                    width: `${expWidth}%`,
                                    borderRadius: 2,
                                    opacity: 0.7,
                                  }} />
                                </div>
                                <div style={{
                                  fontSize: 13,
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 600,
                                  color: m.margin > 0 ? 'var(--status-success)' : 'var(--status-danger)',
                                  minWidth: 100,
                                  textAlign: 'right',
                                }}>
                                  {formatCurrency(m.margin)}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: isImproving ? 'var(--status-success)' : 'var(--status-danger)',
                          }}>
                            {isImproving ? '↑ Margin improving' : '↓ Margin declining'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {(() => {
                    // Largest cost, computed from the loaded expenses (the API
                    // doesn't return an expense_breakdown).
                    const catMap = new Map<string, number>();
                    expenses.forEach(exp => catMap.set(exp.category, (catMap.get(exp.category) || 0) + Number(exp.amount || 0)));
                    const entries = Array.from(catMap.entries());
                    if (entries.length === 0) return null;
                    const largest = entries.reduce((max, [cat, amt]) => amt > max.amount ? { category: cat, amount: amt } : max, { category: '', amount: 0 });
                    const revenue = financeData?.revenue_period || 0;
                    const largestPct = revenue > 0 ? (largest.amount / revenue) * 100 : 0;
                    return (
                      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface-hover)', borderRadius: 4, borderLeft: '3px solid var(--accent-primary)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{largest.category.replace('_', ' ').charAt(0).toUpperCase() + largest.category.replace('_', ' ').slice(1)}</strong> is your largest cost at <strong style={{ color: 'var(--accent-primary)' }}>{largestPct.toFixed(1)}%</strong> of revenue ({formatCurrency(largest.amount)}).
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SECTION 4: COST BREAKDOWN */}
              <div>
                <SectionHeader>COST BREAKDOWN</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const categoryMap = new Map<string, number>();
                    expenses.forEach(exp => {
                      const existing = categoryMap.get(exp.category) || 0;
                      categoryMap.set(exp.category, existing + exp.amount);
                    });

                    const categories = Array.from(categoryMap.entries())
                      .map(([category, amount]) => ({ category, amount }))
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 6);

                    const totalExpenses = categories.reduce((sum, c) => sum + c.amount, 0);
                    const maxAmount = Math.max(...categories.map(c => c.amount), 1);

                    return categories.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {categories.map((cat, idx) => {
                          const widthPct = (cat.amount / maxAmount) * 100;
                          const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;

                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                minWidth: 120,
                                fontSize: 12,
                                textTransform: 'uppercase',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                              }}>
                                {cat.category}
                              </div>
                              <div style={{
                                flex: 1,
                                height: 20,
                                background: 'var(--bg-surface-hover)',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: 'var(--accent-dim)',
                                  borderRadius: 2,
                                }} />
                              </div>
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                minWidth: 100,
                                textAlign: 'right',
                              }}>
                                {formatCurrency(cat.amount)}
                              </div>
                              <div style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 50,
                                textAlign: 'right',
                              }}>
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                        <div style={{
                          marginTop: 8,
                          paddingTop: 12,
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}>
                          Total expenses this period: <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}>{formatCurrency(totalExpenses)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        No data for this period
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CASH FLOW */}
          {tab === 'cash' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* SECTION 1: CASH POSITION */}
              <div>
                <SectionHeader>CASH POSITION</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: (financeData?.cash_flow_forecast?.next_30_days || 0) >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                      marginBottom: 8,
                    }}>
                      {formatCurrency(financeData?.cash_flow_forecast?.next_30_days || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Next 30 Days
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      Expected Net Cash
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 8,
                    }}>
                      {formatCurrency(financeData?.cash_flow_forecast?.next_60_days || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Next 60 Days
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      Expected Net Cash
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 8,
                    }}>
                      {formatCurrency(financeData?.cash_flow_forecast?.next_90_days || 0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Next 90 Days
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      Expected Net Cash
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER PAYMENT INTELLIGENCE */}
              <div>
                <SectionHeader>WHO OWES YOU AND HOW LONG</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const customerMap = new Map<string, {
                      total_outstanding: number;
                      oldest_days: number;
                      invoice_count: number;
                    }>();

                    const now = new Date();
                    invoices.forEach(inv => {
                      if (inv.status !== 'PAID' && inv.balance > 0) {
                        const issueDate = new Date(inv.issue_date);
                        const daysOld = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

                        const existing = customerMap.get(inv.customer_name) || {
                          total_outstanding: 0,
                          oldest_days: 0,
                          invoice_count: 0,
                        };

                        customerMap.set(inv.customer_name, {
                          total_outstanding: existing.total_outstanding + inv.balance,
                          oldest_days: Math.max(existing.oldest_days, daysOld),
                          invoice_count: existing.invoice_count + 1,
                        });
                      }
                    });

                    const customers = Array.from(customerMap.entries())
                      .map(([name, data]) => ({
                        customer_name: name,
                        total_outstanding: data.total_outstanding,
                        oldest_invoice_days: data.oldest_days,
                        invoice_count: data.invoice_count,
                      }))
                      .sort((a, b) => b.total_outstanding - a.total_outstanding)
                      .slice(0, 8);

                    const top3sum = customers.slice(0, 3).reduce((sum, c) => sum + c.total_outstanding, 0);

                    return customers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {customers.map((c, idx) => {
                          const risk = c.oldest_invoice_days > 60 ? 'HIGH RISK' : c.oldest_invoice_days > 30 ? 'MEDIUM' : 'CURRENT';
                          const riskColor = c.oldest_invoice_days > 60 ? 'var(--status-danger)' : c.oldest_invoice_days > 30 ? 'var(--status-warning)' : 'var(--status-success)';

                          return (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: 'var(--bg-surface)',
                              borderRadius: 2,
                            }}>
                              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                                {c.customer_name}
                              </div>
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                minWidth: 100,
                              }}>
                                {formatCurrency(c.total_outstanding)}
                              </div>
                              <div style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 100,
                              }}>
                                Oldest: {c.oldest_invoice_days}d
                              </div>
                              <div style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 80,
                              }}>
                                {c.invoice_count} invoices
                              </div>
                              <div style={{
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: 2,
                                background: riskColor,
                                color: 'white',
                              }}>
                                {risk}
                              </div>
                            </div>
                          );
                        })}
                        <div style={{
                          marginTop: 8,
                          padding: 12,
                          background: 'var(--bg-surface)',
                          borderRadius: 2,
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}>
                          Collecting these 3 accounts would unlock <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                          }}>{formatCurrency(top3sum)}</span> in cash
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        No outstanding invoices
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SECTION 3: WEEKLY CASH FORECAST */}
              <div>
                <SectionHeader>WEEKLY CASH FORECAST — Next 8 weeks net position</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {cashflowData?.forecast && cashflowData.forecast.length > 0 ? (() => {
                    const data = cashflowData.forecast.slice(0, 8).map(f => ({
                      week: f.period.replace('2026-', ''),
                      net: Math.round(f.net),
                      in: Math.round(f.expected_in),
                      out: Math.round(f.expected_out),
                    }));
                    const runningBalance = data.reduce((sum, d) => sum + d.net, 0);
                    return (
                      <div>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                            <XAxis dataKey="week" tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${Math.abs(v/1000).toFixed(0)}k`} />
                            <Tooltip
                              contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                              formatter={(value: number) => [formatCurrency(value), '']}
                              labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                            />
                            <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
                            <Bar dataKey="net" radius={[2, 2, 0, 0]}>
                              {data.map((entry, index) => (
                                <Cell key={index} fill={entry.net >= 0 ? 'var(--accent-primary)' : 'var(--status-danger)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                          <div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>8-Week Net</div>
                            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: runningBalance >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>{formatCurrency(runningBalance)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Positive Weeks</div>
                            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--status-success)' }}>{data.filter(d => d.net >= 0).length} of {data.length}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Peak Week</div>
                            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>{formatCurrency(Math.max(...data.map(d => d.net)))}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No forecast data available</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* SECTION 1: FLEET HEALTH SUMMARY */}
              <div>
                <SectionHeader>FLEET HEALTH SUMMARY</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 12,
                    }}>
                      {vehicles.filter(v => ['IN_USE', 'AVAILABLE'].includes(v.status.toUpperCase())).length}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Active Vehicles
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 12,
                    }}>
                      {vehicles.length > 0 ? (vehicles.reduce((sum, v) => sum + (v.ai_health_score || 0), 0) / vehicles.length).toFixed(0) : 0}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Avg Health Score
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--status-danger)',
                      marginBottom: 12,
                    }}>
                      {vehicles.filter(v => (v.ai_health_score || 100) < 60).length}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Vehicles at Risk
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20 }}>
                    <div style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 12,
                    }}>
                      {vehicles.length > 0 ? formatCurrency(vehicles.reduce((sum, v) => sum + (v.cost_per_km || 0), 0) / vehicles.length) : formatCurrency(0)}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Avg Cost/km
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: VEHICLE EFFICIENCY RANKING */}
              <div>
                <SectionHeader>VEHICLE PERFORMANCE — Revenue earned vs operational cost</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {vehicles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...vehicles]
                        .sort((a, b) => b.revenue_generated - a.revenue_generated)
                        .map((v, idx) => {
                          const healthColor = v.ai_health_score > 80 ? 'var(--status-success)' : v.ai_health_score > 60 ? 'var(--status-warning)' : 'var(--status-danger)';

                          return (
                            <div
                              key={v.id}
                              onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 12,
                                background: 'var(--bg-surface)',
                                borderRadius: 2,
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                minWidth: 30,
                              }}>
                                #{idx + 1}
                              </div>
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                minWidth: 100,
                              }}>
                                {v.plate}
                              </div>
                              <div style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                minWidth: 150,
                              }}>
                                {v.make} {v.model}
                              </div>
                              <StatusBadge>{v.status}</StatusBadge>
                              <div style={{ flex: 1 }} />
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                minWidth: 100,
                              }}>
                                {v.revenue_generated > 0 ? formatCurrency(v.revenue_generated) : 'No revenue data'}
                              </div>
                              <div style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 80,
                              }}>
                                {formatCurrency(v.cost_per_km)}/km
                              </div>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                minWidth: 100,
                              }}>
                                <div style={{
                                  flex: 1,
                                  height: 8,
                                  background: 'var(--bg-surface-hover)',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${v.ai_health_score}%`,
                                    height: '100%',
                                    background: healthColor,
                                  }} />
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  fontFamily: 'var(--font-mono)',
                                  color: healthColor,
                                }}>
                                  {v.ai_health_score}
                                </div>
                              </div>
                              <div style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                minWidth: 60,
                              }}>
                                {v.uptime_percentage.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      No data for this period
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: DRIVER EFFICIENCY MATRIX */}
              <div>
                <SectionHeader>DRIVER PERFORMANCE — Revenue generated and risk profile</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {drivers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...drivers]
                        .sort((a, b) => b.revenue_generated - a.revenue_generated)
                        .map((d, idx) => (
                          <div
                            key={d.id}
                            onClick={() => navigate(`/fleet/drivers/${d.id}/financial`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: 'var(--bg-surface)',
                              borderRadius: 2,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: 'var(--text-tertiary)',
                              minWidth: 30,
                            }}>
                              #{idx + 1}
                            </div>
                            <div style={{
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              minWidth: 180,
                            }}>
                              {d.user_details.name}
                            </div>
                            <StatusBadge>{d.status}</StatusBadge>
                            <div style={{ flex: 1 }} />
                            <div style={{
                              fontSize: 13,
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: 'var(--accent-primary)',
                              minWidth: 100,
                            }}>
                              {formatCurrency(d.revenue_generated)}
                            </div>
                            <div style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              minWidth: 60,
                            }}>
                              {d.total_trips} trips
                            </div>
                            <div style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              minWidth: 100,
                            }}>
                              {formatCurrency(d.avg_revenue_per_trip)}/trip
                            </div>
                            {(d.violation_count > 0 || d.accident_history > 0) && (
                              <div style={{
                                fontSize: 11,
                                color: 'var(--status-danger)',
                              }}>
                                {d.violation_count > 0 && `⚠ ${d.violation_count} violations`}
                                {d.violation_count > 0 && d.accident_history > 0 && ', '}
                                {d.accident_history > 0 && `⚠ ${d.accident_history} accidents`}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      No data for this period
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: MAINTENANCE RISK ALERT */}
              <div>
                <SectionHeader>MAINTENANCE RISK ALERT</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const atRisk = vehicles.filter(v => (v.ai_health_score || 100) < 70).sort((a, b) => a.ai_health_score - b.ai_health_score);

                    return atRisk.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {atRisk.map((v, idx) => {
                          const recommendation = v.ai_health_score < 50 ? '⚠ High maintenance risk — schedule immediately' : 'Monitor closely';

                          return (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: 'var(--bg-surface)',
                              borderRadius: 2,
                            }}>
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                minWidth: 100,
                              }}>
                                {v.plate}
                              </div>
                              <div style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                minWidth: 120,
                              }}>
                                {v.make}
                              </div>
                              <div style={{
                                fontSize: 13,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: v.ai_health_score < 50 ? 'var(--status-danger)' : 'var(--status-warning)',
                                minWidth: 60,
                              }}>
                                {v.ai_health_score}
                              </div>
                              <StatusBadge>{v.status}</StatusBadge>
                              <div style={{ flex: 1, fontSize: 12, color: 'var(--status-danger)' }}>
                                {recommendation}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{
                        padding: 20,
                        textAlign: 'center',
                        color: 'var(--status-success)',
                        fontSize: 13,
                      }}>
                        All vehicles within healthy operating range
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LANES */}
          {tab === 'lanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* SECTION 1: CORRIDOR EFFICIENCY */}
              <div>
                <SectionHeader>CORRIDOR EFFICIENCY — Revenue per km driven</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const routeMap = new Map<string, { trips: number; total_revenue: number; total_distance: number; total_fuel: number }>();
                    loads.forEach(load => {
                      if (!load.pickup_city || !load.delivery_city) return;
                      const route = `${load.pickup_city} → ${load.delivery_city}`;
                      const e = routeMap.get(route) || { trips: 0, total_revenue: 0, total_distance: 0, total_fuel: 0 };
                      routeMap.set(route, {
                        trips: e.trips + 1,
                        total_revenue: e.total_revenue + (parseFloat(String(load.total_amount)) || 0),
                        total_distance: e.total_distance + (parseFloat(String(load.distance)) || 0),
                        total_fuel: e.total_fuel + (parseFloat(String(load.fuel_surcharge)) || 0),
                      });
                    });
                    const routes = Array.from(routeMap.entries())
                      .map(([route, d]) => ({
                        route, trips: d.trips,
                        total_revenue: d.total_revenue,
                        rev_per_km: d.total_distance > 0 ? d.total_revenue / d.total_distance : 0,
                        margin_pct: d.total_revenue > 0 ? ((d.total_revenue - d.total_fuel) / d.total_revenue) * 100 : 0,
                      }))
                      .filter(r => r.rev_per_km > 0)
                      .sort((a, b) => b.rev_per_km - a.rev_per_km)
                      .slice(0, 8);
                    if (routes.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No route data for this period</div>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Header row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px 80px', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                          {['Route', 'Trips', 'Revenue', 'Rev/km', 'Margin'].map(h => (
                            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                          ))}
                        </div>
                        {routes.map((r, idx) => (
                          <div key={idx} style={{
                            display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px 80px', gap: 12,
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--border-row)',
                            borderLeft: idx < 2 ? '3px solid var(--status-success)' : idx >= routes.length - 2 ? '3px solid var(--status-danger)' : '3px solid transparent',
                          }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{r.route}</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.trips}</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatCurrency(r.total_revenue)}</div>
                            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>{formatCurrency(r.rev_per_km)}</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.margin_pct > 50 ? 'var(--status-success)' : r.margin_pct > 30 ? 'var(--status-warning)' : 'var(--status-danger)' }}>{r.margin_pct.toFixed(1)}%</div>
                          </div>
                        ))}
                        <div style={{ padding: '12px 12px 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          Green = most efficient corridors · Red = least efficient
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SECTION 2: CARGO PERFORMANCE */}
              <div>
                <SectionHeader>CARGO PERFORMANCE — Avg revenue per trip by cargo type</SectionHeader>
                <div className="card" style={{ padding: 20 }}>
                  {(() => {
                    const cargoMap = new Map<string, { count: number; total: number }>();
                    loads.forEach(load => {
                      const words = (load.cargo_description || 'Unknown').trim().split(/\s+/).slice(0, 2);
                      const key = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                      const e = cargoMap.get(key) || { count: 0, total: 0 };
                      cargoMap.set(key, { count: e.count + 1, total: e.total + (parseFloat(String(load.total_amount)) || 0) });
                    });
                    const types = Array.from(cargoMap.entries())
                      .map(([cargo, d]) => ({ cargo, trips: d.count, avg: d.total / d.count, total: d.total }))
                      .sort((a, b) => b.avg - a.avg);
                    if (types.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No cargo data</div>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 100px', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                          {['Cargo Type', 'Avg/Trip', 'Trips', 'Total'].map(h => (
                            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                          ))}
                        </div>
                        {types.map((c, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 100px', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border-row)' }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.cargo}</div>
                            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: idx === 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{formatCurrency(c.avg)}</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{c.trips}</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatCurrency(c.total)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SECTION 3: LOAD STATUS */}
              <div>
                <SectionHeader>LOAD PIPELINE STATUS</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {(() => {
                    const pending = loads.filter(l => ['PENDING', 'ASSIGNED'].includes((l.status || '').toUpperCase()));
                    const inMotion = loads.filter(l => ['IN_TRANSIT'].includes((l.status || '').toUpperCase().replace(' ', '_')));
                    const completed = loads.filter(l => ['DELIVERED', 'INVOICED'].includes((l.status || '').toUpperCase()));
                    const pRev = pending.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                    const mRev = inMotion.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                    const cRev = completed.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0);
                    return [
                      { label: 'Pipeline', count: pending.length, rev: pRev, sub: 'pending dispatch', color: 'var(--text-secondary)' },
                      { label: 'In Motion', count: inMotion.length, rev: mRev, sub: 'revenue in transit', color: 'var(--accent-primary)' },
                      { label: 'Completed', count: completed.length, rev: cRev, sub: 'revenue realised', color: 'var(--status-success)' },
                    ].map((item, idx) => (
                      <div key={idx} className="card" style={{ padding: 20 }}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 12 }}>{item.label}</div>
                        <div style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 600, color: item.color, marginBottom: 6 }}>{item.count}</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>{formatCurrency(item.rev)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.sub}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* SECTION 4: WEIGHT CLASS */}
              <div>
                <SectionHeader>WEIGHT CLASS ANALYSIS — Avg revenue per trip by load size</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {(() => {
                    const bins = [
                      { label: 'Under 5t', filter: (w: number) => w < 5000 },
                      { label: '5 – 10t', filter: (w: number) => w >= 5000 && w < 10000 },
                      { label: '10 – 20t', filter: (w: number) => w >= 10000 && w < 20000 },
                      { label: '20t+', filter: (w: number) => w >= 20000 },
                    ].map(b => {
                      const bl = loads.filter(l => b.filter(parseFloat(String(l.weight)) || 0));
                      const avg = bl.length > 0 ? bl.reduce((s, l) => s + (parseFloat(String(l.total_amount)) || 0), 0) / bl.length : 0;
                      return { ...b, count: bl.length, avg };
                    });
                    const maxAvg = Math.max(...bins.map(b => b.avg), 1);
                    return bins.map((b, idx) => (
                      <div key={idx} className="card" style={{ padding: 20, borderLeft: b.avg === maxAvg && b.avg > 0 ? '3px solid var(--accent-primary)' : '3px solid transparent' }}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 12 }}>{b.label}</div>
                        <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 600, color: b.avg === maxAvg && b.avg > 0 ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: 6 }}>{b.avg > 0 ? formatCurrency(b.avg) : '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>avg/trip · {b.count} loads</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}
