import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, deleteData, postData, downloadBlob } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConvertToBookingModal } from '@/components/ConvertToBookingModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',
  SENT: 'var(--status-warning)',
  ACCEPTED: 'var(--status-success)',
  DECLINED: 'var(--status-danger)',
  IT: 'var(--accent-primary)',
  COMPLETED: 'var(--status-success)',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  IT: 'In-Transit',
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; address: string | null } | null>(null);

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
      setEmailStatus({ sent: !!data.email_sent, address: data.customer_email || null });
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
      title: 'Delete Quote',
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
    return (
      <div style={{ padding: 40 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 13, color: 'var(--status-danger)', marginBottom: 12 }}>Quote not found</div>
        <button className="btn-action" onClick={() => navigate('/bookings/quotes')}>Back to quotes</button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '10px 12px',
    color: 'var(--text-primary)',
    borderRadius: 2,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font-sans)',
  };

  const label = (text: string) => (
    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>
      {text.toUpperCase()}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/bookings/quotes')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            marginBottom: 8,
            padding: 0,
          }}
        >
          ← Back to quotes
        </button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Quote Detail
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{quote.quote_number}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{quote.customer_name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: STATUS_COLOR[quote.status] || 'var(--text-secondary)',
                padding: '4px 10px',
                border: `1px solid ${STATUS_COLOR[quote.status] || 'var(--border-subtle)'}`,
                borderRadius: 4,
                background: 'var(--bg-surface)',
              }}
            >
              {STATUS_LABEL[quote.status] || quote.status}
            </span>
          </div>
        </div>
      </div>

      {/* UPGRADE 2: Fuel Delta Alert */}
      {fuelAlert && fuelAlert.has_alert && (
        <div style={{ padding: '14px 20px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid var(--status-warning)', borderRadius: 2, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <div style={{ fontSize: 18 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-warning)', marginBottom: 4 }}>
                Fuel Price Alert
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                {fuelAlert.message || `Diesel up R${fuelAlert.fuel_delta_zar?.toFixed(2)}/L since this quote was created. This job now costs ~R${Math.round(fuelAlert.estimated_cost_impact).toLocaleString()} more.`}
              </div>
              {fuelAlert.action && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {fuelAlert.action}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* LEFT — Quote Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 4 }}>NAME</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{quote.customer_name || '—'}</div>
              </div>
              {quote.customer_company && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 4 }}>COMPANY</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.customer_company}</div>
                </div>
              )}
              {quote.customer_email && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 4 }}>EMAIL</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.customer_email}</div>
                </div>
              )}
              {quote.customer_phone && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 4 }}>PHONE</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.customer_phone}</div>
                </div>
              )}
              {quote.customer_city && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 4 }}>CITY</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.customer_city}</div>
                </div>
              )}
            </div>
          </div>

          {/* Route */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                {quote.trip_type === 'ROUND_TRIP' ? 'Leg 1 — Outbound Route' : 'Route'}
              </div>
              {quote.trip_type === 'ROUND_TRIP' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', padding: '3px 8px', border: '1px solid var(--accent-primary)', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-block' }}>
                  Round trip
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {label('Pickup Location')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.pickup_location || '—'}</div>
              </div>
              <div>
                {label('Delivery Location')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.delivery_location || '—'}</div>
              </div>
            </div>
          </div>

          {/* Return Leg — visible only for ROUND_TRIP quotes */}
          {quote.trip_type === 'ROUND_TRIP' && (
            <div className="card" style={{ padding: 20, border: '1px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)' }}>
              <div className="card-title" style={{ marginBottom: 16, color: 'var(--accent-primary)' }}>
                Leg 2 — Return Route
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  {label('Returns From')}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.delivery_location || '—'}</div>
                </div>
                <div>
                  {label('Return Destination')}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.return_location || '—'}</div>
                </div>
                <div>
                  {label('Return Cargo')}
                  <div style={{ fontSize: 13, color: quote.return_cargo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {quote.return_cargo || 'Empty return'}
                  </div>
                </div>
                {quote.return_date && (
                  <div>
                    {label('Return Date')}
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(quote.return_date).toLocaleDateString('en-ZA')}
                    </div>
                  </div>
                )}
                {quote.return_base_rate && parseFloat(quote.return_base_rate) > 0 && (
                  <div>
                    {label('Return Rate')}
                    <div style={{ fontSize: 13, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {formatCurrency(parseFloat(quote.return_base_rate))}
                    </div>
                  </div>
                )}
                {quote.return_notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    {label('Return Notes')}
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{quote.return_notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cargo Details */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Cargo Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {label('Description')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.cargo_description || '—'}</div>
              </div>
              <div>
                {label('Vehicle Type')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.vehicle_type || '—'}</div>
              </div>
              <div>
                {label('Weight (kg)')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.weight ? parseFloat(quote.weight).toLocaleString() : '—'}</div>
              </div>
              <div>
                {label('Distance (km)')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.distance ? Math.round(parseFloat(quote.distance)).toLocaleString() : '—'}</div>
              </div>
              {quote.vehicle_display && (
                <div>
                  {label('Assigned Vehicle')}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.vehicle_display}</div>
                </div>
              )}
              {quote.driver_display && (
                <div>
                  {label('Assigned Driver')}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.driver_display}</div>
                </div>
              )}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Cost Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  { label: 'Fuel Surcharge', value: fuel },
                  { label: 'Toll Charges', value: toll },
                  { label: 'Driver Allowance', value: driver },
                  ...(additional > 0 ? [{ label: 'Additional Charges', value: additional }] : []),
                  { label: 'Base Rate', value: baseRate },
                ];

                return rows.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ));
              })()}
              {quote.trip_type === 'ROUND_TRIP' && quote.return_base_rate && parseFloat(quote.return_base_rate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--accent-primary)' }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-primary)' }}>
                    Return Leg ({quote.return_cargo ? 'with cargo' : 'empty return'})
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {formatCurrency(parseFloat(quote.return_base_rate))}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {quote.trip_type === 'ROUND_TRIP' ? 'Total (both legs)' : 'Total Amount'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {formatCurrency(parseFloat(quote.total_amount || '0'))}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Notes</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{quote.notes}</div>
            </div>
          )}
        </div>

        {/* RIGHT — Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Quote Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                {label('Quote Number')}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{quote.quote_number}</div>
              </div>
              <div>
                {label('Status')}
                <Select value={quote.status} onValueChange={(val) => statusMutation.mutate(val)} disabled={statusMutation.isPending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                    <SelectItem value="IT">In-Transit</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                {label('Confidence')}
                <div style={{ fontSize: 12, color: quote.confidence === 'HIGH' ? 'var(--status-success)' : quote.confidence === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)' }}>
                  {sentenceCase(quote.confidence)}
                </div>
              </div>
              <div>
                {label('Margin')}
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{quote.margin_percentage || 0}%</div>
              </div>
              {quote.valid_until && (
                <div>
                  {label('Valid Until')}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(quote.valid_until).toLocaleDateString('en-ZA')}
                    {new Date(quote.valid_until).getTime() - Date.now() < 48 * 60 * 60 * 1000 && (
                      <span style={{ color: 'var(--status-danger)', marginLeft: 8 }}>
                        ({Math.ceil((new Date(quote.valid_until).getTime() - Date.now()) / (1000 * 60 * 60))}h left)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {quote.created_at && (
                <div>
                  {label('Created')}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(quote.created_at).toLocaleDateString('en-ZA')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* UPGRADE 3: Win Probability Display */}
          {quote.win_probability && (quote.status === 'DRAFT' || quote.status === 'SENT') && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Win Probability</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${quote.win_probability * 100}%`,
                    height: '100%',
                    background: quote.win_probability >= 0.7 ? 'var(--status-success)' : quote.win_probability >= 0.4 ? 'var(--status-warning)' : 'var(--status-danger)',
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {Math.round(quote.win_probability * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Estimated chance of winning at current price
              </div>
            </div>
          )}

          {/* UPGRADE 1: Outcome Buttons */}
          {(quote.status === 'SENT' || quote.status === 'DRAFT') && !quote.outcome && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Mark Outcome</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setOutcomeType('accepted');
                    setFinalPrice(String(quote.total_amount || ''));
                    setShowOutcomeModal(true);
                  }}
                  className="btn-action"
                  style={{ flex: 1, fontSize: 11, padding: '10px 16px', background: 'var(--status-success)', border: 'none', color: '#000' }}
                >
                  ✓ Mark as accepted
                </button>
                <button
                  onClick={() => {
                    setOutcomeType('rejected');
                    setShowOutcomeModal(true);
                  }}
                  className="btn-action"
                  style={{ flex: 1, fontSize: 11, padding: '10px 16px', background: 'var(--status-danger)', border: 'none', color: '#fff' }}
                >
                  ✗ Mark as rejected
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn-action"
                onClick={() => navigate(`/bookings/quotes/${id}/edit`)}
                style={{ width: '100%', fontSize: 11, padding: '10px 16px' }}
              >
                Edit quote
              </button>

              {/* Send to Customer */}
              <button
                className="btn-action"
                onClick={() => sendToCustomerMutation.mutate()}
                style={{
                  width: '100%',
                  fontSize: 11,
                  padding: '10px 16px',
                  background: 'var(--accent-primary)',
                  border: 'none',
                }}
                disabled={sendToCustomerMutation.isPending}
              >
                {sendToCustomerMutation.isPending ? 'Generating…' : 'Send to customer'}
              </button>

              {shareUrl && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 2,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-primary)',
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>Share link</div>
                  <div style={{
                    wordBreak: 'break-all',
                    color: 'var(--accent-primary)',
                    marginBottom: 8,
                    fontSize: 10,
                  }}>
                    {shareUrl}
                  </div>
                  {emailStatus && (
                    <div style={{
                      color: emailStatus.sent ? 'var(--status-success)' : 'var(--status-warning)',
                      marginBottom: 8,
                      fontSize: 10,
                    }}>
                      {emailStatus.sent
                        ? `✓ Quote emailed to ${emailStatus.address}`
                        : 'Could not email the customer — no email on file. Share the link below instead.'}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Link copied to clipboard');
                    }}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      color: 'white',
                      borderRadius: 2,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Copy link
                  </button>
                  <a
                    href={buildWhatsAppShareUrl(
                      quote.customer_phone,
                      `Hi${quote.customer_name ? ` ${quote.customer_name}` : ''}, here's your freight quote${quote.quote_number ? ` (${quote.quote_number})` : ''} from TruckWys: ${shareUrl}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      marginTop: 8,
                      background: '#08933C',
                      border: 'none',
                      color: 'white',
                      borderRadius: 2,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.892.526 3.708 1.523 5.29L2 22l4.828-1.494A9.953 9.953 0 0012.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.062a8.03 8.03 0 01-4.284-1.236l-.307-.183-3.194.988.99-3.13-.2-.32A8.02 8.02 0 013.938 12c0-4.452 3.612-8.062 8.063-8.062 4.45 0 8.061 3.61 8.061 8.062 0 4.452-3.61 8.062-8.061 8.062z" />
                    </svg>
                    Share via WhatsApp
                  </a>
                </div>
              )}

              {quote.status === 'ACCEPTED' && (
                <>
                  <button
                    className="btn-action"
                    onClick={handleConvertToLoad}
                    style={{ width: '100%', fontSize: 11, padding: '10px 16px', background: 'var(--status-success)', border: 'none' }}
                    disabled={convertToLoadMutation.isPending}
                  >
                    {convertToLoadMutation.isPending ? 'Converting…' : '✓ Convert to booking'}
                  </button>
                </>
              )}

              <button
                onClick={handleDelete}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)',
                  padding: '10px 16px',
                  borderRadius: 2,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  width: '100%',
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete quote'}
              </button>

              {/* PDF Download */}
              <button
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
                style={{
                  padding: '10px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  borderRadius: 2,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: 8,
                }}
              >
                ↓ Download PDF
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
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowOutcomeModal(false)}
        >
          <div
            className="card"
            style={{ padding: 24, maxWidth: 440, margin: 20, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              {outcomeType === 'accepted' ? 'Mark Quote as Accepted' : 'Mark Quote as Rejected'}
            </div>

            {outcomeType === 'accepted' && (
              <div style={{ marginBottom: 16 }}>
                {label('Final Price Agreed (Optional)')}
                <input
                  type="number"
                  value={finalPrice}
                  onChange={e => setFinalPrice(e.target.value)}
                  placeholder={String(quote?.total_amount || '')}
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Leave blank to use quote total: {formatCurrency(parseFloat(quote?.total_amount || '0'))}
                </div>
              </div>
            )}

            {outcomeType === 'rejected' && (
              <div style={{ marginBottom: 16 }}>
                {label('Rejection Reason')}
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
                    type="text"
                    placeholder="Please specify reason"
                    value={customRejectionReason}
                    onChange={e => setCustomRejectionReason(e.target.value)}
                    style={{ ...inputStyle, marginTop: 10 }}
                  />
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setShowOutcomeModal(false);
                  setOutcomeType(null);
                  setRejectionReason('');
                  setCustomRejectionReason('');
                  setFinalPrice('');
                }}
                className="btn-action"
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
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
                className="btn-action"
                style={{
                  flex: 1,
                  background: outcomeType === 'accepted' ? 'var(--status-success)' : 'var(--status-danger)',
                  border: 'none',
                  color: outcomeType === 'accepted' ? '#000' : '#fff'
                }}
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
