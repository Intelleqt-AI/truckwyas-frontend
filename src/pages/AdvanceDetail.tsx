import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/formatters";
import "./finance-brand.css";
import { ChevronLeft } from "lucide-react";
import SectionHeader from "@/components/layout/SectionHeader";

const TIER_META: Record<string, { tone: string; label: string; feeRange: string; desc: string }> = {
  PRIME:    { tone: 'success', label: 'Prime',    feeRange: '1.5% to 2.0%', desc: 'Low-risk customer with strong payment history.' },
  STANDARD: { tone: 'info',    label: 'Standard', feeRange: '2.0% to 2.75%', desc: 'Normal risk: a reliable customer who pays within usual terms.' },
  ELEVATED: { tone: 'warning', label: 'Elevated', feeRange: '2.75% to 3.5%', desc: 'Moderate risk: a slower payer or an older invoice.' },
  HIGH:     { tone: 'danger',  label: 'High',     feeRange: '3.5% to 4.5%', desc: 'Higher risk: a history of late payment.' },
};

// Sentence-case a status token for display: "IN_TRANSIT" → "In transit".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const STATUS_TONE: Record<string, string> = {
  REQUESTED: 'info',
  APPROVED: 'success',
  DISBURSED: 'success',
  FUNDED: 'success',
  ACTIVE: 'warning',
  SETTLED: 'neutral',
  REPAID: 'neutral',
  DENIED: 'danger',
};

const chip = (tone?: string) => `fin-chip${tone && tone !== 'neutral' ? ` fin-chip--${tone}` : ''}`;
const safeDate = (d?: string | null) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? String(d) : formatDate(t);
};
const safeDateTime = (d?: string | null) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? String(d) : formatDateTime(t);
};
const labelStyle = { fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)' } as const;
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 } as const;

export default function AdvanceDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advance, setAdvance] = useState<any>(null);

  useEffect(() => {
    const loadAdvance = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchData(`api/v1/advances/${id}/`);
        setAdvance(data);
      } catch (err) {
        console.error('Failed to load advance:', err);
        setError('Failed to load advance details');
      } finally {
        setLoading(false);
      }
    };

    if (id) loadAdvance();
  }, [id]);

  // The head renders at once; only the content waits, as a skeleton.
  if (loading) {
    return (
      <div className="fin-page">
        <SectionHeader eyebrow="Fast Pay" title={`Advance #${id ?? ''}`} />
        <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 'var(--card-gap, 16px)' }}>
          <div style={{ height: 160, borderRadius: 'var(--radius-card)', background: 'var(--bg-surface-hover)' }} />
          <div style={{ height: 240, borderRadius: 'var(--radius-card)', background: 'var(--bg-surface-hover)' }} />
        </div>
      </div>
    );
  }

  if (error || !advance) {
    return (
      <div className="fin-page">
        <div className="card fin-empty">
          <h1 className="fin-empty__title" style={{ fontSize: 22, lineHeight: '28px' }}>Advance not found</h1>
          <p className="fin-empty__body">{error ? 'We couldn’t load this advance. Check your connection and try again.' : 'It may have been removed, or the link is wrong.'}</p>
          <button className="btn-action" onClick={() => navigate('/capital')}>Back to Fast Pay</button>
        </div>
      </div>
    );
  }

  // Extract data with fallbacks
  const status = advance.status || 'REQUESTED';
  const invoiceNumber = advance.invoice_number || advance.invoiceNumber || '—';
  const customerName = advance.customer_name || advance.customerName || '—';
  // API returns Decimal fields as strings — coerce to numbers before any math/toFixed.
  const grossAmount = Number(advance.invoice_total || advance.gross_amount || advance.invoice_amount || advance.amount || 0);
  const feePercent = Number(advance.fee_percent ?? 2.0) || 2.0;
  const feeAmount = Number(advance.fee_amount || advance.fee || 0) || (grossAmount * feePercent / 100);
  const netAmount = Number(advance.net_amount || advance.advanced_amount || advance.advancedAmount || 0) || (grossAmount - feeAmount);
  const createdAt = advance.created_at || advance.createdAt || new Date().toISOString();
  const approvedAt = advance.approved_at || advance.approvedAt || null;
  const disbursedAt = advance.disbursed_at || advance.disbursedAt || null;
  const settledAt = advance.settled_at || advance.settledAt || null;
  const repaymentDate = advance.repayment_date || advance.due_date || advance.dueDate || null;

  const riskDetail = advance.risk_score_detail || null;
  const riskTier = (riskDetail?.tier || advance.risk_tier || '').toUpperCase();
  const riskScore = riskDetail?.total_score ?? advance.risk_score ?? null;
  const tierMeta = TIER_META[riskTier] || null;
  const factorsBreakdown: Record<string, number> = riskDetail?.factors_breakdown || {};

  // Timeline steps
  const timelineSteps = [
    { label: 'Requested', date: createdAt, completed: true },
    { label: 'Under review', date: createdAt, completed: !!createdAt },
    { label: 'Approved', date: approvedAt, completed: !!approvedAt },
    { label: 'Disbursed', date: disbursedAt, completed: !!disbursedAt },
    { label: 'Repaid', date: settledAt, completed: !!settledAt },
  ];

  return (
    <div className="fin-page">
      <button
        type="button"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, padding: 0, minHeight: 40 }}
        onClick={() => navigate('/capital')}
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Back to Fast Pay
      </button>

      <SectionHeader
        eyebrow="Fast Pay"
        title={`Advance #${advance.id}`}
        titleAdornment={<span className={chip(STATUS_TONE[status])} style={{ borderRadius: 'var(--radius-chip)' }}>{formatStatus(status)}</span>}
        description={<>Requested {safeDateTime(createdAt)}. Invoice <span style={{ fontVariantNumeric: 'tabular-nums' }}>{invoiceNumber}</span>, {customerName}.</>}
      />

      <div className="fin-grid-2" style={{ alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* Key amount */}
          <section className="card" aria-labelledby="amount-title">
            <h2 id="amount-title" className="fin-kpi__label" style={{ margin: 0 }}>Net payout</h2>
            <div className="fin-kpi__value">{formatCurrency(netAmount)}</div>
            <div className="fin-kpi__sub">{disbursedAt ? `Paid to your account on ${safeDate(disbursedAt)}` : 'Paid to your account once disbursed'}</div>
            <dl style={{ display: 'grid', gap: 8, margin: '20px 0 0', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 14, lineHeight: '20px' }}>
              <div style={rowStyle}>
                <dt style={{ color: 'var(--text-secondary)' }}>Invoice amount</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{formatCurrency(grossAmount)}</dd>
              </div>
              <div style={rowStyle}>
                <dt style={{ color: 'var(--text-secondary)' }}>Fee ({formatPercent(feePercent)})</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>−{formatCurrency(feeAmount)}</dd>
              </div>
              <div style={{ ...rowStyle, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <dt style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Net advanced</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(netAmount)}</dd>
              </div>
            </dl>
          </section>

          {/* Invoice details */}
          <section className="card" aria-labelledby="invoice-title">
            <div className="fin-card-head">
              <h2 id="invoice-title" className="fin-h2">Invoice</h2>
              <button
                type="button"
                className="btn-action fin-btn-secondary"
                onClick={() => navigate(`/finance/invoices/${advance.invoice || advance.invoice_id}`)}
              >
                View invoice
              </button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, margin: 0 }}>
              <div>
                <dt style={labelStyle}>Invoice number</dt>
                <dd style={{ margin: '4px 0 0' }}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{invoiceNumber}</span></dd>
              </div>
              <div>
                <dt style={labelStyle}>Customer</dt>
                <dd style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{customerName}</dd>
              </div>
              {repaymentDate && (
                <div>
                  <dt style={labelStyle}>Repayment due</dt>
                  <dd style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{safeDate(repaymentDate)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Timeline */}
          <section className="card" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="fin-h2" style={{ marginBottom: 16 }}>Status timeline</h2>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 20 }}>
              {timelineSteps.map((step, index) => (
                <li key={index} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: step.completed ? 'var(--accent-primary)' : 'var(--bg-surface-hover)',
                        border: step.completed ? 'none' : '1px solid var(--border-subtle)',
                        color: step.completed ? 'var(--btn-action-color)' : 'var(--text-tertiary)',
                        fontWeight: 600, fontSize: 13,
                      }}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div style={{
                        position: 'absolute', left: '50%', top: 24, width: 2, height: 38,
                        background: step.completed ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        transform: 'translateX(-50%)',
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: step.completed ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {step.label}
                      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{step.completed ? ' (done)' : ' (not yet)'}</span>
                    </div>
                    {step.date && (
                      <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                        {safeDateTime(step.date)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* Key dates */}
          {(disbursedAt || repaymentDate || settledAt) && (
            <section className="card" aria-labelledby="dates-title">
              <h2 id="dates-title" className="fin-h2" style={{ marginBottom: 12 }}>Key dates</h2>
              <dl style={{ display: 'grid', gap: 12, margin: 0 }}>
                {disbursedAt && (
                  <div>
                    <dt style={labelStyle}>Disbursed</dt>
                    <dd style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{safeDate(disbursedAt)}, funds transferred</dd>
                  </div>
                )}
                {repaymentDate && !settledAt && (
                  <div>
                    <dt style={labelStyle}>Repayment due</dt>
                    <dd style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{safeDate(repaymentDate)}, repaid when your customer pays</dd>
                  </div>
                )}
                {settledAt && (
                  <div>
                    <dt style={labelStyle}>Settled</dt>
                    <dd style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{safeDate(settledAt)}, fully repaid</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Fee breakdown */}
          <section className="card" aria-labelledby="fee-title">
            <h2 id="fee-title" className="fin-h2" style={{ marginBottom: 4 }}>Fee breakdown</h2>
            <p className="fin-support" style={{ marginBottom: 12 }}>
              The fee for receiving cash before your customer pays the invoice.
            </p>
            <dl style={{ display: 'grid', gap: 8, margin: 0, fontSize: 14, lineHeight: '20px' }}>
              <div style={rowStyle}>
                <dt style={{ color: 'var(--text-secondary)' }}>Fee rate</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{formatPercent(feePercent)}</dd>
              </div>
              <div style={{ ...rowStyle, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <dt style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total fee</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(feeAmount)}</dd>
              </div>
            </dl>
          </section>

          {/* Risk assessment */}
          {tierMeta && (
            <section className="card" aria-labelledby="risk-title">
              <h2 id="risk-title" className="fin-h2" style={{ marginBottom: 12 }}>Risk assessment</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className={chip(tierMeta.tone)}>{tierMeta.label}</span>
                {riskScore !== null && (
                  <span className="fin-chip" style={{ fontVariantNumeric: 'tabular-nums' }}>Score {Number(riskScore).toFixed(0)}</span>
                )}
              </div>
              <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{tierMeta.desc}</p>
              <div style={{ ...rowStyle, fontSize: 13, lineHeight: '20px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fee range for this tier</span>
                <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{tierMeta.feeRange}</span>
              </div>
              {Object.keys(factorsBreakdown).length > 0 && (
                <>
                  <h3 style={{ ...labelStyle, margin: '16px 0 8px', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>Score factors</h3>
                  <dl style={{ display: 'grid', gap: 6, margin: 0 }}>
                    {Object.entries(factorsBreakdown)
                      .filter(([, val]) => typeof val === 'number' && !isNaN(val))
                      .map(([key, val]) => (
                        <div key={key} style={{ ...rowStyle, fontSize: 13, lineHeight: '20px' }}>
                          <dt style={{ color: 'var(--text-secondary)' }}>{formatStatus(key)}</dt>
                          <dd style={{ margin: 0, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(val as number, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</dd>
                        </div>
                      ))}
                  </dl>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
