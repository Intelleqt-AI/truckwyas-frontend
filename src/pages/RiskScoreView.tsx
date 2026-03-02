import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

const TIER_COLOR: Record<string, string> = {
  EXCELLENT: 'var(--status-success)',
  GOOD: 'var(--accent-primary)',
  FAIR: 'var(--status-warning)',
  ELEVATED: 'var(--status-warning)',
  INELIGIBLE: 'var(--status-danger)',
};

const TIER_BG: Record<string, string> = {
  EXCELLENT: 'var(--status-success-bg)',
  GOOD: 'var(--status-success-bg)',
  FAIR: 'var(--status-warning-bg)',
  ELEVATED: 'var(--status-warning-bg)',
  INELIGIBLE: 'var(--status-danger-bg)',
};

const ScoreRing = ({ score, tier }: { score: number; tier: string }) => {
  const color = TIER_COLOR[tier] || 'var(--text-secondary)';
  const pct = (score / 100) * 283; // circumference ~283
  return (
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${pct} 283`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{score}</span>
      </div>
    </div>
  );
};

export default function RiskScoreView() {
  const navigate = useNavigate();

  const { data: riskData, isLoading } = useQuery({
    queryKey: ['risk-scores'],
    queryFn: () => fetchData('api/v1/risk/score/'),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchData('api/v1/customers/'),
  });

  const scores = Array.isArray(riskData) ? riskData : (riskData?.results || []);
  const customers = Array.isArray(customersData) ? customersData : (customersData?.results || []);

  // Group scores by customer
  const byCustomer: Record<number, any[]> = {};
  for (const s of scores) {
    const cid = s.customer || s.customer_id;
    if (!byCustomer[cid]) byCustomer[cid] = [];
    byCustomer[cid].push(s);
  }

  // Get best score per customer
  const customerScores = Object.entries(byCustomer).map(([cid, ss]) => {
    const best = ss.sort((a, b) => b.total_score - a.total_score)[0];
    const cust = customers.find((c: any) => c.id === parseInt(cid));
    return { ...best, customer_name: cust?.name || `Customer ${cid}`, cid: parseInt(cid) };
  }).sort((a, b) => b.total_score - a.total_score);

  const tiers = ['EXCELLENT', 'GOOD', 'FAIR', 'ELEVATED', 'INELIGIBLE'];
  const tierCounts = tiers.reduce((acc, t) => ({ ...acc, [t]: customerScores.filter(c => c.tier === t).length }), {} as Record<string, number>);
  const avgScore = customerScores.length > 0 ? Math.round(customerScores.reduce((s, c) => s + c.total_score, 0) / customerScores.length) : 0;

  const FEE_MAP: Record<string, number> = { EXCELLENT: 2.0, GOOD: 2.5, FAIR: 3.0, ELEVATED: 3.5, INELIGIBLE: 0 };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>FAST PAY</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Customer Risk Scores</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>AI-computed creditworthiness for fast pay eligibility</div>
      </div>

      {/* Portfolio KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {tiers.map(t => (
          <div key={t} className="card" style={{ padding: 16, background: TIER_BG[t], border: `1px solid ${TIER_COLOR[t]}22` }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TIER_COLOR[t], marginBottom: 8, letterSpacing: '0.08em' }}>{t}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: TIER_COLOR[t] }}>{tierCounts[t] || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{FEE_MAP[t] > 0 ? `${FEE_MAP[t]}% fee` : 'Not eligible'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Portfolio score card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>PORTFOLIO OVERVIEW</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <ScoreRing score={avgScore} tier={avgScore >= 85 ? 'EXCELLENT' : avgScore >= 70 ? 'GOOD' : avgScore >= 55 ? 'FAIR' : 'ELEVATED'} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Portfolio Score: {avgScore}/100</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{customerScores.length} customers scored</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{customerScores.filter(c => c.tier !== 'INELIGIBLE').length} fast pay eligible</div>
            </div>
          </div>
        </div>

        {/* Score factors legend */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>SCORE FACTORS</div>
          {[
            { label: 'Payment History', weight: 35 },
            { label: 'Invoice Age', weight: 20 },
            { label: 'POD Quality', weight: 15 },
            { label: 'Credit Score', weight: 15 },
            { label: 'Relationship', weight: 10 },
            { label: 'Facility Use', weight: 5 },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-row)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.label}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{f.weight} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>ALL CUSTOMERS — RISK SCORES</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{customerScores.length} scored</div>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING SCORES...</div>
        ) : customerScores.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>No risk scores calculated yet.</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Run: python manage.py calculate_risk_scores</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-hover)' }}>
                {['CUSTOMER', 'SCORE', 'TIER', 'PAYMENT HIST', 'OVERDUE', 'POD', 'FAST PAY FEE', 'ELIGIBLE'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textAlign: 'left', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerScores.map((cs: any) => (
                <tr key={cs.id} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-row)' }}
                  onClick={() => navigate(`/capital`)}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{cs.customer_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
                        <div style={{ height: 4, width: `${cs.total_score}%`, background: TIER_COLOR[cs.tier] || 'var(--accent-primary)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: TIER_COLOR[cs.tier], fontWeight: 600 }}>{cs.total_score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TIER_COLOR[cs.tier], padding: '3px 8px', background: TIER_BG[cs.tier], borderRadius: 2, border: `1px solid ${TIER_COLOR[cs.tier]}44` }}>{cs.tier}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{cs.factor_payment_history ?? '—'}/35</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{cs.factor_invoice_age ?? '—'}/20</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{cs.factor_pod_quality ?? '—'}/15</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: cs.is_eligible ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                    {cs.is_eligible ? `${parseFloat(cs.fee_percent || FEE_MAP[cs.tier] || 0).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: cs.is_eligible ? 'var(--status-success)' : 'var(--status-danger)' }}>
                      {cs.is_eligible ? '✓ YES' : '✗ NO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
