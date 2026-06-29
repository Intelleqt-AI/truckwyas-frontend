import { useState, useEffect, useRef } from "react";
import { fetchData, patchData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData('api/auth/me/').then((d: any) => {
      if (d) {
        setForm({
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          email: d.email || '',
          job_title: d.job_title || '',
          phone: d.phone || '',
          timezone: d.timezone || 'Africa/Johannesburg',
          language: d.language || 'en',
          date_format: d.date_format || 'DD/MM/YYYY',
        });
        if (d.avatar) setAvatarUrl(d.avatar);
      }
    }).catch(() => {});
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const result = await patchData({ url: 'api/auth/me/', data: formData });
      if (result?.avatar) setAvatarUrl(result.avatar);
    } catch {}
    setUploadingAvatar(false);
    e.target.value = '';
  };

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
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
              color: 'var(--accent-primary)', flexShrink: 0,
            }}>
              {(form.first_name[0] || '') + (form.last_name[0] || '') || 'AU'}
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <button
              style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2,
                cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
                opacity: uploadingAvatar ? 0.6 : 1,
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? 'UPLOADING...' : 'CHANGE PICTURE'}
            </button>
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
              <Select value={form.timezone} onValueChange={val => set('timezone', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Johannesburg">South Africa (UTC+2)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
                  <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <Select value={form.language} onValueChange={val => set('language', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="af">Afrikaans</SelectItem>
                  <SelectItem value="zu">Zulu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div style={{ marginBottom: 20, maxWidth: 240 }}>
            <label style={labelStyle}>Date Format</label>
            <Select value={form.date_format} onValueChange={val => set('date_format', val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-action"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
