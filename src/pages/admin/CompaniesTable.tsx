import '@/pages/table-heading-roles.css';
import '@/pages/admin/admin-brand.css';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData, patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';
import PaginationControls from '@/pages/admin/PaginationControls';

const PAGE_SIZE = 20;

// Fuller replacement for the inline companies table in AdminDashboard.tsx —
// adds search + status filter + per-row actions (suspend/reactivate/delete),
// a billing-history drill-in, a next-billing-date editor, and a manual
// record-payment form. Self-contained: owns its own query/mutation state so
// it can just be dropped in wherever the simple inline table currently is.

interface Company {
  id: number;
  company_name: string;
  owner_email: string | null;
  subscription_status: string;
  is_demo: boolean;
  is_deleted: boolean;
  created_at: string;
  next_billing_date: string | null;
  grace_period_expires_at: string | null;
  user_count: number;
  quote_count: number;
  load_count: number;
}

interface BillingChargeRow {
  id: number | string;
  raw_id: number;
  kind: string;
  label: string;
  amount: number;
  status: string;
  reference?: string | null;
  created_at: string;
}

type CompanyActionType = 'suspend' | 'reactivate' | 'delete';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n || 0);

const fmtDateTime = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// Date-only fields (next_billing_date, grace_period_expires_at) come back as
// plain 'YYYY-MM-DD' — parsing that with `new Date()` reads it as UTC
// midnight, which can print as the previous day in timezones behind UTC.
// Build the Date from local y/m/d parts instead.
const fmtDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', { dateStyle: 'medium' });
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'active',
  // Same blue as 'active' made a company silently needing attention (a
  // failed charge, days from suspension) indistinguishable at a glance from
  // one that's perfectly healthy — amber matches the urgency without
  // implying it's already broken the way suspended/cancelled's red would.
  grace_period: 'warning',
  suspended: 'delayed',
  cancelled: 'delayed',
  trialing: 'warning',
  none: 'warning',
};

// Charge status values aren't a fixed enum on the backend (subscription vs.
// delivery-fee charges can use slightly different wording), so match on
// common substrings rather than an exact lookup.
const chargeStatusClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (/(paid|success|complete|active)/.test(s)) return 'active';
  if (/(fail|declin|cancel|void)/.test(s)) return 'delayed';
  if (/(pending|process|due)/.test(s)) return 'warning';
  return '';
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'grace_period', label: 'Grace period' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'trialing', label: 'Trialing' },
];

// Presentation-only display labels for known payload values — unknown
// strings render verbatim (own-property lookup; never restyles user data).
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  grace_period: 'Grace period',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  trialing: 'Trialing',
  none: 'None',
};
const subscriptionStatusLabel = (s: string) =>
  Object.prototype.hasOwnProperty.call(SUBSCRIPTION_STATUS_LABELS, s) ? SUBSCRIPTION_STATUS_LABELS[s] : s;

const CHARGE_KIND_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  delivery_fee: 'Delivery fee',
};
const chargeKindLabel = (k: string) =>
  Object.prototype.hasOwnProperty.call(CHARGE_KIND_LABELS, k) ? CHARGE_KIND_LABELS[k] : k;

const CHARGE_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  failed: 'Failed',
  pending: 'Pending',
  success: 'Success',
  refunded: 'Refunded',
};
const chargeStatusLabel = (s: string) =>
  Object.prototype.hasOwnProperty.call(CHARGE_STATUS_LABELS, s) ? CHARGE_STATUS_LABELS[s] : s;

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0,
};
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 400,
  fontFamily: 'var(--font-sans)', minHeight: 40, width: 240,
};
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 400,
  fontFamily: 'var(--font-sans)', minHeight: 40, cursor: 'pointer',
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' };
const tdStyle: React.CSSProperties = {
  padding: '12px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
  borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)',
  minHeight: 40, cursor: 'pointer', whiteSpace: 'nowrap',
};
const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', fontSize: 13, lineHeight: '20px',
  fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap',
};
const smallInputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 400,
  fontFamily: 'var(--font-sans)', minHeight: 40,
};
const panelLabelStyle: React.CSSProperties = {
  fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6,
};

const COLUMN_COUNT = 8;

export function CompaniesTable() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ company: Company; action: 'suspend' | 'delete' } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A narrower search/filter can leave `page` pointing past the new result
  // set's end — reset to page 1 whenever either changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const queryString = (() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('page_size', String(PAGE_SIZE));
    return `?${params.toString()}`;
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies-full', debouncedSearch, statusFilter, page],
    queryFn: () => fetchData(`api/v1/admin/companies/${queryString}`),
  });

  const companies: Company[] = data?.results || [];

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: CompanyActionType }) =>
      postData({ url: `api/v1/admin/companies/${id}/action/`, data: { action } }),
    onSuccess: (_result, variables) => {
      const verb = variables.action === 'suspend' ? 'suspended' : variables.action === 'reactivate' ? 'reactivated' : 'deleted';
      toast.success(`Company ${verb}`);
      qc.invalidateQueries({ queryKey: ['admin-companies-full'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Action failed'),
  });

  const runAction = (id: number, action: CompanyActionType) => actionMutation.mutate({ id, action });

  return (
    <div className="card" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={sectionTitleStyle}>Companies {data ? `(${data.count})` : ''}</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="admin-control" aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input className="admin-control" aria-label="Search companies" style={inputStyle} placeholder="Search company or owner email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? <Loader size={24} /> : (
        <div className="admin-scroll-region" role="region" aria-label="Companies" tabIndex={0} style={{ overflowX: 'auto' }}>
          <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Next billing</th>
                <th style={thStyle}>Users</th>
                <th style={thStyle}>Quotes</th>
                <th style={thStyle}>Orders</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => {
                const isExpanded = expandedId === c.id;
                const isDownState = c.subscription_status === 'suspended' || c.subscription_status === 'cancelled';
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td style={tdStyle}>
                        <div>
                          {c.company_name}
                          {c.is_demo && <span style={{ marginLeft: 8, fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--status-warning)' }}>Demo</span>}
                          {c.is_deleted && <span style={{ marginLeft: 8, fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--status-danger)' }}>Deleted</span>}
                        </div>
                        {/* company_name alone is rarely unique — self-service signup
                            defaults it to "<first name>'s Transport", so the owner's
                            email is what actually tells rows apart. A 'deleted-'
                            prefix means every user this company ever had deleted
                            their own account — an abandoned signup, not a real tenant. */}
                        {c.owner_email && (
                          c.owner_email.startsWith('deleted-') ? (
                            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No active user (account deleted)</div>
                          ) : (
                            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{c.owner_email}</div>
                          )
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span className={`status-badge ${STATUS_BADGE_CLASS[c.subscription_status] || ''}`}>{subscriptionStatusLabel(c.subscription_status)}</span>
                      </td>
                      <td style={tdStyle}>{fmtDate(c.next_billing_date)}</td>
                      <td style={tdStyle}>{c.user_count}</td>
                      <td style={tdStyle}>{c.quote_count}</td>
                      <td style={tdStyle}>{c.load_count}</td>
                      <td style={tdStyle}>{fmtDateTime(c.created_at)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" className="admin-control" style={linkButtonStyle} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                            {isExpanded ? 'Hide billing' : 'Billing history'}
                          </button>
                          {!c.is_deleted && (
                            isDownState ? (
                              <button
                                type="button"
                                className="btn-action admin-control"
                                style={{ minHeight: 40, borderRadius: 6 }}
                                disabled={actionMutation.isPending}
                                onClick={() => runAction(c.id, 'reactivate')}
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-control"
                                style={secondaryBtnStyle}
                                disabled={actionMutation.isPending}
                                onClick={() => setConfirmAction({ company: c, action: 'suspend' })}
                              >
                                Suspend
                              </button>
                            )
                          )}
                          {!c.is_deleted && (
                            <button
                              type="button"
                              className="admin-control"
                              style={{ ...secondaryBtnStyle, color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                              disabled={actionMutation.isPending}
                              onClick={() => setConfirmAction({ company: c, action: 'delete' })}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && <CompanyBillingPanel company={c} />}
                  </Fragment>
                );
              })}
              {companies.length === 0 && (
                <tr><td style={tdStyle} colSpan={COLUMN_COUNT}>No companies match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <PaginationControls
          page={data.page || 1}
          numPages={data.num_pages || 1}
          count={data.count || 0}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => p + 1)}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.action === 'delete' ? 'Delete company' : 'Suspend company'}
          message={
            confirmAction.action === 'delete'
              ? `Mark ${confirmAction.company.company_name} as deleted? Its users immediately lose access. This can't be undone from here.`
              : `Suspend ${confirmAction.company.company_name}? Its users lose access to quoting and invoicing until reactivated or a payment is recorded.`
          }
          confirmLabel={confirmAction.action === 'delete' ? 'Delete' : 'Suspend'}
          danger={confirmAction.action === 'delete'}
          onConfirm={() => runAction(confirmAction.company.id, confirmAction.action)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// Per-row drill-in: billing/charge history, a next-billing-date editor, and
// the manual record-payment form. Mounted fresh (keyed by company.id via the
// parent's Fragment) whenever a row expands, so it owns its own local form
// state without needing to reset it on collapse/expand.
function CompanyBillingPanel({ company }: { company: Company }) {
  const qc = useQueryClient();
  const [nextBillingDate, setNextBillingDate] = useState(company.next_billing_date ? company.next_billing_date.slice(0, 10) : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const useAmountFor = (ch: BillingChargeRow) => {
    setAmount(String(ch.amount));
    setNote(`Manual payment for ${ch.label} (${fmtDateTime(ch.created_at)})`);
    amountInputRef.current?.focus();
  };

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ['admin-company-billing', company.id],
    queryFn: () => fetchData(`api/v1/admin/companies/${company.id}/billing/`),
  });

  const dateMutation = useMutation({
    mutationFn: (next_billing_date: string) =>
      patchData({ url: `api/v1/admin/companies/${company.id}/billing/`, data: { next_billing_date } }),
    onSuccess: () => {
      toast.success('Next billing date updated');
      qc.invalidateQueries({ queryKey: ['admin-companies-full'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update next billing date'),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      postData({
        url: `api/v1/admin/companies/${company.id}/record-payment/`,
        data: { amount: Number(amount) || 0, ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: (result: any) => {
      toast.success(`Payment recorded — company is now ${result?.subscription_status || 'active'}`);
      setAmount('');
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-companies-full'] });
      qc.invalidateQueries({ queryKey: ['admin-company-billing', company.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to record payment'),
  });

  // Only for delivery-fee charges — a DeliveryFeeCharge is a single mutable
  // row per invoice (already rewritten in place by the automatic retry), not
  // a ledger entry, so correcting it directly here doesn't erase any history
  // the way editing a subscription BillingTransaction would.
  const markPaidMutation = useMutation({
    mutationFn: (chargeId: number) =>
      postData({ url: `api/v1/admin/delivery-fee-charges/${chargeId}/mark-paid/`, data: {} }),
    onSuccess: () => {
      toast.success('Delivery fee marked as paid');
      qc.invalidateQueries({ queryKey: ['admin-company-billing', company.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to mark as paid'),
  });

  const charges: BillingChargeRow[] = billingData?.results || [];

  return (
    <tr>
      <td style={{ ...tdStyle, background: 'var(--bg-panel)' }} colSpan={COLUMN_COUNT}>
        <div style={{ padding: '12px 4px', display: 'grid', gap: 20 }}>
          {/* The subscription fee and each load's delivery fee are two
              separate billing lanes — only a successful (or manually
              recorded) SUBSCRIPTION charge clears grace_period; marking a
              delivery-fee row "paid" below never touches it, by design. That
              distinction isn't obvious from the billing history table alone,
              so spell it out here whenever it's actually relevant. */}
          {company.subscription_status === 'grace_period' && (
            <div style={{
              padding: 16, background: 'var(--status-warning-bg, rgba(245,158,11,0.1))',
              border: '1px solid var(--status-warning)', borderRadius: 8, fontSize: 14, lineHeight: '20px',
            }}>
              <strong style={{ color: 'var(--status-warning)' }}>In grace period</strong>
              {company.grace_period_expires_at && <> — expires {fmtDate(company.grace_period_expires_at)}</>}.
              This is caused by a failed <em>subscription</em> charge, not a delivery-fee charge — use{' '}
              <strong>Record payment</strong> below to resolve it. Marking a delivery-fee row as paid in the
              billing history won't clear this, even if one happens to be failed too.
            </div>
          )}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <label htmlFor={`next-billing-date-${company.id}`} style={{ ...panelLabelStyle, display: 'block' }}>Next billing date</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <input
                  id={`next-billing-date-${company.id}`}
                  className="admin-control"
                  type="date"
                  value={nextBillingDate}
                  onChange={e => setNextBillingDate(e.target.value)}
                  style={{ ...smallInputStyle, width: 170 }}
                />
                <button
                  type="button"
                  className="btn-action admin-control"
                  style={{ minHeight: 40, borderRadius: 6 }}
                  disabled={!nextBillingDate || dateMutation.isPending}
                  onClick={() => dateMutation.mutate(nextBillingDate)}
                >
                  {dateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
              {company.grace_period_expires_at && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-warning)', marginTop: 6 }}>
                  Grace period expires {fmtDate(company.grace_period_expires_at)}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ ...panelLabelStyle, margin: 0, marginBottom: 6 }}>Record payment</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label>
                  <span style={{ ...panelLabelStyle, display: 'block' }}>Amount</span>
                  <input
                    ref={amountInputRef}
                    className="admin-control"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{ ...smallInputStyle, width: 120 }}
                  />
                </label>
                <label>
                  <span style={{ ...panelLabelStyle, display: 'block' }}>Note (optional)</span>
                  <input
                    className="admin-control"
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    style={{ ...smallInputStyle, width: 200 }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-action admin-control"
                  style={{ minHeight: 40, borderRadius: 6 }}
                  disabled={amount === '' || paymentMutation.isPending}
                  onClick={() => paymentMutation.mutate()}
                >
                  {paymentMutation.isPending ? 'Recording…' : 'Record payment'}
                </button>
              </div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 6, maxWidth: 340 }}>
                Reactivates the company immediately, even from suspended/cancelled — this is how a payment taken
                outside Paystack unlocks an account. Use amount 0 with a note to record a waiver.
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ ...panelLabelStyle, margin: 0, marginBottom: 6 }}>Billing history</h3>
            {billingLoading ? <Loader size={20} /> : charges.length === 0 ? (
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>No charges recorded.</div>
            ) : (
              <div className="admin-scroll-region" role="region" aria-label={`Billing history for ${company.company_name}`} tabIndex={0} style={{ overflowX: 'auto' }}>
                <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Kind</th>
                      <th style={thStyle}>Label</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(ch => (
                      <tr key={`${ch.kind}-${ch.id}`}>
                        <td style={tdStyle}>{fmtDateTime(ch.created_at)}</td>
                        <td style={tdStyle}>{chargeKindLabel(ch.kind)}</td>
                        <td style={tdStyle}>{ch.label}</td>
                        <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ch.amount)}</td>
                        <td style={tdStyle}>
                          <span className={`status-badge ${chargeStatusClass(ch.status)}`}>{chargeStatusLabel(ch.status)}</span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 13, fontFamily: 'var(--font-mono)' }}>{ch.reference || '—'}</td>
                        <td style={tdStyle}>
                          {ch.status === 'failed' && ch.kind === 'delivery_fee' && (
                            <button
                              type="button"
                              className="admin-control"
                              style={linkButtonStyle}
                              title="Only fixes this one invoice's delivery fee — doesn't affect the subscription or clear a grace period"
                              disabled={markPaidMutation.isPending}
                              onClick={() => markPaidMutation.mutate(ch.raw_id)}
                            >
                              {markPaidMutation.isPending ? 'Marking…' : 'Mark as paid'}
                            </button>
                          )}
                          {ch.status === 'failed' && ch.kind === 'subscription' && (
                            <button type="button" className="admin-control" style={linkButtonStyle} onClick={() => useAmountFor(ch)}>
                              Use this amount ↑
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default CompaniesTable;
