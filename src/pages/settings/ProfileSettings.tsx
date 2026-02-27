import { useState, useEffect } from "react";
import { fetchData, patchData } from "@/lib/Api";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const sectionBodyStyle: React.CSSProperties = {
  padding: '20px',
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
  transition: 'border-color 0.15s',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto' as const,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

export function ProfileSettings() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    job_title: '', phone: '',
    timezone: 'Africa/Johannesburg',
    language: 'en',
    date_format: 'DD/MM/YYYY',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchData('api/auth/me/').then((d: any) => {
      if (d) setForm({
        first_name: d.first_name || '',
        last_name: d.last_name || '',
        email: d.email || '',
        job_title: d.job_title || '',
        phone: d.phone || '',
        timezone: d.timezone || 'Africa/Johannesburg',
        language: d.language || 'en',
        date_format: d.date_format || 'DD/MM/YYYY',
      });
    }).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchData({ url: 'api/auth/me/', data: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Profile Settings
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Manage your personal information and account preferences
        </div>
      </div>

      {/* Profile Picture */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Profile Picture</span>
        </div>
        <div style={{ ...sectionBodyStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
            color: 'var(--accent-primary)', flexShrink: 0,
          }}>
            {(form.first_name[0] || '') + (form.last_name[0] || '') || 'AU'}
          </div>
          <div>
            <button style={{
              background: 'none', border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', padding: '6px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2,
              cursor: 'pointer', letterSpacing: '0.05em',
            }}>CHANGE PICTURE</button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              JPG, GIF or PNG. Max size 2MB.
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Personal Information</span>
        </div>
        <div style={sectionBodyStyle}>
          <div style={{ ...gridStyle, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email Address</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Job Title</label>
              <input style={inputStyle} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Preferences</span>
        </div>
        <div style={sectionBodyStyle}>
          <div style={{ ...gridStyle, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select style={selectStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                <option value="Africa/Johannesburg">South Africa (UTC+2)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">London (UTC+0)</option>
                <option value="America/New_York">New York (UTC-5)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <select style={selectStyle} value={form.language} onChange={e => set('language', e.target.value)}>
                <option value="en">English</option>
                <option value="af">Afrikaans</option>
                <option value="zu">Zulu</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20, maxWidth: 240 }}>
            <label style={labelStyle}>Date Format</label>
            <select style={selectStyle} value={form.date_format} onChange={e => set('date_format', e.target.value)}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-action"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saved ? '✓ SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
