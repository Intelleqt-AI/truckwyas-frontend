import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';
import { formatCurrency, formatPercent } from '@/lib/formatters';

// ========== TYPES ==========

interface Signal {
  type: string;
  category: string;
  title: string;
  body: string;
  action?: string;
  action_url?: string;
  severity: 'critical' | 'warning' | 'info';
  created_at: string;
}

interface RouteData {
  route: string;
  trips: number;
  avg_revenue: number;
  avg_cost: number;
  margin_pct: number;
  revenue_per_load?: number;
  fuel_per_km?: number | null;
  avg_days?: number;
}

interface CustomerHealthData {
  customer_name: string;
  customer_id: number;
  revenue: number;
  invoice_count: number;
  avg_payment_days: number;
  dso: number;
  overdue_count: number;
  risk_tier: 'PRIME' | 'STANDARD' | 'AT_RISK';
}

interface FinanceData {
  revenue_period: number;
  expenses_period: number;
  net_margin_period: number;
  net_margin_percent_period: number;
  operating_ratio?: number;
  revenue_per_load?: number;
  outstanding_invoices_total?: number;
  overdue_invoices_total?: number;
  monthly_trend?: { month: string; revenue: number; expenses: number }[];
  expense_breakdown?: Record<string, number>;
  top_customers?: { customer_id: number; customer_name: string; revenue: number; costs?: number; margin_pct?: number; invoice_count: number; avg_payment_days?: number }[];
  previous_period?: {
    revenue: number;
    margin_percent: number;
  };
}

interface FleetData {
  utilisation?: number;
  vehicles?: {
    vehicle_id: number;
    registration: string;
    make_model?: string;
    revenue: number;
    costs?: number;
    margin_pct?: number;
    utilisation?: number;
    trips: number;
    downtime?: number;
  }[];
}

interface DriversData {
  drivers?: {
    driver_id: number;
    driver_name: string;
    revenue: number;
    trips: number;
    otd_pct?: number;
    avg_fuel_per_trip?: number;
    rating?: number;
  }[];
}

interface QuotesData {
  total_quotes?: number;
  conversion_rate?: number;
  avg_quote_value?: number;
  revenue_guard_flag_rate?: number;
  funnel?: {
    quotes_sent: number;
    customer_accepted: number;
    loads_booked: number;
    loads_completed: number;
    invoiced: number;
  };
  revenue_guard?: {
    loads_flagged: number;
    override_rate: number;
    money_saved: number;
    override_losses: number;
  };
  quote_accuracy?: {
    corridor: string;
    quoted_margin: number;
    actual_margin: number;
    variance: number;
    accuracy_score: number;
  }[];
}

interface CashFlowData {
  total_outstanding?: number;
  total_overdue?: number;
  avg_dso?: number;
  next_30d_projected?: number;
  fast_pay_fees_mtd?: number;
  aging_buckets?: {
    current: { amount: number; count: number };
    days_1_30: { amount: number; count: number };
    days_31_60: { amount: number; count: number };
    days_61_90: { amount: number; count: number };
    days_90_plus: { amount: number; count: number };
  };
  customer_payment_health?: CustomerHealthData[];
  cash_flow_forecast?: {
    next_30d: number;
    next_31_60d: number;
    next_61_90d: number;
  };
  fast_pay_summary?: {
    total_fees: number;
    fee_pct_of_revenue: number;
    invoice_count: number;
    avg_discount: number;
  };
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
  const [tab, setTab] = useState<TabType>('command');
  const [period, setPeriod] = useState<PeriodType>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fleetSubTab, setFleetSubTab] = useState<'vehicles' | 'drivers'>('vehicles');

  // Data states per tab
  const [commandData, setCommandData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<FinanceData | null>(null);
  const [lanesData, setLanesData] = useState<RouteData[] | null>(null);
  const [fleetData, setFleetData] = useState<FleetData | null>(null);
  const [driversData, setDriversData] = useState<DriversData | null>(null);
  const [quotesData, setQuotesData] = useState<QuotesData | null>(null);
  const [cashflowData, setCashflowData] = useState<CashFlowData | null>(null);

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
            const [finance, signals, routes, loads] = await Promise.all([
              fetchData(`api/v1/dashboard/finance/?compare=previous_period&${params}`).catch(() => null),
              fetchData(`api/v1/insights/signals/?${params}`).catch(() => ({ signals: [] })),
              fetchData(`api/v1/insights/routes/?${params}`).catch(() => []),
              fetchData('api/v1/loads/?status=in_transit,assigned&limit=1').catch(() => ({ count: 0 })),
            ]);
            setCommandData({ finance, signals: signals?.signals || [], routes, activeLoads: loads?.count || 0 });
            break;

          case 'revenue':
            const revData = await fetchData(`api/v1/dashboard/finance/?compare=previous_period&${params}`).catch(() => null);
            setRevenueData(revData);
            break;

          case 'lanes':
            const routeData = await fetchData(`api/v1/insights/routes/?${params}`).catch(() => []);
            setLanesData(Array.isArray(routeData) ? routeData : routeData?.results || []);
            break;

          case 'fleet':
            const [fleet, drivers] = await Promise.all([
              fetchData(`api/v1/insights/fleet/?${params}`).catch(() => null),
              fetchData(`api/v1/insights/drivers/?${params}`).catch(() => null),
            ]);
            setFleetData(fleet);
            setDriversData(drivers);
            break;

          case 'quotes':
            const qData = await fetchData(`api/v1/insights/quotes/?${params}`).catch(() => null);
            setQuotesData(qData);
            break;

          case 'cashflow':
            const cfData = await fetchData(`api/v1/insights/cashflow/?${params}`).catch(() => null);
            setCashflowData(cfData);
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

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    switch (tab) {
      case 'command':
        filename = 'Command_Centre.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Revenue,${commandData?.finance?.revenue_period || 0}\n`;
        csvContent += `Active Loads,${commandData?.activeLoads || 0}\n`;
        break;

      case 'revenue':
        filename = 'Revenue_Margins.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Gross Revenue,${revenueData?.revenue_period || 0}\n`;
        csvContent += `Net Margin %,${revenueData?.net_margin_percent_period || 0}\n`;
        csvContent += `Operating Ratio,${revenueData?.operating_ratio || 0}\n`;
        break;

      case 'lanes':
        filename = 'Lanes_Routes.csv';
        csvContent = 'Route,Loads,Revenue,Total Cost,Margin%,Rev/Load\n';
        (lanesData || []).forEach((r: RouteData) => {
          csvContent += `${r.route},${r.trips},${r.avg_revenue},${r.avg_cost},${r.margin_pct},${r.revenue_per_load || r.avg_revenue}\n`;
        });
        break;

      case 'fleet':
        if (fleetSubTab === 'vehicles') {
          filename = 'Fleet_Vehicles.csv';
          csvContent = 'Vehicle,Revenue,Costs,Margin%,Utilisation%,Loads\n';
          (fleetData?.vehicles || []).forEach(v => {
            csvContent += `${v.registration},${v.revenue},${v.costs || 0},${v.margin_pct || 0},${v.utilisation || 0},${v.trips}\n`;
          });
        } else {
          filename = 'Fleet_Drivers.csv';
          csvContent = 'Driver,Revenue,Loads,OTD%\n';
          (driversData?.drivers || []).forEach(d => {
            csvContent += `${d.driver_name},${d.revenue},${d.trips},${d.otd_pct || 0}\n`;
          });
        }
        break;

      case 'quotes':
        filename = 'Quotes_Pipeline.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Total Quotes,${quotesData?.total_quotes || 0}\n`;
        csvContent += `Conversion Rate,${quotesData?.conversion_rate || 0}\n`;
        csvContent += `Avg Quote Value,${quotesData?.avg_quote_value || 0}\n`;
        break;

      case 'cashflow':
        filename = 'Cash_Flow.csv';
        csvContent = 'Metric,Value\n';
        csvContent += `Total Outstanding,${cashflowData?.total_outstanding || 0}\n`;
        csvContent += `Overdue,${cashflowData?.total_overdue || 0}\n`;
        csvContent += `Avg DSO,${cashflowData?.avg_dso || 0}\n`;
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const getRiskTierColor = (tier: string) => {
    switch (tier) {
      case 'PRIME': return 'var(--status-success)';
      case 'STANDARD': return 'var(--status-warning)';
      case 'AT_RISK': return 'var(--status-danger)';
      default: return 'var(--text-secondary)';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'var(--status-danger)';
      case 'warning': return 'var(--status-warning)';
      case 'info': return 'var(--status-success)';
      default: return 'var(--text-secondary)';
    }
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
          <button className="btn-action" onClick={exportToCSV}>↓ EXPORT CSV</button>
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
              {/* KPI Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                {(() => {
                  const finance = commandData?.finance;
                  const opRatio = finance?.operating_ratio || (finance?.expenses_period && finance?.revenue_period ? (finance.expenses_period / finance.revenue_period) * 100 : 0) || 0;
                  const fleetUtil = finance?.fleet_utilisation || 0;
                  const opRatioColor = opRatio < 85 ? 'var(--status-success)' : opRatio < 95 ? 'var(--status-warning)' : 'var(--status-danger)';
                  const utilColor = fleetUtil > 70 ? 'var(--status-success)' : fleetUtil > 40 ? 'var(--status-warning)' : 'var(--status-danger)';

                  return [
                    { label: 'Revenue This Month', value: formatCurrency(finance?.revenue_period || 0), color: 'var(--accent-primary)' },
                    { label: 'Operating Ratio', value: `${(opRatio || 0).toFixed(1)}%`, color: opRatioColor },
                    { label: 'Active Loads', value: commandData?.activeLoads || 0, color: 'var(--text-primary)' },
                    { label: 'Outstanding Invoices', value: formatCurrency(finance?.outstanding_invoices_total || 0), color: 'var(--status-warning)' },
                    { label: 'Fleet Utilisation', value: `${(fleetUtil || 0).toFixed(1)}%`, color: utilColor },
                    { label: 'Overdue Invoices', value: formatCurrency(finance?.overdue_invoices_total || 0), color: 'var(--status-danger)' },
                  ].map(m => (
                    <div key={m.label} className="card metric-card">
                      <div className="card-header"><span className="card-title">{m.label}</span></div>
                      <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                    </div>
                  ));
                })()}
              </div>

              {/* Alert Panel */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-header"><span className="card-title">Alerts & Signals</span></div>
                {commandData?.signals && commandData.signals.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    {commandData.signals.map((sig: Signal, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: 2,
                          background: getSeverityColor(sig.severity),
                          color: 'white',
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          height: 'fit-content',
                        }}>
                          {sig.severity}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{sig.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sig.body}</div>
                        </div>
                        {sig.action && (
                          <button className="btn-action" style={{ fontSize: 10, padding: '4px 10px' }}>
                            {sig.action}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 16, color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                    No alerts — your operation looks healthy
                  </div>
                )}
              </div>

              {/* Route Summary */}
              {commandData?.routes && commandData.routes.length > 0 && (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Top Routes by Revenue</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th className="text-right">Trips</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Margin%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commandData.routes.slice(0, 5).map((r: RouteData, idx: number) => (
                        <tr key={idx}>
                          <td>{r.route}</td>
                          <td className="mono text-right">{r.trips}</td>
                          <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatCurrency(r.avg_revenue * r.trips)}
                          </td>
                          <td className="mono text-right" style={{
                            color: r.margin_pct > 15 ? 'var(--status-success)' : r.margin_pct > 5 ? 'var(--status-warning)' : 'var(--status-danger)'
                          }}>
                            {(r.margin_pct || 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVENUE & MARGINS */}
          {tab === 'revenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPI Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Gross Revenue', value: formatCurrency(revenueData?.revenue_period || 0), color: 'var(--accent-primary)' },
                  { label: 'Net Margin %', value: formatPercent(revenueData?.net_margin_percent_period || 0), color: 'var(--status-success)' },
                  { label: 'Operating Ratio', value: `${((revenueData?.operating_ratio || (revenueData?.expenses_period && revenueData?.revenue_period ? (revenueData.expenses_period / revenueData.revenue_period) * 100 : 0)) || 0).toFixed(1)}%`, color: 'var(--text-primary)' },
                  { label: 'Revenue per Load', value: formatCurrency(revenueData?.revenue_per_load || 0), color: 'var(--text-primary)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Period Deltas */}
              {revenueData?.previous_period && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {(() => {
                    const revChange = revenueData.previous_period.revenue > 0
                      ? ((revenueData.revenue_period - revenueData.previous_period.revenue) / revenueData.previous_period.revenue) * 100
                      : 0;
                    const marginChange = (revenueData.net_margin_percent_period || 0) - (revenueData.previous_period.margin_percent || 0);

                    return [
                      { label: 'Revenue Change', value: `${revChange > 0 ? '+' : ''}${revChange.toFixed(1)}%`, color: revChange > 0 ? 'var(--status-success)' : 'var(--status-danger)' },
                      { label: 'Margin Change', value: `${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)}pp`, color: marginChange > 0 ? 'var(--status-success)' : 'var(--status-danger)' },
                    ].map(m => (
                      <div key={m.label} className="card" style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Monthly Trend */}
              {revenueData?.monthly_trend && revenueData.monthly_trend.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header">
                    <span className="card-title">Monthly Trend (Last 6 Months)</span>
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
                    const trend = revenueData.monthly_trend.slice(-6);
                    const maxHeight = 120;
                    const maxValue = Math.max(...trend.map(m => Math.max(m.revenue, m.expenses)));

                    return (
                      <>
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
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Cost Breakdown */}
              {revenueData?.expense_breakdown && Object.keys(revenueData.expense_breakdown).length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><span className="card-title">Cost Breakdown (% of Revenue)</span></div>
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(revenueData.expense_breakdown).map(([category, amount]: [string, any]) => {
                      const pct = revenueData.revenue_period > 0 ? (amount / revenueData.revenue_period) * 100 : 0;
                      return (
                        <div key={category}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{category.replace('_', ' ')}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Margin by Customer */}
              {revenueData?.top_customers && revenueData.top_customers.length > 0 && (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Margin by Customer</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Costs</th>
                        <th className="text-right">Margin%</th>
                        <th className="text-right">Load Count</th>
                        <th className="text-right">Avg Payment Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueData.top_customers.map((c, idx) => {
                        const margin = c.margin_pct || 0;
                        return (
                          <tr key={idx}>
                            <td>{c.customer_name}</td>
                            <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {formatCurrency(c.revenue)}
                            </td>
                            <td className="mono text-right">{formatCurrency(c.costs || 0)}</td>
                            <td className="mono text-right" style={{
                              color: margin < 10 ? 'var(--status-danger)' : 'var(--status-success)',
                              fontWeight: margin < 10 ? 600 : 400
                            }}>
                              {margin.toFixed(1)}%
                            </td>
                            <td className="mono text-right">{c.invoice_count}</td>
                            <td className="mono text-right">{c.avg_payment_days || 0}d</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LANES & ROUTES */}
          {tab === 'lanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {(() => {
                  const lanes = lanesData || [];
                  const bestLane = lanes.length > 0 ? lanes.reduce((a, b) => a.margin_pct > b.margin_pct ? a : b) : null;
                  const worstLane = lanes.length > 0 ? lanes.reduce((a, b) => a.margin_pct < b.margin_pct ? a : b) : null;

                  return [
                    { label: 'Total Lanes', value: lanes.length, color: 'var(--text-primary)' },
                    { label: 'Best Margin Lane', value: bestLane ? `${bestLane.route} (${(bestLane.margin_pct || 0).toFixed(1)}%)` : 'N/A', color: 'var(--status-success)' },
                    { label: 'Worst Margin Lane', value: worstLane ? `${worstLane.route} (${(worstLane.margin_pct || 0).toFixed(1)}%)` : 'N/A', color: 'var(--status-danger)' },
                  ].map(m => (
                    <div key={m.label} className="card metric-card">
                      <div className="card-header"><span className="card-title">{m.label}</span></div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: m.color, marginTop: 8 }}>{m.value}</div>
                    </div>
                  ));
                })()}
              </div>

              {/* Main Table */}
              {lanesData && lanesData.length > 0 ? (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Route Performance</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th className="text-right">Loads</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Total Cost</th>
                        <th className="text-right">Margin%</th>
                        <th className="text-right">Rev/Load</th>
                        <th className="text-right">Fuel/km</th>
                        <th className="text-right">Avg Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lanesData.map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.route}</td>
                          <td className="mono text-right">{r.trips}</td>
                          <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatCurrency(r.avg_revenue * r.trips)}
                          </td>
                          <td className="mono text-right">{formatCurrency(r.avg_cost * r.trips)}</td>
                          <td className="mono text-right" style={{
                            color: r.margin_pct > 15 ? 'var(--status-success)' : r.margin_pct > 5 ? 'var(--status-warning)' : 'var(--status-danger)',
                            fontWeight: 600
                          }}>
                            {(r.margin_pct || 0).toFixed(1)}%
                          </td>
                          <td className="mono text-right">{formatCurrency(r.revenue_per_load || r.avg_revenue)}</td>
                          <td className="mono text-right">{r.fuel_per_km != null ? `R${(r.fuel_per_km || 0).toFixed(2)}` : '—'}</td>
                          <td className="mono text-right">{r.avg_days || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No route data for this period. Routes will appear once loads are completed." />
              )}
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
                  {/* Vehicle Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {(() => {
                      const vehicles = fleetData?.vehicles || [];
                      const avgUtil = vehicles.length > 0 ? vehicles.reduce((sum, v) => sum + (v.utilisation || 0), 0) / vehicles.length : 0;
                      const topVehicle = vehicles.length > 0 ? vehicles.reduce((a, b) => a.revenue > b.revenue ? a : b) : null;

                      return [
                        { label: 'Total Vehicles', value: vehicles.length, color: 'var(--text-primary)' },
                        { label: 'Avg Utilisation', value: `${(avgUtil || 0).toFixed(1)}%`, color: avgUtil > 70 ? 'var(--status-success)' : avgUtil > 40 ? 'var(--status-warning)' : 'var(--status-danger)' },
                        { label: 'Highest Revenue Vehicle', value: topVehicle ? topVehicle.registration : 'N/A', color: 'var(--accent-primary)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title">{m.label}</span></div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: m.color, marginTop: 8 }}>{m.value}</div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Vehicle Table */}
                  {fleetData?.vehicles && fleetData.vehicles.length > 0 ? (
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Vehicle Performance</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Vehicle</th>
                            <th>Make/Model</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">Costs</th>
                            <th className="text-right">Margin%</th>
                            <th className="text-right">Utilisation%</th>
                            <th className="text-right">Loads</th>
                            <th className="text-right">Downtime</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fleetData.vehicles.map((v, idx) => (
                            <tr key={idx}>
                              <td>{v.registration}</td>
                              <td>{v.make_model || '—'}</td>
                              <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {formatCurrency(v.revenue)}
                              </td>
                              <td className="mono text-right">{formatCurrency(v.costs || 0)}</td>
                              <td className="mono text-right">{(v.margin_pct || 0).toFixed(1)}%</td>
                              <td className="mono text-right" style={{
                                color: (v.utilisation || 0) > 70 ? 'var(--status-success)' : (v.utilisation || 0) > 40 ? 'var(--status-warning)' : 'var(--status-danger)'
                              }}>
                                {(v.utilisation || 0).toFixed(1)}%
                              </td>
                              <td className="mono text-right">{v.trips}</td>
                              <td className="mono text-right">{v.downtime || 0}d</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState message="No vehicle data available" />
                  )}
                </>
              ) : (
                <>
                  {/* Driver Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {(() => {
                      const drivers = driversData?.drivers || [];
                      const avgLoads = drivers.length > 0 ? drivers.reduce((sum, d) => sum + d.trips, 0) / drivers.length : 0;
                      const bestOTD = drivers.length > 0 ? drivers.reduce((a, b) => (a.otd_pct || 0) > (b.otd_pct || 0) ? a : b) : null;

                      return [
                        { label: 'Total Drivers', value: drivers.length, color: 'var(--text-primary)' },
                        { label: 'Avg Loads/Driver', value: (avgLoads || 0).toFixed(1), color: 'var(--text-primary)' },
                        { label: 'Best OTD Rate', value: bestOTD ? `${bestOTD.driver_name} (${(bestOTD.otd_pct || 0).toFixed(1)}%)` : 'N/A', color: 'var(--status-success)' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card">
                          <div className="card-header"><span className="card-title">{m.label}</span></div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: m.color, marginTop: 8 }}>{m.value}</div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Driver Table */}
                  {driversData?.drivers && driversData.drivers.length > 0 ? (
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Driver Performance</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Driver</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">Loads</th>
                            <th className="text-right">OTD%</th>
                            <th className="text-right">Avg Fuel/Trip</th>
                            <th className="text-right">Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driversData.drivers.map((d, idx) => (
                            <tr key={idx}>
                              <td>{d.driver_name}</td>
                              <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {formatCurrency(d.revenue)}
                              </td>
                              <td className="mono text-right">{d.trips}</td>
                              <td className="mono text-right" style={{
                                color: (d.otd_pct || 0) > 90 ? 'var(--status-success)' : (d.otd_pct || 0) > 70 ? 'var(--status-warning)' : 'var(--status-danger)'
                              }}>
                                {(d.otd_pct || 0).toFixed(1)}%
                              </td>
                              <td className="mono text-right">{formatCurrency(d.avg_fuel_per_trip || 0)}</td>
                              <td className="mono text-right">{(d.rating || 0).toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState message="No driver data available" />
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 5: QUOTES & PIPELINE */}
          {tab === 'quotes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {quotesData ? (
                <>
                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    {[
                      { label: 'Total Quotes', value: quotesData.total_quotes || 0, color: 'var(--text-primary)' },
                      { label: 'Conversion Rate%', value: `${(quotesData.conversion_rate || 0).toFixed(1)}%`, color: 'var(--status-success)' },
                      { label: 'Avg Quote Value', value: formatCurrency(quotesData.avg_quote_value || 0), color: 'var(--accent-primary)' },
                      { label: 'Revenue Guard Flag Rate%', value: `${(quotesData.revenue_guard_flag_rate || 0).toFixed(1)}%`, color: 'var(--status-warning)' },
                    ].map(m => (
                      <div key={m.label} className="card metric-card">
                        <div className="card-header"><span className="card-title">{m.label}</span></div>
                        <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Conversion Funnel */}
                  {quotesData.funnel && (
                    <div className="card" style={{ padding: 20 }}>
                      <div className="card-header"><span className="card-title">Conversion Funnel</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                        {[
                          { label: 'Quotes Sent', value: quotesData.funnel.quotes_sent },
                          { label: 'Customer Accepted', value: quotesData.funnel.customer_accepted },
                          { label: 'Loads Booked', value: quotesData.funnel.loads_booked },
                          { label: 'Loads Completed', value: quotesData.funnel.loads_completed },
                          { label: 'Invoiced', value: quotesData.funnel.invoiced },
                        ].map((stage, idx, arr) => (
                          <div key={stage.label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{stage.label}</div>
                              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{stage.value}</div>
                            </div>
                            {idx < arr.length - 1 && <div style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>→</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revenue Guard Performance */}
                  {quotesData.revenue_guard && (
                    <div className="card" style={{ padding: 20 }}>
                      <div className="card-header"><span className="card-title">Revenue Guard Performance</span></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
                        {[
                          { label: 'Loads Flagged', value: quotesData.revenue_guard.loads_flagged },
                          { label: 'Override Rate%', value: `${quotesData.revenue_guard.override_rate.toFixed(1)}%` },
                          { label: 'Money Saved', value: formatCurrency(quotesData.revenue_guard.money_saved) },
                          { label: 'Override Losses', value: formatCurrency(quotesData.revenue_guard.override_losses) },
                        ].map(m => (
                          <div key={m.label}>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{m.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quote Accuracy */}
                  {quotesData.quote_accuracy && quotesData.quote_accuracy.length > 0 && (
                    <div className="card table-card">
                      <div className="card-header" style={{ marginBottom: 16 }}>
                        <span className="card-title">Quote Accuracy</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Corridor</th>
                            <th className="text-right">Quoted Margin</th>
                            <th className="text-right">Actual Margin</th>
                            <th className="text-right">Variance</th>
                            <th className="text-right">Accuracy Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotesData.quote_accuracy.map((q, idx) => (
                            <tr key={idx}>
                              <td>{q.corridor}</td>
                              <td className="mono text-right">{q.quoted_margin.toFixed(1)}%</td>
                              <td className="mono text-right">{q.actual_margin.toFixed(1)}%</td>
                              <td className="mono text-right" style={{
                                color: q.variance < 0 ? 'var(--status-danger)' : 'var(--status-success)'
                              }}>
                                {q.variance > 0 ? '+' : ''}{q.variance.toFixed(1)}%
                              </td>
                              <td className="mono text-right">{q.accuracy_score.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState message="Quote analytics will appear once the AI Quoting Engine processes your first quote." />
              )}
            </div>
          )}

          {/* TAB 6: CASH FLOW */}
          {tab === 'cashflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Outstanding', value: formatCurrency(cashflowData?.total_outstanding || 0), color: 'var(--accent-primary)' },
                  { label: 'Overdue', value: formatCurrency(cashflowData?.total_overdue || 0), color: 'var(--status-danger)' },
                  { label: 'Avg DSO', value: `${Math.round(cashflowData?.avg_dso || 0)}d`, color: 'var(--text-primary)' },
                  { label: 'Next 30d Projected', value: formatCurrency(cashflowData?.next_30d_projected || 0), color: 'var(--status-success)' },
                  { label: 'Fast Pay Fees MTD', value: formatCurrency(cashflowData?.fast_pay_fees_mtd || 0), color: 'var(--status-warning)' },
                ].map(m => (
                  <div key={m.label} className="card metric-card">
                    <div className="card-header"><span className="card-title">{m.label}</span></div>
                    <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Invoice Aging Buckets */}
              {cashflowData?.aging_buckets && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><span className="card-title">Invoice Aging</span></div>
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Current', data: cashflowData.aging_buckets.current, color: 'var(--status-success)' },
                      { label: '1-30d', data: cashflowData.aging_buckets.days_1_30, color: 'var(--status-warning)' },
                      { label: '31-60d', data: cashflowData.aging_buckets.days_31_60, color: 'var(--status-warning)' },
                      { label: '61-90d', data: cashflowData.aging_buckets.days_61_90, color: 'var(--status-danger)' },
                      { label: '90d+', data: cashflowData.aging_buckets.days_90_plus, color: 'var(--status-danger)' },
                    ].map(bucket => {
                      const totalAmount = Object.values(cashflowData.aging_buckets!).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
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
              )}

              {/* Customer Payment Health */}
              {cashflowData?.customer_payment_health && cashflowData.customer_payment_health.length > 0 && (
                <div className="card table-card">
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <span className="card-title">Customer Payment Health</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Invoices</th>
                        <th className="text-right">Avg Pay Days</th>
                        <th className="text-right">DSO</th>
                        <th className="text-right">Overdue Count</th>
                        <th className="text-right">Risk Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflowData.customer_payment_health.map((c, idx) => (
                        <tr key={idx}>
                          <td>{c.customer_name}</td>
                          <td className="mono text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatCurrency(c.revenue)}
                          </td>
                          <td className="mono text-right">{c.invoice_count}</td>
                          <td className="mono text-right">{c.avg_payment_days}d</td>
                          <td className="mono text-right">{c.dso}d</td>
                          <td className="mono text-right" style={{
                            color: c.overdue_count > 0 ? 'var(--status-danger)' : 'var(--text-tertiary)'
                          }}>
                            {c.overdue_count}
                          </td>
                          <td className="text-right">
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              color: getRiskTierColor(c.risk_tier),
                              padding: '2px 6px',
                              background: 'var(--bg-surface-hover)',
                              borderRadius: 2
                            }}>
                              {c.risk_tier}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Cash Flow Forecast */}
              {cashflowData?.cash_flow_forecast && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Next 30d', value: formatCurrency(cashflowData.cash_flow_forecast.next_30d) },
                    { label: 'Next 31-60d', value: formatCurrency(cashflowData.cash_flow_forecast.next_31_60d) },
                    { label: 'Next 61-90d', value: formatCurrency(cashflowData.cash_flow_forecast.next_61_90d) },
                  ].map(m => (
                    <div key={m.label} className="card" style={{ padding: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{m.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fast Pay Cost Summary */}
              {cashflowData?.fast_pay_summary && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-header"><span className="card-title">Fast Pay Cost Summary</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
                    {[
                      { label: 'Total Fast Pay Fees', value: formatCurrency(cashflowData.fast_pay_summary.total_fees) },
                      { label: 'As % of Revenue', value: `${cashflowData.fast_pay_summary.fee_pct_of_revenue.toFixed(2)}%` },
                      { label: 'Count of Invoices', value: cashflowData.fast_pay_summary.invoice_count },
                      { label: 'Avg Discount', value: `${cashflowData.fast_pay_summary.avg_discount.toFixed(2)}%` },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
