import './trip.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData } from '@/lib/Api';
import { formatMoney, formatMoneyWhole } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { sendBlockedMessage } from '@/lib/quoteWarnings';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import {
  invoiceWhenText, linkRefusal, linkWarnings, marginText, returnChoiceRequest,
  type Candidate, type Economics, type InvoicePreview, type ReturnChoice,
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

interface Booking {
  created: boolean;
  already_converted: boolean;
  expecting_return: boolean;
  is_return_of: number | null;
  return_load_id: number | null;
  return_candidates: Candidate[];
  outbound_candidates: Candidate[];
  invoice_preview: InvoicePreview;
  economics: Economics;
}
interface BookedJob { id: number; load_number: string; booking: Booking }

// YYYY-MM-DD in local time.
const iso = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const isoInDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, (m || 1) - 1, d || 1); t.setDate(t.getDate() + n); return iso(t); };
// About 700 km a day on the road: a 600 km run is delivered the same day.
const roadDays = (km?: number | null) => (km && km > 0 ? Math.floor(km / 700) : 2);
const place = (s?: string) => (s || '').split(',')[0].trim();

/**
 * One-tap booking: an accepted quote becomes a job. Step 1 takes the optional
 * truck, driver and dates; step 2 shows the invoice delivery will raise and
 * asks "Coming back loaded?" with the server's suggestions both ways. Both
 * calls are idempotent (a second tap answers with the same job).
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
  const [job, setJob] = useState<BookedJob | null>(null);
  const [choice, setChoice] = useState<ReturnChoice>({ kind: 'none' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-available-for-booking', quote.vehicle_type],
    queryFn: () => fetchData(`api/v1/vehicles/?status=AVAILABLE${quote.vehicle_type ? `&vehicle_type__name=${encodeURIComponent(quote.vehicle_type)}` : ''}`),
    enabled: !job,
  });
  const { data: driversData } = useQuery({
    queryKey: ['drivers-available-for-booking'],
    queryFn: () => fetchData('api/v1/drivers/?status=ACTIVE'),
    enabled: !job,
  });
  const vehicles: { id: number; make?: string; model?: string; plate?: string }[] = vehiclesData?.results || vehiclesData || [];
  const drivers: { id: number; user_details?: { name?: string; username?: string } }[] = driversData?.results || driversData || [];

  const datesBad = !pickup || !delivery || delivery < pickup;
  const driverWithoutTruck = !!driverId && !vehicleId;

  const book = useMutation({
    mutationFn: () => postData({
      url: `api/v1/quotes/${quote.id}/convert_to_load/`,
      data: { vehicle_id: vehicleId || undefined, driver_id: driverId || undefined, pickup_date: pickup, delivery_date: delivery },
    }) as Promise<BookedJob>,
    onSuccess: (res) => {
      setError(null);
      setJob(res);
      setChoice(res.booking?.expecting_return ? { kind: 'expect' } : { kind: 'none' });
      invalidateTrip(qc);
      qc.invalidateQueries({ queryKey: ['quote', String(quote.id)] });
      qc.invalidateQueries({ queryKey: ['quotes-column'] });
    },
    onError: (e: Error & { status?: number }) => setError(sendBlockedMessage(e) || e?.message || "Couldn't book the job"),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const req = job ? returnChoiceRequest(choice, quote.id, job.id) : null;
      return req ? postData(req) : null;
    },
    onSuccess: (res) => {
      if (!job) return;
      const refused = linkRefusal(res);
      if (refused) { setError(refused); return; }
      invalidateTrip(qc);
      if (res) {
        const w = linkWarnings(res);
        toast.success(choice.kind === 'expect' ? 'Marked as expecting a return load' : `Return load linked${w.length ? `: ${w.map(x => x.title.toLowerCase()).join(', ')}` : ''}`);
      }
      onClose();
      navigate(`/bookings/${job.id}`);
    },
    onError: (e: Error) => setError(e?.message || "Couldn't link the return load"),
  });

  const customer = quote.customer_name || quote.company_name;
  const lane = [place(quote.pickup_location), place(quote.delivery_location)].filter(Boolean).join(' → ');
  const total = Number(quote.total_amount);

  if (job) {
    const b = job.booking;
    const p = b?.invoice_preview;
    const leg = b?.economics?.legs?.[0];
    const emptyAssumed = !!(leg?.quoted as { empty_return_assumed?: boolean } | undefined)?.empty_return_assumed;
    const linkedAlready = !!(b?.is_return_of || b?.return_load_id);
    const returns = b?.return_candidates ?? [];
    const outbounds = b?.outbound_candidates ?? [];
    const same = (c: ReturnChoice) => c.kind === choice.kind && ('loadId' in c ? (choice as { loadId?: number }).loadId === c.loadId : true);
    const primary = choice.kind === 'none' ? 'Open job' : choice.kind === 'expect' ? 'Save and open job' : 'Link and open job';
    return (
      <div className="bk-dialog-backdrop" onClick={onClose}>
        <div className="bk-dialog bj-dialog" role="dialog" aria-modal="true" aria-labelledby="bj-title" onClick={e => e.stopPropagation()}>
          <h2 className="bk-dialog__title" id="bj-title">{b?.already_converted ? 'Already booked' : 'Job booked'}</h2>
          <p className="bj-done">
            <span className="bk-dot bk-dot--success" aria-hidden="true" />
            <span><b style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{job.load_number}</b>{lane ? ` · ${lane}` : ''}</span>
          </p>
          {leg && marginText(leg.margin, leg.margin_pct) && (
            <p className="bk-help">Margin {marginText(leg.margin, leg.margin_pct)}{b?.economics?.pair ? ', return load linked' : emptyAssumed ? ', back empty' : ''}</p>
          )}

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

          {!linkedAlready && (
            <section className="bj-section" aria-labelledby="bj-back-title">
              <h3 className="bj-section__title" id="bj-back-title">Coming back loaded?</h3>
              <fieldset className="tm-options">
                <legend className="sr-only">Return load</legend>
                <ChoiceOption name="bj-back" checked={choice.kind === 'none'} onChange={() => setChoice({ kind: 'none' })} title={emptyAssumed ? 'No, back empty' : 'No'} meta={emptyAssumed ? 'Costed with the empty return, as quoted' : undefined} />
                {returns.map(c => (
                  <CandidateOption key={`r${c.load_id}`} name="bj-back" candidate={c} direction="return"
                    checked={same({ kind: 'return', loadId: c.load_id })} onChange={() => setChoice({ kind: 'return', loadId: c.load_id })} />
                ))}
                {outbounds.map(c => (
                  <ChoiceOption key={`o${c.load_id}`} name="bj-back" checked={same({ kind: 'outbound', loadId: c.load_id })}
                    onChange={() => setChoice({ kind: 'outbound', loadId: c.load_id })}
                    title={<>Return of {c.load_number}</>} meta={[c.customer_name, [c.pickup, c.delivery].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')}
                    warnings={(c.warnings || []).map(w => w.title)} />
                ))}
                <ChoiceOption name="bj-back" checked={choice.kind === 'expect'} onChange={() => setChoice({ kind: 'expect' })} title="Expecting a return load" meta="Link it from the job once it's booked" />
              </fieldset>
            </section>
          )}

          {error && <p className="bj-error" role="alert">{error}</p>}
          <div className="bk-dialog__footer">
            <button type="button" className="bk-btn bk-btn--secondary" onClick={onClose}>Close</button>
            <button type="button" className="bk-btn bk-btn--primary" disabled={apply.isPending} onClick={() => apply.mutate()}>
              {apply.isPending ? 'Saving…' : primary}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {error && <p className="bj-error" role="alert">{error}</p>}

        <div className="bk-dialog__footer">
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="bk-btn bk-btn--primary" disabled={datesBad || driverWithoutTruck || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? 'Booking…' : 'Book job'}
          </button>
        </div>
      </div>
    </div>
  );
}
