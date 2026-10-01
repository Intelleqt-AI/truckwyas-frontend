import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Segmented } from '@/components/ui/Segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import RowActions, { type RowActionItem } from '@/components/ui/RowActions';
import { FinDialog } from '@/components/finance/FinDialog';
import { fetchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, MATCH_METHOD_LABEL, accountingApi, apiMessage, invalidateAccounting, providerConfig,
  type Connection, type ContactConfirmBody, type ContactKind, type ContactMatch, type ContactStatus, type ContactsResponse, type ProviderContact,
} from '@/lib/accounting';
import { settingsInputStyle } from '../settingsUi';
import { AcctCard, ErrorBlock, LoadingBlock, plural, useAccountingPermissions } from './shared';

type StatusFilter = 'ALL' | ContactStatus;
type KindFilter = 'ALL' | ContactKind;

const STATUS_META: Record<ContactStatus, { tone: StatusTone; label: string }> = {
  SUGGESTED: { tone: 'warning', label: 'Needs confirming' },
  UNMATCHED: { tone: 'danger', label: 'Not found' },
  CREATE: { tone: 'info', label: 'Will be created' },
  MATCHED: { tone: 'success', label: 'Matched' },
  SKIPPED: { tone: 'neutral', label: 'Skipped' },
};
const ORDER: ContactStatus[] = ['SUGGESTED', 'UNMATCHED', 'CREATE', 'SKIPPED', 'MATCHED'];

/** Link each TruckWys customer and supplier to its contact in the provider. */
export function ContactsTab({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [picking, setPicking] = useState<ContactMatch | null>(null);
  const [matching, setMatching] = useState(false);

  const q = useQuery<ContactsResponse>({
    queryKey: ACCT_KEYS.contacts(status, kind),
    queryFn: () => {
      const p = new URLSearchParams();
      if (status !== 'ALL') p.set('status', status);
      if (kind !== 'ALL') p.set('kind', kind);
      const qs = p.toString();
      return fetchData(`${ACCT_URL.contacts}${qs ? `?${qs}` : ''}`);
    },
    retry: 1,
    placeholderData: prev => prev,
  });

  const summary = q.data?.summary ?? {};
  const total = ORDER.reduce((n, s) => n + (summary[s] ?? 0), 0);
  const rows = useMemo(() => {
    const list = [...(q.data?.results ?? [])];
    list.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.local_name.localeCompare(b.local_name));
    return list;
  }, [q.data]);

  const confirm = async (row: ContactMatch, body: ContactConfirmBody, done: string) => {
    setBusyRow(row.id);
    try {
      const updated = await accountingApi.confirmContact(row.id, body);
      qc.setQueryData<ContactsResponse>(ACCT_KEYS.contacts(status, kind), old =>
        old ? { ...old, results: old.results.map(r => (r.id === updated.id ? updated : r)) } : old);
      toast.success(done);
      qc.invalidateQueries({ queryKey: ACCT_KEYS.contactsAll });
      qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
      qc.invalidateQueries({ queryKey: ACCT_KEYS.providers });
      setPicking(null);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't update ${row.local_name}. Try again.`));
    } finally {
      setBusyRow(null);
    }
  };

  const runMatching = async () => {
    setMatching(true);
    try {
      const { summary: s } = await accountingApi.runMatching();
      toast.success(`Matching done: ${s.MATCHED ?? 0} matched, ${s.SUGGESTED ?? 0} to confirm, ${s.UNMATCHED ?? 0} not found.`);
      invalidateAccounting(qc);
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't run matching. Try again."));
    } finally {
      setMatching(false);
    }
  };

  const statusOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'ALL', label: 'All', count: total },
    // Empty statuses stay out of the way (the current one always shows).
    ...ORDER.filter(s => (summary[s] ?? 0) > 0 || s === status).map(s => ({ value: s as StatusFilter, label: STATUS_META[s].label, count: summary[s] ?? 0 })),
  ];

  return (
    <>
      <AcctCard
        title="Contacts"
        description={`Each customer and supplier needs a ${cfg.short} contact. Matches on VAT, registration number or email are linked for you; name-only matches wait for you.`}
        actions={
          <button type="button" className="tw-btn" onClick={runMatching} disabled={!canWrite || matching} title={writeTitle}>
            <RefreshCw size={14} aria-hidden="true" className={matching ? 'animate-spin' : undefined} />
            {matching ? 'Matching…' : 'Run matching again'}
          </button>
        }
        flush
      >
        <div className="acct-toolbar">
          <div className="acct-only-wide"><Segmented label="Status" value={status} onChange={setStatus} options={statusOptions} size="sm" /></div>
          <div className="acct-only-phone" style={{ flex: '1 1 160px', minWidth: 0 }}>
            <Select value={status} onValueChange={v => setStatus(v as StatusFilter)}>
              <SelectTrigger aria-label="Status" style={{ minHeight: 36 }}><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.value === 'ALL' ? 'All statuses' : o.label} ({o.count ?? 0})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <span className="acct-toolbar__spacer" />
          <div className="acct-kind-filter">
            <Select value={kind} onValueChange={v => setKind(v as KindFilter)}>
              <SelectTrigger aria-label="Show customers, suppliers or both" style={{ minHeight: 36 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Customers and suppliers</SelectItem>
                <SelectItem value="CUSTOMER">Customers</SelectItem>
                <SelectItem value="SUPPLIER">Suppliers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {q.isLoading ? (
          <LoadingBlock label="Loading contacts" />
        ) : q.isError ? (
          <ErrorBlock message={apiMessage(q.error, "Couldn't load contacts.")} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <div className="acct-empty">
            {status === 'ALL' ? 'No customers or suppliers with documents to send yet.' : `No contacts are "${STATUS_META[status as ContactStatus].label.toLowerCase()}".`}
          </div>
        ) : (
          <ul className="acct-list" aria-busy={q.isFetching}>
            {rows.map(row => (
              <ContactRow
                key={row.id}
                row={row}
                providerName={cfg.short}
                canWrite={canWrite}
                busy={busyRow === row.id}
                onConfirm={(body, done) => confirm(row, body, done)}
                onPick={() => setPicking(row)}
              />
            ))}
          </ul>
        )}
      </AcctCard>

      {picking && (
        <PickContactDialog
          row={picking}
          providerName={cfg.short}
          busy={busyRow === picking.id}
          onClose={() => setPicking(null)}
          onPick={c => confirm(picking, { external_id: c.external_id }, `${picking.local_name} linked to ${c.name}`)}
        />
      )}
    </>
  );
}

function ContactRow({ row, providerName, canWrite, busy, onConfirm, onPick }: {
  row: ContactMatch;
  providerName: string;
  canWrite: boolean;
  busy: boolean;
  onConfirm: (body: ContactConfirmBody, done: string) => void;
  onPick: () => void;
}) {
  const meta = STATUS_META[row.status] ?? { tone: 'neutral' as StatusTone, label: row.status };
  // One identifier is enough to recognise them: VAT, else registration, else email.
  const ids = row.local_vat ? `VAT ${row.local_vat}` : row.local_registration ? `Reg ${row.local_registration}` : row.local_email;
  const suggestedId = row.external_id ?? row.candidates[0]?.external_id ?? null;
  const suggestedName = row.external_name ?? row.candidates[0]?.name ?? null;

  let match: React.ReactNode;
  if (row.status === 'MATCHED' || row.status === 'SUGGESTED') {
    match = (
      <>
        <div className="acct-row__sub" style={{ color: 'var(--text-secondary)' }}>{providerName} contact “{suggestedName ?? '—'}”</div>
        <div className="acct-row__sub">{row.method ? `Matched on ${MATCH_METHOD_LABEL[row.method] ?? row.method}` : `In ${providerName}`}</div>
      </>
    );
  } else if (row.status === 'CREATE') {
    match = <div className="acct-row__sub">A new {providerName} contact is created when the first document is sent.</div>;
  } else if (row.status === 'SKIPPED') {
    match = <div className="acct-row__sub">Not synced. Their documents stay in TruckWys only and show as sync errors.</div>;
  } else {
    match = <div className="acct-row__sub">No {providerName} contact found{row.candidates.length ? `; ${row.candidates.length} possible` : ''}.</div>;
  }

  const menu: RowActionItem[] = [];
  let primary: React.ReactNode = null;
  if (canWrite) {
    if (row.status === 'SUGGESTED' && suggestedId) {
      primary = (
        <button type="button" className="tw-btn tw-btn--primary tw-btn--sm" disabled={busy}
          onClick={() => onConfirm({ external_id: suggestedId }, `${row.local_name} linked to ${suggestedName ?? 'the suggested contact'}`)}>
          {busy ? 'Saving…' : 'Confirm match'}
        </button>
      );
      menu.push({ label: 'Pick another', onSelect: onPick });
    } else if (row.status === 'UNMATCHED') {
      primary = <button type="button" className="tw-btn tw-btn--sm" disabled={busy} onClick={onPick}>Pick a contact</button>;
    } else {
      menu.push({ label: row.status === 'MATCHED' ? 'Change contact' : 'Pick a contact', onSelect: onPick });
    }
    if (row.status !== 'CREATE') menu.push({ label: `Create new in ${providerName}`, onSelect: () => onConfirm({ action: 'create' }, `${row.local_name} will be created in ${providerName}`), disabled: busy });
    if (row.status !== 'SKIPPED') menu.push({ label: "Skip, don't sync", onSelect: () => onConfirm({ action: 'skip' }, `${row.local_name} skipped`), disabled: busy, danger: true });
  }

  return (
    <li className={`acct-row acct-row--contact${row.status === 'SUGGESTED' ? ' is-highlight' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <div className="acct-row__title">{row.local_name}</div>
        <div className="acct-row__sub">{row.kind === 'SUPPLIER' ? 'Supplier' : 'Customer'}{ids ? ` · ${ids}` : ''}</div>
      </div>
      {/* Status first, then the match: every chip starts at the same x. */}
      <div style={{ minWidth: 0 }}>
        <div className="acct-row__chip" style={{ marginBottom: 4 }}><StatusChip tone={meta.tone} label={meta.label} size="sm" /></div>
        {match}
      </div>
      <div className="acct-row__actions">
        {primary}
        <span className="acct-row__menu">{menu.length > 0 && <RowActions label={row.local_name} items={menu} />}</span>
      </div>
    </li>
  );
}

function PickContactDialog({ row, providerName, busy, onClose, onPick }: {
  row: ContactMatch;
  providerName: string;
  busy: boolean;
  onClose: () => void;
  onPick: (c: ProviderContact) => void;
}) {
  const [term, setTerm] = useState(row.local_name);
  const [debounced, setDebounced] = useState(row.local_name);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const search = useQuery({
    queryKey: ['accounting', 'contact-search', row.kind, debounced],
    queryFn: () => accountingApi.searchContacts(debounced, row.kind),
    enabled: debounced.length >= 2,
    retry: 0,
    staleTime: 60_000,
  });

  const candidates: ProviderContact[] = row.candidates.map(c => ({ external_id: c.external_id, name: c.name, vat: c.vat, email: c.email }));
  const results = (search.data?.results ?? []).filter(r => !candidates.some(c => c.external_id === r.external_id));

  const renderList = (list: ProviderContact[]) => (
    <ul className="acct-pick">
      {list.map(c => (
        <li key={c.external_id}>
          <div className="acct-pick__main">
            <div className="acct-row__title">{c.name}</div>
            {(c.vat || c.email) && <div className="acct-row__sub">{[c.vat && `VAT ${c.vat}`, c.email].filter(Boolean).join(' · ')}</div>}
          </div>
          <button type="button" className="tw-btn tw-btn--sm" disabled={busy || c.external_id === row.external_id} onClick={() => onPick(c)}>
            {c.external_id === row.external_id ? 'Linked' : 'Link'}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <FinDialog title={`Pick a ${providerName} contact`} description={`For ${row.local_name}${row.local_vat ? ` (VAT ${row.local_vat})` : ''}.`} onClose={onClose} busy={busy}>
      {candidates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="fin-label">Possible matches</div>
          {renderList(candidates)}
        </div>
      )}
      <label className="fin-label" htmlFor="acct-contact-search">Search {providerName}</label>
      <div style={{ position: 'relative' }}>
        <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          id="acct-contact-search"
          type="search"
          className="settings-control"
          style={{ ...settingsInputStyle, paddingLeft: 32 }}
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Name, VAT number or email"
          data-autofocus
        />
      </div>
      {debounced.length < 2 ? (
        <p className="fin-help" style={{ margin: '8px 0 0' }}>Type at least two letters.</p>
      ) : search.isLoading ? (
        <p className="fin-help" style={{ margin: '8px 0 0' }}>Searching {providerName}…</p>
      ) : search.isError ? (
        <p className="fin-help fin-text-danger" style={{ margin: '8px 0 0' }} role="alert">{apiMessage(search.error, `Couldn't search ${providerName}. Try again.`)}</p>
      ) : results.length === 0 ? (
        <p className="fin-help" style={{ margin: '8px 0 0' }}>No {providerName} contacts match "{debounced}".</p>
      ) : renderList(results)}
      <div className="fin-dialog__foot">
        <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </FinDialog>
  );
}
