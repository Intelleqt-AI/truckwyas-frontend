import { Fragment, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData, patchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';

// Fuller replacement for the inline companies table in AdminDashboard.tsx —
// adds search + status filter + per-row actions (suspend/reactivate/delete),
// a billing-history drill-in, a next-billing-date editor, and a manual
// record-payment form. Self-contained: owns its own query/mutation state so
// it can just be dropped in wherever the simple inline table currently is.

interface Company {
  id: number;
  company_name: string;
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
  grace_period: 'active',
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
  { value: 'grace_period', label: 'Grace Period' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'trialing', label: 'Trialing' },
];

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', width: 240,
};
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
  borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', cursor: 'pointer', whiteSpace: 'nowrap',
};
const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', fontSize: 11.5,
  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap',
};
const smallInputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '6px 10px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
};
const panelLabelStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: 6,
};

const COLUMN_COUNT = 8;

export function CompaniesTable() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ company: Company; action: 'suspend' | 'delete' } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = (() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies-full', debouncedSearch, statusFilter],
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={sectionTitleStyle}>Companies {data ? `(${data.count})` : ''}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input style={inputStyle} placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? <Loader size={24} /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Next Billing</th>
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
                        {c.company_name}
                        {c.is_demo && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--status-warning)' }}>DEMO</span>}
                        {c.is_deleted && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--status-danger)' }}>DELETED</span>}
                      </td>
                      <td style={tdStyle}>
                        <span className={`status-badge ${STATUS_BADGE_CLASS[c.subscription_status] || ''}`}>{c.subscription_status}</span>
                      </td>
                      <td style={tdStyle}>{fmtDate(c.next_billing_date)}</td>
                      <td style={tdStyle}>{c.user_count}</td>
                      <td style={tdStyle}>{c.quote_count}</td>
                      <td style={tdStyle}>{c.load_count}</td>
                      <td style={tdStyle}>{fmtDateTime(c.created_at)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" style={linkButtonStyle} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                            {isExpanded ? 'Hide billing' : 'Billing history'}
                          </button>
                          {!c.is_deleted && (
                            isDownState ? (
                              <button
                                type="button"
                                className="btn-action"
                                style={{ fontSize: 11 }}
                                disabled={actionMutation.isPending}
                                onClick={() => runAction(c.id, 'reactivate')}
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
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

  const charges: BillingChargeRow[] = billingData?.results || [];

  return (
    <tr>
      <td style={{ ...tdStyle, background: 'var(--bg-panel)' }} colSpan={COLUMN_COUNT}>
        <div style={{ padding: '10px 4px', display: 'grid', gap: 20 }}>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <div style={panelLabelStyle}>Next billing date</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  value={nextBillingDate}
                  onChange={e => setNextBillingDate(e.target.value)}
                  style={{ ...smallInputStyle, width: 150 }}
                />
                <button
                  type="button"
                  className="btn-action"
                  style={{ fontSize: 11 }}
                  disabled={!nextBillingDate || dateMutation.isPending}
                  onClick={() => dateMutation.mutate(nextBillingDate)}
                >
                  {dateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
              {company.grace_period_expires_at && (
                <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 6 }}>
                  Grace period expires {fmtDate(company.grace_period_expires_at)}
                </div>
              )}
            </div>

            <div>
              <div style={panelLabelStyle}>Record payment</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ ...smallInputStyle, width: 100 }}
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  style={{ ...smallInputStyle, width: 200 }}
                />
                <button
                  type="button"
                  className="btn-action"
                  style={{ fontSize: 11 }}
                  disabled={amount === '' || paymentMutation.isPending}
                  onClick={() => paymentMutation.mutate()}
                >
                  {paymentMutation.isPending ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, maxWidth: 340 }}>
                Reactivates the company immediately, even from suspended/cancelled — this is how a payment taken
                outside Paystack unlocks an account. Use amount 0 with a note to record a waiver.
              </div>
            </div>
          </div>

          <div>
            <div style={panelLabelStyle}>Billing history</div>
            {billingLoading ? <Loader size={20} /> : charges.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No charges recorded.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Kind</th>
                      <th style={thStyle}>Label</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(ch => (
                      <tr key={`${ch.kind}-${ch.id}`}>
                        <td style={tdStyle}>{fmtDateTime(ch.created_at)}</td>
                        <td style={tdStyle}>{ch.kind}</td>
                        <td style={tdStyle}>{ch.label}</td>
                        <td style={tdStyle}>{formatCurrency(ch.amount)}</td>
                        <td style={tdStyle}>
                          <span className={`status-badge ${chargeStatusClass(ch.status)}`}>{ch.status}</span>
                        </td>
                        <td style={tdStyle}>{ch.reference || '—'}</td>
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
