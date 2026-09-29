import './quote-detail-responsive.css';
import './quote-invoice-roles.css';
import './bookings-section.css';
import { useState, useEffect, useCallback } from 'react';
import { useMapFill } from './useMapFill';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, deleteData, postData, downloadBlob } from '@/lib/Api';
import { formatCurrency, formatDate, formatDistance, formatMoney, formatMoneyWhole, formatNumber, formatPercent, normaliseFigures, sentenceCaseLabel } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConvertToBookingModal } from '@/components/ConvertToBookingModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { isSubscriptionBlocked, subscriptionStatusDetail } from '@/lib/subscriptionStatus';
import { ExpandableRouteMap } from '@/components/ExpandableRouteMap';
import { Download, FileSearch } from 'lucide-react';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import QuoteSendPreview from '@/components/QuoteSendPreview';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import SectionHeader from '@/components/layout/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { useStickyRail } from '@/components/fleet-detail/useStickyRail';
import { StatusMenu, type StatusOption } from '@/components/fleet-detail/StatusMenu';
import { BlockSkeleton } from '@/components/fleet-detail/ContentSkeleton';

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
  const stickyRail = useStickyRail<HTMLDivElement>();
  // Columns end within 48px (R6): the route map takes up the difference.
  // Still long at the smallest map: the customer's contact facts move to the rail.
  const [contactInRail, setContactInRail] = useState(false);
  const fill = useMapFill({ base: 200, min: 160, max: 440, onStuck: () => setContactInRail(true) });
  const railRef = useCallback((node: HTMLDivElement | null) => { fill.sideRef.current = node; stickyRail(node); }, [stickyRail, fill.sideRef]);
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
  useFocusTrap(latestModal, showOutcomeModal && !!outcomeType);
  // Sending (button or status change to Sent) emails the customer: preview first.
  const [sendPreview, setSendPreview] = useState<'button' | 'status' | null>(null);

  const quoteQuery = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchData(`api/v1/quotes/${id}/`),
    // A 404 is an answer, not a failure: no retry, straight to "not found".
    retry: (count, err) => (err as { status?: number } | null)?.status !== 404 && count < 1,
  });
  const { data: quote, isLoading, error } = quoteQuery;
  const quoteFailed = loadFailed(quoteQuery);
  const quoteError = (quoteQuery.error ?? quoteQuery.failureReason) as { status?: number } | null;

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
      toast.success('Share link ready. Copy it and send it to your customer.');
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

  // A failed request is not a missing quote: only a 404 says "not found".
  if (quoteFailed && quoteError?.status !== 404) {
    return (
      <div className="bk-detail">
        <SectionHeader title="Quote" back={{ to: '/bookings/quotes', label: 'Quotes' }} />
        <LoadError what="this quote" error={quoteError} busy={quoteQuery.isFetching} onRetry={() => quoteQuery.refetch()} />
      </div>
    );
  }

  // Loading: the back link and page frame stay; only the content waits.
  if (isLoading) {
    return (
      <div className="bk-detail">
        <SectionHeader
          title="Loading quote"
          back={{ to: '/bookings/quotes', label: 'Quotes' }}
        />
        <BlockSkeleton height={420} label="Loading quote" />
      </div>
    );
  }

  // Not found (404): the head and back link stay; the message and its one
  // action share a row, like the load-error state (the invoice pattern).
  if (error || !quote) {
    return (
      <div className="bk-detail">
        <SectionHeader title="Quote not found" back={{ to: '/bookings/quotes', label: 'Quotes' }} />
        <div className="load-error bk-missing" role="status">
          <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
          <div className="load-error__text">
            <p className="load-error__title">There is no quote at this link</p>
            <p className="load-error__hint">It may have been deleted, or the link is wrong.</p>
          </div>
          <button type="button" className="tw-btn load-error__retry" onClick={() => navigate('/bookings/quotes')}>All quotes</button>
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
    borderRadius: 'var(--radius-control, 8px)',
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

  // One figure system: "R 28 662,00", "55,0%", "12 000 kg", "1 234 km".
  const total = parseFloat(quote.total_amount || '0');
  const marginText = quote.margin_percentage != null && quote.margin_percentage !== '' ? formatPercent(quote.margin_percentage, 1) : null;
  const isRound = quote.trip_type === 'ROUND_TRIP';
  // Company first; the contact name only when it is a different person.
  const company = (quote.customer_company || '').trim() || quote.customer_name || '';
  // "Durban Harbour, Durban" -> the city when the API gives it, else the first part.
  const placeShort = (city?: string, loc?: string) => (city || '').trim() || String(loc || '').split(',')[0].trim();
  const routeFrom = placeShort(quote.pickup_city, quote.pickup_location);
  const routeTo = placeShort(quote.delivery_city, quote.delivery_location);
  const showWinChance = !!quote.win_probability && (quote.status === 'DRAFT' || quote.status === 'SENT');
  const routeSummary = routeFrom && routeTo ? `${routeFrom} → ${routeTo}` : '';
  const contact = (quote.customer_name || '').trim();
  const showContact = !!contact && contact.toLowerCase() !== company.toLowerCase();
  // Emails break at "@" and dots, never mid-word ("co.z / a").
  const breakableEmail = (email: string) => {
    const parts = email.split(/(?=[@.])/);
    return parts.map((p, i) => <span key={i}>{i > 0 && <wbr />}{p}</span>);
  };
  const validUntil = quote.valid_until ? new Date(quote.valid_until).getTime() : null;
  const validNote = validUntil == null ? null
    : validUntil <= Date.now() ? 'expired'
    : validUntil - Date.now() < 48 * 3600_000 ? `${Math.ceil((validUntil - Date.now()) / 3600_000)} h left`
    : null;
  // Fuel: a compact note built from the numbers, in the house format.
  const fuelDelta = Number(fuelAlert?.fuel_delta_zar);
  const fuelImpact = Number(fuelAlert?.estimated_cost_impact);
  const fuelNote = fuelAlert?.has_alert
    ? (Number.isFinite(fuelDelta) && Number.isFinite(fuelImpact)
      ? `Diesel is up ${formatMoney(fuelDelta)}/L since this quote was made, so the job costs about ${formatMoneyWhole(fuelImpact)} more.`
      : normaliseFigures(fuelAlert.message))
    : null;
  const fact = (term: string, value: React.ReactNode, wide = false) => (
    <div className={wide ? 'qd-fact qd-fact--wide' : 'qd-fact'}>
      <dt className="bk-fact__label">{term}</dt>
      <dd className="bk-fact__value">{value}</dd>
    </div>
  );
  const priceRows = [
    { label: 'Base rate', value: parseFloat(quote.base_rate || '0') },
    { label: 'Fuel surcharge', value: parseFloat(quote.fuel_surcharge || '0') },
    { label: 'Toll charges', value: parseFloat(quote.toll_charges || '0') },
    { label: 'Driver allowance', value: parseFloat(quote.driver_allowance || '0') },
    ...(parseFloat(quote.additional_charges || '0') > 0 ? [{ label: 'Additional charges', value: parseFloat(quote.additional_charges) }] : []),
    ...(isRound && quote.return_base_rate && parseFloat(quote.return_base_rate) > 0
      ? [{ label: `Return leg (${quote.return_cargo ? 'with cargo' : 'empty'})`, value: parseFloat(quote.return_base_rate) }] : []),
  ];
  const statusOptions: StatusOption[] = [
    { value: 'DRAFT', label: 'Draft', hint: 'Not offered to the customer yet' },
    { value: 'SENT', label: 'Sent', hint: 'Emails the quote to the customer' },
    { value: 'ACCEPTED', label: 'Accepted', hint: 'Ready to convert to a booking' },
    { value: 'DECLINED', label: 'Declined' },
    // In transit and Completed live on the order created by "Convert to
    // booking"; the backend rejects a direct write. Listed only so a legacy
    // quote that carries one still shows it as current.
    ...((quote.status === 'IT' || quote.status === 'COMPLETED') ? [{ value: quote.status, label: STATUS_LABEL[quote.status], disabledReason: 'Set by the booking' }] : []),
  ];

  return (
    <div className="bk-detail qd">
      <SectionHeader
        title={quote.quote_number}
        back={{ to: '/bookings/quotes', label: 'Quotes' }}
        // Phones (R5): the chips move to the start of the subtitle so the
        // title row holds the quote number and the one primary action.
        titleAdornment={<span className="qd-head-chips"><StatusChip status={quote.status} label={STATUS_LABEL[quote.status]} />
            {quote.outcome === 'accepted' && quote.status !== 'ACCEPTED' && <StatusChip status="WON" />}
            {quote.outcome === 'rejected' && quote.status !== 'DECLINED' && <StatusChip status="LOST" />}</span>}
        // The subtitle reads as the job: customer, then the route (never the
        // customer's own city, which read as a destination).
        description={<><span className="qd-desc-chips"><StatusChip status={quote.status} label={STATUS_LABEL[quote.status]} size="sm" />
            {quote.outcome === 'accepted' && quote.status !== 'ACCEPTED' && <StatusChip status="WON" size="sm" />}
            {quote.outcome === 'rejected' && quote.status !== 'DECLINED' && <StatusChip status="LOST" size="sm" />}</span>{company}{routeSummary && <span className="qd-desc-route">{company ? ' · ' : ''}{routeSummary}</span>}</>}
        actions={<>
          <StatusMenu
            subject={quote.quote_number}
            current={quote.status}
            options={statusOptions}
            busy={statusMutation.isPending}
            disabledReason={billingBlocked ? `Status changes are blocked. ${subscriptionStatusDetail(authUser?.subscription_status) || ''}`.trim() : undefined}
            // Moving to Sent emails the customer: preview and confirm there.
            intercept={(v) => { if (v === 'SENT' && quote.status !== 'SENT') { setSendPreview('status'); return true; } return false; }}
            onChange={(v) => statusMutation.mutate(v)}
          />
          <button type="button" className="bk-btn bk-btn--secondary qd-head-edit" onClick={() => navigate(`/bookings/quotes/${id}/edit`)}>
            Edit quote
          </button>
          {quote.status === 'ACCEPTED' ? (
            <button type="button" className="bk-btn bk-btn--primary" onClick={handleConvertToLoad} disabled={convertToLoadMutation.isPending} aria-label={convertToLoadMutation.isPending ? undefined : 'Convert to booking'}>
              {convertToLoadMutation.isPending ? 'Converting…' : <span className="qd-label-long" data-short="Convert">Convert to booking</span>}
            </button>
          ) : (
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => setSendPreview('button')} disabled={sendToCustomerMutation.isPending} aria-label={sendToCustomerMutation.isPending ? undefined : (quote.status === 'SENT' ? 'Resend to customer' : 'Send to customer')}>
              {sendToCustomerMutation.isPending
                ? (quote.status === 'SENT' ? 'Resending…' : 'Generating…')
                // Phones: the short label keeps it on the title row (R5); the
                // full label stays as its accessible name.
                : <span className="qd-label-long" data-short={quote.status === 'SENT' ? 'Resend' : 'Send'}>{quote.status === 'SENT' ? 'Resend to customer' : 'Send to customer'}</span>}
            </button>
          )}
        </>}
      />
      {billingBlocked && (
        <p className="bk-help bk-help--danger" style={{ margin: '-12px 0 16px' }} title={subscriptionStatusDetail(authUser?.subscription_status)}>
          Status changes are blocked.{' '}
          <button type="button" className="bk-link" onClick={() => navigate('/settings/billing')}>Go to billing</button>
        </p>
      )}

      <div className="quote-detail-grid">
        {/* LEFT: the job in one card (customer, route, cargo), then the map. */}
        <div ref={fill.mainRef as React.RefObject<HTMLDivElement>} className="qd-main">
          <section className="bk-card" aria-labelledby="qd-job-title">
            <div className="bk-card__head"><h2 className="bk-card__title" id="qd-job-title">Job</h2></div>
            {!contactInRail && <>
              <dl className="qd-facts">
                {fact('Customer', company || 'Not recorded')}
                {showContact && fact('Contact', contact)}
                {quote.customer_email && <div className="qd-fact qd-fact--email"><dt className="bk-fact__label">Email</dt><dd className="bk-fact__value"><span className="qd-email">{breakableEmail(quote.customer_email)}</span></dd></div>}
                {quote.customer_phone && fact('Phone', quote.customer_phone)}
              </dl>
              <hr className="qd-rule" />
            </>}
            <div className="qd-route-row">
              <div>
                <div className="bk-fact__label" style={{ marginBottom: 8 }}>{isRound ? 'Leg 1, outbound' : 'Route'}</div>
                <ol className="bk-route">
                  <li className="bk-route__stop">
                    <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                    <div><div className="bk-route__label">Pickup</div><div className="bk-route__place">{quote.pickup_location || 'Not recorded'}</div></div>
                  </li>
                  {Array.isArray(quote.stops) && quote.stops.map((s: { location: string }, i: number) => (
                    <li key={i} className="bk-route__stop">
                      <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                      <div><div className="bk-route__label">Stop {i + 1}</div><div className="bk-route__place">{s.location}</div></div>
                    </li>
                  ))}
                  <li className="bk-route__stop">
                    <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                    <div><div className="bk-route__label">Delivery</div><div className="bk-route__place">{quote.delivery_location || 'Not recorded'}</div></div>
                  </li>
                </ol>
              </div>
              {isRound && (
                <div>
                  <div className="bk-fact__label" style={{ marginBottom: 8 }}>Leg 2, return</div>
                  <ol className="bk-route">
                    <li className="bk-route__stop">
                      <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                      <div><div className="bk-route__label">Returns from</div><div className="bk-route__place">{quote.delivery_location || 'Not recorded'}</div></div>
                    </li>
                    <li className="bk-route__stop">
                      <span className="bk-route__marker" aria-hidden="true"><span className="bk-route__pin" /><span className="bk-route__line" /></span>
                      <div>
                        <div className="bk-route__label">Return destination</div>
                        <div className="bk-route__place">{quote.return_location || 'Not recorded'}</div>
                        <div className="bk-route__meta">
                          {quote.return_cargo || 'Empty return'}{quote.return_date ? ` · ${formatDate(quote.return_date)}` : ''}
                        </div>
                      </div>
                    </li>
                  </ol>
                </div>
              )}
            </div>
            <hr className="qd-rule" />
            <dl className="qd-facts">
              {fact('Cargo', quote.cargo_description ? String(quote.cargo_description).replace(/^\s*\S/, (c: string) => c.toUpperCase()) : 'Not recorded')}
              {fact('Truck type', sentenceCaseLabel(quote.vehicle_type) || 'Not recorded')}
              {fact('Weight', quote.weight ? `${formatNumber(parseFloat(quote.weight))} kg` : 'Not recorded')}
              {fact('Distance', quote.distance ? formatDistance(parseFloat(quote.distance)) : 'Not recorded')}
              {quote.pickup_date && fact('Pickup date', formatDate(quote.pickup_date))}
              {quote.vehicle_display && fact('Vehicle', quote.vehicle_display)}
              {quote.driver_display && fact('Driver', quote.driver_display)}
              {isRound && quote.return_notes && fact('Return notes', quote.return_notes, true)}
              {quote.notes && fact('Notes', <span style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{quote.notes}</span>, true)}
            </dl>
          </section>

          {(quote.pickup_lat || quote.delivery_lat) ? (
            <section className="bk-card qd-map" aria-label="Route map">
              <ExpandableRouteMap
                pickup={quote.pickup_location}
                delivery={quote.delivery_location}
                pickupCoords={quote.pickup_lat ? { lat: Number(quote.pickup_lat), lon: Number(quote.pickup_lng) } : undefined}
                deliveryCoords={quote.delivery_lat ? { lat: Number(quote.delivery_lat), lon: Number(quote.delivery_lng) } : undefined}
                stops={Array.isArray(quote.stops) ? quote.stops.map((s: { location: string; lat: number; lon: number }) => ({ lat: Number(s.lat), lon: Number(s.lon), label: s.location })) : undefined}
                geometry={Array.isArray(quote.route_geometry) && quote.route_geometry.length > 1 ? quote.route_geometry.map((p: { lat: number; lon: number }) => [Number(p.lat), Number(p.lon)] as [number, number]) : undefined}
                height={fill.height}
                dialogStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-dialog, 16px)', boxShadow: 'none' }}
              />
            </section>
          ) : (
            // No coordinates (older quotes): say so in the map's place, at the
            // height that keeps the two columns ending together (R6).
            <section className="bk-card qd-map qd-map--empty" aria-label="Route map" style={{ height: fill.height }}>
              <p className="bk-help">No map for this quote: its addresses have no map position. Edit the quote and pick them on the map to add one.</p>
            </section>
          )}
        </div>

        {/* RIGHT: the price (the only place the total appears), then tools. */}
        <div ref={railRef} className="quote-detail-rail">
          <section className="bk-card" aria-labelledby="qd-price-title">
            <h2 className="bk-fact__label" id="qd-price-title" style={{ margin: 0 }}>{isRound ? 'Total, both legs' : 'Total'}</h2>
            <div className="qd-total">{formatMoney(total)}</div>
            <div className="qd-sub">
              {marginText && <span>{marginText} margin</span>}
              {showWinChance && (
                // Stored 0 to 100 already; do not multiply again.
                <span title="Estimated chance of winning at this price">{Math.round(Number(quote.win_probability))}% chance to win</span>
              )}
            </div>
            {fuelNote && (
              <p className="qd-fuel" role="status">
                <span className="bk-dot bk-dot--warning" aria-hidden="true" />
                <span>{fuelNote}{quote.status === 'DRAFT'
                  // A draft was never offered, so there is nothing to renegotiate: update the price instead.
                  ? ' Update the price before sending.'
                  : fuelAlert?.action ? ` ${normaliseFigures(fuelAlert.action).replace(/\.?$/, '.')}` : ''}</span>
              </p>
            )}
            <div className="qd-price-rows">
              {priceRows.map(r => (
                <div key={r.label} className="bk-kv"><span className="bk-kv__label">{r.label}</span><span className="bk-kv__value">{formatMoney(r.value)}</span></div>
              ))}
            </div>
            <div className="qd-price-rows">
              {quote.valid_until && (
                <div className="bk-kv">
                  <span className="bk-kv__label">Valid until</span>
                  <span className="bk-kv__value">
                    {formatDate(quote.valid_until)}
                    {validNote && <span style={{ color: validNote === 'expired' ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}> · {validNote}</span>}
                  </span>
                </div>
              )}
              {quote.created_at && <div className="bk-kv"><span className="bk-kv__label">Created</span><span className="bk-kv__value">{formatDate(quote.created_at)}</span></div>}
              {/* One uncertainty signal: the chance to win when it is shown, else the price confidence. */}
              {quote.confidence && !showWinChance && <div className="bk-kv"><span className="bk-kv__label">Price confidence</span><span className="bk-kv__value">{sentenceCase(quote.confidence)}</span></div>}
            </div>
          </section>

          {contactInRail && (
            <section className="bk-card" aria-labelledby="qd-contact-title">
              <div className="bk-card__head"><h2 className="bk-card__title" id="qd-contact-title">Customer</h2></div>
              {[
                { label: 'Customer', value: company || 'Not recorded' },
                ...(showContact ? [{ label: 'Contact', value: contact }] : []),
                ...(quote.customer_email ? [{ label: 'Email', value: <span className="qd-email">{breakableEmail(quote.customer_email)}</span> }] : []),
                ...(quote.customer_phone ? [{ label: 'Phone', value: quote.customer_phone }] : []),
              ].map((r: { label: string; value: React.ReactNode }) => (
                <div key={r.label} className="bk-kv">
                  <span className="bk-kv__label">{r.label}</span>
                  <span className="bk-kv__value">{r.value}</span>
                </div>
              ))}
            </section>
          )}

          {(effectiveShareUrl || ((quote.status === 'SENT' || quote.status === 'DRAFT') && !quote.outcome)) && (
            <section className="bk-card" aria-labelledby="qd-customer-title">
              <h2 className="bk-card__title" id="qd-customer-title" style={{ marginBottom: 12 }}>With the customer</h2>
              {effectiveShareUrl && (
                <div style={{ marginBottom: 16 }}>
                  <div className="qd-link" title={effectiveShareUrl}>{effectiveShareUrl}</div>
                  {effectiveEmailStatus && (
                    <p className="bk-help" style={{ margin: '4px 0 12px' }}>
                      {effectiveEmailStatus.sent
                        ? <>Emailed to <span className="qd-email">{breakableEmail(String(effectiveEmailStatus.address || ''))}</span></>
                        : isDemoEmailSkip
                          ? 'Demo mode: the link is ready, but no real email is sent.'
                          : 'No email on file for this customer. Share the link instead.'}
                    </p>
                  )}
                  <div className="qd-btn-row">
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(effectiveShareUrl); toast.success('Link copied to clipboard'); }}
                      className="bk-btn bk-btn--secondary"
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
                      className="bk-btn bk-btn--secondary"
                      style={{ boxSizing: 'border-box' }}
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              )}
              {(quote.status === 'SENT' || quote.status === 'DRAFT') && !quote.outcome && (
                <>
                  <div className="bk-fact__label" style={{ marginBottom: 8 }}>Record their answer</div>
                  <div className="qd-btn-row">
                    <button
                      type="button"
                      onClick={() => { setOutcomeType('accepted'); setFinalPrice(String(quote.total_amount || '')); setShowOutcomeModal(true); }}
                      className="bk-btn bk-btn--secondary"
                    >
                      Accepted
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOutcomeType('rejected'); setShowOutcomeModal(true); }}
                      className="bk-btn bk-btn--secondary"
                    >
                      Rejected
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Secondary tools in one quiet card (phones also get Edit here, so
              the head keeps two controls on one line). */}
          <div className="bk-card qd-tools">
            <button type="button" className="bk-btn bk-btn--quiet qd-tools-edit" onClick={() => navigate(`/bookings/quotes/${id}/edit`)}>
              Edit quote
            </button>
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
              className="bk-btn bk-btn--quiet"
            >
              <Download size={16} aria-hidden="true" /> Download PDF
            </button>
            {quote.status === 'ACCEPTED' && (
              <button type="button" className="bk-btn bk-btn--quiet" onClick={() => setSendPreview('button')} disabled={sendToCustomerMutation.isPending}>
                Send to customer
              </button>
            )}
            <button
              type="button"
              className="bk-btn bk-btn--quiet-danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete quote'}
            </button>
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
          background: 'var(--modal-backdrop, rgba(0,0,0,0.65))',
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

      {sendPreview && (
        <QuoteSendPreview
          quote={quote}
          confirmLabel={quote.status === 'SENT' ? 'Resend quote' : 'Send quote'}
          sending={sendPreview === 'status' ? statusMutation.isPending : sendToCustomerMutation.isPending}
          onCancel={() => setSendPreview(null)}
          onConfirm={() => {
            if (sendPreview === 'status') statusMutation.mutate('SENT', { onSettled: () => setSendPreview(null) });
            else sendToCustomerMutation.mutate(undefined, { onSettled: () => setSendPreview(null) });
          }}
        />
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
