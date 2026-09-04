import { useState, useEffect, useRef } from "react";
import { fetchData, patchData, postData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

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
  const { user: authUser } = useAuth();
  // Shared public demo account — every control that persists a change (logo
  // upload, save) is fixed off; viewing/editing fields in memory stays live.
  const isDemo = !!authUser?.is_demo;
  const [form, setForm] = useState({
    company_name: '', registration_number: '', vat_number: '',
    industry: '', website: '', description: '',
    street: '', city: '', province: '', postal_code: '', country: 'South Africa',
    phone: '', email: '', support_email: '',
    default_quote_validity_days: '7',
    allow_cross_border: 'yes',
    fuel_price_per_litre: '', fuel_price_petrol: '', fuel_price_electric: '', fuel_price_hybrid: '',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [livePrice, setLivePrice] = useState<any>(null);
  const [fetchingLivePrice, setFetchingLivePrice] = useState(false);

  const loadLivePrice = (force: boolean) => {
    setFetchingLivePrice(true);
    fetchData(`api/v1/fuel-prices/current/${force ? '?force=true' : ''}`).then((d: any) => {
      setLivePrice(d);
      setForm(prev => {
        const next = { ...prev };
        // A manual "Fetch Now" always applies the fresh value. On initial
        // load, only nudge a field when it still looks untouched — Diesel
        // has a real factory default (23.50) to compare against; Petrol has
        // no forced default, so "untouched" just means blank. Never silently
        // overwrite a price a company deliberately set.
        if (d?.inland_price != null) {
          const current = parseFloat(prev.fuel_price_per_litre);
          const dieselUntouched = !prev.fuel_price_per_litre || Math.abs(current - 23.5) < 0.001;
          if (force || dieselUntouched) next.fuel_price_per_litre = String(d.inland_price);
        }
        if (d?.petrol_95) {
          if (force || !prev.fuel_price_petrol) next.fuel_price_petrol = String(d.petrol_95);
        }
        return next;
      });
      if (force) {
        if (d?.success === false) toast.error(d?.error || 'Could not fetch live fuel prices');
        else if (d?.inland_price == null) toast.error(d?.stale_warning || "Couldn't reach a live fuel-price source");
        else toast.success('Fuel prices refreshed');
      }
    }).catch(() => { if (force) toast.error('Could not fetch live fuel prices'); })
      .finally(() => setFetchingLivePrice(false));
  };

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
          fuel_price_per_litre: d.fuel_price_per_litre != null ? String(d.fuel_price_per_litre) : '',
          fuel_price_petrol: d.fuel_price_petrol != null ? String(d.fuel_price_petrol) : '',
          fuel_price_electric: d.fuel_price_electric != null ? String(d.fuel_price_electric) : '',
          fuel_price_hybrid: d.fuel_price_hybrid != null ? String(d.fuel_price_hybrid) : '',
        });
        // Only show a real uploaded logo, not the backend's default placeholder
        if (d.logo_url && !d.logo_url.endsWith('/brand/logo.svg')) setLogoUrl(d.logo_url);
      }
    }).catch(() => { toast.error('Failed to load company details'); })
      // Chained, not parallel: the live-price nudge below reads the current
      // Diesel field to decide whether it looks untouched, so it must run
      // after the real saved value has actually landed in form state.
      .finally(() => loadLivePrice(false));
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
    for (const [key, label] of [
      ['fuel_price_per_litre', 'Diesel'], ['fuel_price_petrol', 'Petrol'],
      ['fuel_price_electric', 'Electric'], ['fuel_price_hybrid', 'Hybrid'],
    ] as const) {
      const raw = (form as any)[key];
      if (raw && (isNaN(parseFloat(raw)) || parseFloat(raw) < 0)) {
        toast.error(`${label} fuel price must be a positive number`);
        return;
      }
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
        fuel_price_per_litre: form.fuel_price_per_litre ? parseFloat(form.fuel_price_per_litre) : 23.50,
        fuel_price_petrol: form.fuel_price_petrol ? parseFloat(form.fuel_price_petrol) : null,
        fuel_price_electric: form.fuel_price_electric ? parseFloat(form.fuel_price_electric) : null,
        fuel_price_hybrid: form.fuel_price_hybrid ? parseFloat(form.fuel_price_hybrid) : null,
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
              disabled={isDemo}
              style={{ display: 'none' }}
            />
            <button
              className="btn-action"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo || isDemo}
              title={isDemo ? 'Fixed in demo mode' : undefined}
              style={{ opacity: isDemo ? 0.5 : uploadingLogo ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : undefined }}
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

      {/* Fuel Price Defaults */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Fuel Price Defaults</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Used as the default price when a vehicle type of that fuel type doesn't have
            its own fuel price set (Settings &gt; Vehicle Types). Diesel already falls back
            to the live national price if left blank; the other three have no such feed,
            so they stay unset until you add one.
          </div>
          <div style={grid2}>
            <div>
              <label style={labelStyle}>Diesel (R/L)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 23.50"
                  value={form.fuel_price_per_litre}
                  onChange={e => set('fuel_price_per_litre', e.target.value)}
                />
                <button
                  onClick={() => loadLivePrice(true)}
                  disabled={fetchingLivePrice}
                  style={{
                    flexShrink: 0, background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', padding: '0 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                    cursor: fetchingLivePrice ? 'wait' : 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  {fetchingLivePrice ? '...' : 'FETCH NOW'}
                </button>
              </div>
              {livePrice?.success !== false && (livePrice?.inland_price != null || livePrice?.stale_warning) && (
                <div style={{ fontSize: 11, color: livePrice.is_stale ? 'var(--status-warning)' : 'var(--text-tertiary)', marginTop: 6 }}>
                  {livePrice.inland_price != null ? (
                    <>
                      Live national price: R{Number(livePrice.inland_price).toFixed(2)}/L
                      {livePrice.last_updated && ` · for ${new Date(livePrice.last_updated).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`}
                      {livePrice.last_checked_at && ` · checked ${new Date(livePrice.last_checked_at).toLocaleString('en-ZA')}`}
                      {livePrice.stale_warning && ` · ${livePrice.stale_warning}`}
                    </>
                  ) : (
                    <>
                      {livePrice.stale_warning}
                      {livePrice.last_checked_at && ` (checked ${new Date(livePrice.last_checked_at).toLocaleString('en-ZA')})`}
                    </>
                  )}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Petrol (R/L)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Not set"
                  value={form.fuel_price_petrol}
                  onChange={e => set('fuel_price_petrol', e.target.value)}
                />
                <button
                  onClick={() => loadLivePrice(true)}
                  disabled={fetchingLivePrice}
                  style={{
                    flexShrink: 0, background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', padding: '0 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                    cursor: fetchingLivePrice ? 'wait' : 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  {fetchingLivePrice ? '...' : 'FETCH NOW'}
                </button>
              </div>
              {livePrice?.success !== false && (livePrice?.petrol_95 != null || livePrice?.stale_warning) && (
                <div style={{ fontSize: 11, color: livePrice.is_stale ? 'var(--status-warning)' : 'var(--text-tertiary)', marginTop: 6 }}>
                  {livePrice.petrol_95 != null ? (
                    <>
                      Live national price (95 unleaded): R{Number(livePrice.petrol_95).toFixed(2)}/L
                      {livePrice.last_updated && ` · for ${new Date(livePrice.last_updated).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`}
                      {livePrice.last_checked_at && ` · checked ${new Date(livePrice.last_checked_at).toLocaleString('en-ZA')}`}
                    </>
                  ) : (
                    <>
                      {livePrice.stale_warning}
                      {livePrice.last_checked_at && ` (checked ${new Date(livePrice.last_checked_at).toLocaleString('en-ZA')})`}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ ...grid2, marginTop: 16 }}>
            <div>
              <label style={labelStyle}>Electric (R/kWh)</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={0.01}
                placeholder="Not set"
                value={form.fuel_price_electric}
                onChange={e => set('fuel_price_electric', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Hybrid (R/L)</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={0.01}
                placeholder="Not set"
                value={form.fuel_price_hybrid}
                onChange={e => set('fuel_price_hybrid', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-action"
          onClick={handleSave}
          disabled={saving || isDemo}
          title={isDemo ? 'Fixed in demo mode' : undefined}
          style={{ opacity: isDemo ? 0.5 : saving ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : undefined }}
        >
          {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}
