import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchData, postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const TIER_COLOR: Record<string, string> = {
  prime: 'var(--accent-primary)', standard: 'var(--status-success)',
  elevated: 'var(--status-warning)', high: 'var(--status-danger)',
};
const TIER_FEE: Record<string, number> = {
  prime: 0.02, standard: 0.025, elevated: 0.035, high: 0.045,
};

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

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
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
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Request Advance</div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading eligible invoices...</div>
        </div>
      </div>
    );
  }

  // Step 4 - Success screen
  if (step === 4) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Request Submitted</div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--status-success)', marginBottom: 8 }}>
            Your {formatCurrency(netReceived)} is being processed
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Estimated disbursement: <strong>4 hours</strong>
          </div>
          <button
            className="btn-action"
            style={{ padding: '10px 24px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}
            onClick={() => navigate('/capital')}
          >
            BACK TO CAPITAL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Request Advance</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Fast payment on eligible invoices — 3 steps.</div>
      </div>

      {/* Step counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step >= s ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: step >= s ? 'white' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              border: step === s ? '2px solid var(--accent-primary)' : 'none'
            }}>
              {s}
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: step >= s ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              {s === 1 ? 'Select' : s === 2 ? 'Review' : 'Confirm'}
            </span>
            {s < 3 && <div style={{ width: 40, height: 2, background: step > s ? 'var(--accent-primary)' : 'var(--border-subtle)' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, background: 'var(--status-danger)', color: 'white', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* STEP 1: Invoice selector */}
      {step === 1 && (
        <div className="card table-card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Step 1: Select Invoice</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{invoices.length} ELIGIBLE</span>
          </div>
          {invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No eligible invoices available.
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr
                      key={inv.id}
                      style={{ cursor: 'pointer', background: selectedInvoiceId === inv.id ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          checked={selectedInvoiceId === inv.id}
                          onChange={() => setSelectedInvoiceId(inv.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td className="mono">{inv.invoice_number || inv.invoiceNumber}</td>
                      <td>{inv.customer_name || inv.customerName}</td>
                      <td className="mono">{formatCurrency(inv.total_amount || inv.amount)}</td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: TIER_COLOR[inv.risk_tier || inv.tier || 'standard'],
                          background: 'var(--bg-surface-hover)', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase'
                        }}>
                          {inv.risk_tier || inv.tier || 'standard'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0' }}>
                <button
                  className="btn-action"
                  style={{ padding: '8px 16px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  onClick={() => navigate('/capital')}
                >
                  CANCEL
                </button>
                <button
                  className="btn-action"
                  disabled={!selectedInvoiceId}
                  style={{
                    padding: '8px 16px',
                    background: selectedInvoiceId ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    color: selectedInvoiceId ? 'white' : 'var(--text-tertiary)',
                    border: 'none', borderRadius: 2,
                    cursor: selectedInvoiceId ? 'pointer' : 'not-allowed',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600
                  }}
                  onClick={() => selectedInvoiceId && setStep(2)}
                >
                  CONTINUE →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Fee breakdown */}
      {step === 2 && selectedInvoice && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Step 2: Fee Breakdown</span>
          </div>
          <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>SELECTED INVOICE</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInvoice.invoice_number}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedInvoice.customer_name}</div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Invoice Amount</span>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Risk Tier</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: TIER_COLOR[tier],
                background: 'var(--bg-surface-hover)', padding: '4px 8px', borderRadius: 2, textTransform: 'uppercase', fontWeight: 600
              }}>
                {tier}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fee ({(feeRate * 100).toFixed(1)}%)</span>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--status-danger)' }}>-{formatCurrency(feeAmount)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>You Receive</span>
              <span style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-success)' }}>{formatCurrency(netReceived)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Estimated Repayment Date</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : 'On invoice due date'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Bank Account</span>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Default account on file</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
            <button
              className="btn-action"
              style={{ padding: '10px 20px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}
              onClick={() => setStep(1)}
            >
              ← BACK
            </button>
            <button
              className="btn-action"
              style={{ padding: '10px 20px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}
              onClick={() => setStep(3)}
            >
              CONTINUE →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation */}
      {step === 3 && selectedInvoice && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Step 3: Confirm Request</span>
          </div>

          <div style={{ padding: 20, background: 'var(--bg-surface-hover)', borderRadius: 2, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>You are requesting an advance of:</div>
            <div style={{ fontSize: 32, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 8 }}>{formatCurrency(netReceived)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>on invoice <strong>{selectedInvoice.invoice_number}</strong></div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 2 }}>
            By confirming, you authorize Truckwys to advance the net amount to your registered bank account.
            The advance will be repaid automatically when the customer pays the invoice.
            <strong style={{ color: 'var(--text-primary)' }}> Estimated disbursement: 4 hours.</strong>
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
                borderRadius: 2,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11
              }}
              onClick={() => !submitting && setStep(2)}
            >
              ← BACK
            </button>
            <button
              className="btn-action"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: submitting ? 'var(--bg-surface)' : 'var(--status-success)',
                color: submitting ? 'var(--text-tertiary)' : 'white',
                border: 'none', borderRadius: 2,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600
              }}
              onClick={handleSubmit}
            >
              {submitting ? 'SUBMITTING...' : 'CONFIRM REQUEST ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
