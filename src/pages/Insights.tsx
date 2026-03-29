import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

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

type TabType = 'briefing' | 'profitability' | 'cash' | 'fleet' | 'lanes';
type PeriodType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_6M' | 'LAST_12M' | 'CUSTOM';

const TABS = [
  { id: 'briefing' as TabType, label: 'Briefing' },
  { id: 'profitability' as TabType, label: 'Profitability' },
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
            const [kpi, insights, loadsResp, invoicesResp] = await Promise.all([
              fetchData('api/v1/dashboard/kpi/').catch(() => null),
              fetchData('api/v1/dashboard/insights/').catch(() => ({ recommendations: [] })),
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
              fetchData('api/v1/invoices/?page_size=100').catch(() => ({ results: [] })),
            ]);
            setKpiData(kpi);
            setInsightsData(insights);
            setLoads(loadsResp?.results || []);
            setInvoices(invoicesResp?.results || []);
            break;

          case 'profitability':
            const [finance, loadsData, expensesData, vehiclesData, driversData] = await Promise.all([
              fetchData(`api/v1/dashboard/finance/?${params}`).catch(() => null),
              fetchData('api/v1/loads/?page_size=100').catch(() => ({ results: [] })),
              fetchData('api/v1/expenses/?page_size=100').catch(() => ({ results: [] })),
              fetchData('api/v1/vehicles/?page_size=50').catch(() => ({ results: [] })),
              fetchData('api/v1/drivers/?page_size=50').catch(() => ({ results: [] })),
            ]);
            setFinanceData(finance);
            setLoads(loadsData?.results || []);
            setExpenses(expensesData?.results || []);
            setVehicles((vehiclesData?.results || []).map((v: any) => ({
              ...v,
              uptime_percentage: parseFloat(v.uptime_percentage || '0'),
              cost_per_km: parseFloat(v.cost_per_km || '0'),
              margin_per_trip: parseFloat(v.margin_per_trip || '0'),
              capacity: parseFloat(v.capacity || '0'),
              mileage: parseFloat(v.mileage || '0'),
            })));
            setDrivers(driversData?.results || []);
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
              capacity: parseFloat(v.capacity || '0'),
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
  const getSeverityDot = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: '#ff0000',
      HIGH: '#ff0000',
      MEDIUM: '#ff9500',
      LOW: '#00ff00',
    };
    return colors[severity] || '#999999';
  };

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

  // Calculate route profitability
  const getRouteProfitability = () => {
    const routeMap = new Map<string, { trips: number; totalRevenue: number; totalDistance: number }>();

    loads.forEach(load => {
      const route = `${load.pickup_city} → ${load.delivery_city}`;
      const existing = routeMap.get(route) || { trips: 0, totalRevenue: 0, totalDistance: 0 };
      routeMap.set(route, {
        trips: existing.trips + 1,
        totalRevenue: existing.totalRevenue + load.total_amount,
        totalDistance: existing.totalDistance + load.distance,
      });
    });

    return Array.from(routeMap.entries())
      .map(([route, data]) => ({
        route,
        trips: data.trips,
        totalRevenue: data.totalRevenue,
        avgRevenue: data.totalRevenue / data.trips,
        revenuePerKm: data.totalDistance > 0 ? data.totalRevenue / data.totalDistance : 0,
      }))
      .sort((a, b) => b.revenuePerKm - a.revenuePerKm)
      .slice(0, 10);
  };

  // Calculate cargo intelligence
  const getCargoIntelligence = () => {
    const cargoMap = new Map<string, { count: number; totalRevenue: number }>();

    loads.forEach(load => {
      const cargo = load.cargo_description?.split(' ').slice(0, 2).join(' ') || 'Unknown';
      const existing = cargoMap.get(cargo) || { count: 0, totalRevenue: 0 };
      cargoMap.set(cargo, {
        count: existing.count + 1,
        totalRevenue: existing.totalRevenue + load.total_amount,
      });
    });

    return Array.from(cargoMap.entries())
      .map(([cargo, data]) => ({
        cargo,
        tripCount: data.count,
        totalRevenue: data.totalRevenue,
        avgRevenue: data.totalRevenue / data.count,
      }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue)
      .slice(0, 10);
  };

  // Calculate weight bins
  const getWeightBins = () => {
    const bins = {
      under5: { count: 0, totalRevenue: 0 },
      '5to10': { count: 0, totalRevenue: 0 },
      '10to20': { count: 0, totalRevenue: 0 },
      over20: { count: 0, totalRevenue: 0 },
    };

    loads.forEach(load => {
      const weight = load.weight;
      const amount = load.total_amount;

      if (weight < 5) {
        bins.under5.count++;
        bins.under5.totalRevenue += amount;
      } else if (weight < 10) {
        bins['5to10'].count++;
        bins['5to10'].totalRevenue += amount;
      } else if (weight < 20) {
        bins['10to20'].count++;
        bins['10to20'].totalRevenue += amount;
      } else {
        bins.over20.count++;
        bins.over20.totalRevenue += amount;
      }
    });

    return [
      { label: 'Under 5t', ...bins.under5, avg: bins.under5.count > 0 ? bins.under5.totalRevenue / bins.under5.count : 0 },
      { label: '5-10t', ...bins['5to10'], avg: bins['5to10'].count > 0 ? bins['5to10'].totalRevenue / bins['5to10'].count : 0 },
      { label: '10-20t', ...bins['10to20'], avg: bins['10to20'].count > 0 ? bins['10to20'].totalRevenue / bins['10to20'].count : 0 },
      { label: '20t+', ...bins.over20, avg: bins.over20.count > 0 ? bins.over20.totalRevenue / bins.over20.count : 0 },
    ];
  };

  // Calculate invoice aging
  const getInvoiceAging = () => {
    const now = new Date();
    const buckets = {
      current: { count: 0, amount: 0 },
      '1to30': { count: 0, amount: 0 },
      '31to60': { count: 0, amount: 0 },
      '60plus': { count: 0, amount: 0 },
    };

    invoices.forEach(inv => {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = inv.balance;

      if (daysOverdue <= 0) {
        buckets.current.count++;
        buckets.current.amount += amount;
      } else if (daysOverdue <= 30) {
        buckets['1to30'].count++;
        buckets['1to30'].amount += amount;
      } else if (daysOverdue <= 60) {
        buckets['31to60'].count++;
        buckets['31to60'].amount += amount;
      } else {
        buckets['60plus'].count++;
        buckets['60plus'].amount += amount;
      }
    });

    const total = buckets.current.amount + buckets['1to30'].amount + buckets['31to60'].amount + buckets['60plus'].amount;

    return [
      { label: 'Current', ...buckets.current, pct: total > 0 ? (buckets.current.amount / total) * 100 : 0, color: 'var(--status-success)' },
      { label: '1-30 days', ...buckets['1to30'], pct: total > 0 ? (buckets['1to30'].amount / total) * 100 : 0, color: 'var(--status-warning)' },
      { label: '31-60 days', ...buckets['31to60'], pct: total > 0 ? (buckets['31to60'].amount / total) * 100 : 0, color: 'var(--status-danger)' },
      { label: '60+ days', ...buckets['60plus'], pct: total > 0 ? (buckets['60plus'].amount / total) * 100 : 0, color: 'var(--status-danger)' },
    ];
  };

  // Calculate expense categories
  const getExpenseCategories = () => {
    const categoryMap = new Map<string, number>();
    let total = 0;

    expenses.forEach(exp => {
      const existing = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, existing + exp.amount);
      total += exp.amount;
    });

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  };

  const SectionHeader = ({ children }: { children: string }) => (
    <div style={{
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-tertiary)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 12,
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
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
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
        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : (
        <>
          {/* TAB 1: BRIEFING */}
          {tab === 'briefing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: BUSINESS HEALTH */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>BUSINESS HEALTH</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {/* Revenue Momentum */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Revenue Momentum</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {kpiData?.revenue_change_pct !== undefined ? (
                        <span style={{ color: kpiData.revenue_change_pct >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                          {kpiData.revenue_change_pct >= 0 ? '+' : ''}{kpiData.revenue_change_pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {kpiData?.revenue_change_pct !== undefined && kpiData.revenue_change_pct >= 0 ? 'Up vs last month' : 'Down — investigate'}
                    </div>
                  </div>

                  {/* Margin Health */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Margin Health</div>
                    <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: getMarginColor(kpiData?.net_margin_pct || 0) }}>
                        {(kpiData?.net_margin_pct || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {(kpiData?.net_margin_pct || 0) > 50 ? 'Healthy' : (kpiData?.net_margin_pct || 0) >= 30 ? 'Watch fuel costs' : 'Margin under pressure'}
                    </div>
                  </div>

                  {/* Cash Risk */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Cash Risk</div>
                    <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: getDSOColor(kpiData?.dso || 0) }}>
                        {Math.round(kpiData?.dso || 0)}d
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {(kpiData?.dso || 0) < 30 ? `Collecting in ${Math.round(kpiData?.dso || 0)} days avg` : `Slow payments — ${Math.round(kpiData?.dso || 0)} days avg`}
                    </div>
                  </div>

                  {/* Fleet Pulse */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Fleet Pulse</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {(kpiData?.fleet_utilization_pct || 0).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {(kpiData?.fleet_utilization_pct || 0).toFixed(0)}% of fleet earning today
                    </div>
                  </div>

                  {/* Fast Pay Signal */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Fast Pay Signal</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 4 }}>
                      {formatCurrency(kpiData?.total_advance_amount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {formatCurrency(kpiData?.total_advance_amount || 0)} available via Fast Pay
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: ALERTS REQUIRING ACTION */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>ALERTS REQUIRING ACTION</SectionHeader>
                {insightsData?.recommendations && insightsData.recommendations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {insightsData.recommendations.map((rec, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        background: 'var(--bg-surface)',
                        borderRadius: 2,
                      }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: getSeverityDot(rec.severity),
                          animation: rec.severity === 'CRITICAL' ? 'pulse 1.5s infinite' : 'none',
                        }} />
                        <div style={{
                          padding: '2px 6px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 2,
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                        }}>
                          {rec.type.replace(/_/g, ' ')}
                        </div>
                        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                          {rec.message}
                        </div>
                        {rec.days_overdue && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {rec.days_overdue}d
                          </div>
                        )}
                        {rec.amount && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(rec.amount)}
                          </div>
                        )}
                        {rec.link && (
                          <button
                            onClick={() => navigate(rec.link || '#')}
                            style={{
                              padding: '4px 10px',
                              background: 'var(--accent-primary)',
                              border: 'none',
                              borderRadius: 2,
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--bg-deep)',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            ACTION
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: 20,
                    textAlign: 'center',
                    background: 'var(--status-success)',
                    color: 'white',
                    borderRadius: 2,
                    fontSize: 13,
                  }}>
                    No alerts — all systems normal
                  </div>
                )}
              </div>

              {/* Section C: WHAT'S HAPPENING RIGHT NOW */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>WHAT&apos;S HAPPENING RIGHT NOW</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const inTransit = loads.filter(l => l.status.toLowerCase() === 'in_transit' || l.status.toLowerCase() === 'in transit');
                    const inTransitRevenue = inTransit.reduce((sum, l) => sum + l.total_amount, 0);

                    const routeRevenue = new Map<string, number>();
                    loads.forEach(l => {
                      const route = `${l.pickup_city} → ${l.delivery_city}`;
                      routeRevenue.set(route, (routeRevenue.get(route) || 0) + l.total_amount);
                    });
                    const topRoute = Array.from(routeRevenue.entries()).sort((a, b) => b[1] - a[1])[0];

                    const overdue = invoices.filter(inv => {
                      const dueDate = new Date(inv.due_date);
                      return dueDate < new Date() && inv.balance > 0;
                    });
                    const overdueTotal = overdue.reduce((sum, inv) => sum + inv.balance, 0);
                    const maxOverdue = overdue.reduce((max, inv) => {
                      const days = Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
                      return Math.max(max, days);
                    }, 0);

                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
                            {inTransit.length} loads in transit representing {formatCurrency(inTransitRevenue)} in revenue
                          </div>
                          <button
                            onClick={() => navigate('/loads')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            VIEW LOADS →
                          </button>
                        </div>
                        {topRoute && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
                              Your top route this period: {topRoute[0]} — {formatCurrency(topRoute[1])}
                            </div>
                            <button
                              onClick={() => setTab('lanes')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              VIEW LANES →
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
                            {overdue.length} invoices overdue totalling {formatCurrency(overdueTotal)} — {maxOverdue} days oldest
                          </div>
                          <button
                            onClick={() => navigate('/invoices')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            VIEW INVOICES →
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFITABILITY */}
          {tab === 'profitability' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: P&L AT A GLANCE */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>P&L AT A GLANCE</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Revenue Period</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {formatCurrency(financeData?.revenue_period || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Total Costs</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--status-danger)' }}>
                      {formatCurrency(financeData?.expenses_period || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Net Margin R</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(financeData?.net_margin_period || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Net Margin %</div>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>
                      <span style={{ color: getMarginColor(financeData?.net_margin_percent_period || 0) }}>
                        {(financeData?.net_margin_percent_period || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: MONTHLY TREND */}
              {financeData?.monthly_trend && financeData.monthly_trend.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <SectionHeader>MONTHLY TREND</SectionHeader>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const maxValue = Math.max(...financeData.monthly_trend.map(m => Math.max(m.revenue, m.expenses)));
                      const trend = financeData.monthly_trend.slice(-6);
                      const isImproving = trend.length >= 2 && trend[trend.length - 1].margin > trend[trend.length - 2].margin;

                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Trend:</span>
                            <span style={{ fontSize: 13, color: isImproving ? 'var(--status-success)' : 'var(--status-danger)' }}>
                              {isImproving ? '↑ Improving' : '↓ Declining'}
                            </span>
                          </div>
                          {trend.map((m, idx) => {
                            const revWidth = (m.revenue / maxValue) * 100;
                            const expWidth = (m.expenses / maxValue) * 100;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 60, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                  {m.month.slice(5)}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ height: 12, background: 'var(--accent-primary)', width: `${revWidth}%`, borderRadius: 2 }} />
                                  <div style={{ height: 12, background: 'var(--status-danger)', width: `${expWidth}%`, borderRadius: 2, opacity: 0.7 }} />
                                </div>
                                <div style={{
                                  width: 100,
                                  textAlign: 'right',
                                  fontSize: 13,
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 600,
                                  color: m.margin > 0 ? 'var(--status-success)' : 'var(--status-danger)'
                                }}>
                                  {formatCurrency(m.margin)}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Section C: CUSTOMER PROFITABILITY */}
              {financeData?.top_customers && financeData.top_customers.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <SectionHeader>REVENUE CONCENTRATION RISK</SectionHeader>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const totalRevenue = financeData.top_customers.reduce((sum, c) => sum + c.revenue, 0);
                      const top3Revenue = financeData.top_customers.slice(0, 3).reduce((sum, c) => sum + c.revenue, 0);
                      const top3Pct = (top3Revenue / totalRevenue) * 100;
                      const topCustomerPct = (financeData.top_customers[0].revenue / totalRevenue) * 100;

                      return (
                        <>
                          {topCustomerPct > 40 && (
                            <div style={{
                              padding: 12,
                              background: 'var(--status-warning)',
                              color: 'white',
                              borderRadius: 2,
                              fontSize: 13,
                              marginBottom: 8,
                            }}>
                              ⚠ High concentration risk: top customer represents {topCustomerPct.toFixed(1)}% of revenue
                            </div>
                          )}
                          {financeData.top_customers.slice(0, 5).map((c, idx) => {
                            const pct = (c.revenue / totalRevenue) * 100;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 200, fontSize: 13, color: 'var(--text-primary)' }}>
                                  {c.customer_name}
                                </div>
                                <div style={{ flex: 1, height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
                                </div>
                                <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                  {pct.toFixed(1)}%
                                </div>
                                <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {formatCurrency(c.revenue)}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                            Your top 3 customers represent {top3Pct.toFixed(1)}% of revenue — {top3Pct > 60 ? 'High risk' : top3Pct > 40 ? 'Moderate risk' : 'Healthy diversification'}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Section D: COST STRUCTURE */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>COST STRUCTURE</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const categories = getExpenseCategories();
                    const total = categories.reduce((sum, c) => sum + c.amount, 0);

                    return (
                      <>
                        {categories.map((cat, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 120, fontSize: 13, color: 'var(--text-primary)' }}>
                              {cat.category}
                            </div>
                            <div style={{ flex: 1, height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${cat.pct}%`, background: 'var(--status-danger)', borderRadius: 2, opacity: 0.8 }} />
                            </div>
                            <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatCurrency(cat.amount)}
                            </div>
                            <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {cat.pct.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                        {financeData?.fuel_cost_ratio !== undefined && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                            Fuel cost ratio: {(financeData.fuel_cost_ratio * 100).toFixed(1)}% of revenue
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CASH INTELLIGENCE */}
          {tab === 'cash' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: CASH POSITION FORECAST */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>CASH POSITION FORECAST</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Next 30 days</div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      <span style={{ color: (financeData?.cash_flow_forecast?.next_30_days || 0) >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {formatCurrency(financeData?.cash_flow_forecast?.next_30_days || 0)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Expected Net Cash In</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Next 60 days</div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      <span style={{ color: (financeData?.cash_flow_forecast?.next_60_days || 0) >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {formatCurrency(financeData?.cash_flow_forecast?.next_60_days || 0)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Expected Net Cash In</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Next 90 days</div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      <span style={{ color: (financeData?.cash_flow_forecast?.next_90_days || 0) >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {formatCurrency(financeData?.cash_flow_forecast?.next_90_days || 0)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Expected Net Cash In</div>
                  </div>
                </div>
              </div>

              {/* Section B: WEEKLY CASH FLOW */}
              {cashflowData?.forecast && cashflowData.forecast.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <SectionHeader>WEEKLY CASH FLOW</SectionHeader>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200, position: 'relative' }}>
                    {/* Baseline */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--border-subtle)' }} />
                    {(() => {
                      const maxAbs = Math.max(...cashflowData.forecast.map(f => Math.abs(f.net)));
                      let runningTotal = 0;

                      return cashflowData.forecast.map((f, idx) => {
                        runningTotal += f.net;
                        const heightPct = maxAbs > 0 ? (Math.abs(f.net) / maxAbs) * 50 : 0;
                        const isPositive = f.net >= 0;

                        return (
                          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{
                              position: 'absolute',
                              bottom: '50%',
                              width: '70%',
                              height: isPositive ? `${heightPct}%` : 0,
                              background: 'var(--accent-primary)',
                              borderRadius: '2px 2px 0 0',
                            }} />
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              width: '70%',
                              height: !isPositive ? `${heightPct}%` : 0,
                              background: 'var(--status-danger)',
                              borderRadius: '0 0 2px 2px',
                            }} />
                            <div style={{
                              position: 'absolute',
                              bottom: -30,
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-tertiary)',
                              whiteSpace: 'nowrap',
                            }}>
                              {f.period}
                            </div>
                            <div style={{
                              position: 'absolute',
                              bottom: -50,
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: isPositive ? 'var(--status-success)' : 'var(--status-danger)',
                            }}>
                              {formatCurrency(f.net)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ marginTop: 60, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Running total: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(cashflowData.forecast.reduce((sum, f) => sum + f.net, 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Section C: INVOICE AGING INTELLIGENCE */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>INVOICE AGING INTELLIGENCE</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
                  {getInvoiceAging().map((bucket, idx) => (
                    <div key={idx} style={{
                      padding: 16,
                      background: 'var(--bg-surface)',
                      borderRadius: 2,
                      borderLeft: `4px solid ${bucket.color}`,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{bucket.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: bucket.color, marginBottom: 4 }}>
                        {formatCurrency(bucket.amount)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {bucket.count} invoices · {bucket.pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                  DSO of {Math.round(financeData?.dso || 0)} days means you wait {Math.round((financeData?.dso || 0) / 7)} weeks on average to collect
                </div>
              </div>

              {/* Section D: FAST PAY OPPORTUNITY */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>FAST PAY OPPORTUNITY</SectionHeader>
                {(() => {
                  const eligibleInvoices = invoices.filter(inv => inv.early_pay_eligible);
                  const totalEligible = eligibleInvoices.reduce((sum, inv) => sum + inv.balance, 0);

                  return eligibleInvoices.length > 0 ? (
                    <div style={{
                      padding: 24,
                      background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                      borderRadius: 4,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        {formatCurrency(totalEligible)}
                      </div>
                      <div style={{ fontSize: 15, color: 'white', marginBottom: 20, opacity: 0.9 }}>
                        Unlock {formatCurrency(totalEligible)} today via Fast Pay — stop waiting 30-90 days
                      </div>
                      <div style={{ fontSize: 12, color: 'white', marginBottom: 20, opacity: 0.8 }}>
                        {eligibleInvoices.length} invoices eligible
                      </div>
                      <button
                        onClick={() => navigate('/capital')}
                        style={{
                          padding: '12px 24px',
                          background: 'white',
                          border: 'none',
                          borderRadius: 2,
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        UNLOCK NOW →
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      No invoices currently eligible for Fast Pay
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: FLEET INTELLIGENCE */}
          {tab === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: FLEET SCORECARD */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>FLEET SCORECARD</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Active Vehicles</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vehicles.filter(v => v.status === 'ACTIVE' || v.status === 'Active').length}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Avg Health Score</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vehicles.length > 0 ? (vehicles.reduce((sum, v) => sum + (v.ai_health_score || 0), 0) / vehicles.length).toFixed(0) : 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Avg Utilisation %</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vehicles.length > 0 ? (vehicles.reduce((sum, v) => sum + (v.uptime_percentage || 0), 0) / vehicles.length).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Vehicles Needing Attention</div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      <span style={{ color: 'var(--status-danger)' }}>
                        {vehicles.filter(v => (v.ai_health_score || 100) < 60).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: VEHICLE PERFORMANCE RANKING */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>VEHICLE PERFORMANCE RANKING</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...vehicles].sort((a, b) => b.revenue_generated - a.revenue_generated).map((v, idx) => {
                    const isTopEarner = idx === 0;
                    const needsAttention = (v.ai_health_score || 100) < 60;
                    const isBottomTwo = idx >= vehicles.length - 2;

                    return (
                      <div key={v.id}>
                        <div
                          onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            background: isTopEarner ? 'var(--status-success)' : needsAttention ? 'var(--status-danger)' : 'var(--bg-surface)',
                            color: isTopEarner || needsAttention ? 'white' : 'var(--text-primary)',
                            borderRadius: 2,
                            cursor: 'pointer',
                            opacity: isTopEarner || needsAttention ? 0.9 : 1,
                          }}
                        >
                          <div style={{ width: 30, fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>#{idx + 1}</div>
                          <div style={{ width: 120, fontSize: 13, fontWeight: 500 }}>{v.plate}</div>
                          <div style={{ width: 150, fontSize: 12, opacity: 0.8 }}>{v.make} {v.model}</div>
                          <div style={{
                            padding: '2px 6px',
                            background: isTopEarner || needsAttention ? 'rgba(255,255,255,0.2)' : 'var(--bg-surface-hover)',
                            borderRadius: 2,
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                          }}>
                            {v.status}
                          </div>
                          <div style={{ flex: 1 }} />
                          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {formatCurrency(v.revenue_generated)}
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(v.cost_per_km)}/km
                          </div>
                          <div style={{ width: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              flex: 1,
                              height: 6,
                              background: isTopEarner || needsAttention ? 'rgba(255,255,255,0.3)' : 'var(--bg-surface-hover)',
                              borderRadius: 3,
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${v.ai_health_score}%`,
                                height: '100%',
                                background: isTopEarner || needsAttention ? 'white' : v.ai_health_score > 70 ? 'var(--status-success)' : v.ai_health_score > 40 ? 'var(--status-warning)' : 'var(--status-danger)',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{v.ai_health_score}%</span>
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                            {v.uptime_percentage?.toFixed(1)}%
                          </div>
                        </div>
                        {isBottomTwo && v.cost_per_km > v.margin_per_trip && (
                          <div style={{ fontSize: 11, color: 'var(--status-danger)', marginLeft: 54, marginTop: 4 }}>
                            ⚠ This vehicle costs more to run than its revenue suggests — review
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section C: DRIVER PERFORMANCE RANKING */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>DRIVER PERFORMANCE RANKING</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...drivers].sort((a, b) => b.revenue_generated - a.revenue_generated).map((d, idx) => (
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
                      <div style={{ width: 30, fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>#{idx + 1}</div>
                      <div style={{ width: 180, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{d.user_details.name}</div>
                      <div style={{
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2,
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}>
                        {d.status}
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {formatCurrency(d.revenue_generated)}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {formatCurrency(d.avg_revenue_per_trip)}/trip
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {d.total_trips} trips
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {d.experience_years}y exp
                      </div>
                      {(d.violation_count > 0 || d.accident_history > 0) && (
                        <div style={{ fontSize: 11, color: 'var(--status-danger)' }}>
                          {d.violation_count > 0 && `⚠ ${d.violation_count} violations`}
                          {d.violation_count > 0 && d.accident_history > 0 && ', '}
                          {d.accident_history > 0 && `⚠ ${d.accident_history} accidents`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section D: COST PER KM ANALYSIS */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>COST PER KM ANALYSIS</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                  {/* Industry benchmark line */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1, background: 'var(--accent-primary)', opacity: 0.3 }} />
                    <div style={{ position: 'absolute', left: '60%', top: 0, fontSize: 10, color: 'var(--accent-primary)', transform: 'translateX(4px)' }}>
                      R18/km benchmark
                    </div>
                  </div>
                  {(() => {
                    const maxCost = Math.max(...vehicles.map(v => v.cost_per_km), 18);
                    return [...vehicles].sort((a, b) => b.cost_per_km - a.cost_per_km).map((v, idx) => {
                      const widthPct = (v.cost_per_km / maxCost) * 100;
                      const aboveBenchmark = v.cost_per_km > 18;

                      return (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 100, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            {v.plate}
                          </div>
                          <div style={{ flex: 1, height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${widthPct}%`,
                              background: aboveBenchmark ? 'var(--status-danger)' : 'var(--status-success)',
                              borderRadius: 2,
                            }} />
                          </div>
                          <div style={{
                            width: 80,
                            textAlign: 'right',
                            fontSize: 13,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: aboveBenchmark ? 'var(--status-danger)' : 'var(--text-primary)'
                          }}>
                            {formatCurrency(v.cost_per_km)}/km
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LANES & LOAD INTELLIGENCE */}
          {tab === 'lanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section A: ROUTE PROFITABILITY */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>ROUTE PROFITABILITY</SectionHeader>
                {(() => {
                  const routes = getRouteProfitability();
                  const maxRevPerKm = Math.max(...routes.map(r => r.revenuePerKm), 1);

                  return routes.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {routes.map((r, idx) => {
                          const widthPct = (r.revenuePerKm / maxRevPerKm) * 100;
                          const isTop3 = idx < 3;
                          const isBottom3 = idx >= routes.length - 3;

                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 250, fontSize: 13, color: 'var(--text-primary)' }}>
                                {r.route}
                              </div>
                              <div style={{ flex: 1, height: 24, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${widthPct}%`,
                                  background: isTop3 ? 'var(--status-success)' : isBottom3 ? 'var(--status-danger)' : 'var(--accent-primary)',
                                  borderRadius: 2,
                                }} />
                              </div>
                              <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {formatCurrency(r.revenuePerKm)}/km
                              </div>
                              <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                {r.trips} trips
                              </div>
                              <div style={{ width: 120, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                {formatCurrency(r.totalRevenue)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Your most efficient route is {routes[0].route} at {formatCurrency(routes[0].revenuePerKm)}/km
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      No route data for this period
                    </div>
                  );
                })()}
              </div>

              {/* Section B: LOAD STATUS INTELLIGENCE */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>LOAD STATUS INTELLIGENCE</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                  {(() => {
                    const delivered = loads.filter(l => l.status.toLowerCase() === 'delivered' || l.status.toLowerCase() === 'completed');
                    const inTransit = loads.filter(l => l.status.toLowerCase() === 'in_transit' || l.status.toLowerCase() === 'in transit');
                    const pending = loads.filter(l => l.status.toLowerCase() === 'pending' || l.status.toLowerCase() === 'draft');

                    const deliveredRevenue = delivered.reduce((sum, l) => sum + l.total_amount, 0);
                    const inTransitRevenue = inTransit.reduce((sum, l) => sum + l.total_amount, 0);
                    const pendingRevenue = pending.reduce((sum, l) => sum + l.total_amount, 0);

                    const total = loads.length;
                    const deliveredPct = total > 0 ? (delivered.length / total) * 100 : 0;

                    return (
                      <>
                        <div style={{ padding: 16, background: 'var(--status-success)', color: 'white', borderRadius: 2 }}>
                          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>DELIVERED & INVOICED</div>
                          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{deliveredPct.toFixed(0)}%</div>
                          <div style={{ fontSize: 13, opacity: 0.9 }}>
                            {delivered.length} loads — {formatCurrency(deliveredRevenue)} revenue realised
                          </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--accent-primary)', color: 'white', borderRadius: 2 }}>
                          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>IN TRANSIT</div>
                          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{inTransit.length}</div>
                          <div style={{ fontSize: 13, opacity: 0.9 }}>
                            {formatCurrency(inTransitRevenue)} revenue in motion
                          </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--text-secondary)', color: 'white', borderRadius: 2 }}>
                          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>PENDING DISPATCH</div>
                          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{pending.length}</div>
                          <div style={{ fontSize: 13, opacity: 0.9 }}>
                            {formatCurrency(pendingRevenue)} pipeline
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Section C: CARGO INTELLIGENCE */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>CARGO INTELLIGENCE</SectionHeader>
                {(() => {
                  const cargo = getCargoIntelligence();
                  const maxAvg = Math.max(...cargo.map(c => c.avgRevenue), 1);

                  return cargo.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {cargo.map((c, idx) => {
                          const widthPct = (c.avgRevenue / maxAvg) * 100;

                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 180, fontSize: 13, color: 'var(--text-primary)' }}>
                                {c.cargo}
                              </div>
                              <div style={{ flex: 1, height: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${widthPct}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
                              </div>
                              <div style={{ width: 120, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                {formatCurrency(c.avgRevenue)}/trip
                              </div>
                              <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                {c.tripCount} trips
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Your highest-value cargo type is {cargo[0].cargo} at {formatCurrency(cargo[0].avgRevenue)} avg per trip
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      No cargo data for this period
                    </div>
                  );
                })()}
              </div>

              {/* Section D: WEIGHT & REVENUE CORRELATION */}
              <div className="card" style={{ padding: 20 }}>
                <SectionHeader>WEIGHT & REVENUE CORRELATION</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {getWeightBins().map((bin, idx) => (
                    <div key={idx} style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 2 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{bin.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 4 }}>
                        {formatCurrency(bin.avg)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        avg per trip · {bin.count} loads
                      </div>
                    </div>
                  ))}
                </div>
                {(() => {
                  const bins = getWeightBins();
                  const maxBin = bins.reduce((max, bin) => bin.avg > max.avg ? bin : max, bins[0]);
                  return (
                    <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface)', borderRadius: 2, fontSize: 13, color: 'var(--text-secondary)' }}>
                      {maxBin.label} loads earn most per trip at {formatCurrency(maxBin.avg)} avg
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* CSS Animation for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
