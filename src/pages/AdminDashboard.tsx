import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CompaniesTable } from '@/pages/admin/CompaniesTable';
import UsersTable from '@/pages/admin/UsersTable';
import SearchPanel from '@/pages/admin/SearchPanel';
import JobHealthPanel from '@/pages/admin/JobHealthPanel';
import IntegrationsPanel from '@/pages/admin/IntegrationsPanel';
import AuditLogPanel from '@/pages/admin/AuditLogPanel';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n);

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };

export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Redirect anyone who isn't a Django superuser — same pattern Settings.tsx
  // already uses for its own adminOnly sections. The real enforcement is
  // server-side (every /api/v1/admin/ endpoint requires IsSuperUser); this
  // is just so a non-superuser never lands on a dead/empty page.
  if (!authUser?.is_superuser) return <Navigate to="/" replace />;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchData('api/v1/admin/overview/'),
  });

  const { data: demoStatus } = useQuery({
    queryKey: ['admin-demo-status'],
    queryFn: () => fetchData('api/v1/admin/demo-status/'),
    refetchInterval: 60_000,
  });

  const doReset = async () => {
    setResetting(true);
    try {
      await postData({ url: 'api/v1/admin/demo-status/', data: {} });
      toast.success('Demo company reset');
      qc.invalidateQueries({ queryKey: ['admin-demo-status'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset demo company');
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Platform
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Admin Dashboard</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Cross-tenant visibility and controls, superuser only. Every write action below is recorded in the audit log.
        </div>
      </div>

      {/* Overview */}
      {overviewLoading ? <Loader size={28} /> : overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card metric-card"><div className="card-header"><span className="card-title">Companies</span></div>
            <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_companies}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {overview.companies_by_status.active} active · {overview.companies_by_status.suspended} suspended · {overview.companies_by_status.cancelled} cancelled
            </div>
          </div>
          <div className="card metric-card"><div className="card-header"><span className="card-title">Users</span></div>
            <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_users}</div>
          </div>
          <div className="card metric-card"><div className="card-header"><span className="card-title">Quotes</span></div>
            <div className="metric-value" style={{ fontSize: 20 }}>{overview.total_quotes}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{overview.quotes_this_month} this month</div>
          </div>
          <div className="card metric-card"><div className="card-header"><span className="card-title">Orders</span></div>
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
      )}

      {/* Demo account */}
      {demoStatus?.exists && (
        <div className="card" style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitleStyle}>Demo Account</div>
            <button
              className="btn-action"
              style={{ fontSize: 11 }}
              onClick={() => setConfirmReset(true)}
            >
              Force Reset Now
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Quota used</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{demoStatus.demo_quota_used} / 1</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Last reset</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmt(demoStatus.demo_last_reset_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Idle-eligible for auto-reset</div>
              <div style={{ fontSize: 13, color: demoStatus.idle_eligible_for_auto_reset ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                {demoStatus.idle_eligible_for_auto_reset ? 'Yes — next 15-min check will reset it' : 'No'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Companies */}
      <div style={{ marginBottom: 24 }}>
        <CompaniesTable />
      </div>

      {/* Users */}
      <div style={{ marginBottom: 24 }}>
        <UsersTable />
      </div>

      {/* Support search */}
      <div style={{ marginBottom: 24 }}>
        <SearchPanel />
      </div>

      {/* Platform health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <JobHealthPanel />
        <IntegrationsPanel />
      </div>

      {/* Audit log */}
      <div style={{ marginBottom: 24 }}>
        <AuditLogPanel />
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Reset demo company"
          message="This immediately wipes and reseeds the shared demo company's fleet, quotes and orders back to the default dataset — anyone using it right now loses their in-progress quote. This can't be undone."
          confirmLabel={resetting ? 'Resetting…' : 'Reset now'}
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
