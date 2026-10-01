import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { KpiStats } from '@/components/ui/KpiTile';
import { toast } from '@/lib/toast';
import {
  serverMessage, useDeskAdvances, useDeskAlerts, useDeskApprovals, useDeskLedger, useDeskQueue, useResolveAlert,
} from '@/lib/capital/api';
import type { DeskAdvance } from '@/lib/capital/types';
import { dayTime, money } from '../capitalUi';
import { DeskAdvanceDrawer, DeskAdvanceTable, ListCard, SeverityChip, type DeskCtx } from './common';

/** Pending decisions first; then, for staff, what is approved and waiting to be paid out or settled. */
export function ApprovalsTab({ ctx }: { ctx: DeskCtx }) {
  const pending = useDeskApprovals(ctx.funder);
  const approved = useDeskAdvances(ctx.funder, 'APPROVED');
  const disbursed = useDeskAdvances(ctx.funder, 'DISBURSED');
  const [open, setOpen] = useState<DeskAdvance | null>(null);
  const isEmpty = (d: DeskAdvance[]) => d.length === 0;

  return (
    <div className="fin-stack fin-stack--16">
      {open && <DeskAdvanceDrawer ctx={ctx} advance={open} onClose={() => setOpen(null)} />}
      <ListCard id="ap-pending" title="Waiting for a decision" sub="Oldest first" query={pending} empty="Nothing is waiting for a decision" isEmpty={isEmpty}>
        {(rows) => <DeskAdvanceTable rows={rows} onOpen={setOpen} />}
      </ListCard>
      <ListCard id="ap-approved" title="Approved, to pay out" sub={ctx.role === 'STAFF' ? 'Pay out, then record the reference' : 'Paid out by TruckWys staff'} query={approved} empty="Nothing is waiting to be paid out" isEmpty={isEmpty}>
        {(rows) => <DeskAdvanceTable rows={rows} onOpen={setOpen} />}
      </ListCard>
      <ListCard id="ap-disbursed" title="Paid out, awaiting the customer" sub="Settle when the customer's payment lands" query={disbursed} empty="No advances are paid out and open" isEmpty={isEmpty}>
        {(rows) => <DeskAdvanceTable rows={rows} onOpen={setOpen} />}
      </ListCard>
    </div>
  );
}

export function QueueTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskQueue(ctx.funder);
  const [open, setOpen] = useState<DeskAdvance | null>(null);
  return (
    <>
      {open && <DeskAdvanceDrawer ctx={ctx} advance={open} onClose={() => setOpen(null)} />}
      <ListCard id="queue" title="Waiting for capacity" sub="By priority; expires after 5 business days" query={q} empty="The queue is empty" isEmpty={(d) => d.length === 0}>
        {(rows) => <DeskAdvanceTable rows={rows} onOpen={setOpen} showQueue />}
      </ListCard>
    </>
  );
}

export function AlertsTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskAlerts(ctx.funder);
  const resolve = useResolveAlert(ctx.funder);
  const canResolve = ctx.role === 'STAFF' || ctx.role === 'APPROVER';
  const onResolve = async (id: number) => {
    try {
      await resolve.mutateAsync(id);
      toast.success('Alert resolved');
    } catch (e) {
      toast.error(serverMessage(e, 'The alert could not be resolved. Try again.'));
    }
  };
  return (
    <ListCard id="alerts" title="Open alerts" sub="Newest first" query={q} empty="No open alerts" isEmpty={(d) => d.length === 0}>
      {(rows) => (
        <div className="fin-table-scroll">
          <table className="fin-table table-heading-roles">
            <thead><tr><th>Severity</th><th>Alert</th><th>Opened</th>{canResolve && <th className="cap-actions"><span className="fin-sr">Action</span></th>}</tr></thead>
            <tbody>
              {[...rows].sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).map((a) => (
                <tr key={a.id}>
                  <td><SeverityChip severity={a.severity} /></td>
                  <td className="fin-cell-2" style={{ minWidth: 240 }}>
                    <span className="fin-strong">{a.title}</span>
                    {a.message && <span className="cap-sub" style={{ whiteSpace: 'normal' }}>{a.message}</span>}
                  </td>
                  <td className="fin-date">{dayTime(a.opened_at)}</td>
                  {canResolve && (
                    <td className="cap-actions">
                      <button type="button" className="tw-btn cap-row-btn" onClick={() => onResolve(a.id)}
                        disabled={resolve.isPending && resolve.variables === a.id}>
                        {resolve.isPending && resolve.variables === a.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListCard>
  );
}
const sevRank = (s: string) => (s === 'RED' ? 0 : s === 'AMBER' ? 1 : 2);

export function LedgerTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskLedger(ctx.funder);
  const d = q.data;
  return (
    <div className="fin-stack fin-stack--16">
      {d && (
        <KpiStats
          aria-label="Ledger balances"
          items={[
            { label: 'Outstanding', figure: money(d.balances.outstanding) },
            { label: 'Reserved', figure: money(d.balances.reserved) },
            { label: 'Committed', figure: money(d.balances.committed) },
          ]}
        />
      )}
      {d && (d.reconciliation.ok ? (
        <div className="fl-notice" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div><strong>Reconciled</strong>Every facility's cached balance matches the ledger.</div>
        </div>
      ) : (
        <section className="card fin-table-card" aria-labelledby="led-breaks">
          <div className="fl-notice fl-notice--danger" role="alert" style={{ margin: 'var(--card-pad, 20px) var(--card-pad, 20px) 0' }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div><strong id="led-breaks">Reconciliation breaks</strong>{d.reconciliation.breaks.length} cached {d.reconciliation.breaks.length === 1 ? 'balance differs' : 'balances differ'} from the ledger.</div>
          </div>
          <div className="fin-table-scroll" style={{ marginTop: 12 }}>
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Facility</th><th>Company</th><th>Field</th><th className="num">Ledger</th><th className="num">Cached</th></tr></thead>
              <tbody>
                {d.reconciliation.breaks.map((b, i) => (
                  <tr key={`${b.facility_id}-${b.field}-${i}`}>
                    <td className="fin-id">{b.facility_id}</td><td>{b.company}</td><td>{b.field}</td>
                    <td className="num">{money(b.ledger)}</td><td className="num">{money(b.cached)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <ListCard id="ledger" title="Ledger entries" sub="Latest 200, newest first" query={q} empty="No ledger entries yet" isEmpty={(x) => x.entries.length === 0}>
        {(x) => (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr><th>When</th><th>Entry</th><th className="num">Amount</th><th className="num">Reserved Δ</th><th className="num">Outstanding Δ</th><th>Advance</th><th>Company</th><th>Debtor</th><th>By</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {x.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="fin-date">{dayTime(e.created_at)}</td>
                    <td>{e.entry_type}{e.memo && <span className="cap-sub">{e.memo}</span>}</td>
                    <td className="num">{money(e.amount)}</td>
                    <td className="num">{money(e.reserved_delta)}</td>
                    <td className="num">{money(e.outstanding_delta)}</td>
                    <td className="fin-id">{e.advance_reference ?? '—'}{e.invoice_number && <span className="cap-sub">{e.invoice_number}</span>}</td>
                    <td>{e.company ?? '—'}</td>
                    <td>{e.debtor ?? '—'}</td>
                    <td>{e.actor ?? '—'}</td>
                    <td className="fin-id">{e.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListCard>
    </div>
  );
}
