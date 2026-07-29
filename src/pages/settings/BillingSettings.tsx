import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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

interface FlatPlan {
  key: string;
  label: string;
  amount: string;
  take_rate_pct: string;
}

interface CardOnFile {
  last4?: string;
  card_type?: string;
  bank?: string;
}

interface Grace {
  grace_period_expires_at: string;
  days_remaining: number;
  grace_period_days: number;
}

interface BillingStatus {
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_start?: string | null;
  next_billing_date?: string | null;
  amount?: string;
  item_name?: string;
  flat_plan?: FlatPlan | null;
  card?: CardOnFile | null;
  grace?: Grace | null;
  suspended?: boolean;
}

interface BillingTransaction {
  id: string;
  kind: 'subscription' | 'delivery_fee';
  label: string;
  reference?: string;
  created_at: string;
  amount: string | number;
  status: string;
}

// Pricing is server-driven (billing/status/ returns flat_plan) — only the
// feature list lives here.
const PLAN_FEATURES = [
  'Unlimited loads & invoices',
  'AI-powered quote optimisation',
  'Fast Pay capital access',
  'Advanced analytics & reporting',
  'Fleet intelligence dashboard',
  'Multi-user access',
  'API & integrations',
  'Priority support',
];

const formatRand = (amount?: string | number | null) =>
  `R${Number(amount ?? 0).toLocaleString('en-ZA')}`;

export function BillingSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchData('api/v1/billing/status/');
      setBillingStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchData('api/v1/billing/history/');
      setBillingHistory(data.results || data || []);
    } catch {
      setBillingHistory([]);
    }
  }, []);

  // On mount: load billing data, then handle the Paystack return —
  // callback_url comes back with ?reference=...&trxref=... appended.
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (reference) {
      setSearchParams({}, { replace: true }); // clear URL params so refresh doesn't re-trigger
    }

    const init = async () => {
      if (reference) {
        setConfirming(true);
        try {
          await postData({ url: 'api/v1/billing/confirm/', data: { reference } });
          await loadStatus(); // confirm/ returns only the base fields, not flat_plan/card
          toast.success('Subscription activated!');
        } catch {
          toast.error('Payment was not successful or was cancelled.');
          await loadStatus();
        } finally {
          setConfirming(false);
        }
        await loadHistory();
        setLoading(false);
        return;
      }

      await Promise.all([loadStatus(), loadHistory()]);
      setLoading(false);
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      // No plan is sent — the backend always charges the one flat plan and
      // never trusts a client-chosen price.
      const data = await postData({ url: 'api/v1/billing/subscribe/', data: {
        return_url: `${window.location.origin}/settings/billing`,
      }});
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error('Could not initiate payment. Please try again.');
        setSubscribing(false);
      }
    } catch {
      toast.error('Failed to start subscription. Please try again.');
      setSubscribing(false);
    }
  };

  const handleCancel = () => {
    setConfirmOpts({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? You will lose access to paid features at the end of your billing period.',
      confirmLabel: 'Cancel Plan',
      danger: true,
      onConfirm: async () => {
        setCancelling(true);
        try {
          await postData({ url: 'api/v1/billing/cancel/', data: {} });
          toast.success('Subscription cancelled.');
          setBillingStatus(prev => prev ? { ...prev, subscription_status: 'cancelled' } : prev);
        } catch {
          toast.error('Failed to cancel subscription. Please contact support.');
        } finally {
          setCancelling(false);
          setConfirmOpts(null);
        }
      },
    });
  };

  const planKey = billingStatus?.subscription_plan?.toLowerCase() || 'free';
  const subStatus = billingStatus?.subscription_status?.toLowerCase() || 'none';
  // active AND grace_period both keep full access (spec §4) — only
  // suspended/cancelled lose it.
  const isPaid = planKey !== 'free' && planKey !== 'starter' && (subStatus === 'active' || subStatus === 'grace_period');
  const flatPlan = billingStatus?.flat_plan ?? null;
  const grace = billingStatus?.grace ?? null;
  const isSuspended = !!billingStatus?.suspended;
  const subscribeAmount = flatPlan?.amount;

  const showLoading = loading || confirming;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Billing</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your subscription and payment history</div>
      </div>

      {confirming && (
        <div style={{ ...sectionStyle, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Activating your subscription...</span>
        </div>
      )}

      {showLoading && !confirming && (
        <div style={sectionStyle}>
          <div style={{ padding: 20 }}>
            <div style={{ height: 16, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
            <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, width: '40%' }} />
          </div>
        </div>
      )}

      {!showLoading && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Plan</span></div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isPaid ? (billingStatus?.item_name || 'TruckWys Fleet') : 'Free Plan'}
                  </span>
                  {isPaid && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                      background: 'var(--status-success-bg)', color: 'var(--accent-primary)',
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>Active</span>
                  )}
                  {subStatus === 'cancelled' && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                      background: 'var(--status-danger-bg)', color: 'var(--status-danger)',
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>Cancelled</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {isPaid
                    ? `${formatRand(billingStatus?.amount)} / month${billingStatus?.next_billing_date ? ` · next charge ${new Date(billingStatus.next_billing_date).toLocaleDateString('en-ZA')}` : ''}`
                    : 'No active subscription'}
                </div>
                {billingStatus?.card?.last4 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'capitalize' as const }}>
                    {billingStatus.card.bank ? `${billingStatus.card.bank} ` : ''}{billingStatus.card.card_type} card ending {billingStatus.card.last4}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isPaid ? (
                  <button onClick={handleCancel} disabled={cancelling} style={{
                    background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', padding: '7px 14px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                    opacity: cancelling ? 0.6 : 1,
                  }}>
                    {cancelling ? 'CANCELLING...' : 'CANCEL PLAN'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <button onClick={handleSubscribe} disabled={subscribing} className="btn-action">
                      {subscribing ? 'REDIRECTING...' : isSuspended ? `REACTIVATE — ${formatRand(subscribeAmount)}/MO` : `SUBSCRIBE — ${formatRand(subscribeAmount)}/MO`}
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' as const }}>
                      + {flatPlan?.take_rate_pct}% of every delivered load
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isSuspended && (
              <div style={{
                marginBottom: 16, padding: 14,
                background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)',
                borderRadius: 2, fontSize: 13, color: 'var(--status-danger)',
              }}>
                <strong>Your account is suspended.</strong> You can still view existing data and manage
                drivers/vehicles, but can't create quotes or invoices until you update your payment method.
              </div>
            )}

            {grace && (
              <div style={{
                marginBottom: 16, padding: 14,
                background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)',
                borderRadius: 2, fontSize: 13, color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  We couldn't charge your card
                </div>
                <div style={{ color: 'var(--status-warning)', fontWeight: 500 }}>
                  {grace.days_remaining > 0
                    ? `${grace.days_remaining} day${grace.days_remaining === 1 ? '' : 's'} left to resolve this before your account is suspended.`
                    : 'Grace period has ended — a successful charge is needed to avoid suspension.'}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PLAN_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isPaid ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                  <span style={{ color: isPaid ? 'var(--accent-primary)' : 'var(--border-subtle)', fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            {isPaid && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Every delivered load is also charged {billingStatus?.flat_plan?.take_rate_pct}% of its invoice value
                automatically to this card, on top of the monthly fee — see Billing History below for every charge taken.
              </div>
            )}

            {!isPaid && subStatus !== 'cancelled' && !isSuspended && (
              <div style={{
                marginTop: 16, padding: 12,
                background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Unlock the full platform</strong>
                <br />
                Subscribe to TruckWys for AI-powered insights, Fast Pay capital access, and unlimited loads —
                one flat fee of {formatRand(flatPlan?.amount)}/month, whatever your fleet size,{' '}
                <strong>plus {flatPlan?.take_rate_pct}% of every delivered load's value</strong>, charged
                automatically to the same card the moment each load is delivered.
              </div>
            )}
          </div>
        </div>
      )}

      {!showLoading && (
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
                  {['Charge', 'Reference', 'Date', 'Amount', 'Status'].map(h => (
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
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-primary)' }}>
                      {tx.label}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {tx.reference || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(tx.created_at).toLocaleDateString('en-ZA')}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      {formatRand(tx.amount)}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: tx.status === 'complete' ? 'var(--accent-primary)' : tx.status === 'pending' ? 'var(--status-warning)' : 'var(--status-danger)',
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
