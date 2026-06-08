import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";

// SA constants
const DEFAULT_BASE_RATE_PER_KM = 10;
const FUEL_PRICE_PER_LITRE = 21.7;

// Fuel consumption by vehicle type (L/100km — match app exactly)
const FUEL_CONSUMPTION: Record<string, number> = {
  Flatbed: 32,
  Tautliner: 35,
  Refrigerated: 38,
  'Box Truck': 30,
  Tanker: 40,
  'Danger Load': 36,
};

type VehicleType = 'Flatbed' | 'Tautliner' | 'Refrigerated' | 'Box Truck' | 'Tanker' | 'Danger Load';

interface RouteData {
  distance_km: number;
  duration_minutes: number;
  fuel_usage_litres: number;
  fuel_cost_zar: number;
  toll_cost_zar: number;
  total_cost_zar: number;
  success: boolean;
  source: 'tomtom' | 'estimated';
  origin_resolved?: string;
  dest_resolved?: string;
  cross_border?: boolean;
  countries?: string[];
  warnings?: string[];
  additional_costs?: {
    border_fees?: number;
    weighbridge_fees?: number;
    non_sa_tolls?: number;
  };
}

interface FuelPriceData {
  diesel_inland: number;
  diesel_coastal: number;
  source: string;
  is_stale?: boolean;
  last_updated?: string;
}

interface AISuggestion {
  suggested_price: number;
  margin_pct: number;
  confidence: number;
  margin_range: {
    lower: number;
    upper: number;
  };
  win_probability?: number;
  win_probability_at_lower_price?: number;
  win_probability_at_higher_price?: number;
}

interface RevenueGuard {
  risk_level: 'SAFE' | 'CAUTION' | 'AT_RISK';
  color: string;
  margin_pct: number;
  warnings: string[];
  explanations?: string[];
  suggestions?: string[];
  margin_floor?: number;
  margin_floor_display?: string;
  recommended_surcharge_zar?: number;
}

interface ModelStats {
  training_data_count: number;
  real_quotes_count: number;
  synthetic_count: number;
  last_trained: string;
  model_version: string;
}

interface MarketBenchmark {
  origin: string;
  destination: string;
  vehicle_type: string;
  market_avg_rate: number;
  market_range_low: number;
  market_range_high: number;
  data_points: number;
  confidence: 'high' | 'medium' | 'low';
  your_rate: number;
  your_vs_market_pct: number;
  recommendation: string;
}

export default function NewQuote() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');

  // Step 1: Route data
  const [pickupLocation, setPickupLocation] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  // Step 2: Freight details
  const [weight, setWeight] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Flatbed');
  const [baseRatePerKm, setBaseRatePerKm] = useState(String(DEFAULT_BASE_RATE_PER_KM));
  const [cargoDescription, setCargoDescription] = useState('');
  const [driverAllowanceInput, setDriverAllowanceInput] = useState('0');
  const [editableFuelCost, setEditableFuelCost] = useState<number | null>(null);
  const [editableTollCost, setEditableTollCost] = useState<number | null>(null);

  // Step 3: Customer & Summary
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SENT'>('DRAFT');
  const [confidence, setConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [slaHours, setSlaHours] = useState('48');
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });

  // New Phase 2 features
  const [fuelPriceData, setFuelPriceData] = useState<FuelPriceData | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [revenueGuard, setRevenueGuard] = useState<RevenueGuard | null>(null);

  // Sprint 1 features
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [marketBenchmark, setMarketBenchmark] = useState<MarketBenchmark | null>(null);
  const [adjustedPrice, setAdjustedPrice] = useState<number | null>(null);
  const [loadingWinProb, setLoadingWinProb] = useState(false);
  const [winProbAtAdjusted, setWinProbAtAdjusted] = useState<number | null>(null);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [guardExpanded, setGuardExpanded] = useState(false);

  // Cost calculations — defined early so they can be used in callbacks/effects below
  // Mobile app formula implementation
  const distance = routeData?.distance_km || 0;
  const _baseCost = distance * parseFloat(baseRatePerKm || '0');

  // Fuel cost: (distance × fuelConsumptionL100km × fuelPricePerLitre) / 100
  const fuelConsumption = FUEL_CONSUMPTION[vehicleType] || 36; // Default to Danger Load
  const fuelPrice = fuelPriceData?.diesel_inland || FUEL_PRICE_PER_LITRE;
  const calculatedFuelCost = (distance * fuelConsumption * fuelPrice) / 100;
  const _fuelCost = editableFuelCost !== null ? editableFuelCost : calculatedFuelCost;

  // Toll cost: routeData.toll_cost_zar OR distance × 0.5 (fallback)
  const calculatedTollCost = routeData?.toll_cost_zar || (distance * 0.5);
  const _tollCost = editableTollCost !== null ? editableTollCost : calculatedTollCost;

  // Weight surcharge: baseCost × 0.15 IF weight > 5000kg, ELSE 0
  const weightKg = parseFloat(weight || '0');
  const _weightSurcharge = weightKg > 5000 ? _baseCost * 0.15 : 0;

  // Additional costs (cross-border only)
  const _additionalCosts = (routeData?.additional_costs?.border_fees || 0) +
                           (routeData?.additional_costs?.weighbridge_fees || 0) +
                           (routeData?.additional_costs?.non_sa_tolls || 0);

  const _driverAllowance = parseFloat(driverAllowanceInput || '0');

  // Total: baseCost + fuelCost + tollCost + weightSurcharge + additionalCosts + driverAllowance
  const _total = _baseCost + _fuelCost + _tollCost + _weightSurcharge + _additionalCosts + _driverAllowance;

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchData('api/v1/customers/')
  });
  const customers = customersData?.results || customersData || [];

  // Fetch current fuel prices on mount
  useEffect(() => {
    fetchData('/api/v1/fuel-prices/current/')
      .then(data => {
        if (data.success || data.inland_price) {
          setFuelPriceData(data);
        }
      })
      .catch(() => {
        // Silently fail — not critical
      });
  }, []);

  // Fetch model stats on mount
  useEffect(() => {
    fetchData('/api/v1/quotes/model-stats/')
      .then(data => {
        setModelStats(data);
      })
      .catch(() => {
        // Silently fail — not critical
      });
  }, []);

  // Fetch AI quote suggestion
  const fetchAISuggestion = async () => {
    if (!routeData) return;

    setLoadingAI(true);
    try {
      const data = await postData({ url: '/api/v1/quotes/suggest/', data: {
        distance_km: routeData.distance_km,
        truck_type: 0,
        load_type: 0,
        load_weight: parseFloat(weight || '0'),
        fuel_price: fuelPriceData?.diesel_inland || 22.0,
        fuel_cost: _fuelCost,
        toll_cost: _tollCost,
        driver_cost: _driverAllowance,
        actual_cost: _total,
      }});

      if (data.success) {
        setAiSuggestion(data);
        setShowAISuggestion(true);
      } else {
        setError(data.error || 'AI suggestion failed');
      }
    } catch (err: any) {
      if (err?.response?.status === 503) {
        setError('AI model training — try again later');
      } else {
        setError('Failed to get AI suggestion');
      }
    } finally {
      setLoadingAI(false);
    }
  };

  // Fetch revenue guard assessment
  const fetchRevenueGuard = async () => {
    if (_total <= 0) return;

    try {
      const data = await postData({ url: '/api/v1/quotes/guard/', data: {
        total_cost: _total,
        quote_price: _total,
        distance_km: routeData?.distance_km || 0,
        fuel_cost: _fuelCost,
        toll_cost: _tollCost,
      }});

      if (data.success) {
        setRevenueGuard(data);
      }
    } catch (err) {
      // Silently fail — not critical
    }
  };

  // Update revenue guard when costs change
  useEffect(() => {
    if (currentStep === 3 && _total > 0) {
      fetchRevenueGuard();
    }
  }, [currentStep, _total, _fuelCost, _tollCost]);

  // Fetch market benchmark when Step 3 is reached
  useEffect(() => {
    if (currentStep === 3 && pickupLocation && deliveryLocation && vehicleType) {
      const origin = extractCode(pickupLocation);
      const destination = extractCode(deliveryLocation);

      fetchData(`/api/v1/quotes/benchmark/?origin=${origin}&destination=${destination}&vehicle_type=${vehicleType.toLowerCase()}`)
        .then(data => {
          // Only set if response has valid numeric fields
          if (data && typeof data.market_avg_rate === 'number' && typeof data.your_vs_market_pct === 'number') {
            setMarketBenchmark({ ...data, your_rate: _total });
          }
        })
        .catch(() => {
          // Silently fail — not critical
        });
    }
  }, [currentStep, pickupLocation, deliveryLocation, vehicleType, _total]);

  // Calculate route via TomTom backend
  const calculateRoute = async () => {
    if (!pickupLocation.trim() || !deliveryLocation.trim()) {
      setError('Please enter both pickup and delivery locations');
      return;
    }

    setCalculatingRoute(true);
    setError('');
    setRouteData(null);

    try {
      const data = await postData({ url: '/api/v1/route/calculate/', data: {
        origin: pickupLocation.trim(),
        destination: deliveryLocation.trim(),
        vehicle_type: vehicleType,
        cross_border_enabled: false,
        weight: parseFloat(weight || '20000'),
      }});

      if (data.success) {
        setRouteData(data);
        setError('');
      } else {
        setError(data.error || 'Failed to calculate route');
      }
    } catch (err) {
      setError('Failed to calculate route. Please try again.');
    } finally {
      setCalculatingRoute(false);
    }
  };

  // Cost calculations
  const distanceKm = routeData?.distance_km || 0;
  const baseCost = _baseCost;
  const fuelCost = _fuelCost;
  const tollCost = _tollCost;
  const driverAllowance = _driverAllowance;
  const total = _total;

  // Extract origin and destination codes
  const extractCode = (location: string) => {
    const upper = location.trim().toUpperCase();
    if (upper.includes('JHB') || upper.includes('JOHANNESBURG')) return 'JHB';
    if (upper.includes('CPT') || upper.includes('CAPE TOWN')) return 'CPT';
    if (upper.includes('DUR') || upper.includes('DURBAN')) return 'DUR';
    if (upper.includes('PE') || upper.includes('PORT ELIZABETH')) return 'PE';
    if (upper.includes('BFN') || upper.includes('BLOEMFONTEIN')) return 'BFN';
    if (upper.includes('PTA') || upper.includes('PRETORIA')) return 'PTA';
    return location.substring(0, 3).toUpperCase();
  };

  const mutation = useMutation({
    mutationFn: (data: any) => postData({ url: 'api/v1/quotes/', data }),
    onSuccess: () => navigate('/quotes'),
    onError: (e: any) => setError(e?.message || 'Failed to create quote'),
  });

  const handleSave = () => {
    if (!customerId) {
      setError('Please select a customer');
      return;
    }
    mutation.mutate({
      customer: parseInt(customerId),
      pickup_location: pickupLocation,
      delivery_location: deliveryLocation,
      origin: extractCode(pickupLocation),
      destination: extractCode(deliveryLocation),
      cargo_description: cargoDescription || `${weight}kg ${vehicleType}`,
      weight: parseFloat(weight || '0'),
      distance: distanceKm,
      vehicle_type: vehicleType,
      base_rate: Math.round(baseCost * 100) / 100,
      fuel_surcharge: Math.round(fuelCost * 100) / 100,
      toll_charges: Math.round(tollCost * 100) / 100,
      driver_allowance: Math.round(driverAllowance * 100) / 100,
      additional_charges: Math.round((_weightSurcharge + _additionalCosts) * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
      margin_percentage: 15.0,
      notes,
      status,
      confidence,
      sla_hours: parseInt(slaHours),
      valid_until: validUntil,
    });
  };

  // Step validation
  const canGoToStep2 = routeData && routeData.success;
  const canGoToStep3 = canGoToStep2 && weight && parseFloat(weight) > 0;

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
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >
          ← BACK
        </button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Operations
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>New Quote</div>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        {[1, 2, 3].map(step => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: currentStep >= step ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: `1px solid ${currentStep >= step ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: currentStep >= step ? '#000' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {step}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: currentStep >= step ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {step === 1 && 'ROUTE'}
              {step === 2 && 'FREIGHT'}
              {step === 3 && 'SUMMARY'}
            </span>
            {step < 3 && <div style={{ width: 40, height: 1, background: currentStep > step ? 'var(--accent-primary)' : 'var(--border-subtle)' }} />}
          </div>
        ))}
      </div>

      {/* STEP 1: Route Entry */}
      {currentStep === 1 && (
        <div className="card" style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Step 1: Route Details</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              {label('Pickup Location')}
              <input
                type="text"
                placeholder="e.g. Johannesburg Depot"
                value={pickupLocation}
                onChange={e => { setPickupLocation(e.target.value); setRouteData(null); setAiSuggestion(null); setShowAISuggestion(false); }}
                style={inputStyle}
              />
              {routeData?.origin_resolved && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  RESOLVED: {routeData.origin_resolved}
                </div>
              )}
            </div>
            <div>
              {label('Delivery Location')}
              <input
                type="text"
                placeholder="e.g. Cape Town Warehouse"
                value={deliveryLocation}
                onChange={e => { setDeliveryLocation(e.target.value); setRouteData(null); setAiSuggestion(null); setShowAISuggestion(false); }}
                style={inputStyle}
              />
              {routeData?.dest_resolved && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  RESOLVED: {routeData.dest_resolved}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={calculateRoute}
            disabled={calculatingRoute || !pickupLocation.trim() || !deliveryLocation.trim()}
            className="btn-action"
            style={{ width: '100%', marginBottom: 16 }}
          >
            {calculatingRoute ? 'CALCULATING ROUTE...' : 'CALCULATE ROUTE'}
          </button>

          {error && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--status-danger)', borderRadius: 2, color: 'var(--status-danger)', fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {routeData && routeData.success && (
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, border: `1px solid ${routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)'}`, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
                  ROUTE CALCULATED
                </div>
                <span style={{
                  padding: '2px 8px',
                  background: routeData.source === 'tomtom' ? 'var(--accent-glow)' : 'var(--bg-surface-hover)',
                  border: `1px solid ${routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)'}`,
                  borderRadius: 2,
                  fontSize: 9,
                  color: routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {routeData.source === 'tomtom' ? 'LIVE' : 'ESTIMATED'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>DISTANCE</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{Math.round(routeData.distance_km)} km</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>DURATION</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>
                    {Math.floor(routeData.duration_minutes / 60)}h {routeData.duration_minutes % 60}m
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginBottom: 3 }}>FUEL</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{Math.round(routeData.fuel_usage_litres)} L</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Fuel Cost:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>
                    R {Math.round(routeData.fuel_cost_zar).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Toll Cost:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>
                    R {Math.round(routeData.toll_cost_zar).toLocaleString()}
                  </span>
                </div>
                {fuelPriceData && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Live Fuel Price (FIASA):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                      R {fuelPriceData.diesel_inland.toFixed(2)}/L
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cross-Border Warning Panel */}
          {routeData && routeData.cross_border && (
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 2, border: '1px solid var(--status-warning)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  padding: '2px 8px',
                  background: 'var(--status-warning-bg)',
                  border: '1px solid var(--status-warning)',
                  borderRadius: 2,
                  fontSize: 9,
                  color: 'var(--status-warning)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  CROSS-BORDER ROUTE
                </span>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                  International Crossing Detected
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
                This route crosses borders: {routeData.countries?.join(' → ') || 'Multiple countries'}
              </div>
              {routeData.additional_costs && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                  {routeData.additional_costs.border_fees && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Border Crossing Fees:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>
                        R {Math.round(routeData.additional_costs.border_fees).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {routeData.additional_costs.weighbridge_fees && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Weighbridge Fees:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>
                        R {Math.round(routeData.additional_costs.weighbridge_fees).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {routeData.additional_costs.non_sa_tolls && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>International Tolls:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>
                        R {Math.round(routeData.additional_costs.non_sa_tolls).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {routeData.warnings && routeData.warnings.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg-surface)', borderRadius: 2 }}>
                  {routeData.warnings.map((warning, idx) => (
                    <div key={idx} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: idx < routeData.warnings!.length - 1 ? 4 : 0, fontFamily: 'var(--font-sans)' }}>
                      • {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!canGoToStep2}
              className="btn-action"
              style={{ minWidth: 120 }}
            >
              NEXT →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Freight Details */}
      {currentStep === 2 && (
        <div className="card" style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Step 2: Freight Details</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              {label('Weight (kg)')}
              <input
                type="number"
                placeholder="15000"
                value={weight}
                onChange={e => { setWeight(e.target.value); setAiSuggestion(null); setShowAISuggestion(false); }}
                style={inputStyle}
              />
            </div>
            <div>
              {label('Vehicle Type')}
              <select
                value={vehicleType}
                onChange={e => { setVehicleType(e.target.value as VehicleType); setAiSuggestion(null); setShowAISuggestion(false); }}
                style={inputStyle}
              >
                <option value="Flatbed">Flatbed</option>
                <option value="Tautliner">Tautliner</option>
                <option value="Refrigerated">Refrigerated</option>
                <option value="Box Truck">Box Truck</option>
                <option value="Tanker">Tanker</option>
                <option value="Danger Load">Danger Load</option>
              </select>
            </div>

            {/* UPGRADE 2: Live Fuel Price Badge */}
            {fuelPriceData && (
              <div style={{ padding: '10px 12px', background: 'var(--bg-surface-hover)', borderRadius: 2, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                  LIVE DIESEL PRICES
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
                  Inland: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>R{fuelPriceData.diesel_inland.toFixed(2)}/L</span> ·
                  Coastal: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>R{fuelPriceData.diesel_coastal.toFixed(2)}/L</span>
                </div>
                {fuelPriceData.last_updated && (
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Updated {new Date(fuelPriceData.last_updated).toLocaleDateString()} · Source: {fuelPriceData.source || 'FIASA'}
                  </div>
                )}
                {fuelPriceData.is_stale && (
                  <div style={{ marginTop: 6, padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--status-warning)', borderRadius: 2, fontSize: 10, color: 'var(--status-warning)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Fuel price may be outdated (last update 7+ days ago)
                  </div>
                )}
              </div>
            )}
            <div>
              {label('Cargo Description')}
              <input
                type="text"
                placeholder="e.g. General Freight - Palletized Goods"
                value={cargoDescription}
                onChange={e => setCargoDescription(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              {label('Base Rate per KM (R/km)')}
              <input
                type="number"
                placeholder="10"
                value={baseRatePerKm}
                onChange={e => setBaseRatePerKm(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Live cost breakdown */}
          <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10 }}>
              COST BREAKDOWN (EDITABLE)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Base Cost ({Math.round(distanceKm)} km × R{baseRatePerKm}/km):</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(baseCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Fuel Surcharge ({fuelConsumption}L/100km @ R{fuelPrice.toFixed(2)}/L):</span>
                <input
                  type="number"
                  value={editableFuelCost !== null ? editableFuelCost : Math.round(fuelCost)}
                  onChange={e => setEditableFuelCost(parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Toll Charges:</span>
                <input
                  type="number"
                  value={editableTollCost !== null ? editableTollCost : Math.round(tollCost)}
                  onChange={e => setEditableTollCost(parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 12 }}
                />
              </div>
              {_weightSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Weight Surcharge (15% over 5T):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>R {Math.round(_weightSurcharge).toLocaleString()}</span>
                </div>
              )}
              {_additionalCosts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Cross-Border Fees:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>R {Math.round(_additionalCosts).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Driver Allowance:</span>
                <input
                  type="number"
                  value={driverAllowanceInput}
                  onChange={e => setDriverAllowanceInput(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, width: 100, padding: '4px 8px', fontSize: 12 }}
                />
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  R {Math.round(total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* AI Quote Suggestion Panel */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={fetchAISuggestion}
              disabled={loadingAI || !canGoToStep3 || showAISuggestion}
              className="btn-action"
              style={{ width: '100%', background: showAISuggestion ? 'var(--bg-surface)' : 'var(--bg-surface)', border: '1px solid var(--accent-primary)', color: showAISuggestion ? 'var(--text-tertiary)' : 'var(--accent-primary)', cursor: showAISuggestion ? 'not-allowed' : 'pointer' }}
            >
              {loadingAI ? 'GETTING AI SUGGESTION...' : showAISuggestion ? 'AI SUGGESTION LOADED' : 'GET AI SUGGESTION'}
            </button>

            {showAISuggestion && aiSuggestion && (
              <div style={{ marginTop: 12, padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, border: '1px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
                    AI SUGGESTION
                  </div>
                  <div style={{
                    padding: '2px 8px',
                    background: 'var(--accent-dim)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 2,
                    fontSize: 9,
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {Math.round(aiSuggestion.confidence * 100)}% CONFIDENCE
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Suggested Price:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)' }}>
                      R {Math.round(aiSuggestion.suggested_price).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Predicted Margin:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {aiSuggestion.margin_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Margin Range:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                      {aiSuggestion.margin_range.lower.toFixed(1)}% - {aiSuggestion.margin_range.upper.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* UPGRADE 1: Model stats */}
                {modelStats && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 12, padding: '8px', background: 'var(--bg-surface)', borderRadius: 2 }}>
                    Model trained on {modelStats.synthetic_count.toLocaleString()} synthetic + <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{modelStats.real_quotes_count}</span> real quotes
                  </div>
                )}

                {/* UPGRADE 3: Win Probability Gauge */}
                {aiSuggestion.win_probability !== undefined && (
                  <div style={{ marginBottom: 12, padding: '12px', background: 'var(--bg-surface)', borderRadius: 2 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>
                      WIN PROBABILITY
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(winProbAtAdjusted !== null ? winProbAtAdjusted : aiSuggestion.win_probability) * 100}%`,
                          height: '100%',
                          background: (winProbAtAdjusted !== null ? winProbAtAdjusted : aiSuggestion.win_probability) >= 0.7 ? 'var(--status-success)' : (winProbAtAdjusted !== null ? winProbAtAdjusted : aiSuggestion.win_probability) >= 0.4 ? 'var(--status-warning)' : 'var(--status-danger)',
                          transition: 'all 0.3s ease',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', minWidth: 45 }}>
                        {Math.round((winProbAtAdjusted !== null ? winProbAtAdjusted : aiSuggestion.win_probability) * 100)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      At R {adjustedPrice !== null ? Math.round(adjustedPrice).toLocaleString() : Math.round(aiSuggestion.suggested_price).toLocaleString()} → {Math.round((winProbAtAdjusted !== null ? winProbAtAdjusted : aiSuggestion.win_probability) * 100)}% chance of winning
                    </div>

                    {/* UPGRADE 3: Price Sensitivity */}
                    {aiSuggestion.win_probability_at_lower_price !== undefined && aiSuggestion.win_probability_at_higher_price !== undefined && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', marginBottom: 10, lineHeight: 1.5 }}>
                        <div style={{ marginBottom: 2 }}>
                          Drop R{Math.round(aiSuggestion.suggested_price * 0.05).toLocaleString()} (5%) → {Math.round(aiSuggestion.win_probability_at_lower_price * 100)}% chance
                        </div>
                        <div>
                          Raise R{Math.round(aiSuggestion.suggested_price * 0.05).toLocaleString()} (5%) → {Math.round(aiSuggestion.win_probability_at_higher_price * 100)}% chance
                        </div>
                      </div>
                    )}

                    {/* UPGRADE 3: Price Adjustment Slider */}
                    <div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        ADJUST PROPOSED PRICE (±15%)
                      </div>
                      <input
                        type="range"
                        min={Math.round(aiSuggestion.suggested_price * 0.85)}
                        max={Math.round(aiSuggestion.suggested_price * 1.15)}
                        step={100}
                        value={adjustedPrice !== null ? adjustedPrice : aiSuggestion.suggested_price}
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value);
                          setAdjustedPrice(newPrice);

                          // Debounced win probability update
                          setLoadingWinProb(true);
                          setTimeout(() => {
                            if (!customerId || !routeData) return;
                            postData({
                              url: '/api/v1/quotes/win-probability/',
                              data: {
                                price: newPrice,
                                distance: routeData.distance_km,
                                vehicle_type: vehicleType,
                                client_id: parseInt(customerId),
                                origin: extractCode(pickupLocation),
                                destination: extractCode(deliveryLocation),
                                days_until_departure: Math.ceil(parseInt(slaHours) / 24),
                              }
                            })
                            .then(data => {
                              setWinProbAtAdjusted(data.win_probability);
                              setLoadingWinProb(false);
                            })
                            .catch(() => setLoadingWinProb(false));
                          }, 500);
                        }}
                        style={{
                          width: '100%',
                          height: 6,
                          background: 'var(--bg-deep)',
                          borderRadius: 3,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                        <span>R {Math.round(aiSuggestion.suggested_price * 0.85).toLocaleString()}</span>
                        <span>R {Math.round(aiSuggestion.suggested_price * 1.15).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    // Auto-fill the total with suggested price (or adjusted price if slider was used)
                    const priceToUse = adjustedPrice !== null ? adjustedPrice : aiSuggestion.suggested_price;
                    const suggestedTotal = Math.round(priceToUse);
                    const currentCosts = fuelCost + tollCost + driverAllowance;
                    const newBaseRate = (suggestedTotal - currentCosts) / distanceKm;
                    setBaseRatePerKm(newBaseRate.toFixed(2));
                    setShowAISuggestion(false);
                  }}
                  className="btn-action"
                  style={{ width: '100%', fontSize: 11 }}
                >
                  USE THIS SUGGESTION
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-action"
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', minWidth: 120 }}
            >
              ← BACK
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={!canGoToStep3}
              className="btn-action"
              style={{ minWidth: 120 }}
            >
              NEXT →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Customer & Summary */}
      {currentStep === 3 && (
        <div className="card" style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Step 3: Quote Summary</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              {label('Customer')}
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select customer...</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              {label('Notes (Optional)')}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {label('Status')}
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as 'DRAFT' | 'SENT')}
                  style={inputStyle}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Send to Customer</option>
                </select>
              </div>
              <div>
                {label('Confidence')}
                <select
                  value={confidence}
                  onChange={e => setConfidence(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
                  style={inputStyle}
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {label('SLA (Hours)')}
                <input
                  type="number"
                  value={slaHours}
                  onChange={e => setSlaHours(e.target.value)}
                  placeholder="48"
                  style={inputStyle}
                />
              </div>
              <div>
                {label('Valid Until')}
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* UPGRADE 4: Enhanced Revenue Guard Badge */}
          {revenueGuard && (
            <div style={{
              padding: '16px',
              background: revenueGuard.risk_level === 'AT_RISK' ? 'rgba(239, 68, 68, 0.05)' : revenueGuard.risk_level === 'CAUTION' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(34, 197, 94, 0.05)',
              borderRadius: 2,
              border: `1px solid var(--status-${revenueGuard.color})`,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
                  REVENUE GUARD
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Margin: {(revenueGuard.margin_pct ?? 0).toFixed(1)}%
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    background: `var(--status-${revenueGuard.color})`,
                    borderRadius: 2,
                    fontSize: 10,
                    color: '#000',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {revenueGuard.risk_level === 'SAFE' && <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> SAFE</>}
                    {revenueGuard.risk_level === 'CAUTION' && <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> CAUTION</>}
                    {revenueGuard.risk_level === 'AT_RISK' && <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> AT RISK</>}
                  </span>
                </div>
              </div>

              {/* Margin Floor Display */}
              {revenueGuard.margin_floor && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
                  Minimum viable price (0% margin): <span style={{ color: 'var(--status-danger)', fontWeight: 600 }}>{revenueGuard.margin_floor_display || `R${Math.round(revenueGuard.margin_floor).toLocaleString()}`}</span>
                </div>
              )}

              {/* Explanations Section (expandable for CAUTION/SAFE, pre-expanded for AT_RISK) */}
              {revenueGuard.explanations && revenueGuard.explanations.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => setGuardExpanded(!guardExpanded)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      padding: '4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <span>{guardExpanded || revenueGuard.risk_level === 'AT_RISK' ? '▼' : '▶'}</span>
                    <span>Why is this {revenueGuard.risk_level.replace('_', ' ')}?</span>
                  </button>
                  {(guardExpanded || revenueGuard.risk_level === 'AT_RISK') && (
                    <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 2, marginBottom: 8 }}>
                      {revenueGuard.explanations.map((explanation, idx) => (
                        <div key={idx} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: idx < revenueGuard.explanations!.length - 1 ? 6 : 0, fontFamily: 'var(--font-sans)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> {explanation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Suggestions Section (expandable for CAUTION/SAFE, pre-expanded for AT_RISK) */}
              {revenueGuard.suggestions && revenueGuard.suggestions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 600 }}>
                    How to fix it:
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 2 }}>
                    {revenueGuard.suggestions.map((suggestion, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: idx < revenueGuard.suggestions!.length - 1 ? 6 : 0, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                        → {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {revenueGuard.risk_level === 'AT_RISK' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {revenueGuard.recommended_surcharge_zar && (
                    <button
                      onClick={() => {
                        const surcharge = revenueGuard.recommended_surcharge_zar!;
                        const newAdditionalCharges = (_weightSurcharge + _additionalCosts + surcharge);
                        setDriverAllowanceInput(String(parseFloat(driverAllowanceInput) + surcharge));
                        setNotes(prev => prev + (prev ? '\n' : '') + `Fuel surcharge added: +R${Math.round(surcharge).toLocaleString()} due to diesel price increase`);
                      }}
                      className="btn-action"
                      style={{ fontSize: 10, padding: '8px 12px', background: 'var(--status-warning)', border: 'none', color: '#000', flex: 1 }}
                    >
                      ADD SURCHARGE
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNotes(prev => prev + (prev ? '\n\n' : '') + '**PAYMENT TERM:** 50% deposit required before dispatch. 50% balance due on delivery.');
                    }}
                    className="btn-action"
                    style={{ fontSize: 10, padding: '8px 12px', background: 'var(--accent-primary)', border: 'none', color: '#000', flex: 1 }}
                  >
                    REQUIRE DEPOSIT
                  </button>
                </div>
              )}

              {/* Old warnings (fallback) */}
              {(!revenueGuard.explanations || revenueGuard.explanations.length === 0) && revenueGuard.warnings.length > 0 && (
                <div style={{ padding: '8px', background: 'var(--bg-surface)', borderRadius: 2 }}>
                  {revenueGuard.warnings.map((warning, idx) => (
                    <div key={idx} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: idx < revenueGuard.warnings.length - 1 ? 4 : 0, fontFamily: 'var(--font-sans)' }}>
                      • {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full cost breakdown */}
          <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10 }}>
              FINAL COST BREAKDOWN
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Route:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{pickupLocation} → {deliveryLocation}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Distance:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{Math.round(distanceKm)} km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Cargo:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{weight}kg {vehicleType}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Base Cost:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(baseCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Fuel Surcharge:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(fuelCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Toll Charges:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(tollCost).toLocaleString()}</span>
              </div>
              {_weightSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Weight Surcharge (15% over 5T):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>R {Math.round(_weightSurcharge).toLocaleString()}</span>
                </div>
              )}
              {_additionalCosts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Cross-Border Fees:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>R {Math.round(_additionalCosts).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Driver Allowance:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {driverAllowance.toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-sans)' }}>Quote Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  R {Math.round(total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* UPGRADE 5: Market Benchmark Card */}
          {marketBenchmark && (
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> SA MARKET RATE FOR {marketBenchmark.origin}→{marketBenchmark.destination} {vehicleType.toUpperCase()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Market Average:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                    R {Math.round(marketBenchmark.market_avg_rate).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Market Range:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    R {Math.round(marketBenchmark.market_range_low).toLocaleString()} — R {Math.round(marketBenchmark.market_range_high).toLocaleString()}
                  </span>
                </div>
                {marketBenchmark.data_points > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    From {marketBenchmark.data_points} recent quotes · Confidence: {marketBenchmark.confidence}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Your Quote:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    R {Math.round(total).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Position:</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    color: marketBenchmark.your_vs_market_pct < 0 ? 'var(--status-success)' : marketBenchmark.your_vs_market_pct > 10 ? 'var(--status-danger)' : 'var(--status-warning)',
                    fontWeight: 600
                  }}>
                    {(marketBenchmark.your_vs_market_pct ?? 0) > 0 ? '+' : ''}{(marketBenchmark.your_vs_market_pct ?? 0).toFixed(1)}% {(marketBenchmark.your_vs_market_pct ?? 0) < 0 ? 'below' : 'above'} market
                    {(marketBenchmark.your_vs_market_pct ?? 0) < 0 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, display: 'inline-block', verticalAlign: 'middle' }}><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                </div>
              </div>

              {marketBenchmark.recommendation && (
                <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 2, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> RECOMMENDATION</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                    {marketBenchmark.recommendation}
                  </div>
                </div>
              )}

              {marketBenchmark.data_points < 10 && (
                <div style={{ fontSize: 10, color: 'var(--status-warning)', fontFamily: 'var(--font-sans)', marginBottom: 10, padding: '8px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> {marketBenchmark.data_points < 5
                    ? 'Market data building — not enough quotes on this lane yet. Using industry averages.'
                    : 'Limited market data for this lane. Take recommendation as guidance.'}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowBenchmarkModal(true)}
                  className="btn-action"
                  style={{ fontSize: 10, padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', flex: 1 }}
                >
                  LEARN MORE
                </button>
                <button
                  onClick={() => {
                    // Adjust price to market average
                    const marketPrice = marketBenchmark.market_avg_rate;
                    const currentCosts = fuelCost + tollCost + driverAllowance + _weightSurcharge + _additionalCosts;
                    const newBaseRate = (marketPrice - currentCosts) / distanceKm;
                    setBaseRatePerKm(newBaseRate.toFixed(2));
                  }}
                  className="btn-action"
                  style={{ fontSize: 10, padding: '8px 12px', background: 'var(--accent-primary)', border: 'none', color: '#000', flex: 1 }}
                >
                  ADJUST TO MARKET AVG
                </button>
              </div>
            </div>
          )}

          {/* Learn More Modal */}
          {showBenchmarkModal && marketBenchmark && (
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
            onClick={() => setShowBenchmarkModal(false)}
            >
              <div
                className="card"
                style={{ padding: 24, maxWidth: 500, margin: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                  How is this calculated?
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                  We track accepted quotes on this lane and route over the past 90 days. The "market average" is the median price of recent, accepted jobs.
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 2, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Lane:</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{marketBenchmark.origin} → {marketBenchmark.destination}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Vehicle Type:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{marketBenchmark.vehicle_type}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Data Points:</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{marketBenchmark.data_points} quotes (past 90 days)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Market Average:</span>
                      <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>R {Math.round(marketBenchmark.market_avg_rate).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Range:</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        R {Math.round(marketBenchmark.market_range_low).toLocaleString()} — R {Math.round(marketBenchmark.market_range_high).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                  Your quote (R {Math.round(total).toLocaleString()}) is {Math.abs(marketBenchmark.your_vs_market_pct ?? 0).toFixed(1)}% {(marketBenchmark.your_vs_market_pct ?? 0) < 0 ? 'below' : 'above'} average, which is {(marketBenchmark.your_vs_market_pct ?? 0) < 0 ? 'competitive' : (marketBenchmark.your_vs_market_pct ?? 0) > 15 ? 'significantly above market' : 'within range'}.
                </div>
                <button
                  onClick={() => setShowBenchmarkModal(false)}
                  className="btn-action"
                  style={{ width: '100%' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--status-danger)', borderRadius: 2, color: 'var(--status-danger)', fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-action"
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', minWidth: 120 }}
            >
              ← BACK
            </button>
            <button
              onClick={handleSave}
              disabled={mutation.isPending || !customerId}
              className="btn-action"
              style={{ minWidth: 140 }}
            >
              {mutation.isPending ? 'SAVING...' : 'SAVE QUOTE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
