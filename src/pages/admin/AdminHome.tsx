import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Platform-wide KPI cards — the "calculations" landing page for the admin
// section. Each card is clickable, jumping to the section it summarizes
// (same clickable-metric idiom Overview.tsx uses for its own KPI row).

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <div className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/companies')}>
        <div className="card-header"><span className="card-title">Companies</span></div>
        <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_companies}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {overview.companies_by_status.active} active · {overview.companies_by_status.suspended} suspended · {overview.companies_by_status.cancelled} cancelled
        </div>
      </div>
      <div className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>
        <div className="card-header"><span className="card-title">Users</span></div>
        <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_users}</div>
      </div>
      <div className="card metric-card">
        <div className="card-header"><span className="card-title">Quotes</span></div>
        <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_quotes}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{overview.quotes_this_month} this month</div>
      </div>
      <div className="card metric-card">
        <div className="card-header"><span className="card-title">Orders</span></div>
        <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_loads}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{overview.loads_this_month} this month</div>
      </div>
      <div className="card metric-card" style={{ gridColumn: 'span 4' }}>
        <div className="card-header"><span className="card-title">Estimated MRR</span></div>
        <div className="metric-value" style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{formatCurrency(overview.mrr_estimate)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Active + grace-period companies × flat monthly fee — an estimate, not reconciled against actual Paystack charges.
        </div>
      </div>
    </div>
  );
}
