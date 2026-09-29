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

const LINKED_TIP = 'Counts only records that belong to a real company (not the demo company, not deleted). Records saved without a company, such as seeded or superuser-created ones, are left out, so a company page can show more.';

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

  // Every account on the platform (deleted ones hidden), same endpoint as the
  // Users page; only the count is read.
  const { data: usersPage } = useQuery({
    queryKey: ['admin-users-count'],
    queryFn: () => fetchData('api/v1/admin/users/?page=1&page_size=1'),
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

  const newest: { id: number; company_name: string; owner_email: string | null; created_at: string; subscription_status: string; quote_count?: number; load_count?: number }[] =
    [...(companiesPage?.results || [])]
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 5);

  // The subscription card says who pays; the tile states what it counts.
  const companiesNote = total === 0 ? 'None yet' : 'Real companies only';

  return (
    <div className="admin-home">
      <KpiRow>
        <KpiTile
          aria-label="Companies"
          label="Companies"
          aside={<InfoTip>Every company on the platform except the demo company and deleted ones.</InfoTip>}
          figure={formatNumber(total)}
          note={companiesNote}
          onClick={() => navigate('/admin/companies')}
        />
        {/* What api/v1/admin/overview/ counts: users, quotes and loads whose
            company FK points at a company that is not demo and not deleted.
            Accounts and records created without a company (seeded staff,
            drivers, superuser-created quotes) are not in those totals, which
            is why they can be below one company's own lists. Users therefore
            shows every account (admin users endpoint) with the linked count
            as the note, and the Quotes/Orders labels say they are company-linked. */}
        <KpiTile
          aria-label="Users"
          label="Users"
          aside={<InfoTip>Every account on the platform, deleted accounts excluded. Only accounts linked to a company count toward that company.</InfoTip>}
          figure={formatNumber(usersPage?.count ?? overview.total_users)}
          note={usersPage ? `${formatNumber(overview.total_users)} linked to a company` : '\u00a0'}
          onClick={() => navigate('/admin/users')}
        />
        <KpiTile
          aria-label="Company quotes"
          label="Company quotes"
          aside={<InfoTip>{LINKED_TIP}</InfoTip>}
          figure={formatNumber(overview.total_quotes)}
          note={overview.quotes_this_month ? `${formatNumber(overview.quotes_this_month)} this month` : 'None this month'}
        />
        <KpiTile
          aria-label="Company orders"
          label="Company orders"
          aside={<InfoTip>{LINKED_TIP}</InfoTip>}
          figure={formatNumber(overview.total_loads)}
          note={overview.loads_this_month ? `${formatNumber(overview.loads_this_month)} this month` : 'None this month'}
        />
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
        {/* Two short status cards stacked beside the newest-companies list, so neither column runs long. */}
        <div className="admin-home-side">
          <section className="bk-card" aria-labelledby="ah-subs">
            <div className="bk-card__head">
              <h2 className="bk-card__title" id="ah-subs">Companies by subscription</h2>
              <Link className="bk-link bk-link--sm" to="/admin/companies">All companies</Link>
            </div>
            {total === 0 ? (
              <p className="bk-help">No companies yet.</p>
            ) : paying === 0 && noPlan === total ? (
              <p className="admin-empty-line">
                No companies on a paid plan yet.
                <span className="admin-empty-line__sub">All {formatNumber(total)} signed up without starting a plan.</span>
              </p>
            ) : (
              <div className="admin-dist" role="list">
                {/* Only statuses that have companies; zero rows say nothing. */}
                {SUBSCRIPTION_ROWS.filter(r => (byStatus[r.key] || 0) > 0).map(r => {
                  const n = byStatus[r.key] || 0;
                  return (
                    <div key={r.key} className="admin-dist__row" role="listitem" aria-label={`${r.label}: ${n}`}>
                      <div className="admin-dist__label">
                        <span>{r.label}</span>
                        <span className="admin-dist__hint">{r.hint}</span>
                      </div>
                      <span className="admin-dist__track" aria-hidden="true"><span style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></span>
                      <span className="admin-dist__n">{n}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="bk-card" aria-labelledby="ah-jobs">
            <div className="bk-card__head">
              <h2 className="bk-card__title" id="ah-jobs">Scheduled jobs</h2>
              <Link className="bk-link bk-link--sm" to="/admin/health">Platform health</Link>
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
        </div>
        <section className="bk-card" aria-labelledby="ah-new">
          <div className="bk-card__head"><h2 className="bk-card__title" id="ah-new">Newest companies</h2></div>
          {!companiesPage ? (
            <div className="ops-skel" style={{ height: 80 }} />
          ) : newest.length === 0 ? (
            <p className="bk-help">No companies yet.</p>
          ) : newest.map(c => {
            // What each new company has done so far (R8): the row carries a
            // fact beyond its name and date, so the card is not name-and-gap.
            const q = Number(c.quote_count) || 0, l = Number(c.load_count) || 0;
            const act = q + l === 0 ? 'No quotes or orders yet'
              : [q ? `${q} ${q === 1 ? 'quote' : 'quotes'}` : null, l ? `${l} ${l === 1 ? 'order' : 'orders'}` : null].filter(Boolean).join(' · ');
            return (
              <div key={c.id} className="bk-kv ah-new__row">
                <span className="bk-kv__label" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={c.owner_email || undefined}>{c.company_name}</span>
                <span className="ah-new__act">{act}</span>
                <span className="bk-kv__value" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</span>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
