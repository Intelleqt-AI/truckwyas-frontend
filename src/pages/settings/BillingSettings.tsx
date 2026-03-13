import { useState, useEffect } from "react";
import { fetchData } from "@/lib/Api";
import { toast } from "@/lib/toast";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-subtle)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

interface CompanyProfile {
  subscription_plan?: string | null;
  subscription_status?: string | null;
  company_name?: string;
}

interface BillingInvoice {
  id: string;
  invoice_number: string;
  date: string;
  amount: number;
  status: string;
}

const PLAN_DETAILS: Record<string, { price: number; maxUsers: number; features: string[] }> = {
  starter: {
    price: 999,
    maxUsers: 5,
    features: [
      'Basic load management',
      'Invoice generation',
      'Up to 5 users',
      'Email support',
    ],
  },
  professional: {
    price: 2499,
    maxUsers: 25,
    features: [
      'AI-powered quote optimisation',
      'Advanced analytics & reporting',
      'Fast Pay capital access',
      'Unlimited loads and invoices',
      'Fleet intelligence dashboard',
      'API access',
    ],
  },
  enterprise: {
    price: 4999,
    maxUsers: 100,
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'Priority support',
      'White-label options',
      'SLA guarantees',
    ],
  },
};

export function BillingSettings() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingError, setBillingError] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    // Fetch company profile for subscription info
    fetchData('api/v1/company/profile/')
      .then((data) => setProfile(data))
      .catch(() => {
        toast.error('Failed to load subscription info');
        setProfile(null);
      })
      .finally(() => setLoading(false));

    // Fetch billing history (may 404 if not yet implemented)
    fetchData('api/v1/billing/history/')
      .then((data) => {
        setBillingHistory(data.results || data);
        setBillingError(false);
      })
      .catch(() => {
        setBillingError(true);
        setBillingHistory([]);
      });
  }, []);

  const handleDownload = (id: string) => {
    setDownloading(id);
    setTimeout(() => setDownloading(null), 1000);
  };

  const handleUpgrade = () => {
    setShowComingSoon(true);
  };

  const handleCancel = () => {
    setShowComingSoon(true);
  };

  // Determine plan details
  const planKey = profile?.subscription_plan?.toLowerCase() || 'free';
  const planName = planKey === 'free' ? 'Free Plan' : (profile?.subscription_plan || 'Free Plan');
  const planDetails = PLAN_DETAILS[planKey] || { price: 0, maxUsers: 3, features: ['Basic features', 'Limited support'] };
  const isActive = profile?.subscription_status === 'active';

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Billing</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your subscription and payment history</div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={sectionStyle}>
          <div style={{ padding: 20 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, width: '40%' }} />
          </div>
        </div>
      )}

      {/* Current Plan */}
      {!loading && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Current Plan</span></div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{planName}</span>
                  {isActive ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                      background: 'var(--status-success-bg)', color: 'var(--accent-primary)',
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>Active</span>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                      background: 'var(--bg-surface-hover)', color: 'var(--text-tertiary)',
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>Inactive</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {planDetails.price > 0 ? `R ${planDetails.price.toLocaleString()} / monthly` : 'No active subscription'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isActive && planKey !== 'free' && (
                  <button onClick={handleCancel} style={{
                    background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', padding: '7px 14px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                  }}>CANCEL PLAN</button>
                )}
                <button onClick={handleUpgrade} className="btn-action">
                  {planKey === 'free' ? 'UPGRADE' : 'CHANGE PLAN'}
                </button>
              </div>
            </div>

            {/* Features */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {planDetails.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            {planKey === 'free' && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Ready to unlock more features?</strong>
                <br />
                Upgrade to Professional for AI-powered insights and capital access.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing History */}
      {!loading && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Billing History</span></div>
          {billingError || billingHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>No billing history yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Your invoices and payment records will appear here
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {['Invoice', 'Date', 'Amount', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 20px', textAlign: 'left' as const,
                      fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                      borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((inv, i) => (
                  <tr key={inv.id} style={{ borderBottom: i < billingHistory.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      {inv.invoice_number}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{inv.date}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      R {inv.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: inv.status === 'paid' ? 'var(--accent-primary)' : 'var(--status-warning)',
                        textTransform: 'uppercase' as const,
                      }}>{inv.status}</span>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                      <button
                        onClick={() => handleDownload(inv.id)}
                        style={{
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)', padding: '4px 10px',
                          fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                        }}
                      >{downloading === inv.id ? '↓...' : '↓ PDF'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowComingSoon(false)}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            padding: 32,
            maxWidth: 420,
            textAlign: 'center',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Payment Integration Coming Soon
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
              Our PayFast integration is currently in development. To upgrade or modify your subscription,
              please contact our support team at <strong style={{ color: 'var(--accent-primary)' }}>support@truckwys.co.za</strong>
            </div>
            <button onClick={() => setShowComingSoon(false)} className="btn-action">
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
