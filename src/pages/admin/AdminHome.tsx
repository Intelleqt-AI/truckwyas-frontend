import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';
import { InfoTip } from '@/components/ui/InfoTip';
import '../ops-tiles.css';

// Platform-wide KPI tiles, the landing page for the admin section. Companies
// and Users tiles are clickable, jumping to the section they summarise.

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n);


export default function AdminHome() {
  const navigate = useNavigate();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchData('api/v1/admin/overview/'),
  });

  if (isLoading) return <Loader size={28} />;
  if (!overview) return null;

  const go = (to: string) => ({
    role: 'link' as const,
    tabIndex: 0,
    onClick: () => navigate(to),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') navigate(to); },
  });

  return (
    <>
      <section className="ops-tiles ops-tiles--4" aria-label="Platform totals">
        <div className="ops-tile ops-tile--link admin-control" {...go('/admin/companies')}>
          <h2 className="ops-tile__label">Companies</h2>
          <div className="ops-tile__value">{overview.total_companies}</div>
          <div className="ops-tile__sub" title={`${overview.companies_by_status.active} active, ${overview.companies_by_status.suspended} suspended, ${overview.companies_by_status.cancelled} cancelled`}>
            {overview.companies_by_status.active} active, {overview.companies_by_status.suspended} suspended
          </div>
        </div>
        <div className="ops-tile ops-tile--link admin-control" {...go('/admin/users')}>
          <h2 className="ops-tile__label">Users</h2>
          <div className="ops-tile__value">{overview.total_users}</div>
          <div className="ops-tile__sub">All companies</div>
        </div>
        <div className="ops-tile">
          <h2 className="ops-tile__label">Quotes</h2>
          <div className="ops-tile__value">{overview.total_quotes}</div>
          <div className="ops-tile__sub">{overview.quotes_this_month} this month</div>
        </div>
        <div className="ops-tile">
          <h2 className="ops-tile__label">Orders</h2>
          <div className="ops-tile__value">{overview.total_loads}</div>
          <div className="ops-tile__sub">{overview.loads_this_month} this month</div>
        </div>
      </section>
      <section className="ops-tiles ops-tiles--4" aria-label="Revenue">
        <div className="ops-tile">
          <h2 className="ops-tile__label">
            Estimated MRR
            <InfoTip>Active and grace-period companies times the flat monthly fee. An estimate, not reconciled against actual Paystack charges.</InfoTip>
          </h2>
          {/* Zero is a state to explain, not a headline number (design principles §1). */}
          {Number(overview.mrr_estimate) > 0 ? (
            <div className="ops-tile__value" title={formatCurrency(overview.mrr_estimate)}>{formatCurrency(overview.mrr_estimate)}</div>
          ) : (
            <div className="ops-tile__value" style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500, letterSpacing: 'normal', whiteSpace: 'normal' }}>No recurring revenue yet</div>
          )}
          <div className="ops-tile__sub">Estimate, per month</div>
        </div>
      </section>
    </>
  );
}
