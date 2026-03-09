import { useState, useMemo } from 'react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import {
  allInvoices,
  allCustomers,
  operators,
  saRoutes,
  getPortfolioSummary,
  type InvoiceWithRisk,
  type CustomerProfile,
} from '@/mocks/risk-mock-data';
import { type RiskTier } from '@/lib/risk-engine';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────

const TIER_CONFIG: Record<RiskTier, { label: string; color: string }> = {
  prime:      { label: 'PRIME',      color: '#10B981' },
  standard:   { label: 'STANDARD',   color: '#2563EB' },
  elevated:   { label: 'ELEVATED',   color: '#F59E0B' },
  high:       { label: 'HIGH',       color: '#EF4444' },
  ineligible: { label: 'INELIGIBLE', color: '#64748B' },
};

const TABS = [
  { id: 'portfolio',   label: 'Portfolio Risk' },
  { id: 'cashflow',    label: 'Cash Flow' },
  { id: 'customer',    label: 'Customer / Debtor' },
  { id: 'advance',     label: 'Advance Performance' },
  { id: 'operational', label: 'Operational' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Shared sub-components ────────────────────────────────────────

function KPICard({ label, value, color, sub }: {
  label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div className="card metric-card">
      <div className="card-header"><span className="card-title">{label}</span></div>
      <div
        className="metric-value"
        style={{ fontSize: 20, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{message}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
      marginBottom: 12, letterSpacing: '0.02em',
    }}>
      {children}
    </div>
  );
}

const chartTooltipStyle = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  itemStyle: { color: '#0F172A' },
  labelStyle: { color: '#94A3B8', fontSize: 11 },
};

// ─── Data derivation helpers ──────────────────────────────────────

function useDerivedData() {
  return useMemo(() => {
    const portfolio = getPortfolioSummary();
    const eligible = allInvoices.filter(i => i.riskScore.isEligible);
    const totalAmount = allInvoices.reduce((s, i) => s + i.invoice.amount, 0);

    // Tier distribution with amounts
    const tiers: RiskTier[] = ['prime', 'standard', 'elevated', 'high', 'ineligible'];
    const tierData = tiers.map(t => {
      const items = allInvoices.filter(i => i.riskScore.riskTier === t);
      return {
        tier: TIER_CONFIG[t].label,
        color: TIER_CONFIG[t].color,
        count: items.length,
        amount: items.reduce((s, i) => s + i.invoice.amount, 0),
        pct: allInvoices.length > 0
          ? ((items.length / allInvoices.length) * 100)
          : 0,
      };
    });

    // Customer concentration
    const customerExposure = allCustomers.map(c => {
      const invs = allInvoices.filter(i => i.customer.customerId === c.customerId);
      const amt = invs.reduce((s, i) => s + i.invoice.amount, 0);
      const avgScore = invs.length > 0
        ? Math.round(invs.reduce((s, i) => s + i.riskScore.finalScore, 0) / invs.length)
        : 0;
      const dominantTier = invs.length > 0 ? invs[0].riskScore.riskTier : ('ineligible' as RiskTier);
      return {
        name: c.customerName,
        customerId: c.customerId,
        invoiceCount: invs.length,
        totalAmount: amt,
        concentration: totalAmount > 0 ? (amt / totalAmount) * 100 : 0,
        avgScore,
        dominantTier,
        avgPayDays: c.debtorCredit.platformAvgDaysToPay ?? 0,
        disputeRate: c.debtorCredit.disputeRate,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    // Vintage cohorts (by invoice age buckets)
    const vintages = [
      { label: '0-7d', min: 0, max: 7 },
      { label: '8-30d', min: 8, max: 30 },
      { label: '31-60d', min: 31, max: 60 },
      { label: '61-90d', min: 61, max: 90 },
      { label: '90d+', min: 91, max: 999 },
    ].map(v => {
      const items = allInvoices.filter(
        i => i.invoice.ageInDays >= v.min && i.invoice.ageInDays <= v.max
      );
      const avgScore = items.length > 0
        ? Math.round(items.reduce((s, i) => s + i.riskScore.finalScore, 0) / items.length)
        : 0;
      return {
        cohort: v.label,
        count: items.length,
        amount: items.reduce((s, i) => s + i.invoice.amount, 0),
        avgScore,
        eligiblePct: items.length > 0
          ? Math.round((items.filter(i => i.riskScore.isEligible).length / items.length) * 100)
          : 0,
      };
    });

    // Cash flow mock (monthly actual vs predicted)
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const cashflowTrend = months.map((m, idx) => {
      const base = 600000 + idx * 80000 + Math.random() * 120000;
      return {
        month: m,
        actual: Math.round(base),
        predicted: Math.round(base * (0.9 + Math.random() * 0.2)),
      };
    });

    // DSO trend
    const dsoTrend = months.map((m, idx) => ({
      month: m,
      dso: Math.round(38 + (Math.random() - 0.5) * 16 - idx * 1.2),
    }));

    // Collection efficiency
    const collectionEfficiency = months.map((m, idx) => ({
      month: m,
      rate: Math.round(78 + idx * 2.5 + (Math.random() - 0.5) * 8),
    }));

    // Payment behavior (customer x month heatmap)
    const heatmapCustomers = customerExposure.slice(0, 8);
    const paymentHeatmap = heatmapCustomers.map(c => ({
      customer: c.name.length > 18 ? c.name.slice(0, 16) + '...' : c.name,
      values: months.map(() => {
        const base = c.avgPayDays;
        return Math.max(0, Math.round(base + (Math.random() - 0.5) * 20));
      }),
    }));

    // Profitability by customer (revenue minus estimated cost of capital)
    const profitabilityData = customerExposure.slice(0, 8).map(c => {
      const costOfCapital = c.totalAmount * 0.025;
      const profit = c.totalAmount - costOfCapital;
      return {
        name: c.name.length > 15 ? c.name.slice(0, 13) + '...' : c.name,
        revenue: c.totalAmount,
        costOfCapital: Math.round(costOfCapital),
        profit: Math.round(profit),
      };
    });

    // Advance performance (monthly)
    const advanceVolume = months.map((m, idx) => ({
      month: m,
      volume: Math.round(180000 + idx * 45000 + Math.random() * 80000),
      count: Math.round(3 + idx * 0.8 + Math.random() * 3),
    }));

    // Fee income breakdown by tier
    const feeByTier = tiers.filter(t => t !== 'ineligible').map(t => {
      const items = allInvoices.filter(i => i.riskScore.riskTier === t && i.riskScore.isEligible);
      return {
        tier: TIER_CONFIG[t].label,
        color: TIER_CONFIG[t].color,
        feeIncome: items.reduce((s, i) => s + i.riskScore.feeAmount, 0),
        invoiceCount: items.length,
        avgFee: items.length > 0
          ? items.reduce((s, i) => s + i.riskScore.finalFeePercent, 0) / items.length
          : 0,
      };
    });

    // Facility utilization
    const totalFacility = operators.reduce((s, o) => s + o.facilityLimit, 0);
    const totalUsed = operators.reduce(
      (s, o) => s + (o.facilityLimit * o.clientFinancial.advanceUtilizationRate / 100), 0
    );
    const facilityUtilization = totalFacility > 0 ? (totalUsed / totalFacility) * 100 : 0;

    // Route performance
    const routePerformance = saRoutes.map(r => {
      const routeInvoices = allInvoices.filter(i => i.routeData.routeName === r.routeName);
      const totalRev = routeInvoices.reduce((s, i) => s + i.invoice.amount, 0);
      const totalKm = routeInvoices.length * r.distanceKm;
      return {
        route: r.routeName.length > 22 ? r.routeName.slice(0, 20) + '...' : r.routeName,
        fullRoute: r.routeName,
        distance: r.distanceKm,
        trips: routeInvoices.length,
        revenue: totalRev,
        revenuePerKm: totalKm > 0 ? totalRev / totalKm : 0,
        riskLevel: r.routeRiskLevel,
      };
    }).filter(r => r.trips > 0).sort((a, b) => b.revenuePerKm - a.revenuePerKm);

    // Cargo type margins
    const cargoTypes = ['general', 'perishable', 'hazmat', 'high_value'] as const;
    const cargoMargins = cargoTypes.map(ct => {
      const items = allInvoices.filter(i => i.operational.cargoType === ct);
      const rev = items.reduce((s, i) => s + i.invoice.amount, 0);
      const margin = ct === 'general' ? 18.5 : ct === 'perishable' ? 14.2 : ct === 'hazmat' ? 22.8 : 20.1;
      return {
        type: ct === 'high_value' ? 'High Value' : ct.charAt(0).toUpperCase() + ct.slice(1),
        revenue: rev,
        margin,
        trips: items.length,
      };
    }).filter(c => c.trips > 0);

    // Completion rate by operator
    const completionByOperator = operators.slice(0, 6).map(op => ({
      name: op.operatorName.length > 18 ? op.operatorName.slice(0, 16) + '...' : op.operatorName,
      rate: 88 + Math.random() * 10,
      trips: Math.round(15 + Math.random() * 35),
    }));

    return {
      portfolio,
      tierData,
      customerExposure,
      vintages,
      cashflowTrend,
      dsoTrend,
      collectionEfficiency,
      paymentHeatmap,
      profitabilityData,
      advanceVolume,
      feeByTier,
      facilityUtilization,
      totalFacility,
      totalUsed,
      routePerformance,
      cargoMargins,
      completionByOperator,
      eligible,
      totalAmount,
      months,
    };
  }, []);
}

// ─── Tab 1: Portfolio Risk ────────────────────────────────────────

function PortfolioRiskTab({ data }: { data: ReturnType<typeof useDerivedData> }) {
  const { portfolio, tierData, customerExposure, vintages, eligible, totalAmount } = data;

  const weightedScore = eligible.length > 0
    ? Math.round(
        eligible.reduce((s, i) => s + i.riskScore.finalScore * i.invoice.amount, 0) /
        eligible.reduce((s, i) => s + i.invoice.amount, 0)
      )
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Total Invoices" value={portfolio.totalInvoices} sub={`${portfolio.eligibleCount} eligible`} />
        <KPICard
          label="Eligible Amount"
          value={formatCurrency(portfolio.totalEligibleAmount)}
          color="var(--accent-primary)"
        />
        <KPICard label="Avg Risk Score" value={portfolio.avgRiskScore} color="var(--status-success)" sub="out of 100" />
        <KPICard label="Weighted Portfolio Score" value={weightedScore} color="var(--accent-primary)" sub="amount-weighted" />
      </div>

      {/* Risk distribution: pie + bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Risk Tier Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={tierData}
                dataKey="count"
                nameKey="tier"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                strokeWidth={0}
              >
                {tierData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number, name: string) => [`${value} invoices`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            {tierData.map(d => (
              <div key={d.tier} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {d.tier} ({d.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Exposure by Tier (ZAR)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tierData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis type="category" dataKey="tier" tick={{ fill: '#475569', fontSize: 11 }} width={75} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number) => [formatCurrency(value), 'Exposure']}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                {tierData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Concentration analysis */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Customer Concentration Analysis</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Top exposure by customer
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th className="text-right">Invoices</th>
              <th className="text-right">Exposure</th>
              <th className="text-right">Concentration</th>
              <th className="text-right">Avg Score</th>
              <th className="text-right">Tier</th>
            </tr>
          </thead>
          <tbody>
            {customerExposure.filter(c => c.invoiceCount > 0).map(c => (
              <tr key={c.customerId}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td className="mono text-right">{c.invoiceCount}</td>
                <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                  {formatCurrency(c.totalAmount)}
                </td>
                <td className="text-right">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--bg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(c.concentration, 100)}%`,
                        height: '100%',
                        background: c.concentration > 20 ? '#EF4444' : c.concentration > 10 ? '#F59E0B' : '#10B981',
                        borderRadius: 3,
                      }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{c.concentration.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="mono text-right">{c.avgScore}</td>
                <td className="text-right">
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: TIER_CONFIG[c.dominantTier].color,
                    padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2,
                  }}>
                    {TIER_CONFIG[c.dominantTier].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vintage analysis */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Vintage Analysis (by Invoice Age Cohort)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}>
          {vintages.map(v => (
            <div
              key={v.cohort}
              style={{
                padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 4,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                {v.cohort}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginBottom: 4 }}>
                {v.count}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>invoices</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                {formatCurrency(v.amount)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                <span>Score: <span className="mono" style={{ color: v.avgScore >= 70 ? '#10B981' : v.avgScore >= 55 ? '#F59E0B' : '#EF4444' }}>{v.avgScore}</span></span>
                <span>Elig: <span className="mono">{v.eligiblePct}%</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Cash Flow ─────────────────────────────────────────────

function CashFlowTab({ data }: { data: ReturnType<typeof useDerivedData> }) {
  const { cashflowTrend, dsoTrend, collectionEfficiency, months } = data;

  const totalActual = cashflowTrend.reduce((s, c) => s + c.actual, 0);
  const totalPredicted = cashflowTrend.reduce((s, c) => s + c.predicted, 0);
  const accuracy = totalPredicted > 0
    ? Math.round((1 - Math.abs(totalActual - totalPredicted) / totalPredicted) * 100)
    : 0;
  const latestDSO = dsoTrend[dsoTrend.length - 1]?.dso ?? 0;
  const latestCollection = collectionEfficiency[collectionEfficiency.length - 1]?.rate ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Total Inflows (6mo)" value={formatCurrency(totalActual)} color="var(--status-success)" />
        <KPICard label="Prediction Accuracy" value={`${accuracy}%`} color="var(--accent-primary)" sub="actual vs predicted" />
        <KPICard
          label="Current DSO"
          value={`${latestDSO} days`}
          color={latestDSO > 45 ? 'var(--status-danger)' : latestDSO > 35 ? 'var(--status-warning)' : 'var(--status-success)'}
          sub="days sales outstanding"
        />
        <KPICard label="Collection Efficiency" value={`${latestCollection}%`} color="var(--accent-primary)" />
      </div>

      {/* Actual vs Predicted */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Actual vs Predicted Cash Inflow</span>
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 16, height: 2, background: '#2563EB', display: 'inline-block', borderRadius: 1 }} />Actual
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 16, height: 2, background: '#94A3B8', display: 'inline-block', borderRadius: 1, borderTop: '1px dashed #94A3B8' }} />Predicted
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={cashflowTrend} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
            <YAxis tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'actual' ? 'Actual' : 'Predicted']}
            />
            <Area type="monotone" dataKey="actual" stroke="#2563EB" fill="#2563EB" fillOpacity={0.08} strokeWidth={2} />
            <Area type="monotone" dataKey="predicted" stroke="#94A3B8" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* DSO trend */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>DSO Trend (Days Sales Outstanding)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dsoTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v} days`, 'DSO']} />
              <Line type="monotone" dataKey="dso" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Collection efficiency */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Collection Efficiency Rate</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={collectionEfficiency} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} domain={[60, 100]} />
              <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v}%`, 'Efficiency']} />
              <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly detail table */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Monthly Cash Flow Detail</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Actual Inflow</th>
              <th className="text-right">Predicted Inflow</th>
              <th className="text-right">Variance</th>
              <th className="text-right">DSO</th>
              <th className="text-right">Collection %</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, idx) => {
              const cf = cashflowTrend[idx];
              const variance = cf.actual - cf.predicted;
              const variancePct = cf.predicted > 0 ? (variance / cf.predicted) * 100 : 0;
              return (
                <tr key={m}>
                  <td className="mono">{m}</td>
                  <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                    {formatCurrency(cf.actual)}
                  </td>
                  <td className="mono text-right">{formatCurrency(cf.predicted)}</td>
                  <td className="mono text-right" style={{
                    color: variance >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
                  }}>
                    {variance >= 0 ? '+' : ''}{variancePct.toFixed(1)}%
                  </td>
                  <td className="mono text-right">{dsoTrend[idx]?.dso ?? '—'}</td>
                  <td className="mono text-right">{collectionEfficiency[idx]?.rate ?? '—'}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 3: Customer / Debtor ─────────────────────────────────────

function CustomerDebtorTab({ data }: { data: ReturnType<typeof useDerivedData> }) {
  const { customerExposure, paymentHeatmap, profitabilityData, months } = data;

  const activeCustomers = customerExposure.filter(c => c.invoiceCount > 0);
  const avgPayDays = activeCustomers.length > 0
    ? Math.round(activeCustomers.reduce((s, c) => s + c.avgPayDays, 0) / activeCustomers.length)
    : 0;
  const avgDispute = activeCustomers.length > 0
    ? (activeCustomers.reduce((s, c) => s + c.disputeRate, 0) / activeCustomers.length).toFixed(1)
    : '0.0';

  const heatColor = (days: number) => {
    if (days <= 30) return '#10B981';
    if (days <= 45) return '#F59E0B';
    if (days <= 60) return '#EF4444';
    return '#991B1B';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Active Customers" value={activeCustomers.length} />
        <KPICard label="Avg Payment Days" value={`${avgPayDays}d`}
          color={avgPayDays > 45 ? 'var(--status-danger)' : 'var(--status-success)'}
        />
        <KPICard label="Avg Dispute Rate" value={`${avgDispute}%`}
          color={Number(avgDispute) > 5 ? 'var(--status-danger)' : 'var(--status-success)'}
        />
        <KPICard label="Top Exposure" value={formatCurrency(activeCustomers[0]?.totalAmount ?? 0)}
          color="var(--accent-primary)" sub={activeCustomers[0]?.name ?? '—'}
        />
      </div>

      {/* Payment behavior heatmap */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Payment Behavior Heatmap (Avg Days to Pay)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10, color: '#94A3B8', padding: '6px 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Customer
                </th>
                {months.map(m => (
                  <th key={m} style={{ textAlign: 'center', fontSize: 10, color: '#94A3B8', padding: '6px 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentHeatmap.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: '#0F172A', padding: '6px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid #F1F5F9' }}>
                    {row.customer}
                  </td>
                  {row.values.map((v, j) => (
                    <td key={j} style={{ textAlign: 'center', padding: '4px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 40, height: 28, borderRadius: 3,
                        background: `${heatColor(v)}15`,
                        color: heatColor(v),
                        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                      }}>
                        {v}d
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: '#94A3B8', justifyContent: 'flex-end' }}>
          {[
            { label: '0-30d', color: '#10B981' },
            { label: '31-45d', color: '#F59E0B' },
            { label: '46-60d', color: '#EF4444' },
            { label: '60d+', color: '#991B1B' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: `${l.color}20`, border: `1px solid ${l.color}40` }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Profitability by customer */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Profitability by Customer (Revenue vs Cost of Capital)</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={profitabilityData} margin={{ top: 5, right: 20, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-25} textAnchor="end" />
            <YAxis tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'revenue' ? 'Revenue' : name === 'costOfCapital' ? 'Cost of Capital' : 'Net Profit',
              ]}
            />
            <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={24} name="revenue" />
            <Bar dataKey="costOfCapital" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={24} name="costOfCapital" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk tier breakdown per debtor */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Debtor Risk Summary</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th className="text-right">Avg Score</th>
              <th className="text-right">Avg Pay Days</th>
              <th className="text-right">Dispute Rate</th>
              <th className="text-right">Exposure</th>
              <th className="text-right">Risk Tier</th>
            </tr>
          </thead>
          <tbody>
            {activeCustomers.map(c => (
              <tr key={c.customerId}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td className="mono text-right" style={{
                  color: c.avgScore >= 70 ? '#10B981' : c.avgScore >= 55 ? '#F59E0B' : '#EF4444',
                }}>
                  {c.avgScore}
                </td>
                <td className="mono text-right" style={{
                  color: c.avgPayDays <= 30 ? '#10B981' : c.avgPayDays <= 60 ? '#F59E0B' : '#EF4444',
                }}>
                  {c.avgPayDays}d
                </td>
                <td className="mono text-right" style={{
                  color: c.disputeRate > 10 ? '#EF4444' : c.disputeRate > 5 ? '#F59E0B' : '#10B981',
                }}>
                  {c.disputeRate.toFixed(1)}%
                </td>
                <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                  {formatCurrency(c.totalAmount)}
                </td>
                <td className="text-right">
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: TIER_CONFIG[c.dominantTier].color,
                    padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2,
                  }}>
                    {TIER_CONFIG[c.dominantTier].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 4: Advance Performance ───────────────────────────────────

function AdvancePerformanceTab({ data }: { data: ReturnType<typeof useDerivedData> }) {
  const {
    advanceVolume, feeByTier, facilityUtilization, totalFacility, totalUsed, eligible,
  } = data;

  const totalAdvanced = advanceVolume.reduce((s, a) => s + a.volume, 0);
  const totalFeeIncome = feeByTier.reduce((s, f) => s + f.feeIncome, 0);
  const avgFeeRate = eligible.length > 0
    ? (eligible.reduce((s, i) => s + i.riskScore.finalFeePercent, 0) / eligible.length).toFixed(2)
    : '0.00';

  const gaugeAngle = Math.min(facilityUtilization, 100) * 1.8; // 0-180 degrees

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Total Advanced (6mo)" value={formatCurrency(totalAdvanced)} color="var(--accent-primary)" />
        <KPICard label="Total Fee Income" value={formatCurrency(totalFeeIncome)} color="var(--status-success)" />
        <KPICard label="Avg Fee Rate" value={`${avgFeeRate}%`} />
        <KPICard
          label="Facility Utilization"
          value={`${facilityUtilization.toFixed(1)}%`}
          color={facilityUtilization > 80 ? 'var(--status-danger)' : facilityUtilization > 60 ? 'var(--status-warning)' : 'var(--status-success)'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Advance volume over time */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Advance Volume Over Time</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={advanceVolume} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number, name: string) => [
                  name === 'volume' ? formatCurrency(value) : `${value} advances`,
                  name === 'volume' ? 'Volume' : 'Count',
                ]}
              />
              <Area type="monotone" dataKey="volume" stroke="#2563EB" fill="#2563EB" fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Facility utilization gauge */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <SectionTitle>Facility Utilization</SectionTitle>
          <div style={{ position: 'relative', width: 180, height: 100, marginTop: 12 }}>
            <svg viewBox="0 0 180 100" style={{ width: '100%', height: '100%' }}>
              {/* Background arc */}
              <path
                d="M 10 90 A 80 80 0 0 1 170 90"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d="M 10 90 A 80 80 0 0 1 170 90"
                fill="none"
                stroke={facilityUtilization > 80 ? '#EF4444' : facilityUtilization > 60 ? '#F59E0B' : '#10B981'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${gaugeAngle * Math.PI * 80 / 180} 999`}
              />
            </svg>
            <div style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0F172A' }}>
                {facilityUtilization.toFixed(0)}%
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div>{formatCurrency(totalUsed)} used</div>
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>of {formatCurrency(totalFacility)} total</div>
          </div>
        </div>
      </div>

      {/* Fee income breakdown by tier */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Fee Income Breakdown by Risk Tier</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={feeByTier} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="tier" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number) => [formatCurrency(value), 'Fee Income']}
              />
              <Bar dataKey="feeIncome" radius={[4, 4, 0, 0]} barSize={32}>
                {feeByTier.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="text-right">Invoices</th>
                  <th className="text-right">Fee Income</th>
                  <th className="text-right">Avg Fee %</th>
                </tr>
              </thead>
              <tbody>
                {feeByTier.map(f => (
                  <tr key={f.tier}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{f.tier}</span>
                      </span>
                    </td>
                    <td className="mono text-right">{f.invoiceCount}</td>
                    <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                      {formatCurrency(f.feeIncome)}
                    </td>
                    <td className="mono text-right">{f.avgFee.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
                  <td style={{ fontWeight: 600 }}>Total</td>
                  <td className="mono text-right" style={{ fontWeight: 600 }}>
                    {feeByTier.reduce((s, f) => s + f.invoiceCount, 0)}
                  </td>
                  <td className="mono text-right" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {formatCurrency(totalFeeIncome)}
                  </td>
                  <td className="mono text-right" style={{ fontWeight: 600 }}>{avgFeeRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Operational ───────────────────────────────────────────

function OperationalTab({ data }: { data: ReturnType<typeof useDerivedData> }) {
  const { routePerformance, cargoMargins, completionByOperator } = data;

  const totalRevPerKm = routePerformance.length > 0
    ? routePerformance.reduce((s, r) => s + r.revenuePerKm, 0) / routePerformance.length
    : 0;
  const avgMargin = cargoMargins.length > 0
    ? cargoMargins.reduce((s, c) => s + c.margin, 0) / cargoMargins.length
    : 0;
  const avgCompletion = completionByOperator.length > 0
    ? completionByOperator.reduce((s, c) => s + c.rate, 0) / completionByOperator.length
    : 0;

  const riskLevelColor = (level: string) => {
    if (level === 'low') return '#10B981';
    if (level === 'moderate') return '#F59E0B';
    if (level === 'high') return '#EF4444';
    return '#991B1B';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard label="Avg Revenue / km" value={formatCurrency(totalRevPerKm)} color="var(--accent-primary)" />
        <KPICard label="Avg Margin" value={formatPercent(avgMargin)} color="var(--status-success)" />
        <KPICard label="Avg Completion Rate" value={`${avgCompletion.toFixed(1)}%`} color="var(--accent-primary)" />
        <KPICard label="Active Routes" value={routePerformance.length} />
      </div>

      {/* Revenue per km by route */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Revenue per km by Route</SectionTitle>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={routePerformance} layout="vertical" margin={{ left: 140, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `R${v.toFixed(0)}`} tick={{ fill: '#94A3B8', fontSize: 11 }} />
            <YAxis type="category" dataKey="route" tick={{ fill: '#475569', fontSize: 11 }} width={135} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [formatCurrency(value), 'Rev/km']}
            />
            <Bar dataKey="revenuePerKm" radius={[0, 4, 4, 0]} barSize={18}>
              {routePerformance.map((d, i) => (
                <Cell key={i} fill={riskLevelColor(d.riskLevel)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#94A3B8', justifyContent: 'flex-end' }}>
          {['low', 'moderate', 'high', 'very_high'].map(l => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskLevelColor(l) }} />
              {l.replace('_', ' ')} risk
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Margin by cargo type */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Margin by Cargo Type</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cargoMargins} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="type" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(v: number, name: string) => [
                  name === 'margin' ? `${v}%` : formatCurrency(v),
                  name === 'margin' ? 'Margin' : 'Revenue',
                ]}
              />
              <Bar dataKey="margin" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Cargo Type</th>
                <th className="text-right">Trips</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {cargoMargins.map(c => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td className="mono text-right">{c.trips}</td>
                  <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                    {formatCurrency(c.revenue)}
                  </td>
                  <td className="mono text-right" style={{ color: '#10B981' }}>
                    {c.margin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Completion rates */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Completion Rates by Operator</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={completionByOperator} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 9 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} domain={[80, 100]} unit="%" />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'Completion Rate']}
              />
              <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Operator</th>
                <th className="text-right">Trips</th>
                <th className="text-right">Completion</th>
              </tr>
            </thead>
            <tbody>
              {completionByOperator.map(c => (
                <tr key={c.name}>
                  <td style={{ fontSize: 12 }}>{c.name}</td>
                  <td className="mono text-right">{c.trips}</td>
                  <td className="mono text-right" style={{
                    color: c.rate >= 95 ? '#10B981' : c.rate >= 90 ? '#F59E0B' : '#EF4444',
                  }}>
                    {c.rate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Route detail table */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Route Performance Detail</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Route</th>
              <th className="text-right">Distance</th>
              <th className="text-right">Trips</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Rev/km</th>
              <th className="text-right">Route Risk</th>
            </tr>
          </thead>
          <tbody>
            {routePerformance.map(r => (
              <tr key={r.fullRoute}>
                <td style={{ fontWeight: 500 }}>{r.fullRoute}</td>
                <td className="mono text-right">{r.distance} km</td>
                <td className="mono text-right">{r.trips}</td>
                <td className="mono text-right" style={{ color: 'var(--accent-primary)' }}>
                  {formatCurrency(r.revenue)}
                </td>
                <td className="mono text-right" style={{ fontWeight: 600 }}>
                  {formatCurrency(r.revenuePerKm)}
                </td>
                <td className="text-right">
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: riskLevelColor(r.riskLevel),
                    padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2,
                    textTransform: 'uppercase',
                  }}>
                    {r.riskLevel.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export default function FinanceReports() {
  const [tab, setTab] = useState<TabId>('portfolio');
  const data = useDerivedData();

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
        }}>
          Finance
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Reports</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Institutional-grade financial analytics across {data.portfolio.totalInvoices} invoices
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 24,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
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
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'portfolio' && <PortfolioRiskTab data={data} />}
      {tab === 'cashflow' && <CashFlowTab data={data} />}
      {tab === 'customer' && <CustomerDebtorTab data={data} />}
      {tab === 'advance' && <AdvancePerformanceTab data={data} />}
      {tab === 'operational' && <OperationalTab data={data} />}
    </div>
  );
}
