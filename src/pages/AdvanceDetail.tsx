import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  REQUESTED: 'var(--accent-primary)',
  APPROVED: 'var(--status-success)',
  DISBURSED: 'var(--status-success)',
  FUNDED: 'var(--status-success)',
  ACTIVE: 'var(--status-warning)',
  SETTLED: 'var(--text-tertiary)',
  REPAID: 'var(--text-tertiary)',
  DENIED: 'var(--status-danger)',
};

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

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Advance Detail</div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading advance details...</div>
        </div>
      </div>
    );
  }

  if (error || !advance) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Advance Detail</div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--status-danger)', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{error || 'Advance not found'}</div>
          <button
            className="btn-action"
            style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginTop: 12 }}
            onClick={() => navigate('/capital')}
          >
            BACK TO CAPITAL
          </button>
        </div>
      </div>
    );
  }

  // Extract data with fallbacks
  const status = advance.status || 'REQUESTED';
  const invoiceNumber = advance.invoice_number || advance.invoiceNumber || 'N/A';
  const customerName = advance.customer_name || advance.customerName || 'N/A';
  const grossAmount = advance.gross_amount || advance.invoice_amount || advance.amount || 0;
  const feePercent = advance.fee_percent || 2.0;
  const feeAmount = advance.fee_amount || advance.fee || (grossAmount * feePercent / 100);
  const netAmount = advance.net_amount || advance.advanced_amount || advance.advancedAmount || (grossAmount - feeAmount);
  const createdAt = advance.created_at || advance.createdAt || new Date().toISOString();
  const approvedAt = advance.approved_at || advance.approvedAt || null;
  const disbursedAt = advance.disbursed_at || advance.disbursedAt || null;
  const settledAt = advance.settled_at || advance.settledAt || null;
  const repaymentDate = advance.repayment_date || advance.due_date || advance.dueDate || null;

  // Timeline steps
  const timelineSteps = [
    { label: 'Requested', date: createdAt, completed: true },
    { label: 'Under Review', date: createdAt, completed: !!createdAt },
    { label: 'Approved', date: approvedAt, completed: !!approvedAt },
    { label: 'Disbursed', date: disbursedAt, completed: !!disbursedAt },
    { label: 'Repaid', date: settledAt, completed: !!settledAt },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, padding: 0 }}
          onClick={() => navigate('/capital')}
        >
          ← Back to Capital
        </button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Capital / Advance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Advance #{advance.id}</div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: STATUS_COLOR[status] || 'var(--text-tertiary)',
            background: 'var(--bg-surface-hover)',
            padding: '4px 10px',
            borderRadius: 2,
            textTransform: 'uppercase',
            fontWeight: 600
          }}>
            {status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Created {new Date(createdAt).toLocaleDateString()} at {new Date(createdAt).toLocaleTimeString()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Amount summary card */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
              <span className="card-title">Amount Summary</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Invoice Amount</span>
                <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(grossAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fee ({feePercent.toFixed(1)}%)</span>
                <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--status-danger)' }}>-{formatCurrency(feeAmount)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Net Advanced</span>
                <span style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-success)' }}>{formatCurrency(netAmount)}</span>
              </div>
            </div>
          </div>

          {/* Invoice details */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
              <span className="card-title">Invoice Details</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>Invoice Number</div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>{invoiceNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>Customer</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{customerName}</div>
              </div>
              {repaymentDate && (
                <>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>Repayment Due</div>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{new Date(repaymentDate).toLocaleDateString()}</div>
                  </div>
                </>
              )}
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>Invoice Link</div>
                <button
                  style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
                  onClick={() => navigate(`/finance/invoices/${advance.invoice_id || advance.id}`)}
                >
                  View Invoice →
                </button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header" style={{ marginBottom: 20 }}>
              <span className="card-title">Status Timeline</span>
            </div>
            <div style={{ display: 'grid', gap: 20 }}>
              {timelineSteps.map((step, index) => (
                <div key={index} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.completed ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: step.completed ? 'white' : 'var(--text-tertiary)',
                      fontWeight: 600, fontSize: 14
                    }}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div style={{
                        position: 'absolute', left: '50%', top: 32, width: 2, height: 20,
                        background: step.completed ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        transform: 'translateX(-50%)'
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: step.completed ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{step.label}</div>
                    {step.date && (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {new Date(step.date).toLocaleDateString()} {new Date(step.date).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - Key metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20, background: 'var(--bg-surface-hover)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>Net Payout</div>
            <div style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(netAmount)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Advanced to your account</div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>Fee Breakdown</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Base Fee</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{feePercent.toFixed(1)}%</span>
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Total Fee</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--status-danger)' }}>{formatCurrency(feeAmount)}</span>
              </div>
            </div>
          </div>

          {disbursedAt && (
            <div className="card" style={{ padding: 20, background: 'var(--bg-surface-hover)', borderLeft: '4px solid var(--status-success)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>Disbursed</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {new Date(disbursedAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Funds transferred</div>
            </div>
          )}

          {repaymentDate && !settledAt && (
            <div className="card" style={{ padding: 20, background: 'var(--bg-surface-hover)', borderLeft: '4px solid var(--status-warning)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>Repayment Due</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {new Date(repaymentDate).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Auto-repaid when customer pays</div>
            </div>
          )}

          {settledAt && (
            <div className="card" style={{ padding: 20, background: 'var(--bg-surface-hover)', borderLeft: '4px solid var(--text-tertiary)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>Settled</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {new Date(settledAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Fully repaid</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
