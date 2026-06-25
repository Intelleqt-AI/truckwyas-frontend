import { useState, useEffect } from "react";
import { fetchData, postData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";

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

interface BillingTransaction {
  id: string;
  pf_payment_id: string;
  created_at: string;
  amount: number;
  status: string;
}

const PRO_PLAN = {
  key: 'pro',
  name: 'TruckWys Pro',
  price: 4999,
  features: [
    'Unlimited loads & invoices',
    'AI-powered quote optimisation',
    'Fast Pay capital access',
    'Advanced analytics & reporting',
    'Fleet intelligence dashboard',
    'Multi-user access',
    'API & integrations',
    'Priority support',
  ],
};

export function BillingSettings() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    fetchData('api/v1/company/profile/')
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    fetchData('api/v1/billing/history/')
      .then((data) => setBillingHistory(data.results || data || []))
      .catch(() => setBillingHistory([]));
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const data = await postData({ url: 'api/v1/billing/subscribe/', data: {
        plan: 'pro',
        return_url: `${window.location.origin}/settings/billing?success=1`,
        cancel_url: `${window.location.origin}/settings/billing?cancelled=1`,
        notify_url: `${import.meta.env.VITE_API_URL}api/v1/billing/itn/`,
      }});
      if ((data.payfast_url || data.payment_url) && data.form_data) {
        // PayFast requires a form POST — build and auto-submit a hidden form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.payfast_url || data.payment_url;
        Object.entries(data.form_data).forEach(([key, value]) => {
          // Skip empty values — PayFast signs only non-empty fields, so the
          // submitted set must match (posting an empty field PayFast didn't
          // sign triggers a generic "could not process" 400).
          if (value === '' || value === null || value === undefined) return;
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      } else {
        toast.error('Could not initiate payment. Please try again.');
      }
    } catch {
      toast.error('Failed to start subscription. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = () => {
    setConfirmOpts({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your TruckWys Pro subscription? You will lose access to Pro features at the end of your billing period.',
      confirmLabel: 'Cancel Plan',
      danger: true,
      onConfirm: async () => {
        setCancelling(true);
        try {
          await postData({ url: 'api/v1/billing/cancel/', data: {} });
          toast.success('Subscription cancelled.');
          setProfile(prev => prev ? { ...prev, subscription_status: 'cancelled' } : prev);
        } catch {
          toast.error('Failed to cancel subscription. Please contact support.');
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const planKey = profile?.subscription_plan?.toLowerCase() || 'free';
  const isActive = profile?.subscription_status === 'active';
  const isPro = ['pro', 'growth', 'enterprise'].includes(planKey) && isActive;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Billing</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your subscription and payment history</div>
      </div>

      {loading && (
        <div style={sectionStyle}>
          <div style={{ padding: 20 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, width: '40%' }} />
          </div>
        </div>
      )}

      {!loading && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Plan</span></div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isPro ? PRO_PLAN.name : 'Free Plan'}
                  </span>
                  {isPro && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                      background: 'var(--status-success-bg)', color: 'var(--accent-primary)',
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {isPro ? `R ${PRO_PLAN.price.toLocaleString()} / month` : 'No active subscription'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isPro ? (
                  <button onClick={handleCancel} disabled={cancelling} style={{
                    background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', padding: '7px 14px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                    opacity: cancelling ? 0.6 : 1,
                  }}>
                    {cancelling ? 'CANCELLING...' : 'CANCEL PLAN'}
                  </button>
                ) : (
                  <button onClick={handleSubscribe} disabled={subscribing} className="btn-action">
                    {subscribing ? 'REDIRECTING...' : 'SUBSCRIBE — R4,999/MO'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PRO_PLAN.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isPro ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                  <span style={{ color: isPro ? 'var(--accent-primary)' : 'var(--border-subtle)', fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            {!isPro && (
              <div style={{
                marginTop: 16, padding: 12,
                background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Unlock the full platform</strong>
                <br />
                Subscribe to TruckWys Pro for AI-powered insights, Fast Pay capital access, and unlimited loads.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Billing History</span></div>
          {billingHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>No billing history yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Payment records will appear here after your first transaction</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {['Payment ID', 'Date', 'Amount', 'Status'].map(h => (
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
                {billingHistory.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: i < billingHistory.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      {tx.pf_payment_id || tx.id}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(tx.created_at).toLocaleDateString('en-ZA')}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      R {Number(tx.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: tx.status === 'complete' ? 'var(--accent-primary)' : 'var(--status-warning)',
                        textTransform: 'uppercase' as const,
                      }}>{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    {confirmOpts && (
      <ConfirmModal
        title={confirmOpts.title}
        message={confirmOpts.message}
        confirmLabel={confirmOpts.confirmLabel}
        danger={confirmOpts.danger}
        onConfirm={confirmOpts.onConfirm}
        onCancel={() => setConfirmOpts(null)}
      />
    )}
    </div>
  );
}
