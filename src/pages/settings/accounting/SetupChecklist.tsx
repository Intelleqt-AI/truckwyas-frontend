import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { missingMappingLabel, providerConfig, type Connection } from '@/lib/accounting';
import { AcctCard, StepIcon, plural, type StepLook } from './shared';
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
      look: connection.status === 'ACTIVE' ? 'done' : 'bad',
      title: `Connect ${cfg.short}`,
      desc: connection.status === 'ACTIVE'
        ? `Linked to ${connection.tenant_name}.`
        : `${cfg.short} needs an admin to reconnect before anything else can happen.`,
    },
    {
      key: 'mapping',
      look: r.mapping_complete ? 'done' : 'todo',
      title: 'Map accounts and VAT',
      desc: r.mapping_complete
        ? 'Every revenue type, expense category and VAT code has a home.'
        : missing.length
          ? `Still to map: ${missing.slice(0, 4).map(missingMappingLabel).join(', ')}${missing.length > 4 ? ` and ${missing.length - 4} more` : ''}.`
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
        : `${plural(r.contacts_to_confirm, 'contact')} matched on name only. Confirm or change them so invoices land on the right account.`,
      tab: 'contacts',
      action: r.contacts_to_confirm === 0 ? 'Review' : 'Confirm contacts',
    },
    {
      key: 'cutover',
      look: backfillLook,
      title: 'Choose a cut-over date and send history',
      desc: r.backfill_state === 'DONE'
        ? `Documents from ${connection.cutover_date ?? 'the cut-over date'} onwards are in ${cfg.short}.`
        : r.backfill_state === 'RUNNING'
          ? `Sending documents to ${cfg.short} now.`
          : r.backfill_state === 'FAILED'
            ? 'The first send stopped part-way. Open it to see what went wrong and try again.'
            : `Documents dated on or after this date are sent to ${cfg.short}; anything earlier is assumed to be in your books already.`,
      tab: 'cutover',
      action: r.backfill_state === 'DONE' ? 'View' : r.backfill_state === 'RUNNING' ? 'Watch progress' : 'Choose date',
    },
    {
      key: 'live',
      look: r.sync_enabled ? 'done' : 'todo',
      title: 'Sync switched on',
      desc: r.sync_enabled
        ? `New invoices, credit notes and bills go to ${cfg.short} on their own, and payments come back every few minutes.`
        : 'Switches on by itself once the steps above are done.',
      tab: r.sync_enabled ? 'sync' : undefined,
      action: r.sync_enabled ? 'Sync status' : undefined,
    },
  ];

  return (
    <>
      {r.blocking_reasons.length > 0 ? (
        <div className="acct-notice acct-notice--warning" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Nothing is sent to {cfg.short} yet</strong>
            <ul>{r.blocking_reasons.map(b => <li key={b}>{b}</li>)}</ul>
          </div>
        </div>
      ) : r.sync_enabled ? (
        <div className="acct-notice acct-notice--success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>Sync is on</strong>
            {cfg.short} now keeps the books; record customer payments there and they show up here.
          </div>
        </div>
      ) : null}
      <AcctCard title="Setup" description={`Five steps, once. After that ${cfg.short} and TruckWys stay in step on their own.`} flush>
        <ol className="acct-check">
          {items.map(it => (
            <li key={it.key}>
              <StepIcon look={it.look} />
              <div style={{ minWidth: 0 }}>
                <div className="acct-check__title">{it.title}</div>
                <div className="acct-check__desc">{it.desc}</div>
              </div>
              {it.tab && it.action ? (
                <button type="button" className={`tw-btn${it.look === 'done' ? '' : ' tw-btn--primary'}`} onClick={() => onOpen(it.tab!)}>
                  {it.action}
                </button>
              ) : <span />}
            </li>
          ))}
        </ol>
      </AcctCard>
    </>
  );
}
