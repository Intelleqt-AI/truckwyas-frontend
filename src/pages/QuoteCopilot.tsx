import React, { useState } from 'react';
import { RouteCalculator } from '@/components/quotes/RouteCalculator';
import { postData } from '@/lib/Api';

interface RouteAppliedData {
  distance: number;
  fuelCost: number;
  tollCost: number;
  totalCost: number;
}

export const QuoteCopilot: React.FC = () => {
  const [routeData, setRouteData] = useState<RouteAppliedData | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = (data: RouteAppliedData) => {
    setRouteData(data);
    // Auto-populate quote amount with suggested total cost
    setQuoteAmount(data.totalCost.toFixed(2));
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !quoteAmount.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await postData('/api/v1/quotes/', {
        customer_name: customerName.trim(),
        description: description.trim() || 'Route calculated via Copilot',
        amount: parseFloat(quoteAmount),
        status: 'pending',
        metadata: routeData
          ? {
              distance_km: routeData.distance,
              fuel_cost_zar: routeData.fuelCost,
              toll_cost_zar: routeData.tollCost,
              calculated_cost_zar: routeData.totalCost,
            }
          : null,
      });

      setSuccess(true);
      setCustomerName('');
      setDescription('');
      setQuoteAmount('');
      setRouteData(null);
    } catch (err) {
      setError('Failed to create quote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>
          Quote Copilot
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Calculate route costs and create quotes instantly
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Left Column: Route Calculator */}
        <div>
          <RouteCalculator onApply={handleApply} />
        </div>

        {/* Right Column: Quote Form */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)', fontSize: 18 }}>
              Create Quote
            </h3>

            {success && (
              <div
                style={{
                  padding: 16,
                  background: 'var(--status-success-bg)',
                  border: '1px solid var(--status-success)',
                  borderRadius: 6,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--status-success)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-success)' }}>
                    Quote created successfully!
                  </span>
                </div>
                <a
                  href="/quotes"
                  style={{
                    fontSize: 14,
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  View Quotes Board →
                </a>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: 12,
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger)',
                  borderRadius: 6,
                  color: 'var(--status-danger)',
                  fontSize: 14,
                  marginBottom: 20,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitQuote} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="customer"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  Customer Name *
                </label>
                <input
                  id="customer"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quote details (optional)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="amount"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  Quote Amount (ZAR) *
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                  disabled={submitting}
                  required
                />
              </div>

              {routeData && (
                <div
                  style={{
                    padding: 16,
                    background: 'var(--alert-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>
                    CALCULATED ROUTE BREAKDOWN
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Distance</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {routeData.distance.toFixed(2)} km
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fuel Cost</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {formatCurrency(routeData.fuelCost)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Toll Cost</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {formatCurrency(routeData.tollCost)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        paddingTop: 6,
                        marginTop: 6,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Suggested Total</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {formatCurrency(routeData.totalCost)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  background: submitting ? 'var(--text-tertiary)' : 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  marginTop: 8,
                }}
              >
                {submitting ? 'Creating Quote...' : 'Create Quote'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCopilot;
