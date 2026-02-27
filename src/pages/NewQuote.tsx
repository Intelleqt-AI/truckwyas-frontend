import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";

// SA constants
const DEFAULT_BASE_RATE_PER_KM = 10;
const FUEL_PRICE_PER_LITRE = 21.7;

type VehicleType = 'Flatbed' | 'Tautliner' | 'Refrigerated' | 'Box Truck' | 'Tanker';

interface RouteData {
  distance_km: number;
  duration_minutes: number;
  fuel_usage_litres: number;
  fuel_cost_zar: number;
  toll_cost_zar: number;
  total_cost_zar: number;
  success: boolean;
  source: 'tomtom' | 'estimated';
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

  // Step 3: Customer & Summary
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SENT'>('DRAFT');

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchData('api/v1/customers/')
  });
  const customers = customersData?.results || customersData || [];

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
      const data = await postData('/api/v1/route/calculate/', {
        origin: pickupLocation.trim(),
        destination: deliveryLocation.trim(),
        vehicle_type: 'truck',
        weight_kg: parseFloat(weight || '20000'),
      });

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
  const baseCost = distanceKm * parseFloat(baseRatePerKm || '0');
  const fuelCost = routeData?.fuel_cost_zar || 0;
  const tollCost = routeData?.toll_cost_zar || 0;
  const driverAllowance = 0; // default 0
  const total = baseCost + fuelCost + tollCost + driverAllowance;

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
      customer: customerId,
      pickup_location: pickupLocation,
      delivery_location: deliveryLocation,
      origin: pickupLocation,
      destination: deliveryLocation,
      cargo_description: `${weight}kg ${vehicleType}`,
      weight: parseFloat(weight || '0'),
      distance: Math.round(distanceKm),
      base_rate: Math.round(baseCost),
      fuel_surcharge: Math.round(fuelCost),
      toll_charges: Math.round(tollCost),
      driver_allowance: driverAllowance,
      additional_charges: 0,
      total_amount: Math.round(total),
      notes,
      status,
      confidence: 'MEDIUM',
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
          onClick={() => navigate('/quotes')}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >
          ← BACK
        </button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Operations
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>New Quote</div>
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
                onChange={e => setPickupLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              {label('Delivery Location')}
              <input
                type="text"
                placeholder="e.g. Cape Town Warehouse"
                value={deliveryLocation}
                onChange={e => setDeliveryLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={calculateRoute}
            disabled={calculatingRoute || !pickupLocation.trim() || !deliveryLocation.trim()}
            className="btn-action"
            style={{ width: '100%', marginBottom: 16 }}
          >
            {calculatingRoute ? 'CALCULATING ROUTE...' : '🗺️ CALCULATE ROUTE (TomTom)'}
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
                  background: routeData.source === 'tomtom' ? 'rgba(0, 194, 255, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                  border: `1px solid ${routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)'}`,
                  borderRadius: 2,
                  fontSize: 9,
                  color: routeData.source === 'tomtom' ? 'var(--accent-primary)' : 'var(--status-warning)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {routeData.source === 'tomtom' ? 'TOMTOM' : 'ESTIMATED'}
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
                  <span style={{ color: 'var(--text-secondary)' }}>Fuel Cost:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>
                    R {Math.round(routeData.fuel_cost_zar).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Toll Cost:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success)', fontWeight: 600 }}>
                    R {Math.round(routeData.toll_cost_zar).toLocaleString()}
                  </span>
                </div>
              </div>
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
                onChange={e => setWeight(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              {label('Vehicle Type')}
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value as VehicleType)}
                style={inputStyle}
              >
                <option value="Flatbed">Flatbed</option>
                <option value="Tautliner">Tautliner</option>
                <option value="Refrigerated">Refrigerated</option>
                <option value="Box Truck">Box Truck</option>
                <option value="Tanker">Tanker</option>
              </select>
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
              COST BREAKDOWN
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Cost ({Math.round(distanceKm)} km × R{baseRatePerKm}/km):</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(baseCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fuel Surcharge:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(fuelCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Toll Charges:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(tollCost).toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  R {Math.round(total).toLocaleString()}
                </span>
              </div>
            </div>
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
          </div>

          {/* Full cost breakdown */}
          <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10 }}>
              FINAL COST BREAKDOWN
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Route:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{pickupLocation} → {deliveryLocation}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Distance:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{Math.round(distanceKm)} km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cargo:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{weight}kg {vehicleType}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Cost:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(baseCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fuel Surcharge:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(fuelCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Toll Charges:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {Math.round(tollCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Driver Allowance:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>R {driverAllowance.toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Quote Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  R {Math.round(total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

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
