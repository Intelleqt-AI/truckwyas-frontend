import '@/pages/admin/admin-brand.css';
import '@/pages/admin/ai-admin.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { fetchData, postData } from '@/lib/Api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { Segmented } from '@/components/ui/Segmented';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { DatePicker } from '@/components/ui/date-picker';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatDate, formatDateTime, formatMoney, formatNumber, MISSING } from '@/lib/formatters';

// The stored figures the quote price check compares against (SANRAL toll
// tariffs, the driver allowance) and the changes proposed to them. A monthly
// job (or "Run refresh now") finds each change on its published source page;
// nothing reaches a quote until a platform admin approves it here. The first
// NBCRFLI allowance is entered by hand ("Add allowance figure"), then approved.
// Superuser only (the endpoints are IsSuperUser).
// Contract: GET/POST /api/v1/admin/verified-rates/, …/<id>/approve/,
// …/<id>/reject/, …/refresh/ (backend core/views_admin.py, PR #114).

type RateStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
type StatusFilter = RateStatus | 'all';

interface VerifiedRate {
  id: number;
  kind: 'toll_tariff' | 'driver_allowance' | string;
  key: string;
  label: string;
  status: RateStatus;
  unit: 'per_passage' | 'per_night' | string | null;
  vat_basis: 'excl_vat' | null;
  current_value: number | null;
  proposed_value: number | null;
  published_value: number | null;   // tolls: as printed, incl. VAT
  previous_value: number | null;    // the approved figure when it was proposed
  effective_from: string | null;
  source_url: string | null;
  source_name: string | null;
  verified_at: string | null;       // confirmed on its source page
  found_at: string | null;          // when the job (or an admin) proposed it
  proposed_by: string | null;       // "refresh_verified_rates" | "admin:<username>"
  toll_plaza_id: number | null;
  sanral_class: number | null;
  approved_by: string | null; approved_at: string | null;
  rejected_by: string | null; rejected_at: string | null;
  review_note: string | null;
}
interface TollTable {
  active_plazas: number; verified_plazas: number;
  oldest_verified_at: string | null; oldest_effective_from: string | null;
}
interface ListResponse {
  count: number; page: number; page_size: number; num_pages: number;
  results: VerifiedRate[];
  toll_table?: TollTable;
}
// lib/Api's interceptor rethrows with `status` and `data` on the Error.
interface ErrData { error?: string; reason?: string; queued?: boolean }
interface ApiError { status?: number; data?: ErrData; response?: { status?: number; data?: ErrData } }

const PAGE_SIZE = 20;
const BASE = 'api/v1/admin/verified-rates/';
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'all', label: 'All' },
];
const STATUS_CHIP: Record<RateStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  superseded: { tone: 'neutral', label: 'Superseded' },
};
const EMPTY_TEXT: Record<StatusFilter, string> = {
  pending: 'Nothing to review. New figures appear here after each refresh.',
  approved: 'No figures approved yet.',
  rejected: 'No figures rejected.',
  superseded: 'No superseded figures.',
  all: 'No figures on record yet.',
};
const ALLOWANCE_TYPES = [
  { value: 'nbcrfli', label: 'NBCRFLI driver allowance' },
  { value: 'sars_subsistence', label: 'SARS subsistence allowance' },
];
const REFRESH_REASON: Record<string, string> = {
  disabled: 'The price check is switched off on the server.',
  no_api_key: 'The server has no OpenAI key, which the refresh needs.',
  queue_unavailable: "The job queue isn't running.",
};

const MINUS = '−';
// Server messages are shown in review dialogs (they are written for people);
// strip any dash they might carry so the no-em-dash rule holds.
const clean = (s?: string | null) => (s || '').replace(/\s*[—–]\s*/g, ', ').trim();
const kindLabel = (k: string) => (k === 'toll_tariff' ? 'Toll tariff' : k === 'driver_allowance' ? 'Driver allowance' : k.replace(/_/g, ' '));
const unitLabel = (u: string | null) => (u === 'per_passage' ? 'a passage' : u === 'per_night' ? 'a night' : '');
const money = (v: number | null | undefined) => (v == null ? MISSING : formatMoney(v));
const withUnit = (v: number | null | undefined, r: VerifiedRate) =>
  v == null ? 'no figure' : `${formatMoney(v)} ${unitLabel(r.unit)}${r.vat_basis === 'excl_vat' ? ', excl. VAT' : ''}`.trim();
const change = (from: number | null, to: number | null) => {
  if (from == null || to == null || !from) return null;
  const pct = ((to - from) / from) * 100;
  if (Math.abs(pct) < 0.05) return 'no change';
  return `${pct < 0 ? MINUS : '+'}${formatNumber(Math.abs(pct), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};
const hostOf = (url?: string | null) => {
  if (!url) return null;
  try { const u = new URL(url); return { host: u.hostname.replace(/^www\./, ''), https: u.protocol === 'https:' }; } catch { return null; }
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const who = (s: string | null) => (s ? s.replace(/^admin:/, '') : null);
const proposedByLabel = (s: string | null) => (!s ? null : s.startsWith('admin:') ? `added by ${who(s)}` : 'found by the refresh');
const errData = (e: unknown): ErrData => { const a = e as ApiError; const d = a?.data ?? a?.response?.data; return d && typeof d === 'object' ? d : {}; };
const serverError = (e: unknown) => {
  const m = errData(e).error;
  const t = typeof m === 'string' ? clean(m) : '';
  return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}` : null;
};
const statusOf = (e: unknown) => (e as ApiError)?.status ?? (e as ApiError)?.response?.status;
// "480", "480,50", "R 1 480.50" -> 1480.5; null when it isn't a number.
const parseRand = (raw: string) => {
  const s = raw.replace(/^\s*R\s*/i, '').replace(/[\s\u00A0]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
};

// ---------- a small form dialog (same geometry as ConfirmModal) ----------
function FormDialog({ id, title, children, onCancel, busy }: {
  id: string; title: string; children: ReactNode; onCancel: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);
  return (
    <div className="ru-backdrop" onClick={() => { if (!busy) onCancel(); }}>
      <div ref={ref} className="ru-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        onClick={(e) => e.stopPropagation()}>
        <h2 id={`${id}-title`} className="ru-dialog__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="ru-field">
      <label className="ru-field__label" htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="ru-field__error" id={`${id}-err`}>{error}</p> : hint ? <p className="ru-field__hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}

// ---------- approve / reject ----------
function ReviewDialog({ row, action, onClose, onDone }: {
  row: VerifiedRate; action: 'approve' | 'reject'; onClose: () => void; onDone: (r: VerifiedRate) => void;
}) {
  const [eff, setEff] = useState(row.effective_from || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const approve = action === 'approve';
  const toll = row.kind === 'toll_tariff';
  // The backend refuses a toll tariff whose date is still ahead (it would
  // change route toll charges early); say so before the request.
  const futureToll = approve && toll && !!eff && eff > todayIso();

  const submit = async () => {
    if (futureToll) return;
    setBusy(true); setErr(null);
    try {
      const data: Record<string, string> = {};
      if (note.trim()) data.note = note.trim();
      if (approve && eff && eff !== row.effective_from) data.effective_from = eff;
      const res = await postData({ url: `${BASE}${row.id}/${action}/`, data });
      onDone((res && res.rate) || row);
    } catch (e) {
      const s = statusOf(e);
      setErr(serverError(e) || (s === 404 ? 'This figure no longer exists. Reload the list.' : `Couldn't ${action} it. Try again.`));
      setBusy(false);
    }
  };

  return (
    <FormDialog id="ru-review" title={approve ? 'Approve this figure?' : 'Reject this figure?'} onCancel={onClose} busy={busy}>
      <p className="ru-dialog__msg">
        {approve
          ? <><strong>{row.label}</strong>{row.current_value != null
              ? `: ${formatMoney(row.current_value)} to ${withUnit(row.proposed_value, row)}.`
              : ` is set to ${withUnit(row.proposed_value, row)}. There is no figure on record now.`}</>
          : <><strong>{row.label}</strong> stays at {withUnit(row.current_value, row)}. The refresh won't propose this figure and date again.</>}
      </p>
      {approve && toll && <p className="ru-dialog__msg ru-dialog__msg--sub">It also changes what route toll calculations charge from that date.</p>}
      {approve && (
        <Field id="ru-eff" label="Takes effect from"
          hint={row.effective_from ? `Proposed: ${formatDate(row.effective_from)}` : undefined}
          error={futureToll ? `A toll tariff can only be approved once it is in force. Approve it on or after ${formatDate(eff)}.` : null}>
          <DatePicker dashboard id="ru-eff" value={eff} onChange={setEff} />
        </Field>
      )}
      <Field id="ru-note" label="Note (optional)">
        <textarea id="ru-note" className="tw-input ru-textarea" rows={2} maxLength={2000} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={approve ? 'For example, checked on the gazette' : 'Why it was rejected'} />
      </Field>
      {err && <p className="ru-dialog__error" role="alert">{err}</p>}
      <div className="ru-dialog__actions">
        <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`tw-btn ${approve ? 'tw-btn--primary' : 'ru-btn--danger'}`} onClick={submit}
          disabled={busy || futureToll} data-autofocus={!approve || undefined}>
          {busy ? (approve ? 'Approving…' : 'Rejecting…') : approve ? 'Approve' : 'Reject'}
        </button>
      </div>
    </FormDialog>
  );
}

// ---------- manual allowance proposal ----------
function AllowanceDialog({ onClose, onDone }: { onClose: () => void; onDone: (outcome: string, r: VerifiedRate) => void }) {
  const [form, setForm] = useState({ allowance_type: 'nbcrfli', value: '', effective_from: '', source_url: '', source_name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    const v = parseRand(form.value);
    if (!form.value.trim()) e.value = 'Enter the amount per night.';
    else if (v == null) e.value = 'Enter an amount in rand, for example 480,00.';
    else if (v <= 0 || v > 5000) e.value = 'Enter an amount above R 0 and at most R 5 000 a night.';
    if (!form.effective_from) e.effective_from = 'Enter the date it applies from.';
    const u = form.source_url.trim();
    if (!u) e.source_url = 'Add the page the figure is published on.';
    else if (!hostOf(u) || !/^https?:\/\//i.test(u)) e.source_url = 'Enter a full web address starting with https://';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      const first = (['value', 'effective_from', 'source_url'] as const).find((k) => e[k]);
      if (first) document.getElementById(`ru-a-${first}`)?.focus();
      return;
    }
    setBusy(true); setErr(null);
    try {
      const res = await postData({ url: BASE, data: {
        allowance_type: form.allowance_type, value: parseRand(form.value), effective_from: form.effective_from,
        source_url: form.source_url.trim(), source_name: form.source_name.trim(),
      } });
      onDone(res?.outcome || 'created', res?.rate);
    } catch (ex) {
      setErr(serverError(ex) || "Couldn't add the figure. Try again.");
      setBusy(false);
    }
  };
  const desc = (k: string) => (errors[k] ? `ru-a-${k}-err` : undefined);

  return (
    <FormDialog id="ru-allow" title="Add allowance figure" onCancel={onClose} busy={busy}>
      <p className="ru-dialog__msg">It is added as waiting for approval. Price checks use it only after you approve it.</p>
      <form className="ru-form" noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
        <Field id="ru-a-type" label="Allowance">
          <select id="ru-a-type" className="tw-input" value={form.allowance_type} onChange={(e) => set('allowance_type', e.target.value)}>
            {ALLOWANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="ru-form__pair">
          <Field id="ru-a-value" label="Rand per night" error={errors.value}>
            <input id="ru-a-value" className="tw-input" inputMode="decimal" autoComplete="off" placeholder="480,00"
              value={form.value} onChange={(e) => set('value', e.target.value)}
              aria-invalid={!!errors.value || undefined} aria-describedby={desc('value')} />
          </Field>
          <Field id="ru-a-effective_from" label="Applies from" error={errors.effective_from}>
            <DatePicker dashboard id="ru-a-effective_from" value={form.effective_from} onChange={(v) => set('effective_from', v)} />
          </Field>
        </div>
        <Field id="ru-a-source_url" label="Source page" error={errors.source_url} hint="Where the figure is published, for example the NBCRFLI agreement">
          <input id="ru-a-source_url" className="tw-input" type="url" inputMode="url" autoComplete="off" placeholder="https://"
            value={form.source_url} onChange={(e) => set('source_url', e.target.value)}
            aria-invalid={!!errors.source_url || undefined} aria-describedby={desc('source_url') || 'ru-a-source_url-hint'} />
        </Field>
        <Field id="ru-a-source_name" label="Source name (optional)">
          <input id="ru-a-source_name" className="tw-input" autoComplete="off" maxLength={300} placeholder="NBCRFLI main collective agreement"
            value={form.source_name} onChange={(e) => set('source_name', e.target.value)} />
        </Field>
        {err && <p className="ru-dialog__error" role="alert">{err}</p>}
        <div className="ru-dialog__actions">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={busy}>{busy ? 'Adding…' : 'Add for approval'}</button>
        </div>
      </form>
    </FormDialog>
  );
}

export default function RateUpdatesPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const listUrl = `${BASE}?status=${status}&page=${page}&page_size=${PAGE_SIZE}`;
  const { data, isLoading, isError, refetch, isFetching, isPlaceholderData } = useQuery<ListResponse>({
    queryKey: ['admin-verified-rates', status, page],
    queryFn: () => fetchData(listUrl),
    placeholderData: keepPreviousData,
    retry: 1,
  });
  // Is any driver allowance approved (or waiting)? The price check can't
  // verify the driver line until one is approved.
  const allowances = useQuery<ListResponse>({
    queryKey: ['admin-verified-rates', 'allowances'],
    queryFn: () => fetchData(`${BASE}?status=all&kind=driver_allowance&page_size=200`),
    retry: 1,
  });
  const rows = data?.results ?? [];
  const numPages = Math.max(1, data?.num_pages ?? 1);
  const total = data?.count ?? 0;
  const tolls = data?.toll_table;

  const [review, setReview] = useState<{ row: VerifiedRate; action: 'approve' | 'reject' } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<{ tone: 'ok' | 'warn'; text: string; title?: string } | null>(null);

  const changeStatus = (s: StatusFilter) => { setStatus(s); setPage(1); };
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-verified-rates'] });

  const runRefresh = async () => {
    setConfirmRefresh(false); setRefreshing(true);
    try {
      const res = await postData({ url: `${BASE}refresh/`, data: {} });
      if (res && res.queued === false) throw { status: 503, data: res };
      setRefreshNote({ tone: 'ok', text: `Refresh queued at ${formatDateTime(new Date())}. New figures appear under Pending when it finishes.`, title: res?.task_id ? `Task ${res.task_id}` : undefined });
      toast.success('Refresh queued');
    } catch (e) {
      const reason = errData(e).reason;
      const text = (reason && REFRESH_REASON[reason]) || "Couldn't start the refresh. Try again in a moment.";
      setRefreshNote({ tone: 'warn', text: `Refresh not started. ${text}` });
      toast.error('Refresh not started');
    } finally {
      setRefreshing(false);
    }
  };

  const allowanceRows = allowances.data?.results ?? [];
  const approvedAllowance = allowanceRows.some((r) => r.status === 'approved');
  const pendingAllowance = allowanceRows.filter((r) => r.status === 'pending').length;
  const pendingActive = status === 'pending' || status === 'all';

  const loadingRows = isLoading;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <section className="tw-card ru" aria-labelledby="rate-updates-title" aria-busy={isLoading || isFetching || undefined}>
      <div className="tw-card__head ru-head">
        <div className="tw-card__titles">
          <h2 id="rate-updates-title" className="tw-card__title">
            Stored rates
            <InfoTip label="Where these come from">
              Price checks compare quotes with these stored figures. Each month a job re-checks SANRAL toll tariffs and the driver allowance on their published pages and proposes any change here. Quotes keep the current figure until you approve the new one. Toll tariffs are stored as published (incl. VAT) and compared excl. VAT.
            </InfoTip>
          </h2>
          <p className="tw-card__sub">Toll tariffs and the driver allowance</p>
        </div>
        <div className="ru-head__actions">
          <button type="button" className="tw-btn" onClick={() => setAdding(true)}>Add allowance figure</button>
          <button type="button" className="tw-btn" onClick={() => setConfirmRefresh(true)} disabled={refreshing}>
            {refreshing ? 'Queuing…' : 'Run refresh now'}
          </button>
        </div>
      </div>

      <div className="ru-summary">
        <p className="aiu-line ru-summary__line">
          {tolls ? (
            <>
              <span className={`ru-dot${tolls.active_plazas && tolls.verified_plazas === tolls.active_plazas ? ' is-ok' : ' is-warn'}`} aria-hidden="true" />
              <span className="aiu-line__strong">Toll table:</span>{' '}
              {formatNumber(tolls.verified_plazas, { maximumFractionDigits: 0 })} of {formatNumber(tolls.active_plazas, { maximumFractionDigits: 0 })} plazas verified on source
              {tolls.oldest_effective_from ? `, tariffs from ${formatDate(tolls.oldest_effective_from)}` : ''}
              {tolls.oldest_verified_at ? `, oldest check ${formatDate(tolls.oldest_verified_at)}` : ''}
            </>
          ) : isError ? null : <span className="aiu-skel aiu-skel--line" aria-hidden="true" />}
        </p>
        {allowances.isSuccess && !approvedAllowance && (
          <p className="aiu-line ru-summary__line">
            <span className="ru-dot is-warn" aria-hidden="true" />
            <span className="aiu-line__strong">Driver allowance:</span>{' '}
            {pendingAllowance > 0
              ? `none approved yet, ${pendingAllowance} waiting for approval. Price checks can't verify it until one is approved.`
              : "none on record. Price checks can't verify it until you add and approve one."}
          </p>
        )}
        {refreshNote && (
          <p className="aiu-line ru-summary__line" role="status" title={refreshNote.title}>
            <span className={`ru-dot${refreshNote.tone === 'ok' ? ' is-ok' : ' is-warn'}`} aria-hidden="true" />
            {refreshNote.text}
          </p>
        )}
      </div>

      <div className="ru-filter">
        <Segmented label="Status" size="sm" value={status} onChange={changeStatus}
          options={STATUS_OPTIONS.map((o) => ({ ...o, count: o.value === status && data && !isPlaceholderData ? total : undefined }))} />
      </div>

      {isError ? (
        <div className="aiu-errorline ru-error">
          <p className="aiu-line"><span className="aiu-line__strong">Couldn't load the stored rates.</span> Try again in a moment.</p>
          <button type="button" className="tw-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      ) : !loadingRows && rows.length === 0 ? (
        <p className="aiu-line ru-empty">{EMPTY_TEXT[status]}</p>
      ) : (
        <table className={`admin-table ru-table${isPlaceholderData ? ' is-stale' : ''}`}>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col" className="num">Current</th>
              <th scope="col" className="num">Proposed</th>
              <th scope="col">Takes effect</th>
              <th scope="col">Source</th>
              <th scope="col" className="ru-act-h">{pendingActive ? <span className="aiu-sr">Actions</span> : 'Review'}</th>
            </tr>
          </thead>
          <tbody>
            {loadingRows && [0, 1, 2].map((i) => (
              <tr key={i} className="ru-row" aria-hidden="true">
                <td className="ru-what"><span className="aiu-skel" /></td>
                <td className="num ru-cur"><span className="aiu-skel" /></td>
                <td className="num ru-new"><span className="aiu-skel" /></td>
                <td className="ru-eff"><span className="aiu-skel" /></td>
                <td className="ru-src"><span className="aiu-skel" /></td>
                <td className="ru-act" />
              </tr>
            ))}
            {rows.map((r) => {
              const src = hostOf(r.source_url);
              // The figure it replaces: today's stored one while pending, the
              // one it replaced at proposal time once reviewed.
              const before = r.status === 'pending' ? r.current_value : (r.previous_value ?? r.current_value);
              const delta = change(before, r.proposed_value);
              const unit = unitLabel(r.unit);
              const chip = STATUS_CHIP[r.status] || STATUS_CHIP.superseded;
              const reviewedBy = r.status === 'approved' ? who(r.approved_by) : r.status === 'rejected' ? who(r.rejected_by) : null;
              const reviewedAt = r.status === 'approved' ? r.approved_at : r.status === 'rejected' ? r.rejected_at : null;
              const future = !!r.effective_from && r.effective_from > todayIso();
              return (
                <tr key={r.id} className="ru-row">
                  <td className="ru-what">
                    <span className="ru-label">{r.label}</span>
                    <span className="aiu-sub">
                      {[kindLabel(r.kind), r.found_at ? `found ${formatDate(r.found_at)}` : null, proposedByLabel(r.proposed_by)].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="num ru-cur">
                    <span className="ru-cell-label">Current </span>{money(before)}
                    {before != null && unit && <span className="aiu-sub ru-unit">{unit}</span>}
                  </td>
                  <td className="num ru-new">
                    <span className="ru-cell-label">Proposed </span>
                    <strong>{money(r.proposed_value)}</strong>
                    <span className="aiu-sub ru-unit">
                      {[unit, r.vat_basis === 'excl_vat' ? 'excl. VAT' : null, delta].filter(Boolean).join(', ')}
                    </span>
                    {r.vat_basis === 'excl_vat' && r.published_value != null && (
                      <span className="aiu-sub ru-unit" title="As published on the source">{formatMoney(r.published_value)} incl. VAT</span>
                    )}
                  </td>
                  <td className="ru-eff">
                    <span className="ru-cell-label">Takes effect </span>
                    <span className="ru-eff__date">{r.effective_from ? formatDate(r.effective_from) : MISSING}</span>
                    {future && r.status === 'pending' && <span className="aiu-sub">Not yet in force</span>}
                  </td>
                  <td className="ru-src">
                    {/* Only https pages are linked; anything else is named, not linked. */}
                    {src?.https ? (
                      <a className="ru-srclink" href={r.source_url!} target="_blank" rel="noopener noreferrer"
                        title={r.source_name || undefined} aria-label={`${r.source_name || src.host} (opens in a new tab)`}>{src.host}</a>
                    ) : src ? <span className="ru-srctext" title={r.source_url || undefined}>{src.host} (not https)</span>
                      : <span className="aiu-sub ru-nosrc">No source link</span>}
                    {r.verified_at && <span className="aiu-sub aiu-nowrap">Checked {formatDate(r.verified_at)}</span>}
                  </td>
                  <td className="ru-act">
                    {r.status === 'pending' ? (
                      <>
                        <button type="button" className="tw-btn tw-btn--sm tw-btn--ghost" onClick={() => setReview({ row: r, action: 'reject' })}
                          aria-label={`Reject the new ${r.label} figure`}>Reject</button>
                        <button type="button" className="tw-btn tw-btn--sm" onClick={() => setReview({ row: r, action: 'approve' })}
                          aria-label={`Approve the new ${r.label} figure`}>Approve</button>
                      </>
                    ) : (
                      <div className="ru-reviewed">
                        <StatusChip tone={chip.tone} label={chip.label} />
                        {(reviewedBy || reviewedAt) && (
                          <span className="aiu-sub">{[reviewedBy, reviewedAt ? formatDate(reviewedAt) : null].filter(Boolean).join(', ')}</span>
                        )}
                        {r.review_note && <span className="aiu-sub ru-note" title={r.review_note}>{clean(r.review_note)}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!isError && numPages > 1 && (
        <nav className="ru-pager" aria-label="Pages">
          <span className="aiu-line ru-pager__count">{from} to {to} of {formatNumber(total, { maximumFractionDigits: 0 })}</span>
          <div className="ru-pager__btns">
            <button type="button" className="tw-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>Previous</button>
            <button type="button" className="tw-btn" onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page >= numPages || isFetching}>Next</button>
          </div>
        </nav>
      )}

      {review && (
        <ReviewDialog row={review.row} action={review.action} onClose={() => setReview(null)}
          onDone={(r) => {
            const approved = review.action === 'approve';
            setReview(null);
            toast.success(approved
              ? `Approved. ${review.row.label} is ${withUnit(r.proposed_value ?? review.row.proposed_value, review.row)} from ${formatDate(r.effective_from || review.row.effective_from)}`
              : `Rejected. ${review.row.label} stays at ${withUnit(review.row.current_value, review.row)}`);
            invalidate();
          }} />
      )}
      {adding && (
        <AllowanceDialog onClose={() => setAdding(false)}
          onDone={(outcome) => {
            setAdding(false);
            toast.success(outcome === 'created' ? 'Added. It is waiting for approval under Pending.' : 'That figure is already waiting for approval.');
            changeStatus('pending');
            invalidate();
          }} />
      )}
      {confirmRefresh && (
        <ConfirmModal
          title="Run the refresh now?"
          message="It looks up SANRAL toll tariffs and the driver allowance on their published pages, which costs a few US cents. Any change it finds is added under Pending for you to approve. It also runs by itself on the 2nd of each month."
          confirmLabel="Run refresh"
          onConfirm={runRefresh}
          onCancel={() => setConfirmRefresh(false)}
        />
      )}
    </section>
  );
}
