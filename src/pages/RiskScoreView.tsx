import './table-heading-roles.css';
import './finance-brand.css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatDate } from '@/lib/formatters';
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import { Loader } from '@/components/Loader';


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
  const maxTier = Math.max(0, ...tiers.map(t => tierCounts[t] || 0));
  const expiredCount = customerScores.filter((c: any) => c.is_expired || c.is_valid === false).length;
  const scoredOn = (c: any) => {
    const d = c.calculated_at || c.created_at;
    if (!d) return '—';
    const t = new Date(d);
    return isNaN(t.getTime()) ? '—' : formatDate(t);
  };

  // The scoring model's own pillars and weights, read from a stored score.
  const pillars: any[] = (scores.find((x: any) => x?.factors_breakdown?.pillars?.length)?.factors_breakdown?.pillars) || [];

  return (
    <div className="fin-page">
      <header className="fin-detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="fin-detail-head__eyebrow">Fast Pay</div>
          <div className="fin-detail-head__title-row"><h1>Customer risk scores</h1></div>
          <p className="fin-detail-head__sub" style={{ maxWidth: '72ch' }}>
            How safe each customer's invoices would be to advance, scored out of 100 by the Fast Pay rules. Higher is safer.
            {!CAPITAL_LAUNCHED && ` ${CAPITAL_COMING_SOON}`}
          </p>
        </div>
      </header>

      <div className="fin-grid-2">
        <section className="card" aria-labelledby="tiers-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="tiers-title" className="fin-panel-title">How are your customers spread across risk tiers?</h2>
              <p className="fin-panel-desc">
                {customerScores.length > 0
                  ? `${customerScores.length} customers scored, average ${avgScore} out of 100. Each customer's highest stored score is shown.${expiredCount > 0 ? ` ${expiredCount === customerScores.length ? 'All' : expiredCount} of these scores ${expiredCount === 1 ? 'has' : 'have'} expired, so treat them as out of date.` : ''}`
                  : 'Customers appear here once their invoices are scored.'}
              </p>
            </div>
          </div>
          <div className="fin-rank" role="table" aria-label="Customers per risk tier">
            <div className="fin-rank__row fin-rank__head" role="row">
              <span role="columnheader">Tier</span>
              <span aria-hidden="true" />
              <span role="columnheader" className="fin-rank__value">Customers</span>
              <span role="columnheader" className="fin-rank__share">Share</span>
            </div>
            {tiers.map(t => (
              <div key={t} className={`fin-rank__row${(tierCounts[t] || 0) === 0 ? ' is-thin' : ''}`} role="row">
                <span className="fin-rank__label" role="cell"><span className={tierChip(t)}>{cap(t)}</span></span>
                <span className="fin-rank__track" aria-hidden="true">
                  <span className="fin-rank__bar" style={{ display: 'block', width: `${maxTier > 0 ? ((tierCounts[t] || 0) / maxTier) * 100 : 0}%` }} />
                </span>
                <span className="fin-rank__value" role="cell">{tierCounts[t] || 0}</span>
                <span className="fin-rank__share" role="cell">
                  {customerScores.length > 0 ? `${Math.round(((tierCounts[t] || 0) / customerScores.length) * 100)}%` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="factors-title">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="factors-title" className="fin-panel-title">What goes into a score?</h2>
              <p className="fin-panel-desc">{pillars.length > 0 ? `The ${pillars.length} areas the model scores, and how much each counts towards 100.` : 'The areas the model scores.'}</p>
            </div>
          </div>
          {pillars.length === 0 ? (
            <div className="fin-empty fin-empty--compact">The breakdown appears once a customer is scored.</div>
          ) : (
            <dl className="fin-dl">
              {pillars.map((p: any) => (
                <div key={p.pillar} className="fin-dl__row">
                  <dt>{String(p.pillar).replace(/ & /g, ' and ').toLowerCase().replace(/^./, (c: string) => c.toUpperCase())}</dt>
                  <dd>{Math.round((p.weight ?? 0) * 100)} pts</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section className="card fin-table-card" aria-labelledby="scores-title">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="scores-title" className="fin-panel-title">Which customers are safest to advance against?</h2>
            <p className="fin-panel-desc">Highest score first. Eligibility follows the Fast Pay rules at the time of scoring.</p>
          </div>
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
                  <th>Scored</th>
                  <th>Meets the rules</th>
                  {CAPITAL_LAUNCHED && <th className="num">Fee</th>}
                </tr>
              </thead>
              <tbody>
                {customerScores.map((cs: any) => {
                  const expired = cs.is_expired || cs.is_valid === false;
                  return (
                    <tr key={cs.id} className="is-clickable" onClick={() => navigate(`/customers/${cs.cid}`)}>
                      <td className="fin-strong"><div className="fin-truncate" title={cs.customer_name}>{cs.customer_name}</div></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{cs.total_score}</span>
                          <div className="fin-rank__track" style={{ width: 64 }} aria-hidden="true">
                            <div className="fin-rank__bar" style={{ width: `${Math.max(0, Math.min(100, cs.total_score))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><span className={tierChip(cs.tier)}>{cap(cs.tier)}</span></td>
                      <td className="fin-date">
                        {scoredOn(cs)}
                        {expired && <span className="fin-text-muted"> · expired</span>}
                      </td>
                      <td>{cs.is_eligible ? 'Yes' : <span className="fin-text-muted">No</span>}</td>
                      {CAPITAL_LAUNCHED && (
                        <td className="num">{cs.is_eligible && cs.fee_percent != null ? `${parseFloat(cs.fee_percent).toFixed(1)}%` : '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
