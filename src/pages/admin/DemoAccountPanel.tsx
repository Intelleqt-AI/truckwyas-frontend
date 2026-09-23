import '@/pages/admin/admin-brand.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';

const cardStyle: React.CSSProperties = { padding: 24 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16,
};
const metricLabelStyle: React.CSSProperties = {
  fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4,
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={sectionTitleStyle}>Demo account</h2>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                No demo company exists yet — it normally self-creates on the scheduler's first run, or create it now.
              </div>
            </div>
            <button className="btn-action admin-control" style={{ minHeight: 40, borderRadius: 6 }} disabled={resetting} onClick={doReset}>
              {resetting ? 'Creating…' : 'Create demo company'}
            </button>
          </div>
        </div>
      )}

      {demoStatus?.exists && (
        <div className="card" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Demo account</h2>
            <button
              className="btn-action admin-control"
              style={{ minHeight: 40, borderRadius: 6 }}
              onClick={() => setConfirmReset(true)}
            >
              Force reset now
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={metricLabelStyle}>Quotes since last reset</div>
              <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{demoStatus.demo_quota_used}</div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 4 }}>Each visitor's own session gets 1, independent of this total</div>
            </div>
            <div>
              <div style={metricLabelStyle}>Last reset</div>
              <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{fmt(demoStatus.demo_last_reset_at)}</div>
            </div>
            <div>
              <div style={metricLabelStyle}>Idle-eligible for auto-reset</div>
              <div style={{ fontSize: 14, lineHeight: '20px', color: demoStatus.idle_eligible_for_auto_reset ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                {demoStatus.idle_eligible_for_auto_reset ? 'Yes — next 15-min check will reset it' : 'No'}
              </div>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
