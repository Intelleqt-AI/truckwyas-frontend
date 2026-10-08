import './trip.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { formatMoney } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InfoTip } from '@/components/ui/InfoTip';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import {
  combinedBasisLabel, costBasisLabel, costGroupsText, emptyReturnNote, linkWarnings, missingPrompts, money as moneyText, pctText,
  ptsText, revenueBasisLabel, roleLabel, isPending, type Candidate, type Economics, type EconomicsLeg, type LinkWarning,
} from '@/lib/tripEconomics';
import { CandidateOption } from './CandidateOption';
import { invalidateTrip } from './invalidateTrip';

interface LoadLike {
  id: number;
  load_number: string;
  status: string;
  trip_type?: string;
  pickup_city?: string;
  delivery_city?: string;
  vehicle?: number | null;
}

// To the cent: revenue − cost = margin on screen, and matches the invoice.
const money = (n: number | null) => moneyText(n);
const tone = (n: number | null) => (n === null ? '' : n < 0 ? ' tm-neg' : '');

/**
 * Trip margin: quoted vs actual per leg and, for a return pair, combined.
 * Cost says what it rests on (actual expenses or which estimate); a job that
 * can't be costed says what to add instead of showing a guess.
 */
export function TripMarginCard({ load, onAddTruck }: { load: LoadLike; onAddTruck?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [warnings, setWarnings] = useState<LinkWarning[]>([]);

  const econQ = useQuery({
    queryKey: ['load-economics', String(load.id)],
    queryFn: () => fetchData(`api/v1/loads/${load.id}/economics/`) as Promise<Economics>,
    // Tolls being worked out in the background: look again until they land.
    refetchInterval: (q) => (missingPrompts(q.state.data as Economics | undefined).some(isPending) ? 5000 : false),
  });
  const econ = econQ.data;

  const closeCosts = useMutation({
    mutationFn: (closed: boolean) => postData({ url: `api/v1/loads/${load.id}/close-costs/`, data: { closed } }),
    onSuccess: (_r, closed) => { invalidateTrip(qc); toast.success(closed ? 'Costs closed' : 'Costs reopened'); },
    onError: (e: Error) => toast.error(e?.message || "Couldn't update the costs"),
  });

  const unlink = useMutation({
    mutationFn: () => postData({ url: `api/v1/loads/${load.id}/unlink-return/`, data: {} }),
    onSuccess: () => { setWarnings([]); invalidateTrip(qc); toast.success('Return load unlinked'); },
    onError: (e: Error) => toast.error(e?.message || "Couldn't unlink the return load"),
  });

  if (econQ.isLoading) return null;
  if (!econ || !Array.isArray(econ.legs) || econ.legs.length === 0) return null;

  // A cancelled job has no margin to show.
  if (load.status === 'CANCELLED') {
    return (
      <section className="bk-card tm-card" aria-labelledby="tm-title">
        <div className="bk-card__head"><h2 className="bk-card__title" id="tm-title">Trip margin</h2></div>
        <p className="tm-note"><span className="bk-dot bk-dot--neutral" aria-hidden="true" />Cancelled. No margin for this job.</p>
      </section>
    );
  }
  const thisLeg = econ.legs.find(l => l.load_id === load.id);

  const pairNote = emptyReturnNote(econ);
  const missing = missingPrompts(econ);
  const partner = econ.pair ? econ.legs.find(l => l.load_id !== load.id) : undefined;
  const canLink = !econ.pair && load.status !== 'CANCELLED' && (load.trip_type ?? 'ONE_WAY') === 'ONE_WAY';

  const legRow = (leg: EconomicsLeg) => (
    <tr key={leg.load_id}>
      <td className="tm-jobcell">
        <span className="tm-legname">
          {econ.pair ? roleLabel(leg.role) : 'This job'}
          {econ.pair && leg.load_id !== load.id && (
            <a className="bk-link bk-link--sm" href={`/bookings/${leg.load_id}`} onClick={e => { e.preventDefault(); navigate(`/bookings/${leg.load_id}`); }}>{leg.load_number}</a>
          )}
        </span>
        {leg.lane && <span className="tm-sub">{leg.lane}</span>}
      </td>
      <td data-label="Revenue">{money(leg.revenue) ?? <span className="tm-muted">—</span>}<span className="tm-sub">{revenueBasisLabel(leg.revenue_basis)}</span></td>
      <td data-label="Cost">
        {leg.cost !== null ? money(leg.cost) : <span className="tm-muted">{(leg.missing || []).some(isPending) ? 'Working out' : 'Unknown'}</span>}
        <span className="tm-sub" title={leg.cost_basis === 'estimate' ? leg.estimate_label : undefined}>{costBasisLabel(leg)}</span>
        {costGroupsText(leg.cost_groups).line && <span className="tm-sub">{costGroupsText(leg.cost_groups).line}</span>}
        {costGroupsText(leg.cost_groups).recordedNote && <span className="tm-sub">{costGroupsText(leg.cost_groups).recordedNote}</span>}
      </td>
      <td data-label="Margin" className={tone(leg.margin)}>
        {leg.margin !== null ? money(leg.margin) : <span className="tm-muted">—</span>}
        {leg.margin_pct !== null && <span className="tm-sub">{pctText(leg.margin_pct)}</span>}
      </td>
      <td data-label="Quoted margin">
        {leg.quoted?.margin_pct !== null && leg.quoted?.margin_pct !== undefined ? pctText(leg.quoted.margin_pct) : <span className="tm-muted">Not quoted</span>}
        {leg.quoted?.price !== null && leg.quoted?.price !== undefined && <span className="tm-sub">on {formatMoney(leg.quoted.price)}</span>}
      </td>
      <td data-label="Vs quote" className={leg.margin_vs_quoted_pts === null ? 'tm-muted' : tone(leg.margin_vs_quoted_pts)}>{ptsText(leg.margin_vs_quoted_pts)}</td>
    </tr>
  );

  const c = econ.combined;
  return (
    <section className="bk-card tm-card" aria-labelledby="tm-title">
      <div className="bk-card__head">
        <h2 className="bk-card__title" id="tm-title">
          Trip margin{' '}
          <InfoTip label="About trip margin">Revenue is the job price until the invoice is issued. Cost is the logged expenses (excl. VAT) once there are any, otherwise the costing the job was booked on. With a return load linked, neither leg carries an empty return.</InfoTip>
        </h2>
        <span className="tm-head-actions">
          {econ.pair && (
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={() => setConfirmUnlink(true)} disabled={unlink.isPending}>
              {unlink.isPending ? 'Unlinking…' : 'Unlink return'}
            </button>
          )}
          {canLink && (
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={() => setLinkOpen(true)}>
              Link return load
            </button>
          )}
          {thisLeg && (thisLeg.costs_closed ? (
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={() => closeCosts.mutate(false)} disabled={closeCosts.isPending}>
              {closeCosts.isPending ? 'Reopening…' : 'Reopen costs'}
            </button>
          ) : (thisLeg.actual_cost ?? 0) > 0 && (
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={() => closeCosts.mutate(true)} disabled={closeCosts.isPending}
              title="Every cost of this job is recorded: use the expenses as the whole cost">
              {closeCosts.isPending ? 'Closing…' : 'Close costs'}
            </button>
          ))}
        </span>
      </div>

      {econ.pair && partner && (
        <p className="tm-pair">
          {partner.role === 'return' ? 'Comes back loaded with ' : 'Return of '}
          <a className="bk-link" href={`/bookings/${partner.load_id}`} onClick={e => { e.preventDefault(); navigate(`/bookings/${partner.load_id}`); }}>{partner.load_number}</a>
          {partner.lane ? ` · ${partner.lane}` : ''}
        </p>
      )}

      <div className="tm-table-wrap">
        <table className="tm-table">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Revenue</th>
              <th scope="col">Cost</th>
              <th scope="col">Margin</th>
              <th scope="col">Quoted margin</th>
              <th scope="col">Vs quote</th>
            </tr>
          </thead>
          <tbody>
            {econ.legs.map(legRow)}
            {econ.pair && (
              <tr className="tm-total">
                <td className="tm-jobcell">Both legs</td>
                <td data-label="Revenue">{money(c.revenue) ?? '—'}<span className="tm-sub">{revenueBasisLabel(c.revenue_basis)}</span></td>
                <td data-label="Cost">{c.cost !== null ? money(c.cost) : <span className="tm-muted">Unknown</span>}<span className="tm-sub">{combinedBasisLabel(c.cost_basis)}</span></td>
                <td data-label="Margin" className={tone(c.margin)}>{c.margin !== null ? money(c.margin) : '—'}{c.margin_pct !== null && <span className="tm-sub">{pctText(c.margin_pct)}</span>}</td>
                <td data-label="Quoted margin">{c.quoted?.margin_pct !== null && c.quoted?.margin_pct !== undefined ? pctText(c.quoted.margin_pct) : <span className="tm-muted">—</span>}</td>
                <td data-label="Vs quote" className={c.margin_vs_quoted_pts === null ? 'tm-muted' : tone(c.margin_vs_quoted_pts)}>{ptsText(c.margin_vs_quoted_pts)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pairNote && (
        <p className="tm-note" role="status"><span className="bk-dot bk-dot--success" aria-hidden="true" />{pairNote}</p>
      )}
      {!econ.pair && econ.expecting_return && (
        <p className="tm-note"><span className="bk-dot bk-dot--info" aria-hidden="true" />Expecting a return load. Link it here once it's booked.</p>
      )}
      {warnings.length > 0 && (
        <ul className="tm-warns" aria-label="Link warnings">
          {warnings.map(w => <li key={w.code}><span className="bk-dot bk-dot--warning" aria-hidden="true" /><span><b>{w.title}.</b> {w.detail}</span></li>)}
        </ul>
      )}
      {missing.filter(isPending).map(m => (
        <p key={m.code} className="tm-note" role="status" aria-live="polite"><span className="bk-dot bk-dot--neutral tm-pulse" aria-hidden="true" />{m.prompt}</p>
      ))}
      {missing.filter(m => !isPending(m)).map(m => (
        <div key={m.code} className="tm-missing" role="status">
          <p>{m.prompt}</p>
          {m.code === 'no_vehicle' && onAddTruck && (
            <button type="button" className="bk-btn bk-btn--secondary bk-btn--sm" onClick={onAddTruck}>Add truck</button>
          )}
        </div>
      ))}

      {linkOpen && (
        <LinkReturnDialog
          load={load}
          onClose={() => setLinkOpen(false)}
          onLinked={(w) => { setWarnings(w); setLinkOpen(false); }}
        />
      )}
      {confirmUnlink && (
        <ConfirmModal
          title="Unlink return load"
          message={`Unlink ${partner?.load_number ?? 'the return load'}? Both jobs are costed with an empty return again.`}
          confirmLabel="Unlink"
          onConfirm={() => unlink.mutate()}
          onCancel={() => setConfirmUnlink(false)}
        />
      )}
    </section>
  );
}

/** Pick the job that brings this truck home (or the one this job returns). */
function LinkReturnDialog({ load, onClose, onLinked }: { load: LoadLike; onClose: () => void; onLinked: (w: LinkWarning[]) => void }) {
  useFocusTrap(latestModal, true);
  const qc = useQueryClient();
  const [direction, setDirection] = useState<'return' | 'outbound'>('return');
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState<number | null>(null);

  const candQ = useQuery({
    queryKey: ['return-candidates', String(load.id), direction, days],
    queryFn: () => fetchData(`api/v1/loads/${load.id}/return-candidates/?direction=${direction}&days=${days}`) as Promise<{ candidates: Candidate[] }>,
  });
  const candidates = candQ.data?.candidates ?? [];

  const link = useMutation({
    mutationFn: (other: number) => direction === 'return'
      ? postData({ url: `api/v1/loads/${load.id}/link-return/`, data: { return_load_id: other } })
      : postData({ url: `api/v1/loads/${other}/link-return/`, data: { return_load_id: load.id } }),
    onSuccess: (res) => {
      invalidateTrip(qc);
      toast.success('Return load linked');
      onLinked(linkWarnings(res));
    },
    onError: (e: Error) => toast.error(e?.message || "Couldn't link the return load"),
  });

  const place = direction === 'return' ? (load.delivery_city || 'the drop') : (load.pickup_city || 'the collection');
  return (
    <div className="bk-dialog-backdrop" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bk-dialog bj-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-link-title" onClick={e => e.stopPropagation()}>
        <h2 className="bk-dialog__title" id="tm-link-title">Link a return load</h2>
        <div className="tm-picker-bar">
          <span className="tw-seg tw-seg--sm" role="group" aria-label="Direction">
            {([['return', 'Brings this truck home'], ['outbound', 'This job is the return']] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={direction === v} className={`tw-seg__opt${direction === v ? ' is-active' : ''}`}
                onClick={() => { setDirection(v); setPicked(null); }}>{label}</button>
            ))}
          </span>
          <label className="bk-help" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Within
            <select className="bj-input" style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }} value={days} onChange={e => { setDays(Number(e.target.value)); setPicked(null); }}>
              {[7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </div>
        {candQ.isLoading ? (
          <p className="bk-help">Finding jobs…</p>
        ) : candQ.isError ? (
          <p className="bj-error">Couldn't load suggestions. Try again.</p>
        ) : candidates.length === 0 ? (
          <p className="tm-empty">
            {direction === 'return'
              ? `No open jobs collect near ${place} within ${days} days of delivery.`
              : `No open jobs deliver near ${place} in the ${days} days before collection.`}
          </p>
        ) : (
          <fieldset className="tm-options">
            <legend className="sr-only">Jobs</legend>
            {candidates.map(c => (
              <CandidateOption key={c.load_id} name="tm-cand" candidate={c} direction={direction} checked={picked === c.load_id} onChange={() => setPicked(c.load_id)} />
            ))}
          </fieldset>
        )}
        <div className="bk-dialog__footer">
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="bk-btn bk-btn--primary" disabled={picked === null || link.isPending} onClick={() => picked !== null && link.mutate(picked)}>
            {link.isPending ? 'Linking…' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
