import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchData } from '@/lib/Api';
import { formatRelativeTime } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, accountingApi, apiFieldErrors, apiMessage, invalidateAccounting, missingMappingLabel, providerConfig,
  type Connection, type Mapping, type MappingSection, type MappingUpdate, type ProviderAccount, type ProviderTaxRate, type TrackingMapping,
} from '@/lib/accounting';
import { AcctCard, ErrorBlock, LoadingBlock, useAccountingPermissions } from './shared';

const NONE = '__none';

type SectionDraft = Partial<Record<string, string | null>>;
interface Draft {
  revenue_types: SectionDraft;
  expense_categories: SectionDraft;
  tax_sales: SectionDraft;
  tax_purchases: SectionDraft;
  receipts_account?: string | null;
  tracking?: TrackingMapping;
}
const EMPTY_DRAFT: Draft = { revenue_types: {}, expense_categories: {}, tax_sales: {}, tax_purchases: {} };

const num = (s: string | null | undefined) => {
  const n = parseFloat(String(s ?? ''));
  return isNaN(n) ? null : n;
};
const pct = (s: string | null | undefined) => {
  const n = num(s);
  return n == null ? '' : `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
};
const accountLabel = (a: ProviderAccount) => (a.code ? `${a.code} · ${a.name}` : a.name);
const taxLabel = (t: ProviderTaxRate) => `${t.name} (${pct(t.rate)})`;

/**
 * Accounts and VAT: where each kind of TruckWys line lands in the provider.
 * Suggestions are shown as a one-click hint and never saved on their own.
 */
export function MappingTab({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const q = useQuery<Mapping>({ queryKey: ACCT_KEYS.mapping, queryFn: () => fetchData(ACCT_URL.mapping), retry: 1 });
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const m = q.data;

  // ---- effective values (draft over saved)
  const sectionValue = (section: MappingSection, key: string): string | null => {
    const d = draft[section];
    if (key in d) return d[key] ?? null;
    const rows = m?.[section] ?? [];
    const row = rows.find(r => r.key === key);
    if (!row) return null;
    return 'account_code' in row ? row.account_code : row.tax_code;
  };
  const receipts = draft.receipts_account !== undefined ? draft.receipts_account : (m?.receipts_account ?? null);
  const tracking: TrackingMapping = draft.tracking ?? m?.tracking ?? { vehicle_category_id: null, branch_category_id: null, branch_option: '' };

  // ---- what changed, as a PUT body
  const changes = useMemo<MappingUpdate>(() => {
    if (!m) return {};
    const out: MappingUpdate = {};
    (['revenue_types', 'expense_categories', 'tax_sales', 'tax_purchases'] as const).forEach(section => {
      const changed: Record<string, string | null> = {};
      for (const [key, val] of Object.entries(draft[section])) {
        const row = (m[section] as Array<{ key: string; account_code?: string | null; tax_code?: string | null }>).find(r => r.key === key);
        const saved = row ? (row.account_code ?? row.tax_code ?? null) : null;
        if ((val ?? null) !== saved) changed[key] = val ?? null;
      }
      if (Object.keys(changed).length) out[section] = changed;
    });
    if (draft.receipts_account !== undefined && draft.receipts_account !== m.receipts_account) out.receipts_account = draft.receipts_account;
    if (draft.tracking && JSON.stringify(draft.tracking) !== JSON.stringify(m.tracking)) out.tracking = draft.tracking;
    return out;
  }, [draft, m]);
  const changeCount = Object.values(changes).reduce<number>((n, v) => n + (v && typeof v === 'object' && !('vehicle_category_id' in v) ? Object.keys(v).length : 1), 0);
  const dirty = changeCount > 0;

  const setSection = (section: MappingSection, key: string, value: string | null) => {
    setDraft(d => ({ ...d, [section]: { ...d[section], [key]: value } }));
    setErrors(e => { const n = { ...e }; delete n[`${section}.${key}`]; return n; });
  };

  // ---- suggestions not yet in the draft
  const pendingSuggestions = useMemo(() => {
    const list: { section: MappingSection; key: string; value: string }[] = [];
    if (!m) return list;
    (['revenue_types', 'expense_categories', 'tax_sales', 'tax_purchases'] as const).forEach(section => {
      for (const [key, value] of Object.entries(m.suggestions?.[section] ?? {})) {
        if (value && sectionValue(section, key) !== value) list.push({ section, key, value });
      }
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, draft]);

  const applyAllSuggestions = () => {
    setDraft(d => {
      const next: Draft = { ...d, revenue_types: { ...d.revenue_types }, expense_categories: { ...d.expense_categories }, tax_sales: { ...d.tax_sales }, tax_purchases: { ...d.tax_purchases } };
      for (const s of pendingSuggestions) next[s.section][s.key] = s.value;
      return next;
    });
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true); setErrors({}); setFormError('');
    try {
      const saved = await accountingApi.saveMapping(changes);
      qc.setQueryData(ACCT_KEYS.mapping, saved);
      setDraft(EMPTY_DRAFT);
      invalidateAccounting(qc);
      toast.success(saved.complete ? 'Mapping saved. Everything is mapped.' : `Mapping saved. ${saved.missing.length} still to map.`);
    } catch (e) {
      const fieldErrors = apiFieldErrors(e);
      setErrors(fieldErrors);
      setFormError(Object.keys(fieldErrors).length
        ? 'Some choices need another look. See the messages below each field.'
        : apiMessage(e, "Couldn't save the mapping. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await accountingApi.refreshOptions();
      qc.setQueryData(ACCT_KEYS.mapping, fresh);
      toast.success(`Accounts, VAT rates and tracking read again from ${cfg.short}`);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't read from ${cfg.short}. Try again.`));
    } finally {
      setRefreshing(false);
    }
  };

  if (q.isLoading) return <AcctCard title="Accounts and VAT"><LoadingBlock label="Loading mapping" /></AcctCard>;
  if (q.isError || !m) {
    return <AcctCard title="Accounts and VAT"><ErrorBlock message={apiMessage(q.error, "Couldn't load the mapping.")} onRetry={() => q.refetch()} /></AcctCard>;
  }

  const accounts = m.options.accounts ?? [];
  const taxRates = m.options.tax_rates ?? [];
  const cats = m.options.tracking_categories ?? [];
  const disabled = !canWrite || saving;
  const branchCat = cats.find(c => c.id === tracking.branch_category_id);

  const suggestionHint = (section: MappingSection, key: string, describe: (v: string) => string) => {
    const s = m.suggestions?.[section]?.[key];
    if (!s || sectionValue(section, key) === s) return null;
    return (
      <div className="acct-hint">
        <span>Suggested: {describe(s)}</span>
        {canWrite && <button type="button" className="acct-linkbtn" onClick={() => setSection(section, key, s)}>Use suggestion</button>}
      </div>
    );
  };
  const describeAccount = (code: string) => { const a = accounts.find(x => x.code === code); return a ? accountLabel(a) : code; };
  const describeTax = (code: string) => { const t = taxRates.find(x => x.code === code); return t ? taxLabel(t) : code; };

  return (
    <>
      <AcctCard
        title="Accounts and VAT"
        description={<>
          Tell TruckWys where each kind of charge and cost goes in {cfg.short}. Nothing is sent until every line is mapped.
          {m.options.fetched_at && <> Read from {cfg.short} {formatRelativeTime(m.options.fetched_at)}.</>}
        </>}
        actions={<>
          {canWrite && pendingSuggestions.length > 1 && (
            <button type="button" className="tw-btn" onClick={applyAllSuggestions}>Use all {pendingSuggestions.length} suggestions</button>
          )}
          <button type="button" className="tw-btn" onClick={refresh} disabled={!canWrite || refreshing} title={writeTitle}>
            <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? 'Reading…' : `Refresh from ${cfg.short}`}
          </button>
        </>}
      >
        {m.complete && !dirty ? (
          <p className="acct-section-desc" style={{ margin: 0, color: 'var(--status-success-text)' }}>Everything is mapped.</p>
        ) : (
          <p className="acct-section-desc" style={{ margin: 0 }}>
            {m.missing.length > 0 ? `Still to map: ${m.missing.map(missingMappingLabel).join(', ')}.` : 'Review your changes, then save.'}
          </p>
        )}
        {!canWrite && <p className="acct-section-desc" style={{ margin: '8px 0 0' }}>{writeTitle}. You can look, but not change anything.</p>}
      </AcctCard>

      <AcctCard title="Income accounts" description="Which income account each kind of charge on your invoices goes to." flush>
        {m.revenue_types.map(row => {
          const field = `revenue_types.${row.key}`;
          return (
            <div className="acct-map-row" key={row.key}>
              <label className="acct-map-row__label" id={`lbl-${field}`}>{row.label}</label>
              <div className="acct-map-row__field">
                <AccountSelect labelledBy={`lbl-${field}`} accounts={accounts} prefer={a => a.class === 'REVENUE'} preferLabel="Income accounts"
                  value={sectionValue('revenue_types', row.key)} onChange={v => setSection('revenue_types', row.key, v)} disabled={disabled} invalid={!!errors[field]} />
                {suggestionHint('revenue_types', row.key, describeAccount)}
                {errors[field] && <div className="acct-error" role="alert">{errors[field]}</div>}
              </div>
            </div>
          );
        })}
      </AcctCard>

      <AcctCard title="Expense accounts" description="Where supplier bills go, by expense category." flush>
        {m.expense_categories.map(row => {
          const field = `expense_categories.${row.key}`;
          return (
            <div className="acct-map-row" key={row.key}>
              <label className="acct-map-row__label" id={`lbl-${field}`}>{row.label}</label>
              <div className="acct-map-row__field">
                <AccountSelect labelledBy={`lbl-${field}`} accounts={accounts} prefer={a => a.class === 'EXPENSE'} preferLabel="Expense accounts"
                  value={sectionValue('expense_categories', row.key)} onChange={v => setSection('expense_categories', row.key, v)} disabled={disabled} invalid={!!errors[field]} />
                {suggestionHint('expense_categories', row.key, describeAccount)}
                {errors[field] && <div className="acct-error" role="alert">{errors[field]}</div>}
              </div>
            </div>
          );
        })}
      </AcctCard>

      {(['tax_sales', 'tax_purchases'] as const).map(section => (
        <AcctCard
          key={section}
          title={section === 'tax_sales' ? 'VAT on sales' : 'VAT on purchases'}
          description={section === 'tax_sales'
            ? `The ${cfg.short} tax rate for each VAT code on your invoices and credit notes.`
            : `The ${cfg.short} tax rate for each VAT code on supplier bills.`}
          flush
        >
          {m[section].map(row => {
            const field = `${section}.${row.key}`;
            const chosen = taxRates.find(t => t.code === sectionValue(section, row.key));
            const mismatch = chosen && num(chosen.rate) != null && num(row.rate) != null && num(chosen.rate) !== num(row.rate);
            return (
              <div className="acct-map-row" key={row.key}>
                <label className="acct-map-row__label" id={`lbl-${field}`}>
                  {row.label}
                  <small>Needs a {pct(row.rate)} rate</small>
                </label>
                <div className="acct-map-row__field">
                  <TaxSelect labelledBy={`lbl-${field}`} rates={taxRates} prefer={t => (section === 'tax_sales' ? t.revenue : t.expenses)}
                    preferLabel={section === 'tax_sales' ? 'Sales rates' : 'Purchase rates'}
                    value={sectionValue(section, row.key)} onChange={v => setSection(section, row.key, v)} disabled={disabled} invalid={!!errors[field]} />
                  {mismatch && !errors[field] && (
                    <div className="acct-error">This rate is {pct(chosen.rate)}; {row.label.replace(/\s*\(.*\)$/, '')} needs {pct(row.rate)}.</div>
                  )}
                  {suggestionHint(section, row.key, describeTax)}
                  {errors[field] && <div className="acct-error" role="alert">{errors[field]}</div>}
                </div>
              </div>
            );
          })}
        </AcctCard>
      ))}

      <AcctCard
        title="Bank account for earlier payments"
        description={`Only needed if you recorded customer payments in TruckWys for invoices after the cut-over date. They are sent to ${cfg.short} into this bank account.`}
        flush
      >
        <div className="acct-map-row">
          <label className="acct-map-row__label" id="lbl-receipts">Bank account</label>
          <div className="acct-map-row__field">
            <AccountSelect labelledBy="lbl-receipts" accounts={accounts.filter(a => a.is_bank)} prefer={() => true} preferLabel="Bank accounts"
              value={receipts} onChange={v => { setDraft(d => ({ ...d, receipts_account: v })); setErrors(e => { const n = { ...e }; delete n.receipts_account; return n; }); }}
              disabled={disabled} invalid={!!errors.receipts_account} noneLabel="Not needed" />
            {accounts.every(a => !a.is_bank) && <div className="acct-hint">No bank accounts came back from {cfg.short}. Add one there, then refresh.</div>}
            {errors.receipts_account && <div className="acct-error" role="alert">{errors.receipts_account}</div>}
          </div>
        </div>
      </AcctCard>

      <AcctCard title="Tracking (optional)" description={`Tag invoice and bill lines in ${cfg.short} with the vehicle and branch, so you can report profit per truck there.`} flush>
        {cats.length === 0 ? (
          <div className="acct-empty" style={{ textAlign: 'left' }}>Your {cfg.short} organisation has no tracking categories. You can skip this.</div>
        ) : (
          <>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-veh">
                Vehicle category
                <small>Each line is tagged with its vehicle's registration</small>
              </label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-veh" value={tracking.vehicle_category_id} disabled={disabled} invalid={!!errors['tracking.vehicle_category_id']}
                  options={cats.map(c => ({ value: c.id, label: c.name }))} noneLabel="Don't tag vehicles"
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, vehicle_category_id: v } }))} />
                {errors['tracking.vehicle_category_id'] && <div className="acct-error" role="alert">{errors['tracking.vehicle_category_id']}</div>}
              </div>
            </div>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-branch">Branch category</label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-branch" value={tracking.branch_category_id} disabled={disabled} invalid={!!errors['tracking.branch_category_id']}
                  options={cats.map(c => ({ value: c.id, label: c.name }))} noneLabel="Don't tag a branch"
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, branch_category_id: v, branch_option: '' } }))} />
                {errors['tracking.branch_category_id'] && <div className="acct-error" role="alert">{errors['tracking.branch_category_id']}</div>}
              </div>
            </div>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-branch-opt">
                Branch
                <small>Every line is tagged with this branch</small>
              </label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-branch-opt" value={tracking.branch_option || null} disabled={disabled || !branchCat} invalid={!!errors['tracking.branch_option']}
                  options={(branchCat?.options ?? []).map(o => ({ value: o.name, label: o.name }))} noneLabel={branchCat ? 'Choose a branch' : 'Choose a branch category first'}
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, branch_option: v ?? '' } }))} />
                {errors['tracking.branch_option'] && <div className="acct-error" role="alert">{errors['tracking.branch_option']}</div>}
              </div>
            </div>
          </>
        )}
      </AcctCard>

      {canWrite && (
        <div className={`acct-savebar${dirty || formError ? ' is-dirty' : ''}`}>
          <span className="acct-savebar__note" role={formError ? 'alert' : undefined} style={formError ? { color: 'var(--status-danger-text)' } : undefined}>
            {formError || (dirty ? `${changeCount} unsaved ${changeCount === 1 ? 'change' : 'changes'}` : 'No unsaved changes')}
          </span>
          <button type="button" className="tw-btn" onClick={() => { setDraft(EMPTY_DRAFT); setErrors({}); setFormError(''); }} disabled={!dirty || saving}>Discard</button>
          <button type="button" className="tw-btn tw-btn--primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save mapping'}</button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- selects

function AccountSelect({ accounts, prefer, preferLabel, value, onChange, disabled, invalid, labelledBy, noneLabel = 'Not mapped' }: {
  accounts: ProviderAccount[];
  prefer: (a: ProviderAccount) => boolean;
  preferLabel: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy: string;
  noneLabel?: string;
}) {
  const withCode = accounts.filter(a => a.code);
  const first = withCode.filter(prefer);
  const rest = withCode.filter(a => !prefer(a));
  const unknown = value && !withCode.some(a => a.code === value);
  return (
    <Select value={value ?? NONE} onValueChange={v => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className="acct-select" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {unknown && <SelectItem value={value!}>{value} (no longer in the list)</SelectItem>}
        {first.length > 0 && (
          <SelectGroup>
            <SelectLabel>{preferLabel}</SelectLabel>
            {first.map(a => <SelectItem key={a.code} value={a.code}>{accountLabel(a)}</SelectItem>)}
          </SelectGroup>
        )}
        {rest.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other accounts</SelectLabel>
            {rest.map(a => <SelectItem key={a.code} value={a.code}>{accountLabel(a)}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

function TaxSelect({ rates, prefer, preferLabel, value, onChange, disabled, invalid, labelledBy }: {
  rates: ProviderTaxRate[];
  prefer: (t: ProviderTaxRate) => boolean;
  preferLabel: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy: string;
}) {
  const first = rates.filter(prefer);
  const rest = rates.filter(t => !prefer(t));
  const unknown = value && !rates.some(t => t.code === value);
  return (
    <Select value={value ?? NONE} onValueChange={v => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className="acct-select" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not mapped</SelectItem>
        {unknown && <SelectItem value={value!}>{value} (no longer in the list)</SelectItem>}
        {first.length > 0 && (
          <SelectGroup>
            <SelectLabel>{preferLabel}</SelectLabel>
            {first.map(t => <SelectItem key={t.code} value={t.code}>{taxLabel(t)}</SelectItem>)}
          </SelectGroup>
        )}
        {rest.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other rates</SelectLabel>
            {rest.map(t => <SelectItem key={t.code} value={t.code}>{taxLabel(t)}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

function PlainSelect({ options, value, onChange, disabled, invalid, labelledBy, noneLabel }: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy: string;
  noneLabel: string;
}) {
  const unknown = value && !options.some(o => o.value === value);
  return (
    <Select value={value ?? NONE} onValueChange={v => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className="acct-select" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {unknown && <SelectItem value={value!}>{value}</SelectItem>}
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
