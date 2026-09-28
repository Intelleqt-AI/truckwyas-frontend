import './table-heading-roles.css';
import './finance-brand.css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { Loader } from '@/components/Loader';

const TIER_COLOR: Record<string, string> = {
  PRIME: 'var(--status-success)',
  STANDARD: 'var(--accent-primary)',
  ELEVATED: 'var(--status-warning)',
  HIGH: 'var(--status-danger)',
  INELIGIBLE: 'var(--text-tertiary)',
};

// Sentence-case a single token for display: "PRIME" → "Prime".
const cap = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

const TIER_TONE: Record<string, string> = {
  PRIME: 'success',
  STANDARD: 'info',
  ELEVATED: 'warning',
  HIGH: 'danger',
  INELIGIBLE: 'neutral',
};
const tierChip = (t?: string) => {
  const tone = TIER_TONE[t || ''] || 'neutral';
  return `fin-chip${tone === 'neutral' ? '' : ` fin-chip--${tone}`}`;
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
        <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
      </div>
    </div>
  );
};

export default function RiskScoreView() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Customer risk scores - TruckWys';
  }, []);

  const { data: riskData, isLoading: loadingScores } = useQuery({
    queryKey: ['risk-scores'],
    queryFn: () => fetchData('api/v1/risk/score/'),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchData('api/v1/customers/'),
  });

  const { data: eligibleData, isLoading: loadingEligible } = useQuery({
    queryKey: ['eligible-invoices-risk'],
    queryFn: () => fetchData('api/v1/capital/eligible/'),
  });

  const isLoading = loadingScores || loadingEligible;

  const scores = Array.isArray(riskData) ? riskData : (riskData?.results || []);
  const customers = Array.isArray(customersData) ? customersData : (customersData?.results || []);
  const eligibleInvoices: any[] = eligibleData?.invoices || [];

  // Build a map of stored risk scores keyed by customer_id (best score per customer)
  const byCustomer: Record<number, any[]> = {};
  for (const s of scores) {
    const cid = s.customer || s.customer_id;
    if (!byCustomer[cid]) byCustomer[cid] = [];
    byCustomer[cid].push(s);
  }

  // Merge in eligible invoice scores for customers not yet in byCustomer
  for (const inv of eligibleInvoices) {
    const cid = inv.customer_id;
    if (!cid) continue;
    if (!byCustomer[cid]) {
      // Shape it to match stored risk score structure
      byCustomer[cid] = [{
        id: `eligible-${inv.id}`,
        customer: cid,
        customer_id: cid,
        customer_name: inv.customer,
        total_score: Math.round(inv.risk_score || 0),
        tier: String(inv.risk_tier || inv.tier || 'HIGH').toUpperCase(),
        fee_percent: inv.fee_rate_pct,
        is_eligible: true,
        factor_payment_history: null,
        factor_invoice_age: null,
        factor_pod_quality: null,
      }];
    }
  }

  // Get best score per customer
  const customerScores = Object.entries(byCustomer).map(([cid, ss]) => {
    const best = ss.sort((a, b) => b.total_score - a.total_score)[0];
    const cust = customers.find((c: any) => c.id === parseInt(cid));
    const name = best.customer_name || cust?.name || `Customer ${cid}`;
    return { ...best, customer_name: name, cid: parseInt(cid) };
  }).sort((a, b) => b.total_score - a.total_score);

  const tiers = ['PRIME', 'STANDARD', 'ELEVATED', 'HIGH', 'INELIGIBLE'];
  const tierCounts = tiers.reduce((acc, t) => ({ ...acc, [t]: customerScores.filter(c => c.tier === t).length }), {} as Record<string, number>);
  const avgScore = customerScores.length > 0 ? Math.round(customerScores.reduce((s, c) => s + c.total_score, 0) / customerScores.length) : 0;

  const FEE_MAP: Record<string, number> = { PRIME: 2.0, STANDARD: 2.5, ELEVATED: 3.5, HIGH: 4.5, INELIGIBLE: 0 };

  return (
    <div className="fin-page">
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Fast Pay</div>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Customer risk scores</h1>
        <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Creditworthiness scores used to check Fast Pay eligibility.
        </p>
      </header>

      {/* Tier counts */}
      <div className="fin-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {tiers.map(t => (
          <div key={t} className="card fin-kpi">
            <span className="fin-kpi__label"><span className={tierChip(t)}>{cap(t)}</span></span>
            <span className="fin-kpi__value">{tierCounts[t] || 0}</span>
            <span className="fin-kpi__sub">{FEE_MAP[t] > 0 ? `${FEE_MAP[t]}% fee` : 'Not eligible'}</span>
          </div>
        ))}
      </div>

      <div className="fin-grid-2">
        {/* Portfolio score card */}
        <section className="card" aria-labelledby="portfolio-title">
          <h2 id="portfolio-title" className="fin-h2" style={{ marginBottom: 16 }}>Portfolio overview</h2>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <ScoreRing score={avgScore} tier={avgScore >= 85 ? 'PRIME' : avgScore >= 70 ? 'STANDARD' : avgScore >= 55 ? 'ELEVATED' : avgScore >= 40 ? 'HIGH' : 'INELIGIBLE'} />
            <div>
              <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>Portfolio score {avgScore}/100</div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 4 }}>{customerScores.length} customers scored</div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{customerScores.filter(c => c.tier !== 'INELIGIBLE').length} eligible for Fast Pay</div>
            </div>
          </div>
        </section>

        {/* Score factors legend */}
        <section className="card" aria-labelledby="factors-title">
          <h2 id="factors-title" className="fin-h2" style={{ marginBottom: 8 }}>Score factors</h2>
          <dl style={{ margin: 0 }}>
            {[
              { label: 'Payment history', weight: 35 },
              { label: 'Invoice age', weight: 20 },
              { label: 'POD quality', weight: 15 },
              { label: 'Credit score', weight: 15 },
              { label: 'Relationship', weight: 10 },
              { label: 'Facility use', weight: 5 },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)', fontSize: 13, lineHeight: '20px' }}>
                <dt style={{ color: 'var(--text-secondary)' }}>{f.label}</dt>
                <dd style={{ margin: 0, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{f.weight} pts</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Customer table */}
      <section className="card fin-table-card" aria-labelledby="scores-title">
        <div className="fin-table-card__head">
          <h2 id="scores-title" className="fin-h2">All customers</h2>
          <span className="fin-support">{customerScores.length} scored</span>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}><Loader size={28} label="Loading scores…" /></div>
        ) : customerScores.length === 0 ? (
          <div className="fin-empty">
            <p className="fin-empty__title">No risk scores yet</p>
            <p className="fin-empty__body">Scores are calculated from each customer’s invoice and payment history.</p>
          </div>
        ) : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Score</th>
                  <th>Tier</th>
                  <th className="num">Payment history</th>
                  <th className="num">Invoice age</th>
                  <th className="num">POD</th>
                  <th className="num">Fast Pay fee</th>
                  <th>Eligible</th>
                </tr>
              </thead>
              <tbody>
                {customerScores.map((cs: any) => (
                  <tr key={cs.id} className="is-clickable" onClick={() => navigate(`/customers/${cs.cid}`)}>
                    <td className="fin-strong">{cs.customer_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--border-subtle)', borderRadius: 2 }} aria-hidden="true">
                          <div style={{ height: 4, width: `${cs.total_score}%`, background: TIER_COLOR[cs.tier] || 'var(--accent-primary)', borderRadius: 2 }} />
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{cs.total_score}</span>
                      </div>
                    </td>
                    <td><span className={tierChip(cs.tier)}>{cap(cs.tier)}</span></td>
                    <td className="num">{cs.factor_payment_history ?? '—'}/35</td>
                    <td className="num">{cs.factor_invoice_age ?? '—'}/20</td>
                    <td className="num">{cs.factor_pod_quality ?? '—'}/15</td>
                    <td className="num">
                      {cs.is_eligible ? `${parseFloat(cs.fee_percent || FEE_MAP[cs.tier] || 0).toFixed(1)}%` : '—'}
                    </td>
                    <td>
                      <span className={`fin-chip ${cs.is_eligible ? 'fin-chip--success' : 'fin-chip--danger'}`}>
                        {cs.is_eligible ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
