import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';

const cardStyle: React.CSSProperties = { padding: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 };

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
              <div style={sectionTitleStyle}>Demo Account</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                No demo company exists yet — it normally self-creates on Celery beat's first run, or create it now.
              </div>
            </div>
            <button className="btn-action" style={{ fontSize: 11 }} disabled={resetting} onClick={doReset}>
              {resetting ? 'Creating…' : 'Create Demo Company'}
            </button>
          </div>
        </div>
      )}

      {demoStatus?.exists && (
        <div className="card" style={cardStyle}>
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
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Quotes since last reset</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{demoStatus.demo_quota_used}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Each visitor's own session gets 1, independent of this total</div>
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
