import { useState } from "react";

const formatZAR = (v: number) =>
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TABS = [
  { id: 'portfolio', label: 'Portfolio Risk' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'customer', label: 'Customer / Debtor' },
  { id: 'advance', label: 'Advance Performance' },
  { id: 'operational', label: 'Operational' },
];

const DATE_RANGES = [
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_year', label: 'Last Year' },
];

const riskDistribution = [
  { tier: 'PRIME', count: 45, value: 3250000, color: '#22c55e' },
  { tier: 'STANDARD', count: 78, value: 4890000, color: 'var(--accent-primary)' },
  { tier: 'ELEVATED', count: 34, value: 1820000, color: 'var(--status-warning)' },
  { tier: 'HIGH', count: 12, value: 450000, color: 'var(--status-danger)' },
];

const concentration = [
  { customer: 'Shoprite Logistics', exposure: 2450000, pct: 23.5 },
  { customer: 'Tiger Brands', exposure: 1890000, pct: 18.1 },
  { customer: 'PepsiCo SA', exposure: 1420000, pct: 13.6 },
  { customer: 'Bidvest Freight', exposure: 1150000, pct: 11.0 },
  { customer: 'Massmart', exposure: 980000, pct: 9.4 },
  { customer: 'Others', exposure: 2520000, pct: 24.4 },
];

const vintageAnalysis = [
  { cohort: 'Jan 2024', default_rate: 1.2, volume: 890000 },
  { cohort: 'Feb 2024', default_rate: 0.8, volume: 1120000 },
  { cohort: 'Mar 2024', default_rate: 1.5, volume: 980000 },
  { cohort: 'Apr 2024', default_rate: 0.6, volume: 1340000 },
  { cohort: 'May 2024', default_rate: 0.9, volume: 1180000 },
  { cohort: 'Jun 2024', default_rate: 0.4, volume: 1450000 },
];

const cashFlowData = [
  { month: 'Jan', actual: 1250000, predicted: 1180000, dso: 42 },
  { month: 'Feb', actual: 1420000, predicted: 1390000, dso: 38 },
  { month: 'Mar', actual: 1180000, predicted: 1220000, dso: 41 },
  { month: 'Apr', actual: 1580000, predicted: 1540000, dso: 35 },
  { month: 'May', actual: 1690000, predicted: 1650000, dso: 34 },
  { month: 'Jun', actual: 1520000, predicted: 1590000, dso: 32 },
];

const customerRanking = [
  { customer: 'Shoprite Logistics', risk_score: 88, avg_days: 28, exposure: 2450000, trend: 'up' },
  { customer: 'Tiger Brands', risk_score: 82, avg_days: 32, exposure: 1890000, trend: 'flat' },
  { customer: 'PepsiCo SA', risk_score: 79, avg_days: 35, exposure: 1420000, trend: 'flat' },
  { customer: 'Bidvest Freight', risk_score: 71, avg_days: 42, exposure: 1150000, trend: 'down' },
  { customer: 'Massmart', risk_score: 85, avg_days: 30, exposure: 980000, trend: 'up' },
];

const advanceMonths = [
  { month: 'Jan', volume: 890000, count: 45 },
  { month: 'Feb', volume: 1120000, count: 58 },
  { month: 'Mar', volume: 980000, count: 51 },
  { month: 'Apr', volume: 1340000, count: 67 },
  { month: 'May', volume: 1180000, count: 62 },
  { month: 'Jun', volume: 1450000, count: 72 },
];

const corridors = [
  { corridor: 'JHB-DBN', revenue_km: 18.5, volume: 2340000, margin: 22.3 },
  { corridor: 'JHB-CPT', revenue_km: 22.3, volume: 3120000, margin: 18.7 },
  { corridor: 'DBN-CPT', revenue_km: 20.1, volume: 1890000, margin: 20.1 },
  { corridor: 'JHB-PE', revenue_km: 19.8, volume: 1450000, margin: 21.5 },
  { corridor: 'Gauteng Local', revenue_km: 15.2, volume: 980000, margin: 25.8 },
];

const marginsByCustomer = [
  { customer: 'Shoprite', margin: 21.2 },
  { customer: 'Tiger Brands', margin: 19.5 },
  { customer: 'PepsiCo', margin: 22.8 },
  { customer: 'Bidvest', margin: 17.3 },
  { customer: 'Massmart', margin: 20.1 },
];

const BAR_MAX = Math.max(...riskDistribution.map(r => r.count));

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 8, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono)', fontSize: 12 }}>↑</span>;
  if (trend === 'down') return <span style={{ color: 'var(--status-danger)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>↓</span>;
  return <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>→</span>;
}

export default function FinanceReports() {
  const [tab, setTab] = useState('portfolio');
  const [dateRange, setDateRange] = useState('last_3_months');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Reports</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Institutional-grade analytics</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '7px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button className="btn-action" onClick={() => {}}>↓ EXPORT CSV</button>
        </div>
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
              color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '10px 16px',
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Portfolio Risk */}
      {tab === 'portfolio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Total Portfolio', value: formatZAR(10410000), delta: '+8.2%', up: true },
              { label: 'Avg Risk Score', value: '78', delta: '+3.5pts', up: true },
              { label: 'Default Rate', value: '0.9%', delta: '-0.3%', up: true },
              { label: 'Active Invoices', value: '169', delta: '+12 this week', up: true },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 22 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          {/* Risk Distribution */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Risk Distribution</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">%</th>
                  <th style={{ width: 120 }}>Mix</th>
                </tr>
              </thead>
              <tbody>
                {riskDistribution.map(row => (
                  <tr key={row.tier}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                        <span className="mono">{row.tier}</span>
                      </span>
                    </td>
                    <td className="text-right mono">{row.count}</td>
                    <td className="text-right mono">{formatZAR(row.value)}</td>
                    <td className="text-right mono">{((row.value / 10410000) * 100).toFixed(1)}%</td>
                    <td><MiniBar value={row.count} max={BAR_MAX} color={row.color} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Concentration */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Customer Concentration</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Exposure</th>
                  <th className="text-right">%</th>
                  <th style={{ width: 160 }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {concentration.map(row => (
                  <tr key={row.customer}>
                    <td>{row.customer}</td>
                    <td className="text-right mono">{formatZAR(row.exposure)}</td>
                    <td className="text-right mono">{row.pct}%</td>
                    <td>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ width: `${row.pct}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vintage */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Vintage Analysis — Default Rate</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th className="text-right">Default Rate</th>
                  <th className="text-right">Volume</th>
                  <th style={{ width: 160 }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {vintageAnalysis.map(row => (
                  <tr key={row.cohort}>
                    <td className="mono">{row.cohort}</td>
                    <td className="text-right mono" style={{ color: row.default_rate > 1 ? 'var(--status-danger)' : '#22c55e' }}>{row.default_rate}%</td>
                    <td className="text-right mono">{formatZAR(row.volume)}</td>
                    <td>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ width: `${(row.default_rate / 2) * 100}%`, height: '100%', background: row.default_rate > 1 ? 'var(--status-danger)' : '#22c55e', borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {tab === 'cashflow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'DSO (Days)', value: '37', delta: '-12.5% improvement' },
              { label: 'Collection Efficiency', value: '94.3%', delta: '+2.1% vs target' },
              { label: 'Prediction Accuracy', value: '96.3%', delta: '±3.2 days avg' },
              { label: 'Total Collected', value: formatZAR(8640000), delta: '+15.2%' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 22 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Actual vs Predicted Cash Flow</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Predicted</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">DSO</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowData.map(row => {
                  const variance = row.actual - row.predicted;
                  return (
                    <tr key={row.month}>
                      <td className="mono">{row.month}</td>
                      <td className="text-right mono">{formatZAR(row.actual)}</td>
                      <td className="text-right mono">{formatZAR(row.predicted)}</td>
                      <td className="text-right mono" style={{ color: variance >= 0 ? '#22c55e' : 'var(--status-danger)' }}>
                        {variance >= 0 ? '+' : ''}{formatZAR(variance)}
                      </td>
                      <td className="text-right mono">{row.dso}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer / Debtor */}
      {tab === 'customer' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header"><span className="card-title">Customer Risk Ranking</span></div>
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">Risk Score</th>
                <th className="text-right">Avg Days</th>
                <th className="text-right">Exposure</th>
                <th className="text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {customerRanking.map(row => (
                <tr key={row.customer}>
                  <td>{row.customer}</td>
                  <td className="text-right">
                    <span
                      className="mono"
                      style={{
                        color: row.risk_score >= 85 ? '#22c55e' : row.risk_score >= 70 ? 'var(--accent-primary)' : 'var(--status-warning)',
                        fontWeight: 600,
                      }}
                    >
                      {row.risk_score}
                    </span>
                  </td>
                  <td className="text-right mono">{row.avg_days}d</td>
                  <td className="text-right mono">{formatZAR(row.exposure)}</td>
                  <td className="text-right"><TrendIcon trend={row.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Advance Performance */}
      {tab === 'advance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Total Advanced', value: formatZAR(6360000), delta: '+18.3%' },
              { label: 'Fee Income', value: formatZAR(142500), delta: '2.24% avg rate' },
              { label: 'Default Rate', value: '0.8%', delta: '-0.2% improvement' },
              { label: 'Avg Settlement', value: '28d', delta: 'vs 30d terms' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 22 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Advance Volume by Month</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Count</th>
                  <th style={{ width: 180 }}>Scale</th>
                </tr>
              </thead>
              <tbody>
                {advanceMonths.map(row => (
                  <tr key={row.month}>
                    <td className="mono">{row.month}</td>
                    <td className="text-right mono">{formatZAR(row.volume)}</td>
                    <td className="text-right mono">{row.count}</td>
                    <td>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ width: `${(row.volume / 1450000) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operational */}
      {tab === 'operational' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Revenue per KM by Corridor</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Corridor</th>
                  <th className="text-right">R/km</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Margin</th>
                  <th style={{ width: 140 }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {corridors.map(row => (
                  <tr key={row.corridor}>
                    <td className="mono">{row.corridor}</td>
                    <td className="text-right mono">R {row.revenue_km.toFixed(2)}</td>
                    <td className="text-right mono">{formatZAR(row.volume)}</td>
                    <td className="text-right mono" style={{ color: row.margin >= 22 ? '#22c55e' : 'var(--text-primary)' }}>{row.margin.toFixed(1)}%</td>
                    <td>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ width: `${(row.margin / 30) * 100}%`, height: '100%', background: '#22c55e', borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-header"><span className="card-title">Margin by Customer</span></div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Margin %</th>
                  <th style={{ width: 200 }}>Bar</th>
                </tr>
              </thead>
              <tbody>
                {marginsByCustomer.map(row => (
                  <tr key={row.customer}>
                    <td>{row.customer}</td>
                    <td className="text-right mono">{row.margin.toFixed(1)}%</td>
                    <td>
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 2, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ width: `${(row.margin / 30) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
