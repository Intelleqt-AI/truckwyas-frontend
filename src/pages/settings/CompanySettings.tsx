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

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

export function CompanySettings() {
  const [form, setForm] = useState({
    company_name: '', registration_number: '', vat_number: '',
    industry: 'logistics', website: '', description: '',
    street: '', city: '', province: '', postal_code: '', country: 'South Africa',
    phone: '', email: '', support_email: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchData('/api/v1/company/profile/').then((d: any) => {
      if (d) setForm({
        company_name: d.company_name || '',
        registration_number: d.registration_number || '',
        vat_number: d.vat_number || '',
        industry: d.industry || 'logistics',
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
      });
    }).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
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
      } });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Company Details</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your business information and branding</div>
      </div>

      {/* Business Info */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>🏢 Business Information</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ ...grid2, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Company Name</label>
              <input style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <select style={selectStyle} value={form.industry} onChange={e => set('industry', e.target.value)}>
                <option value="logistics">Logistics</option>
                <option value="road_freight">Road Freight</option>
                <option value="courier">Courier</option>
                <option value="warehousing">Warehousing</option>
              </select>
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
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>📍 Business Address</span></div>
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
              <select style={selectStyle} value={form.province} onChange={e => set('province', e.target.value)}>
                <option value="">Select province</option>
                <option value="GP">Gauteng</option>
                <option value="WC">Western Cape</option>
                <option value="KZN">KwaZulu-Natal</option>
                <option value="EC">Eastern Cape</option>
                <option value="LP">Limpopo</option>
                <option value="MP">Mpumalanga</option>
                <option value="NW">North West</option>
                <option value="FS">Free State</option>
                <option value="NC">Northern Cape</option>
              </select>
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
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>📞 Contact Details</span></div>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-action" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
          {saved ? '✓ SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}
