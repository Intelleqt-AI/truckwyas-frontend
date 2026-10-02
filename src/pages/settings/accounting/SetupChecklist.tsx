import { useState } from 'react';
import { Check, ChevronRight, Loader2, RefreshCw, X, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { startConnect } from '@/components/accounting/AccountingProviderCards';
import { ACCT_KEYS, accountingApi, apiMessage, invalidateAccounting, providerBlockers, providerConfig, type Connection } from '@/lib/accounting';
import { formatDate } from '@/lib/formatters';
import { ConnectionDetails } from './ConnectionHeader';
import { AcctCard, plural, useAccountingPermissions, type StepLook } from './shared';
import type { AccountingTab } from './tabs';

/** What still has to happen before documents start flowing, in order. */
export function SetupChecklist({ connection, onOpen }: { connection: Connection; onOpen: (tab: AccountingTab) => void }) {
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const checkAgain = async () => {
    setChecking(true);
    try {
      const fresh = await accountingApi.refreshOptions();
      qc.setQueryData(ACCT_KEYS.mapping, fresh);
      await invalidateAccounting(qc);
      toast.success(`Checked ${cfg.short} again`);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't reach ${cfg.short}. Try again.`));
    } finally {
      setChecking(false);
    }
  };
  const r = connection.readiness;
  const missing = r.missing_mappings ?? [];
  const backfillLook: StepLook = r.backfill_state === 'DONE' ? 'done' : r.backfill_state === 'RUNNING' ? 'busy' : r.backfill_state === 'FAILED' ? 'bad' : 'todo';

  type Item = { key: string; look: StepLook; title: string; desc: React.ReactNode; tab?: AccountingTab; action?: string; provider?: boolean };
  const items: Item[] = [
    {
      key: 'connect',
      look: connection.status === 'ACTIVE' ? 'done' : 'todo',
      title: connection.status === 'ACTIVE' ? `Connect ${cfg.short}` : `Reconnect ${cfg.short}`,
      desc: connection.status !== 'ACTIVE'
        ? (canWrite ? 'Your mapping and contacts are kept.' : 'Needs a company admin. Your mapping and contacts are kept.')
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
      title: r.backfill_state === 'DONE' && connection.cutover_date ? `Start date: ${formatDate(connection.cutover_date)}` : 'Choose a start date',
      desc: r.backfill_state === 'DONE'
        ? `History from ${connection.cutover_date ? formatDate(connection.cutover_date) : 'the start date'} was sent to ${cfg.short}.${connection.status === 'ACTIVE' && providerBlockers(r).length ? ' New documents wait for step 2.' : ''}`
        : r.backfill_state === 'RUNNING'
          ? `Sending documents to ${cfg.short} now.`
          : r.backfill_state === 'FAILED'
            ? 'The first send stopped part-way. Open it to see what went wrong and try again.'
            : `Anything dated before it should already be in ${cfg.short}.`,
      tab: 'cutover',
      action: r.backfill_state === 'DONE' ? 'Review' : r.backfill_state === 'RUNNING' ? 'Watch progress' : 'Choose start date',
    },
    {
      key: 'live',
      look: r.sync_enabled ? 'done' : 'todo',
      title: 'Sync starts',
      desc: r.sync_enabled
        ? `New invoices, credit notes and bills go to ${cfg.short} on their own, and payments come back every few minutes.`
        : 'Automatically, once the steps above are done.',
      // (reworded below when only provider settings are left)
      tab: r.sync_enabled ? 'sync' : undefined,
      action: r.sync_enabled ? 'Review' : undefined,
    },
  ];

  const providerActions = (primary: boolean) => (
    <>
      {connection.web_url && (
        <a className={`tw-btn${primary ? ' tw-btn--primary' : ''}`} href={connection.web_url} target="_blank" rel="noopener noreferrer">
          Open in {cfg.short}<ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <button type="button" className="tw-btn" onClick={checkAgain} disabled={!canWrite || checking} title={writeTitle}>
        <RefreshCw size={14} aria-hidden="true" className={checking ? 'animate-spin' : undefined} />
        {checking ? 'Checking…' : 'Check again'}
      </button>
    </>
  );

  // Settings to change inside the provider (QuickBooks "Custom transaction
  // numbers" etc.) are steps like any other, right after connecting.
  const blockers = connection.status !== 'ACTIVE' ? [] : providerBlockers(r);
  items.splice(1, 0, ...blockers.map((text, i): Item => {
    const x = parseBlocker(text);
    const isNext = i === 0;
    return {
      key: `provider-${i}`, look: 'warn', provider: true,
      title: x ? `${x.what} in ${cfg.short}` : `Change a ${cfg.short} setting`,
      desc: <>
        {x ? <><span className="acct-path">{x.where.split(/\s*→\s*/).map((seg, k, arr) => <span key={k}><span className="acct-nowrap">{seg}</span>{k < arr.length - 1 ? ' → ' : ''}</span>)}</span>{x.why}</> : text}
        <span className="acct-step-actions--below">{providerActions(isNext)}</span>
      </>,
      action: 'Check again',
    };
  }));

  const liveItem = items.find(it => it.key === 'live');
  const stillOpen = items.filter(it => it.look !== 'done' && it.key !== 'live');
  if (liveItem && !r.sync_enabled && stillOpen.length && stillOpen.every(it => it.provider)) {
    const nums = stillOpen.map(it => items.indexOf(it) + 1);
    liveItem.desc = r.backfill_state === 'DONE'
      ? "Until this is fixed. Nothing is lost; documents send once it's on."
      : `Waiting on ${nums.length === 1 ? `step ${nums[0]}` : `steps ${nums.join(' and ')}`}.`;
    if (r.backfill_state === 'DONE') liveItem.title = 'Sync paused';
  }

  // Only the next step to do gets the primary button; while the sign-in has
  // expired, Reconnect (in the header) is the only one and the rest wait.
  const reauth = connection.status !== 'ACTIVE';
  const nextKey = reauth ? undefined : items.find(it => it.look !== 'done' && (it.tab || it.provider) && it.action)?.key;
  const open = items.filter(it => it.look !== 'done' && it.key !== 'live' && it.key !== 'connect').map(it => items.indexOf(it) + 1);
  const ownOpen = items.filter(it => it.look !== 'done' && !it.provider && it.key !== 'live' && it.key !== 'connect');
  const subtitle = blockers.length && !ownOpen.length
    ? `Everything in TruckWys is done. Nothing new is sent until ${open.length === 1 ? `step ${open[0]} is` : `steps ${open[0]}–${open[open.length - 1]} are`} done.`
    : r.sync_enabled
    ? `Done. ${cfg.short} and TruckWys now stay in step on their own.`
    : reauth
      ? `The other steps wait until ${cfg.short} is reconnected.`
      : open.length
        ? `One-time setup. Nothing is sent to ${cfg.short} until ${open.length === 1 ? `step ${open[0]} is` : `steps ${open[0]}–${open[open.length - 1]} are`} done.`
        : `Sending your history to ${cfg.short}.`;

  return (
    <>
    <AcctCard title={r.sync_enabled ? `${cfg.short} is set up` : blockers.length && !ownOpen.length ? `${blockers.length === 1 ? 'One change' : `${blockers.length} changes`} needed in ${cfg.short}` : `Finish setting up ${cfg.short}`} description={subtitle} flush>
      <ol className="acct-check acct-check--steps">
        {items.map((it, i) => {
          const auto = it.key === 'live';
          const blocked = reauth;
          return (
            <li key={it.key} className={[blocked && it.key !== 'connect' ? 'is-blocked' : '', it.provider ? 'is-provider' : ''].filter(Boolean).join(' ') || undefined}>
              <StepMarker look={it.look} n={i + 1} auto={auto} />
              <div style={{ minWidth: 0 }}>
                <div className="acct-check__title"><span className="acct-sr">Step {i + 1}: </span>{it.title}</div>
                <div className="acct-check__desc">{it.desc}</div>
              </div>
              {it.provider ? (
                <span className="acct-step-actions acct-step-actions--side">{providerActions(it.key === nextKey)}</span>
              ) : it.key === 'connect' && reauth && canWrite ? (
                // Phones: the reconnect action sits in its step (the banner's button is desktop-only).
                <button type="button" className="tw-btn tw-btn--primary acct-only-phone-btn" onClick={() => startConnect(cfg.slug, cfg.short)}>Reconnect {cfg.short}</button>
              ) : it.tab && it.action && !(blocked && it.look !== 'done') ? (
                <button type="button" className={`tw-btn${it.key === nextKey ? ' tw-btn--primary' : ` acct-step-quiet${it.look === 'done' ? ' tw-btn--sm acct-step-done-btn' : ''}`}`} onClick={() => onOpen(it.tab!)}>
                  {it.action}
                  {it.key !== nextKey && <ChevronRight size={14} aria-hidden="true" className="acct-step-chev" />}
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
  if (look === 'warn') return <span className="acct-step-num is-warn" aria-hidden="true">{n}</span>;
  if (look === 'bad' && n === 1) return <span className="acct-step-num is-urgent" aria-hidden="true">1</span>;
  if (look === 'bad') return <span className="acct-step-num is-bad" aria-hidden="true"><X size={12} strokeWidth={2.5} /></span>;
  if (look === 'busy') return <span className="acct-step-num is-busy" aria-hidden="true"><Loader2 size={12} className="animate-spin" /></span>;
  return <span className={`acct-step-num${auto ? ' is-auto' : ''}`} aria-hidden="true">{n}</span>;
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

