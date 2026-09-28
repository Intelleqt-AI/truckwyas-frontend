import '@/pages/admin/admin-brand.css';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, deleteData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';
import PaginationControls from '@/pages/admin/PaginationControls';

// Per-user drawer opened from UsersTable — merges three separate data
// sources (UserActivityLog, AuditLog auth rows, UserSession) into one place
// instead of an admin having to piece them together across three panels.
// Each tab owns its own paginated query so switching tabs doesn't refetch
// the others.

const PAGE_SIZE = 25;
type Tab = 'activity' | 'sessions' | 'auth';

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
  display: 'flex', justifyContent: 'flex-end',
};
const panelStyle: React.CSSProperties = {
  width: 'min(640px, 100%)', height: '100%', background: 'var(--bg-surface)',
  borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
};
const headerStyle: React.CSSProperties = {
  padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
};
const closeBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 20,
  cursor: 'pointer', lineHeight: 1, padding: 0, width: 40, height: 40, borderRadius: 'var(--radius-control)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const tabsStyle: React.CSSProperties = {
  display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--border-subtle)',
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '10px 12px', minHeight: 40, background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', fontWeight: active ? 500 : 400,
  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
  marginBottom: -1,
});
const bodyStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 24 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '12px 16px', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 12px', minHeight: 40, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--status-danger-text, var(--status-danger))',
  borderRadius: 'var(--radius-control)', fontSize: 14, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer',
};

const fmt = (dateStr?: string | null) =>
  dateStr ? new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

interface ActivityRow {
  id: number; method: string; path: string; status_code: number; duration_ms: number;
  ip_address: string; created_at: string;
}
interface AuthRow {
  id: number; action: string; event: string; device: string; ip: string; created_at: string;
}
interface SessionRow {
  id: string; device: string; user_agent: string; ip_address: string;
  created_at: string; last_activity: string;
}

export default function UserActivityDrawer({
  userId, userLabel, onClose,
}: { userId: number | string; userLabel: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('activity');
  const [activityPage, setActivityPage] = useState(1);
  const [authPage, setAuthPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const activityQuery = useQuery({
    queryKey: ['admin-user-activity', userId, activityPage],
    queryFn: () => fetchData(`api/v1/admin/users/${userId}/activity/?page=${activityPage}&page_size=${PAGE_SIZE}`),
    enabled: tab === 'activity',
  });

  const authQuery = useQuery({
    queryKey: ['admin-user-auth-history', userId, authPage],
    queryFn: () => fetchData(`api/v1/admin/users/${userId}/auth-history/?page=${authPage}&page_size=${PAGE_SIZE}`),
    enabled: tab === 'auth',
  });

  const sessionsKey = ['admin-user-sessions', userId];
  const sessionsQuery = useQuery({
    queryKey: sessionsKey,
    queryFn: () => fetchData(`api/v1/admin/users/${userId}/sessions/`),
    enabled: tab === 'sessions',
  });

  const handleRevoke = async (session: SessionRow) => {
    setRevoking(session.id);
    try {
      await deleteData({ url: `api/v1/admin/users/${userId}/sessions/${session.id}/` });
      toast.success(`Signed out of ${session.device}`);
      qc.setQueryData(sessionsKey, (old: any) => {
        if (!old?.results) return old;
        return { ...old, results: old.results.filter((s: SessionRow) => s.id !== session.id) };
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to revoke session');
    } finally {
      setRevoking(null);
      setRevokeTarget(null);
    }
  };

  const activity: ActivityRow[] = activityQuery.data?.results || [];
  const auth: AuthRow[] = authQuery.data?.results || [];
  const sessions: SessionRow[] = sessionsQuery.data?.results || [];

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Activity</div>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 4 }}>{userLabel}</div>
          </div>
          <button className="admin-control admin-tint-hover" style={closeBtnStyle} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={tabsStyle}>
          <button className="admin-control" style={tabBtn(tab === 'activity')} onClick={() => setTab('activity')}>Activity</button>
          <button className="admin-control" style={tabBtn(tab === 'sessions')} onClick={() => setTab('sessions')}>
            Sessions {sessionsQuery.data ? `(${sessions.length})` : ''}
          </button>
          <button className="admin-control" style={tabBtn(tab === 'auth')} onClick={() => setTab('auth')}>Sign-in history</button>
        </div>

        <div style={bodyStyle}>
          {tab === 'activity' && (
            activityQuery.isLoading ? <Loader size={20} /> : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-heading-roles admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Time</th>
                        <th style={thStyle}>Method</th>
                        <th style={thStyle}>Path</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map(r => (
                        <tr key={r.id}>
                          <td style={tdStyle}>{fmt(r.created_at)}</td>
                          <td style={tdStyle}>{r.method}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{r.path}</td>
                          <td style={tdStyle}>
                            <span style={{ color: r.status_code >= 400 ? 'var(--status-danger-text, var(--status-danger))' : 'var(--text-secondary)' }}>
                              {r.status_code}
                            </span>
                          </td>
                          <td style={tdStyle}>{r.duration_ms}</td>
                        </tr>
                      ))}
                      {activity.length === 0 && (
                        <tr><td style={tdStyle} colSpan={5}>No recorded activity{activityQuery.data ? ' in the retention window.' : '.'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {activityQuery.data && (
                  <PaginationControls
                    page={activityQuery.data.page || 1}
                    numPages={activityQuery.data.num_pages || 1}
                    count={activityQuery.data.count || 0}
                    onPrev={() => setActivityPage(p => Math.max(1, p - 1))}
                    onNext={() => setActivityPage(p => p + 1)}
                  />
                )}
              </>
            )
          )}

          {tab === 'sessions' && (
            sessionsQuery.isLoading ? <Loader size={20} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map(s => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      padding: '4px 4px 4px 16px', minHeight: 48, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-nested)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{s.device}</div>
                      <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                        {s.ip_address || 'Unknown IP'} · last active {fmt(s.last_activity)}
                      </div>
                    </div>
                    <button
                      className="admin-control"
                      style={secondaryBtnStyle}
                      disabled={revoking === s.id}
                      onClick={() => setRevokeTarget(s)}
                    >
                      {revoking === s.id ? 'Signing out…' : 'Force logout'}
                    </button>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>No active sessions.</div>
                )}
              </div>
            )
          )}

          {tab === 'auth' && (
            authQuery.isLoading ? <Loader size={20} /> : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-heading-roles admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Time</th>
                        <th style={thStyle}>Event</th>
                        <th style={thStyle}>Device</th>
                        <th style={thStyle}>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auth.map(r => (
                        <tr key={r.id}>
                          <td style={tdStyle}>{fmt(r.created_at)}</td>
                          <td style={tdStyle}>
                            <span className={`status-badge ${r.action === 'LOGIN' ? 'active' : 'delayed'}`}>{r.event}</span>
                          </td>
                          <td style={tdStyle}>{r.device}</td>
                          <td style={tdStyle}>{r.ip}</td>
                        </tr>
                      ))}
                      {auth.length === 0 && (
                        <tr><td style={tdStyle} colSpan={4}>No sign-in history.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {authQuery.data && (
                  <PaginationControls
                    page={authQuery.data.page || 1}
                    numPages={authQuery.data.num_pages || 1}
                    count={authQuery.data.count || 0}
                    onPrev={() => setAuthPage(p => Math.max(1, p - 1))}
                    onNext={() => setAuthPage(p => p + 1)}
                  />
                )}
              </>
            )
          )}
        </div>
      </div>

      {revokeTarget && (
        <ConfirmModal
          title="Force logout"
          message={`Sign out of "${revokeTarget.device}"? That device will need to log in again. This doesn't affect any of their other active sessions.`}
          confirmLabel="Force logout"
          danger
          onConfirm={() => handleRevoke(revokeTarget)}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
