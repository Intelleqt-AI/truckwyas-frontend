import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/Api';

interface Operator {
  id: number;
  name: string;
  health_score: number;
  advances_outstanding: number;
  risk_tier: string;
  last_activity: string;
}

interface Advance {
  id: number;
  operator_name: string;
  amount: number;
  risk_score: number;
  fee_rate: number;
  status: string;
  created_at: string;
}

interface RiskData {
  prime_percentage: number;
  standard_percentage: number;
  elevated_percentage: number;
  high_percentage: number;
}

interface PortfolioSummary {
  total_deployed_capital: number;
  active_operators: number;
  avg_risk_score: number;
  portfolio_health: number;
}

interface RiskPillar {
  name: string;
  score: number;
  description: string;
}

interface OperatorRiskDetail {
  operator_id: number;
  operator_name: string;
  overall_score: number;
  risk_tier: string;
  confidence_interval: string;
  fee_rate: number;
  pillars: RiskPillar[];
}

const formatZAR = (v: number) =>
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TIER_COLOR: Record<string, string> = {
  PRIME: 'var(--accent-primary)',
  STANDARD: 'var(--status-success)',
  ELEVATED: 'var(--status-warning)',
  HIGH: 'var(--status-danger)',
};


export default function PartnerDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<number | null>(null);
  const [operatorRisk, setOperatorRisk] = useState<OperatorRiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'vintage'>('overview');

  const handleExportCSV = () => {
    const csvData = operators.map(op => ({
      Name: op.name,
      'Health Score': op.health_score,
      'Outstanding': op.advances_outstanding,
      'Risk Tier': op.risk_tier,
      'Last Activity': op.last_activity,
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchData('api/v1/partner/operators/'),
      fetchData('api/v1/partner/advances/'),
      fetchData('api/v1/partner/risk/')
    ])
      .then(([operatorsData, advancesData, riskDataRes]) => {
        setOperators(operatorsData?.operators || []);
        setAdvances(advancesData?.advances || []);
        setRiskData(riskDataRes?.risk_distribution || null);
        setPortfolio(operatorsData?.portfolio_summary || null);
        setError(null);
      })
      .catch(() => {
        setError('Failed to load partner data');
        setOperators([]);
        setAdvances([]);
        setRiskData(null);
        setPortfolio(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedOperator) {
      fetchData(`api/v1/partner/risk/${selectedOperator}/`)
        .then(setOperatorRisk)
        .catch(() => setOperatorRisk(null));
    } else {
      setOperatorRisk(null);
    }
  }, [selectedOperator]);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '30%' }} />
          <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Lender Portal
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Partner Dashboard</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Portfolio risk intelligence and operator performance
        </div>
      </div>

      {/* Hero: Portfolio Health Score */}
      <div className="card" style={{ padding: 32, marginBottom: 24, background: 'linear-gradient(135deg, var(--bg-deep) 0%, var(--bg-surface) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 8 }}>
              PORTFOLIO HEALTH SCORE
            </div>
            <div style={{ fontSize: 52, fontWeight: 700, color: (portfolio?.portfolio_health || 0) > 80 ? 'var(--status-success)' : (portfolio?.portfolio_health || 0) > 60 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
              {portfolio?.portfolio_health || 0}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              {portfolio?.active_operators || 0} active operators • {formatZAR(portfolio?.total_deployed_capital || 0)} deployed
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={handleExportCSV} style={{
              background: 'transparent',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              padding: '8px 16px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              borderRadius: 2,
              cursor: 'pointer',
              marginBottom: 12,
            }}>
              ↓ EXPORT CSV
            </button>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              Last updated: {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Advance Performance Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Approval Rate</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>92%</div>
          <div className="metric-delta delta-neutral"><span>Last 30 days</span></div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Avg Settlement Days</span></div>
          <div className="metric-value" style={{ fontSize: 28 }}>28</div>
          <div className="metric-delta delta-up"><span>↓ 3 days improvement</span></div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Fee Income (MTD)</span></div>
          <div className="metric-value" style={{ fontSize: 22 }}>{formatZAR(121500)}</div>
          <div className="metric-delta delta-up"><span>+15% vs last month</span></div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Avg Risk Score</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>
            {portfolio?.avg_risk_score || 0}
          </div>
          <div className="metric-delta delta-neutral"><span>Portfolio-wide</span></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 16px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: activeTab === 'overview' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderBottom: activeTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          OVERVIEW
        </button>
        <button
          onClick={() => setActiveTab('vintage')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 16px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: activeTab === 'vintage' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderBottom: activeTab === 'vintage' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          VINTAGE ANALYSIS
        </button>
      </div>

      {activeTab === 'vintage' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
            COHORT ANALYSIS — VINTAGE VIEW
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cohort Month</th>
                  <th className="text-right">Advances</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right">Settled</th>
                  <th className="text-right">Defaulted</th>
                  <th className="text-right">Settlement Rate</th>
                  <th className="text-right">Avg Days to Settle</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { month: '2024-02', advances: 18, amount: 1850000, settled: 16, defaulted: 0, rate: 89, days: 26 },
                  { month: '2024-01', advances: 22, amount: 2100000, settled: 21, defaulted: 0, rate: 95, days: 24 },
                  { month: '2023-12', advances: 19, amount: 1920000, settled: 18, defaulted: 1, rate: 95, days: 28 },
                  { month: '2023-11', advances: 25, amount: 2400000, settled: 24, defaulted: 0, rate: 96, days: 27 },
                  { month: '2023-10', advances: 21, amount: 2050000, settled: 20, defaulted: 1, rate: 95, days: 30 },
                ].map((cohort, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{cohort.month}</td>
                    <td className="text-right mono">{cohort.advances}</td>
                    <td className="text-right mono">{formatZAR(cohort.amount)}</td>
                    <td className="text-right mono" style={{ color: 'var(--status-success)' }}>{cohort.settled}</td>
                    <td className="text-right mono" style={{ color: cohort.defaulted > 0 ? 'var(--status-danger)' : 'var(--text-tertiary)' }}>{cohort.defaulted}</td>
                    <td className="text-right mono" style={{ color: cohort.rate > 90 ? 'var(--accent-primary)' : 'var(--status-warning)' }}>{cohort.rate}%</td>
                    <td className="text-right mono">{cohort.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Risk Distribution Section */}
          <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
          RISK TIER DISTRIBUTION
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { tier: 'PRIME', percentage: riskData?.prime_percentage || 0, color: TIER_COLOR.PRIME },
              { tier: 'STANDARD', percentage: riskData?.standard_percentage || 0, color: TIER_COLOR.STANDARD },
              { tier: 'ELEVATED', percentage: riskData?.elevated_percentage || 0, color: TIER_COLOR.ELEVATED },
              { tier: 'HIGH', percentage: riskData?.high_percentage || 0, color: TIER_COLOR.HIGH },
            ].map(t => (
              <div key={t.tier}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {t.tier}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t.percentage}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${t.percentage}%`, background: t.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Operator Table */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
            OPERATORS
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operator Name</th>
                  <th className="text-right">Health Score</th>
                  <th className="text-right">Outstanding</th>
                  <th>Risk Tier</th>
                </tr>
              </thead>
              <tbody>
                {operators.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No operators found</td></tr>
                ) : operators.map(op => (
                  <tr
                    key={op.id}
                    style={{ cursor: 'pointer', background: selectedOperator === op.id ? 'var(--bg-surface-hover)' : 'transparent' }}
                    onClick={() => setSelectedOperator(op.id)}
                  >
                    <td style={{ fontWeight: 500 }}>{op.name}</td>
                    <td className="text-right mono" style={{ fontSize: 12, color: op.health_score > 70 ? 'var(--accent-primary)' : 'var(--status-warning)' }}>
                      {op.health_score}
                    </td>
                    <td className="text-right mono" style={{ fontSize: 12 }}>
                      {formatZAR(op.advances_outstanding)}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: TIER_COLOR[op.risk_tier] || 'var(--text-secondary)',
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2
                      }}>
                        {op.risk_tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Advances */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
            RECENT ADVANCES
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Fee Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No advances found</td></tr>
                ) : advances.map(adv => (
                  <tr key={adv.id}>
                    <td style={{ fontSize: 12 }}>{adv.operator_name}</td>
                    <td className="text-right mono" style={{ fontSize: 12 }}>
                      {formatZAR(adv.amount)}
                    </td>
                    <td className="text-right mono" style={{ fontSize: 12, color: 'var(--accent-primary)' }}>
                      {adv.fee_rate}%
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: adv.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--text-tertiary)',
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        borderRadius: 2
                      }}>
                        {adv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

          {/* AI Risk Scoring Section */}
          {selectedOperator && !operatorRisk && (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
                AI RISK SCORING
              </div>
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Risk scoring data not yet available for this operator.
                </div>
              </div>
            </div>
          )}

          {selectedOperator && operatorRisk && (
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
            AI RISK SCORING — {operatorRisk.operator_name}
          </div>
          <div className="card" style={{ padding: 24 }}>
            {/* Overall Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Overall Risk Score</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: TIER_COLOR[operatorRisk.risk_tier] }}>
                  {operatorRisk.overall_score}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  Tier: {operatorRisk.risk_tier} • CI: {operatorRisk.confidence_interval}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Recommended Fee Rate</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {operatorRisk.fee_rate}%
                </div>
              </div>
            </div>

            {/* 7-Pillar Breakdown */}
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16 }}>
              7-Pillar Risk Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {operatorRisk.pillars.map((pillar, i) => (
                <div key={i} style={{
                  padding: 16,
                  background: 'var(--bg-surface-hover)',
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pillar.name}
                    </span>
                    <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: pillar.score > 70 ? 'var(--accent-primary)' : pillar.score > 50 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                      {pillar.score}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      height: '100%',
                      width: `${pillar.score}%`,
                      background: pillar.score > 70 ? 'var(--accent-primary)' : pillar.score > 50 ? 'var(--status-warning)' : 'var(--status-danger)',
                      borderRadius: 2,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {pillar.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}
