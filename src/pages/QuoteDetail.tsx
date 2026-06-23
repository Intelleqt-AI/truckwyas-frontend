import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, deleteData, postData, downloadBlob } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',
  SENT: 'var(--status-warning)',
  ACCEPTED: 'var(--status-success)',
  DECLINED: 'var(--status-danger)',
  IT: 'var(--accent-primary)',
  COMPLETED: 'var(--status-success)',
};

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Sprint 1 features
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'accepted' | 'rejected' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [fuelAlert, setFuelAlert] = useState<any>(null);
  const [confirmOpts, setConfirmOpts] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void; danger?: boolean } | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchData(`api/v1/quotes/${id}/`),
    retry: 1,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
      toast.success('Share link ready — copy and send to your customer');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
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
    mutationFn: () =>
      postData({
        url: `api/v1/quotes/${id}/convert_to_load/`,
        data: {},
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] });
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
      setFinalPrice('');
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
    setConfirmOpts({
      title: 'Convert to Booking',
      message: `Convert ${quote?.quote_number} to an active booking/load?`,
      confirmLabel: 'Convert',
      onConfirm: () => convertToLoadMutation.mutate(),
    });
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
        <button className="btn-action" onClick={() => navigate('/bookings/quotes')}>Back to Quotes</button>
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
          ← BACK TO QUOTES
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
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: STATUS_COLOR[quote.status] || 'var(--text-secondary)',
                padding: '4px 10px',
                border: `1px solid ${STATUS_COLOR[quote.status] || 'var(--border-subtle)'}`,
                borderRadius: 2,
                background: 'var(--bg-surface)',
              }}
            >
              {quote.status}
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
            <div className="card-title" style={{ marginBottom: 16 }}>Customer</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{quote.customer_name}</div>
          </div>

          {/* Route */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {label('Pickup Location')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.pickup_location || '—'}</div>
              </div>
              <div>
                {label('Delivery Location')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.delivery_location || '—'}</div>
              </div>
              <div>
                {label('Origin')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.origin || '—'}</div>
              </div>
              <div>
                {label('Destination')}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{quote.destination || '—'}</div>
              </div>
            </div>
          </div>

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
              {[
                { label: 'Base Rate', value: quote.base_rate },
                { label: 'Fuel Surcharge', value: quote.fuel_surcharge },
                { label: 'Toll Charges', value: quote.toll_charges },
                { label: 'Driver Allowance', value: quote.driver_allowance },
                { label: 'Additional Charges', value: quote.additional_charges },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {formatCurrency(parseFloat(item.value || '0'))}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Total Amount</span>
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
                <select
                  value={quote.status}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  disabled={statusMutation.isPending}
                  style={inputStyle}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="DECLINED">Declined</option>
                  <option value="IT">In-Transit</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                {label('Confidence')}
                <div style={{ fontSize: 12, color: quote.confidence === 'HIGH' ? 'var(--status-success)' : quote.confidence === 'LOW' ? 'var(--status-danger)' : 'var(--status-warning)' }}>
                  {quote.confidence}
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
                  ✓ MARK AS ACCEPTED
                </button>
                <button
                  onClick={() => {
                    setOutcomeType('rejected');
                    setShowOutcomeModal(true);
                  }}
                  className="btn-action"
                  style={{ flex: 1, fontSize: 11, padding: '10px 16px', background: 'var(--status-danger)', border: 'none', color: '#fff' }}
                >
                  ✗ MARK AS REJECTED
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
                EDIT QUOTE
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
                {sendToCustomerMutation.isPending ? 'GENERATING...' : 'SEND TO CUSTOMER'}
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
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>SHARE LINK:</div>
                  <div style={{
                    wordBreak: 'break-all',
                    color: 'var(--accent-primary)',
                    marginBottom: 8,
                    fontSize: 10,
                  }}>
                    {shareUrl}
                  </div>
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
                    COPY LINK
                  </button>
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
                    {convertToLoadMutation.isPending ? 'CONVERTING...' : '✓ CONVERT TO BOOKING'}
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
                {deleteMutation.isPending ? 'DELETING...' : 'DELETE QUOTE'}
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
                  textTransform: 'uppercase' as const,
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: 8,
                }}
              >
                ↓ DOWNLOAD PDF
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
                <select
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select reason...</option>
                  <option value="Price too high">Price too high</option>
                  <option value="Went with competitor">Went with competitor</option>
                  <option value="Job cancelled">Job cancelled</option>
                  <option value="Other">Other (please specify)</option>
                </select>
                {rejectionReason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Please specify reason"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
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
                  setFinalPrice('');
                }}
                className="btn-action"
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  const data: any = { outcome: outcomeType };
                  if (outcomeType === 'rejected' && rejectionReason) {
                    data.rejection_reason = rejectionReason;
                  }
                  if (outcomeType === 'accepted' && finalPrice) {
                    data.final_price = parseFloat(finalPrice);
                  }
                  outcomeMutation.mutate(data);
                }}
                disabled={outcomeType === 'rejected' && !rejectionReason}
                className="btn-action"
                style={{
                  flex: 1,
                  background: outcomeType === 'accepted' ? 'var(--status-success)' : 'var(--status-danger)',
                  border: 'none',
                  color: outcomeType === 'accepted' ? '#000' : '#fff'
                }}
              >
                {outcomeMutation.isPending ? 'SAVING...' : outcomeType === 'accepted' ? 'MARK ACCEPTED' : 'MARK REJECTED'}
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
    </div>
  );
}
