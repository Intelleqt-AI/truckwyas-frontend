import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, patchData, deleteData } from "@/lib/Api";
import { formatRelativeTime } from "@/lib/formatters";
import { toast } from "@/lib/toast";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid var(--border-subtle)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 2,
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  outline: 'none',
};

// Maps the activity endpoint's event subtypes to a row label + dot color.
const ACTIVITY_META: Record<string, { label: string; color: string }> = {
  login: { label: 'Signed in', color: 'var(--status-success)' },
  logout: { label: 'Signed out', color: 'var(--text-tertiary)' },
  revoked: { label: 'Session revoked', color: 'var(--status-danger)' },
  revoked_others: { label: 'Other sessions revoked', color: 'var(--status-danger)' },
  revoked_all: { label: 'All sessions revoked', color: 'var(--status-danger)' },
};

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
  badgeColor?: string;
}

function ToggleRow({ label, description, checked, onChange, badge, badgeColor }: ToggleRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px', borderBottom: '1px solid var(--border-row)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: description ? 2 : 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
          {badge && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
              borderRadius: 2, background: badgeColor || 'var(--status-success-bg)',
              color: badgeColor ? 'var(--bg-deep)' : 'var(--accent-primary)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{badge}</span>
          )}
        </div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--accent-primary)' : 'var(--border-active)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-surface)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

export function SecuritySettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new1: '', new2: '' });
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSessions = () => {
    setLoadingSessions(true);
    return fetchData('api/v1/auth/sessions/')
      .then((d: any) => {
        setSessions(Array.isArray(d) ? d : (d?.results || []));
      })
      .catch(() => {
        setSessions([]);
      })
      .finally(() => setLoadingSessions(false));
  };

  const loadActivity = () => {
    setLoadingActivity(true);
    return fetchData('api/v1/auth/sessions/activity/')
      .then((d: any) => {
        setActivity(Array.isArray(d) ? d : (d?.results || []));
      })
      .catch(() => {
        setActivity([]);
      })
      .finally(() => setLoadingActivity(false));
  };

  useEffect(() => {
    loadSessions();
    loadActivity();
    // Load persisted security toggles
    fetchData('api/v1/auth/security-settings/')
      .then((s: any) => {
        if (s && typeof s === 'object') {
          setTwoFactor(!!s.two_factor);
          setSessionTimeout(!!s.session_timeout);
          setLoginAlerts(!!s.login_alerts);
        }
      })
      .catch(() => { /* keep defaults on failure */ });
  }, []);

  // Optimistically flip a toggle and persist it; revert on failure.
  const updateSecuritySetting = async (
    key: 'two_factor' | 'session_timeout' | 'login_alerts',
    value: boolean,
    setter: (v: boolean) => void,
  ) => {
    setter(value);
    try {
      await patchData({ url: 'api/v1/auth/security-settings/', data: { [key]: value } });
      // Let other parts of the app (e.g. the idle-logout watcher in OSLayout)
      // react immediately, without a reload.
      window.dispatchEvent(new CustomEvent('tw:security-settings-changed', { detail: { [key]: value } }));
    } catch (err) {
      setter(!value);
      toast.error('Failed to update setting');
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!window.confirm('Sign out this device? It will need to log in again.')) return;
    setRevokingId(id);
    try {
      await deleteData({ url: `api/v1/auth/sessions/${id}/` });
      await Promise.all([loadSessions(), loadActivity()]);
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const otherCount = sessions.filter(s => !s.current).length;
  const hasOthers = otherCount > 0;

  const handleBulkLogout = async () => {
    if (hasOthers) {
      if (!window.confirm(`Sign out ${otherCount} other session${otherCount === 1 ? '' : 's'}? Those devices will need to log in again.`)) return;
      setBulkBusy(true);
      try {
        await deleteData({ url: 'api/v1/auth/sessions/?scope=others' });
        await Promise.all([loadSessions(), loadActivity()]);
        toast.success('Signed out other sessions');
      } catch (err) {
        toast.error('Failed to sign out other sessions');
      } finally {
        setBulkBusy(false);
      }
    } else {
      if (!window.confirm('Sign out ALL sessions, including this one? You will be returned to the login screen.')) return;
      setBulkBusy(true);
      try {
        await deleteData({ url: 'api/v1/auth/sessions/?scope=all' });
        // Mirrors OSLayout.tsx's signOut() client-side cleanup — the server has
        // already killed this session, so no further authenticated calls.
        localStorage.removeItem('access');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('onboarding_done');
        queryClient.clear();
        toast.success('Signed out everywhere');
        navigate('/login');
      } catch (err) {
        setBulkBusy(false);
        toast.error('Failed to sign out');
      }
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.new1) return;
    if (pwForm.new1 !== pwForm.new2) { alert('Passwords do not match'); return; }
    setSaving(true);
    try {
      await postData({
        url: 'api/v1/auth/change-password/',
        data: { current_password: pwForm.current, new_password: pwForm.new1 },
      });
      setPwForm({ current: '', new1: '', new2: '' });
      alert('Password updated successfully');
    } catch (err) {
      console.error('Password change failed:', err);
      alert('Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteData({ url: 'api/v1/auth/delete-account/', data: { password: deletePassword } });
      // Mirrors OSLayout.tsx's signOut() client-side cleanup — the server has
      // already killed every session for this user.
      localStorage.removeItem('access');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('onboarding_done');
      queryClient.clear();
      toast.success('Your account has been deleted');
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Security Settings
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Manage your account security and authentication methods
        </div>
      </div>

      {/* Change Password */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Change Password</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input style={inputStyle} type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input style={inputStyle} type="password" value={pwForm.new1} onChange={e => setPwForm(p => ({ ...p, new1: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input style={inputStyle} type="password" value={pwForm.new2} onChange={e => setPwForm(p => ({ ...p, new2: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-action" onClick={handleChangePassword} disabled={saving}>
              {saving ? 'UPDATING...' : 'UPDATE PASSWORD'}
            </button>
          </div>
        </div>
      </div>

      {/* Security Options */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Security Options</span>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <ToggleRow label="Two-factor authentication" description="Require OTP on login in addition to password" checked={twoFactor} onChange={(v) => updateSecuritySetting('two_factor', v, setTwoFactor)} badge="Recommended" />
          <ToggleRow label="Session timeout" description="Auto sign out after 30 minutes of inactivity" checked={sessionTimeout} onChange={(v) => updateSecuritySetting('session_timeout', v, setSessionTimeout)} />
          <ToggleRow label="Login alerts" description="Email me when a new device signs in" checked={loginAlerts} onChange={(v) => updateSecuritySetting('login_alerts', v, setLoginAlerts)} />
        </div>
      </div>

      {/* Active Sessions */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Active Sessions</span>
        </div>
        {loadingSessions ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No active sessions</div>
        ) : (
          <div>
          {sessions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: i < sessions.length - 1 ? '1px solid var(--border-row)' : 'none',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.device}</span>
                  {s.current && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
                      borderRadius: 2, background: 'var(--status-success-bg)',
                      color: 'var(--accent-primary)', textTransform: 'uppercase',
                    }}>Current</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.location} · {formatRelativeTime(s.time)}</div>
              </div>
              {!s.current && (
                <button
                  onClick={() => handleRevokeSession(s.id)}
                  disabled={revokingId === s.id}
                  style={{
                    background: 'none', border: '1px solid var(--status-danger)',
                    color: 'var(--status-danger)', padding: '5px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                    cursor: revokingId === s.id ? 'default' : 'pointer',
                    letterSpacing: '0.05em', opacity: revokingId === s.id ? 0.5 : 1,
                  }}
                >{revokingId === s.id ? 'REVOKING...' : 'REVOKE'}</button>
              )}
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '12px 20px', borderTop: '1px solid var(--border-row)',
          }}>
            <button
              onClick={handleBulkLogout}
              disabled={bulkBusy}
              style={{
                background: 'none', border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                cursor: bulkBusy ? 'default' : 'pointer',
                letterSpacing: '0.05em', opacity: bulkBusy ? 0.5 : 1,
              }}
            >{bulkBusy ? 'WORKING...' : hasOthers ? 'LOG OUT OTHER SESSIONS' : 'LOG OUT ALL SESSIONS'}</button>
          </div>
          </div>
        )}
      </div>

      {/* Login Activity */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Login Activity</span>
        </div>
        {loadingActivity ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading activity...</div>
        ) : activity.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No recent activity</div>
        ) : (
          <div>
          {activity.map((a, i) => {
            const meta = ACTIVITY_META[a.event]
              || (a.action === 'LOGIN' ? ACTIVITY_META.login : ACTIVITY_META.logout);
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 20px', borderBottom: i < activity.length - 1 ? '1px solid var(--border-row)' : 'none',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: meta.color,
                }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {a.device} · {a.ip} · {formatRelativeTime(a.time)}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{ ...sectionStyle, borderColor: 'var(--status-danger)' }}>
        <div style={sectionHeaderStyle}>
          <span style={{ ...sectionTitleStyle, color: 'var(--status-danger)' }}>Danger Zone</span>
        </div>
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>Delete my account</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Deactivates your account and signs you out on every device immediately.
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: 'none', border: '1px solid var(--status-danger)',
              color: 'var(--status-danger)', padding: '8px 16px',
              fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
              cursor: 'pointer', letterSpacing: '0.06em', flexShrink: 0,
            }}
          >
            DELETE MY ACCOUNT
          </button>
        </div>
      </div>

      {/* Delete Account confirmation modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={closeDeleteModal}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--status-danger)',
              borderRadius: 4,
              padding: 28,
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              Delete your account?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Your account will be deactivated and you'll be signed out on every device
              immediately. This can be reversed by an admin — it does not erase your data.
            </div>
            <label style={labelStyle}>Confirm your password</label>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              type="password"
              autoFocus
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError(null); }}
              onKeyDown={e => { if (e.key === 'Enter' && deletePassword && !deleting) handleDeleteAccount(); }}
              placeholder="Your current password"
            />
            {deleteError && (
              <div style={{ fontSize: 11, color: 'var(--status-danger)', marginBottom: 12 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: deleteError ? 4 : 20 }}>
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                style={{
                  padding: '8px 18px', background: 'transparent',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em', cursor: deleting ? 'default' : 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!deletePassword || deleting}
                style={{
                  padding: '8px 18px',
                  background: 'var(--status-danger)',
                  border: 'none', color: '#fff', borderRadius: 2,
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  letterSpacing: '0.06em',
                  cursor: (!deletePassword || deleting) ? 'default' : 'pointer',
                  opacity: (!deletePassword || deleting) ? 0.5 : 1,
                }}
              >
                {deleting ? 'DELETING...' : 'DELETE ACCOUNT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
