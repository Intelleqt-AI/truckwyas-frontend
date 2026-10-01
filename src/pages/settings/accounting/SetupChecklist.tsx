import { Check, Loader2, X } from 'lucide-react';
import { providerConfig, type Connection } from '@/lib/accounting';
import { formatDate } from '@/lib/formatters';
import { ConnectionDetails } from './ConnectionHeader';
import { AcctCard, plural, type StepLook } from './shared';
import type { AccountingTab } from './tabs';

/** What still has to happen before documents start flowing, in order. */
export function SetupChecklist({ connection, onOpen }: { connection: Connection; onOpen: (tab: AccountingTab) => void }) {
  const cfg = providerConfig(connection.provider);
  const r = connection.readiness;
  const missing = r.missing_mappings ?? [];
  const backfillLook: StepLook = r.backfill_state === 'DONE' ? 'done' : r.backfill_state === 'RUNNING' ? 'busy' : r.backfill_state === 'FAILED' ? 'bad' : 'todo';

  const items: { key: string; look: StepLook; title: string; desc: string; tab?: AccountingTab; action?: string }[] = [
    {
      key: 'connect',
      look: 'done',
      title: `Connect ${cfg.short}`,
      desc: true
        ? `Connected${connection.connected_by ? ` by ${connection.connected_by}` : ''}${connection.connected_at ? ` on ${formatDate(connection.connected_at)}` : ''}. Books in ${connection.base_currency || 'ZAR'}.`
        : `Use Reconnect ${cfg.short} above.`,
    },
    {
      key: 'mapping',
      look: r.mapping_complete ? 'done' : 'todo',
      title: 'Map accounts and VAT',
      desc: r.mapping_complete
        ? 'Every revenue type, expense category and VAT code has a home.'
        : missing.length
          ? `${missing.length} still to map.`
          : 'Tell TruckWys which account and VAT rate to use for each kind of charge.',
      tab: 'mapping',
      action: r.mapping_complete ? 'Review' : 'Map accounts',
    },
    {
      key: 'contacts',
      look: r.contacts_to_confirm === 0 ? 'done' : 'todo',
      title: 'Confirm contacts',
      desc: r.contacts_to_confirm === 0
        ? `Customers and suppliers are linked to their ${cfg.short} contacts.`
        : `${plural(r.contacts_to_confirm, 'contact')} to check.`,
      tab: 'contacts',
      action: r.contacts_to_confirm === 0 ? 'Review' : 'Confirm contacts',
    },
    {
      key: 'cutover',
      look: backfillLook,
      title: 'Choose a cut-over date',
      desc: r.backfill_state === 'DONE'
        ? `Documents from ${connection.cutover_date ?? 'the cut-over date'} onwards are in ${cfg.short}.`
        : r.backfill_state === 'RUNNING'
          ? `Sending documents to ${cfg.short} now.`
          : r.backfill_state === 'FAILED'
            ? 'The first send stopped part-way. Open it to see what went wrong and try again.'
            : `Earlier documents are assumed to be in ${cfg.short} already.`,
      tab: 'cutover',
      action: r.backfill_state === 'DONE' ? 'View' : r.backfill_state === 'RUNNING' ? 'Watch progress' : 'Choose date',
    },
    {
      key: 'live',
      look: r.sync_enabled ? 'done' : 'todo',
      title: 'Sync turns on',
      desc: r.sync_enabled
        ? `New invoices, credit notes and bills go to ${cfg.short} on their own, and payments come back every few minutes.`
        : 'Starts by itself once the steps above are done.',
      tab: r.sync_enabled ? 'sync' : undefined,
      action: r.sync_enabled ? 'Sync status' : undefined,
    },
  ];

  // Only the next step to do gets the primary button; while the sign-in has
  // expired, Reconnect (in the header) is the only one and the rest wait.
  const reauth = connection.status !== 'ACTIVE';
  const nextKey = reauth ? undefined : items.find(it => it.look !== 'done' && it.tab && it.action)?.key;
  const open = items.filter(it => it.look !== 'done' && it.key !== 'live' && it.key !== 'connect').map(it => items.indexOf(it) + 1);
  const subtitle = r.sync_enabled
    ? `Done. ${cfg.short} and TruckWys now stay in step on their own.`
    : reauth
      ? 'Steps unlock after you reconnect.'
      : open.length
        ? `Nothing is sent to ${cfg.short} until ${open.length === 1 ? `step ${open[0]} is` : `steps ${open[0]}–${open[open.length - 1]} are`} done. You only do this once.`
        : `Sending your history to ${cfg.short}.`;

  return (
    <>
    <AcctCard title={r.sync_enabled ? `${cfg.short} is set up` : `Finish setting up ${cfg.short}`} description={subtitle} flush>
      <ol className="acct-check acct-check--steps">
        {items.map((it, i) => {
          const auto = it.key === 'live';
          const blocked = reauth;
          return (
            <li key={it.key} className={blocked && it.key !== 'connect' ? 'is-blocked' : undefined}>
              <StepMarker look={it.look} n={i + 1} auto={auto} />
              <div style={{ minWidth: 0 }}>
                <div className="acct-check__title"><span className="acct-sr">Step {i + 1}: </span>{it.title}</div>
                <div className="acct-check__desc">{it.desc}</div>
              </div>
              {it.tab && it.action && !(blocked && it.look !== 'done') ? (
                <button type="button" className={`tw-btn${it.key === nextKey ? ' tw-btn--primary' : ''}`} onClick={() => onOpen(it.tab!)}>
                  {it.action}
                </button>
              ) : <span />}
            </li>
          );
        })}
      </ol>
    </AcctCard>
    <ConnectionDetails connection={connection} />
    </>
  );
}

/** One 20px marker for every state, so the list reads as one component. */
function StepMarker({ look, n, auto }: { look: StepLook; n: number; auto: boolean }) {
  if (look === 'done') return <span className="acct-step-num is-done" aria-hidden="true"><Check size={12} strokeWidth={2.5} /></span>;
  if (look === 'warn') return <span className="acct-step-num is-warn" aria-hidden="true">!</span>;
  if (look === 'bad') return <span className="acct-step-num is-bad" aria-hidden="true"><X size={12} strokeWidth={2.5} /></span>;
  if (look === 'busy') return <span className="acct-step-num is-busy" aria-hidden="true"><Loader2 size={12} className="animate-spin" /></span>;
  return <span className={`acct-step-num${auto ? ' is-auto' : ''}`} aria-hidden="true">{n}</span>;
}
