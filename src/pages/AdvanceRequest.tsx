import './capital-typography.css';
import './table-heading-roles.css';
import './finance-brand.css';
import { CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchData, postData } from "@/lib/Api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Loader } from "@/components/Loader";

const TIER_TONE: Record<string, string> = {
  prime: 'success', standard: 'info',
  elevated: 'warning', high: 'danger',
};
const tierChip = (t?: string) => `fin-chip fin-chip--${TIER_TONE[(t || 'standard').toLowerCase()] || 'info'}`;
const TIER_FEE: Record<string, number> = {
  prime: 0.02, standard: 0.025, elevated: 0.035, high: 0.045,
};

// Sentence-case a single token for display: "standard" → "Standard".
const cap = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

export default function AdvanceRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('invoice_id');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(preSelectedId);
  const [bankAccount, setBankAccount] = useState(''); // Placeholder for now

  const selectedInvoice = invoices.find(inv => String(inv.id) === String(selectedInvoiceId));
  const tier = selectedInvoice?.risk_tier || selectedInvoice?.tier || 'standard';
  const amount = selectedInvoice?.total_amount || selectedInvoice?.amount || 0;
  const feeRate = TIER_FEE[tier] || 0.025;
  const feeAmount = amount * feeRate;
  const netReceived = amount - feeAmount;

  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load eligible invoices
        try {
          const data = await fetchData('api/v1/invoices/');
          // Paginated response: {count, results}
          const allList = Array.isArray(data) ? data : (data?.results || []);
          const eligible = allList.filter((inv: any) =>
            (inv.fast_pay_eligible || inv.risk_tier === 'prime' || inv.risk_tier === 'standard') && inv.status !== 'PAID'
          );
          setInvoices(eligible);
        } catch {
          setInvoices([]);
        }
      } catch (err) {
        console.error('Failed to load invoices:', err);
        setError('Failed to load eligible invoices');
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  const handleSubmit = async () => {
    if (!selectedInvoiceId) return;
    setSubmitting(true);
    setError(null);
    try {
      await postData({
        url: '/api/v1/advances/',
        data: { invoice_id: selectedInvoiceId }
      });
      // Success - navigate to success view (step 4) or back to capital
      setStep(4);
    } catch (err: any) {
      console.error('Advance request failed:', err);
      setError(err?.response?.data?.detail || 'Failed to submit advance request. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  // Step 4 - Success screen
  if (step === 4) {
    return (
      <div className="capital-typography fin-page">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'normal', textTransform: 'none', marginBottom: 4 }}>Capital</div>
          <h1 style={{ fontSize: 22, lineHeight: '28px', fontFamily: 'var(--font-sans)', margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Request submitted</h1>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center', alignItems: 'center' }}>
          <CheckCircle2 size={48} aria-hidden="true" style={{ margin: '0 auto 16px', color: 'var(--accent-primary)' }} />
          <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
            Advance request for {formatCurrency(netReceived)} submitted
          </div>
          <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Your request has been received. Its status will update on the Capital page as it progresses.
          </div>
          <button
            className="btn-action"
            style={{ padding: '10px 24px', minHeight: 40, background: 'var(--accent-primary)', color: 'var(--btn-action-color)', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, lineHeight: '20px' }}
            onClick={() => navigate('/capital')}
          >
            Back to capital
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="capital-typography fin-page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'normal', textTransform: 'none', marginBottom: 4 }}>Capital</div>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontFamily: 'var(--font-sans)', margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Request advance</h1>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 4 }}>Get paid early on an eligible invoice in three steps.</div>
      </div>

      {/* Step counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step >= s ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: step >= s ? 'var(--btn-action-color)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
              border: step === s ? '2px solid var(--accent-primary)' : 'none'
            }}>
              {s}
            </div>
            <span style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: step >= s ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'none' }}>
              {s === 1 ? 'Select' : s === 2 ? 'Review' : 'Confirm'}
            </span>
            {s < 3 && <div style={{ width: 40, height: 2, background: step > s ? 'var(--accent-primary)' : 'var(--border-subtle)' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, background: 'var(--status-danger)', color: 'var(--btn-action-color)', fontSize: 13, lineHeight: '20px' }}>
          {error}
        </div>
      )}

      {/* STEP 1: Invoice selector */}
      {step === 1 && (
        <div className="card table-card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Step 1: Select invoice</h2>
            <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>{invoices.length} eligible</span>
          </div>
          {invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              <p style={{ margin: '0 0 16px' }}>No eligible invoices available.</p>
              <button type="button" className="btn-action fin-btn-secondary" onClick={() => navigate('/capital')}>Back to Capital</button>
            </div>
          ) : (
            <>
              <table className="fin-table table-heading-roles">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Select</span></th>
                    <th>Invoice #</th><th>Customer</th><th className="num">Amount</th><th>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr
                      key={inv.id}
                      style={{ cursor: 'pointer', background: selectedInvoiceId === String(inv.id) ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setSelectedInvoiceId(String(inv.id))}
                    >
                      <td>
                        <input
                          type="radio"
                          checked={selectedInvoiceId === String(inv.id)}
                          onChange={() => setSelectedInvoiceId(String(inv.id))}
                          aria-label={`Select invoice ${inv.invoice_number || inv.invoiceNumber}`}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td><span className="fin-id">{inv.invoice_number || inv.invoiceNumber}</span></td>
                      <td className="fin-strong">{inv.customer_name || inv.customerName}</td>
                      <td className="num capital-amount">{formatCurrency(inv.total_amount || inv.amount)}</td>
                      <td>
                        <span className={tierChip(inv.risk_tier || inv.tier || 'standard')}>
                          {cap(inv.risk_tier || inv.tier || 'standard')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0' }}>
                <button
                  className="btn-action"
                  style={{ padding: '8px 16px', minHeight: 40, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px' }}
                  onClick={() => navigate('/capital')}
                >
                  Cancel
                </button>
                <button
                  className="btn-action"
                  disabled={!selectedInvoiceId}
                  style={{
                    padding: '8px 16px',
                    background: selectedInvoiceId ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    color: selectedInvoiceId ? 'var(--btn-action-color)' : 'var(--text-tertiary)',
                    border: 'none', borderRadius: 6,
                    cursor: selectedInvoiceId ? 'pointer' : 'not-allowed',
                    minHeight: 40,
                    fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 600
                  }}
                  onClick={() => selectedInvoiceId && setStep(2)}
                >
                  Continue →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Fee breakdown */}
      {step === 2 && selectedInvoice && (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Step 2: Fee breakdown</h2>
          </div>
          <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-surface-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Selected invoice</div>
            <div className="fin-id" style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500 }}>{selectedInvoice.invoice_number}</div>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 2 }}>{selectedInvoice.customer_name}</div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Invoice amount</span>
              <span style={{ fontSize: 16, lineHeight: '24px', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Risk tier</span>
              <span className={tierChip(tier)}>
                {cap(tier)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Fee ({(feeRate * 100).toFixed(1)}%)</span>
              <span style={{ fontSize: 16, lineHeight: '24px', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>−{formatCurrency(feeAmount)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>You receive</span>
              <span style={{ fontSize: 28, lineHeight: '36px', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(netReceived)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Estimated repayment date</span>
              <span style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                {selectedInvoice.due_date ? formatDate(selectedInvoice.due_date) : 'On invoice due date'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Bank account</span>
              <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>Default account on file</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
            <button
              className="btn-action"
              style={{ padding: '10px 20px', minHeight: 40, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px' }}
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              className="btn-action"
              style={{ padding: '10px 20px', minHeight: 40, background: 'var(--accent-primary)', color: 'var(--btn-action-color)', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 600 }}
              onClick={() => setStep(3)}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation */}
      {step === 3 && selectedInvoice && (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Step 3: Confirm request</h2>
          </div>

          <div style={{ padding: 20, background: 'var(--bg-surface-hover)', borderRadius: 6, marginBottom: 24 }}>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 12 }}>You are requesting an advance of:</div>
            <div style={{ fontSize: 28, lineHeight: '36px', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{formatCurrency(netReceived)}</div>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>on invoice <span className="fin-id">{selectedInvoice.invoice_number}</span></div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 6 }}>
            By confirming, you request an advance of the net amount to your registered bank account.
            The advance is repaid automatically when the customer pays the invoice.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <button
              className="btn-action"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-surface)',
                color: submitting ? 'var(--text-tertiary)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                cursor: submitting ? 'not-allowed' : 'pointer',
                minHeight: 40,
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px'
              }}
              onClick={() => !submitting && setStep(2)}
            >
              ← Back
            </button>
            <button
              className="btn-action"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: submitting ? 'var(--bg-surface)' : 'var(--accent-primary)',
                color: submitting ? 'var(--text-tertiary)' : 'var(--btn-action-color)',
                border: 'none', borderRadius: 6,
                cursor: submitting ? 'not-allowed' : 'pointer',
                minHeight: 40,
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 600
              }}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting…' : 'Confirm request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
