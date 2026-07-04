import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RouteMapView } from '@/components/RouteMapView';

// Hardcoded light-theme tokens — this is a public page outside the app shell
const C = {
  bg:        '#f3f4f6',
  surface:   '#ffffff',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  faint:     '#9ca3af',
  accent:    '#1d4ed8',
  success:   '#16a34a',
  successBg: '#f0fdf4',
  danger:    '#dc2626',
  dangerBg:  '#fef2f2',
  warning:   '#d97706',
  warningBg: '#fffbeb',
  mono:      "'SF Mono','Monaco','Consolas',monospace",
  sans:      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

function formatCurrencyLocal(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n);
}

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, fontFamily: C.mono, color: C.faint, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 24,
      marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Overlay wrapper — escapes the app's `overflow: hidden` root
function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflowY: 'auto',
      background: C.bg,
      fontFamily: C.sans,
      zIndex: 9999,
    }}>
      {children}
    </div>
  );
}

export default function ClientQuoteView() {
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
        setResponseMessage(alreadyAccepted ? 'Quote accepted — your operator will be in touch' : 'Quote declined');
      }
    },
  });

  if (isLoading) {
    return (
      <PublicShell>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, color: C.muted, fontFamily: C.mono }}>Loading quote...</div>
        </div>
      </PublicShell>
    );
  }

  if (error || !quote) {
    return (
      <PublicShell>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 40, maxWidth: 500, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✗</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.danger, marginBottom: 8 }}>Quote not found or invalid link</div>
            <div style={{ fontSize: 13, color: C.muted }}>This quote may have expired or the link is incorrect.</div>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (responded) {
    const accepted = responseMessage.toLowerCase().includes('accepted');
    return (
      <PublicShell>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{
            background: accepted ? C.successBg : C.surface,
            border: `1px solid ${accepted ? C.success : C.border}`,
            borderRadius: 8,
            padding: 48,
            maxWidth: 500,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{accepted ? '✓' : '—'}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: accepted ? C.success : C.text, marginBottom: 8 }}>
              {responseMessage}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
              {accepted ? 'The freight company will be in touch to confirm arrangements.' : 'Thank you for letting us know.'}
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  const alreadyActioned = quote.status === 'ACCEPTED' || quote.status === 'DECLINED';
  const validUntilDate = new Date(quote.valid_until);
  const isExpiringSoon = validUntilDate.getTime() - Date.now() < 48 * 60 * 60 * 1000;
  const isExpired = validUntilDate.getTime() < Date.now();

  return (
    <PublicShell>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 64px' }}>

        {/* Branding header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, letterSpacing: '-0.02em', marginBottom: 4 }}>
            TRUCKWYS
          </div>
          <div style={{ fontSize: 11, color: C.faint, fontFamily: C.mono, letterSpacing: '0.12em' }}>
            ROAD FREIGHT INTELLIGENCE
          </div>
        </div>

        {/* Quote number + status banner */}
        <Card style={{ textAlign: 'center', borderTop: `4px solid ${C.accent}` }}>
          <div style={{ fontSize: 11, fontFamily: C.mono, color: C.faint, letterSpacing: '0.1em', marginBottom: 8 }}>QUOTE</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: C.mono, marginBottom: 12 }}>
            {quote.quote_number}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>{quote.customer_name}</div>
        </Card>

        {/* Expiry notice */}
        {(isExpiringSoon || isExpired) && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 6,
            background: isExpired ? C.dangerBg : C.warningBg,
            border: `1px solid ${isExpired ? C.danger : C.warning}`,
            fontSize: 13,
            color: isExpired ? C.danger : C.warning,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            {isExpired
              ? 'This quote has expired'
              : `Expires ${validUntilDate.toLocaleDateString('en-ZA')} — ${Math.ceil((validUntilDate.getTime() - Date.now()) / (1000 * 60 * 60))}h remaining`}
          </div>
        )}
        {!isExpiringSoon && !isExpired && (
          <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', marginBottom: 16 }}>
            Valid until {validUntilDate.toLocaleDateString('en-ZA')}
          </div>
        )}

        {/* Route */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: C.mono, color: C.faint, letterSpacing: '0.1em' }}>
              {quote.trip_type === 'ROUND_TRIP' ? 'LEG 1 — OUTBOUND' : 'ROUTE'}
            </div>
            {quote.trip_type === 'ROUND_TRIP' && (
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.accent, padding: '2px 8px', border: `1px solid ${C.accent}`, borderRadius: 4, fontWeight: 700 }}>
                ROUND TRIP
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div>
              <Label>Pickup</Label>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {quote.pickup_location || quote.origin || '—'}
              </div>
            </div>
            <div style={{ fontSize: 20, color: C.faint }}>→</div>
            <div>
              <Label>Delivery</Label>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {quote.delivery_location || quote.destination || '—'}
              </div>
            </div>
          </div>
          {(quote.pickup_location || quote.origin) && (quote.delivery_location || quote.destination) && (
            <RouteMapView
              pickup={quote.pickup_location || quote.origin}
              delivery={quote.delivery_location || quote.destination}
            />
          )}
        </Card>

        {/* Return Leg — visible only for ROUND_TRIP quotes */}
        {quote.trip_type === 'ROUND_TRIP' && (
          <Card>
            <div style={{ fontSize: 11, fontFamily: C.mono, color: C.accent, letterSpacing: '0.1em', marginBottom: 20 }}>LEG 2 — RETURN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div>
                <Label>Departs From</Label>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{quote.delivery_location || '—'}</div>
              </div>
              <div style={{ fontSize: 20, color: C.faint }}>→</div>
              <div>
                <Label>Return Destination</Label>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{quote.return_location || '—'}</div>
              </div>
            </div>
            {(quote.return_cargo || quote.return_date) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div>
                  <Label>Return Cargo</Label>
                  <div style={{ fontSize: 13, color: quote.return_cargo ? C.text : C.faint }}>
                    {quote.return_cargo || 'Empty return'}
                  </div>
                </div>
                {quote.return_date && (
                  <div>
                    <Label>Return Date</Label>
                    <div style={{ fontSize: 13, color: C.text, fontFamily: C.mono }}>
                      {new Date(quote.return_date).toLocaleDateString('en-ZA')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Cargo details */}
        <Card>
          <div style={{ fontSize: 11, fontFamily: C.mono, color: C.faint, letterSpacing: '0.1em', marginBottom: 20 }}>CARGO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <Label>Description</Label>
              <div style={{ fontSize: 13, color: C.text }}>{quote.cargo_description || '—'}</div>
            </div>
            <div>
              <Label>Vehicle type</Label>
              <div style={{ fontSize: 13, color: C.text }}>{quote.vehicle_type || '—'}</div>
            </div>
            <div>
              <Label>Weight</Label>
              <div style={{ fontSize: 13, color: C.text, fontFamily: C.mono }}>
                {quote.weight ? `${parseFloat(quote.weight).toLocaleString('en-ZA')} kg` : '—'}
              </div>
            </div>
            <div>
              <Label>Distance</Label>
              <div style={{ fontSize: 13, color: C.text, fontFamily: C.mono }}>
                {quote.distance ? `${Math.round(parseFloat(quote.distance)).toLocaleString('en-ZA')} km` : '—'}
              </div>
            </div>
            {quote.vehicle_display && (
              <div>
                <Label>Vehicle</Label>
                <div style={{ fontSize: 13, color: C.text }}>{quote.vehicle_display}</div>
              </div>
            )}
            {quote.driver_display && (
              <div>
                <Label>Driver</Label>
                <div style={{ fontSize: 13, color: C.text }}>{quote.driver_display}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Cost breakdown */}
        <Card>
          <div style={{ fontSize: 11, fontFamily: C.mono, color: C.faint, letterSpacing: '0.1em', marginBottom: 20 }}>COST BREAKDOWN</div>
          {[
            { label: 'Base Rate', value: quote.base_rate },
            { label: 'Fuel Surcharge', value: quote.fuel_surcharge },
            { label: 'Toll Charges', value: quote.toll_charges },
            { label: 'Driver Allowance', value: quote.driver_allowance },
            { label: 'Additional Charges', value: quote.additional_charges },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 13, color: C.muted }}>{item.label}</span>
              <span style={{ fontSize: 13, color: C.text, fontFamily: C.mono }}>
                {formatCurrencyLocal(parseFloat(item.value || '0'))}
              </span>
            </div>
          ))}
          {quote.trip_type === 'ROUND_TRIP' && quote.return_base_rate && parseFloat(quote.return_base_rate) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px dashed ${C.accent}` }}>
              <span style={{ fontSize: 13, color: C.accent }}>Return Leg ({quote.return_cargo ? 'with cargo' : 'empty return'})</span>
              <span style={{ fontSize: 13, color: C.accent, fontFamily: C.mono, fontWeight: 600 }}>
                {formatCurrencyLocal(parseFloat(quote.return_base_rate))}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              {quote.trip_type === 'ROUND_TRIP' ? 'Total (both legs)' : 'Total Amount'}
            </span>
            <span style={{ fontSize: 26, fontWeight: 700, color: C.accent, fontFamily: C.mono }}>
              {formatCurrencyLocal(parseFloat(quote.total_amount || '0'))}
            </span>
          </div>
        </Card>

        {/* Accept / Decline / Already responded / Expired */}
        {alreadyActioned ? (
          <div style={{
            marginTop: 8,
            padding: '20px 24px',
            borderRadius: 6,
            background: quote.status === 'ACCEPTED' ? C.successBg : C.dangerBg,
            border: `1px solid ${quote.status === 'ACCEPTED' ? C.success : C.danger}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>{quote.status === 'ACCEPTED' ? '✓' : '✗'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: quote.status === 'ACCEPTED' ? C.success : C.danger }}>
                {quote.status === 'ACCEPTED' ? 'Quote Accepted' : 'Quote Declined'}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                This quote has already been responded to and no further actions are available.
              </div>
            </div>
          </div>
        ) : isExpired ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.danger, fontSize: 13 }}>
            This quote has expired and can no longer be accepted.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginTop: 8 }}>
            <button
              onClick={() => respondMutation.mutate('accept')}
              disabled={respondMutation.isPending}
              style={{
                padding: '16px 24px',
                background: C.success,
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 14,
                fontFamily: C.mono,
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: respondMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: respondMutation.isPending ? 0.7 : 1,
              }}
            >
              {respondMutation.isPending ? 'SUBMITTING...' : '✓  ACCEPT QUOTE'}
            </button>
            <button
              onClick={() => respondMutation.mutate('decline')}
              disabled={respondMutation.isPending}
              style={{
                padding: '16px 24px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.muted,
                fontSize: 14,
                fontFamily: C.mono,
                letterSpacing: '0.06em',
                cursor: respondMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              DECLINE
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: C.faint }}>
          Powered by TruckWys — Road Freight Intelligence Platform
        </div>
      </div>
    </PublicShell>
  );
}
