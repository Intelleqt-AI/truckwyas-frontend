import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { Loader } from '@/components/Loader';

// Platform-wide KPI cards — the "calculations" landing page for the admin
// section. Each card is clickable, jumping to the section it summarizes
// (same clickable-metric idiom Overview.tsx uses for its own KPI row).

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n);

// Brand primary-metric role: 28/36 semibold, tabular numerals.
const metricStyle: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 28, lineHeight: '36px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' };

export default function AdminHome() {
  const navigate = useNavigate();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchData('api/v1/admin/overview/'),
  });

  if (isLoading) return <Loader size={28} />;
  if (!overview) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      <div className="card metric-card admin-control admin-tint-hover" role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/companies')} onKeyDown={e => { if (e.key === 'Enter') navigate('/admin/companies'); }}>
        <div className="card-header"><span className="card-title">Companies</span></div>
        <div className="metric-value" style={metricStyle}>{overview.total_companies}</div>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 4 }}>
          {overview.companies_by_status.active} active · {overview.companies_by_status.suspended} suspended · {overview.companies_by_status.cancelled} cancelled
        </div>
      </div>
      <div className="card metric-card admin-control admin-tint-hover" role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')} onKeyDown={e => { if (e.key === 'Enter') navigate('/admin/users'); }}>
        <div className="card-header"><span className="card-title">Users</span></div>
        <div className="metric-value" style={metricStyle}>{overview.total_users}</div>
      </div>
      <div className="card metric-card">
        <div className="card-header"><span className="card-title">Quotes</span></div>
        <div className="metric-value" style={metricStyle}>{overview.total_quotes}</div>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 4 }}>{overview.quotes_this_month} this month</div>
      </div>
      <div className="card metric-card">
        <div className="card-header"><span className="card-title">Orders</span></div>
        <div className="metric-value" style={metricStyle}>{overview.total_loads}</div>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 4 }}>{overview.loads_this_month} this month</div>
      </div>
      <div className="card metric-card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-header"><span className="card-title">Estimated MRR</span></div>
        {/* Zero is a state to explain, not a headline number (design principles §1). */}
        {Number(overview.mrr_estimate) > 0 ? (
          <div className="metric-value" style={metricStyle}>{formatCurrency(overview.mrr_estimate)}</div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
            No recurring revenue yet.
          </div>
        )}
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 4 }}>
          Active + grace-period companies × flat monthly fee. This is an estimate, not reconciled against actual Paystack charges.
        </div>
      </div>
    </div>
  );
}
