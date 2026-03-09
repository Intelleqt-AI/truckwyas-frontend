import { useState } from 'react';
import {
  operators,
  allCustomers,
  allInvoices,
  saRoutes,
  currentMacroData,
  getPortfolioSummary,
} from '@/mocks/risk-mock-data';

// ========== TYPES ==========

type InsightCategory = 'Operational' | 'Financial' | 'Risk' | 'Network';
type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  body: string;
  metric?: string;
  action?: string;
  timestamp: string;
}

// ========== GENERATE INSIGHTS FROM MOCK DATA ==========

function generateInsights(): Insight[] {
  const portfolio = getPortfolioSummary();
  const insights: Insight[] = [];

  // --- CRITICAL ---

  // Overdue high-value invoices
  const overdueInvoices = allInvoices.filter(
    (inv) => inv.invoice.daysUntilDue < 0 && inv.invoice.amount > 30000
  );
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((s, i) => s + i.invoice.amount, 0);
    const worstCustomer = overdueInvoices.sort((a, b) => a.invoice.daysUntilDue - b.invoice.daysUntilDue)[0];
    insights.push({
      id: 'crit-overdue',
      category: 'Financial',
      severity: 'critical',
      title: `R${(totalOverdue / 1000).toFixed(0)}k in overdue invoices across ${overdueInvoices.length} line items`,
      body: `Worst: ${worstCustomer.customer.customerName} — ${Math.abs(worstCustomer.invoice.daysUntilDue)} days past due on R${(worstCustomer.invoice.amount / 1000).toFixed(0)}k. Platform avg days-to-pay for this debtor: ${worstCustomer.customer.debtorCredit.platformAvgDaysToPay}d.`,
      metric: `${overdueInvoices.length} invoices`,
      action: 'Review overdue',
      timestamp: new Date().toISOString(),
    });
  }

  // SARS non-compliance
  const nonCompliantOps = operators.filter((op) => !op.clientFinancial.hasTaxCompliance);
  if (nonCompliantOps.length > 0) {
    insights.push({
      id: 'crit-sars',
      category: 'Risk',
      severity: 'critical',
      title: `${nonCompliantOps[0].operatorName} — SARS tax clearance lapsed`,
      body: `Hard stop: all new advances frozen until valid TCC submitted. Current facility utilisation at ${nonCompliantOps[0].clientFinancial.advanceUtilizationRate}%. Outstanding invoices ratio: ${nonCompliantOps[0].clientFinancial.outstandingInvoicesRatio}x monthly turnover.`,
      metric: 'Ineligible',
      action: 'View operator',
      timestamp: new Date().toISOString(),
    });
  }

  // Ineligible customer exposure
  const edconInvoices = allInvoices.filter(
    (inv) => inv.customer.customerName === 'Edcon Holdings (Edgars)'
  );
  if (edconInvoices.length > 0) {
    const exposure = edconInvoices.reduce((s, i) => s + i.invoice.amount, 0);
    insights.push({
      id: 'crit-edcon',
      category: 'Risk',
      severity: 'critical',
      title: `Edcon (business rescue) — R${(exposure / 1000).toFixed(0)}k exposure across ${edconInvoices.length} invoices`,
      body: `Credit rating D. Platform avg payment: ${edconInvoices[0].customer.debtorCredit.platformAvgDaysToPay}d. Dispute rate: ${edconInvoices[0].customer.debtorCredit.disputeRate}%. All invoices auto-ineligible.`,
      metric: `R${(exposure / 1000).toFixed(0)}k`,
      action: 'Review exposure',
      timestamp: new Date().toISOString(),
    });
  }

  // --- WARNING ---

  // High facility utilisation operators
  const highUtilOps = operators.filter(
    (op) => op.clientFinancial.advanceUtilizationRate > 75 && op.clientFinancial.hasTaxCompliance
  );
  highUtilOps.forEach((op) => {
    insights.push({
      id: `warn-util-${op.operatorId}`,
      category: 'Financial',
      severity: 'warning',
      title: `${op.operatorName} — facility ${op.clientFinancial.advanceUtilizationRate}% utilised`,
      body: `R${((op.facilityLimit * (1 - op.clientFinancial.advanceUtilizationRate / 100)) / 1000).toFixed(0)}k headroom remaining on R${(op.facilityLimit / 1000).toFixed(0)}k limit. Advance frequency: ${op.clientFinancial.advanceFrequency.replace('_', ' ')}. Revenue concentration: ${op.clientFinancial.revenueConcentration}%.`,
      metric: `${op.clientFinancial.advanceUtilizationRate}%`,
      timestamp: new Date().toISOString(),
    });
  });

  // Hijacking hotspot route
  const hotspotRoutes = saRoutes.filter((r) => r.routeRiskLevel === 'very_high');
  const hotspotInvoices = allInvoices.filter(
    (inv) => inv.routeData.routeRiskLevel === 'very_high'
  );
  if (hotspotInvoices.length > 0) {
    const hotspotValue = hotspotInvoices.reduce((s, i) => s + i.invoice.amount, 0);
    insights.push({
      id: 'warn-hotspot',
      category: 'Operational',
      severity: 'warning',
      title: `${hotspotRoutes[0]?.routeName || 'High-risk route'} — hijacking hotspot, R${(hotspotValue / 1000).toFixed(0)}k in transit`,
      body: `${hotspotInvoices.length} active invoices on very-high-risk routes. Cargo: ${hotspotRoutes[0]?.typicalCargo}. GPS tracking confirmed on ${hotspotInvoices.filter((i) => i.pod.hasGPSTracking).length}/${hotspotInvoices.length} loads.`,
      metric: `${hotspotInvoices.length} loads`,
      timestamp: new Date().toISOString(),
    });
  }

  // Cross-operator late payment flags
  const flaggedCustomers = allCustomers.filter(
    (c) => c.debtorCredit.hasCrossOperatorLatePaymentFlag
  );
  if (flaggedCustomers.length > 0) {
    insights.push({
      id: 'warn-cross-op',
      category: 'Network',
      severity: 'warning',
      title: `${flaggedCustomers.length} debtors flagged for late payment across the platform`,
      body: `${flaggedCustomers.map((c) => c.customerName).join(', ')} — paying late on other operators' invoices. Combined outstanding: R${(flaggedCustomers.reduce((s, c) => s + c.debtorCredit.customerOutstandingBalance, 0) / 1e6).toFixed(1)}M.`,
      metric: `${flaggedCustomers.length} debtors`,
      action: 'View debtors',
      timestamp: new Date().toISOString(),
    });
  }

  // Declining turnover operators
  const decliningOps = operators.filter(
    (op) => op.clientFinancial.turnoverTrend6Mo === 'declining'
  );
  decliningOps.forEach((op) => {
    insights.push({
      id: `warn-decline-${op.operatorId}`,
      category: 'Financial',
      severity: 'warning',
      title: `${op.operatorName} — turnover declining, margin under pressure`,
      body: `6-month trend: declining. Turnover volatility: ${(op.clientFinancial.turnoverVolatility * 100).toFixed(0)}%. Fleet ${op.clientIdentity.fleetGrowthRate && op.clientIdentity.fleetGrowthRate < 0 ? `shrinking ${Math.abs(op.clientIdentity.fleetGrowthRate)}%` : 'stable'}. Sector: ${op.clientIdentity.subSector}.`,
      metric: `R${(op.clientFinancial.monthlyTurnover / 1e6).toFixed(1)}M/mo`,
      timestamp: new Date().toISOString(),
    });
  });

  // --- OPPORTUNITY ---

  // Prime invoices eligible for fast advance
  const primeEligible = allInvoices.filter(
    (inv) => inv.riskScore.riskTier === 'prime' && inv.riskScore.isEligible
  );
  if (primeEligible.length > 0) {
    const totalPrime = primeEligible.reduce((s, i) => s + i.invoice.amount, 0);
    const avgFee = primeEligible.reduce((s, i) => s + i.riskScore.feePercentage, 0) / primeEligible.length;
    insights.push({
      id: 'opp-prime-advance',
      category: 'Financial',
      severity: 'opportunity',
      title: `R${(totalPrime / 1000).toFixed(0)}k in PRIME invoices eligible for fast advance at ${avgFee.toFixed(1)}% avg fee`,
      body: `${primeEligible.length} invoices from ${new Set(primeEligible.map((i) => i.operator.operatorName)).size} operators. Top debtor: ${primeEligible[0].customer.customerName} (PAYDEX ${primeEligible[0].customer.debtorCredit.paydexScore || 'N/A'}).`,
      metric: `${avgFee.toFixed(1)}% fee`,
      action: 'Review eligible',
      timestamp: new Date().toISOString(),
    });
  }

  // Cross-border SADC opportunity
  const crossBorderInvoices = allInvoices.filter(
    (inv) => inv.routeData.fromCity === 'Nelspruit' || inv.routeData.toCity === 'Maputo'
  );
  if (crossBorderInvoices.length > 0) {
    insights.push({
      id: 'opp-sadc',
      category: 'Operational',
      severity: 'opportunity',
      title: `SADC corridor active — ${crossBorderInvoices.length} Nelspruit→Maputo loads this period`,
      body: `Cross-border freight with customs clearance. ZAR volatility at ${currentMacroData.zarVolatility30d}% (30d). Consider hedging exposure on R${(crossBorderInvoices.reduce((s, i) => s + i.invoice.amount, 0) / 1000).toFixed(0)}k outstanding.`,
      metric: `${crossBorderInvoices.length} loads`,
      timestamp: new Date().toISOString(),
    });
  }

  // New operator with good trajectory
  const newGrowingOps = operators.filter(
    (op) => op.clientIdentity.companyAgeYears <= 2 && op.clientFinancial.turnoverTrend6Mo === 'growing'
  );
  newGrowingOps.forEach((op) => {
    insights.push({
      id: `opp-new-${op.operatorId}`,
      category: 'Network',
      severity: 'opportunity',
      title: `${op.operatorName} — new entrant, growing trajectory`,
      body: `${op.clientIdentity.companyAgeYears}yr old, ${op.clientIdentity.fleetSize} trucks, R${(op.clientFinancial.monthlyTurnover / 1000).toFixed(0)}k/mo turnover trending up. Operating across ${op.clientIdentity.provinceCount} provinces. Potential for facility increase.`,
      metric: `${op.clientIdentity.fleetSize} trucks`,
      action: 'Review profile',
      timestamp: new Date().toISOString(),
    });
  });

  // --- INFO ---

  // Portfolio health summary
  insights.push({
    id: 'info-portfolio',
    category: 'Financial',
    severity: 'info',
    title: `Portfolio health: ${portfolio.avgRiskScore}/100 avg score across ${portfolio.eligibleCount} eligible invoices`,
    body: `Tier breakdown — PRIME: ${portfolio.tierDistribution.prime}, STANDARD: ${portfolio.tierDistribution.standard}, ELEVATED: ${portfolio.tierDistribution.elevated}, HIGH: ${portfolio.tierDistribution.high}, INELIGIBLE: ${portfolio.tierDistribution.ineligible}. Total eligible: R${(portfolio.totalEligibleAmount / 1e6).toFixed(1)}M.`,
    metric: `${portfolio.avgRiskScore}/100`,
    timestamp: new Date().toISOString(),
  });

  // Macro conditions
  insights.push({
    id: 'info-macro',
    category: 'Risk',
    severity: 'info',
    title: `SARB repo rate at ${currentMacroData.sarbRepoRate}% — freight demand index ${currentMacroData.freightDemandIndex}/100`,
    body: `ZAR 30d volatility: ${currentMacroData.zarVolatility30d}%. Fuel trend: ${currentMacroData.fuelPriceTrend3Mo}. Load shedding impact: ${currentMacroData.loadSheddingImpactIndex}/100. PMI: ${currentMacroData.pmiIndex} (${currentMacroData.pmiIndex > 50 ? 'expansion' : 'contraction'}).`,
    metric: `${currentMacroData.sarbRepoRate}%`,
    timestamp: new Date().toISOString(),
  });

  // E-POD adoption
  const ePodCount = allInvoices.filter(
    (i) => i.pod.podType === 'e_signature' || i.pod.podType === 'geo_photo'
  ).length;
  const ePodPct = ((ePodCount / allInvoices.length) * 100).toFixed(0);
  insights.push({
    id: 'info-epod',
    category: 'Operational',
    severity: 'info',
    title: `E-POD adoption at ${ePodPct}% — ${ePodCount}/${allInvoices.length} invoices with digital proof`,
    body: `E-signature: ${allInvoices.filter((i) => i.pod.podType === 'e_signature').length}, Geo-photo: ${allInvoices.filter((i) => i.pod.podType === 'geo_photo').length}, Scanned: ${allInvoices.filter((i) => i.pod.podType === 'scanned').length}, Manual: ${allInvoices.filter((i) => i.pod.podType === 'manual').length}, None: ${allInvoices.filter((i) => i.pod.podType === 'none').length}. Digital PODs attract lower fees.`,
    metric: `${ePodPct}%`,
    timestamp: new Date().toISOString(),
  });

  return insights;
}

// ========== SEVERITY CONFIG ==========

const SEVERITY_CONFIG: Record<InsightSeverity, { color: string; bg: string; border: string; icon: string; label: string }> = {
  critical: {
    color: 'var(--status-danger)',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'var(--status-danger)',
    icon: '●',
    label: 'CRITICAL',
  },
  warning: {
    color: 'var(--status-warning)',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'var(--status-warning)',
    icon: '▲',
    label: 'WARNING',
  },
  opportunity: {
    color: 'var(--status-success)',
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'var(--status-success)',
    icon: '◆',
    label: 'OPPORTUNITY',
  },
  info: {
    color: 'var(--accent-primary)',
    bg: 'rgba(59, 130, 246, 0.06)',
    border: 'var(--border-subtle)',
    icon: '○',
    label: 'INFO',
  },
};

const CATEGORY_COLORS: Record<InsightCategory, string> = {
  Operational: '#8B5CF6',
  Financial: '#3B82F6',
  Risk: '#EF4444',
  Network: '#10B981',
};

// ========== COMPONENT ==========

export default function Insights() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<InsightCategory | 'All'>('All');
  const [filterSeverity, setFilterSeverity] = useState<InsightSeverity | 'All'>('All');

  const allInsights = generateInsights();
  const activeInsights = allInsights.filter((i) => !dismissedIds.has(i.id));

  const filteredInsights = activeInsights.filter((i) => {
    if (filterCategory !== 'All' && i.category !== filterCategory) return false;
    if (filterSeverity !== 'All' && i.severity !== filterSeverity) return false;
    return true;
  });

  // Sort: critical first, then warning, opportunity, info
  const severityOrder: InsightSeverity[] = ['critical', 'warning', 'opportunity', 'info'];
  const sortedInsights = [...filteredInsights].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const criticalCount = activeInsights.filter((i) => i.severity === 'critical').length;
  const warningCount = activeInsights.filter((i) => i.severity === 'warning').length;
  const oppCount = activeInsights.filter((i) => i.severity === 'opportunity').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            INTELLIGENCE FEED
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
            Insights
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {criticalCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: SEVERITY_CONFIG.critical.color, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {criticalCount} CRITICAL
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: SEVERITY_CONFIG.warning.color, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {warningCount} WARNING
              </span>
            </div>
          )}
          {oppCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: SEVERITY_CONFIG.opportunity.color, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {oppCount} OPP
              </span>
            </div>
          )}
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
            {activeInsights.length} active · {dismissedIds.size} dismissed
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginRight: 4 }}>
          Category:
        </span>
        {(['All', 'Operational', 'Financial', 'Risk', 'Network'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{
              background: filterCategory === cat ? (cat === 'All' ? 'var(--accent-primary)' : CATEGORY_COLORS[cat as InsightCategory]) : 'transparent',
              border: `1px solid ${filterCategory === cat ? 'transparent' : 'var(--border-subtle)'}`,
              color: filterCategory === cat ? '#fff' : 'var(--text-secondary)',
              padding: '5px 12px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: filterCategory === cat ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        ))}

        <span style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 8px' }} />

        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginRight: 4 }}>
          Severity:
        </span>
        {(['All', 'critical', 'warning', 'opportunity', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            style={{
              background: filterSeverity === sev ? (sev === 'All' ? 'var(--accent-primary)' : SEVERITY_CONFIG[sev as InsightSeverity].color) : 'transparent',
              border: `1px solid ${filterSeverity === sev ? 'transparent' : 'var(--border-subtle)'}`,
              color: filterSeverity === sev ? (sev === 'info' ? '#fff' : sev === 'All' ? '#fff' : '#fff') : 'var(--text-secondary)',
              padding: '5px 12px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: filterSeverity === sev ? 600 : 400,
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
            }}
          >
            {sev === 'All' ? 'All' : SEVERITY_CONFIG[sev as InsightSeverity].label}
          </button>
        ))}
      </div>

      {/* Insights list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedInsights.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}>
            {dismissedIds.size > 0 ? 'All insights acknowledged' : 'No insights match filters'}
          </div>
        ) : (
          sortedInsights.map((insight) => {
            const config = SEVERITY_CONFIG[insight.severity];
            const catColor = CATEGORY_COLORS[insight.category];

            return (
              <div
                key={insight.id}
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                  borderLeft: `3px solid ${config.border}`,
                  borderRadius: 'var(--card-radius)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Severity icon */}
                <div style={{
                  fontSize: 14,
                  color: config.color,
                  marginTop: 2,
                  flexShrink: 0,
                  width: 16,
                  textAlign: 'center',
                }}>
                  {config.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Top row: badges + metric */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    {/* Category badge */}
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: catColor,
                      padding: '2px 8px',
                      background: `${catColor}18`,
                      borderRadius: 2,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {insight.category}
                    </span>

                    {/* Severity label */}
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: config.color,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {config.label}
                    </span>

                    {/* Metric */}
                    {insight.metric && (
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        marginLeft: 'auto',
                        fontWeight: 600,
                      }}>
                        {insight.metric}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                    lineHeight: 1.4,
                  }}>
                    {insight.title}
                  </div>

                  {/* Body */}
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: insight.action ? 10 : 0,
                  }}>
                    {insight.body}
                  </div>

                  {/* Action */}
                  {insight.action && (
                    <button style={{
                      background: 'transparent',
                      border: `1px solid ${config.color}`,
                      color: config.color,
                      padding: '4px 12px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.15s ease',
                    }}>
                      {insight.action} →
                    </button>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => handleDismiss(insight.id)}
                  title="Dismiss"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    fontSize: 16,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: 3,
                    lineHeight: 1,
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Dismissed count / restore */}
      {dismissedIds.size > 0 && (
        <div style={{
          marginTop: 20,
          textAlign: 'center',
        }}>
          <button
            onClick={() => setDismissedIds(new Set())}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
              padding: '6px 16px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-dim)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            Restore {dismissedIds.size} dismissed insight{dismissedIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
