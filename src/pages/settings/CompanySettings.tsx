import '@/pages/settings/settings-brand.css';
import { formatMoney, formatNumber } from '@/lib/formatters';
import { shortDate, longDate } from '@/lib/dieselPrice';
import { priceFieldError, priceFieldErrors, fieldChanged, ownPriceError, fuelChangeSummary } from '@/lib/settingsChecks';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { useState, useEffect, useRef } from "react";
import { fetchData, patchData, postData } from "@/lib/Api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { Loader } from '@/components/Loader';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import { useLocation } from 'react-router-dom';
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
function DecimalInput({ id, value, onChange, placeholder, decimals = 2, onBlur, error, describedBy }: {
  id: string; value: string; onChange: (raw: string) => void; placeholder?: string; decimals?: number;
  /** Inline validation: runs on blur; an error turns the border red. */
  onBlur?: () => void; error?: string | null; describedBy?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const n = parseFloat(value);
  const shown = text ?? (value === '' || Number.isNaN(n) ? value : formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return (
    <input
      id={id}
      className="settings-control"
      style={error ? { ...inputStyle, borderColor: 'var(--status-danger)' } : inputStyle}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      onFocus={() => setText(shown)}
      onChange={e => { setText(e.target.value); onChange(toRaw(e.target.value)); }}
      onBlur={() => { setText(null); onBlur?.(); }}
    />
  );
}

// Pricing fields (R5, F-3.3): checked on blur and on Save. Comma or dot as
// the decimal separator; anything else that isn't a plain number ("abc",
// "−5", "1e3") is invalid, never silently coerced.
type PricingField = 'margin_target_pct' | 'operating_cost_per_km' | 'driver_allowance_per_night';
const PRICING_ORDER: PricingField[] = ['margin_target_pct', 'operating_cost_per_km', 'driver_allowance_per_night'];
const PRICING_INPUT_ID: Record<PricingField, string> = {
  margin_target_pct: 'company-margin-target',
  operating_cost_per_km: 'company-operating-cost-per-km',
  driver_allowance_per_night: 'company-driver-allowance',
};
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
function pricingError(field: PricingField, raw: string): string | null {
  const t = toRaw(raw.trim());
  if (field === 'margin_target_pct') {
    // The server's own rule (above 0%, below 100%, 2 decimals). A figure
    // outside the range the analysis uses is allowed: it is noted, not
    // refused (marginRangeNote), so an existing value never blocks a save.
    const msg = 'Enter a margin above 0% and below 100%.';
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return msg;
    const n = Number(t);
    return n > 0 && n < 100 ? null : msg;
  }
  if (!t) return null;
  if (field === 'operating_cost_per_km') {
    const msg = 'Enter R 1 to R 200 per km, or leave it empty for automatic.';
    if (!PLAIN_NUMBER.test(t)) return msg;
    const n = Math.round(Number(t) * 100) / 100;
    return n >= 1 && n <= 200 ? null : msg;
  }
  const msg = 'Enter R 1 to R 5 000, or leave it empty.';
  if (!PLAIN_NUMBER.test(t)) return msg;
  const n = Math.round(Number(t));
  return n >= 1 && n <= 5000 ? null : msg;
}
/** A valid typed value, rounded as it will be saved: R/km to the cent, rand and % whole. */
function pricingNormalised(field: PricingField, raw: string): string {
  const t = toRaw(raw.trim());
  if (!t || !PLAIN_NUMBER.test(t)) return raw;
  return field === 'driver_allowance_per_night' ? String(Math.round(Number(t))) : String(Math.round(Number(t) * 100) / 100);
}

/** The target the pricing analysis actually uses, when the saved figure is outside its range. */
function marginRangeNote(raw: string, [lo, hi]: [number, number]): string | null {
  const t = toRaw(raw.trim());
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (n > hi) return `Pricing uses at most ${hi}%.`;
  if (n > 0 && n < lo) return `Pricing uses at least ${lo}%.`;
  return null;
}

/* A pricing field with its unit inside the box ("R" before, "%" or "/km"
   after). Shows the saved value in the ZA format ("16,94", "650"); while
   focused it holds exactly what was typed. */
function PricingInput({ id, value, onChange, onBlur, isValid, placeholder, decimals, inputMode, prefix, suffix, error, describedBy, ariaLabel }: {
  id: string; value: string; onChange: (raw: string) => void; onBlur: (raw: string) => void; placeholder?: string;
  /** An invalid entry stays exactly as typed (never reformatted into something it isn't). */
  isValid: (raw: string) => boolean;
  decimals: number; inputMode: 'numeric' | 'decimal'; prefix?: string; suffix?: string; error?: string | null; describedBy?: string;
  /** For a field without its own <label> (e.g. the own-price box under a mode switch). */
  ariaLabel?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const n = Number(value);
  const shown = text ?? (value === '' || !PLAIN_NUMBER.test(value) || error ? value : formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return (
    <div className={`cs-affix${prefix ? ' has-prefix' : ''}${suffix ? ' has-suffix' : ''}${error ? ' is-invalid' : ''}`}>
      {prefix && <span className="cs-affix__pre" aria-hidden="true">{prefix}</span>}
      <input
        id={id}
        className="settings-control"
        style={inputStyle}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        onFocus={() => setText(shown)}
        onChange={e => { setText(e.target.value); onChange(toRaw(e.target.value)); }}
        onBlur={e => { const raw = toRaw(e.target.value); if (isValid(raw)) setText(null); onBlur(raw); }}
      />
      {suffix && <span className="cs-affix__post" aria-hidden="true">{suffix}</span>}
    </div>
  );
}
const fieldErrorStyle: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: '16px', marginTop: 6, color: 'var(--status-danger-text)' };

/** The operating cost the cost floor uses now (company profile, read-only). */
interface CostInUse { value: number | null; source: string | null; trips: number | null; minTrips: number | null; window: string | null; label: string | null; superlink: number | null }
function costInUseOf(v: unknown): CostInUse | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
  const value = n(o.value);
  if (value === null) return null;
  const est = o.estimates && typeof o.estimates === 'object' ? (o.estimates as Record<string, unknown>) : {};
  // The figure a superlink is priced at: per_class (the company figure scaled
  // to the class) when the server sends it, else the class estimate.
  const perClass = o.per_class && typeof o.per_class === 'object' ? (o.per_class as Record<string, { value?: unknown }>) : {};
  const superlink = n(perClass.superlink?.value) ?? n(est.superlink);
  const fleet = n(o.company_value) ?? value;
  return { value: fleet, source: o.source ? String(o.source) : null, trips: n(o.trips), minTrips: n(o.min_trips), window: o.window ? String(o.window) : null, label: o.label ? String(o.label) : null, superlink };
}
// "Now using R 13,99/km from 37 trips (last 12 months)." / "Now using the
// R 12,50/km superlink estimate." The saved figure needs no line: it is in the field.
function costInUseText(c: CostInUse | null): string | null {
  if (!c || c.value === null || c.source === 'setting' || c.source === 'company_setting') return null;
  // "R 16,94/km fleet · R 18,00/km superlink": the figure in use, and what a
  // superlink is priced at (each quote uses its own truck's class).
  const fleet = `${formatMoney(c.value)}/km ${c.source === 'company_actuals' ? 'fleet' : 'estimate'}`;
  return c.superlink !== null && Math.abs(c.superlink - c.value) >= 0.005 ? `${fleet} · ${formatMoney(c.superlink)}/km superlink` : fleet;
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
    // §1: LIVE = the official zone price; OWN = fuel_price_own. Empty own => LIVE.
    fuel_price_mode: 'LIVE', fuel_price_own: '',
    // Petrol (petrol and hybrid trucks), same rule: LIVE = official ULP 95
    // (93 an inland option); OWN = fuel_price_petrol. Empty own => LIVE.
    fuel_price_petrol_mode: 'LIVE', fuel_price_petrol_grade: '95',
    fuel_price_petrol: '', fuel_price_electric: '', fuel_price_hybrid: '',
    bank_name: '', bank_account_holder: '', bank_account_number: '', bank_branch_code: '',
    bank_account_type: '', payment_reference_hint: '',
    // Pricing analysis (company profile, additive fields).
    operating_cost_per_km: '', pricing_include_empty_return: 'yes', pool_pricing_data: 'no',
    empty_return_min_km: '300', minimum_charge: '',
    margin_target_pct: '10', driver_allowance_per_night: '',
  });
  // Round 4 fields arrive from the API as they are added: a field the
  // profile does not return is not shown (and not saved).
  const [hasDriverField, setHasDriverField] = useState(false);
  // Quote rules fields (backend 7 Oct): shown only once the profile returns them.
  const [hasModeField, setHasModeField] = useState(false);
  const [hasReturnFields, setHasReturnFields] = useState(false);
  const [hasMinimumField, setHasMinimumField] = useState(false);
  const [ownSetAt, setOwnSetAt] = useState<string | null>(null);
  // "My own price" with nothing in it is not silently official: it is an error.
  const [ownError, setOwnError] = useState<string | null>(null);
  // Petrol Official / My own price: shown once the profile returns the mode.
  const [hasPetrolModeField, setHasPetrolModeField] = useState(false);
  const [hasPetrolGradeField, setHasPetrolGradeField] = useState(false);
  const [petrolOwnSetAt, setPetrolOwnSetAt] = useState<string | null>(null);
  const [petrolOwnError, setPetrolOwnError] = useState<string | null>(null);
  // Inline errors for the other fields (client checks and the server's 400s).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (k: string) => setFieldErrors(p => (p[k] ? { ...p, [k]: '' } : p));
  const [petrolInUse, setPetrolInUse] = useState<{ zone?: string; grade?: string; official?: { price?: unknown; effective_from?: string | null; source?: string | null; stale?: boolean } | null } | null>(null);
  const [hasTargetField, setHasTargetField] = useState(false);
  // The target margin as loaded: an untouched field is neither checked nor
  // sent on Save, so a stored figure never blocks (or is rounded by) a save.
  const [loadedTarget, setLoadedTarget] = useState<string | null>(null);
  const [costInUse, setCostInUse] = useState<CostInUse | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The form as loaded (and as last saved): what "changed" is measured against.
  const [loadedForm, setLoadedForm] = useState<Record<string, string> | null>(null);
  const [pricingErrors, setPricingErrors] = useState<Partial<Record<PricingField, string | null>>>({});
  // The analysis' own clamp for the target margin (K-9 margin_target_range), else 1–40.
  const [targetRange, setTargetRange] = useState<[number, number]>([1, 40]);
  const checkPricing = (field: PricingField, raw?: string) =>
    setPricingErrors(p => ({ ...p, [field]: pricingError(field, raw ?? (form as Record<string, string>)[field] ?? '') }));
  // On blur: validate, and a valid value is shown as it will be saved ("12,345" -> "12,35").
  const blurPricing = (field: PricingField, raw: string) => {
    const err = pricingError(field, raw);
    setPricingErrors(p => ({ ...p, [field]: err }));
    if (!err) setForm(p => ({ ...p, [field]: pricingNormalised(field, raw) }));
  };
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [livePrice, setLivePrice] = useState<any>(null);
  const [fetchingLivePrice, setFetchingLivePrice] = useState(false);

  /** The official price only: never written into any price field (§1: no
   *  on-load fill; "Check now" and a zone change never touch them). */
  const loadLivePrice = (force: boolean) => {
    setFetchingLivePrice(true);
    fetchData(`api/v1/fuel-prices/current/${force ? '?force=true' : ''}`).then((d: any) => {
      setLivePrice(d);
      if (force) {
        if (d?.success === false || d?.inland_price == null) toast.error("Couldn't reach the official price source");
        else toast.success('Official prices checked');
      }
    }).catch(() => { if (force) toast.error("Couldn't reach the official price source"); })
      .finally(() => setFetchingLivePrice(false));
  };

  useEffect(() => {
    fetchData('/api/v1/company/profile/').then((d: any) => {
      if (d) {
        const loadedValues = {
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
            Number(d.default_base_rate_per_km) > 0 ? String(d.default_base_rate_per_km) : '',
          default_toll_rate_per_km:
            d.default_toll_rate_per_km != null ? String(d.default_toll_rate_per_km) : '',
          default_sla_hours: d.default_sla_hours != null ? String(d.default_sla_hours) : '',
          cross_border_crossings_per_year:
            d.cross_border_crossings_per_year != null ? String(d.cross_border_crossings_per_year) : '',
          fuel_zone: d.fuel_zone === 'COASTAL' ? 'COASTAL' : 'INLAND',
          ...(() => {
            // New backend: mode + own. Older one: the §1 migration rule (23.50 /
            // empty = official; anything else = the fleet's own price).
            if (d.fuel_price_mode === 'LIVE' || d.fuel_price_mode === 'OWN') {
              return { fuel_price_mode: d.fuel_price_own != null ? d.fuel_price_mode : 'LIVE', fuel_price_own: d.fuel_price_own != null ? String(Number(d.fuel_price_own)) : '' };
            }
            const v = Number(d.fuel_price_per_litre);
            return v > 0 && Math.abs(v - 23.5) > 0.005 ? { fuel_price_mode: 'OWN', fuel_price_own: String(v) } : { fuel_price_mode: 'LIVE', fuel_price_own: '' };
          })(),
          fuel_price_petrol: d.fuel_price_petrol != null ? String(Number(d.fuel_price_petrol)) : '',
          fuel_price_petrol_mode: d.fuel_price_petrol_mode === 'OWN' && d.fuel_price_petrol != null ? 'OWN' : 'LIVE',
          fuel_price_petrol_grade: String(d.fuel_price_petrol_grade ?? '95') === '93' ? '93' : '95',
          fuel_price_electric: d.fuel_price_electric != null ? String(d.fuel_price_electric) : '',
          fuel_price_hybrid: d.fuel_price_hybrid != null ? String(d.fuel_price_hybrid) : '',
          bank_name: d.bank_name || '',
          bank_account_holder: d.bank_account_holder || '',
          bank_account_number: d.bank_account_number || '',
          bank_branch_code: d.bank_branch_code || '',
          bank_account_type: d.bank_account_type || '',
          payment_reference_hint: d.payment_reference_hint || '',
          operating_cost_per_km: d.operating_cost_per_km != null ? String(d.operating_cost_per_km) : '',
          pricing_include_empty_return: ('include_empty_return_default' in d ? d.include_empty_return_default !== false : d.pricing_include_empty_return === true) ? 'yes' : 'no',
          empty_return_min_km: d.empty_return_min_km != null ? String(Number(d.empty_return_min_km)) : '300',
          minimum_charge: d.minimum_charge != null ? String(Number(d.minimum_charge)) : '',
          pool_pricing_data: d.pool_pricing_data === true ? 'yes' : 'no',
          // "10.00" -> "10", "12.50" -> "12.5".
          margin_target_pct: d.margin_target_pct != null && d.margin_target_pct !== '' ? String(Number(d.margin_target_pct)) : '10',
          driver_allowance_per_night: d.driver_allowance_per_night != null ? String(d.driver_allowance_per_night) : '',
        };
        setForm(loadedValues);
        setLoadedForm({ ...(loadedValues as Record<string, string>) });
        // A stored value outside today's ranges is shown under its field (a hint, not blocking).
        { const { hint } = priceFieldErrors(['fuel_price_electric', ...('fuel_price_petrol_mode' in d ? [] : ['fuel_price_hybrid']), 'default_base_rate_per_km', 'default_toll_rate_per_km'],
            loadedValues as Record<string, string>, loadedValues as Record<string, string>);
          if (Object.keys(hint).length) setFieldErrors(hint); }
        setHasTargetField('margin_target_pct' in d);
        setLoadedTarget(d.margin_target_pct != null && d.margin_target_pct !== '' ? String(Number(d.margin_target_pct)) : '10');
        setHasDriverField('driver_allowance_per_night' in d);
        setHasModeField('fuel_price_mode' in d);
        setHasReturnFields('include_empty_return_default' in d);
        setHasMinimumField('minimum_charge' in d);
        setOwnSetAt(d.fuel_price_own_set_at ?? null);
        setHasPetrolModeField('fuel_price_petrol_mode' in d);
        setHasPetrolGradeField('fuel_price_petrol_grade' in d);
        setPetrolOwnSetAt(d.fuel_price_petrol_set_at ?? null);
        setPetrolInUse(d.petrol_price_in_use ?? null);
        setCostInUse(costInUseOf(d.operating_cost_in_use));
        const range = Array.isArray(d.margin_target_range) ? d.margin_target_range.map(Number) : null;
        if (range && range.length === 2 && range.every((x: number) => Number.isFinite(x)) && range[0] < range[1]) setTargetRange([range[0], range[1]]);
        // Only show a real uploaded logo, not the backend's default placeholder
        if (d.logo_url && !d.logo_url.endsWith('/brand/logo.svg')) setLogoUrl(d.logo_url);
      }
      setLoaded(true);
    }).catch(() => { toast.error('Failed to load company details'); })
      .finally(() => loadLivePrice(false));
  }, []);

  // /settings/company#pricing (the quote builder's "Set yours" link) lands on
  // the Pricing card once the form has its values (so the layout is final).
  useEffect(() => {
    if (!loaded || location.hash !== '#pricing') return;
    const el = document.getElementById('pricing');
    if (!el) return;
    const raf = requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(raf);
  }, [loaded, location.hash]);

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

  // §1 settings alert: what quotes will use after this save, confirmed first.
  const [fuelConfirm, setFuelConfirm] = useState<ReturnType<typeof fuelChangeSummary>>(null);
  const officialsNow = () => {
    const coastal = form.fuel_zone === 'COASTAL';
    const okSrc = (src: unknown) => !['FALLBACK', 'FALLBACK_LATEST'].includes(String(src || '').toUpperCase());
    const diesel = livePrice && livePrice.success !== false && okSrc(livePrice.source)
      ? Number(coastal ? livePrice.coastal_price : livePrice.inland_price) || null : null;
    const grade = !coastal && form.fuel_price_petrol_grade === '93' ? '93' : '95';
    const rec = livePrice?.petrol?.[`${coastal ? 'coastal' : 'inland'}_${grade}`]
      ?? (petrolInUse && petrolInUse.zone === form.fuel_zone && String(petrolInUse.grade) === grade ? petrolInUse.official : null);
    const petrol = rec && okSrc(rec.source) ? Number(rec.price) || null : null;
    return { diesel, petrol };
  };

  const handleSave = async (fuelConfirmed = false) => {
    // Own fuel prices: present and R 5 to R 100 per litre (the server's rule), inline.
    if (form.fuel_price_mode === 'OWN') {
      const err = ownPriceError(form.fuel_price_own);
      if (err) { setOwnError(err); document.getElementById('company-diesel-own')?.focus(); return; }
    }
    if (hasPetrolModeField && form.fuel_price_petrol_mode === 'OWN') {
      const err = ownPriceError(form.fuel_price_petrol);
      if (err) { setPetrolOwnError(err); document.getElementById('company-petrol-own')?.focus(); return; }
    }
    // Minimum charge: a number or empty, inline.
    if (hasMinimumField && priceFieldError('minimum_charge', form.minimum_charge)) {
      setFieldErrors(p => ({ ...p, minimum_charge: priceFieldError('minimum_charge', form.minimum_charge)! }));
      document.getElementById('company-minimum-charge')?.focus();
      return;
    }
    const minKm = form.empty_return_min_km === '' ? 300 : Number(form.empty_return_min_km);
    if (hasReturnFields && !(Number.isFinite(minKm) && minKm >= 0 && minKm <= 5000)) {
      setFieldErrors(p => ({ ...p, empty_return_min_km: 'Enter 0 to 5 000 km.' }));
      document.getElementById('company-empty-return-min-km')?.focus();
      return;
    }
    setFieldErrors({});
    // A change to the fuel price quotes use is confirmed before it is saved.
    const fuelChange = fuelChangeSummary(loadedForm, form, officialsNow(), hasPetrolModeField);
    if (fuelChange && !fuelConfirmed) { setFuelConfirm(fuelChange); return; }
    const validityDays = parseInt(form.default_quote_validity_days, 10);
    if (isNaN(validityDays) || validityDays < 1 || validityDays > 365) {
      toast.error('Default quote validity must be between 1 and 365 days');
      return;
    }
    // Other prices, inline under their fields (the server's ranges, lib/settingsChecks).
    {
      const keys = ['fuel_price_electric', ...(!hasPetrolModeField ? ['fuel_price_hybrid'] : []), 'default_base_rate_per_km', 'default_toll_rate_per_km'];
      // Only a changed value can block; a stored one is shown as a hint.
      const { block: errs, hint } = priceFieldErrors(keys, form as Record<string, string>, loadedForm);
      if (Object.keys(hint).length) setFieldErrors(p => ({ ...p, ...hint }));
      if (Object.keys(errs).length) {
        setFieldErrors(p => ({ ...p, ...errs }));
        const ids: Record<string, string> = { fuel_price_electric: 'company-electric-r-kwh', fuel_price_hybrid: 'company-hybrid-r-l',
          default_base_rate_per_km: 'company-default-base-rate-r-km', default_toll_rate_per_km: 'company-default-toll-rate-r-km' };
        document.getElementById(ids[Object.keys(errs)[0]])?.focus();
        return;
      }
    }
    // Pricing: target margin, operating cost and driver allowance, inline.
    const targetChanged = hasTargetField && form.margin_target_pct !== loadedTarget;
    const pricingFields = PRICING_ORDER.filter(f => (f !== 'margin_target_pct' || targetChanged) && (f !== 'driver_allowance_per_night' || hasDriverField));
    const errs = Object.fromEntries(pricingFields.map(f => [f, pricingError(f, (form as Record<string, string>)[f] ?? '')])) as Partial<Record<PricingField, string | null>>;
    setPricingErrors(errs);
    const firstInvalid = pricingFields.find(f => errs[f]);
    if (firstInvalid) {
      // The first invalid field takes focus (its message is right below it).
      document.getElementById(PRICING_INPUT_ID[firstInvalid])?.focus();
      return;
    }
    const opCost = form.operating_cost_per_km ? Math.round(parseFloat(form.operating_cost_per_km) * 100) / 100 : null;
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
      const saved = await patchData({ url: '/api/v1/company/profile/', data: {
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
        // Optional price (not a cost): empty = none (0).
        // These four are sent only when changed: a stored out-of-range value
        // never fails an unrelated save.
        ...(fieldChanged('default_base_rate_per_km', form as Record<string, string>, loadedForm)
          ? { default_base_rate_per_km: form.default_base_rate_per_km ? parseFloat(form.default_base_rate_per_km) : 0 } : {}),
        ...(fieldChanged('default_toll_rate_per_km', form as Record<string, string>, loadedForm)
          ? { default_toll_rate_per_km: form.default_toll_rate_per_km ? parseFloat(form.default_toll_rate_per_km) : 0.50 } : {}),
        default_sla_hours: slaHours ?? 48,
        cross_border_crossings_per_year: crossings ?? 24,
        fuel_zone: form.fuel_zone,
        // §1: own price empty => official. An older backend only has
        // fuel_price_per_litre (23.50 there means "use the live price").
        ...(() => {
          const own = form.fuel_price_mode === 'OWN' && form.fuel_price_own ? Math.round(parseFloat(form.fuel_price_own) * 10000) / 10000 : null;
          // Switching to Official keeps the stored own price (not sent), like petrol.
          return hasModeField
            ? (own != null ? { fuel_price_mode: 'OWN', fuel_price_own: own } : { fuel_price_mode: 'LIVE' })
            : { fuel_price_per_litre: own ?? 23.50 };
        })(),
        // Petrol, same rule as diesel: the mode with the own price. Switching
        // to Official keeps the stored own price (not sent). An older backend
        // only has the own petrol price. Never the official figure.
        ...(() => {
          const own = form.fuel_price_petrol ? Math.round(parseFloat(form.fuel_price_petrol) * 10000) / 10000 : null;
          if (!hasPetrolModeField) return { fuel_price_petrol: own };
          const grade = hasPetrolGradeField ? { fuel_price_petrol_grade: form.fuel_price_petrol_grade } : {};
          return form.fuel_price_petrol_mode === 'OWN' && own != null
            ? { fuel_price_petrol_mode: 'OWN', fuel_price_petrol: own, ...grade }
            : { fuel_price_petrol_mode: 'LIVE', ...grade };
        })(),
        ...(fieldChanged('fuel_price_electric', form as Record<string, string>, loadedForm)
          ? { fuel_price_electric: form.fuel_price_electric ? parseFloat(form.fuel_price_electric) : null } : {}),
        // Hybrid is hidden (and ignored for pricing) on a newer backend: never sent there.
        ...(!hasPetrolModeField && fieldChanged('fuel_price_hybrid', form as Record<string, string>, loadedForm)
          ? { fuel_price_hybrid: form.fuel_price_hybrid ? parseFloat(form.fuel_price_hybrid) : null } : {}),
        bank_name: form.bank_name.trim() || null,
        bank_account_holder: form.bank_account_holder.trim() || null,
        bank_account_number: accountDigits || null,
        bank_branch_code: branchDigits || null,
        bank_account_type: form.bank_account_type || null,
        payment_reference_hint: form.payment_reference_hint.trim() || null,
        operating_cost_per_km: opCost,
        // Only when changed, to the cent as typed (never rounded to a whole %).
        ...(targetChanged ? { margin_target_pct: Math.round(Number(toRaw(form.margin_target_pct)) * 100) / 100 } : {}),
        ...(hasDriverField ? { driver_allowance_per_night: form.driver_allowance_per_night ? Math.round(parseFloat(form.driver_allowance_per_night)) : null } : {}),
        pricing_include_empty_return: form.pricing_include_empty_return === 'yes',
        ...(hasReturnFields ? {
          include_empty_return_default: form.pricing_include_empty_return === 'yes',
          // 0 allowed: every one-way trip charges the empty return.
          empty_return_min_km: form.empty_return_min_km === '' ? 300 : Math.max(0, Math.round(parseFloat(form.empty_return_min_km))),
        } : {}),
        ...(hasMinimumField ? { minimum_charge: form.minimum_charge ? Math.round(parseFloat(form.minimum_charge) * 100) / 100 : null } : {}),
        pool_pricing_data: form.pool_pricing_data === 'yes',
      } });
      // The quote builder reads these defaults through the shared
      // ["company-profile"] query, which has a 5 minute staleTime — so without
      // this a saved diesel price, base rate or toll rate did not reach an
      // already-open quote until the page was reloaded.
      const savedSetAt = (saved as { fuel_price_own_set_at?: string | null } | null);
      if (savedSetAt && 'fuel_price_own_set_at' in savedSetAt) setOwnSetAt(savedSetAt.fuel_price_own_set_at ?? null);
      // The saved target is the new baseline, so it can be changed (and set back) again.
      if (hasTargetField) setLoadedTarget(form.margin_target_pct);
      setLoadedForm({ ...(form as Record<string, string>) });
      const savedPetrol = saved as { fuel_price_petrol_set_at?: string | null; petrol_price_in_use?: unknown } | null;
      if (savedPetrol && 'fuel_price_petrol_set_at' in savedPetrol) setPetrolOwnSetAt(savedPetrol.fuel_price_petrol_set_at ?? null);
      if (savedPetrol && 'petrol_price_in_use' in savedPetrol) setPetrolInUse((savedPetrol.petrol_price_in_use as typeof petrolInUse) ?? null);
      await queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-price-current'] });
      setSaved(true);
      toast.success(fuelChange ? fuelChange.toast : 'Company details saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      // A 400 with field errors ({field: [msg]}): each shows under its field.
      const data = (e as { data?: unknown } | null)?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const first = (v: unknown) => (Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : null);
        const errs = Object.fromEntries(Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, first(v)]).filter(([, v]) => v)) as Record<string, string>;
        if (errs.fuel_price_own) setOwnError(errs.fuel_price_own);
        if (errs.fuel_price_petrol) setPetrolOwnError(errs.fuel_price_petrol);
        const pricing = PRICING_ORDER.filter(f => errs[f]);
        if (pricing.length) setPricingErrors(p => ({ ...p, ...Object.fromEntries(pricing.map(f => [f, errs[f]])) }));
        setFieldErrors(errs);
        const firstId = errs.fuel_price_own ? 'company-diesel-own' : errs.fuel_price_petrol ? 'company-petrol-own'
          : pricing[0] ? PRICING_INPUT_ID[pricing[0]] : errs.minimum_charge ? 'company-minimum-charge' : errs.empty_return_min_km ? 'company-empty-return-min-km'
          : errs.fuel_price_electric ? 'company-electric-r-kwh' : errs.fuel_price_hybrid ? 'company-hybrid-r-l'
          : errs.default_base_rate_per_km ? 'company-default-base-rate-r-km' : errs.default_toll_rate_per_km ? 'company-default-toll-rate-r-km' : null;
        if (firstId) document.getElementById(firstId)?.focus();
      }
      toast.error((e as { message?: string } | null)?.message || 'Failed to save company details');
    }
    setSaving(false);
  };

  // The operating cost the floor uses while the field is empty, as the API words it.
  const costInUseLine = costInUseText(costInUse);
  const anyPricingError = Object.values(pricingErrors).some(Boolean);

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
                Default price per km (optional)
                <InfoTip label="About the default price per km">A price, not a cost: a new quote starts at this rate × km when that is more than your cost floor plus target margin. Costs are set under Pricing.</InfoTip>
              </label>
              <PricingInput id="company-default-base-rate-r-km" inputMode="decimal" decimals={2} prefix="R" suffix="/km" placeholder="Not set"
                value={form.default_base_rate_per_km} onChange={v => { set('default_base_rate_per_km', v); clearFieldError('default_base_rate_per_km'); }} onBlur={() => {}} isValid={() => true} error={fieldErrors.default_base_rate_per_km || null} describedBy="company-default-base-rate-help" />
              {fieldErrors.default_base_rate_per_km && <div id="company-default-base-rate-help" role="alert" style={fieldErrorStyle}>{fieldErrors.default_base_rate_per_km}</div>}
            </div>
            <div>
              <label htmlFor="company-default-toll-rate-r-km" style={labelStyle}>Toll rate (R/km)</label>
              <DecimalInput id="company-default-toll-rate-r-km" placeholder="e.g. 0,50" value={form.default_toll_rate_per_km} onChange={v => { set('default_toll_rate_per_km', v); clearFieldError('default_toll_rate_per_km'); }} />
              {fieldErrors.default_toll_rate_per_km && <div role="alert" style={fieldErrorStyle}>{fieldErrors.default_toll_rate_per_km}</div>}
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
      <div style={{ ...sectionStyle, scrollMarginTop: 16 }} id="pricing">
        <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Pricing</h2></div>
        <div style={bodyStyle}>
          {/* Two columns at desktop (R5, F-3.1): target | operating cost,
              driver allowance | empty return, then sharing across both. */}
          <div className="cs-grid cs-grid--2 cs-pricing-grid">
            {hasTargetField && (
              <div>
                <label htmlFor="company-margin-target" style={labelTipStyle}>
                  Target margin (%)
                  <InfoTip label="About the target margin">Price less the cost floor, as a share of the price. Suggested prices never go below it.</InfoTip>
                </label>
                <PricingInput id="company-margin-target" inputMode="decimal" decimals={/\.\d/.test(form.margin_target_pct) ? 2 : 0} suffix="%" value={form.margin_target_pct}
                  onChange={v => { set('margin_target_pct', v); if (pricingErrors.margin_target_pct) checkPricing('margin_target_pct', v); }}
                  onBlur={raw => blurPricing('margin_target_pct', raw)} isValid={raw => !pricingError('margin_target_pct', raw)} error={pricingErrors.margin_target_pct} describedBy="company-margin-target-help" />
                <div id="company-margin-target-help">
                  {pricingErrors.margin_target_pct
                    ? <div role="alert" style={fieldErrorStyle}>{pricingErrors.margin_target_pct}</div>
                    // Our short copy; their range note only when pricing caps the figure.
                    : marginRangeNote(form.margin_target_pct, targetRange) ? <div style={helpTextStyle}>{marginRangeNote(form.margin_target_pct, targetRange)}</div> : null}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="company-operating-cost-per-km" style={labelTipStyle}>
                Operating cost per km
                <InfoTip label="About the operating cost per km">Wages, finance, insurance, licences, tyres, maintenance and overheads. Empty: your last 12 months, else a typical figure per truck class.</InfoTip>
              </label>
              <PricingInput id="company-operating-cost-per-km" inputMode="decimal" decimals={2} prefix="R" suffix="/km" placeholder="Automatic"
                value={form.operating_cost_per_km}
                onChange={v => { set('operating_cost_per_km', v); if (pricingErrors.operating_cost_per_km) checkPricing('operating_cost_per_km', v); }}
                onBlur={raw => blurPricing('operating_cost_per_km', raw)} isValid={raw => !pricingError('operating_cost_per_km', raw)} error={pricingErrors.operating_cost_per_km} describedBy="company-operating-cost-help" />
              <div id="company-operating-cost-help">
                {pricingErrors.operating_cost_per_km
                  ? <div role="alert" style={fieldErrorStyle}>{pricingErrors.operating_cost_per_km}</div>
                  : !form.operating_cost_per_km && costInUseLine ? <div style={helpTextStyle}>{costInUseLine}</div> : null}
              </div>
            </div>
            {hasDriverField && (
              <div>
                <label htmlFor="company-driver-allowance" style={labelTipStyle}>
                  Driver allowance per night (R)
                  <InfoTip label="About the driver allowance">Paid per night away. Each quote can change it.</InfoTip>
                </label>
                <PricingInput id="company-driver-allowance" inputMode="numeric" decimals={0} prefix="R" placeholder="Not set" value={form.driver_allowance_per_night}
                  onChange={v => { set('driver_allowance_per_night', v); if (pricingErrors.driver_allowance_per_night) checkPricing('driver_allowance_per_night', v); }}
                  onBlur={raw => blurPricing('driver_allowance_per_night', raw)} isValid={raw => !pricingError('driver_allowance_per_night', raw)} error={pricingErrors.driver_allowance_per_night} describedBy="company-driver-allowance-help" />
                <div id="company-driver-allowance-help">
                  {pricingErrors.driver_allowance_per_night
                    ? <div role="alert" style={fieldErrorStyle}>{pricingErrors.driver_allowance_per_night}</div>
                    : null}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="company-include-empty-return" style={labelTipStyle}>
                Empty return
                <InfoTip label="About the empty return">One-way quotes from this distance price the run home empty, unless a return load is booked.</InfoTip>
              </label>
              <Select value={form.pricing_include_empty_return} onValueChange={val => set('pricing_include_empty_return', val)}>
                <SelectTrigger style={inputStyle} className="cs-select" id="company-include-empty-return">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Include</SelectItem>
                  <SelectItem value="no">Leave out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasReturnFields && (
              <div>
                <label htmlFor="company-empty-return-min-km" style={labelStyle}>Charge empty return on trips over (km)</label>
                <input id="company-empty-return-min-km" className="settings-control" style={inputStyle} type="number" min={0} max={5000}
                  value={form.empty_return_min_km} onChange={e => set('empty_return_min_km', e.target.value)}
                  aria-invalid={fieldErrors.empty_return_min_km ? true : undefined} aria-describedby="company-empty-return-min-km-err" />
                {fieldErrors.empty_return_min_km && <div id="company-empty-return-min-km-err" role="alert" style={fieldErrorStyle}>{fieldErrors.empty_return_min_km}</div>}
              </div>
            )}
            {hasMinimumField && (
              <div>
                <label htmlFor="company-minimum-charge" style={labelStyle}>Minimum charge</label>
                <PricingInput id="company-minimum-charge" inputMode="decimal" decimals={2} prefix="R" placeholder="Not set"
                  value={form.minimum_charge} onChange={v => { set('minimum_charge', v); if (fieldErrors.minimum_charge) setFieldErrors(p => ({ ...p, minimum_charge: '' })); }}
                  onBlur={() => {}} isValid={raw => !raw || PLAIN_NUMBER.test(raw)} error={fieldErrors.minimum_charge || null} describedBy="company-minimum-charge-err" />
                {fieldErrors.minimum_charge && <div id="company-minimum-charge-err" role="alert" style={fieldErrorStyle}>{fieldErrors.minimum_charge}</div>}
              </div>
            )}
            <div className="cs-pricing-grid__wide">
              <label htmlFor="company-pool-pricing-data" style={labelTipStyle}>
                Share anonymised win/loss data
                <InfoTip label="About sharing win/loss data">Won or lost, price, lane, truck and timing; never customer names or documents. Helps chance to win where you have few quotes.</InfoTip>
              </label>
              <div className="cs-pricing-grid__half">
                <Select value={form.pool_pricing_data} onValueChange={val => set('pool_pricing_data', val)}>
                  <SelectTrigger style={inputStyle} className="cs-select" id="company-pool-pricing-data">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes, anonymised</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fuel (QUOTE-RULES.md §1): the official zone price by default, or the
          fleet's own. Nothing here ever copies the official price into "own". */}
      <div style={{ ...sectionStyle, scrollMarginTop: 16 }} id="fuel">
        <div style={{ ...sectionHeaderStyle, justifyContent: 'space-between' }}>
          <h2 style={sectionTitleStyle}>Fuel</h2>
          <button
            type="button"
            onClick={() => loadLivePrice(true)}
            disabled={fetchingLivePrice}
            className="settings-control"
            style={{ ...settingsSecondaryButtonStyle, cursor: fetchingLivePrice ? 'wait' : 'pointer' }}
          >
            {fetchingLivePrice
              ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 96 }}><Loader size={12} color="currentColor" /></span>
              : 'Check now'}
          </button>
        </div>
        <div style={bodyStyle}>
          {(() => {
            const zoneWord = form.fuel_zone === 'COASTAL' ? 'coastal' : 'inland';
            const ok = livePrice && livePrice.success !== false && !['FALLBACK', 'FALLBACK_LATEST'].includes(String(livePrice.source || '').toUpperCase());
            const official = ok ? Number(form.fuel_zone === 'COASTAL' ? livePrice.coastal_price : livePrice.inland_price) || null : null;
            const from = ok ? shortDate(livePrice.effective_from ?? livePrice.last_updated ?? null) : null;
            const stale = !!livePrice && (livePrice.stale === true || livePrice.is_stale === true);
            const own = form.fuel_price_mode === 'OWN';
            return (
              <div className="cs-grid cs-grid--2">
                <div>
                  <label htmlFor="company-fuel-pricing-zone" style={labelTipStyle}>
                    Zone
                    <InfoTip label="About fuel zones">Diesel costs more inland than at the coast.</InfoTip>
                  </label>
                  <Select value={form.fuel_zone} onValueChange={val => set('fuel_zone', val)}>
                    <SelectTrigger style={inputStyle} className="cs-select" id="company-fuel-pricing-zone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INLAND">Inland</SelectItem>
                      <SelectItem value="COASTAL">Coastal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span id="company-diesel-mode-label" style={labelStyle}>Diesel price</span>
                  <div className="tw-seg tw-seg--block" role="radiogroup" aria-labelledby="company-diesel-mode-label" style={{ marginTop: 6 }}>
                    {(['LIVE', 'OWN'] as const).map(m => (
                      <button key={m} type="button" role="radio" aria-checked={form.fuel_price_mode === m}
                        className={`tw-seg__opt${form.fuel_price_mode === m ? ' is-active' : ''}`}
                        onClick={() => { set('fuel_price_mode', m); setOwnError(null); }}>{m === 'LIVE' ? 'Official' : 'My own price'}</button>
                    ))}
                  </div>
                  {own ? (
                    <div style={{ marginTop: 8 }}>
                      <PricingInput id="company-diesel-own" ariaLabel="Your diesel price per litre, excl. VAT" inputMode="decimal" decimals={2} prefix="R" suffix="/L" placeholder="excl. VAT"
                        value={form.fuel_price_own} onChange={v => { set('fuel_price_own', v); if (ownError && parseFloat(v) > 0) setOwnError(null); }}
                        onBlur={() => {}} isValid={() => true} error={ownError} describedBy="company-diesel-own-help" />
                      <div id="company-diesel-own-help">
                        {ownError
                          ? <div role="alert" style={fieldErrorStyle}>{ownError}</div>
                          : <div style={helpTextStyle}>
                              {ownSetAt && form.fuel_price_own ? `Set on ${longDate(ownSetAt)}` : ''}
                              {official != null ? `${ownSetAt && form.fuel_price_own ? ' · ' : ''}Official is ${formatMoney(official)}/L.` : ''}
                            </div>}
                      </div>
                    </div>
                  ) : (
                    <div className="cs-live" style={{ color: stale || official == null ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}
                      title={livePrice?.stale_warning || undefined}>
                      {official != null
                        ? <>{formatMoney(official)}/L · {zoneWord}{from ? ` · from ${from}` : ''}{stale ? ' · may be out of date' : ''}</>
                        : livePrice ? 'No official price right now' : 'Loading…'}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {(() => {
            // Petrol (petrol and hybrid trucks): Official or My own price, as
            // diesel. The official figure is only shown, never written to own.
            const coastal = form.fuel_zone === 'COASTAL';
            const zoneWord = coastal ? 'coastal' : 'inland';
            const grade = !coastal && form.fuel_price_petrol_grade === '93' ? '93' : '95';
            const rec = livePrice?.petrol?.[`${zoneWord}_${grade}`]
              ?? (petrolInUse && petrolInUse.zone === form.fuel_zone && String(petrolInUse.grade) === grade ? petrolInUse.official : null);
            const ok = rec && !['FALLBACK', 'FALLBACK_LATEST'].includes(String(rec.source || '').toUpperCase());
            const official = ok ? Number(rec.price) || null : null;
            const from = official != null ? shortDate(rec.effective_from ?? null) : null;
            const stale = official != null && rec?.stale === true;
            const own = form.fuel_price_petrol_mode === 'OWN';
            const electric = (
              <div>
                <label htmlFor="company-electric-r-kwh" style={labelStyle}>Electricity</label>
                <PricingInput id="company-electric-r-kwh" inputMode="decimal" decimals={2} prefix="R" suffix="/kWh" placeholder="Not set" value={form.fuel_price_electric} onChange={v => { set('fuel_price_electric', v); clearFieldError('fuel_price_electric'); }} onBlur={() => {}} isValid={() => true} error={fieldErrors.fuel_price_electric || null} describedBy="company-electric-help" />
                <div id="company-electric-help">{fieldErrors.fuel_price_electric
                  ? <div role="alert" style={fieldErrorStyle}>{fieldErrors.fuel_price_electric}</div>
                  : <div style={helpTextStyle}>Your electricity cost per kWh, for electric trucks. There is no official price.</div>}</div>
              </div>
            );
            if (!hasPetrolModeField) {
              // Older backend: petrol and hybrid are the fleet's own prices only.
              return (<>
                <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
                  <div>
                    <label htmlFor="company-petrol-r-l" style={labelStyle}>Petrol</label>
                    <PricingInput id="company-petrol-r-l" inputMode="decimal" decimals={2} prefix="R" suffix="/L" placeholder="Not set" value={form.fuel_price_petrol} onChange={v => set('fuel_price_petrol', v)} onBlur={() => {}} isValid={() => true} error={null} />
                  </div>
                  {electric}
                </div>
                <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
                  <div>
                    <label htmlFor="company-hybrid-r-l" style={labelStyle}>Hybrid</label>
                    <PricingInput id="company-hybrid-r-l" inputMode="decimal" decimals={2} prefix="R" suffix="/L" placeholder="Not set" value={form.fuel_price_hybrid} onChange={v => { set('fuel_price_hybrid', v); clearFieldError('fuel_price_hybrid'); }} onBlur={() => {}} isValid={() => true} error={fieldErrors.fuel_price_hybrid || null} describedBy="company-hybrid-err" />
                    {fieldErrors.fuel_price_hybrid && <div id="company-hybrid-err" role="alert" style={fieldErrorStyle}>{fieldErrors.fuel_price_hybrid}</div>}
                  </div>
                </div>
              </>);
            }
            return (
              <div className="cs-grid cs-grid--2" style={{ marginTop: 16 }}>
                <div>
                  <span id="company-petrol-mode-label" style={labelStyle}>Petrol price</span>
                  <div className="tw-seg tw-seg--block" role="radiogroup" aria-labelledby="company-petrol-mode-label" style={{ marginTop: 6 }}>
                    {(['LIVE', 'OWN'] as const).map(m => (
                      <button key={m} type="button" role="radio" aria-checked={form.fuel_price_petrol_mode === m}
                        className={`tw-seg__opt${form.fuel_price_petrol_mode === m ? ' is-active' : ''}`}
                        onClick={() => { set('fuel_price_petrol_mode', m); setPetrolOwnError(null); }}>{m === 'LIVE' ? 'Official' : 'My own price'}</button>
                    ))}
                  </div>
                  {own ? (
                    <div style={{ marginTop: 8 }}>
                      <PricingInput id="company-petrol-own" ariaLabel="Your petrol price per litre, excl. VAT" inputMode="decimal" decimals={2} prefix="R" suffix="/L" placeholder="excl. VAT"
                        value={form.fuel_price_petrol} onChange={v => { set('fuel_price_petrol', v); if (petrolOwnError && parseFloat(v) > 0) setPetrolOwnError(null); }}
                        onBlur={() => {}} isValid={() => true} error={petrolOwnError} describedBy="company-petrol-own-help" />
                      <div id="company-petrol-own-help">
                        {petrolOwnError
                          ? <div role="alert" style={fieldErrorStyle}>{petrolOwnError}</div>
                          : <div style={helpTextStyle}>
                              {petrolOwnSetAt && form.fuel_price_petrol ? `Set on ${longDate(petrolOwnSetAt)}` : ''}
                              {official != null ? `${petrolOwnSetAt && form.fuel_price_petrol ? ' · ' : ''}Official ULP ${grade} is ${formatMoney(official)}/L.` : ''}
                            </div>}
                      </div>
                    </div>
                  ) : (<>
                    <div className="cs-live" style={{ color: stale || official == null ? 'var(--status-warning-text)' : 'var(--text-secondary)' }}>
                      {official != null
                        ? <>{formatMoney(official)}/L · ULP {grade} {zoneWord}{from ? ` · from ${from}` : ''}{stale ? ' · may be out of date' : ''}</>
                        : livePrice ? `No official ULP ${grade} price right now` : 'Loading…'}
                    </div>
                    {!coastal && hasPetrolGradeField && (
                      <div className="tw-seg" role="radiogroup" aria-label="Petrol grade" style={{ marginTop: 8 }}>
                        {(['95', '93'] as const).map(g => (
                          <button key={g} type="button" role="radio" aria-checked={grade === g}
                            className={`tw-seg__opt${grade === g ? ' is-active' : ''}`}
                            onClick={() => set('fuel_price_petrol_grade', g)}>ULP {g}</button>
                        ))}
                      </div>
                    )}
                  </>)}
                  <div style={helpTextStyle}>Petrol and hybrid trucks use this price.{coastal ? ' Coastal is priced on ULP 95.' : ''}</div>
                </div>
                {electric}
              </div>
            );
          })()}
        </div>
      </div>

      {fuelConfirm && (
        <ConfirmModal title={fuelConfirm.title} message={fuelConfirm.message} confirmLabel={fuelConfirm.confirmLabel}
          onCancel={() => setFuelConfirm(null)}
          onConfirm={() => { setFuelConfirm(null); handleSave(true); }} />
      )}
      {/* Sticky save bar: Save is in view on every part of this long form. */}
      <div className="cs-savebar">
        <span className="cs-savebar__note">{saved ? 'Saved. New quotes use these settings.' : 'Changes apply to new quotes and invoices.'}</span>
        <button
          className="btn-action settings-control"
          onClick={() => handleSave()}
          disabled={saving || isDemo}
          // Invalid pricing field: Save reads as disabled, and a click puts
          // focus on the first invalid field instead of saving.
          aria-disabled={anyPricingError || undefined}
          title={isDemo ? 'Fixed in demo mode' : anyPricingError ? 'Fix the highlighted field first' : undefined}
          style={{ opacity: isDemo || anyPricingError ? 0.5 : saving ? 0.6 : 1, cursor: isDemo || anyPricingError ? 'not-allowed' : undefined }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
