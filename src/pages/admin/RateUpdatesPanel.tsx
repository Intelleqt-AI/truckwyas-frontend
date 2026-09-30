import '@/pages/admin/admin-brand.css';
import '@/pages/admin/ai-admin.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { fetchData, postData } from '@/lib/Api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { formatDate, formatMoney, MISSING } from '@/lib/formatters';

// Proposed updates to the stored figures the quote price check compares
// against (toll tariffs, the driver allowance). A monthly job finds each one
// on its published source page; nothing reaches a quote until a platform
// admin approves it here. Superuser only (the endpoints are IsSuperUser).

interface RateUpdate {
  id: number;
  kind: string;               // "toll_tariff" | "driver_allowance" | …
  label: string;              // "N3 Mooi River, class 4"
  current_value: number | null;
  proposed_value: number;
  source_url?: string | null;
  source_name?: string | null;
  verified_at?: string | null; // when the proposed figure was confirmed on its page
  found_at?: string | null;    // when the job found it
}

const KIND_LABEL: Record<string, string> = {
  toll: 'Toll tariff', toll_tariff: 'Toll tariff', tolls: 'Toll tariff',
  driver_allowance: 'Driver allowance', allowance: 'Driver allowance',
  fuel: 'Fuel price', fuel_price: 'Fuel price',
};
const kindLabel = (k: string) => KIND_LABEL[k] || (k ? `${k[0].toUpperCase()}${k.slice(1).replace(/_/g, ' ')}` : 'Figure');
const hostOf = (url?: string | null) => {
  if (!url) return null;
  try { const u = new URL(url); return { host: u.hostname.replace(/^www\./, ''), https: u.protocol === 'https:' }; } catch { return null; }
};
const MINUS = '−';
const change = (from: number | null, to: number) => {
  if (from == null || !from) return null;
  const pct = ((to - from) / from) * 100;
  const body = `${Math.abs(pct) < 0.05 ? '0' : Math.abs(pct).toFixed(1).replace('.', ',')}%`;
  return `${pct < 0 ? MINUS : '+'}${body}`;
};
const URL_LIST = 'api/v1/admin/verified-rates/?status=pending';

export default function RateUpdatesPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery<RateUpdate[] | { results: RateUpdate[] }>({
    queryKey: ['admin-verified-rates', 'pending'],
    queryFn: () => fetchData(URL_LIST),
    retry: 1,
  });
  const rows: RateUpdate[] = Array.isArray(data) ? data : data?.results ?? [];
  const [confirming, setConfirming] = useState<RateUpdate | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (row: RateUpdate, action: 'approve' | 'reject') => {
    setBusyId(row.id);
    try {
      await postData({ url: `api/v1/admin/verified-rates/${row.id}/${action}/`, data: {} });
      toast.success(action === 'approve'
        ? `${row.label} is now ${formatMoney(row.proposed_value)}`
        : `Rejected. ${row.label} stays at ${row.current_value != null ? formatMoney(row.current_value) : 'its current figure'}`);
      await qc.invalidateQueries({ queryKey: ['admin-verified-rates'] });
    } catch {
      toast.error(action === 'approve' ? "Couldn't approve the update. Try again." : "Couldn't reject the update. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="tw-card" aria-labelledby="rate-updates-title" aria-busy={isLoading || undefined}>
      <div className="tw-card__head">
        <div className="tw-card__titles">
          <h2 id="rate-updates-title" className="tw-card__title">
            Waiting for approval
            <InfoTip label="Where these come from">
              Each month a job looks up toll tariffs and the driver allowance on their published pages and proposes any change here. Quotes keep using the current figure until you approve the new one.
            </InfoTip>
          </h2>
          <p className="tw-card__sub">{!isLoading && !isError && rows.length > 0 ? `${rows.length} proposed ${rows.length === 1 ? 'change' : 'changes'}` : 'Proposed by the monthly refresh'}</p>
        </div>
      </div>

      {isError ? (
        <div className="aiu-errorline">
          <p className="aiu-line"><span className="aiu-line__strong">Couldn't load the proposed updates.</span> Try again in a moment.</p>
          <button type="button" className="tw-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      ) : !isLoading && rows.length === 0 ? (
        <p className="aiu-line">Nothing to review. New figures appear here after each monthly refresh.</p>
      ) : (
        <table className="admin-table ru-table">
          <thead>
            <tr>
              <th scope="col">What changes</th>
              <th scope="col" className="num">Current</th>
              <th scope="col" className="num">Proposed</th>
              <th scope="col">Source</th>
              <th scope="col"><span className="aiu-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [0, 1, 2].map((i) => (
              <tr key={i} className="ru-row" aria-hidden="true">
                <td className="ru-what"><span className="aiu-skel" /></td>
                <td className="num ru-cur"><span className="aiu-skel" /></td>
                <td className="num ru-new"><span className="aiu-skel" /></td>
                <td className="ru-src"><span className="aiu-skel" /></td>
                <td className="ru-act" />
              </tr>
            ))}
            {rows.map((r) => {
              const src = hostOf(r.source_url);
              const delta = change(r.current_value, r.proposed_value);
              const busy = busyId === r.id;
              return (
                <tr key={r.id} className="ru-row">
                  <td className="ru-what">
                    <span className="ru-label">{r.label}</span>
                    <span className="aiu-sub">{kindLabel(r.kind)}{r.found_at ? ` · found ${formatDate(r.found_at)}` : ''}</span>
                  </td>
                  <td className="num ru-cur">{r.current_value != null ? formatMoney(r.current_value) : MISSING}</td>
                  <td className="num ru-new">
                    <span className="ru-arrow" aria-hidden="true">→ </span>
                    <strong>{formatMoney(r.proposed_value)}</strong>
                    {delta && <span className="aiu-sub">{delta}</span>}
                  </td>
                  <td className="ru-src">
                    {/* Only https pages are linked; anything else is named, not linked. */}
                    {src?.https ? (
                      <a className="ru-srclink" href={r.source_url!} target="_blank" rel="noopener noreferrer"
                        title={r.source_name || undefined} aria-label={`${r.source_name || src.host} (opens in a new tab)`}>{src.host}</a>
                    ) : src ? <span className="ru-srctext" title={r.source_url || undefined}>{src.host} (not https)</span>
                      : <span className="aiu-sub">No source link</span>}
                    {r.verified_at && <span className="aiu-sub">Checked {formatDate(r.verified_at)}</span>}
                  </td>
                  <td className="ru-act">
                    <button type="button" className="tw-btn tw-btn--sm tw-btn--ghost" disabled={busy} onClick={() => act(r, 'reject')}
                      aria-label={`Reject the new ${r.label} figure`}>Reject</button>
                    <button type="button" className="tw-btn tw-btn--sm" disabled={busy} onClick={() => setConfirming(r)}
                      aria-label={`Approve the new ${r.label} figure`}>Approve</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirming && (
        <ConfirmModal
          title="Approve this figure?"
          message={`${confirming.label} changes from ${confirming.current_value != null ? formatMoney(confirming.current_value) : 'no figure'} to ${formatMoney(confirming.proposed_value)}. Every price check uses it from now on.`}
          confirmLabel="Approve"
          onConfirm={() => { const r = confirming; act(r, 'approve'); }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
