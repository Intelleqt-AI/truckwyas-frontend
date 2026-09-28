import '@/pages/admin/admin-brand.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InfoTip } from '@/components/ui/InfoTip';
import '@/pages/ops-tiles.css';

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function DemoAccountPanel() {
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: demoStatus } = useQuery({
    queryKey: ['admin-demo-status'],
    queryFn: () => fetchData('api/v1/admin/demo-status/'),
    refetchInterval: 60_000,
  });

  const doReset = async () => {
    const wasCreate = !demoStatus?.exists;
    setResetting(true);
    try {
      await postData({ url: 'api/v1/admin/demo-status/', data: {} });
      toast.success(wasCreate ? 'Demo company created' : 'Demo company reset');
      qc.invalidateQueries({ queryKey: ['admin-demo-status'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset demo company');
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  return (
    <>
      {/* Shown even before the demo company exists yet, so there's always a
          way to create it from here rather than waiting on Celery beat's
          first tick. */}
      {demoStatus && !demoStatus.exists && (
        <div className="card" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Demo account</h2>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                No demo company yet. The scheduler creates it on its first run.
              </div>
            </div>
            <button className="btn-action admin-control" style={{ minHeight: 40, borderRadius: 'var(--radius-control)' }} disabled={resetting} onClick={doReset}>
              {resetting ? 'Creating…' : 'Create demo company'}
            </button>
          </div>
        </div>
      )}

      {demoStatus?.exists && (
        <section aria-label="Demo account">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Demo account</h2>
            <button
              className="btn-action admin-control"
              style={{ minHeight: 40, borderRadius: 'var(--radius-control)' }}
              onClick={() => setConfirmReset(true)}
            >
              Force reset now
            </button>
          </div>
          <div className="ops-tiles">
            <div className="ops-tile">
              <h3 className="ops-tile__label">
                Quotes since reset
                <InfoTip>Total across all visitors. Each visitor's own session gets 1 quote, independent of this total.</InfoTip>
              </h3>
              <div className="ops-tile__value">{demoStatus.demo_quota_used}</div>
              <div className="ops-tile__sub">All visitors</div>
            </div>
            <div className="ops-tile">
              <h3 className="ops-tile__label">Last reset</h3>
              <div className="ops-tile__value" style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.01em' }} title={fmt(demoStatus.demo_last_reset_at)}>{fmt(demoStatus.demo_last_reset_at)}</div>
              <div className="ops-tile__sub">Demo data reseeded</div>
            </div>
            <div className="ops-tile">
              <h3 className="ops-tile__label">
                Due for auto-reset
                <InfoTip>An idle demo company is reset by the next 15-minute check.</InfoTip>
              </h3>
              <div className={`ops-tile__value${demoStatus.idle_eligible_for_auto_reset ? ' is-attention' : ''}`}>
                {demoStatus.idle_eligible_for_auto_reset ? 'Yes' : 'No'}
              </div>
              <div className="ops-tile__sub">{demoStatus.idle_eligible_for_auto_reset ? 'Next 15-minute check' : 'Not idle'}</div>
            </div>
          </div>
        </section>
      )}

      {confirmReset && (
        <ConfirmModal
          title="Reset demo company"
          message="This immediately wipes and reseeds the shared demo company's fleet, quotes and orders back to the default dataset. Anyone using it right now loses their in-progress quote. This can't be undone."
          confirmLabel={resetting ? 'Resetting…' : 'Reset now'}
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
