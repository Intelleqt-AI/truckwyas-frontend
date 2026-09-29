import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { InfoTip } from '@/components/ui/InfoTip';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { TilesSkeleton, BlockSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import { formatDate, formatMoneyWhole, formatNumber } from '@/lib/formatters';
import '@/pages/bookings-section.css';
import '@/pages/admin/admin-brand.css';

// Admin landing: platform totals, then what they mean. Every figure comes
// from the admin GET endpoints the other admin pages already use.

const SUBSCRIPTION_ROWS: { key: string; label: string; hint: string }[] = [
  { key: 'active', label: 'Active', hint: 'Paying' },
  { key: 'trialing', label: 'Trialing', hint: 'On a free trial' },
  { key: 'grace_period', label: 'Grace period', hint: 'A charge failed; not yet suspended' },
  { key: 'suspended', label: 'Suspended', hint: 'Blocked for non-payment' },
  { key: 'cancelled', label: 'Cancelled', hint: 'Ended their plan' },
  { key: 'none', label: 'No subscription', hint: 'Signed up, never started a plan' },
];

const taskLabel = (name: string) => {
  const t = name.replace(/_task$/, '').replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function AdminHome() {
  const navigate = useNavigate();
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchData('api/v1/admin/overview/'),
  });
  // Same request (and cache) as the Platform health page.
  const { data: jobs } = useQuery({
    queryKey: ['admin-job-health'],
    queryFn: () => fetchData('api/v1/admin/job-health/'),
    refetchInterval: 60_000,
  });
  // Same request (and cache) as page 1 of the Companies page.
  const { data: companiesPage } = useQuery({
    queryKey: ['admin-companies-full', '', '', 1],
    queryFn: () => fetchData('api/v1/admin/companies/?page=1&page_size=20'),
  });

  if (isLoading) return <><TilesSkeleton count={4} /><BlockSkeleton height={280} label="Loading overview" /></>;
  if (isError || !overview) {
    return <div className="bk-notice"><p className="bk-notice__text">The platform overview could not be loaded.</p></div>;
  }

  const byStatus: Record<string, number> = overview.companies_by_status || {};
  const total = Number(overview.total_companies) || 0;
  const paying = (byStatus.active || 0) + (byStatus.grace_period || 0);
  const noPlan = byStatus.none || 0;
  const mrr = Number(overview.mrr_estimate) || 0;

  const jobRows: { task_name: string; last_started_at: string | null; last_success: boolean | null }[] = jobs?.results || [];
  const failed = jobRows.filter(j => j.last_success === false);
  const neverRun = jobRows.filter(j => j.last_started_at === null);

  const newest: { id: number; company_name: string; owner_email: string | null; created_at: string; subscription_status: string }[] =
    [...(companiesPage?.results || [])]
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 5);

  const companiesNote = total === 0 ? 'None yet'
    : paying === 0 ? (noPlan === total ? 'None has started a plan' : 'None paying yet')
    : `${paying} paying`;

  return (
    <div className="admin-home">
      <KpiRow>
        <KpiTile aria-label="Companies" label="Companies" figure={formatNumber(total)} note={companiesNote} onClick={() => navigate('/admin/companies')} />
        {/* The overview endpoint counts users of real companies only: the demo
            company (where most test users live) and deleted ones are left out,
            which is why it can be far below a single company's user list. */}
        <KpiTile
          aria-label="Users"
          label="Users"
          figure={formatNumber(overview.total_users)}
          note={overview.has_demo_company ? 'Real companies, demo excluded' : 'Across all companies'}
          onClick={() => navigate('/admin/users')}
        />
        <KpiTile aria-label="Quotes" label="Quotes" figure={formatNumber(overview.total_quotes)} note={overview.quotes_this_month ? `${overview.quotes_this_month} this month` : 'None this month'} />
        <KpiTile aria-label="Orders" label="Orders" figure={formatNumber(overview.total_loads)} note={overview.loads_this_month ? `${overview.loads_this_month} this month` : 'None this month'} />
        {/* A zero MRR is not a headline number (design principles §1): the tile is left out. */}
        {mrr > 0 && (
          <KpiTile
            aria-label="Estimated MRR"
            label="Estimated MRR"
            aside={<InfoTip>Active and grace-period companies times the flat monthly fee. An estimate, not reconciled against actual Paystack charges.</InfoTip>}
            figure={formatMoneyWhole(mrr)}
            note="Estimate, per month"
          />
        )}
      </KpiRow>

      <div className="admin-home-grid">
        <section className="bk-card" aria-labelledby="ah-subs">
          <div className="bk-card__head">
            <h2 className="bk-card__title" id="ah-subs">Companies by subscription</h2>
            <Link className="bk-link" style={{ fontSize: 13, color: 'var(--text-secondary)' }} to="/admin/companies">All companies</Link>
          </div>
          {paying === 0 && total > 0 && (
            <p className="bk-help" style={{ marginBottom: 12 }}>
              {noPlan === total
                ? `All ${total} companies signed up without starting a plan, so none is active or suspended.`
                : 'No company is paying yet.'}
            </p>
          )}
          <div className="admin-dist" role="list">
            {SUBSCRIPTION_ROWS.map(r => {
              const n = byStatus[r.key] || 0;
              return (
                <div key={r.key} className="admin-dist__row" role="listitem" aria-label={`${r.label}: ${n}`}>
                  <div className="admin-dist__label">
                    <span>{r.label}</span>
                    <span className="admin-dist__hint">{r.hint}</span>
                  </div>
                  <span className="admin-dist__track" aria-hidden="true"><span style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></span>
                  <span className={`admin-dist__n${n ? '' : ' is-zero'}`}>{n}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="admin-home-side">
          <section className="bk-card" aria-labelledby="ah-jobs">
            <div className="bk-card__head">
              <h2 className="bk-card__title" id="ah-jobs">Scheduled jobs</h2>
              <Link className="bk-link" style={{ fontSize: 13, color: 'var(--text-secondary)' }} to="/admin/health">Platform health</Link>
            </div>
            {!jobs ? (
              <div className="ops-skel" style={{ height: 40 }} />
            ) : jobRows.length === 0 ? (
              <p className="bk-help">No tracked tasks reported.</p>
            ) : (
              <>
                <p className="bk-help" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                  {failed.length ? `${failed.length} of ${jobRows.length} tasks failed on their last run.`
                    : neverRun.length === jobRows.length ? `None of the ${jobRows.length} tasks has run yet. Check that the scheduler is running.`
                    : neverRun.length ? `${neverRun.length} of ${jobRows.length} tasks have never run.`
                    : `All ${jobRows.length} tasks ran successfully last time.`}
                </p>
                {failed.slice(0, 3).map(j => (
                  <div key={j.task_name} className="bk-kv"><span className="bk-kv__label">{taskLabel(j.task_name)}</span><StatusChip tone="danger" label="Failed" size="sm" /></div>
                ))}
              </>
            )}
          </section>

          <section className="bk-card" aria-labelledby="ah-new">
            <div className="bk-card__head"><h2 className="bk-card__title" id="ah-new">Newest companies</h2></div>
            {!companiesPage ? (
              <div className="ops-skel" style={{ height: 80 }} />
            ) : newest.length === 0 ? (
              <p className="bk-help">No companies yet.</p>
            ) : newest.map(c => (
              <div key={c.id} className="bk-kv">
                <span className="bk-kv__label" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={c.owner_email || undefined}>{c.company_name}</span>
                <span className="bk-kv__value" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
