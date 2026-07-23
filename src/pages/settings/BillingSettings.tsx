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

interface Tier {
  key: string;
  label: string;
  min_vehicles: number;
  max_vehicles: number;
  amount: string;
}

interface BillingStatus {
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_start?: string | null;
  amount?: string;
  item_name?: string;
  vehicle_count?: number;
  current_tier?: Tier | null;
  tiers?: Tier[];
}

interface BillingTransaction {
  id: string;
  payfast_payment_id?: string;
  payment_id?: string;
  created_at: string;
  amount: number;
  status: string;
  plan?: string;
}

// Pricing is server-driven (billing/status/ returns tiers + current_tier
// computed from the company's truck count) — only the feature list lives here.
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

  // On mount: load billing data, then handle PayFast return URL params
  useEffect(() => {
    const returnSuccess = searchParams.get('success') === '1';
    const returnCancelled = searchParams.get('cancelled') === '1';

    // Clear URL params immediately so refresh doesn't re-trigger
    if (returnSuccess || returnCancelled) {
      setSearchParams({}, { replace: true });
    }

    const init = async () => {
      if (returnCancelled) {
        toast.info('Payment cancelled. Your subscription was not changed.');
        await Promise.all([loadStatus(), loadHistory()]);
        setLoading(false);
        return;
      }

      if (returnSuccess) {
        // Call confirm endpoint — activates subscription even if ITN hasn't
        // arrived yet (important for localhost where ITN can't reach the server)
        setConfirming(true);
        try {
          await postData({ url: 'api/v1/billing/confirm/', data: {} });
          // Re-fetch full status — confirm/ returns only the base fields,
          // without the tier data the page renders from.
          await loadStatus();
          toast.success('Subscription activated!');
        } catch {
          // ITN may have already processed it — just re-fetch status
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
      // No plan is sent — the backend derives the tier from the company's
      // truck count and never trusts a client-chosen price.
      const data = await postData({ url: 'api/v1/billing/subscribe/', data: {
        return_url: `${window.location.origin}/settings/billing?success=1`,
        cancel_url: `${window.location.origin}/settings/billing?cancelled=1`,
      }});
      if ((data.payfast_url || data.payment_url) && data.form_data) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.payfast_url || data.payment_url;
        Object.entries(data.form_data).forEach(([key, value]) => {
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
  const isPaid = planKey !== 'free' && planKey !== 'starter' && subStatus === 'active';
  const currentTier = billingStatus?.current_tier ?? null;
  // Fleet size moved into a different tier than the one being paid for —
  // the price only changes when the user resubscribes (new PayFast checkout).
  const tierChanged = isPaid && !!currentTier && currentTier.key !== planKey;

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
                    ? `${formatRand(billingStatus?.amount)} / month${billingStatus?.subscription_start ? ` · since ${new Date(billingStatus.subscription_start).toLocaleDateString('en-ZA')}` : ''}`
                    : 'No active subscription'}
                </div>
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
                  <button onClick={handleSubscribe} disabled={subscribing} className="btn-action">
                    {subscribing ? 'REDIRECTING...' : `SUBSCRIBE — ${formatRand(currentTier?.amount)}/MO`}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PLAN_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isPaid ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                  <span style={{ color: isPaid ? 'var(--accent-primary)' : 'var(--border-subtle)', fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            {tierChanged && currentTier && (
              <div style={{
                marginTop: 16, padding: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span>
                  Your fleet of {billingStatus?.vehicle_count ?? 0} truck{(billingStatus?.vehicle_count ?? 0) === 1 ? '' : 's'} now
                  falls in the <strong style={{ color: 'var(--accent-primary)' }}>{currentTier.label}</strong> tier.
                  Resubscribe to switch to {formatRand(currentTier.amount)}/month — your current billing agreement
                  keeps its price until then.
                </span>
                <button onClick={handleSubscribe} disabled={subscribing} className="btn-action" style={{ whiteSpace: 'nowrap' as const }}>
                  {subscribing ? 'REDIRECTING...' : `RESUBSCRIBE — ${formatRand(currentTier.amount)}/MO`}
                </button>
              </div>
            )}

            {!isPaid && subStatus !== 'cancelled' && (
              <div style={{
                marginTop: 16, padding: 12,
                background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Unlock the full platform</strong>
                <br />
                Subscribe to TruckWys for AI-powered insights, Fast Pay capital access, and unlimited loads.
                Pricing is based on your fleet size.
              </div>
            )}
          </div>
        </div>
      )}

      {!showLoading && (billingStatus?.tiers?.length ?? 0) > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Pricing Tiers</span></div>
          <div style={{ padding: 20 }}>
            {billingStatus!.tiers!.map((tier, i) => {
              const isCurrent = tier.key === currentTier?.key;
              return (
                <div key={tier.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  marginBottom: i < billingStatus!.tiers!.length - 1 ? 6 : 0,
                  border: `1px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 2,
                  background: isCurrent ? 'var(--status-success-bg)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: 'var(--text-primary)' }}>
                      {tier.label}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                        background: 'var(--bg-surface)', color: 'var(--accent-primary)',
                        borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                      }}>Your Tier</span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {formatRand(tier.amount)}/mo
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Your fleet: {billingStatus?.vehicle_count ?? 0} truck{(billingStatus?.vehicle_count ?? 0) === 1 ? '' : 's'}
              {currentTier ? ` — ${currentTier.label} tier` : ''}. Fleets above 150 trucks are billed at the top tier.
            </div>
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
                  {['Payment ID', 'Plan', 'Date', 'Amount', 'Status'].map(h => (
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
                      {tx.payfast_payment_id || tx.payment_id || tx.id}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {tx.plan || '—'}
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
