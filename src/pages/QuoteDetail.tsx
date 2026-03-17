import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData, deleteData, postData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-tertiary)',
  SENT: 'var(--status-warning)',
  ACCEPTED: 'var(--status-success)',
  IT: 'var(--accent-primary)',
  COMPLETED: 'var(--status-success)',
};

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [convertSuccess, setConvertSuccess] = useState<any>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchData(`api/v1/quotes/${id}/`),
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => patchData({ url: `api/v1/quotes/${id}/`, data: { status: newStatus } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteData({ url: `api/v1/quotes/${id}/` }),
    onSuccess: () => {
      navigate('/quotes');
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
      setConvertSuccess(data);
      setConvertError(null);
      if (data?.id) {
        navigate(`/bookings/${data.id}`);
      }
    },
    onError: (error: any) => {
      setConvertError(error?.message || 'Failed to convert quote to booking');
      setConvertSuccess(null);
    },
  });

  const handleDelete = () => {
    if (confirm(`Delete quote ${quote?.quote_number}? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleConvertToLoad = () => {
    if (confirm(`Convert quote ${quote?.quote_number} to a booking/load?`)) {
      convertToLoadMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 40 }}>
        <div className="card" style={{ padding: 24 }}>
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
        <button className="btn-action" onClick={() => navigate('/quotes')}>Back to Quotes</button>
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
          onClick={() => navigate('/quotes')}
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
                    {new Date(quote.valid_until).toLocaleDateString()}
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
                    {new Date(quote.created_at).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn-action"
                onClick={() => navigate(`/quotes/${id}/edit`)}
                style={{ width: '100%', fontSize: 11, padding: '10px 16px' }}
              >
                EDIT QUOTE
              </button>

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
                  {convertSuccess && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 2,
                      background: 'var(--status-success-bg)',
                      border: '1px solid var(--status-success)',
                      fontSize: 12,
                      color: 'var(--status-success)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      ✓ Quote converted to booking successfully
                    </div>
                  )}
                  {convertError && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 2,
                      background: 'var(--status-danger-bg)',
                      border: '1px solid var(--status-danger)',
                      fontSize: 12,
                      color: 'var(--status-danger)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      ❌ {convertError}
                    </div>
                  )}
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
                  const token = localStorage.getItem('access');
                  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3700';
                  const url = `${baseURL}/api/v1/quotes/${id}/generate_pdf/`;
                  fetch(url, { headers: { Authorization: `Token ${token}` } })
                    .then(r => r.blob())
                    .then(blob => {
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `Quote-${quote?.quote_number || id}.pdf`;
                      a.click();
                    });
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
    </div>
  );
}
