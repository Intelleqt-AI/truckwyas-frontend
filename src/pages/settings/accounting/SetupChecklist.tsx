import { useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, X, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { ACCT_KEYS, accountingApi, apiMessage, invalidateAccounting, providerBlockers, providerConfig, type Connection } from '@/lib/accounting';
import { formatDate } from '@/lib/formatters';
import { ConnectionDetails } from './ConnectionHeader';
import { AcctCard, plural, useAccountingPermissions, type StepLook } from './shared';
import type { AccountingTab } from './tabs';

/** What still has to happen before documents start flowing, in order. */
export function SetupChecklist({ connection, onOpen }: { connection: Connection; onOpen: (tab: AccountingTab) => void }) {
  const cfg = providerConfig(connection.provider);
  const { canWrite } = useAccountingPermissions();
  const r = connection.readiness;
  const missing = r.missing_mappings ?? [];
  const backfillLook: StepLook = r.backfill_state === 'DONE' ? 'done' : r.backfill_state === 'RUNNING' ? 'busy' : r.backfill_state === 'FAILED' ? 'bad' : 'todo';

  const items: { key: string; look: StepLook; title: string; desc: string; tab?: AccountingTab; action?: string }[] = [
    {
      key: 'connect',
      look: connection.status === 'ACTIVE' ? 'done' : 'bad',
      title: connection.status === 'ACTIVE' ? `Connect ${cfg.short}` : `Reconnect ${cfg.short}`,
      desc: connection.status !== 'ACTIVE'
        ? (canWrite ? `Sign-in expired. Use Reconnect ${cfg.short} above.` : 'Sign-in expired. Only a company admin can reconnect.')
        : `Connected${connection.connected_by ? ` by ${connection.connected_by}` : ''}${connection.connected_at ? ` on ${formatDate(connection.connected_at)}` : ''}. Books in ${connection.base_currency || 'ZAR'}.`,
    },
    {
      key: 'mapping',
      look: r.mapping_complete ? 'done' : 'todo',
      title: 'Map accounts and VAT',
      desc: r.mapping_complete
        ? 'Every charge, expense and VAT rate is mapped.'
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
      title: 'Choose a start date',
      desc: r.backfill_state === 'DONE'
        ? `Start date ${connection.cutover_date ? formatDate(connection.cutover_date) : 'set'}. Earlier history has been sent.`
        : r.backfill_state === 'RUNNING'
          ? `Sending documents to ${cfg.short} now.`
          : r.backfill_state === 'FAILED'
            ? 'The first send stopped part-way. Open it to see what went wrong and try again.'
            : `Anything dated before it should already be in ${cfg.short}.`,
      tab: 'cutover',
      action: r.backfill_state === 'DONE' ? 'View' : r.backfill_state === 'RUNNING' ? 'Watch progress' : 'Choose start date',
    },
    {
      key: 'live',
      look: r.sync_enabled ? 'done' : 'todo',
      title: 'Sync starts',
      desc: r.sync_enabled
        ? `New invoices, credit notes and bills go to ${cfg.short} on their own, and payments come back every few minutes.`
        : providerBlockers(r).length && connection.status === 'ACTIVE' && !items0Open(r)
          ? `Starts once the ${cfg.short} setting above is changed.`
          : 'Automatically, once the steps above are done.',
      tab: r.sync_enabled ? 'sync' : undefined,
      action: r.sync_enabled ? 'Sync status' : undefined,
    },
  ];

  // Only the next step to do gets the primary button; while the sign-in has
  // expired, Reconnect (in the header) is the only one and the rest wait.
  const reauth = connection.status !== 'ACTIVE';
  const nextKey = reauth ? undefined : items.find(it => it.look !== 'done' && it.tab && it.action)?.key;
  const open = items.filter(it => it.look !== 'done' && it.key !== 'live' && it.key !== 'connect').map(it => items.indexOf(it) + 1);
  const blockers = reauth ? [] : providerBlockers(r);
  const subtitle = blockers.length && !open.length
    ? `Everything in TruckWys is done. Nothing new is sent until the ${cfg.short} ${blockers.length === 1 ? 'setting' : 'settings'} below ${blockers.length === 1 ? 'is' : 'are'} changed.`
    : r.sync_enabled
    ? `Done. ${cfg.short} and TruckWys now stay in step on their own.`
    : reauth
      ? `Steps 2–${items.length} wait until ${cfg.short} is reconnected.`
      : open.length
        ? `One-time setup. Nothing is sent to ${cfg.short} until ${open.length === 1 ? `step ${open[0]} is` : `steps ${open[0]}–${open[open.length - 1]} are`} done${blockers.length ? ' and the setting below is changed' : ''}.`
        : `Sending your history to ${cfg.short}.`;

  return (
    <>
    <AcctCard title={r.sync_enabled ? `${cfg.short} is set up` : blockers.length && !open.length ? `One change needed in ${cfg.short}` : `Finish setting up ${cfg.short}`} description={subtitle} flush>
      {blockers.length > 0 && <ProviderBlockers connection={connection} blockers={blockers} />}
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
                <button type="button" className={`tw-btn${it.key === nextKey ? ' tw-btn--primary' : it.look === 'done' ? ' tw-btn--sm acct-step-done-btn' : ''}`} onClick={() => onOpen(it.tab!)}>
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
  if (look === 'bad' && n === 1) return <span className="acct-step-num is-urgent" aria-hidden="true">1</span>;
  if (look === 'bad') return <span className="acct-step-num is-bad" aria-hidden="true"><X size={12} strokeWidth={2.5} /></span>;
  if (look === 'busy') return <span className="acct-step-num is-busy" aria-hidden="true"><Loader2 size={12} className="animate-spin" /></span>;
  return <span className={`acct-step-num${auto ? ' is-auto' : ''}`} aria-hidden="true">{n}</span>;
}

/**
 * Settings inside the accounting system that stop every document (e.g.
 * QuickBooks "Custom transaction numbers"). Fixed there, then re-read here.
 */
function ProviderBlockers({ connection, blockers }: { connection: Connection; blockers: string[] }) {
  const cfg = providerConfig(connection.provider);
  const qc = useQueryClient();
  const { canWrite, writeTitle } = useAccountingPermissions();
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      const fresh = await accountingApi.refreshOptions();
      qc.setQueryData(ACCT_KEYS.mapping, fresh);
      await invalidateAccounting(qc);
      toast.success(`Settings read again from ${cfg.short}`);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't read from ${cfg.short}. Try again.`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="acct-blockers" role="status">
      <div className="acct-blockers__head">
        <AlertTriangle size={16} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          {blockers.length === 1 ? (() => {
            const one = parseBlocker(blockers[0]);
            return one ? (
              <>
                <p className="acct-blockers__title">{one.what} in {cfg.short}</p>
                <p className="acct-blockers__body">In {one.where}. {one.why}</p>
              </>
            ) : (
              <>
                <p className="acct-blockers__title">Change this setting in {cfg.short}</p>
                <p className="acct-blockers__body">{blockers[0]}</p>
              </>
            );
          })() : (
            <>
              <p className="acct-blockers__title">Change these {blockers.length} settings in {cfg.short}</p>
              <ul className="acct-blockers__items">
                {blockers.map(text => {
                  const x = parseBlocker(text);
                  return (
                    <li key={text} className="acct-blocker">
                      {x ? <><span className="acct-blocker__what">{x.what}</span><span className="acct-blockers__body">In {x.where}. {x.why}</span></>
                        : <span className="acct-blockers__body">{text}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="acct-blockers__actions">
        <button type="button" className="tw-btn" onClick={refresh} disabled={!canWrite || busy} title={writeTitle}>
          <RefreshCw size={14} aria-hidden="true" className={busy ? 'animate-spin' : undefined} />
          {busy ? 'Reading…' : `Refresh from ${cfg.short}`}
        </button>
        {connection.web_url && (
          <a className="tw-btn tw-btn--ghost" href={connection.web_url} target="_blank" rel="noopener noreferrer">
            Open in {cfg.short}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * The server's provider-setting sentence, split into what to change, where
 * and why when it has the usual shape ('Turn on "X" in QuickBooks (path),
 * then press Refresh: reason'); null for any other sentence (shown as is).
 */
function parseBlocker(text: string): { what: string; where: string; why: string } | null {
  const m = text.match(/^(Turn (?:on|off) "[^"]+") in [^(]+\(([^)]+)\),? then press Refresh:\s*(.+)$/);
  if (!m) return null;
  return { what: m[1].replace(/"([^"]+)"/, '\u201c$1\u201d'), where: m[2], why: m[3].charAt(0).toUpperCase() + m[3].slice(1) };
}

/** True while a TruckWys-side setup step is still open. */
function items0Open(r: Connection['readiness']): boolean {
  return !r.mapping_complete || r.contacts_to_confirm > 0 || r.backfill_state !== 'DONE';
}
