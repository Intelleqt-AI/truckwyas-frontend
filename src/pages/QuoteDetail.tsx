import './quote-detail-responsive.css';
import './quote-invoice-roles.css';
import './bookings-section.css';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, deleteData, postData, downloadBlob } from '@/lib/Api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConvertToBookingModal } from '@/components/ConvertToBookingModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { isSubscriptionBlocked, subscriptionStatusDetail } from '@/lib/subscriptionStatus';
import { ExpandableRouteMap } from '@/components/ExpandableRouteMap';
import { Loader } from '@/components/Loader';
import { AlertTriangle, ArrowLeft, Download } from 'lucide-react';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  IT: 'info',
  COMPLETED: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  IT: 'In transit',
  COMPLETED: 'Completed',
};

// Sentence-case a single-word token for display: "HIGH" → "High".
const sentenceCase = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

// wa.me wants digits only, with country code, no leading 0 or '+'. Customer
// numbers are stored in whatever format staff typed them in (spaces, dashes,
// a leading 0, sometimes already a country code) — normalise to South
// Africa's code (this is a SA road-freight platform) when there's no
// country code already on the number.
function toWhatsAppNumber(raw?: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) {
    digits = '27' + digits.slice(1);
  } else if (!digits.startsWith('27') && digits.length <= 10) {
    digits = '27' + digits;
  }
  return digits;
}

function buildWhatsAppShareUrl(phone: string | undefined, message: string): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  // No number on file — still open WhatsApp so the user can pick a contact,
  // rather than hiding the button entirely.
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; address: string | null; reason?: string | null } | null>(null);

  // Sprint 1 features
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'accepted' | 'rejected' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [fuelAlert, setFuelAlert] = useState<any>(null);
  const [confirmOpts, setConfirmOpts] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void; danger?: boolean } | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchData(`api/v1/quotes/${id}/`),
    retry: 1,
  });

  // Live update: refetch when backend pushes a quote status event over WebSocket
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent;
      if (typeof detail?.event === 'string' && detail.event.startsWith('quote.')) {
        if (!detail?.data?.id || String(detail.data.id) === String(id)) {
          queryClient.invalidateQueries({ queryKey: ['quote', id] });
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
      }
    };
    window.addEventListener('tw:live-event', handler);
    return () => window.removeEventListener('tw:live-event', handler);
  }, [id, queryClient]);

  // Fetch fuel alert for sent/pending quotes
  useEffect(() => {
    if (quote && (quote.status === 'SENT' || quote.status === 'DRAFT')) {
      fetchData(`/api/v1/quotes/${id}/fuel-alert/`)
        .then(data => {
          if (data.has_alert) {
            setFuelAlert(data);
          }
        })
        .catch(() => {
          // Silently fail
        });
    }
  }, [quote, id]);

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => patchData({ url: `api/v1/quotes/${id}/`, data: { status: newStatus } }),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.setQueryData(['quotes'], (old: any) => {
        if (!old) return old;
        const items: any[] = old?.results || old;
        const updated = items.map((q: any) => String(q.id) === String(id) ? { ...q, status: newStatus } : q);
        return old?.results ? { ...old, results: updated } : updated;
      });
    },
  });

  const sendToCustomerMutation = useMutation({
    mutationFn: () => postData({ url: `api/v1/quotes/${id}/send_to_customer/`, data: {} }),
    onSuccess: (data) => {
      // Rewrite the origin so the link always points to THIS environment
      // (backend FRONTEND_URL may be hardcoded to production)
      try {
        const path = new URL(data.share_url).pathname;
        setShareUrl(`${window.location.origin}${path}`);
      } catch {
        setShareUrl(data.share_url);
      }
      // email_skipped_reason isn't wired up on the backend yet everywhere, so
      // this stays optional — the render below falls back to inferring "demo
      // account" from authUser?.company?.is_demo when the reason is absent.
      setEmailStatus({ sent: !!data.email_sent, address: data.customer_email || null, reason: data.email_skipped_reason || null });
      toast.success('Share link ready — copy and send to your customer');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.setQueryData(['quotes'], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const o = old as Record<string, unknown>;
        const items = (o.results as unknown[] | undefined) || (old as unknown[]);
        const updated = (items as Record<string, unknown>[]).map((q) =>
          String(q.id) === String(id) ? { ...q, status: 'SENT' } : q
        );
        return o.results ? { ...o, results: updated } : updated;
      });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to generate share link');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteData({ url: `api/v1/quotes/${id}/` }),
    onSuccess: () => {
      navigate('/bookings/quotes');
    },
  });

  const convertToLoadMutation = useMutation({
    mutationFn: ({ driverId, vehicleId }: { driverId: string; vehicleId: string }) =>
      postData({
        url: `api/v1/quotes/${id}/convert_to_load/`,
        data: { driver_id: driverId, vehicle_id: vehicleId },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] });
      setShowConvertModal(false);
      toast.success('Quote converted to booking');
      if (data?.id) {
        navigate(`/bookings/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to convert quote to booking');
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: (data: { outcome: string; rejection_reason?: string; final_price?: number }) =>
      patchData({ url: `api/v1/quotes/${id}/outcome/`, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowOutcomeModal(false);
      setOutcomeType(null);
      setRejectionReason('');
      setCustomRejectionReason('');
      setFinalPrice('');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save outcome');
    },
  });

  const handleDelete = () => {
    setConfirmOpts({
      title: 'Delete quote',
      message: `Delete ${quote?.quote_number}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteMutation.mutate(),
    });
  };

  const handleConvertToLoad = () => {
    setShowConvertModal(true);
  };

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (error || !quote) {
    return (
      <div className="bk-detail">
        <button type="button" className="bk-back" onClick={() => navigate('/bookings/quotes')}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to quotes
        </button>
        <div className="bk-card">
          <div className="bk-empty" style={{ padding: 16 }}>
            <h1 className="bk-empty__title">Quote not found</h1>
            <p className="bk-empty__text">It may have been deleted, or the link is out of date.</p>
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => navigate('/bookings/quotes')}>View quotes</button>
          </div>
        </div>
      </div>
    );
  }

  // The share link/email status persist even outside this mutation's own
  // session — a quote can land on SENT via the status dropdown or a Kanban
  // drag, not just this page's "Send to customer" button — so fall back to
  // deriving them from the quote itself (its token + customer_email) once
  // it's SENT, instead of only showing them right after clicking the button.
  const effectiveShareUrl = shareUrl || (quote.status === 'SENT' && quote.token
    ? `${window.location.origin}/quotes/view/${quote.id}/${quote.token}`
    : null);
  const effectiveEmailStatus = emailStatus || (quote.status === 'SENT'
    ? { sent: !!quote.customer_email, address: quote.customer_email || null, reason: null }
    : null);
  // Backend may not send an explicit email_skipped_reason yet (a parallel
  // task is wiring it up) — until it does, infer "demo account" from
  // authUser.is_demo (see AuthContext.tsx) so the shared public demo doesn't
  // show a misleading "no email on file" message for customers that DO have
  // a real-looking email but are never actually emailed.
  const isDemoEmailSkip = effectiveEmailStatus
    ? effectiveEmailStatus.reason
      ? effectiveEmailStatus.reason === 'demo_mode'
      : !!authUser?.is_demo
    : false;

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: '20px',
    minHeight: 40,
    width: '100%',
    fontFamily: 'var(--font-sans)',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px',
    fontWeight: 500, letterSpacing: 'normal', color: 'var(--text-secondary)',
  };
  const sectionHeadingStyle: React.CSSProperties = {
    margin: 0, fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: '24px',
    fontWeight: 600, letterSpacing: 'normal', color: 'var(--text-primary)',
  };
  const label = (text: string) => (
    <div style={{ ...fieldLabelStyle, marginBottom: 6 }}>
      {text}
    </div>
  );

  return (
    <div className="bk-detail">
      {/* Header — identity on the left, the quoted amount on the right */}
      <button type="button" className="bk-back" onClick={() => navigate('/bookings/quotes')}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to quotes
      </button>
      <div className="bk-detail-header">
        <div className="bk-detail-header__titles">
          <div className="bk-eyebrow">Bookings · Quote</div>
          <div className="bk-title-row">
            <h1 className="bk-title">{quote.quote_number}</h1>
            <span className={`bk-status bk-status--${STATUS_TONE[quote.status] || 'neutral'}`}>
              {STATUS_LABEL[quote.status] || sentenceCase(quote.status)}
            </span>
            {quote.outcome === 'accepted' && <span className="bk-status bk-status--success">Won</span>}
            {quote.outcome === 'rejected' && <span className="bk-status bk-status--danger">Lost</span>}
          </div>
          <p className="bk-subtitle">{quote.customer_name}</p>
        </div>
        <div className="bk-amount">
          <span className="bk-amount__label">{quote.trip_type === 'ROUND_TRIP' ? 'Total (both legs)' : 'Total amount'}</span>
          <span className="bk-amount__value">{formatCurrency(parseFloat(quote.total_amount || '0'))}</span>
        </div>
      </div>

      {/* UPGRADE 2: Fuel Delta Alert */}
      {fuelAlert && fuelAlert.has_alert && (
        <div role="status" style={{ padding: '16px 20px', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', borderRadius: 8, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <AlertTriangle size={20} color="var(--status-warning-text, var(--status-warning))" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 600, color: 'var(--status-warning-text, var(--status-warning))', marginBottom: 4 }}>
                Fuel price alert
              </div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {fuelAlert.message || `Diesel up R${fuelAlert.fuel_delta_zar?.toFixed(2)}/L since this quote was created. This job now costs ~R${Math.round(fuelAlert.estimated_cost_impact).toLocaleString()} more.`}
              </div>
              {fuelAlert.action && (
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  {fuelAlert.action}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="quote-detail-grid">
        {/* LEFT — Quote Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: 14 }}>Customer</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px' }}>
              <div>
                <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>Name</div>
                <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{quote.customer_name || '—'}</div>
              </div>
              {quote.customer_company && (
                <div>
                  <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>Company</div>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.customer_company}</div>
                </div>
              )}
              {quote.customer_email && (
                <div>
                  <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.customer_email}</div>
                </div>
              )}
              {quote.customer_phone && (
                <div>
                  <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>Phone</div>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.customer_phone}</div>
                </div>
              )}
              {quote.customer_city && (
                <div>
                  <div style={{ ...fieldLabelStyle, marginBottom: 4 }}>City</div>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.customer_city}</div>
                </div>
              )}
            </div>
          </div>

          {/* Route */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>
                {quote.trip_type === 'ROUND_TRIP' ? 'Leg 1 — Outbound route' : 'Route'}
              </h2>
              {quote.trip_type === 'ROUND_TRIP' && (
                <span className="bk-status bk-status--info">
                  Round trip
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                {label('Pickup location')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.pickup_location || '—'}</div>
              </div>

              {Array.isArray(quote.stops) && quote.stops.map((s: { location: string }, i: number) => (
                <div key={i} style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16 }}>
                  <div style={{ ...fieldLabelStyle, marginBottom: 2 }}>
                    Stop {i + 1}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{s.location}</div>
                </div>
              ))}

              <div>
                {label('Delivery location')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.delivery_location || '—'}</div>
              </div>
            </div>

            {(quote.pickup_lat || quote.delivery_lat) && (
              <div style={{ marginTop: 16 }}>
                <ExpandableRouteMap
                  pickup={quote.pickup_location}
                  delivery={quote.delivery_location}
                  pickupCoords={quote.pickup_lat ? { lat: Number(quote.pickup_lat), lon: Number(quote.pickup_lng) } : undefined}
                  deliveryCoords={quote.delivery_lat ? { lat: Number(quote.delivery_lat), lon: Number(quote.delivery_lng) } : undefined}
                  stops={Array.isArray(quote.stops) ? quote.stops.map((s: { location: string; lat: number; lon: number }) => ({ lat: Number(s.lat), lon: Number(s.lon), label: s.location })) : undefined}
                  geometry={Array.isArray(quote.route_geometry) && quote.route_geometry.length > 1 ? quote.route_geometry.map((p: { lat: number; lon: number }) => [Number(p.lat), Number(p.lon)] as [number, number]) : undefined}
                  height={220}
                  dialogStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
                />
              </div>
            )}
          </div>

          {/* Return Leg — visible only for ROUND_TRIP quotes */}
          {quote.trip_type === 'ROUND_TRIP' && (
            <div className="card" style={{ padding: 24, borderRadius: 8, borderLeft: '3px solid var(--accent-primary)' }}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 16 }}>
                Leg 2 — Return route
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px' }}>
                <div>
                  {label('Returns from')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.delivery_location || '—'}</div>
                </div>
                <div>
                  {label('Return destination')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.return_location || '—'}</div>
                </div>
                <div>
                  {label('Return cargo')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: quote.return_cargo ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {quote.return_cargo || 'Empty return'}
                  </div>
                </div>
                {quote.return_date && (
                  <div>
                    {label('Return date')}
                    <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-primary)' }}>
                      {formatDate(quote.return_date)}
                    </div>
                  </div>
                )}
                {quote.return_base_rate && parseFloat(quote.return_base_rate) > 0 && (
                  <div>
                    {label('Return rate')}
                    <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(parseFloat(quote.return_base_rate))}
                    </div>
                  </div>
                )}
                {quote.return_notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    {label('Return notes')}
                    <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)' }}>{quote.return_notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cargo Details */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: 16 }}>Cargo details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px' }}>
              <div>
                {label('Description')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.cargo_description || '—'}</div>
              </div>
              <div>
                {label('Vehicle type')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.vehicle_type || '—'}</div>
              </div>
              <div>
                {label('Weight (kg)')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.weight ? parseFloat(quote.weight).toLocaleString() : '—'}</div>
              </div>
              <div>
                {label('Distance (km)')}
                <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.distance ? Math.round(parseFloat(quote.distance)).toLocaleString() : '—'}</div>
              </div>
              {quote.vehicle_display && (
                <div>
                  {label('Assigned vehicle')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.vehicle_display}</div>
                </div>
              )}
              {quote.driver_display && (
                <div>
                  {label('Assigned driver')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.driver_display}</div>
                </div>
              )}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: 16 }}>Cost breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const fuel = parseFloat(quote.fuel_surcharge || '0');
                const toll = parseFloat(quote.toll_charges || '0');
                const driver = parseFloat(quote.driver_allowance || '0');
                const additional = parseFloat(quote.additional_charges || '0');
                const baseRate = parseFloat(quote.base_rate || '0');

                // Mirrors the quote builder's own breakdown exactly — base_rate,
                // fuel_surcharge, toll_charges, driver_allowance and
                // additional_charges are the only cost fields the backend
                // actually stores (they sum to total_amount). This used to
                // derive a "Service Charge" as total minus the other four,
                // which is mathematically just base_rate under a wrong label.
                const rows = [
                  { label: 'Fuel surcharge', value: fuel },
                  { label: 'Toll charges', value: toll },
                  { label: 'Driver allowance', value: driver },
                  ...(additional > 0 ? [{ label: 'Additional charges', value: additional }] : []),
                  { label: 'Base rate', value: baseRate },
                ];

                return rows.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', textAlign: 'right' }}>
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ));
              })()}
              {quote.trip_type === 'ROUND_TRIP' && quote.return_base_rate && parseFloat(quote.return_base_rate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--accent-primary)' }}>
                  <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                    Return leg ({quote.return_cargo ? 'with cargo' : 'empty return'})
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', textAlign: 'right' }}>
                    {formatCurrency(parseFloat(quote.return_base_rate))}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {quote.trip_type === 'ROUND_TRIP' ? 'Total (both legs)' : 'Total amount'}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'anywhere', textAlign: 'right' }}>
                  {formatCurrency(parseFloat(quote.total_amount || '0'))}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="card" style={{ padding: 24, borderRadius: 8 }}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>Notes</h2>
              <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{quote.notes}</div>
            </div>
          )}
        </div>

        {/* RIGHT — Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>Quote info</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                {label('Quote number')}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px', color: 'var(--text-primary)' }}>{quote.quote_number}</div>
              </div>
              <div>
                {label('Status')}
                <Select value={quote.status} onValueChange={(val) => statusMutation.mutate(val)} disabled={statusMutation.isPending || billingBlocked}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                    {/* Not selectable — In-Transit/Completed now live on the Order created via
                        "Convert to booking", not on the quote itself (the backend rejects a
                        direct write to either anyway). Kept as SelectItems only so a quote that
                        already carries one of these legacy statuses still displays correctly. */}
                    {(quote.status === 'IT' || quote.status === 'COMPLETED') && (
                      <SelectItem value={quote.status}>{STATUS_LABEL[quote.status]}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {billingBlocked && (
                  <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text, var(--status-danger))', marginTop: 4 }} title={subscriptionStatusDetail(authUser?.subscription_status)}>
                    Status changes are blocked —{' '}
                    <button type="button" className="bk-link" onClick={() => navigate('/settings/billing')}>
                      go to billing
                    </button>
                  </div>
                )}
              </div>
              <div>
                {label('Confidence')}
                <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: quote.confidence === 'HIGH' ? 'var(--status-success-text, var(--status-success))' : quote.confidence === 'LOW' ? 'var(--status-danger-text, var(--status-danger))' : 'var(--status-warning-text, var(--status-warning))' }}>
                  {sentenceCase(quote.confidence)}
                </div>
              </div>
              <div>
                {label('Margin')}
                <div style={{ fontSize: 14, lineHeight: '20px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{quote.margin_percentage || 0}%</div>
              </div>
              {quote.valid_until && (
                <div>
                  {label('Valid until')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>
                    {formatDate(quote.valid_until)}
                    {new Date(quote.valid_until).getTime() - Date.now() < 48 * 60 * 60 * 1000 && (
                      <span style={{ color: 'var(--status-danger-text, var(--status-danger))', marginLeft: 8 }}>
                        {new Date(quote.valid_until).getTime() <= Date.now()
                          ? '(expired)'
                          : `(${Math.ceil((new Date(quote.valid_until).getTime() - Date.now()) / (1000 * 60 * 60))}h left)`}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {quote.created_at && (
                <div>
                  {label('Created')}
                  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>
                    {formatDate(quote.created_at)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* UPGRADE 3: Win Probability Display */}
          {quote.win_probability && (quote.status === 'DRAFT' || quote.status === 'SENT') && (
            <div className="card" style={{ padding: 24, borderRadius: 8 }}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>Win probability</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    // quote.win_probability is already stored 0-100 (QuoteBuilder
                    // converts the model's 0-1 fraction before saving) — do not
                    // multiply by 100 again here.
                    width: `${Math.min(Number(quote.win_probability), 100)}%`,
                    height: '100%',
                    background: quote.win_probability >= 70 ? 'var(--status-success-text, var(--status-success))' : quote.win_probability >= 40 ? 'var(--status-warning)' : 'var(--status-danger)',
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 28, lineHeight: '36px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {Math.round(Number(quote.win_probability))}%
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                Estimated chance of winning at current price
              </div>
            </div>
          )}

          {/* UPGRADE 1: Outcome Buttons */}
          {(quote.status === 'SENT' || quote.status === 'DRAFT') && !quote.outcome && (
            <div className="card" style={{ padding: 24, borderRadius: 8 }}>
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>Mark outcome</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setOutcomeType('accepted');
                    setFinalPrice(String(quote.total_amount || ''));
                    setShowOutcomeModal(true);
                  }}
                  className="bk-btn bk-btn--success-outline"
                  style={{ flex: 1 }}
                >
                  Mark accepted
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutcomeType('rejected');
                    setShowOutcomeModal(true);
                  }}
                  className="bk-btn bk-btn--danger-outline"
                  style={{ flex: 1 }}
                >
                  Mark rejected
                </button>
              </div>
            </div>
          )}

          {/* Actions — primary next step first, secondary tools, destructive last */}
          <div className="card" style={{ padding: 24, borderRadius: 8 }}>
            <h2 style={{ ...sectionHeadingStyle, marginBottom: 16 }}>Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quote.status === 'ACCEPTED' && (
                <button
                  type="button"
                  className="bk-btn bk-btn--primary bk-btn--block"
                  onClick={handleConvertToLoad}
                  disabled={convertToLoadMutation.isPending}
                >
                  {convertToLoadMutation.isPending ? 'Converting…' : 'Convert to booking'}
                </button>
              )}

              {/* Send to Customer — status SENT now sends automatically no
                  matter how it got there (this button, a status-dropdown
                  change, or a Kanban drag), so once a quote is already SENT
                  this becomes an explicit resend rather than the first send. */}
              <button
                type="button"
                className={`bk-btn bk-btn--block ${quote.status === 'ACCEPTED' ? 'bk-btn--secondary' : 'bk-btn--primary'}`}
                onClick={() => sendToCustomerMutation.mutate()}
                disabled={sendToCustomerMutation.isPending}
              >
                {sendToCustomerMutation.isPending
                  ? (quote.status === 'SENT' ? 'Resending…' : 'Generating…')
                  : (quote.status === 'SENT' ? 'Resend to customer' : 'Send to customer')}
              </button>

              {effectiveShareUrl && (
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'var(--bg-deep)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  lineHeight: '20px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>Share link</div>
                  <div style={{
                    wordBreak: 'break-all',
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                    fontSize: 13,
                    lineHeight: '20px',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {effectiveShareUrl}
                  </div>
                  {effectiveEmailStatus && (
                    <div style={{
                      color: effectiveEmailStatus.sent ? 'var(--status-success-text, var(--status-success))' : 'var(--status-warning-text, var(--status-warning))',
                      marginBottom: 12,
                      fontSize: 13,
                      lineHeight: '20px',
                    }}>
                      {effectiveEmailStatus.sent
                        ? `Quote emailed to ${effectiveEmailStatus.address}`
                        : isDemoEmailSkip
                          ? 'Demo mode — link generated, no real email is sent.'
                          : 'Could not email the customer — no email on file. Share the link below instead.'}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(effectiveShareUrl);
                        toast.success('Link copied to clipboard');
                      }}
                      className="bk-btn bk-btn--secondary bk-btn--block"
                    >
                      Copy link
                    </button>
                    <a
                      href={buildWhatsAppShareUrl(
                        quote.customer_phone,
                        `Hi${quote.customer_name ? ` ${quote.customer_name}` : ''}, here's your freight quote${quote.quote_number ? ` (${quote.quote_number})` : ''} from TruckWys: ${effectiveShareUrl}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bk-btn bk-btn--whatsapp bk-btn--block"
                      style={{ boxSizing: 'border-box' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.892.526 3.708 1.523 5.29L2 22l4.828-1.494A9.953 9.953 0 0012.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.062a8.03 8.03 0 01-4.284-1.236l-.307-.183-3.194.988.99-3.13-.2-.32A8.02 8.02 0 013.938 12c0-4.452 3.612-8.062 8.063-8.062 4.45 0 8.061 3.61 8.061 8.062 0 4.452-3.61 8.062-8.061 8.062z" />
                      </svg>
                      Share via WhatsApp
                    </a>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="bk-btn bk-btn--secondary bk-btn--block"
                onClick={() => navigate(`/bookings/quotes/${id}/edit`)}
              >
                Edit quote
              </button>

              {/* PDF Download */}
              <button
                type="button"
                onClick={() => {
                  downloadBlob(`api/v1/quotes/${id}/generate_pdf/`)
                    .then(blob => {
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `Quote-${quote?.quote_number || id}.pdf`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    })
                    .catch((e: any) => toast.error(e?.message || 'PDF download failed'));
                }}
                className="bk-btn bk-btn--secondary bk-btn--block"
              >
                <Download size={16} aria-hidden="true" /> Download PDF
              </button>

              <hr className="bk-divider" />

              <button
                type="button"
                className="bk-btn bk-btn--danger-outline bk-btn--block"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete quote'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* UPGRADE 1: Outcome Modal */}
      {showOutcomeModal && outcomeType && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowOutcomeModal(false)}
        >
          <div
            className="bk-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={outcomeType === 'accepted' ? 'Mark quote as accepted' : 'Mark quote as rejected'}
            style={{ margin: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, lineHeight: '24px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
              {outcomeType === 'accepted' ? 'Mark quote as accepted' : 'Mark quote as rejected'}
            </h2>

            {outcomeType === 'accepted' && (
              <div style={{ marginBottom: 0 }}>
                {label('Final price agreed (optional)')}
                <input
                  className="qi-input"
                  type="number"
                  value={finalPrice}
                  onChange={e => setFinalPrice(e.target.value)}
                  placeholder={String(quote?.total_amount || '')}
                  style={inputStyle}
                />
                <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 6 }}>
                  Leave blank to use quote total: {formatCurrency(parseFloat(quote?.total_amount || '0'))}
                </div>
              </div>
            )}

            {outcomeType === 'rejected' && (
              <div style={{ marginBottom: 0 }}>
                {label('Rejection reason')}
                <Select value={rejectionReason} onValueChange={setRejectionReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Price too high">Price too high</SelectItem>
                    <SelectItem value="Went with competitor">Went with competitor</SelectItem>
                    <SelectItem value="Job cancelled">Job cancelled</SelectItem>
                    <SelectItem value="Other">Other (please specify)</SelectItem>
                  </SelectContent>
                </Select>
                {rejectionReason === 'Other' && (
                  <input
                    className="qi-input"
                    type="text"
                    placeholder="Please specify reason"
                    value={customRejectionReason}
                    onChange={e => setCustomRejectionReason(e.target.value)}
                    style={{ ...inputStyle, marginTop: 12 }}
                  />
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowOutcomeModal(false);
                  setOutcomeType(null);
                  setRejectionReason('');
                  setCustomRejectionReason('');
                  setFinalPrice('');
                }}
                type="button"
                className="bk-btn bk-btn--secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const data: any = { outcome: outcomeType };
                  if (outcomeType === 'rejected' && rejectionReason) {
                    data.rejection_reason = rejectionReason === 'Other' ? customRejectionReason : rejectionReason;
                  }
                  if (outcomeType === 'accepted' && finalPrice) {
                    data.final_price = parseFloat(finalPrice);
                  }
                  outcomeMutation.mutate(data);
                }}
                disabled={outcomeType === 'rejected' && (!rejectionReason || (rejectionReason === 'Other' && !customRejectionReason))}
                type="button"
                className={`bk-btn ${outcomeType === 'accepted' ? 'bk-btn--primary' : 'bk-btn--danger'}`}
                style={{ flex: 1 }}
              >
                {outcomeMutation.isPending ? 'Saving…' : outcomeType === 'accepted' ? 'Mark accepted' : 'Mark rejected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpts && (
        <ConfirmModal
          title={confirmOpts.title}
          message={confirmOpts.message}
          confirmLabel={confirmOpts.confirmLabel}
          danger={confirmOpts.danger}
          onConfirm={confirmOpts.onConfirm}
          onCancel={() => setConfirmOpts(null)}
        />
      )}

      {showConvertModal && (
        <ConvertToBookingModal
          quoteNumber={quote?.quote_number}
          vehicleType={quote?.vehicle_type}
          busy={convertToLoadMutation.isPending}
          onConfirm={(driverId, vehicleId) => convertToLoadMutation.mutate({ driverId, vehicleId })}
          onCancel={() => setShowConvertModal(false)}
        />
      )}
    </div>
  );
}
