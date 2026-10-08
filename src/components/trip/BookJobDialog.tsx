import './trip.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { formatMoney, formatMoneyWhole } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { sendBlockedMessage } from '@/lib/quoteWarnings';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import {
  bookingRequest, candidateFit, candidateSummary, invoiceWhenText, linkRefusal, linkWarnings, marginText, previewMargin,
  type Candidate, type InvoicePreview, type ReturnChoice, type DEFAULT_LINK_FIELDS,
} from '@/lib/tripEconomics';
import { CandidateOption, ChoiceOption } from './CandidateOption';
import { invalidateTrip } from './invalidateTrip';

export interface BookableQuote {
  id: number | string;
  quote_number?: string;
  customer_name?: string;
  company_name?: string;
  pickup_location?: string;
  delivery_location?: string;
  total_amount?: string | number;
  vehicle_type?: string;
  pickup_date?: string | null;
  delivery_date?: string | null;
  distance?: string | number | null;
}

interface BookingBlock {
  is_return_of?: number | null;
  return_load_id?: number | null;
  expecting_return?: boolean;
  return_candidates: Candidate[];
  outbound_candidates: Candidate[];
  invoice_preview: InvoicePreview;
  costing?: { cost_floor: number | null; empty_return_assumed: boolean | null };
  link_fields?: Partial<typeof DEFAULT_LINK_FIELDS>;
}
interface Preview {
  preview: boolean;
  can_book: boolean;
  blocked?: { error?: string; title?: string; warnings?: { severity?: string; title?: string }[] } | null;
  load_id: number | null;
  booking: BookingBlock;
}
interface BookedJob { id: number; load_number: string; booking?: { return_link?: unknown } }

// YYYY-MM-DD in local time.
const iso = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const isoInDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, (m || 1) - 1, d || 1); t.setDate(t.getDate() + n); return iso(t); };
// About 700 km a day on the road: a 600 km run is delivered the same day.
const roadDays = (km?: number | null) => (km && km > 0 ? Math.floor(km / 700) : 2);
const place = (s?: string) => (s || '').split(',')[0].trim();

/**
 * One-tap booking: an accepted quote becomes a job. Before confirming it shows
 * (from GET booking-preview, nothing created) the invoice delivery will raise
 * and asks "Coming back loaded?" with the server's suggestions both ways.
 * Confirm is one idempotent convert_to_load (a second tap answers with the
 * same job), carrying the link in either direction or the expect flag.
 */
export function BookJobDialog({ quote, onClose }: { quote: BookableQuote; onClose: () => void }) {
  useFocusTrap(latestModal, true);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const qPickup = quote.pickup_date ? String(quote.pickup_date).slice(0, 10) : '';
  const qDelivery = quote.delivery_date ? String(quote.delivery_date).slice(0, 10) : '';
  const km = quote.distance != null ? Number(quote.distance) : null;
  const [pickup, setPickup] = useState(qPickup || isoInDays(2));
  const [delivery, setDelivery] = useState(qDelivery || addDays(qPickup || isoInDays(2), roadDays(km)));
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [picked, setChoice] = useState<ReturnChoice>({ kind: 'none' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-available-for-booking', quote.vehicle_type],
    queryFn: () => fetchData(`api/v1/vehicles/?status=AVAILABLE${quote.vehicle_type ? `&vehicle_type__name=${encodeURIComponent(quote.vehicle_type)}` : ''}`),
  });
  const { data: driversData } = useQuery({
    queryKey: ['drivers-available-for-booking'],
    queryFn: () => fetchData('api/v1/drivers/?status=ACTIVE'),
  });
  const vehicles: { id: number; make?: string; model?: string; plate?: string }[] = vehiclesData?.results || vehiclesData || [];
  const drivers: { id: number; user_details?: { name?: string; username?: string } }[] = driversData?.results || driversData || [];

  const datesBad = !pickup || !delivery || delivery < pickup;
  const driverWithoutTruck = !!driverId && !vehicleId;

  // What booking would give, for these dates (suggestions depend on them).
  const previewQ = useQuery({
    queryKey: ['booking-preview', String(quote.id), pickup, delivery],
    queryFn: () => fetchData(`api/v1/quotes/${quote.id}/booking-preview/?pickup_date=${pickup}&delivery_date=${delivery}`) as Promise<Preview>,
    enabled: !datesBad,
    placeholderData: keepPreviousData,
  });
  const pv = previewQ.data;
  const b = pv?.booking;
  const bookedId = pv?.load_id ?? null;
  const returns = b?.return_candidates ?? [];
  const outbounds = b?.outbound_candidates ?? [];
  // A choice no longer offered (dates changed) counts as "no".
  const offered = (c: ReturnChoice) => c.kind === 'return' ? returns.some(x => x.load_id === c.loadId)
    : c.kind === 'outbound' ? outbounds.some(x => x.load_id === c.loadId) : true;
  const choice: ReturnChoice = offered(picked) ? picked : { kind: 'none' };

  const book = useMutation({
    mutationFn: async () => {
      const req = bookingRequest(choice, quote.id, { vehicle_id: vehicleId, driver_id: driverId, pickup_date: pickup, delivery_date: delivery }, b?.link_fields);
      const job = await postData(req) as BookedJob;
      return { job, linkRes: job as unknown };
    },
    onSuccess: ({ job, linkRes }) => {
      invalidateTrip(qc);
      qc.invalidateQueries({ queryKey: ['quote', String(quote.id)] });
      qc.invalidateQueries({ queryKey: ['quotes-column'] });
      qc.invalidateQueries({ queryKey: ['booking-preview'] });
      const linkError = linkRefusal(linkRes);
      const w = linkWarnings(linkRes);
      if (linkError) toast.error(`Booked ${job.load_number}. ${linkError}`);
      else toast.success(`Booked ${job.load_number}${choice.kind === 'return' || choice.kind === 'outbound' ? ', return load linked' : choice.kind === 'expect' ? ', expecting a return load' : ''}${w.length ? ` (${w.map(x => x.title.toLowerCase()).join(', ')})` : ''}`);
      onClose();
      navigate(`/bookings/${job.id}`);
    },
    onError: (e: Error & { status?: number }) => setError(sendBlockedMessage(e) || e?.message || "Couldn't book the job"),
  });

  const customer = quote.customer_name || quote.company_name;
  const lane = [place(quote.pickup_location), place(quote.delivery_location)].filter(Boolean).join(' → ');
  const total = Number(quote.total_amount);
  const p = b?.invoice_preview;
  const emptyAssumed = !!b?.costing?.empty_return_assumed;
  const margin = previewMargin(total, b?.costing?.cost_floor);
  const blockedText = pv && !pv.can_book
    ? (pv.blocked?.warnings?.find(w => w.severity === 'block')?.title || pv.blocked?.title || pv.blocked?.error || "This quote can't be booked yet")
    : null;
  const same = (c: ReturnChoice) => c.kind === choice.kind && ('loadId' in c ? (choice as { loadId?: number }).loadId === c.loadId : true);

  return (
    <div className="bk-dialog-backdrop" onClick={onClose}>
      <div className="bk-dialog bj-dialog" role="dialog" aria-modal="true" aria-labelledby="bj-title" onClick={e => e.stopPropagation()}>
        <h2 className="bk-dialog__title" id="bj-title">Book job</h2>
        <div className="bj-summary">
          <div>
            <div className="bj-summary__lane">{lane || quote.quote_number}</div>
            <div className="bj-summary__sub">{[quote.quote_number, customer].filter(Boolean).join(' · ')}</div>
          </div>
          {Number.isFinite(total) && total > 0 && <div className="bj-summary__price"><div className="bj-summary__total">{formatMoneyWhole(total)}</div><div className="bj-summary__sub">excl. VAT</div></div>}
        </div>

        {bookedId ? (
          <p className="bj-done"><span className="bk-dot bk-dot--success" aria-hidden="true" />Already booked. Open the job to see its margin and return load.</p>
        ) : (<>
        <div className="bj-grid">
          <div className="bk-field">
            <label className="bk-field__label" htmlFor="bj-pickup">Collection</label>
            <input id="bj-pickup" className="bj-input" type="date" value={pickup} onChange={e => setPickup(e.target.value)} />
          </div>
          <div className="bk-field">
            <label className="bk-field__label" htmlFor="bj-delivery">Delivery</label>
            <input id="bj-delivery" className="bj-input" type="date" value={delivery} min={pickup || undefined} onChange={e => setDelivery(e.target.value)} />
          </div>
          <div className="bk-field">
            <label className="bk-field__label" htmlFor="bj-truck">Truck (optional)</label>
            <select id="bj-truck" className="bj-input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Assign later</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate || `#${v.id}`}{[v.make, v.model].filter(Boolean).length ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label className="bk-field__label" htmlFor="bj-driver">Driver (optional)</label>
            <select id="bj-driver" className="bj-input" value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">Assign later</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.user_details?.name || d.user_details?.username || `Driver #${d.id}`}</option>)}
            </select>
          </div>
        </div>
        {(!qPickup || !qDelivery) && <p className="bk-help">The quote has no {!qPickup && !qDelivery ? 'dates' : !qPickup ? 'collection date' : 'delivery date'}: check the suggested {!qPickup && !qDelivery ? 'ones' : 'date'}.</p>}
        {datesBad && <p className="bk-help bk-help--warning">Delivery can't be before collection.</p>}
        {driverWithoutTruck && <p className="bk-help bk-help--warning">A driver needs a truck. Pick a truck too, or clear the driver.</p>}

        {previewQ.isLoading && !pv ? (
          <p className="bk-help" style={{ marginTop: 16 }}>Preparing the invoice and return loads…</p>
        ) : previewQ.isError && !pv ? (
          <p className="bk-help" style={{ marginTop: 16 }}>Couldn't load the invoice preview. You can still book.</p>
        ) : b && (<>
          <section className="bj-section" aria-labelledby="bj-back-title">
            <h3 className="bj-section__title" id="bj-back-title">Coming back loaded?</h3>
            <fieldset className="tm-options">
              <legend className="sr-only">Return load</legend>
              <ChoiceOption name="bj-back" ariaLabel={emptyAssumed ? 'No, back empty' : 'No'} checked={choice.kind === 'none'} onChange={() => setChoice({ kind: 'none' })}
                title={emptyAssumed ? 'No, back empty' : 'No'}
                meta={margin ? `Margin ${marginText(margin.amount, margin.pct)}${emptyAssumed ? ' with the empty return, as quoted' : ''}` : undefined} />
              {returns.map(c => (
                <CandidateOption key={`r${c.load_id}`} name="bj-back" candidate={c} direction="return"
                  checked={same({ kind: 'return', loadId: c.load_id })} onChange={() => setChoice({ kind: 'return', loadId: c.load_id })} />
              ))}
              <ChoiceOption name="bj-back" ariaLabel="Expecting a return load" checked={choice.kind === 'expect'} onChange={() => setChoice({ kind: 'expect' })} title="Expecting a return load" meta="Link it from the job once it's booked" />
              {outbounds.length > 0 && <p className="bj-group" id="bj-outbound-head">This job is the return of…</p>}
              {outbounds.map(c => (
                <ChoiceOption key={`o${c.load_id}`} name="bj-back" checked={same({ kind: 'outbound', loadId: c.load_id })}
                  onChange={() => setChoice({ kind: 'outbound', loadId: c.load_id })}
                  ariaLabel={`This job is the return of ${c.load_number}${c.customer_name ? `, ${c.customer_name}` : ''}`}
                  title={<>{c.load_number}{c.customer_name ? <span className="tm-muted">{c.customer_name}</span> : null}</>}
                  meta={candidateSummary(c, 'outbound')}
                  fit={candidateFit(c)}
                  warnings={(c.warnings || []).map(w => w.title)} />
              ))}
            </fieldset>
          </section>

          {p && (
            <section className="bj-section" aria-labelledby="bj-inv-title">
              <h3 className="bj-section__title" id="bj-inv-title">Invoice</h3>
              <p className="bj-section__sub">{invoiceWhenText(p)}</p>
              {p.state !== 'not_invoiceable' && p.state !== 'raised' && (<>
                {(p.lines || []).map((ln, i) => (
                  <div key={i} className="bk-kv"><span className="bk-kv__label">{ln.description}</span><span className="bk-kv__value">{formatMoney(ln.net_amount)}</span></div>
                ))}
                {p.vat_amount ? <div className="bk-kv"><span className="bk-kv__label">VAT</span><span className="bk-kv__value">{formatMoney(p.vat_amount)}</span></div> : null}
                <div className="bk-kv bk-kv--total"><span className="bk-kv__label">Total{p.vat_amount ? ' incl. VAT' : ''}</span><span className="bk-kv__value">{formatMoney(p.total ?? 0)}</span></div>
              </>)}
            </section>
          )}
        </>)}
        </>)}

        {blockedText && !bookedId && <p className="bj-error" role="alert">{blockedText}</p>}
        {error && <p className="bj-error" role="alert">{error}</p>}
        <div className="bk-dialog__footer">
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onClose}>Cancel</button>
          {bookedId ? (
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => { onClose(); navigate(`/bookings/${bookedId}`); }}>Open job</button>
          ) : (
            <button type="button" className="bk-btn bk-btn--primary" disabled={datesBad || driverWithoutTruck || book.isPending || !!blockedText} onClick={() => book.mutate()}>
              {book.isPending ? 'Booking…' : choice.kind === 'return' || choice.kind === 'outbound' ? 'Book and link' : 'Book job'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
