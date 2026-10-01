import { useState } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import {
  useDeskDebtor, useDeskDebtors, useDeskTransporter, useDeskTransporters,
} from '@/lib/capital/api';
import type { DebtorCard, LimitHistoryEntry, ScoreHistoryEntry, TransporterCard } from '@/lib/capital/types';
import { CapBar, Drawer, SkelCard, day, dayTime, money } from '../capitalUi';
import { HoldChip, ListCard, ScoreCard, num, pd, type DeskCtx } from './common';

const statusLabel = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—');

export function DebtorsTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskDebtors(ctx.funder);
  const [open, setOpen] = useState<DebtorCard | null>(null);
  return (
    <>
      {open && <DebtorDrawer ctx={ctx} card={open} onClose={() => setOpen(null)} />}
      <ListCard id="debtors" title="Debtors" sub="With exposure or a score" query={q} empty="No debtors scored yet" isEmpty={(d) => d.length === 0}>
        {(rows) => (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr><th>Debtor</th><th>Grade</th><th className="num">PD</th><th className="num">Days to pay</th><th className="num">Exposure</th><th className="num">Cap</th><th style={{ minWidth: 120 }}>Used</th><th>Flags</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.debtor_id} className="is-clickable" tabIndex={0} onClick={() => setOpen(d)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(d); } }}>
                    <td className="fin-strong">{d.name}<span className="cap-sub">{d.sector_label || d.sector}{d.is_government ? ' · government' : ''}{d.country && d.country !== 'ZA' ? ` · ${d.country}` : ''}</span></td>
                    <td>{d.score?.grade ?? '—'}</td>
                    <td className="num">{pd(d.score?.pd_12m)}</td>
                    <td className="num">{d.score?.expected_dtp_days != null ? num(d.score.expected_dtp_days, 0) : '—'}</td>
                    <td className="num">{money(d.exposure)}</td>
                    <td className="num">{money(d.cap)}</td>
                    <td><CapBar value={d.exposure} cap={d.cap} /></td>
                    <td><Flags hold={d.hold} cold={d.score?.cold_start} stop={d.score?.hard_stop} /></td>
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

export function TransportersTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskTransporters(ctx.funder);
  const [open, setOpen] = useState<TransporterCard | null>(null);
  return (
    <>
      {open && <TransporterDrawer ctx={ctx} card={open} onClose={() => setOpen(null)} />}
      <ListCard id="transporters" title="Transporters" sub="Score, line and exposure" query={q} empty="No transporters yet" isEmpty={(d) => d.length === 0}>
        {(rows) => (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr><th>Transporter</th><th>Application</th><th>Grade</th><th className="num">PD</th><th className="num">Exposure</th><th className="num">Line</th><th style={{ minWidth: 120 }}>Used</th><th>Flags</th></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.company_id} className="is-clickable" tabIndex={0} onClick={() => setOpen(t)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(t); } }}>
                    <td className="fin-strong">{t.name}</td>
                    <td>{statusLabel(t.application_status)}</td>
                    <td>{t.score?.grade ?? '—'}</td>
                    <td className="num">{pd(t.score?.pd_12m)}</td>
                    <td className="num">{money(t.exposure)}</td>
                    <td className="num">{money(t.line_limit)}</td>
                    <td><CapBar value={t.exposure} cap={t.line_limit} /></td>
                    <td><Flags hold={t.hold} cold={t.score?.cold_start} stop={t.score?.hard_stop} /></td>
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

function Flags({ hold, cold, stop }: { hold: boolean; cold?: boolean; stop?: boolean }) {
  if (!hold && !cold && !stop) return <span className="cap-muted">—</span>;
  return (
    <span className="cap-flags">
      <HoldChip hold={hold} />
      {cold && <StatusChip tone="info" label="Cold start" size="sm" />}
      {stop && <StatusChip tone="danger" label="Hard stop" size="sm" />}
    </span>
  );
}

function DebtorDrawer({ ctx, card, onClose }: { ctx: DeskCtx; card: DebtorCard; onClose: () => void }) {
  const q = useDeskDebtor(ctx.funder, card.debtor_id);
  const d = q.data ?? card;
  return (
    <Drawer title={d.name} sub={<>{d.sector_label || d.sector}{d.registration_number ? ` · ${d.registration_number}` : ''}{d.vat_number ? ` · VAT ${d.vat_number}` : ''}</>} onClose={onClose}>
      <div className="cap-drawer__section">
        <dl className="cap-facts">
          <div><dt>Exposure</dt><dd>{money(d.exposure)}</dd></div>
          <div><dt>Cap</dt><dd>{money(d.cap)}</dd></div>
          <div><dt>CIPC</dt><dd>{statusLabel(d.cipc_status)}</dd></div>
          <div><dt>Cession</dt><dd>{statusLabel(d.cession_status)}</dd></div>
          <div><dt>Government</dt><dd>{d.is_government ? 'Yes' : 'No'}</dd></div>
          <div><dt>Country</dt><dd>{d.country || '—'}</dd></div>
        </dl>
        <CapBar value={d.exposure} cap={d.cap} large label={`Exposure ${money(d.exposure)} of cap ${money(d.cap)}`} />
        {d.hold && <p className="fin-note"><strong>On hold</strong>{d.hold_reason || 'No reason recorded.'}</p>}
      </div>
      <div className="cap-drawer__section">
        <h3>Current score</h3>
        <ScoreCard title="Debtor" score={d.score} />
      </div>
      <DetailHistory q={q} transporters={q.data?.transporters} />
    </Drawer>
  );
}

function TransporterDrawer({ ctx, card, onClose }: { ctx: DeskCtx; card: TransporterCard; onClose: () => void }) {
  const q = useDeskTransporter(ctx.funder, card.company_id);
  const t = q.data ?? card;
  return (
    <Drawer title={t.name} sub={`Application: ${statusLabel(t.application_status)}`} onClose={onClose}>
      <div className="cap-drawer__section">
        <dl className="cap-facts">
          <div><dt>Exposure</dt><dd>{money(t.exposure)}</dd></div>
          <div><dt>Line</dt><dd>{money(t.line_limit)}</dd></div>
          <div><dt>Hold</dt><dd>{t.hold ? 'On hold' : 'No'}</dd></div>
        </dl>
        <CapBar value={t.exposure} cap={t.line_limit} large label={`Exposure ${money(t.exposure)} of line ${money(t.line_limit)}`} />
      </div>
      <div className="cap-drawer__section">
        <h3>Current score</h3>
        <ScoreCard title="Transporter" score={t.score} />
      </div>
      <DetailHistory q={q} />
    </Drawer>
  );
}

function DetailHistory({ q, transporters }: {
  q: { isLoading: boolean; data?: { score_history: ScoreHistoryEntry[]; limit_history: LimitHistoryEntry[] }; error: unknown; failureReason: unknown; isFetching: boolean; refetch: () => unknown; isError: boolean; failureCount: number };
  transporters?: { company: string; exposure: number }[];
}) {
  if (loadFailed(q)) return <LoadError compact what="the history" error={q.error ?? q.failureReason} busy={q.isFetching} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <SkelCard height={160} label="Loading history" />;
  const { score_history: scores, limit_history: limits } = q.data;
  return (
    <>
      {transporters && transporters.length > 0 && (
        <div className="cap-drawer__section">
          <h3>Exposure by transporter</h3>
          <dl className="fin-dl">
            {transporters.map((t) => <div key={t.company} className="fin-dl__row"><dt>{t.company}</dt><dd>{money(t.exposure)}</dd></div>)}
          </dl>
        </div>
      )}
      <div className="cap-drawer__section">
        <h3>Score history</h3>
        {scores.length === 0 ? <p className="fin-note">No earlier scores.</p> : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Scored</th><th>Grade</th><th className="num">Points</th><th className="num">PD</th><th className="num">Days to pay</th><th>Model</th></tr></thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={`${s.created_at}-${i}`}>
                    <td className="fin-date">{day(s.created_at)}</td>
                    <td>{s.grade ?? '—'}{s.hard_stop ? <span className="cap-sub">Hard stop</span> : s.cold_start ? <span className="cap-sub">Cold start</span> : null}</td>
                    <td className="num">{num(s.points, 0)}</td>
                    <td className="num">{pd(s.pd_12m)}</td>
                    <td className="num">{s.expected_dtp_days != null ? num(s.expected_dtp_days, 0) : '—'}</td>
                    <td>{s.model_version ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="cap-drawer__section">
        <h3>Limit history</h3>
        {limits.length === 0 ? <p className="fin-note">No limit changes. The policy default applies.</p> : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>When</th><th className="num">Limit</th><th>Hold</th><th>Reason</th><th>By</th></tr></thead>
              <tbody>
                {limits.map((l, i) => (
                  <tr key={`${l.id ?? i}`}>
                    <td className="fin-date">{dayTime(l.created_at)}</td>
                    <td className="num">{l.amount == null ? 'Policy default' : money(l.amount)}</td>
                    <td>{l.hold ? 'Yes' : 'No'}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{l.reason || '—'}</td>
                    <td>{l.created_by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
