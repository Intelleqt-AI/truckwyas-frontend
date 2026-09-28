import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';
import { InfoTip } from '@/components/ui/InfoTip';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';

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

  const mrr = Number(overview.mrr_estimate) || 0;

  return (
    <KpiRow>
      <KpiTile
        aria-label="Companies"
        label="Companies"
        figure={overview.total_companies}
        note={`${overview.companies_by_status.active} active, ${overview.companies_by_status.suspended} suspended`}
        onClick={() => navigate('/admin/companies')}
      />
      <KpiTile aria-label="Users" label="Users" figure={overview.total_users} note="All companies" onClick={() => navigate('/admin/users')} />
      <KpiTile aria-label="Quotes" label="Quotes" figure={overview.total_quotes} note={`${overview.quotes_this_month} this month`} />
      <KpiTile aria-label="Orders" label="Orders" figure={overview.total_loads} note={`${overview.loads_this_month} this month`} />
      {/* A zero MRR is not a headline number (design principles §1): the tile is left out. */}
      {mrr > 0 && (
        <KpiTile
          aria-label="Estimated MRR"
          label="Estimated MRR"
          aside={<InfoTip>Active and grace-period companies times the flat monthly fee. An estimate, not reconciled against actual Paystack charges.</InfoTip>}
          figure={<span title={formatCurrency(mrr)}>{formatCurrency(mrr)}</span>}
          note="Estimate, per month"
        />
      )}
    </KpiRow>
  );
}
