import { useEffect, useMemo, useState } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { toast } from '@/lib/toast';
import {
  serverMessage, useAddLimit, useApprovePolicy, useDeskDebtors, useDeskLimits, useDeskPolicy, useDeskTransporters, useProposePolicy,
} from '@/lib/capital/api';
import type { LimitInput, LimitScope, PolicyParams, PolicyVersion } from '@/lib/capital/types';
import { SkelCard, dayTime, money } from '../capitalUi';
import { ListCard, type DeskCtx } from './common';

const humanise = (k: string) => k.replace(/_/g, ' ').replace(/\bpct\b/i, '%').replace(/^./, (c) => c.toUpperCase());
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Current policy, versions awaiting the funder's sign-off, a proposal form, and limits/holds. */
export function PolicyTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskPolicy(ctx.funder);
  const approve = useApprovePolicy(ctx.funder);
  const [approveError, setApproveError] = useState<{ id: number; text: string } | null>(null);

  const onApprove = async (v: PolicyVersion) => {
    setApproveError(null);
    try {
      await approve.mutateAsync(v.id);
      toast.success(`Policy version ${v.version} approved`);
    } catch (e) {
      setApproveError({ id: v.id, text: serverMessage(e, 'The version could not be approved.') });
    }
  };

  if (loadFailed(q)) return <LoadError what="the policy" error={q.error ?? q.failureReason} busy={q.isFetching} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <div className="fin-stack fin-stack--16"><SkelCard height={200} /><SkelCard height={320} /></div>;
  const { current, pending, defaults } = q.data;

  return (
    <div className="fin-stack fin-stack--16">
      <div className="cap-grid">
        <section className="card" aria-labelledby="pol-current">
          <div className="fin-panel-head" style={{ marginBottom: 4 }}>
            <div className="fin-panel-head__text">
              <h2 id="pol-current" className="fin-panel-title">Policy in force</h2>
              <p className="fin-panel-desc">{current ? `Version ${current.version}` : 'Defaults, no approved version yet'}</p>
            </div>
            {current && <StatusChip tone="success" label="Approved" size="sm" />}
          </div>
          {current && (
            <dl className="fin-dl">
              <div className="fin-dl__row"><dt>Approved by</dt><dd>{current.approved_by ?? '—'}</dd></div>
              <div className="fin-dl__row"><dt>Approved</dt><dd>{dayTime(current.approved_at)}</dd></div>
              <div className="fin-dl__row"><dt>Proposed by</dt><dd>{current.created_by ?? '—'}</dd></div>
              {current.notes && <div className="fin-dl__row"><dt>Notes</dt><dd style={{ textAlign: 'right' }}>{current.notes}</dd></div>}
            </dl>
          )}
        </section>

        <section className="card" aria-labelledby="pol-pending">
          <div className="fin-panel-head" style={{ marginBottom: 4 }}>
            <div className="fin-panel-head__text">
              <h2 id="pol-pending" className="fin-panel-title">Waiting for sign-off</h2>
              <p className="fin-panel-desc">A funder approver signs; not the proposer</p>
            </div>
          </div>
          {pending.length === 0 ? <p className="fin-note">No versions are waiting.</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
              {pending.map((v) => (
                <li key={v.id} className="fin-inset" style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="fin-strong">Version {v.version}</span>
                    <span className="cap-sub">by {v.created_by ?? '—'}{v.created_at ? `, ${dayTime(v.created_at)}` : ''}</span>
                  </div>
                  {v.notes && <p className="fin-note">{v.notes}</p>}
                  <ChangedParams from={current?.params ?? defaults} to={v.params} />
                  {approveError?.id === v.id && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{approveError.text}</p>}
                  {ctx.role === 'APPROVER' && (
                    <div className="cap-form-foot">
                      <button type="button" className="tw-btn tw-btn--primary" onClick={() => onApprove(v)} disabled={approve.isPending}>
                        {approve.isPending && approve.variables === v.id ? 'Approving…' : 'Approve version'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {ctx.role === 'STAFF' && <ProposeForm ctx={ctx} base={current?.params ?? defaults} />}

      <LimitsSection ctx={ctx} />
    </div>
  );
}

/** Top-level parameters whose value differs, old → new. */
function ChangedParams({ from, to }: { from: PolicyParams; to: PolicyParams }) {
  const keys = Object.keys(to ?? {}).filter((k) => !same(from?.[k], to[k]));
  if (keys.length === 0) return <p className="cap-sub">No parameter changes.</p>;
  return (
    <dl className="fin-dl">
      {keys.map((k) => (
        <div key={k} className="fin-dl__row">
          <dt>{humanise(k)}</dt>
          <dd style={{ textAlign: 'right' }}><span className="cap-muted">{fmt(from?.[k])}</span> → {fmt(to[k])}</dd>
        </div>
      ))}
    </dl>
  );
}
const fmt = (v: unknown): string => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${fmt(x)}`).join(', ');
  return String(v);
};

/**
 * A new policy version. Every parameter is editable in place; only the
 * top-level parameters that changed are sent (a nested group, such as caps
 * by grade, is sent whole when any of its values changed).
 */
function ProposeForm({ ctx, base }: { ctx: DeskCtx; base: PolicyParams }) {
  const propose = useProposePolicy(ctx.funder);
  const [draft, setDraft] = useState<PolicyParams>(() => structuredClone(base ?? {}));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setDraft(structuredClone(base ?? {})); }, [base]);

  const changed = useMemo(() => Object.keys(draft).filter((k) => !same(base?.[k], draft[k])), [draft, base]);
  const scalars = Object.keys(draft).filter((k) => !isObj(draft[k]));
  const groups = Object.keys(draft).filter((k) => isObj(draft[k]));

  const set = (path: string[], value: unknown) => setDraft((d) => {
    const next = structuredClone(d);
    let o: Record<string, unknown> = next;
    for (const p of path.slice(0, -1)) o = o[p] as Record<string, unknown>;
    o[path[path.length - 1]] = value;
    return next;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const params = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    try {
      await propose.mutateAsync({ params, notes: notes.trim() });
      toast.success('New policy version proposed');
      setNotes('');
    } catch (err) {
      setError(serverMessage(err, 'The version could not be proposed.'));
    }
  };

  return (
    <section className="card" aria-labelledby="pol-propose">
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id="pol-propose" className="fin-panel-title">Propose a new version</h2>
          <p className="fin-panel-desc">Takes effect once a funder approver signs</p>
        </div>
        <span className="cap-sub">{changed.length} {changed.length === 1 ? 'parameter' : 'parameters'} changed</span>
      </div>
      {Object.keys(draft).length === 0 ? <p className="fin-note">The server sent no parameters to edit.</p> : (
        <form className="fin-form" onSubmit={submit}>
          <div className="cap-params">
            {scalars.length > 0 && (
              <fieldset className="cap-params__group">
                <legend>General</legend>
                <div className="cap-params__grid">
                  {scalars.map((k) => <ParamField key={k} name={k} value={draft[k]} original={base?.[k]} onChange={(v) => set([k], v)} />)}
                </div>
              </fieldset>
            )}
            {groups.map((g) => {
              const obj = draft[g] as Record<string, unknown>;
              const orig = (isObj(base?.[g]) ? base[g] : {}) as Record<string, unknown>;
              return (
                <fieldset key={g} className="cap-params__group">
                  <legend>{humanise(g)}</legend>
                  <div className="cap-params__grid">
                    {Object.keys(obj).map((k) => (
                      <ParamField key={k} name={k} label={k} value={obj[k]} original={orig[k]} onChange={(v) => set([g, k], v)} />
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <div>
            <label className="fin-label" htmlFor="pol-notes">Why this change</label>
            <textarea id="pol-notes" className="fin-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} required />
          </div>
          {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
          <div className="cap-form-foot">
            <button type="button" className="tw-btn" onClick={() => setDraft(structuredClone(base ?? {}))} disabled={changed.length === 0 || propose.isPending}>Reset</button>
            <button type="submit" className="tw-btn tw-btn--primary" disabled={changed.length === 0 || !notes.trim() || propose.isPending}>
              {propose.isPending ? 'Sending…' : 'Propose version'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** One parameter. Numbers stay numbers, flags are checkboxes, anything nested deeper is JSON. */
function ParamField({ name, label, value, original, onChange }: {
  name: string; label?: string; value: unknown; original: unknown; onChange: (v: unknown) => void;
}) {
  const id = `pp-${name}-${label ?? ''}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const changed = !same(value, original);
  const [text, setText] = useState(() => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value == null ? '' : String(value)));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(typeof value === 'object' && value !== null ? JSON.stringify(value) : value == null ? '' : String(value));
    // Only when the value is replaced from outside (reset, new base).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(original)]);

  if (typeof original === 'boolean' || typeof value === 'boolean') {
    return (
      <div className={`cap-params__field${changed ? ' is-changed' : ''}`}>
        <label className="cap-check" htmlFor={id} style={{ fontWeight: 400 }}>
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {humanise(label ?? name)}
        </label>
      </div>
    );
  }
  const numeric = typeof original === 'number' || typeof value === 'number';
  const complex = typeof original === 'object' && original !== null;
  return (
    <div className={`cap-params__field${changed ? ' is-changed' : ''}`}>
      <label htmlFor={id}>{humanise(label ?? name)}</label>
      <input
        id={id}
        className="fin-control"
        inputMode={numeric ? 'decimal' : undefined}
        value={text}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (complex) {
            try { onChange(JSON.parse(t)); setBad(false); } catch { setBad(true); }
          } else if (numeric) {
            const n = Number(t.replace(',', '.'));
            if (t.trim() === '') { onChange(null); setBad(false); } else if (Number.isFinite(n)) { onChange(n); setBad(false); } else setBad(true);
          } else onChange(t === '' ? null : t);
        }}
      />
      {bad && <span className="cap-sub fin-text-danger">{complex ? 'Not valid JSON' : 'Not a number'}</span>}
    </div>
  );
}

const SCOPES: { value: LimitScope; label: string }[] = [
  { value: 'DEBTOR', label: 'Debtor' },
  { value: 'TRANSPORTER', label: 'Transporter' },
  { value: 'PAIR', label: 'Transporter and debtor' },
  { value: 'SECTOR', label: 'Sector' },
];

function LimitsSection({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskLimits(ctx.funder);
  const staff = ctx.role === 'STAFF';
  return (
    <>
      {staff && <AddLimitForm ctx={ctx} />}
      <ListCard id="pol-limits" title="Limits and holds" sub="Newest first" query={q} empty="No limits or holds. Policy defaults apply." isEmpty={(d) => d.length === 0}>
        {(rows) => (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Scope</th><th>Applies to</th><th className="num">Limit</th><th>Hold</th><th>Reason</th><th>By</th><th>When</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td>{SCOPES.find((s) => s.value === l.scope)?.label ?? l.scope}</td>
                    <td className="fin-strong">{[l.company_name, l.debtor_name, l.sector].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="num">{l.amount == null ? 'Policy default' : money(l.amount)}</td>
                    <td>{l.hold ? <StatusChip tone="danger" label="On hold" size="sm" /> : 'No'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 180 }}>{l.reason}</td>
                    <td>{l.created_by ?? '—'}</td>
                    <td className="fin-date">{dayTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListCard>
    </>
  );
}

function AddLimitForm({ ctx }: { ctx: DeskCtx }) {
  const debtors = useDeskDebtors(ctx.funder);
  const transporters = useDeskTransporters(ctx.funder);
  const add = useAddLimit(ctx.funder);
  const [scope, setScope] = useState<LimitScope>('DEBTOR');
  const [debtorId, setDebtorId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [sector, setSector] = useState('');
  const [useDefault, setUseDefault] = useState(false);
  const [amount, setAmount] = useState('');
  const [hold, setHold] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const sectors = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of debtors.data ?? []) if (d.sector) m.set(d.sector, d.sector_label || d.sector);
    return [...m.entries()];
  }, [debtors.data]);

  const needDebtor = scope === 'DEBTOR' || scope === 'PAIR';
  const needCompany = scope === 'TRANSPORTER' || scope === 'PAIR';
  const amountNum = Number(amount.replace(/[\s,]/g, ''));
  const amountOk = useDefault || (amount.trim() !== '' && Number.isFinite(amountNum) && amountNum >= 0);
  const valid = reason.trim() && amountOk && (!needDebtor || debtorId) && (!needCompany || companyId) && (scope !== 'SECTOR' || sector);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError('');
    const body: LimitInput = {
      scope,
      amount: useDefault ? null : amountNum,
      hold,
      reason: reason.trim(),
      ...(needDebtor ? { debtor_id: Number(debtorId) } : {}),
      ...(needCompany ? { company_id: Number(companyId) } : {}),
      ...(scope === 'SECTOR' ? { sector } : {}),
    };
    try {
      await add.mutateAsync(body);
      toast.success(hold ? 'Hold added' : 'Limit added');
      setAmount(''); setReason(''); setHold(false); setUseDefault(false);
    } catch (err) {
      setError(serverMessage(err, 'The limit could not be added.'));
    }
  };

  return (
    <section className="card" aria-labelledby="pol-add-limit">
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id="pol-add-limit" className="fin-panel-title">Add a limit or hold</h2>
          <p className="fin-panel-desc">Overrides the policy for one subject</p>
        </div>
      </div>
      <form className="fin-form" onSubmit={submit}>
        <div className="cap-form-row">
          <div>
            <label className="fin-label" htmlFor="lim-scope">Applies to</label>
            <select id="lim-scope" className="fin-control" style={{ width: '100%' }} value={scope} onChange={(e) => setScope(e.target.value as LimitScope)}>
              {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {needCompany && (
            <div>
              <label className="fin-label" htmlFor="lim-company">Transporter</label>
              <select id="lim-company" className="fin-control" style={{ width: '100%' }} value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                <option value="">{transporters.isLoading ? 'Loading…' : 'Choose'}</option>
                {(transporters.data ?? []).map((t) => <option key={t.company_id} value={t.company_id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {needDebtor && (
            <div>
              <label className="fin-label" htmlFor="lim-debtor">Debtor</label>
              <select id="lim-debtor" className="fin-control" style={{ width: '100%' }} value={debtorId} onChange={(e) => setDebtorId(e.target.value)} required>
                <option value="">{debtors.isLoading ? 'Loading…' : 'Choose'}</option>
                {(debtors.data ?? []).map((d) => <option key={d.debtor_id} value={d.debtor_id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {scope === 'SECTOR' && (
            <div>
              <label className="fin-label" htmlFor="lim-sector">Sector</label>
              {sectors.length > 0 ? (
                <select id="lim-sector" className="fin-control" style={{ width: '100%' }} value={sector} onChange={(e) => setSector(e.target.value)} required>
                  <option value="">Choose</option>
                  {sectors.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input id="lim-sector" className="fin-control" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector code" required />
              )}
            </div>
          )}
        </div>
        <div className="cap-form-row">
          <div>
            <label className="fin-label" htmlFor="lim-amount">Limit (R)</label>
            <input id="lim-amount" className="fin-control" inputMode="decimal" value={useDefault ? '' : amount} disabled={useDefault}
              placeholder={useDefault ? 'Policy default' : 'e.g. 2 000 000'} onChange={(e) => setAmount(e.target.value)} />
            <label className="cap-check" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} />
              Use the policy default
            </label>
          </div>
          <div>
            <span className="fin-label">Hold</span>
            <label className="cap-check">
              <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} />
              Stop new advances
            </label>
          </div>
        </div>
        <div>
          <label className="fin-label" htmlFor="lim-reason">Reason</label>
          <textarea id="lim-reason" className="fin-control" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="cap-form-foot">
          <button type="submit" className="tw-btn tw-btn--primary" disabled={!valid || add.isPending}>{add.isPending ? 'Saving…' : hold ? 'Add hold' : 'Add limit'}</button>
        </div>
      </form>
    </section>
  );
}
