import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/formatters';

export default function ClientQuoteView() {
  const { quoteId, token } = useParams<{ quoteId: string; token: string }>();
  const [responded, setResponded] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  // Fetch quote data (no auth required)
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['public-quote', quoteId, token],
    queryFn: async () => {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3700';
      const res = await fetch(`${baseURL}/api/v1/quotes/public/${quoteId}/${token}/`);
      if (!res.ok) {
        throw new Error('Quote not found or invalid link');
      }
      return res.json();
    },
    retry: false,
  });

  // Respond to quote (accept/decline)
  const respondMutation = useMutation({
    mutationFn: async (action: 'accept' | 'decline') => {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3700';
      const res = await fetch(`${baseURL}/api/v1/quotes/public/${quoteId}/${token}/respond/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        throw new Error('Failed to respond to quote');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResponded(true);
      setResponseMessage(data.message);
    },
  });

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Loading quote...
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div className="card" style={{ padding: 40, maxWidth: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--status-danger)', marginBottom: 12 }}>
            Quote not found or invalid link
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            This quote may have expired or the link is incorrect.
          </div>
        </div>
      </div>
    );
  }

  if (responded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div className="card" style={{ padding: 40, maxWidth: 500, textAlign: 'center' }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
            color: responseMessage.includes('accepted') ? 'var(--status-success)' : 'var(--text-secondary)',
          }}>
            {responseMessage.includes('accepted') ? '✓' : '—'}
          </div>
          <div style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
            {responseMessage}
          </div>
        </div>
      </div>
    );
  }

  const validUntilDate = new Date(quote.valid_until);
  const isExpiringSoon = validUntilDate.getTime() - Date.now() < 48 * 60 * 60 * 1000;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-deep)',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: 32,
          textAlign: 'center',
          paddingTop: 32,
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            TRUCKWYS
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
          }}>
            FREIGHT QUOTE
          </div>
        </div>

        {/* Quote Number */}
        <div className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}>
            QUOTE NUMBER
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {quote.quote_number}
          </div>
        </div>

        {/* Valid Until Warning */}
        <div className="card" style={{
          padding: 16,
          marginBottom: 16,
          background: isExpiringSoon ? 'var(--status-danger-bg)' : 'var(--bg-surface)',
          border: isExpiringSoon ? '1px solid var(--status-danger)' : '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: isExpiringSoon ? 'var(--status-danger)' : 'var(--text-secondary)',
            textAlign: 'center',
          }}>
            This quote expires: <strong>{validUntilDate.toLocaleDateString()}</strong>
            {isExpiringSoon && (
              <span style={{ marginLeft: 8 }}>
                ({Math.ceil((validUntilDate.getTime() - Date.now()) / (1000 * 60 * 60))}h remaining)
              </span>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            ROUTE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                PICKUP
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                {quote.pickup_location || quote.origin || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                DELIVERY
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                {quote.delivery_location || quote.destination || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Cargo Details */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            CARGO DETAILS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                DESCRIPTION
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {quote.cargo_description || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                VEHICLE TYPE
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {quote.vehicle_type || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                WEIGHT
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {quote.weight ? `${parseFloat(quote.weight).toLocaleString()} kg` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                DISTANCE
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {quote.distance ? `${Math.round(parseFloat(quote.distance)).toLocaleString()} km` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            COST BREAKDOWN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Base Rate', value: quote.base_rate },
              { label: 'Fuel Surcharge', value: quote.fuel_surcharge },
              { label: 'Toll Charges', value: quote.toll_charges },
              { label: 'Driver Allowance', value: quote.driver_allowance },
              { label: 'Additional Charges', value: quote.additional_charges },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                  {formatCurrency(parseFloat(item.value || '0'))}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 16,
              marginTop: 8,
              borderTop: '2px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Total Amount</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--accent-primary)',
              }}>
                {formatCurrency(parseFloat(quote.total_amount || '0'))}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
          <button
            onClick={() => respondMutation.mutate('accept')}
            disabled={respondMutation.isPending}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: 'var(--status-success)',
              border: 'none',
              color: 'white',
              borderRadius: 2,
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {respondMutation.isPending ? 'SUBMITTING...' : 'ACCEPT QUOTE'}
          </button>
          <button
            onClick={() => respondMutation.mutate('decline')}
            disabled={respondMutation.isPending}
            style={{
              padding: '16px 24px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 2,
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            DECLINE
          </button>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          paddingBottom: 32,
        }}>
          Powered by TruckWys — Road Freight Intelligence Platform
        </div>
      </div>
    </div>
  );
}
