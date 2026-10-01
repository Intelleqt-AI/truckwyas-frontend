/**
 * Shared capital-desk pieces: the table card with its loading / error /
 * empty states, score cards, desk reasons, and the advance drawer with its
 * role-gated actions. Desk wording is shown here; it never reaches a
 * transporter screen.
 */
import { useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import '@/components/data/load-error.css';
import { formatNumber, formatPercentage } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { serverMessage, useDeskAdvance, useDeskAdvanceAction, type DeskAdvanceAction } from '@/lib/capital/api';
import type { DeskAdvance, DeskReason, DeskRole, ScoreSummary } from '@/lib/capital/types';
import { AdvanceChip, DecisionChip, Drawer, SkelCard, Timeline, day, dayTime, money, pct } from '../capitalUi';

export interface DeskCtx {
  funder: number | null;
  role: DeskRole | null;
}

/** PD is a fraction (0.034 = 3,4%). */
export const pd = (v: number | null | undefined) => (v == null ? '—' : formatPercentage(v, 2));
export const num = (v: number | null | undefined, d = 2) => (v == null ? '—' : formatNumber(v, { maximumFractionDigits: d }));

/**
 * A card holding one list: title, one-line subtitle, then a skeleton, the
 * load error, an empty line, or the content. The head is drawn at once.
 */
export function ListCard<T>({ title, sub, query, empty, isEmpty, children, actions, flush = true, id }: {
  title: ReactNode;
  sub?: ReactNode;
  query: UseQueryResult<T>;
  empty: string;
  isEmpty: (d: T) => boolean;
  children: (d: T) => ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  id: string;
}) {
  const failed = loadFailed(query);
  const pad = { padding: flush ? '0 var(--card-pad, 20px) var(--card-pad, 20px)' : 0 };
  return (
    <section className={`card${flush ? ' fin-table-card' : ''}`} aria-labelledby={id}>
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id={id} className="fin-panel-title">{title}</h2>
          {sub && <p className="fin-panel-desc">{sub}</p>}
        </div>
        {actions}
      </div>
      {query.isLoading && !failed ? (
        <div style={pad}><SkelCard height={160} /></div>
      ) : failed ? (
        <div style={pad}><LoadError compact what={typeof title === 'string' ? title.toLowerCase() : 'this list'} error={query.error ?? query.failureReason} busy={query.isFetching} onRetry={() => query.refetch()} /></div>
      ) : query.data === undefined || isEmpty(query.data) ? (
        <div className="fin-empty fin-empty--compact">{empty}</div>
      ) : (
        children(query.data)
      )}
    </section>
  );
}

const SEVERITY: Record<string, StatusTone> = { RED: 'danger', AMBER: 'warning', INFO: 'info' };
export function SeverityChip({ severity }: { severity: string }) {
  const label = severity === 'RED' ? 'Red' : severity === 'AMBER' ? 'Amber' : 'Info';
  return <StatusChip tone={SEVERITY[severity] ?? 'neutral'} label={label} size="sm" />;
}

const BAND: Record<string, StatusTone> = { green: 'success', amber: 'warning', red: 'danger', ok: 'success', soft: 'warning', hard: 'danger', watch: 'warning', breach: 'danger' };
export function BandChip({ band, label }: { band: string | null | undefined; label?: string }) {
  if (!band) return <StatusChip tone="neutral" label={label ?? 'No band'} size="sm" />;
  return <StatusChip tone={BAND[band] ?? 'neutral'} label={label ?? band.charAt(0).toUpperCase() + band.slice(1)} size="sm" />;
}

export function HoldChip({ hold }: { hold: boolean }) {
  return hold ? <StatusChip tone="danger" label="On hold" size="sm" /> : null;
}

/** Desk reasons: desk wording, its code, and the transporter wording when different. */
export function DeskReasonList({ reasons }: { reasons: DeskReason[] }) {
  if (!reasons?.length) return <p className="fin-note">No reasons recorded.</p>;
  return (
    <ul className="cap-reasons">
      {reasons.map((r, i) => (
        <li key={`${r.code}-${i}`}>
          <span className="cap-reasons__dir" data-dir={r.direction}>{r.direction === '-' ? '−' : r.direction}</span>
          <span>
            {r.text}<span className="cap-reasons__code">{r.code}</span>
            {r.transporter_text && r.transporter_text !== r.text && <span className="cap-sub">Transporter sees: {r.transporter_text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreCard({ title, score, extra }: { title: string; score: ScoreSummary | null; extra?: ReactNode }) {
  return (
    <div className="cap-score">
      <div className="cap-score__head">
        <p className="cap-score__title">{title}</p>
        <span className="cap-score__grade">{score?.grade ?? '—'}</span>
      </div>
      {score ? (
        <>
          <dl className="cap-score__facts">
            <div><dt>Points</dt><dd>{num(score.points, 0)}</dd></div>
            <div><dt>PD 12 months</dt><dd>{pd(score.pd_12m)}</dd></div>
            <div><dt>Expected days to pay</dt><dd>{score.expected_dtp_days != null ? num(score.expected_dtp_days, 0) : '—'}</dd></div>
            <div><dt>Model</dt><dd>{score.model_version || '—'}</dd></div>
          </dl>
          {(score.cold_start || score.hard_stop) && (
            <div className="cap-flags">
              {score.cold_start && <StatusChip tone="info" label="Cold start" size="sm" />}
              {score.hard_stop && <StatusChip tone="danger" label="Hard stop" size="sm" />}
            </div>
          )}
          {extra}
          <DeskReasonList reasons={score.reasons} />
          <p className="cap-sub">Scored {dayTime(score.created_at)}</p>
        </>
      ) : (
        <>
          {extra}
          <p className="fin-note">Not scored yet.</p>
        </>
      )}
    </div>
  );
}

/** Rows shared by the approvals, queue and payout tables. */
export function DeskAdvanceTable({ rows, onOpen, showQueue }: { rows: DeskAdvance[]; onOpen: (a: DeskAdvance) => void; showQueue?: boolean }) {
  return (
    <div className="fin-table-scroll">
      <table className="fin-table table-heading-roles">
        <thead>
          <tr>
            {showQueue && <th className="num">Position</th>}
            <th>Request</th>
            <th>Debtor</th>
            <th className="num">Advance</th>
            <th>Decision</th>
            <th>Grade</th>
            <th className="num">EL</th>
            <th className="num">Fraud</th>
            <th>Status</th>
            <th>{showQueue ? 'Queued' : 'Requested'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="is-clickable" tabIndex={0} onClick={() => onOpen(a)}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(a); } }}>
              {showQueue && <td className="num">{a.queue_position ?? '—'}</td>}
              <td className="fin-strong fin-cell-2">
                <span className="fin-id">{a.reference}</span>
                <span className="cap-sub">{a.company?.name}</span>
              </td>
              <td>{a.debtor?.name ?? a.customer_name}{a.debtor?.grade && <span className="cap-sub">Grade {a.debtor.grade}</span>}</td>
              <td className="num">{money(a.amount)}</td>
              <td><DecisionChip decision={a.decision} /></td>
              <td>{a.invoice_grade || '—'}</td>
              <td className="num">{pct(a.el_pct, 2)}</td>
              <td className="num">{num(a.fraud_score, 2)}</td>
              <td><AdvanceChip status={a.status} label={a.status_label} /></td>
              <td className="fin-date">{day(showQueue ? a.queued_at : a.requested_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Mode = null | 'approve' | 'decline' | 'disburse' | 'settle' | 'write-off';

/**
 * One advance for the desk: the evidence (decision, reasons, both scores)
 * and the actions this role may take at this status. The server enforces
 * every rule; its message is shown verbatim when it refuses.
 */
export function DeskAdvanceDrawer({ ctx, advance, onClose }: { ctx: DeskCtx; advance: DeskAdvance; onClose: () => void }) {
  const detail = useDeskAdvance(ctx.funder, advance.id);
  const act = useDeskAdvanceAction(ctx.funder);
  const a = detail.data ?? advance;
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [error, setError] = useState('');

  const staff = ctx.role === 'STAFF';
  const canDecide = ctx.role === 'STAFF' || ctx.role === 'APPROVER';
  const pending = a.status === 'REQUESTED' || a.status === 'SCORING';

  const open = (m: Mode) => { setMode(m); setText(''); setText2(''); setError(''); };

  const run = async () => {
    if (!mode) return;
    let body: DeskAdvanceAction;
    if (mode === 'approve') body = { action: 'approve', id: a.id, ...(text.trim() ? { notes: text.trim() } : {}) };
    else if (mode === 'decline') body = { action: 'decline', id: a.id, reason: text.trim() };
    else if (mode === 'disburse') body = { action: 'disburse', id: a.id, reference: text.trim() };
    else if (mode === 'settle') {
      const pid = Number(text2.trim());
      body = { action: 'settle', id: a.id, payment_reference: text.trim(), ...(text2.trim() && Number.isInteger(pid) ? { payment_id: pid } : {}) };
    } else body = { action: 'write-off', id: a.id, reason: text.trim() };
    setError('');
    try {
      await act.mutateAsync(body);
      toast.success(`${a.reference}: ${mode === 'write-off' ? 'written off' : mode === 'settle' ? 'settled' : mode === 'disburse' ? 'paid out' : mode === 'approve' ? 'approved' : 'declined'}`);
      setMode(null);
      detail.refetch();
    } catch (e) {
      setError(serverMessage(e, 'The action failed. Try again.'));
    }
  };

  const FORMS: Record<Exclude<Mode, null>, { label: string; field: string; required: boolean; confirm: string; second?: string }> = {
    approve: { label: 'Approve', field: 'Notes (optional)', required: false, confirm: 'Approve advance' },
    decline: { label: 'Decline', field: 'Reason', required: true, confirm: 'Decline advance' },
    disburse: { label: 'Mark paid out', field: 'Payment reference', required: true, confirm: 'Mark paid out' },
    settle: { label: 'Settle', field: 'Payment reference', required: true, confirm: 'Settle advance', second: 'Payment id (optional)' },
    'write-off': { label: 'Write off', field: 'Reason', required: true, confirm: 'Write off' },
  };
  const f = mode ? FORMS[mode] : null;
  const valid = !!f && (!f.required || text.trim().length > 0);

  return (
    <Drawer
      title={<>{a.reference} <span style={{ verticalAlign: 'middle' }}><AdvanceChip status={a.status} label={a.status_label} /></span></>}
      sub={<>{a.company?.name} · {a.debtor?.name ?? a.customer_name} · invoice {a.invoice_number}</>}
      onClose={onClose}
      busy={act.isPending}
    >
      <div className="cap-drawer__section">
        <dl className="cap-facts">
          <div><dt>Advance</dt><dd>{money(a.amount)}</dd></div>
          <div><dt>Fee, excl. VAT</dt><dd>{money(a.fee_amount)}</dd></div>
          <div><dt>Net to transporter</dt><dd>{money(a.net_amount)}</dd></div>
          <div><dt>Holdback</dt><dd>{money(a.holdback_amount)}</dd></div>
          <div><dt>Decision</dt><dd><DecisionChip decision={a.decision} /></dd></div>
          <div><dt>Invoice grade</dt><dd>{a.invoice_grade || '—'}</dd></div>
          <div><dt>Expected loss</dt><dd>{pct(a.el_pct, 2)}</dd></div>
          <div><dt>Fraud score</dt><dd>{num(a.fraud_score, 2)}</dd></div>
          {a.topup_pending > 0 && <div><dt>Top-up pending</dt><dd>{money(a.topup_pending)}</dd></div>}
          {a.queue_position != null && <div><dt>Queue position</dt><dd>{a.queue_position}</dd></div>}
          <div><dt>Approver</dt><dd>{a.approver_label || '—'}</dd></div>
          {a.approved_by && <div><dt>Approved by</dt><dd>{a.approved_by}</dd></div>}
          {a.disbursed_by && <div><dt>Paid out by</dt><dd>{a.disbursed_by}</dd></div>}
        </dl>
        {a.denial_reason && <p className="fin-note"><strong>Decline reason</strong>{a.denial_reason}</p>}
      </div>

      <div className="cap-drawer__section">
        <h3>Desk reasons</h3>
        <DeskReasonList reasons={a.desk_reasons} />
      </div>

      <div className="cap-drawer__section">
        <h3>Scores</h3>
        <div className="cap-grid">
          <ScoreCard title="Debtor" score={a.debtor_score} />
          <ScoreCard title="Transporter" score={a.transporter_score} />
        </div>
      </div>

      <div className="cap-drawer__section">
        <h3>Timeline</h3>
        <Timeline entries={a.timeline} />
      </div>

      {detail.data?.assessment && (
        <details className="cap-details">
          <summary>Full decision record{a.assessment_id ? ` #${a.assessment_id}` : ''}</summary>
          <pre className="cap-pre">{JSON.stringify(detail.data.assessment, null, 2)}</pre>
        </details>
      )}

      {(canDecide && pending) || (staff && (a.status === 'APPROVED' || a.status === 'DISBURSED')) ? (
        <div className="cap-drawer__actions">
          {f ? (
            <form className="fin-form" onSubmit={(e) => { e.preventDefault(); if (valid) run(); }}>
              <div>
                <label className="fin-label" htmlFor="desk-act-1">{f.field}</label>
                {mode === 'approve' || mode === 'decline' || mode === 'write-off'
                  ? <textarea id="desk-act-1" className="fin-control" rows={3} value={text} onChange={(e) => setText(e.target.value)} required={f.required} data-autofocus />
                  : <input id="desk-act-1" className="fin-control" value={text} onChange={(e) => setText(e.target.value)} required={f.required} data-autofocus />}
              </div>
              {f.second && (
                <div>
                  <label className="fin-label" htmlFor="desk-act-2">{f.second}</label>
                  <input id="desk-act-2" className="fin-control" inputMode="numeric" value={text2} onChange={(e) => setText2(e.target.value)} />
                </div>
              )}
              {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
              <div className="cap-drawer__btns">
                <button type="button" className="tw-btn" onClick={() => setMode(null)} disabled={act.isPending}>Back</button>
                <button type="submit" className="tw-btn tw-btn--primary" disabled={!valid || act.isPending}>{act.isPending ? 'Working…' : f.confirm}</button>
              </div>
            </form>
          ) : (
            <div className="cap-drawer__btns">
              {canDecide && pending && <>
                <button type="button" className="tw-btn" onClick={() => open('decline')}>Decline</button>
                <button type="button" className="tw-btn tw-btn--primary" onClick={() => open('approve')}>Approve</button>
              </>}
              {staff && a.status === 'APPROVED' && <button type="button" className="tw-btn tw-btn--primary" onClick={() => open('disburse')}>Mark paid out</button>}
              {staff && a.status === 'DISBURSED' && <>
                <button type="button" className="tw-btn" onClick={() => open('write-off')}>Write off</button>
                <button type="button" className="tw-btn tw-btn--primary" onClick={() => open('settle')}>Settle</button>
              </>}
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
