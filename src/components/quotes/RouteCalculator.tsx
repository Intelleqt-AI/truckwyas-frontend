import React, { useState } from 'react';
import { postData } from '@/lib/Api';

interface RouteData {
  distance_km: number;
  duration_minutes: number;
  fuel_usage_litres: number;
  fuel_cost_zar: number;
  toll_cost_zar: number;
  total_cost_zar: number;
  origin_coords: { lat: number; lon: number };
  dest_coords: { lat: number; lon: number };
  success: boolean;
  source: 'tomtom' | 'estimated';
}

interface RouteCalculatorProps {
  onApply?: (data: {
    distance: number;
    fuelCost: number;
    tollCost: number;
    totalCost: number;
  }) => void;
}

export const RouteCalculator: React.FC<RouteCalculatorProps> = ({ onApply }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  const handleCalculate = async () => {
    if (!origin.trim() || !destination.trim()) {
      setError('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteData(null);

    try {
      const data = await postData('/api/v1/route/calculate/', {
        origin: origin.trim(),
        destination: destination.trim(),
        vehicle_type: 'truck',
        weight_kg: 20000,
      });

      if (data.success) {
        setRouteData(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to calculate route');
        setRouteData(null);
      }
    } catch (err) {
      setError('Failed to calculate route. Please try again.');
      setRouteData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (routeData && onApply) {
      onApply({
        distance: routeData.distance_km,
        fuelCost: routeData.fuel_cost_zar,
        tollCost: routeData.toll_cost_zar,
        totalCost: routeData.total_cost_zar,
      });
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatCurrency = (amount: number) => {
    return `R ${formatNumber(amount)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Input Form */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)', fontSize: 18 }}>
          Route Calculator
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              htmlFor="origin"
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              Origin
            </label>
            <input
              id="origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., Johannesburg, South Africa"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="destination"
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              Destination
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Cape Town, South Africa"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              background: loading ? 'var(--text-tertiary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Calculating...' : 'Calculate Route'}
          </button>

          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid var(--status-danger)',
                borderRadius: 6,
                color: 'var(--status-danger)',
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {routeData && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>
              Route Summary
            </h3>
            {routeData.source === 'estimated' && (
              <span
                style={{
                  padding: '4px 10px',
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid var(--status-warning)',
                  borderRadius: 4,
                  fontSize: 12,
                  color: 'var(--status-warning)',
                  fontWeight: 500,
                }}
              >
                Estimated
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Distance
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatNumber(routeData.distance_km)} km
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Est. Duration
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                {Math.floor(routeData.duration_minutes / 60)}h {routeData.duration_minutes % 60}m
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Fuel Usage
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatNumber(routeData.fuel_usage_litres)} L
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Fuel Cost</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {formatCurrency(routeData.fuel_cost_zar)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Toll Cost</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {formatCurrency(routeData.toll_cost_zar)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Total Cost
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)' }}>
                {formatCurrency(routeData.total_cost_zar)}
              </span>
            </div>
          </div>

          {onApply && (
            <button
              onClick={handleApply}
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                background: 'var(--status-success)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Apply to Quote
            </button>
          )}
        </div>
      )}

      {/* Map Placeholder */}
      {routeData && (
        <div
          className="card"
          style={{
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            background: 'var(--bg-surface)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 12 }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Map view coming soon
          </div>
        </div>
      )}
    </div>
  );
};
