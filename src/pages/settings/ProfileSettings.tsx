import "./profile-form.css";
import { useState, useEffect, useRef } from "react";
import { fetchData, patchData } from "@/lib/Api";
import { useAuth } from "@/lib/AuthContext";
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
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  lineHeight: '24px',
  margin: 0,
  textTransform: 'none',
  letterSpacing: 'normal',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const sectionBodyStyle: React.CSSProperties = {
  padding: '20px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  textTransform: 'none',
  letterSpacing: 'normal',
  color: 'var(--text-primary)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  minHeight: 48,
  minWidth: 0,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  lineHeight: '24px',
  transition: 'border-color 0.15s',
};


const gridStyle: React.CSSProperties = {
  display: 'grid',
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
  const { user: authUser, refreshUser } = useAuth();
  const isDemo = !!authUser?.is_demo;

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
    if (isDemo) return;
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
      // Refresh the auth context so the header/dropdown/Copilot avatars update immediately.
      refreshUser();
    } catch {}
    setUploadingAvatar(false);
    e.target.value = '';
  };

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (isDemo) return;
    setSaving(true);
    try {
      await patchData({ url: 'api/auth/me/', data: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="tw-profile-settings" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Profile settings
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Manage your personal information and account preferences
        </div>
      </div>

      {/* Profile picture */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Profile picture</h2>
        </div>
        <div style={{ ...sectionBodyStyle, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
              disabled={isDemo}
            />
            <button
              style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, borderRadius: 6, minHeight: 40,
                cursor: (uploadingAvatar || isDemo) ? 'not-allowed' : 'pointer',
                letterSpacing: 'normal',
                opacity: (uploadingAvatar || isDemo) ? 0.6 : 1,
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || isDemo}
              title={isDemo ? 'Fixed in demo mode' : undefined}
            >
              {uploadingAvatar ? 'Uploading…' : 'Change picture'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              JPG, GIF or PNG. Max size 2MB.
            </div>
          </div>
        </div>
      </div>

      {/* Personal information */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Personal information</h2>
        </div>
        <div style={sectionBodyStyle}>
          <div className="tw-profile-fields" style={{ ...gridStyle, marginBottom: 16 }}>
            <div>
              <label htmlFor="profile-first_name" style={labelStyle}>First name</label>
              <input id="profile-first_name" style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="profile-last_name" style={labelStyle}>Last name</label>
              <input id="profile-last_name" style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="profile-email" style={labelStyle}>Email address</label>
            <input id="profile-email" style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="tw-profile-fields" style={gridStyle}>
            <div>
              <label htmlFor="profile-job_title" style={labelStyle}>Job title</label>
              <input id="profile-job_title" style={inputStyle} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
            </div>
            <div>
              <label htmlFor="profile-phone" style={labelStyle}>Phone number</label>
              <input id="profile-phone" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Preferences</h2>
        </div>
        <div style={sectionBodyStyle}>
          <div className="tw-profile-fields" style={{ ...gridStyle, marginBottom: 16 }}>
            <div>
              <label htmlFor="profile-timezone" style={labelStyle}>Timezone</label>
              <Select value={form.timezone} onValueChange={val => set('timezone', val)}>
                <SelectTrigger id="profile-timezone" style={{ ...inputStyle, outline: undefined }}>
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
              <label htmlFor="profile-language" style={labelStyle}>Language</label>
              <Select value={form.language} onValueChange={val => set('language', val)}>
                <SelectTrigger id="profile-language" style={{ ...inputStyle, outline: undefined }}>
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
          <div className="tw-profile-fields" style={{ ...gridStyle, marginBottom: 20 }}>
            <div>
              <label htmlFor="profile-date_format" style={labelStyle}>Date format</label>
              <Select value={form.date_format} onValueChange={val => set('date_format', val)}>
                <SelectTrigger id="profile-date_format" style={{ ...inputStyle, outline: undefined }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-action"
              onClick={handleSave}
              disabled={saving || isDemo}
              title={isDemo ? 'Fixed in demo mode' : undefined}
              style={{ opacity: (saving || isDemo) ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : undefined }}
            >
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
