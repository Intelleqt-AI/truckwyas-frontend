import { useState } from "react";

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
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new1: '', new2: '' });

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.new1) return;
    if (pwForm.new1 !== pwForm.new2) { alert('Passwords do not match'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setPwForm({ current: '', new1: '', new2: '' });
  };

  const sessions = [
    { device: 'Chrome on macOS', location: 'Johannesburg, ZA', time: 'Active now', current: true },
    { device: 'Safari on iPhone', location: 'Cape Town, ZA', time: '2 hours ago', current: false },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
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
          <span style={sectionTitleStyle}>🛡 Security Options</span>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <ToggleRow label="Two-factor authentication" description="Require OTP on login in addition to password" checked={twoFactor} onChange={setTwoFactor} badge="Recommended" />
          <ToggleRow label="Session timeout" description="Auto sign out after 30 minutes of inactivity" checked={sessionTimeout} onChange={setSessionTimeout} />
          <ToggleRow label="Login alerts" description="Email me when a new device signs in" checked={loginAlerts} onChange={setLoginAlerts} />
        </div>
      </div>

      {/* Active Sessions */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Active Sessions</span>
        </div>
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
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.location} · {s.time}</div>
              </div>
              {!s.current && (
                <button style={{
                  background: 'none', border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)', padding: '5px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                  cursor: 'pointer', letterSpacing: '0.05em',
                }}>REVOKE</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
