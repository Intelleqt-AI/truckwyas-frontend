import { useState, useEffect, useRef } from "react";
import { fetchData, patchData, postData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';

const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const resolveLogoUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${apiBase}/${url.replace(/^\//, '')}`;
};

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

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

export function CompanySettings() {
  const [form, setForm] = useState({
    company_name: '', registration_number: '', vat_number: '',
    industry: '', website: '', description: '',
    street: '', city: '', province: '', postal_code: '', country: 'South Africa',
    phone: '', email: '', support_email: '',
    default_quote_validity_days: '7',
    allow_cross_border: 'yes',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData('/api/v1/company/profile/').then((d: any) => {
      if (d) {
        setForm({
          company_name: d.company_name || '',
          registration_number: d.registration_number || '',
          vat_number: d.vat_number || '',
          industry: d.industry || '',
          website: d.website || '',
          description: d.description || '',
          street: d.address?.street || '',
          city: d.address?.city || '',
          province: d.address?.province || '',
          postal_code: d.address?.postal_code || '',
          country: d.address?.country || 'South Africa',
          phone: d.contact?.phone || '',
          email: d.contact?.email || '',
          support_email: d.contact?.support_email || '',
          default_quote_validity_days:
            d.default_quote_validity_days != null ? String(d.default_quote_validity_days) : '7',
          allow_cross_border: d.allow_cross_border === false ? 'no' : 'yes',
        });
        // Only show a real uploaded logo, not the backend's default placeholder
        if (d.logo_url && !d.logo_url.endsWith('/brand/logo.svg')) setLogoUrl(d.logo_url);
      }
    }).catch(() => { toast.error('Failed to load company details'); });
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size exceeds 2MB limit');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingLogo(true);
    try {
      const data = new FormData();
      data.append('logo', file);
      const res: any = await postData({ url: 'api/v1/company/logo/', data });
      if (res?.logo_url) setLogoUrl(res.logo_url);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload logo');
    }
    setUploadingLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    const validityDays = parseInt(form.default_quote_validity_days, 10);
    if (isNaN(validityDays) || validityDays < 1 || validityDays > 365) {
      toast.error('Default quote validity must be between 1 and 365 days');
      return;
    }
    setSaving(true);
    try {
      await patchData({ url: '/api/v1/company/profile/', data: {
        company_name: form.company_name,
        registration_number: form.registration_number,
        vat_number: form.vat_number,
        industry: form.industry,
        website: form.website,
        description: form.description,
        address: { street: form.street, city: form.city, province: form.province, postal_code: form.postal_code, country: form.country },
        contact: { phone: form.phone, email: form.email, support_email: form.support_email },
        default_quote_validity_days: validityDays,
        allow_cross_border: form.allow_cross_border === 'yes',
      } });
      setSaved(true);
      toast.success('Company details saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save company details');
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Company Details</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your business information and branding</div>
      </div>

      {/* Company Logo */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Company Logo</span></div>
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 96, height: 96, flexShrink: 0,
            border: '1px solid var(--border-subtle)', borderRadius: 4,
            background: 'var(--input-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {logoUrl ? (
              <img src={resolveLogoUrl(logoUrl)} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>No logo</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
              This logo appears on quotes and invoices sent to your customers.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              PNG, JPG, GIF or WebP · max 2MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleLogoSelect}
              style={{ display: 'none' }}
            />
            <button
              className="btn-action"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              style={{ opacity: uploadingLogo ? 0.6 : 1 }}
            >
              {uploadingLogo ? 'UPLOADING...' : logoUrl ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
            </button>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Business Information</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ ...grid2, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Company Name</label>
              <input style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <Select value={form.industry} onValueChange={val => set('industry', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_freight">General Freight</SelectItem>
                  <SelectItem value="refrigerated">Refrigerated Transport</SelectItem>
                  <SelectItem value="hazmat">Hazmat / Dangerous Goods</SelectItem>
                  <SelectItem value="construction">Construction Materials</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div style={{ ...grid2, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Registration Number</label>
              <input style={inputStyle} value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="YYYY/XXXXXX/XX" />
            </div>
            <div>
              <label style={labelStyle}>VAT Number</label>
              <input style={inputStyle} value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="4XXXXXXXXX" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' as const }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Business Address</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Street Address</label>
            <input style={inputStyle} value={form.street} onChange={e => set('street', e.target.value)} />
          </div>
          <div style={{ ...grid3, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Province</label>
              <Select value={form.province} onValueChange={val => set('province', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GP">Gauteng</SelectItem>
                  <SelectItem value="WC">Western Cape</SelectItem>
                  <SelectItem value="KZN">KwaZulu-Natal</SelectItem>
                  <SelectItem value="EC">Eastern Cape</SelectItem>
                  <SelectItem value="LP">Limpopo</SelectItem>
                  <SelectItem value="MP">Mpumalanga</SelectItem>
                  <SelectItem value="NW">North West</SelectItem>
                  <SelectItem value="FS">Free State</SelectItem>
                  <SelectItem value="NC">Northern Cape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Postal Code</label>
              <input style={inputStyle} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Contact Details</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ ...grid3 }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Business Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Support Email</label>
              <input style={inputStyle} type="email" value={form.support_email} onChange={e => set('support_email', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Quote Defaults */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Quote Defaults</span></div>
        <div style={{ padding: 20 }}>
          <div style={grid2}>
            <div>
              <label style={labelStyle}>Default Quote Validity (Days)</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={365}
                value={form.default_quote_validity_days}
                onChange={e => set('default_quote_validity_days', e.target.value)}
              />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                New quotes will default to expire this many days after creation. Can be overridden per quote.
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cross-Border Routes</label>
              <Select value={form.allow_cross_border} onValueChange={val => set('allow_cross_border', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Whether your fleet is set up to run loads that cross into neighbouring
                countries. When set to "No", any quote whose route actually crosses a
                border is refused rather than priced.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-action" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
          {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}
