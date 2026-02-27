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
  defaultOrigin?: string;
  defaultDestination?: string;
  onApply?: (data: {
    distance: number;
    fuelCost: number;
    tollCost: number;
    totalCost: number;
    durationMinutes: number;
    fuelUsageLitres: number;
    source: 'tomtom' | 'estimated';
  }) => void;
}

export const RouteCalculator: React.FC<RouteCalculatorProps> = ({
  defaultOrigin = '',
  defaultDestination = '',
  onApply
}) => {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  // Update local state when defaults change
  React.useEffect(() => {
    if (defaultOrigin) setOrigin(defaultOrigin);
  }, [defaultOrigin]);

  React.useEffect(() => {
    if (defaultDestination) setDestination(defaultDestination);
  }, [defaultDestination]);

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
        durationMinutes: routeData.duration_minutes,
        fuelUsageLitres: routeData.fuel_usage_litres,
        source: routeData.source,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Compact Input Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          {label('Origin')}
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Johannesburg"
            style={inputStyle}
            disabled={loading}
          />
        </div>
        <div>
          {label('Destination')}
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Cape Town"
            style={inputStyle}
            disabled={loading}
          />
        </div>
      </div>

      <button
        onClick={handleCalculate}
        disabled={loading}
        className="btn-action"
        style={{ width: '100%', fontSize: 12, padding: '10px 16px' }}
      >
        {loading ? 'CALCULATING ROUTE...' : '🗺️ CALCULATE ROUTE (TomTom)'}
      </button>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--status-danger)', borderRadius: 2, color: 'var(--status-danger)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}

      {/* Compact Results */}
      {routeData && (
        <div style={{ padding: '12px 14px', background: 'var(--bg-surface-hover)', borderRadius: 2, border: `1px solid ${routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>ROUTE CALCULATED</div>
            <span style={{ padding: '2px 8px', background: routeData.source === 'tomtom' ? 'var(--accent-dim)' : 'rgba(251, 191, 36, 0.1)', border: `1px solid ${routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)'}`, borderRadius: 2, fontSize: 9, color: routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {routeData.source === 'tomtom' ? 'TOMTOM' : 'ESTIMATED'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>DISTANCE</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{Math.round(routeData.distance_km)} km</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>DURATION</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>
                {Math.floor(routeData.duration_minutes / 60)}h {routeData.duration_minutes % 60}m
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>FUEL</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{Math.round(routeData.fuel_usage_litres)} L</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Fuel Cost:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>R {Math.round(routeData.fuel_cost_zar).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Toll Cost:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>R {Math.round(routeData.toll_cost_zar).toLocaleString()}</span>
            </div>
          </div>

          {onApply && (
            <button
              onClick={handleApply}
              className="btn-action"
              style={{ width: '100%', marginTop: 10, fontSize: 11, padding: '8px 12px' }}
            >
              ✓ APPLY TO QUOTE
            </button>
          )}
        </div>
      )}
    </div>
  );
};
