import './public-document.css';
import { usePublicTheme } from './usePublicTheme';
import { StatusChip } from '@/components/ui/StatusChip';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExpandableRouteMap } from '@/components/ExpandableRouteMap';
import { Loader } from '@/components/Loader';
import { formatDate, formatDistance, formatMoney, formatNumber } from '@/lib/formatters';

// House formats: "R 20 505,65", "5 Apr 2026", "30 000 kg", "1 234 km".
function formatCurrencyLocal(n: number) {
  return formatMoney(n);
}

const fmtDay = (d: string) => formatDate(d);

// Page shell: escapes the app's `overflow: hidden` root and carries the
// client-facing document theme (see public-document.css).
function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="pd"><main className="pd-page">{children}</main></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pd-field">
      <div className="pd-label">{label}</div>
      <div className="pd-value">{children}</div>
    </div>
  );
}

export default function ClientQuoteView() {
  usePublicTheme();
  const { quoteId, token } = useParams<{ quoteId: string; token: string }>();
  const [responded, setResponded] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['public-quote', quoteId, token],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/v1/quotes/public/${quoteId}/${token}/`);
      if (!res.ok) throw new Error('Quote not found or invalid link');
      return res.json();
    },
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (action: 'accept' | 'decline') => {
      const res = await fetch(`${apiBase}/api/v1/quotes/public/${quoteId}/${token}/respond/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Failed to respond to quote'), { status: res.status, data });
      return data;
    },
    onSuccess: (data) => {
      setResponded(true);
      setResponseMessage(data.message);
    },
    onError: (err: any) => {
      if (err.status === 409) {
        setResponded(true);
        const alreadyAccepted = err.data?.status === 'ACCEPTED';
        setResponseMessage(alreadyAccepted ? 'Quote accepted. Your operator will be in touch.' : 'Quote declined');
      }
    },
  });

  if (isLoading) {
    return (
      <PublicShell>
        <div className="pd-center"><Loader size={36} label="Loading quote" /></div>
      </PublicShell>
    );
  }

  if (error || !quote) {
    return (
      <PublicShell>
        <div className="pd-state">
          <div className="pd-doc">
            <h1 className="pd-state__title">This quote link is not valid</h1>
            <p className="pd-state__text">The quote may have expired or the link is incorrect. Please ask the sender for a new link.</p>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (responded) {
    const accepted = responseMessage.toLowerCase().includes('accepted');
    return (
      <PublicShell>
        <div className="pd-state">
          <div className="pd-doc">
            <StatusChip status={accepted ? 'ACCEPTED' : 'DECLINED'} style={{ marginBottom: 16 }} />
            <h1 className="pd-state__title">{responseMessage}</h1>
            <p className="pd-state__text">
              {accepted ? 'The freight company will be in touch to confirm arrangements.' : 'Thank you for letting us know.'}
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  const alreadyActioned = quote.status === 'ACCEPTED' || quote.status === 'DECLINED';
  const validUntilDate = new Date(quote.valid_until);
  const isExpiringSoon = validUntilDate.getTime() - Date.now() < 48 * 60 * 60 * 1000;
  const isExpired = validUntilDate.getTime() < Date.now();
  const hoursLeft = Math.ceil((validUntilDate.getTime() - Date.now()) / (1000 * 60 * 60));
  const pickup = quote.pickup_location || quote.origin;
  const delivery = quote.delivery_location || quote.destination;
  const isRoundTrip = quote.trip_type === 'ROUND_TRIP';

  return (
    <PublicShell>
      {/* The freight company's own identity, then the quote. */}
      <header className="pd-brand">
        <div style={{ minWidth: 0 }}>
          {quote.company_logo_url
            ? <><img className="pd-brand__logo" src={quote.company_logo_url} alt={quote.company_name || 'Company logo'} /><h1 className="sr-only">{quote.company_name}</h1></>
            : <h1 className="pd-brand__name">{quote.company_name || 'Freight quote'}</h1>}
        </div>
        <div className="pd-brand__doc">
          <div className="pd-brand__kind">Quote</div>
          <div className="pd-brand__number">{quote.quote_number}</div>
        </div>
      </header>

      <article className="pd-doc" aria-label={`Quote ${quote.quote_number}`}>
        {/* The price first: one all-in amount, no internal cost breakdown. */}
        <section className="pd-section pd-hero">
          <div>
            <div className="pd-label">{isRoundTrip ? 'Total price, round trip' : 'Total price'}</div>
            <div className="pd-hero__amount">{formatCurrencyLocal(parseFloat(quote.total_amount || '0'))}</div>
            <div className="pd-hero__line">Excluding VAT. Prepared for {quote.customer_name}.</div>
          </div>
          {alreadyActioned
            ? <StatusChip status={quote.status === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED'} />
            : isExpired
            ? <StatusChip tone="danger" label="Expired" />
            : <StatusChip tone={isExpiringSoon ? 'warning' : 'neutral'} label={isExpiringSoon ? `Expires in ${hoursLeft}h` : `Valid until ${fmtDay(quote.valid_until)}`} />}
        </section>

        <section className="pd-section">
          <h2 className="pd-h2">{isRoundTrip ? 'Leg 1: outbound' : 'Route'}</h2>
          <ol className="pd-route">
            <li className="pd-route__stop">
              <span className="pd-route__marker" aria-hidden="true"><span className="pd-route__pin" /><span className="pd-route__line" /></span>
              <div><div className="pd-label">Pickup</div><div className="pd-value pd-value--strong">{pickup || '—'}</div></div>
            </li>
            {Array.isArray(quote.stops) && quote.stops.map((s: { location: string }, i: number) => (
              <li key={i} className="pd-route__stop">
                <span className="pd-route__marker" aria-hidden="true"><span className="pd-route__pin" /><span className="pd-route__line" /></span>
                <div><div className="pd-label">Stop {i + 1}</div><div className="pd-value">{s.location}</div></div>
              </li>
            ))}
            <li className="pd-route__stop">
              <span className="pd-route__marker" aria-hidden="true"><span className="pd-route__pin" /><span className="pd-route__line" /></span>
              <div><div className="pd-label">Delivery</div><div className="pd-value pd-value--strong">{delivery || '—'}</div></div>
            </li>
          </ol>

          {pickup && delivery && (
            <div className="pd-map">
              <ExpandableRouteMap
                pickup={pickup}
                delivery={delivery}
                pickupCoords={quote.pickup_lat ? { lat: Number(quote.pickup_lat), lon: Number(quote.pickup_lng) } : undefined}
                deliveryCoords={quote.delivery_lat ? { lat: Number(quote.delivery_lat), lon: Number(quote.delivery_lng) } : undefined}
                stops={Array.isArray(quote.stops) ? quote.stops.map((s: { location: string; lat: number; lon: number }) => ({ lat: Number(s.lat), lon: Number(s.lon), label: s.location })) : undefined}
                geometry={Array.isArray(quote.route_geometry) && quote.route_geometry.length > 1 ? quote.route_geometry.map((p: { lat: number; lon: number }) => [Number(p.lat), Number(p.lon)] as [number, number]) : undefined}
                dialogStyle={{ background: 'var(--pd-surface)', border: '1px solid var(--pd-border)', borderRadius: 16, boxShadow: 'none' }}
              />
            </div>
          )}
        </section>

        {isRoundTrip && (
          <section className="pd-section">
            <h2 className="pd-h2">Leg 2: return</h2>
            <div className="pd-grid">
              <Field label="Departs from">{quote.delivery_location || '—'}</Field>
              <Field label="Returns to">{quote.return_location || '—'}</Field>
              <Field label="Return cargo">{quote.return_cargo || 'Empty return'}</Field>
              {quote.return_date && <Field label="Return date">{fmtDay(quote.return_date)}</Field>}
            </div>
          </section>
        )}

        <section className="pd-section">
          <h2 className="pd-h2">Cargo and schedule</h2>
          <div className="pd-grid">
            <Field label="Description">{quote.cargo_description || '—'}</Field>
            <Field label="Vehicle type">{quote.vehicle_type || '—'}</Field>
            <Field label="Weight"><span className="pd-num">{quote.weight ? `${formatNumber(parseFloat(quote.weight))} kg` : 'Not set'}</span></Field>
            <Field label="Distance"><span className="pd-num">{quote.distance ? formatDistance(parseFloat(quote.distance)) : 'Not set'}</span></Field>
            <Field label="Collection date">{quote.pickup_date ? fmtDay(quote.pickup_date) : 'To be confirmed'}</Field>
            <Field label="Delivery date">{quote.delivery_date ? fmtDay(quote.delivery_date) : 'To be confirmed'}</Field>
          </div>
        </section>

        {/* Respond */}
        <section className="pd-section">
          {alreadyActioned ? (
            <div className={`pd-callout ${quote.status === 'ACCEPTED' ? 'pd-callout--success' : ''}`}>
              <div className="pd-callout__title">{quote.status === 'ACCEPTED' ? 'You accepted this quote' : 'You declined this quote'}</div>
              <div className="pd-sub" style={{ marginTop: 2 }}>No further action is needed here.</div>
            </div>
          ) : isExpired ? (
            <div className="pd-callout pd-callout--danger">
              <div className="pd-callout__title">This quote expired on {fmtDay(quote.valid_until)}</div>
              <div style={{ marginTop: 2 }}>It can no longer be accepted. Ask the sender for an updated quote.</div>
            </div>
          ) : (
            <>
              <h2 className="pd-h2">Would you like to go ahead?</h2>
              <p className="pd-sub" style={{ margin: '-8px 0 16px' }}>
                Accepting lets {quote.company_name || 'the freight company'} know you want to go ahead at this price. They will confirm the booking with you.
              </p>
              <div className="pd-actions">
                <button
                  type="button"
                  className="pd-btn pd-btn--primary"
                  onClick={() => respondMutation.mutate('accept')}
                  disabled={respondMutation.isPending}
                >
                  {respondMutation.isPending ? 'Submitting…' : 'Accept quote'}
                </button>
                <button
                  type="button"
                  className="pd-btn pd-btn--secondary"
                  onClick={() => respondMutation.mutate('decline')}
                  disabled={respondMutation.isPending}
                >
                  Decline
                </button>
              </div>
            </>
          )}
        </section>
      </article>

      <footer className="pd-footer">Sent with TruckWys</footer>
    </PublicShell>
  );
}
