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
import { AcctCard, ErrorBlock, LoadingBlock, SkelLine, useAccountingPermissions } from './shared';

const NONE = '__none';

/** "12 hours ago", "5 minutes ago", "just now". */
function hoursAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  return `${Math.round(h / 24)} days ago`;
}

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
// Items ("item:12") and QuickBooks account ids mean nothing to people: name only.
const accountLabel = (a: ProviderAccount, showCodes = true) => (!showCodes || a.type === 'ITEM' || !a.code ? a.name : `${a.code} · ${a.name}`);
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
  const [optionalOpen, setOptionalOpen] = useState(false);

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

  if (q.isLoading) {
    // The same cards as the loaded page, with placeholder rows.
    return (
      <>
        <AcctCard
          id="acct-map-skel"
          title={<SkelLine width={140} lineHeight={24} />}
          description={<><SkelLine width="90%" /><SkelLine width="70%" /><SkelLine width="40%" /></>}
          actionsBelow
          actions={<><span className="tw-btn" style={{ visibility: 'hidden', width: 160 }} aria-hidden="true" /><span className="tw-btn" style={{ visibility: 'hidden', width: 160 }} aria-hidden="true" /></>}
        />
        <AcctCard title="Income accounts" description="Which income account each kind of charge on your invoices goes to." flush>
          <div className="acct-skel-map"><LoadingBlock label="Loading mapping" rows={6} /></div>
        </AcctCard>
      </>
    );
  }
  if (q.isError || !m) {
    return <AcctCard title="Mapping"><ErrorBlock message={apiMessage(q.error, "Couldn't load the mapping.")} onRetry={() => q.refetch()} /></AcctCard>;
  }

  const allAccounts = m.options.accounts ?? [];
  // QuickBooks: revenue types go to products/services (ITEM); everything else to plain accounts.
  const itemsForRevenue = cfg.revenueTarget === 'item';
  const items = allAccounts.filter(a => a.type === 'ITEM');
  const accounts = itemsForRevenue ? allAccounts.filter(a => a.type !== 'ITEM') : allAccounts;
  const revenueOptions = itemsForRevenue ? items : allAccounts;
  const taxRates = m.options.tax_rates ?? [];
  const cats = m.options.tracking_categories ?? [];
  const tl = cfg.tracking;
  const vehicleCats = tl.vehicleCat ? cats.filter(c => c.id === tl.vehicleCat) : cats;
  const branchCats = tl.branchCatId ? cats.filter(c => c.id === tl.branchCatId) : cats;
  const disabled = !canWrite || saving;
  const branchCat = cats.find(c => c.id === tracking.branch_category_id);
  // Optional cards fold away unless something is set or has an error there.
  const showOptional = optionalOpen || !!receipts || !!tracking.vehicle_category_id || !!tracking.branch_category_id
    || Object.keys(errors).some(k => k === 'receipts_account' || k.startsWith('tracking.'));

  // The server's "missing" list says which empty rows block the sync; any
  // other empty row is optional. Both are labelled, so nothing is guesswork.
  const PREFIX: Record<MappingSection, string> = { revenue_types: 'revenue', expense_categories: 'expense', tax_sales: 'tax_sales', tax_purchases: 'tax_purchases' };
  const requiredGap = (section: MappingSection, key: string) =>
    !sectionValue(section, key) && (m.missing ?? []).includes(`${PREFIX[section]}:${key}`);
  const suggestionHint = (section: MappingSection, key: string, describe: (v: string) => string) => {
    const s = m.suggestions?.[section]?.[key];
    const empty = !sectionValue(section, key);
    if (s && sectionValue(section, key) !== s) {
      return (
        <div className={`acct-hint acct-hint--stack${requiredGap(section, key) ? ' is-required' : ''}`}>
          <span>{requiredGap(section, key) ? 'Required. ' : ''}Suggested: {describe(s)}.</span>
          {canWrite && <button type="button" className="tw-btn tw-btn--sm acct-use-btn" onClick={() => setSection(section, key, s)}>Use suggestion</button>}
        </div>
      );
    }
    if (requiredGap(section, key)) return <div className="acct-hint is-required">Required. No suggestion for this one.</div>;
    return null;
  };
  const isOptional = (section: MappingSection, key: string) => !(m.missing ?? []).includes(`${PREFIX[section]}:${key}`);
  const optionalTag = (section: MappingSection, key: string) =>
    !sectionValue(section, key) && !requiredGap(section, key) ? <span className="acct-optional"> · optional</span> : null;
  // "revenue:FUEL_SURCHARGE" -> scroll to that row and focus its select.
  const jumpTo = (k: string) => {
    const [prefix, key] = k.split(':');
    const section = (Object.keys(PREFIX) as MappingSection[]).find(sct => PREFIX[sct] === prefix);
    const el = section ? document.getElementById(`lbl-${section}.${key}`) : null;
    el?.closest('.acct-map-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const rowClass = (section: MappingSection, key: string) => `acct-map-row${requiredGap(section, key) ? ' is-required' : ''}`;
  const describeAccount = (code: string) => { const a = allAccounts.find(x => x.code === code); return a ? accountLabel(a, cfg.showAccountCodes) : code; };
  const describeTax = (code: string) => { const t = taxRates.find(x => x.code === code); return t ? taxLabel(t) : code; };

  return (
    <>
      <AcctCard
        title={m.complete && !dirty ? 'Everything required is mapped' : m.missing.length > 0 ? `${m.missing.length} required ${m.missing.length === 1 ? 'line' : 'lines'} still to map` : 'Unsaved changes'}
        description={<>
          Nothing is sent to {cfg.short} until every required line is mapped.
          {m.options.fetched_at && <> Accounts updated from {cfg.short} {hoursAgo(m.options.fetched_at)}.</>}
          {m.missing.length > 0 && !(m.complete && !dirty) && (
            <ul className="acct-jump-list">{m.missing.map(k => (
              <li key={k}><button type="button" className="acct-jumpbtn" onClick={() => jumpTo(k)}>{missingMappingLabel(k)}</button></li>
            ))}</ul>
          )}
          {!canWrite && <> {writeTitle}; you can look but not change anything.</>}
        </>}
        actionsBelow
        actions={(canWrite && pendingSuggestions.length > 0) || canWrite ? <>
          {canWrite && pendingSuggestions.length > 0 && (
            <button type="button" className="tw-btn" onClick={applyAllSuggestions} title="Fills in the fields; nothing is saved until you press Save mapping">
              {`Use ${pendingSuggestions.length === 1 ? 'suggestion' : `${pendingSuggestions.length} suggestions`}`}
            </button>
          )}
          <button type="button" className="tw-btn" onClick={refresh} disabled={!canWrite || refreshing} title={writeTitle}>
            <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? 'Reading…' : `Refresh from ${cfg.short}`}
          </button>
        </> : undefined}
      />

      <AcctCard
        title={itemsForRevenue ? 'Products and services' : 'Income accounts'}
        description={itemsForRevenue
          ? `Pick the ${cfg.short} product or service for each kind of charge. Its income account decides where the money goes.`
          : 'Which income account each kind of charge on your invoices goes to.'}
        flush
      >
        {itemsForRevenue && items.length === 0 && (
          <div className="acct-hint" style={{ padding: '12px var(--card-pad, 20px) 0' }}>No products or services came back from {cfg.short}. Add a Service item there, then refresh.</div>
        )}
        {m.revenue_types.map(row => {
          const field = `revenue_types.${row.key}`;
          return (
            <div className={rowClass('revenue_types', row.key)} key={row.key}>
              <label className="acct-map-row__label" id={`lbl-${field}`}>{row.label}{optionalTag('revenue_types', row.key)}</label>
              <div className="acct-map-row__field">
                <AccountSelect showCodes={cfg.showAccountCodes} labelledBy={`lbl-${field}`} accounts={revenueOptions} prefer={a => a.class === 'REVENUE'} preferLabel={itemsForRevenue ? 'Products/services' : 'Income accounts'}
                  value={sectionValue('revenue_types', row.key)} onChange={v => setSection('revenue_types', row.key, v)} disabled={disabled} invalid={!!errors[field]}
                  noneLabel={isOptional('revenue_types', row.key) ? 'Not used' : 'Not mapped'} />
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
            <div className={rowClass('expense_categories', row.key)} key={row.key}>
              <label className="acct-map-row__label" id={`lbl-${field}`}>{row.label}{optionalTag('expense_categories', row.key)}</label>
              <div className="acct-map-row__field">
                <AccountSelect showCodes={cfg.showAccountCodes} labelledBy={`lbl-${field}`} accounts={accounts} prefer={a => a.class === 'EXPENSE'} preferLabel="Expense accounts"
                  value={sectionValue('expense_categories', row.key)} onChange={v => setSection('expense_categories', row.key, v)} disabled={disabled} invalid={!!errors[field]}
                  noneLabel={isOptional('expense_categories', row.key) ? 'Not used' : 'Not mapped'} />
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
            ? `For invoices and credit notes. Pick a ${cfg.short} rate with the same percentage.`
            : `For supplier bills. Pick a ${cfg.short} rate with the same percentage.`}
          flush
        >
          {m[section].map(row => {
            const field = `${section}.${row.key}`;
            const chosen = taxRates.find(t => t.code === sectionValue(section, row.key));
            const mismatch = chosen && num(chosen.rate) != null && num(row.rate) != null && num(chosen.rate) !== num(row.rate);
            return (
              <div className={rowClass(section, row.key)} key={row.key}>
                <label className="acct-map-row__label" id={`lbl-${field}`}>
                  {row.label}{optionalTag(section, row.key)}
                </label>
                <div className="acct-map-row__field">
                  <TaxSelect labelledBy={`lbl-${field}`} rates={taxRates} prefer={t => (section === 'tax_sales' ? t.revenue : t.expenses)}
                    preferLabel={section === 'tax_sales' ? 'Sales rates' : 'Purchase rates'}
                    value={sectionValue(section, row.key)} onChange={v => setSection(section, row.key, v)} disabled={disabled} invalid={!!errors[field]}
                    noneLabel={isOptional(section, row.key) ? 'Not used' : 'Not mapped'} />
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

      {showOptional ? (
        <>
      <AcctCard
        title={<>Payments bank account<span className="acct-optional"> · optional</span></>}
        description={`Payments already recorded in TruckWys from the start date are sent to this ${cfg.short} bank account when history is sent. Only needed if there are any.`}
        flush
      >
        <div className="acct-map-row">
          <label className="acct-map-row__label" id="lbl-receipts">{cfg.short} bank account</label>
          <div className="acct-map-row__field">
            <AccountSelect showCodes={cfg.showAccountCodes} labelledBy="lbl-receipts" accounts={accounts.filter(a => a.is_bank)} prefer={() => true} preferLabel="Bank accounts"
              value={receipts} onChange={v => { setDraft(d => ({ ...d, receipts_account: v })); setErrors(e => { const n = { ...e }; delete n.receipts_account; return n; }); }}
              disabled={disabled} invalid={!!errors.receipts_account} noneLabel="Don't send payments" />
            {accounts.every(a => !a.is_bank) && <div className="acct-hint">No bank accounts came back from {cfg.short}. Add one there, then refresh.</div>}
            {errors.receipts_account && <div className="acct-error" role="alert">{errors.receipts_account}</div>}
          </div>
        </div>
      </AcctCard>

      <AcctCard title={<>Tracking<span className="acct-optional"> · optional</span></>} description={tl.vehicleCat
        ? `Tag documents in ${cfg.short} with the vehicle (a class per truck) and the branch (a location), so you can report profit per truck in ${cfg.short}.`
        : `Tag invoice and bill lines in ${cfg.short} with the vehicle and branch, so you can report profit per truck in ${cfg.short}.`} flush>
        {cats.length === 0 ? (
          <div className="acct-empty" style={{ textAlign: 'left' }}>{itemsForRevenue
            ? <>Class and Location tracking are off in {cfg.short}. To tag vehicles and branches, turn them on in {cfg.short} (Settings → Account and settings → Advanced → Categories), then refresh. You can skip this.</>
            : <>Your {cfg.short} {cfg.orgWord} has no tracking categories. You can skip this.</>}</div>
        ) : (
          <>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-veh">
                {tl.vehicle}
              </label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-veh" value={tracking.vehicle_category_id} disabled={disabled} invalid={!!errors['tracking.vehicle_category_id']}
                  options={vehicleCats.map(c => ({ value: c.id, label: c.name }))} noneLabel="Don't tag vehicles"
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, vehicle_category_id: v } }))} />
                {tracking.vehicle_category_id && <div className="acct-hint">{tl.vehicleCat ? `Each vehicle gets its own ${cfg.short} class, named after its registration.` : "Lines are tagged with the vehicle's registration."}</div>}
                {errors['tracking.vehicle_category_id'] && <div className="acct-error" role="alert">{errors['tracking.vehicle_category_id']}</div>}
              </div>
            </div>
{tl.branchCatId ? <>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-branch-opt">{tl.branchCat}</label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-branch-opt" value={tracking.branch_option || null} disabled={disabled || branchCats.length === 0} invalid={!!errors['tracking.branch_option']}
                  options={(branchCats[0]?.options ?? []).map(o => ({ value: o.name, label: o.name }))} noneLabel={branchCats.length ? "Don't tag a location" : `Location tracking is off in ${cfg.short}`}
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, branch_category_id: v ? (branchCats[0]?.id ?? null) : null, branch_option: v ?? '' } }))} />
                {tracking.branch_option && <div className="acct-hint">Every document is tagged with this location.</div>}
                {(errors['tracking.branch_option'] || errors['tracking.branch_category_id']) && <div className="acct-error" role="alert">{errors['tracking.branch_option'] || errors['tracking.branch_category_id']}</div>}
              </div>
            </div>
            </> : <>
            <div className="acct-map-row">
              <label className="acct-map-row__label" id="lbl-branch">{tl.branchCat}</label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-branch" value={tracking.branch_category_id} disabled={disabled} invalid={!!errors['tracking.branch_category_id']}
                  options={branchCats.map(c => ({ value: c.id, label: c.name }))} noneLabel="Don't tag a branch"
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, branch_category_id: v, branch_option: '' } }))} />
                {errors['tracking.branch_category_id'] && <div className="acct-error" role="alert">{errors['tracking.branch_category_id']}</div>}
              </div>
            </div>
            <div className={`acct-map-row${branchCat ? '' : ' is-disabled-row'}`}>
              <label className="acct-map-row__label" id="lbl-branch-opt">
                {tl.branch}
              </label>
              <div className="acct-map-row__field">
                <PlainSelect labelledBy="lbl-branch-opt" value={tracking.branch_option || null} disabled={disabled || !branchCat} invalid={!!errors['tracking.branch_option']}
                  options={(branchCat?.options ?? []).map(o => ({ value: o.name, label: o.name }))} noneLabel={branchCat ? `Choose a ${tl.branch.toLowerCase()}` : `Choose ${tl.branchCatId ? 'Location tracking' : 'a branch category'} first`}
                  onChange={v => setDraft(d => ({ ...d, tracking: { ...tracking, branch_option: v ?? '' } }))} />
                {tracking.branch_option && <div className="acct-hint">{tl.branchCatId ? 'Every document is tagged with this location.' : 'Every line is tagged with this branch.'}</div>}
                {errors['tracking.branch_option'] && <div className="acct-error" role="alert">{errors['tracking.branch_option']}</div>}
              </div>
            </div>
            </>}
          </>
        )}
      </AcctCard>
        </>
      ) : (
        <AcctCard
          title="Bank account and tracking"
          description={`Optional. Where past payments go in ${cfg.short}, and vehicle or branch tags on each line.`}
          actions={<button type="button" className="tw-btn" onClick={() => setOptionalOpen(true)} aria-expanded={false}>Show options</button>}
        />
      )}

      {canWrite && (
        // The same sticky save bar as Company details.
        <div className="cs-savebar acct-map-savebar">
          <span className="cs-savebar__note" role={formError ? 'alert' : undefined} style={formError ? { color: 'var(--status-danger-text)' } : undefined}>
            {formError || (dirty ? `${changeCount} unsaved ${changeCount === 1 ? 'change' : 'changes'}` : m.missing.length > 0 ? `${m.missing.length} required ${m.missing.length === 1 ? 'line' : 'lines'} still to map` : 'All changes saved')}
          </span>
          {dirty && <button type="button" className="tw-btn tw-btn--ghost" onClick={() => { setDraft(EMPTY_DRAFT); setErrors({}); setFormError(''); }} disabled={saving}>Discard</button>}
          <button type="button" className="btn-action settings-control acct-save-btn" onClick={save} disabled={!dirty || saving}
            style={{ opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- selects

function AccountSelect({ accounts, prefer, preferLabel, value, onChange, disabled, invalid, labelledBy, noneLabel = 'Not mapped', showCodes = true }: {
  showCodes?: boolean;
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
      <SelectTrigger className="acct-select" data-empty={value ? undefined : ''} aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {unknown && <SelectItem value={value!}>{value} (no longer in the list)</SelectItem>}
        {first.length > 0 && (
          <SelectGroup>
            <SelectLabel>{preferLabel}</SelectLabel>
            {first.map(a => <SelectItem key={a.code} value={a.code}>{accountLabel(a, showCodes)}</SelectItem>)}
          </SelectGroup>
        )}
        {rest.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other accounts</SelectLabel>
            {rest.map(a => <SelectItem key={a.code} value={a.code}>{accountLabel(a, showCodes)}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

function TaxSelect({ rates, prefer, preferLabel, value, onChange, disabled, invalid, labelledBy, noneLabel = 'Not mapped' }: {
  rates: ProviderTaxRate[];
  prefer: (t: ProviderTaxRate) => boolean;
  preferLabel: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy: string;
  noneLabel?: string;
}) {
  const first = rates.filter(prefer);
  const rest = rates.filter(t => !prefer(t));
  const unknown = value && !rates.some(t => t.code === value);
  return (
    <Select value={value ?? NONE} onValueChange={v => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className="acct-select" data-empty={value ? undefined : ''} aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
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
      <SelectTrigger className="acct-select" data-empty={value ? undefined : ''} aria-labelledby={labelledBy} aria-invalid={invalid || undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {unknown && <SelectItem value={value!}>{value}</SelectItem>}
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
