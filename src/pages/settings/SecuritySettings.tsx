import { useState, useEffect } from "react";
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
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
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
              letterSpacing: '0.08em',
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
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new1: '', new2: '' });
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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

  useEffect(() => {
    loadSessions();
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
      await loadSessions();
      toast.success('Session revoked');
    } catch (err) {
      toast.error('Failed to revoke session');
    } finally {
      setRevokingId(null);
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
                      color: 'var(--accent-primary)',                     }}>Current</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
