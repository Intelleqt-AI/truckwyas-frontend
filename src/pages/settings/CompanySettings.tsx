import '@/pages/settings/settings-brand.css';
import { formatDateTime, formatMoney, formatMonth, formatNumber } from '@/lib/formatters';
import { InfoTip } from '@/components/ui/InfoTip';
import { useState, useEffect, useRef } from "react";
import { fetchData, patchData, postData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { Loader } from '@/components/Loader';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import { settingsCardStyle, settingsCardHeaderStyle, settingsCardTitleStyle, settingsLabelStyle, settingsInputStyle, settingsHelpStyle, settingsSecondaryButtonStyle, SettingsPageHeader } from './settingsUi';

const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const resolveLogoUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${apiBase}/${url.replace(/^\//, '')}`;
};

const sectionStyle = settingsCardStyle;
const sectionHeaderStyle = settingsCardHeaderStyle;
const sectionTitleStyle = settingsCardTitleStyle;
const labelStyle = settingsLabelStyle;
const inputStyle = settingsInputStyle;
const helpTextStyle = settingsHelpStyle;

const bodyStyle: React.CSSProperties = { padding: 'var(--card-pad, 20px)' };
// A label with a tip: on touch screens it keeps 14px above the control, so
// the tip's 44px target never sits under the select (R7, settings-brand.css).
const labelTipStyle: React.CSSProperties = { ...settingsLabelStyle, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--cs-tip-gap, 6px)' };

/* A decimal field in the ZA format ("10,00", "29,11"). The form keeps the
   API's own value (dot decimal, full precision) so an untouched field saves
   exactly what was loaded; only while typing does the field hold the text
   the user typed, accepted with a comma or a dot. */
const toRaw = (text: string) => text.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
function DecimalInput({ id, value, onChange, placeholder, decimals = 2 }: {
  id: string; value: string; onChange: (raw: string) => void; placeholder?: string; decimals?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const n = parseFloat(value);
  const shown = text ?? (value === '' || Number.isNaN(n) ? value : formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return (
    <input
      id={id}
      className="settings-control"
      style={inputStyle}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      onFocus={() => setText(shown)}
      onChange={e => { setText(e.target.value); onChange(toRaw(e.target.value)); }}
      onBlur={() => setText(null)}
    />
  );
}

export function CompanySettings() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
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
    auto_email_invoices: 'no',
    default_base_rate_per_km: '', default_toll_rate_per_km: '', default_sla_hours: '',
    cross_border_crossings_per_year: '',
    fuel_zone: 'INLAND',
    fuel_price_per_litre: '', fuel_price_petrol: '', fuel_price_electric: '', fuel_price_hybrid: '',
    bank_name: '', bank_account_holder: '', bank_account_number: '', bank_branch_code: '',
    bank_account_type: '', payment_reference_hint: '',
    // Pricing analysis (company profile, additive fields).
    operating_cost_per_km: '', pricing_include_empty_return: 'no', pool_pricing_data: 'no',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [livePrice, setLivePrice] = useState<any>(null);
  const [fetchingLivePrice, setFetchingLivePrice] = useState(false);

  /** `zoneOverride` is passed when the zone selector triggers this, so the
   *  fetch uses the zone just chosen rather than whatever is still in state.
   *  `dieselOnly` keeps a zone switch off the petrol field — petrol has no
   *  coastal/inland split, so a zone change has no business rewriting it. */
  const loadLivePrice = (force: boolean, zoneOverride?: string, dieselOnly = false) => {
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
        // Diesel is gazetted per zone: it lands at the coastal ports and the
        // DMRE adds a transport differential to move it inland, so Gauteng runs
        // roughly R0.87/L above Cape Town or Durban. Take the figure for this
        // fleet's zone — reading `inland_price` unconditionally over-charged
        // every coastal fleet by that gap on every quote.
        const zone = zoneOverride ?? prev.fuel_zone;
        const zonePrice = zone === 'COASTAL'
          ? (d?.coastal_price ?? d?.inland_price)
          : d?.inland_price;
        if (zonePrice != null) {
          const current = parseFloat(prev.fuel_price_per_litre);
          const dieselUntouched = !prev.fuel_price_per_litre || Math.abs(current - 23.5) < 0.001;
          if (force || dieselUntouched) next.fuel_price_per_litre = String(zonePrice);
        }
        if (d?.petrol_95 && !dieselOnly) {
          if (force || !prev.fuel_price_petrol) next.fuel_price_petrol = String(d.petrol_95);
        }
        return next;
      });
      if (force) {
        const zone = zoneOverride ?? form.fuel_zone;
        const zoneLabel = zone === 'COASTAL' ? 'coastal' : 'inland';
        if (d?.success === false) toast.error(d?.error || 'Could not fetch live fuel prices');
        else if (d?.inland_price == null) toast.error(d?.stale_warning || "Couldn't reach a live fuel-price source");
        else if (dieselOnly) toast.success(`Diesel updated to the ${zoneLabel} price`);
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
          auto_email_invoices: d.auto_email_invoices === true ? 'yes' : 'no',
          default_base_rate_per_km:
            d.default_base_rate_per_km != null ? String(d.default_base_rate_per_km) : '',
          default_toll_rate_per_km:
            d.default_toll_rate_per_km != null ? String(d.default_toll_rate_per_km) : '',
          default_sla_hours: d.default_sla_hours != null ? String(d.default_sla_hours) : '',
          cross_border_crossings_per_year:
            d.cross_border_crossings_per_year != null ? String(d.cross_border_crossings_per_year) : '',
          fuel_zone: d.fuel_zone === 'COASTAL' ? 'COASTAL' : 'INLAND',
          fuel_price_per_litre: d.fuel_price_per_litre != null ? String(d.fuel_price_per_litre) : '',
          fuel_price_petrol: d.fuel_price_petrol != null ? String(d.fuel_price_petrol) : '',
          fuel_price_electric: d.fuel_price_electric != null ? String(d.fuel_price_electric) : '',
          fuel_price_hybrid: d.fuel_price_hybrid != null ? String(d.fuel_price_hybrid) : '',
          bank_name: d.bank_name || '',
          bank_account_holder: d.bank_account_holder || '',
          bank_account_number: d.bank_account_number || '',
          bank_branch_code: d.bank_branch_code || '',
          bank_account_type: d.bank_account_type || '',
          payment_reference_hint: d.payment_reference_hint || '',
          operating_cost_per_km: d.operating_cost_per_km != null ? String(d.operating_cost_per_km) : '',
          pricing_include_empty_return: d.pricing_include_empty_return === true ? 'yes' : 'no',
          pool_pricing_data: d.pool_pricing_data === true ? 'yes' : 'no',
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
    for (const [key, label] of [
      ['default_base_rate_per_km', 'Base rate'], ['default_toll_rate_per_km', 'Toll rate'],
    ] as const) {
      const raw = (form as any)[key];
      if (raw && (isNaN(parseFloat(raw)) || parseFloat(raw) < 0)) {
        toast.error(`${label} must be a positive number`);
        return;
      }
    }
    // Operating cost: optional; when set, a plausible R/km (the API's own range).
    const opCost = form.operating_cost_per_km ? parseFloat(form.operating_cost_per_km) : null;
    if (opCost !== null && (isNaN(opCost) || opCost < 1 || opCost > 200)) {
      toast.error('Operating cost must be between R1 and R200 per km, or left blank');
      return;
    }
    // Blank is allowed (falls back to the model default on save); a value that
    // is present must be a sane whole number of hours.
    const slaHours = form.default_sla_hours ? parseInt(form.default_sla_hours, 10) : null;
    if (slaHours !== null && (isNaN(slaHours) || slaHours < 1 || slaHours > 720)) {
      toast.error('Default SLA must be between 1 and 720 hours');
      return;
    }
    const crossings = form.cross_border_crossings_per_year
      ? parseInt(form.cross_border_crossings_per_year, 10) : null;
    if (crossings !== null && (isNaN(crossings) || crossings < 1 || crossings > 5000)) {
      toast.error('Border crossings per year must be between 1 and 5000');
      return;
    }
    // Banking details: spaces/hyphens are fine (the server strips them), but
    // what's left must be digits. Blank clears the field.
    const accountDigits = form.bank_account_number.replace(/[\s-]/g, '');
    if (accountDigits && !/^\d{6,20}$/.test(accountDigits)) {
      toast.error('Account number must be 6–20 digits');
      return;
    }
    const branchDigits = form.bank_branch_code.replace(/[\s-]/g, '');
    if (branchDigits && !/^\d{4,10}$/.test(branchDigits)) {
      toast.error('Branch code must be 4–10 digits');
      return;
    }
    if (!!form.bank_name.trim() !== !!accountDigits) {
      toast.error('Enter both a bank name and an account number, or leave both blank');
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
        auto_email_invoices: form.auto_email_invoices === 'yes',
        default_base_rate_per_km: form.default_base_rate_per_km
          ? parseFloat(form.default_base_rate_per_km) : 10.00,
        default_toll_rate_per_km: form.default_toll_rate_per_km
          ? parseFloat(form.default_toll_rate_per_km) : 0.50,
        default_sla_hours: slaHours ?? 48,
        cross_border_crossings_per_year: crossings ?? 24,
        fuel_zone: form.fuel_zone,
        fuel_price_per_litre: form.fuel_price_per_litre ? parseFloat(form.fuel_price_per_litre) : 23.50,
        fuel_price_petrol: form.fuel_price_petrol ? parseFloat(form.fuel_price_petrol) : null,
        fuel_price_electric: form.fuel_price_electric ? parseFloat(form.fuel_price_electric) : null,
        fuel_price_hybrid: form.fuel_price_hybrid ? parseFloat(form.fuel_price_hybrid) : null,
        bank_name: form.bank_name.trim() || null,
        bank_account_holder: form.bank_account_holder.trim() || null,
        bank_account_number: accountDigits || null,
        bank_branch_code: branchDigits || null,
        bank_account_type: form.bank_account_type || null,
        payment_reference_hint: form.payment_reference_hint.trim() || null,
        operating_cost_per_km: opCost,
        pricing_include_empty_return: form.pricing_include_empty_return === 'yes',
        pool_pricing_data: form.pool_pricing_data === 'yes',
      } });
      // The quote builder reads these defaults through the shared
      // ["company-profile"] query, which has a 5 minute staleTime — so without
      // this a saved diesel price, base rate or toll rate did not reach an
      // already-open quote until the page was reloaded.
      await queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      setSaved(true);
      toast.success('Company details saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save company details');
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 'var(--form-max, 720px)' }}>
      <SettingsPageHeader title="Company details" description="Your business information and branding" />

      {/* Business info, with the logo as its first row (R8: no one-line card). */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Business information</h2></div>
        <div style={bodyStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 72, height: 72, flexShrink: 0,
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-nested)',
              background: 'var(--input-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {logoUrl ? (
                <img src={resolveLogoUrl(logoUrl)} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>No logo</span>
              )}
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>Logo</div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                Shown on the quotes and invoices you send.<br />PNG, JPG, GIF or WebP, up to 2 MB
              </div>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleLogoSelect}
                disabled={isDemo}
                style={{ display: 'none' }}
              />
              <button
                className="settings-control"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo || isDemo}
                title={isDemo ? 'Fixed in demo mode' : undefined}
                style={{ ...settingsSecondaryButtonStyle, opacity: isDemo ? 0.5 : uploadingLogo ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : 'pointer' }}
              >
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
            </div>
          </div>
          <div className="cs-grid cs-grid--2" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-company-name" style={labelStyle}>Company name</label>
              <input id="company-company-name" className="settings-control" style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="company-industry" style={labelStyle}>Industry</label>
              <Select value={form.industry} onValueChange={val => set('industry', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-industry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_freight">General freight</SelectItem>
                  <SelectItem value="refrigerated">Refrigerated transport</SelectItem>
                  <SelectItem value="hazmat">Hazmat / dangerous goods</SelectItem>
                  <SelectItem value="construction">Construction materials</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="cs-grid cs-grid--2" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-registration-number" style={labelStyle}>Registration number</label>
              <input id="company-registration-number" className="settings-control" style={inputStyle} value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="YYYY/XXXXXX/XX" />
            </div>
            <div>
              <label htmlFor="company-vat-number" style={labelStyle}>VAT number</label>
              <input id="company-vat-number" className="settings-control" style={inputStyle} value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="4XXXXXXXXX" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="company-website" style={labelStyle}>Website</label>
            <input id="company-website" className="settings-control" style={inputStyle} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label htmlFor="company-description" style={labelStyle}>Description</label>
            <textarea id="company-description"
              className="settings-control"
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' as const }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Business address</h2></div>
        <div style={bodyStyle}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="company-street-address" style={labelStyle}>Street address</label>
            <input id="company-street-address" className="settings-control" style={inputStyle} value={form.street} onChange={e => set('street', e.target.value)} />
          </div>
          <div className="cs-grid cs-grid--3" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-city" style={labelStyle}>City</label>
              <input id="company-city" className="settings-control" style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label htmlFor="company-province" style={labelStyle}>Province</label>
              <Select value={form.province} onValueChange={val => set('province', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-province">
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
              <label htmlFor="company-postal-code" style={labelStyle}>Postal code</label>
              <input id="company-postal-code" className="settings-control" style={inputStyle} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Contact details</h2></div>
        <div style={bodyStyle}>
          <div className="cs-grid cs-grid--3">
            <div>
              <label htmlFor="company-phone" style={labelStyle}>Phone</label>
              <input id="company-phone" className="settings-control" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label htmlFor="company-business-email" style={labelStyle}>Business email</label>
              <input id="company-business-email" className="settings-control" style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label htmlFor="company-support-email" style={labelStyle}>Support email</label>
              <input id="company-support-email" className="settings-control" style={inputStyle} type="email" value={form.support_email} onChange={e => set('support_email', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Banking details */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Banking details</h2>
          <InfoTip label="Where banking details appear">Shown in a "How to pay" section on the invoices you send (PDF, invoice email and online invoice) once a bank name and account number are filled in. Until then, invoices ask customers to contact you for banking details.</InfoTip>
        </div>
        <div style={bodyStyle}>
          <div className="cs-grid cs-grid--2" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-bank-name" style={labelStyle}>Bank name</label>
              <input id="company-bank-name" className="settings-control" style={inputStyle} value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. FNB" maxLength={100} />
            </div>
            <div>
              <label htmlFor="company-bank-holder" style={labelStyle}>Account holder</label>
              <input id="company-bank-holder" className="settings-control" style={inputStyle} value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder={form.company_name || 'Registered account name'} maxLength={200} />
              <div style={helpTextStyle}>Blank uses your company name.</div>
            </div>
          </div>
          <div className="cs-grid cs-grid--3" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-bank-account" style={labelStyle}>Account number</label>
              <input id="company-bank-account" className="settings-control" style={inputStyle} inputMode="numeric" autoComplete="off" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Digits only" maxLength={30} />
              <div style={helpTextStyle}>6–20 digits.</div>
            </div>
            <div>
              <label htmlFor="company-bank-branch" style={labelStyle}>Branch code</label>
              <input id="company-bank-branch" className="settings-control" style={inputStyle} inputMode="numeric" autoComplete="off" value={form.bank_branch_code} onChange={e => set('bank_branch_code', e.target.value)} placeholder="e.g. 250655" maxLength={14} />
              <div style={helpTextStyle}>Universal code, 4–10 digits.</div>
            </div>
            <div>
              <label style={labelStyle} id="company-bank-type">Account type</label>
              <Select value={form.bank_account_type || 'none'} onValueChange={val => set('bank_account_type', val === 'none' ? '' : val)}>
                <SelectTrigger style={inputStyle} className="cs-select" aria-labelledby="company-bank-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="CHEQUE">Cheque / current</SelectItem>
                  <SelectItem value="SAVINGS">Savings</SelectItem>
                  <SelectItem value="TRANSMISSION">Transmission</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="company-bank-ref" style={labelStyle}>Payment reference wording (optional)</label>
            <input id="company-bank-ref" className="settings-control" style={inputStyle} value={form.payment_reference_hint} onChange={e => set('payment_reference_hint', e.target.value)} placeholder="Please use the invoice number as your payment reference." maxLength={200} />
            <div style={helpTextStyle}>Replaces the default wording on invoices.</div>
          </div>
        </div>
      </div>

      {/* Invoicing */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Invoicing</h2></div>
        <div style={bodyStyle}>
          <div className="cs-grid cs-grid--2">
            <div>
              <label htmlFor="company-auto-email-invoices" style={labelTipStyle}>
                Email invoices on delivery
                <InfoTip label="About emailing invoices on delivery">An invoice is raised automatically when a load is delivered. With No, it waits as a draft for you to check and send. With Yes, it is emailed to the customer straight away and marked sent. A customer with no email address always gets a draft.</InfoTip>
              </label>
              <Select value={form.auto_email_invoices} onValueChange={val => set('auto_email_invoices', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-auto-email-invoices">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No, keep as a draft</SelectItem>
                  <SelectItem value="yes">Yes, email the customer</SelectItem>
                </SelectContent>
              </Select>
              <div style={helpTextStyle}>Choose No to check each invoice first.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Defaults */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Quote defaults</h2></div>
        <div style={bodyStyle}>
          <div className="cs-grid cs-grid--2">
            <div>
              <label htmlFor="company-default-quote-validity-days" style={labelStyle}>Quote valid for (days)</label>
              <input id="company-default-quote-validity-days"
                className="settings-control"
                style={inputStyle}
                type="number"
                min={1}
                max={365}
                value={form.default_quote_validity_days}
                onChange={e => set('default_quote_validity_days', e.target.value)}
              />
              <div style={helpTextStyle}>Each quote can change it.</div>
            </div>
            <div>
              <label htmlFor="company-cross-border-routes" style={labelTipStyle}>
                Cross-border routes
                <InfoTip label="About cross-border routes">Whether your fleet is set up to run loads into neighbouring countries. When set to No, any quote whose route actually crosses a border is refused rather than priced.</InfoTip>
              </label>
              <Select value={form.allow_cross_border} onValueChange={val => set('allow_cross_border', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-cross-border-routes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <div style={helpTextStyle}>Choose No to refuse quotes that cross a border.</div>
            </div>
          </div>

          <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="company-default-base-rate-r-km" style={labelTipStyle}>
                Base rate (R/km)
                <InfoTip label="About the base rate">Used when the vehicle type on a quote has no rate of its own (Settings, Vehicle types). A type's own rate always wins.</InfoTip>
              </label>
              <DecimalInput id="company-default-base-rate-r-km" placeholder="e.g. 33,00" value={form.default_base_rate_per_km} onChange={v => set('default_base_rate_per_km', v)} />
              <div style={helpTextStyle}>When a vehicle type has no rate.</div>
            </div>
            <div>
              <label htmlFor="company-default-toll-rate-r-km" style={labelStyle}>Toll rate (R/km)</label>
              <DecimalInput id="company-default-toll-rate-r-km" placeholder="e.g. 0,50" value={form.default_toll_rate_per_km} onChange={v => set('default_toll_rate_per_km', v)} />
              <div style={helpTextStyle}>Only when tolls can't be itemised.</div>
            </div>
          </div>

          <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="company-default-sla-hours" style={labelStyle}>Delivery promise (hours)</label>
              <input id="company-default-sla-hours"
                className="settings-control"
                style={inputStyle}
                type="number"
                min={1}
                max={720}
                placeholder="e.g. 48"
                value={form.default_sla_hours}
                onChange={e => set('default_sla_hours', e.target.value)}
              />
              <div style={helpTextStyle}>Each quote can change it.</div>
            </div>
            <div>
              <label htmlFor="company-border-crossings-per-year" style={labelTipStyle}>
                Border crossings per year
                <InfoTip label="About border crossings">Count each leg separately: a return trip is two. A C-BRTA permit is bought for a year, so a quote charges its share of one crossing: the more you cross, the less each load carries.</InfoTip>
              </label>
              <input id="company-border-crossings-per-year"
                className="settings-control"
                style={inputStyle}
                type="number"
                min={1}
                max={5000}
                placeholder="e.g. 24"
                value={form.cross_border_crossings_per_year}
                onChange={e => set('cross_border_crossings_per_year', e.target.value)}
              />
              <div style={helpTextStyle}>Spreads the permit cost over loads.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing: what the quote builder's cost floor and chance to win use. */}
      <div style={sectionStyle} id="pricing">
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Pricing</h2></div>
        <div style={bodyStyle}>
          <div className="cs-grid cs-grid--2">
            <div>
              <label htmlFor="company-operating-cost-per-km" style={labelTipStyle}>
                Operating cost per km (excl. fuel & tolls)
                <InfoTip label="About the operating cost per km">Driver wages, vehicle finance, insurance, licences, tyres, maintenance and overheads, per km. It goes into every quote's cost floor. Leave it blank and we use your costs from the last 12 months, or a typical figure for the vehicle type until you have enough costed trips.</InfoTip>
              </label>
              <DecimalInput id="company-operating-cost-per-km" placeholder="e.g. 12,50" value={form.operating_cost_per_km} onChange={v => set('operating_cost_per_km', v)} />
              <div style={helpTextStyle}>Optional, R1 to R200. Blank uses your last 12 months of costs or an estimate.</div>
            </div>
            <div>
              <label htmlFor="company-include-empty-return" style={labelTipStyle}>
                Empty return in the cost floor
                <InfoTip label="About the empty return">For one-way quotes: whether the cost floor includes driving home empty. Each quote can still switch it.</InfoTip>
              </label>
              <Select value={form.pricing_include_empty_return} onValueChange={val => set('pricing_include_empty_return', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-include-empty-return">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No, one way only</SelectItem>
                  <SelectItem value="yes">Yes, include it by default</SelectItem>
                </SelectContent>
              </Select>
              <div style={helpTextStyle}>Include the empty return in the cost floor by default.</div>
            </div>
          </div>
          <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="company-pool-pricing-data" style={labelTipStyle}>
                Share anonymised win/loss data
                <InfoTip label="About sharing win/loss data">With Yes, whether your quotes were won or lost (price, lane, truck type and timing; never customer names, contacts or documents) helps train a shared pricing model, and you can use that model's chance to win while you have too few closed quotes of your own. With No, your outcomes only ever train your own model. You can switch it off at any time.</InfoTip>
              </label>
              <Select value={form.pool_pricing_data} onValueChange={val => set('pool_pricing_data', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-pool-pricing-data">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No, keep it to us</SelectItem>
                  <SelectItem value="yes">Yes, share to improve pricing</SelectItem>
                </SelectContent>
              </Select>
              <div style={helpTextStyle}>Off by default. Improves pricing for everyone.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fuel Price Defaults */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHeaderStyle, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <h2 style={sectionTitleStyle}>Fuel prices</h2>
            <InfoTip label="About fuel prices">Used when a vehicle type has no fuel price of its own (Settings, Vehicle types). Diesel falls back to the live national price if left blank; the other three have no live feed, so they stay unset until you add one.</InfoTip>
          </span>
          <button
            type="button"
            onClick={() => loadLivePrice(true)}
            disabled={fetchingLivePrice}
            className="settings-control"
            style={{ ...settingsSecondaryButtonStyle, cursor: fetchingLivePrice ? 'wait' : 'pointer' }}
          >
            {fetchingLivePrice
              ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 112 }}><Loader size={12} color="currentColor" /></span>
              : 'Fetch live prices'}
          </button>
        </div>
        <div style={bodyStyle}>
          <div style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="company-fuel-pricing-zone" style={labelTipStyle}>
                Fuel pricing zone
                <InfoTip label="About fuel zones">Diesel is gazetted at two prices: it lands at the coastal ports and costs more inland once the transport differential is added, about {formatMoney(0.87)}/L at the moment. Changing the zone fetches its current price and updates Diesel below.</InfoTip>
              </label>
              <Select
                value={form.fuel_zone}
                onValueChange={val => { set('fuel_zone', val); loadLivePrice(true, val, true); }}
                disabled={fetchingLivePrice}
              >
                <SelectTrigger style={inputStyle} className="cs-select" id="company-fuel-pricing-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INLAND">Inland: Gauteng and the interior</SelectItem>
                  <SelectItem value="COASTAL">Coastal: Cape Town, Durban, Gqeberha, East London</SelectItem>
                </SelectContent>
              </Select>
              <div style={helpTextStyle}>Changing it updates Diesel below.</div>
            </div>
          </div>
          <div className="cs-grid cs-grid--2">
            <div>
              <label htmlFor="company-diesel-r-l" style={labelStyle}>Diesel (R/L)</label>
              <DecimalInput id="company-diesel-r-l" placeholder="e.g. 23,50" value={form.fuel_price_per_litre} onChange={v => set('fuel_price_per_litre', v)} />
              {livePrice?.success !== false && (livePrice?.inland_price != null || livePrice?.stale_warning) && (
                <div className="cs-live" style={{ color: livePrice.is_stale ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}
                  title={[livePrice.last_updated && `For ${new Date(livePrice.last_updated).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`, livePrice.last_checked_at && `checked ${formatDateTime(livePrice.last_checked_at)}`, livePrice.stale_warning].filter(Boolean).join(' · ')}>
                  {livePrice.inland_price != null ? (
                    <>
                      Live: {formatMoney(Number(livePrice.inland_price))}/L
                      {livePrice.last_updated && `, ${formatMonth(livePrice.last_updated)}`}
                      {livePrice.stale_warning && ', may be out of date'}
                    </>
                  ) : (
                    <>
                      {livePrice.stale_warning}
                      {livePrice.last_checked_at && ` (checked ${formatDateTime(livePrice.last_checked_at)})`}
                    </>
                  )}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="company-petrol-r-l" style={labelStyle}>Petrol (R/L)</label>
              <DecimalInput id="company-petrol-r-l" placeholder="Not set" value={form.fuel_price_petrol} onChange={v => set('fuel_price_petrol', v)} />
              {livePrice?.success !== false && (livePrice?.petrol_95 != null || livePrice?.stale_warning) && (
                <div className="cs-live" style={{ color: livePrice.is_stale ? 'var(--status-warning-text)' : 'var(--text-tertiary)' }}
                  title={[livePrice.last_updated && `For ${new Date(livePrice.last_updated).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`, livePrice.last_checked_at && `checked ${formatDateTime(livePrice.last_checked_at)}`].filter(Boolean).join(' · ')}>
                  {livePrice.petrol_95 != null ? (
                    <>
                      Live (95 unleaded): {formatMoney(Number(livePrice.petrol_95))}/L
                    </>
                  ) : (
                    <>
                      {livePrice.stale_warning}
                      {livePrice.last_checked_at && ` (checked ${formatDateTime(livePrice.last_checked_at)})`}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="company-electric-r-kwh" style={labelStyle}>Electric (R/kWh)</label>
              <DecimalInput id="company-electric-r-kwh" placeholder="Not set" value={form.fuel_price_electric} onChange={v => set('fuel_price_electric', v)} />
            </div>
            <div>
              <label htmlFor="company-hybrid-r-l" style={labelStyle}>Hybrid (R/L)</label>
              <DecimalInput id="company-hybrid-r-l" placeholder="Not set" value={form.fuel_price_hybrid} onChange={v => set('fuel_price_hybrid', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar: Save is in view on every part of this long form. */}
      <div className="cs-savebar">
        <span className="cs-savebar__note">{saved ? 'Saved. New quotes use these settings.' : 'Changes apply to new quotes and invoices.'}</span>
        <button
          className="btn-action settings-control"
          onClick={handleSave}
          disabled={saving || isDemo}
          title={isDemo ? 'Fixed in demo mode' : undefined}
          style={{ opacity: isDemo ? 0.5 : saving ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : undefined }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
