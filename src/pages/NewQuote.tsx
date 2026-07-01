import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, patchData, fetchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { LocationInput, type LocationCoords } from "@/components/LocationInput";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Fuel consumption fallback map (L/100km) — used only when VehicleType DB record has no value
const FUEL_CONSUMPTION_FALLBACK: Record<string, number> = {
  "Semi-Trailer Truck": 38,
  "Rigid Truck": 28,
  "Flatbed Truck": 36,
  "Refrigerated Truck": 42,
  Tanker: 40,
  Tautliner: 36,
  "Box Truck": 25,
};

interface RouteGeoPoint {
  lat: number;
  lon: number;
}

// One route option returned by TomTom (best + alternatives). No custom ranking.
interface RouteOption {
  index: number;
  is_best: boolean;
  label: string;
  distance_km: number;
  duration_minutes: number;
  traffic_delay_minutes?: number | null;
  no_traffic_minutes?: number | null;
  historic_minutes?: number | null;
  live_minutes?: number | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  fuel_usage_litres: number;
  fuel_cost_zar: number;
  toll_cost_zar: number;
  total_cost_zar: number;
  // Rich metadata
  toll_count?: number;
  has_tunnel?: boolean;
  motorway_pct?: number;
  road_type?: string;
  max_traffic_severity?: number;
  traffic_status?: string;
  traffic_vs_historic?: number | null;
  congested_km?: number;
  country_codes?: string[];
  terrain?: string[];
  sections?: Array<Record<string, unknown>>;
  geometry: RouteGeoPoint[];
}

interface RouteData {
  distance_km: number;
  duration_minutes: number;
  fuel_usage_litres: number;
  fuel_cost_zar: number;
  toll_cost_zar: number;
  total_cost_zar: number;
  success: boolean;
  source: "tomtom" | "estimated";
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
  routes?: RouteOption[];
  best_index?: number;
}

interface FuelPriceData {
  diesel_inland: number;
  diesel_coastal: number;
  source: string;
  is_stale?: boolean;
  last_updated?: string;
}

interface RevenueGuard {
  risk_level: "SAFE" | "CAUTION" | "AT_RISK";
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
  win_model?: {
    mode: "learned" | "heuristic";
    trained: boolean;
    outcomes_collected: number;
    outcomes_needed: number;
    progress_pct: number;
    auc?: number | null;
    last_trained?: string | null;
  } | null;
}

interface MarketBenchmark {
  origin: string;
  destination: string;
  vehicle_type: string;
  market_avg_rate: number;
  market_range_low: number;
  market_range_high: number;
  data_points: number;
  confidence: "high" | "medium" | "low";
  your_rate: number;
  your_vs_market_pct: number;
  recommendation: string;
}

// Response shape of POST /api/v1/quotes/analyze/ (comprehensive AI quote analysis)
interface AnalysisCost {
  success?: boolean;
  risk_level?: string;
  color?: string;
  margin_pct?: number;
  cost_per_km?: number | null;
  explanations?: string[];
  suggestions?: string[];
  margin_floor_display?: string;
}
interface AnalysisFuel {
  current_price?: number | null;
  is_stale?: boolean;
  last_updated?: string | null;
  stale_warning?: string | null;
  price_note?: string | null;
  fuel_cost_zar?: number;
  fuel_usage_litres?: number | null;
  fuel_pct_of_total?: number | null;
  fuel_price_used?: number | null;
}
interface AnalysisMarket {
  market_rate?: number | null;
  source?: string;
  your_vs_market_pct?: number | null;
}
interface AnalysisOptimization {
  optimal_price?: number;
  optimal_margin_pct?: number;
  win_probability_at_optimal?: number | null;
  expected_profit?: number;
  curve?: Array<{ margin_pct: number; win_probability: number; expected_profit: number }>;
}
interface QuoteAnalysis {
  success: boolean;
  route?: string | null;
  quote_total?: number;
  cost_analysis?: AnalysisCost;
  fuel_analysis?: AnalysisFuel;
  price_optimization?: AnalysisOptimization;
  market_analysis?: AnalysisMarket;
  suggested_price?: number;
  suggested_price_rationale?: string | null;
  narrative?: string;
  narrative_source?: string;
}

export default function NewQuote() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!editId;
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(!!editId);

  // Step 1: Route data
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<LocationCoords | null>(
    null,
  );
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  // 3 TomTom routes (best + 2 alternatives) for the outbound leg, and which one is chosen.
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [expandedRouteIndex, setExpandedRouteIndex] = useState<number | null>(
    0,
  );
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [activeMapField, setActiveMapField] = useState<
    "pickup" | "delivery" | "return"
  >("pickup");
  const [mapExpanded, setMapExpanded] = useState(false);

  // Round trip state
  const [tripType, setTripType] = useState<"ONE_WAY" | "ROUND_TRIP">("ONE_WAY");
  const [returnLocation, setReturnLocation] = useState("");
  const [returnCoords, setReturnCoords] = useState<LocationCoords | null>(null);
  const [returnCargo, setReturnCargo] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnBaseRate, setReturnBaseRate] = useState("0");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnRouteData, setReturnRouteData] = useState<RouteData | null>(
    null,
  );

  // Step 2: Freight details
  const [weight, setWeight] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [baseRatePerKm, setBaseRatePerKm] = useState("10");
  const [crossBorderEnabled, setCrossBorderEnabled] = useState(true);
  const [cbPopoverOpen, setCbPopoverOpen] = useState(false);
  const [cargoDescription, setCargoDescription] = useState("");
  const [driverAllowanceInput, setDriverAllowanceInput] = useState("0");
  const [editableFuelCost, setEditableFuelCost] = useState<number | null>(null);
  const [editableTollCost, setEditableTollCost] = useState<number | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [editableTotalCostStr, setEditableTotalCostStr] = useState<string>("");

  // Step 3: Customer & Summary
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  // Quick-create customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [status, setStatus] = useState<"DRAFT" | "SENT">("DRAFT");
  const [confidence, setConfidence] = useState<"HIGH" | "MEDIUM" | "LOW">(
    "MEDIUM",
  );
  const [slaHours, setSlaHours] = useState("48");
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0];
  });

  const [customFuelPricePerL, setCustomFuelPricePerL] = useState<string>("");
  const [costMode, setCostMode] = useState<"fuel" | "base_rate">("fuel");

  // New Phase 2 features
  const [fuelPriceData, setFuelPriceData] = useState<FuelPriceData | null>(
    null,
  );
  const [revenueGuard, setRevenueGuard] = useState<RevenueGuard | null>(null);

  // Sprint 1 features
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [marketBenchmark, setMarketBenchmark] =
    useState<MarketBenchmark | null>(null);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [guardExpanded, setGuardExpanded] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimal, setOptimal] = useState<AnalysisOptimization | null>(null);
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);

  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => fetchData("api/v1/company/profile/"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vehicleTypesRaw } = useQuery({
    queryKey: ["vehicle-types"],
    queryFn: () => fetchData("api/v1/vehicle-types/"),
    staleTime: 5 * 60 * 1000,
  });
  const vehicleTypes: {
    id: number;
    name: string;
    capacity?: string | number;
    fuel_consumption_l_per_100km?: string | number;
    base_rate?: string | number;
  }[] = vehicleTypesRaw?.results || vehicleTypesRaw || [];

  type VehicleOption = {
    id: number;
    make: string;
    model: string;
    plate: string;
    status: string;
    capacity?: string | number;
    vehicle_type_name?: string;
    driver?: number | null;
  };
  type DriverOption = {
    id: number;
    status: string;
    user_details?: {
      name?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };

  // Re-fetch vehicles whenever vehicleType changes — available only
  const { data: vehiclesRaw } = useQuery({
    queryKey: ["vehicles", vehicleType],
    queryFn: () =>
      fetchData(
        vehicleType
          ? `api/v1/vehicles/?vehicle_type__name=${encodeURIComponent(vehicleType)}&status=AVAILABLE`
          : "api/v1/vehicles/?status=AVAILABLE",
      ),
    staleTime: 60 * 1000,
  });
  const vehicles: VehicleOption[] = vehiclesRaw?.results || vehiclesRaw || [];

  // The currently selected vehicle object (needed to resolve its driver)
  const selectedVehicle: VehicleOption | undefined = vehicles.find(
    (v) => v.id === parseInt(selectedVehicleId || "0"),
  );

  // Re-fetch drivers whenever the selected vehicle changes.
  // If the vehicle has an assigned driver, fetch only that driver via ?vehicles__id=
  // Otherwise fetch all drivers.
  const { data: driversRaw } = useQuery({
    queryKey: ["drivers", selectedVehicleId],
    queryFn: () =>
      selectedVehicleId
        ? fetchData(`api/v1/drivers/?vehicles__id=${selectedVehicleId}`)
        : fetchData("api/v1/drivers/"),
    staleTime: 60 * 1000,
  });
  const drivers: DriverOption[] = driversRaw?.results || driversRaw || [];

  // Cost calculations — defined early so they can be used in callbacks/effects below
  // Mobile app formula implementation
  // The chosen route (best by default, or an alternative the user clicked) drives cost + time.
  const selectedRoute: RouteOption | null = routeData
    ? (routeOptions[selectedRouteIndex] ?? null)
    : null;
  const distance =
    (routeData ? (selectedRoute?.distance_km ?? routeData.distance_km) : 0) ||
    0;
  const _baseCost = distance * parseFloat(baseRatePerKm || "0");

  const selectedVehicleTypeBaseRate = (() => {
    const vt = vehicleTypes.find((v) => v.name === vehicleType);
    return vt?.base_rate != null ? parseFloat(String(vt.base_rate)) : null;
  })();

  // Fuel cost: (distance × fuelConsumptionL100km × fuelPricePerLitre) / 100
  const fuelConsumption = (() => {
    const vt = vehicleTypes.find(
      (v: { name: string; fuel_consumption_l_per_100km?: string | number }) =>
        v.name === vehicleType,
    );
    return vt?.fuel_consumption_l_per_100km
      ? parseFloat(String(vt.fuel_consumption_l_per_100km))
      : (FUEL_CONSUMPTION_FALLBACK[vehicleType] ?? 36);
  })();
  const fuelPrice =
    fuelPriceData?.diesel_inland ||
    (companyProfile?.fuel_price_per_litre
      ? parseFloat(companyProfile.fuel_price_per_litre)
      : null) ||
    21.7;
  const calculatedFuelCost = (distance * fuelConsumption * fuelPrice) / 100;
  const _fuelCost =
    editableFuelCost !== null ? editableFuelCost : calculatedFuelCost;

  // Toll cost: TomTom value OR company default toll rate/km fallback
  const tollRatePerKm = companyProfile?.default_toll_rate_per_km
    ? parseFloat(companyProfile.default_toll_rate_per_km)
    : 0.5;
  const calculatedTollCost =
    (selectedRoute?.toll_cost_zar ?? routeData?.toll_cost_zar) ||
    distance * tollRatePerKm;
  const _tollCost =
    editableTollCost !== null ? editableTollCost : calculatedTollCost;

  // Weight surcharge — thresholds from company profile
  const weightKg = parseFloat(weight || "0");
  const weightThreshold = companyProfile?.weight_surcharge_threshold_kg ?? 5000;
  const weightSurchargePct = (companyProfile?.weight_surcharge_pct ?? 15) / 100;
  const _weightSurcharge =
    weightKg > weightThreshold ? _fuelCost * weightSurchargePct : 0;

  // Additional costs (cross-border only)
  const _additionalCosts =
    (routeData?.additional_costs?.border_fees || 0) +
    (routeData?.additional_costs?.weighbridge_fees || 0) +
    (routeData?.additional_costs?.non_sa_tolls || 0);

  const _driverAllowance = parseFloat(driverAllowanceInput || "0");
  const _returnRate =
    tripType === "ROUND_TRIP" ? parseFloat(returnBaseRate || "0") : 0;

  // Total: fuelCost + tollCost + weightSurcharge + additionalCosts + driverAllowance + serviceCharge + returnRate
  const _total =
    _fuelCost +
    _tollCost +
    _weightSurcharge +
    _additionalCosts +
    _driverAllowance +
    serviceCharge +
    _returnRate;

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchData("api/v1/customers/"),
  });
  const customers = customersData?.results || customersData || [];

  // Fetch current fuel prices on mount
  useEffect(() => {
    fetchData("/api/v1/fuel-prices/current/")
      .then((data) => {
        if (data.success || data.inland_price) {
          setFuelPriceData(data);
        }
      })
      .catch(() => {
        // Silently fail — not critical
      });
  }, []);

  // Apply company profile defaults when loaded (new quote only)
  useEffect(() => {
    if (!companyProfile || isEditing) return;
    if (companyProfile.default_base_rate_per_km != null)
      setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
    if (companyProfile.default_sla_hours != null)
      setSlaHours(String(companyProfile.default_sla_hours));
    if (companyProfile.default_quote_validity_days != null) {
      const d = new Date();
      d.setDate(d.getDate() + companyProfile.default_quote_validity_days);
      setValidUntil(d.toISOString().split("T")[0]);
    }
    if (companyProfile.allow_cross_border != null)
      setCrossBorderEnabled(companyProfile.allow_cross_border);
  }, [companyProfile, isEditing]);

  // Fetch model stats on mount
  useEffect(() => {
    fetchData("/api/v1/quotes/model-stats/")
      .then((data) => {
        setModelStats(data);
      })
      .catch(() => {
        // Silently fail — not critical
      });
  }, []);

  // AI price optimizer — maximise expected profit = price × P(win). Always
  // available (heuristic win-prob), unlike the ML suggest endpoint.
  const fetchOptimal = async () => {
    if (_total <= 0) return;
    setError("");
    setOptimizing(true);
    setOptimal(null);
    setAnalysis(null);
    try {
      const outboundTotal = _total - _returnRate;
      const directCost =
        _fuelCost + _tollCost + _weightSurcharge + _additionalCosts + _driverAllowance;
      const data: QuoteAnalysis = await postData({
        url: "api/v1/quotes/analyze/",
        data: {
          quote_total: Math.round(outboundTotal * 100) / 100,
          direct_cost: Math.round(directCost * 100) / 100,
          distance_km: distanceKm,
          origin: extractCode(pickupLocation),
          destination: extractCode(deliveryLocation),
          vehicle_type: vehicleType,
          weight: parseFloat(weight || "0"),
          fuel_cost: Math.round(_fuelCost * 100) / 100,
          toll_cost: Math.round(_tollCost * 100) / 100,
          driver_cost: Math.round(_driverAllowance * 100) / 100,
          fuel_usage_litres:
            selectedRoute?.fuel_usage_litres ?? routeData?.fuel_usage_litres ?? null,
          fuel_price_used: fuelPrice,
          market_rate: Math.round(marketBenchmark?.market_avg_rate || 0),
          client_tier: "standard",
        },
      });
      if (data?.success) {
        setAnalysis(data);
        setOptimal(data.price_optimization ?? null);
      } else {
        setError("Could not analyse this quote");
      }
    } catch (err) {
      setError((err as Error)?.message || "Failed to analyse quote");
    } finally {
      setOptimizing(false);
    }
  };

  // Apply the AI-suggested price by setting a service charge to bridge the gap.
  const applyOptimal = () => {
    const suggested = analysis?.suggested_price ?? optimal?.optimal_price;
    if (!suggested) return;
    const currentCosts = _fuelCost + _tollCost + _weightSurcharge + _additionalCosts + _driverAllowance;
    const diff = suggested - _returnRate - currentCosts;
    setServiceCharge(Math.max(0, Math.round(diff)));
    setOptimal(null);
    setAnalysis(null);
  };

  // Fetch revenue guard assessment
  const fetchRevenueGuard = async () => {
    if (_total <= 0) return;

    try {
      // Direct operating costs (what the carrier pays out):
      // fuel + tolls + driver allowance + cross-border fees + weight surcharge.
      // The base rate covers vehicle ownership, overhead, and profit — it IS the margin.
      const directCosts =
        _fuelCost +
        _tollCost +
        _driverAllowance +
        _additionalCosts +
        _weightSurcharge;

      const data = await postData({
        url: "/api/v1/quotes/guard/",
        data: {
          total_cost: Math.round(directCosts * 100) / 100,
          quote_price: Math.round((_total - _returnRate) * 100) / 100,
          distance_km: routeData?.distance_km || 0,
          fuel_cost: _fuelCost,
          toll_cost: _tollCost,
        },
      });

      if (data.success) {
        setRevenueGuard(data);
      }
    } catch (err) {
      // Silently fail — not critical
    }
  };

  // Update revenue guard when costs change (Revenue Guard now lives in Step 2,
  // alongside the editable cost breakdown, so it reflects margin health live).
  useEffect(() => {
    if (currentStep === 2 && _total > 0) {
      fetchRevenueGuard();
    }
  }, [currentStep, _total, _fuelCost, _tollCost]);

  // Fetch market benchmark when Step 3 is reached
  useEffect(() => {
    if (
      currentStep === 3 &&
      pickupLocation &&
      deliveryLocation &&
      vehicleType
    ) {
      const origin = extractCode(pickupLocation);
      const destination = extractCode(deliveryLocation);

      fetchData(
        `/api/v1/quotes/benchmark/?origin=${origin}&destination=${destination}&vehicle_type=${vehicleType.toLowerCase()}`,
      )
        .then((data) => {
          // Only set if response has valid numeric fields
          if (
            data &&
            typeof data.market_avg_rate === "number" &&
            typeof data.your_vs_market_pct === "number"
          ) {
            setMarketBenchmark({ ...data, your_rate: _total - _returnRate });
          }
        })
        .catch(() => {
          // Silently fail — not critical
        });
    }
  }, [
    currentStep,
    pickupLocation,
    deliveryLocation,
    vehicleType,
    _total,
    _returnRate,
  ]);

  // Calculate route(s) — both legs when ROUND_TRIP. Accepts optional overrides
  // so callers (e.g. the AI-chat prefill) can pass freshly-resolved values
  // immediately after setState, before state settles.
  const calculateRoute = async (opts?: {
    origin?: string;
    destination?: string;
    originCoords?: LocationCoords | null;
    destCoords?: LocationCoords | null;
  }) => {
    const origin = (opts?.origin ?? pickupLocation).trim();
    const destination = (opts?.destination ?? deliveryLocation).trim();
    // `!== undefined` is load-bearing: a caller passing `null` (geocode found
    // nothing) must NOT silently fall back to stale state coords.
    const oCoords =
      opts?.originCoords !== undefined ? opts.originCoords : pickupCoords;
    const dCoords =
      opts?.destCoords !== undefined ? opts.destCoords : deliveryCoords;

    if (!origin || !destination) {
      setError("Please enter both pickup and delivery locations");
      return;
    }
    if (tripType === "ROUND_TRIP" && !returnLocation.trim()) {
      setError("Please enter a return destination for the round trip");
      return;
    }

    setCalculatingRoute(true);
    setError("");
    setSelectedRouteIndex(0);
    setReturnRouteData(null);

    try {
      // Always calculate outbound leg
      const outbound = await postData({
        url: "/api/v1/route/calculate/",
        data: {
          origin,
          destination,
          ...(oCoords && {
            origin_lat: oCoords.lat,
            origin_lon: oCoords.lon,
          }),
          ...(dCoords && {
            dest_lat: dCoords.lat,
            dest_lon: dCoords.lon,
          }),
          vehicle_type: vehicleType,
          cross_border_enabled: crossBorderEnabled,
          weight_kg: parseFloat(weight || "20") * 1000,
        },
      });

      if (!outbound.success) {
        setError(outbound.error || "Failed to calculate outbound route");
        return;
      }
      setRouteData(outbound);
      // Capture all TomTom routes; default selection = TomTom's best (best_index).
      setRouteOptions(outbound.routes || []);
      setSelectedRouteIndex(outbound.best_index ?? 0);

      // Also calculate return leg for ROUND_TRIP
      if (tripType === "ROUND_TRIP") {
        const ret = await postData({
          url: "/api/v1/route/calculate/",
          data: {
            origin: deliveryLocation.trim(),
            destination: returnLocation.trim(),
            ...(deliveryCoords && {
              origin_lat: deliveryCoords.lat,
              origin_lon: deliveryCoords.lon,
            }),
            ...(returnCoords && {
              dest_lat: returnCoords.lat,
              dest_lon: returnCoords.lon,
            }),
            vehicle_type: vehicleType,
            cross_border_enabled: crossBorderEnabled,
            weight_kg: parseFloat(weight || "20") * 1000,
          },
        });
        if (ret.success) {
          setReturnRouteData(ret);
          const d = ret.distance_km || 0;
          const retBase = d * parseFloat(baseRatePerKm || "0");
          const retFuel = (d * fuelConsumption * fuelPrice) / 100;
          const retToll = ret.toll_cost_zar || d * tollRatePerKm;
          setReturnBaseRate(String(Math.round(retBase + retFuel + retToll)));
        } else {
          setError(ret.error || "Failed to calculate return route");
        }
      }
    } catch {
      setError("Failed to calculate route. Please try again.");
    } finally {
      setCalculatingRoute(false);
    }
  };

  // Re-calculate (re-call TomTom + fuel/toll) when the vehicle type changes after an initial
  // calc, so fuel & toll reflect the new vehicle. Skip the first run (mount / edit prefill).
  const vtFirstRun = useRef(true);
  useEffect(() => {
    if (vtFirstRun.current) {
      vtFirstRun.current = false;
      return;
    }
    if (routeData && !calculatingRoute && pickupCoords && deliveryCoords) {
      calculateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType]);

  // Preview route alternatives as soon as both locations are pinned — no weight/vehicle needed.
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (
      !pickupCoords ||
      !deliveryCoords ||
      routeData ||
      calculatingRoute ||
      currentStep !== 1
    )
      return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await postData({
          url: "/api/v1/route/calculate/",
          data: {
            origin: pickupLocation,
            destination: deliveryLocation,
            origin_lat: pickupCoords.lat,
            origin_lon: pickupCoords.lon,
            dest_lat: deliveryCoords.lat,
            dest_lon: deliveryCoords.lon,
            vehicle_type: vehicleType || "Flatbed Truck",
            cross_border_enabled: crossBorderEnabled,
            weight_kg: 20000,
          },
        });
        if (res?.success && res.routes?.length) {
          setRouteOptions(res.routes);
          setSelectedRouteIndex(res.best_index ?? 0);
        }
      } catch {
        // silently ignore — preview is best-effort
      }
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, deliveryCoords]);

  // Edit mode: load the existing quote and prefill the form
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingQuote(true);
    fetchData(`api/v1/quotes/${editId}/`)
      .then((q: any) => {
        if (cancelled || !q) return;
        setPickupLocation(q.pickup_location || "");
        setDeliveryLocation(q.delivery_location || "");
        if (q.pickup_lat != null && q.pickup_lng != null)
          setPickupCoords({
            lat: parseFloat(q.pickup_lat),
            lon: parseFloat(q.pickup_lng),
          });
        if (q.delivery_lat != null && q.delivery_lng != null)
          setDeliveryCoords({
            lat: parseFloat(q.delivery_lat),
            lon: parseFloat(q.delivery_lng),
          });
        setWeight(q.weight != null ? String(q.weight / 1000) : "");
        if (q.vehicle_type) setVehicleType(q.vehicle_type);
        if (q.vehicle != null) setSelectedVehicleId(String(q.vehicle));
        if (q.driver != null) setSelectedDriverId(String(q.driver));
        setCargoDescription(q.cargo_description || "");
        setDriverAllowanceInput(
          q.driver_allowance != null ? String(q.driver_allowance) : "0",
        );
        setCustomerId(q.customer != null ? String(q.customer) : "");
        setNotes(q.notes || "");
        if (q.status === "DRAFT" || q.status === "SENT") setStatus(q.status);
        if (q.confidence) setConfidence(q.confidence);
        if (q.sla_hours != null) setSlaHours(String(q.sla_hours));
        if (q.valid_until) setValidUntil(String(q.valid_until).split("T")[0]);
        // Reconstruct cost state from the saved quote so totals render without re-running route calc
        const dist = parseFloat(q.distance || "0");
        if (dist > 0) {
          setRouteData({
            success: true,
            distance_km: dist,
            toll_cost_zar: parseFloat(q.toll_charges || "0"),
            fuel_cost_zar: parseFloat(q.fuel_surcharge || "0"),
            duration_minutes: 0,
            fuel_usage_litres: 0,
            total_cost_zar: 0,
            source: "estimated",
          } as RouteData);
          if (q.base_rate != null)
            setBaseRatePerKm(String((parseFloat(q.base_rate) || 0) / dist));
        }
        if (q.fuel_surcharge != null)
          setEditableFuelCost(parseFloat(q.fuel_surcharge));
        if (q.toll_charges != null)
          setEditableTollCost(parseFloat(q.toll_charges));
        // Round trip fields
        if (q.trip_type) setTripType(q.trip_type);
        if (q.return_location) setReturnLocation(q.return_location);
        if (q.return_lat != null && q.return_lng != null)
          setReturnCoords({
            lat: parseFloat(q.return_lat),
            lon: parseFloat(q.return_lng),
          });
        if (q.return_cargo) setReturnCargo(q.return_cargo);
        if (q.return_date) setReturnDate(String(q.return_date).split("T")[0]);
        if (q.return_base_rate != null)
          setReturnBaseRate(String(q.return_base_rate));
        if (q.return_notes) setReturnNotes(q.return_notes);
        setCurrentStep(3);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load quote for editing");
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // Geocode a free-text location to coords via the same backend endpoint the
  // LocationInput autocomplete uses. Returns null on no match / no key / error.
  const geocodeFirst = async (q: string): Promise<LocationCoords | null> => {
    try {
      const r = await fetchData(
        `api/v1/location/suggest/?q=${encodeURIComponent(q)}`,
      );
      const s = Array.isArray(r) ? r[0] : null;
      return s && typeof s.lat === "number" && typeof s.lon === "number"
        ? { lat: s.lat, lon: s.lon }
        : null;
    } catch {
      return null;
    }
  };

  // Prefill from the AI Quote Chat hand-off (navigate('/quotes/new', { state: { prefill }})).
  // The chat passes only text (pickup/delivery/cargo/weight/vehicle), so we
  // geocode the locations to coords (drives the map markers + route) and
  // auto-calculate the route so the operator doesn't re-enter or re-calculate.
  useEffect(() => {
    if (isEditing) return;
    const p = (location.state as any)?.prefill;
    if (!p) return;
    if (p.pickup_location) setPickupLocation(p.pickup_location);
    if (p.delivery_location) setDeliveryLocation(p.delivery_location);
    if (p.weight != null && p.weight !== "")
      setWeight(String(parseFloat(String(p.weight)) / 1000));
    if (p.cargo_description) setCargoDescription(p.cargo_description);
    if (p.vehicle_type) setVehicleType(p.vehicle_type);

    if (!p.pickup_location || !p.delivery_location) return;

    let cancelled = false;
    (async () => {
      const [pc, dc] = await Promise.all([
        geocodeFirst(p.pickup_location),
        geocodeFirst(p.delivery_location),
      ]);
      if (cancelled) return;
      // Setting coords makes MapLocationPicker draw markers, fit bounds and
      // fetch the road route automatically.
      if (pc) setPickupCoords(pc);
      if (dc) setDeliveryCoords(dc);
      // Auto-calc with the resolved values directly (state isn't settled yet).
      // Falls back to text-only when geocoding found nothing — the backend
      // still resolves the names, so distance + cost appear regardless.
      calculateRoute({
        origin: p.pickup_location,
        destination: p.delivery_location,
        originCoords: pc,
        destCoords: dc,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill return destination with pickup location when ROUND TRIP is active
  // and the user hasn't manually set a different return location yet.
  useEffect(() => {
    if (tripType === "ROUND_TRIP" && pickupLocation && !returnLocation) {
      setReturnLocation(pickupLocation);
    }
  }, [tripType, pickupLocation]); // returnLocation omitted — adding it would re-fill when user clears the field

  // Cost calculations
  const distanceKm = distance;
  const baseCost = _baseCost;
  const fuelCost = _fuelCost;
  const tollCost = _tollCost;
  const driverAllowance = _driverAllowance;
  const total = _total;

  // Extract origin and destination codes
  const extractCode = (location: string) => {
    const upper = location.trim().toUpperCase();
    if (upper.includes("JHB") || upper.includes("JOHANNESBURG")) return "JHB";
    if (upper.includes("CPT") || upper.includes("CAPE TOWN")) return "CPT";
    if (upper.includes("DUR") || upper.includes("DURBAN")) return "DUR";
    if (upper.includes("PE") || upper.includes("PORT ELIZABETH")) return "PE";
    if (upper.includes("BFN") || upper.includes("BLOEMFONTEIN")) return "BFN";
    if (upper.includes("PTA") || upper.includes("PRETORIA")) return "PTA";
    // Fallback: take the last word before the first comma (most specific place name)
    const primaryPart = location.split(",")[0].trim();
    const words = primaryPart.split(/\s+/).filter(Boolean);
    const lastWord = words[words.length - 1] || primaryPart;
    return lastWord.substring(0, 3).toUpperCase();
  };

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEditing
        ? patchData({ url: `api/v1/quotes/${editId}/`, data })
        : postData({ url: "api/v1/quotes/", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(isEditing ? "Quote updated" : "Quote saved");
      navigate(isEditing ? `/bookings/quotes/${editId}` : "/bookings/quotes");
    },
    onError: (e: any) => {
      const msg =
        e?.message ||
        (isEditing ? "Failed to update quote" : "Failed to create quote");
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSave = () => {
    if (!customerId) {
      const msg = "Please select a customer";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError("");
    mutation.mutate({
      customer: parseInt(customerId),
      pickup_location: pickupLocation,
      delivery_location: deliveryLocation,
      origin: extractCode(pickupLocation),
      destination: extractCode(deliveryLocation),
      ...(pickupCoords
        ? {
            pickup_lat: parseFloat(pickupCoords.lat.toFixed(7)),
            pickup_lng: parseFloat(pickupCoords.lon.toFixed(7)),
          }
        : {}),
      ...(deliveryCoords
        ? {
            delivery_lat: parseFloat(deliveryCoords.lat.toFixed(7)),
            delivery_lng: parseFloat(deliveryCoords.lon.toFixed(7)),
          }
        : {}),
      cargo_description: cargoDescription || `${weight}t ${vehicleType}`,
      weight: parseFloat(weight || "0") * 1000,
      distance: distanceKm,
      // Best route's travel time (or the alternative the user picked) — the quote's default time.
      estimated_duration_minutes:
        selectedRoute?.duration_minutes ?? routeData?.duration_minutes ?? null,
      vehicle_type: vehicleType,
      ...(selectedVehicleId ? { vehicle: parseInt(selectedVehicleId) } : {}),
      ...(selectedDriverId ? { driver: parseInt(selectedDriverId) } : {}),
      base_rate: Math.round(baseCost * 100) / 100,
      fuel_surcharge: Math.round(fuelCost * 100) / 100,
      toll_charges: Math.round(tollCost * 100) / 100,
      driver_allowance: Math.round(driverAllowance * 100) / 100,
      additional_charges:
        Math.round((_weightSurcharge + _additionalCosts) * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
      margin_percentage:
        total > 0
          ? Math.round(
              ((total -
                (fuelCost + tollCost + driverAllowance + _additionalCosts)) /
                total) *
                10000,
            ) / 100
          : 0,
      notes,
      status,
      confidence,
      sla_hours: parseInt(slaHours),
      valid_until: validUntil,
      trip_type: tripType,
      ...(tripType === "ROUND_TRIP"
        ? {
            return_location: returnLocation,
            ...(returnCoords
              ? {
                  return_lat: parseFloat(returnCoords.lat.toFixed(7)),
                  return_lng: parseFloat(returnCoords.lon.toFixed(7)),
                }
              : {}),
            return_cargo: returnCargo,
            return_date: returnDate || null,
            return_base_rate: parseFloat(returnBaseRate || "0"),
            return_notes: returnNotes,
          }
        : {
            return_location: "",
            return_cargo: "",
            return_date: null,
            return_base_rate: null,
            return_notes: "",
          }),
    });
  };

  // Capacity is stored in kg — convert to tons for display and weight comparison
  const kgToTon = (kg: number) => Math.round((kg / 1000) * 10) / 10;

  const selectedVtCap: number | null = (() => {
    const vt = vehicleTypes.find((v) => v.name === vehicleType);
    return vt?.capacity != null
      ? kgToTon(parseFloat(String(vt.capacity)))
      : null;
  })();
  const effectiveCap =
    selectedVehicle?.capacity != null
      ? kgToTon(parseFloat(String(selectedVehicle.capacity)))
      : selectedVtCap;
  const weightExceedsCap =
    effectiveCap != null && parseFloat(weight || "0") > effectiveCap;

  // Step validation
  const canGoToStep2 =
    routeData &&
    routeData.success &&
    weight &&
    parseFloat(weight) > 0 &&
    !weightExceedsCap &&
    (tripType === "ONE_WAY" || (returnRouteData && returnRouteData.success));
  // Step 3 (summary) is reachable only once ALL mandatory data is in — route +
  // weight (canGoToStep2) plus the customer and validity now entered in Step 2.
  const canGoToStep3 = !!(canGoToStep2 && customerId && validUntil);
  const canSave = canGoToStep3;

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    padding: "10px 12px",
    color: "var(--text-primary)",
    borderRadius: 2,
    fontSize: 13,
    outline: "none",
    width: "100%",
    fontFamily: "var(--font-sans)",
  };

  const label = (text: string) => (
    <div
      style={{
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)",
        marginBottom: 6,
        letterSpacing: "0.08em",
      }}>
      {text.toUpperCase()}
    </div>
  );

  if (loadingQuote) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}>
        Loading quote…
      </div>
    );
  }

  const STEPS = [
    { n: 1, label: "Route" },
    { n: 2, label: "Freight" },
    { n: 3, label: "Summary" },
  ];

  return (
    <div>
      {/* Page header — matches site-wide pattern */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          paddingBottom: 8,
          // borderBottom: "1px solid var(--border-subtle)",
        }}>
        {/* Left — standard header block */}
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              marginBottom: 8,
              padding: 0,
            }}>
            ← BACK
          </button>
          {/* <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            Quotes
          </div> */}
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}>
            {isEditing ? `Edit Quote #${editId}` : "New Quote"}
          </div>
        </div>

        {/* Right — compact step pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px 3px 4px",
                  borderRadius: 20,
                  background:
                    currentStep === step.n
                      ? "var(--accent-primary)"
                      : currentStep > step.n
                        ? "var(--accent-glow)"
                        : "transparent",
                  border: `1px solid ${currentStep >= step.n ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                  transition: "all 0.2s",
                }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background:
                      currentStep >= step.n
                        ? "var(--accent-primary)"
                        : "var(--bg-surface)",
                    border: `1px solid ${currentStep >= step.n ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    color:
                      currentStep >= step.n ? "#fff" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}>
                  {currentStep > step.n ? "✓" : step.n}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: currentStep === step.n ? 700 : 400,
                    color:
                      currentStep === step.n
                        ? "#fff"
                        : currentStep > step.n
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                    letterSpacing: "0.04em",
                  }}>
                  {step.label.toUpperCase()}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    width: 12,
                    height: 1,
                    background:
                      currentStep > step.n
                        ? "var(--accent-primary)"
                        : "var(--border-subtle)",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Route Entry */}
      {currentStep === 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
          }}>
          <div className="step1-layout" style={{ margin: 0 }}>
            <div className="card step1-left">
              <div className="card-title" style={{ marginBottom: 16 }}>
                Step 1: Route Details
              </div>

              {/* Trip Type Toggle — top of form */}
              <div style={{ marginBottom: 16 }}>
                {label("Trip Type")}
                <div
                  style={{
                    display: "flex",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}>
                  {(["ONE_WAY", "ROUND_TRIP"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setTripType(type);
                        if (
                          type === "ROUND_TRIP" &&
                          !returnLocation &&
                          pickupLocation
                        ) {
                          setReturnLocation(pickupLocation);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        border: "none",
                        background:
                          tripType === type
                            ? "var(--accent-primary)"
                            : "var(--bg-surface)",
                        color:
                          tripType === type ? "#fff" : "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        fontWeight: tripType === type ? 700 : 400,
                        transition: "all 0.15s",
                      }}>
                      {type === "ONE_WAY" ? "ONE WAY" : "ROUND TRIP"}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 16,
                }}>
                <div>
                  {label("Pickup Location")}
                  <LocationInput
                    placeholder="e.g. Johannesburg Depot"
                    value={pickupLocation}
                    onFocus={() => setActiveMapField("pickup")}
                    onChange={(val, coords) => {
                      setPickupLocation(val);
                      setPickupCoords(coords ?? null);
                      setRouteData(null);
                      setRouteOptions([]);
                    }}
                    resolvedText={routeData?.origin_resolved}
                    style={inputStyle}
                  />
                </div>
                <div>
                  {label("Delivery Location")}
                  <LocationInput
                    placeholder="e.g. Cape Town Warehouse"
                    value={deliveryLocation}
                    onFocus={() => setActiveMapField("delivery")}
                    onChange={(val, coords) => {
                      setDeliveryLocation(val);
                      setDeliveryCoords(coords ?? null);
                      setRouteData(null);
                      setRouteOptions([]);
                    }}
                    resolvedText={routeData?.dest_resolved}
                    style={inputStyle}
                  />
                </div>
              </div>

              <MapLocationPicker
                pickupCoords={pickupCoords}
                deliveryCoords={deliveryCoords}
                returnCoords={tripType === "ROUND_TRIP" ? returnCoords : null}
                showReturn={tripType === "ROUND_TRIP"}
                activeField={activeMapField}
                onActiveFieldChange={setActiveMapField}
                onExpand={() => setMapExpanded(true)}
                routeOptions={routeOptions}
                selectedRouteIndex={selectedRouteIndex}
                onSelectRoute={setSelectedRouteIndex}
                onLocationSelect={(field, label, coords) => {
                  if (field === "pickup") {
                    setPickupLocation(label);
                    setPickupCoords(coords);
                  } else if (field === "delivery") {
                    setDeliveryLocation(label);
                    setDeliveryCoords(coords);
                  } else {
                    setReturnLocation(label);
                    setReturnCoords(coords);
                    setReturnRouteData(null);
                  }
                  setRouteData(null);
                }}
              />

              {/* Fullscreen map modal */}
              {mapExpanded && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1000,
                    background: "rgba(0,0,0,0.85)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onKeyDown={(e) =>
                    e.key === "Escape" && setMapExpanded(false)
                  }>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      padding: 16,
                      gap: 12,
                      overflow: "hidden",
                    }}>
                    <MapLocationPicker
                      pickupCoords={pickupCoords}
                      deliveryCoords={deliveryCoords}
                      returnCoords={
                        tripType === "ROUND_TRIP" ? returnCoords : null
                      }
                      showReturn={tripType === "ROUND_TRIP"}
                      activeField={activeMapField}
                      onActiveFieldChange={setActiveMapField}
                      onClose={() => setMapExpanded(false)}
                      mapHeight={window.innerHeight - 120}
                      routeOptions={routeOptions}
                      selectedRouteIndex={selectedRouteIndex}
                      onSelectRoute={setSelectedRouteIndex}
                      onLocationSelect={(field, label, coords) => {
                        if (field === "pickup") {
                          setPickupLocation(label);
                          setPickupCoords(coords);
                        } else if (field === "delivery") {
                          setDeliveryLocation(label);
                          setDeliveryCoords(coords);
                        } else {
                          setReturnLocation(label);
                          setReturnCoords(coords);
                          setReturnRouteData(null);
                        }
                        setRouteData(null);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Cross-border toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                  cursor:
                    companyProfile?.allow_cross_border === false
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    companyProfile?.allow_cross_border === false ? 0.4 : 1,
                }}>
                <input
                  type="checkbox"
                  checked={crossBorderEnabled}
                  disabled={companyProfile?.allow_cross_border === false}
                  onChange={(e) => {
                    setCrossBorderEnabled(e.target.checked);
                    setRouteData(null);
                  }}
                  style={{
                    accentColor: "var(--accent-primary)",
                    width: 14,
                    height: 14,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Allow cross-border routes
                </span>
                {companyProfile?.allow_cross_border === false && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                    }}>
                    DISABLED BY COMPANY SETTINGS
                  </span>
                )}
              </label>

              {/* Return Leg section (visible when ROUND_TRIP) */}
              {tripType === "ROUND_TRIP" && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "16px",
                    background: "var(--bg-surface-hover)",
                    borderRadius: 2,
                    border: "1px solid var(--border-subtle)",
                  }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent-primary)",
                      letterSpacing: "0.08em",
                      marginBottom: 12,
                    }}>
                    RETURN LEG · Truck continues after delivery
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-sans)",
                      marginBottom: 12,
                    }}>
                    Return from:{" "}
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                      }}>
                      {deliveryLocation || "Delivery Location"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}>
                    <div>
                      {label("Return Destination")}
                      <LocationInput
                        placeholder="e.g. Johannesburg Depot (or different city)"
                        value={returnLocation}
                        onFocus={() => setActiveMapField("return")}
                        onChange={(val, coords) => {
                          setReturnLocation(val);
                          setReturnCoords(coords ?? null);
                          setReturnRouteData(null);
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      {label("Return Cargo (leave blank if empty return)")}
                      <textarea
                        value={returnCargo}
                        onChange={(e) => setReturnCargo(e.target.value)}
                        placeholder="e.g. 8000kg Maize Bags — or leave empty for empty return"
                        rows={2}
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontFamily: "var(--font-sans)",
                      }}>
                      Return rate will be auto-calculated when you click
                      Calculate Route below.
                    </div>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 16,
                }}>
                <div>
                  {label("Vehicle Type")}
                  <Select
                    value={vehicleType}
                    onValueChange={(val) => {
                      setVehicleType(val);
                      setSelectedVehicleId("");
                      setSelectedDriverId("");
                    }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleTypes.length > 0
                        ? vehicleTypes.map((vt) => (
                            <SelectItem key={vt.id} value={vt.name}>
                              {vt.name
                                .replace(/\s*\([\d\s\-–.]+\s*tonn?e?s?\)/gi, "")
                                .trim()}
                            </SelectItem>
                          ))
                        : [
                            "Semi-Trailer Truck",
                            "Rigid Truck",
                            "Flatbed Truck",
                            "Refrigerated Truck",
                            "Tanker",
                            "Tautliner",
                            "Box Truck",
                          ].map((n) => (
                            <SelectItem key={n} value={n}>
                              {n}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  {label("Vehicle")}
                  <Select
                    value={selectedVehicleId}
                    disabled={!vehicleType}
                    onValueChange={(vid) => {
                      setSelectedVehicleId(vid);
                      const v = vehicles.find((v) => v.id === parseInt(vid));
                      setSelectedDriverId(
                        v?.driver != null ? String(v.driver) : "",
                      );
                    }}>
                    <SelectTrigger style={{ opacity: vehicleType ? 1 : 0.5 }}>
                      <SelectValue
                        placeholder={
                          vehicleType
                            ? "— Select a vehicle (optional) —"
                            : "Select vehicle type first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No available vehicles for this type
                        </SelectItem>
                      ) : (
                        vehicles.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.make} {v.model} · {v.plate}
                            {v.capacity != null
                              ? ` · ${kgToTon(parseFloat(String(v.capacity)))} ton`
                              : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  {label("Weight (tons)")}
                  <input
                    type="number"
                    placeholder={
                      !vehicleType
                        ? "Select vehicle type first"
                        : !selectedVehicleId
                          ? `e.g. 15${selectedVtCap != null ? ` (type max ${selectedVtCap} ton)` : ""}`
                          : selectedVehicle?.capacity != null
                            ? `e.g. 15 (max ${kgToTon(parseFloat(String(selectedVehicle.capacity)))} ton)`
                            : "e.g. 15"
                    }
                    value={weight}
                    min={0}
                    max={effectiveCap ?? undefined}
                    disabled={!vehicleType}
                    onChange={(e) => {
                      setWeight(e.target.value);
                    }}
                    style={{
                      ...inputStyle,
                      opacity: vehicleType ? 1 : 0.5,
                      cursor: vehicleType ? "auto" : "not-allowed",
                    }}
                  />
                  {(() => {
                    const cap = effectiveCap;
                    const capLabel =
                      selectedVehicle?.capacity != null
                        ? `${selectedVehicle.make ?? ""} ${selectedVehicle.model ?? ""}`.trim() ||
                          "this vehicle"
                        : vehicleType;
                    if (cap == null) return null;
                    const w = parseFloat(weight || "0");
                    const overLimit = w > 0 && w > cap;
                    const nearLimit = w > 0 && !overLimit && w > cap * 0.9;
                    return (
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          color: overLimit
                            ? "var(--status-danger)"
                            : nearLimit
                              ? "var(--status-warning)"
                              : "var(--text-tertiary)",
                        }}>
                        {overLimit ? "⚠️" : nearLimit ? "⚠️" : "ℹ️"}
                        {overLimit
                          ? `${w} ton exceeds ${capLabel} capacity of ${cap} ton`
                          : nearLimit
                            ? `Near capacity — ${capLabel} max ${cap} ton`
                            : `${capLabel} capacity: ${cap} ton`}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <button
                onClick={() => calculateRoute()}
                disabled={
                  calculatingRoute ||
                  !pickupLocation.trim() ||
                  !deliveryLocation.trim() ||
                  !vehicleType ||
                  !weight ||
                  weightExceedsCap
                }
                className="btn-action"
                style={{ width: "100%", marginBottom: 16 }}>
                {calculatingRoute
                  ? tripType === "ROUND_TRIP"
                    ? "CALCULATING BOTH ROUTES..."
                    : "CALCULATING ROUTE..."
                  : tripType === "ROUND_TRIP"
                    ? "CALCULATE BOTH ROUTES"
                    : "CALCULATE ROUTE"}
              </button>

              {error && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--status-danger)",
                    borderRadius: 2,
                    color: "var(--status-danger)",
                    fontSize: 12,
                    marginBottom: 16,
                  }}>
                  {error}
                </div>
              )}

              {routeData &&
                routeData.cross_border &&
                (() => {
                  const CB_COUNTRY_NAMES: Record<string, string> = {
                    SA: "South Africa",
                    SZ: "Eswatini",
                    MZ: "Mozambique",
                    ZW: "Zimbabwe",
                    BW: "Botswana",
                    NA: "Namibia",
                    LS: "Lesotho",
                    ZM: "Zambia",
                    MW: "Malawi",
                    TZ: "Tanzania",
                    KE: "Kenya",
                  };
                  const CB_FLAGS: Record<string, string> = {
                    SA: "🇿🇦",
                    SZ: "🇸🇿",
                    MZ: "🇲🇿",
                    ZW: "🇿🇼",
                    BW: "🇧🇼",
                    NA: "🇳🇦",
                    LS: "🇱🇸",
                    ZM: "🇿🇲",
                    MW: "🇲🇼",
                    TZ: "🇹🇿",
                    KE: "🇰🇪",
                  };
                  const CB_BORDER_POSTS: Record<
                    string,
                    { name: string; hours: string; note: string }
                  > = {
                    "SA-SZ": {
                      name: "Oshoek / Ngwenya",
                      hours: "07:00–22:00",
                      note: "Use Golela (N2) for 24h heavy-truck access",
                    },
                    "SA-MZ": {
                      name: "Lebombo / Ressano Garcia",
                      hours: "24 hours",
                      note: "Main freight corridor via N4",
                    },
                    "SA-ZW": {
                      name: "Beit Bridge (N1)",
                      hours: "24 hours",
                      note: "Busiest SA land border — expect 4–8h delays",
                    },
                    "SA-BW": {
                      name: "Ramatlabama / Tlokweng Gate",
                      hours: "06:00–22:00",
                      note: "Tlokweng preferred for heavy vehicles",
                    },
                    "SA-NA": {
                      name: "Nakop / Ariamsvlei (N10)",
                      hours: "24 hours",
                      note: "Main route; Vioolsdrif alt for N7 corridor",
                    },
                    "SA-LS": {
                      name: "Maseru Bridge / Caledonspoort",
                      hours: "24 hours",
                      note: "Multiple posts available along border",
                    },
                    "ZW-ZM": {
                      name: "Chirundu / Kazungula",
                      hours: "06:00–22:00",
                      note: "Chirundu is primary freight crossing",
                    },
                    "ZM-MW": {
                      name: "Mchinji / Chipata",
                      hours: "06:00–20:00",
                      note: "Allow extra time for customs clearance",
                    },
                    "ZM-TZ": {
                      name: "Nakonde / Tunduma",
                      hours: "06:00–22:00",
                      note: "High-volume corridor; congestion common",
                    },
                    "TZ-KE": {
                      name: "Namanga / Lunga Lunga",
                      hours: "24 hours",
                      note: "Namanga is main A104 freight route",
                    },
                  };
                  const CB_DOCS: Record<string, string[]> = {
                    SA: [
                      "Vehicle registration + roadworthy",
                      "Driver's licence (PrDP)",
                      "Customs export declaration (SAD500)",
                    ],
                    SZ: [
                      "Commercial invoice",
                      "Packing list",
                      "ASYCUDA customs clearance",
                      "Phytosanitary cert (if applicable)",
                    ],
                    MZ: [
                      "Commercial invoice",
                      "Packing list",
                      "SAD500 import declaration",
                      "Transit permit",
                      "Cargo insurance cert",
                    ],
                    ZW: [
                      "Commercial invoice",
                      "Packing list",
                      "ZIMRA declaration",
                      "Cross-border road permit",
                      "SADC certificate of origin",
                    ],
                    BW: [
                      "Commercial invoice",
                      "Packing list",
                      "SAD customs declaration",
                      "SADC certificate of origin",
                    ],
                    NA: [
                      "Commercial invoice",
                      "Packing list",
                      "NamRA customs declaration",
                      "Transit permit",
                    ],
                    LS: [
                      "Commercial invoice",
                      "Packing list",
                      "LRCA customs form",
                      "Roadworthy certificate",
                    ],
                    ZM: [
                      "Commercial invoice",
                      "Packing list",
                      "ZRA customs declaration",
                      "Transit permit",
                      "Yellow fever cert (driver)",
                    ],
                    MW: [
                      "Commercial invoice",
                      "Packing list",
                      "MRA declaration",
                      "Transit permit",
                    ],
                    TZ: [
                      "Commercial invoice",
                      "Packing list",
                      "TRA declaration",
                      "EAC regional transit permit",
                    ],
                    KE: [
                      "Commercial invoice",
                      "Packing list",
                      "KRA declaration",
                      "EAC transit permit",
                    ],
                  };
                  const CB_CURRENCY: Record<string, string> = {
                    SZ: "SZL / ZAR (pegged — Rand accepted)",
                    MZ: "MZN Metical · carry USD for border fees",
                    ZW: "ZiG / USD (USD widely accepted)",
                    BW: "BWP Pula · exchange at border",
                    NA: "NAD / ZAR (pegged — Rand accepted)",
                    LS: "LSL / ZAR (pegged — Rand accepted)",
                    ZM: "ZMW Kwacha · USD also accepted",
                    MW: "MWK Kwacha · exchange at border",
                    TZ: "TZS · USD also accepted",
                    KE: "KES Shilling · M-Pesa available",
                  };

                  const countries = routeData.countries ?? [];
                  const foreignCountries = countries.filter((c) => c !== "SA");
                  const crossings = countries
                    .slice(0, -1)
                    .map((from, i) => `${from}-${countries[i + 1]}`);
                  const totalAdditional =
                    (routeData.additional_costs?.border_fees ?? 0) +
                    (routeData.additional_costs?.weighbridge_fees ?? 0) +
                    (routeData.additional_costs?.non_sa_tolls ?? 0);

                  return (
                    <div
                      style={{
                        marginTop: 4,
                        border: "1px solid var(--status-warning)",
                        borderRadius: 2,
                      }}>
                      {/* Header */}
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "rgba(245,158,11,0.08)",
                          borderBottom: "1px solid var(--status-warning)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              border: "1px solid var(--status-warning)",
                              borderRadius: 2,
                              fontSize: 9,
                              color: "var(--status-warning)",
                              fontWeight: 600,
                              fontFamily: "var(--font-mono)",
                            }}>
                            CROSS-BORDER ROUTE
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-sans)",
                            }}>
                            International Crossing Detected
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: "var(--status-warning)",
                            }}>
                            +R {Math.round(totalAdditional).toLocaleString()}
                          </span>
                          {/* Info icon with popover */}
                          <div
                            style={{ position: "relative" }}
                            onMouseEnter={() => setCbPopoverOpen(true)}
                            onMouseLeave={() => setCbPopoverOpen(false)}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border: "1.5px solid var(--status-warning)",
                                color: "var(--status-warning)",
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: "var(--font-mono)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "default",
                                userSelect: "none",
                                opacity: 0.8,
                              }}>
                              i
                            </div>
                            {cbPopoverOpen && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 8px)",
                                  right: 0,
                                  zIndex: 200,
                                  width: 320,
                                  background: "var(--bg-deep)",
                                  border: "1px solid var(--border-subtle)",
                                  borderRadius: 4,
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                                  padding: "14px 16px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 14,
                                }}>
                                {/* Route Countries */}
                                <div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--text-tertiary)",
                                      letterSpacing: "0.07em",
                                      marginBottom: 8,
                                    }}>
                                    ROUTE COUNTRIES
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      flexWrap: "wrap",
                                    }}>
                                    {countries.map((code, i) => (
                                      <div
                                        key={code}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}>
                                        <div style={{ textAlign: "center" }}>
                                          <div style={{ fontSize: 18 }}>
                                            {CB_FLAGS[code] ?? "🏳️"}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: 9,
                                              fontFamily: "var(--font-mono)",
                                              color: "var(--text-secondary)",
                                              whiteSpace: "nowrap",
                                            }}>
                                            {CB_COUNTRY_NAMES[code] ?? code}
                                          </div>
                                        </div>
                                        {i < countries.length - 1 && (
                                          <span
                                            style={{
                                              fontSize: 12,
                                              color: "var(--text-tertiary)",
                                              marginBottom: 10,
                                            }}>
                                            →
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Border posts */}
                                {crossings.some((k) => CB_BORDER_POSTS[k]) && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        letterSpacing: "0.07em",
                                        marginBottom: 6,
                                      }}>
                                      BORDER POSTS
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 5,
                                      }}>
                                      {crossings.map((key) => {
                                        const post = CB_BORDER_POSTS[key];
                                        if (!post) return null;
                                        const [from, to] = key.split("-");
                                        return (
                                          <div
                                            key={key}
                                            style={{
                                              background: "var(--bg-surface)",
                                              borderRadius: 2,
                                              padding: "7px 9px",
                                            }}>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: 2,
                                              }}>
                                              <span
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: 600,
                                                  color: "var(--text-primary)",
                                                  fontFamily:
                                                    "var(--font-sans)",
                                                }}>
                                                {CB_FLAGS[from]} →{" "}
                                                {CB_FLAGS[to]} {post.name}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: 9,
                                                  fontFamily:
                                                    "var(--font-mono)",
                                                  color:
                                                    "var(--status-success)",
                                                  fontWeight: 600,
                                                }}>
                                                ⏰ {post.hours}
                                              </span>
                                            </div>
                                            <div
                                              style={{
                                                fontSize: 9,
                                                color: "var(--text-tertiary)",
                                                fontFamily: "var(--font-sans)",
                                              }}>
                                              ℹ️ {post.note}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Currency */}
                                {foreignCountries.some(
                                  (c) => CB_CURRENCY[c],
                                ) && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        letterSpacing: "0.07em",
                                        marginBottom: 6,
                                      }}>
                                      CURRENCY
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                      }}>
                                      {foreignCountries
                                        .filter((c) => CB_CURRENCY[c])
                                        .map((c) => (
                                          <div
                                            key={c}
                                            style={{
                                              display: "flex",
                                              gap: 6,
                                              fontSize: 11,
                                              fontFamily: "var(--font-sans)",
                                            }}>
                                            <span>{CB_FLAGS[c]}</span>
                                            <span
                                              style={{
                                                color: "var(--text-secondary)",
                                              }}>
                                              {CB_COUNTRY_NAMES[c]}:
                                            </span>
                                            <span
                                              style={{
                                                color: "var(--text-primary)",
                                              }}>
                                              {CB_CURRENCY[c]}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Required documents */}
                                <div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--text-tertiary)",
                                      letterSpacing: "0.07em",
                                      marginBottom: 6,
                                    }}>
                                    REQUIRED DOCUMENTS
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 8,
                                    }}>
                                    {countries
                                      .filter((c) => CB_DOCS[c])
                                      .map((c) => (
                                        <div key={c}>
                                          <div
                                            style={{
                                              fontSize: 10,
                                              fontFamily: "var(--font-mono)",
                                              color: "var(--text-secondary)",
                                              marginBottom: 3,
                                            }}>
                                            {CB_FLAGS[c]}{" "}
                                            {CB_COUNTRY_NAMES[c] ?? c}
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 2,
                                            }}>
                                            {CB_DOCS[c].map((doc) => (
                                              <div
                                                key={doc}
                                                style={{
                                                  display: "flex",
                                                  gap: 6,
                                                  fontSize: 10,
                                                  color: "var(--text-tertiary)",
                                                  fontFamily:
                                                    "var(--font-sans)",
                                                }}>
                                                <span
                                                  style={{
                                                    color:
                                                      "var(--status-success)",
                                                    flexShrink: 0,
                                                  }}>
                                                  ✓
                                                </span>
                                                <span>{doc}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>

                                {/* Driver notes */}
                                {routeData.warnings &&
                                  routeData.warnings.length > 0 && (
                                    <div
                                      style={{
                                        borderTop:
                                          "1px solid var(--border-subtle)",
                                        paddingTop: 10,
                                      }}>
                                      <div
                                        style={{
                                          fontSize: 9,
                                          fontFamily: "var(--font-mono)",
                                          color: "var(--text-tertiary)",
                                          letterSpacing: "0.07em",
                                          marginBottom: 6,
                                        }}>
                                        DRIVER NOTES
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 4,
                                        }}>
                                        {routeData.warnings.map((w, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              display: "flex",
                                              gap: 6,
                                              fontSize: 11,
                                              fontFamily: "var(--font-sans)",
                                              color: "var(--status-warning)",
                                            }}>
                                            <span style={{ flexShrink: 0 }}>
                                              ⚠️
                                            </span>
                                            <span>{w}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cost breakdown — stays visible */}
                      <div
                        style={{
                          padding: "10px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          fontSize: 11,
                        }}>
                        {(routeData.additional_costs?.border_fees ?? 0) > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}>
                            <div>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                Border Crossing Fees
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--text-tertiary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                {crossings
                                  .map((k) => k.split("-").join(" → "))
                                  .join(", ")}
                              </div>
                            </div>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--status-warning)",
                                fontWeight: 600,
                              }}>
                              R{" "}
                              {Math.round(
                                routeData.additional_costs!.border_fees!,
                              ).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {(routeData.additional_costs?.weighbridge_fees ?? 0) >
                          0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}>
                            <div>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                Weighbridge Fees
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--text-tertiary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                {foreignCountries
                                  .map((c) => CB_COUNTRY_NAMES[c] ?? c)
                                  .join(", ")}{" "}
                                · per country
                              </div>
                            </div>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--status-warning)",
                                fontWeight: 600,
                              }}>
                              R{" "}
                              {Math.round(
                                routeData.additional_costs!.weighbridge_fees!,
                              ).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {(routeData.additional_costs?.non_sa_tolls ?? 0) >
                          0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}>
                            <div>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                International Tolls
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--text-tertiary)",
                                  fontFamily: "var(--font-sans)",
                                }}>
                                {foreignCountries
                                  .map((c) => CB_COUNTRY_NAMES[c] ?? c)
                                  .join(", ")}{" "}
                                · distance-based
                              </div>
                            </div>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--status-warning)",
                                fontWeight: 600,
                              }}>
                              R{" "}
                              {Math.round(
                                routeData.additional_costs!.non_sa_tolls!,
                              ).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* RIGHT PANEL: visible when pickup + delivery selected and routes/results available */}
            {(routeOptions.length > 0 || (routeData && routeData.success)) && (
              <div className="step1-right">
                {routeOptions.length > 0 && (
                  <div className="card" style={{ padding: 16 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                      }}>
                      ROUTE OPTIONS
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}>
                      {routeOptions.map((r) => {
                        const ROUTE_COLORS = [
                          "#16a34a",
                          "#2563eb",
                          "#ea580c",
                          "#7c3aed",
                        ];
                        const color =
                          ROUTE_COLORS[r.index % ROUTE_COLORS.length];
                        const isSel = r.index === selectedRouteIndex;
                        const isExp = r.index === expandedRouteIndex;

                        const severityColor =
                          r.max_traffic_severity == null
                            ? "var(--text-tertiary)"
                            : r.max_traffic_severity === 0
                              ? "var(--status-success)"
                              : r.max_traffic_severity === 1
                                ? "#a3a300"
                                : r.max_traffic_severity === 2
                                  ? "var(--status-warning)"
                                  : "var(--status-danger)";

                        const terrainIcons: Record<string, string> = {
                          Coastal: "🌊",
                          "Mountain Passes": "⛰️",
                          Karoo: "🏜️",
                          Escarpment: "🗻",
                          Bushveld: "🌿",
                          "Highveld / Flat": "🟫",
                        };

                        return (
                          <div
                            key={r.index}
                            style={{
                              borderRadius: 2,
                              background: isSel
                                ? `${color}12`
                                : "var(--bg-surface)",
                              border: `1px solid ${isSel ? color : "var(--border-subtle)"}`,
                              overflow: "hidden",
                            }}>
                            {/* Summary row — always visible, click to expand */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRouteIndex(isExp ? null : r.index)
                              }
                              aria-expanded={isExp}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                padding: "11px 14px",
                                cursor: "pointer",
                                textAlign: "left",
                                background: "transparent",
                                border: "none",
                                gap: 10,
                              }}>
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: color,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#fff",
                                  flexShrink: 0,
                                  opacity: isSel ? 1 : 0.65,
                                }}>
                                {r.index + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                  flex: 1,
                                }}>
                                {r.is_best ? "Best Route" : r.label}
                              </span>
                              {r.road_type && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontFamily: "var(--font-mono)",
                                    padding: "2px 6px",
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 2,
                                    color: "var(--text-tertiary)",
                                    letterSpacing: "0.04em",
                                  }}>
                                  {r.road_type.toUpperCase()}
                                </span>
                              )}
                              {/* inline traffic dot */}
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  background: severityColor,
                                  flexShrink: 0,
                                }}
                              />
                              <div
                                style={{
                                  fontSize: 12,
                                  fontFamily: "var(--font-mono)",
                                  color: "var(--text-secondary)",
                                  display: "flex",
                                  gap: 8,
                                  flexShrink: 0,
                                }}>
                                <span style={{ fontWeight: 700 }}>
                                  {Math.floor(r.duration_minutes / 60)}h{" "}
                                  {r.duration_minutes % 60}m
                                </span>
                                <span>{Math.round(r.distance_km)} km</span>
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-tertiary)",
                                  marginLeft: 2,
                                }}>
                                {isExp ? "▲" : "▼"}
                              </span>
                            </button>

                            {/* Expanded details */}
                            {isExp && (
                              <div
                                style={{
                                  padding: "0 14px 14px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 12,
                                }}>
                                {/* Row 1: Traffic + Tolls + Congestion */}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 8,
                                  }}>
                                  {/* Traffic */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      TRAFFIC
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: severityColor,
                                        fontFamily: "var(--font-mono)",
                                        marginBottom: 4,
                                      }}>
                                      {r.traffic_status || "Unknown"}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: "var(--text-secondary)",
                                        fontFamily: "var(--font-sans)",
                                        marginBottom: 2,
                                      }}>
                                      {r.traffic_delay_minutes != null &&
                                      r.traffic_delay_minutes > 0 ? (
                                        <span style={{ color: severityColor }}>
                                          +{Math.round(r.traffic_delay_minutes)}{" "}
                                          min delay
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            color: "var(--status-success)",
                                          }}>
                                          No delay
                                        </span>
                                      )}
                                    </div>
                                    {r.traffic_vs_historic != null && (
                                      <div
                                        style={{
                                          fontSize: 9,
                                          fontFamily: "var(--font-mono)",
                                          color:
                                            r.traffic_vs_historic > 0
                                              ? "var(--status-warning)"
                                              : "var(--status-success)",
                                        }}>
                                        {r.traffic_vs_historic > 0
                                          ? `+${r.traffic_vs_historic}m`
                                          : `${r.traffic_vs_historic}m`}{" "}
                                        vs avg
                                      </div>
                                    )}
                                  </div>

                                  {/* Tolls */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      TOLL PLAZAS
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: "var(--text-primary)",
                                        fontFamily: "var(--font-mono)",
                                        lineHeight: 1,
                                        marginBottom: 4,
                                      }}>
                                      {r.toll_count != null
                                        ? r.toll_count
                                        : "—"}
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 400,
                                          color: "var(--text-tertiary)",
                                          marginLeft: 4,
                                        }}>
                                        {r.toll_count === 1
                                          ? "plaza"
                                          : "plazas"}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                        fontFamily: "var(--font-mono)",
                                        marginBottom: 2,
                                      }}>
                                      R{" "}
                                      {Math.round(
                                        r.toll_cost_zar,
                                      ).toLocaleString()}
                                    </div>
                                    {r.toll_count != null &&
                                      r.toll_count > 1 &&
                                      r.toll_cost_zar > 0 && (
                                        <div
                                          style={{
                                            fontSize: 9,
                                            color: "var(--text-tertiary)",
                                            fontFamily: "var(--font-mono)",
                                          }}>
                                          ~R{" "}
                                          {Math.round(
                                            r.toll_cost_zar / r.toll_count,
                                          ).toLocaleString()}{" "}
                                          avg
                                        </div>
                                      )}
                                  </div>

                                  {/* Congestion */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      CONGESTION
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        lineHeight: 1,
                                        marginBottom: 4,
                                        color:
                                          r.congested_km != null &&
                                          r.congested_km > 0
                                            ? "var(--status-warning)"
                                            : "var(--status-success)",
                                        fontFamily: "var(--font-mono)",
                                      }}>
                                      {r.congested_km != null &&
                                      r.congested_km > 0
                                        ? `${r.congested_km}`
                                        : "0"}
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 400,
                                          marginLeft: 3,
                                        }}>
                                        km
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: "var(--text-secondary)",
                                        fontFamily: "var(--font-sans)",
                                        marginBottom: 2,
                                      }}>
                                      {r.congested_km != null &&
                                      r.congested_km > 0
                                        ? "congested sections"
                                        : "free-flowing"}
                                    </div>
                                    {r.traffic_vs_historic != null && (
                                      <div
                                        style={{
                                          fontSize: 9,
                                          fontFamily: "var(--font-mono)",
                                          color:
                                            r.traffic_vs_historic > 0
                                              ? "var(--status-warning)"
                                              : "var(--status-success)",
                                        }}>
                                        {r.traffic_vs_historic > 0
                                          ? `+${r.traffic_vs_historic}m`
                                          : `${r.traffic_vs_historic}m`}{" "}
                                        vs typical
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Row 2: Road + Journey time + Highway% */}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 8,
                                  }}>
                                  {/* Road type */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      ROAD TYPE
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "var(--text-primary)",
                                        fontFamily: "var(--font-sans)",
                                        marginBottom: 4,
                                      }}>
                                      {r.road_type || "—"}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-tertiary)",
                                        fontFamily: "var(--font-mono)",
                                      }}>
                                      {r.motorway_pct != null
                                        ? `${r.motorway_pct}% motorway`
                                        : ""}
                                    </div>
                                    {r.has_tunnel && (
                                      <div
                                        style={{
                                          fontSize: 9,
                                          color: "var(--text-secondary)",
                                          fontFamily: "var(--font-sans)",
                                          marginTop: 2,
                                        }}>
                                        🚇 includes tunnel
                                      </div>
                                    )}
                                  </div>

                                  {/* Without traffic */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      WITHOUT TRAFFIC
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "var(--text-primary)",
                                        fontFamily: "var(--font-mono)",
                                        lineHeight: 1,
                                        marginBottom: 4,
                                      }}>
                                      {r.no_traffic_minutes != null
                                        ? `${Math.floor(r.no_traffic_minutes / 60)}h ${(r.no_traffic_minutes % 60).toFixed(2)}m`
                                        : "—"}
                                    </div>
                                    {r.no_traffic_minutes != null &&
                                      r.duration_minutes >
                                        r.no_traffic_minutes && (
                                        <div
                                          style={{
                                            fontSize: 9,
                                            color: "var(--status-warning)",
                                            fontFamily: "var(--font-mono)",
                                          }}>
                                          +
                                          {(
                                            r.duration_minutes -
                                            r.no_traffic_minutes
                                          ).toFixed(2)}
                                          m with traffic
                                        </div>
                                      )}
                                  </div>

                                  {/* Countries */}
                                  <div
                                    style={{
                                      background: "var(--bg-elevated)",
                                      borderRadius: 2,
                                      padding: "10px 11px",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        marginBottom: 6,
                                        letterSpacing: "0.07em",
                                      }}>
                                      COUNTRIES
                                    </div>
                                    {r.country_codes &&
                                    r.country_codes.length > 0 ? (
                                      <>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "var(--status-warning)",
                                            fontFamily: "var(--font-mono)",
                                            marginBottom: 4,
                                          }}>
                                          🌍 {r.country_codes.join(" → ")}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 9,
                                            color: "var(--text-tertiary)",
                                            fontFamily: "var(--font-sans)",
                                          }}>
                                          cross-border route
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "var(--status-success)",
                                            fontFamily: "var(--font-mono)",
                                            marginBottom: 4,
                                          }}>
                                          ZA only
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 9,
                                            color: "var(--text-tertiary)",
                                            fontFamily: "var(--font-sans)",
                                          }}>
                                          domestic route
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Terrain tags */}
                                {((r.terrain && r.terrain.length > 0) ||
                                  r.has_tunnel) && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color: "var(--text-tertiary)",
                                        letterSpacing: "0.07em",
                                        marginBottom: 6,
                                      }}>
                                      TERRAIN
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 5,
                                      }}>
                                      {r.terrain?.map((t) => (
                                        <span
                                          key={t}
                                          style={{
                                            fontSize: 10,
                                            padding: "3px 9px",
                                            borderRadius: 10,
                                            background: "var(--bg-elevated)",
                                            border:
                                              "1px solid var(--border-subtle)",
                                            color: "var(--text-secondary)",
                                            fontFamily: "var(--font-sans)",
                                          }}>
                                          {terrainIcons[t] ?? "📍"} {t}
                                        </span>
                                      ))}
                                      {r.has_tunnel && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            padding: "3px 9px",
                                            borderRadius: 10,
                                            background: "var(--bg-elevated)",
                                            border:
                                              "1px solid var(--border-subtle)",
                                            color: "var(--text-secondary)",
                                            fontFamily: "var(--font-sans)",
                                          }}>
                                          🚇 Tunnel
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Select button */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedRouteIndex(r.index)}
                                  style={{
                                    padding: "10px 0",
                                    borderRadius: 2,
                                    cursor: isSel ? "default" : "pointer",
                                    fontWeight: 700,
                                    fontSize: 11,
                                    fontFamily: "var(--font-mono)",
                                    letterSpacing: "0.07em",
                                    background: isSel ? color : "transparent",
                                    color: isSel ? "#fff" : color,
                                    border: `1.5px solid ${color}`,
                                    transition: "all 0.15s",
                                  }}>
                                  {isSel
                                    ? `✓ ROUTE ${r.index + 1} SELECTED`
                                    : `SELECT ROUTE ${r.index + 1}`}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {routeData && routeData.success && (
                  <div
                    className="card"
                    style={{
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}>
                    {[
                      {
                        rd: selectedRoute
                          ? ({ ...routeData, ...selectedRoute } as RouteData)
                          : routeData,
                        leg:
                          tripType === "ROUND_TRIP"
                            ? "LEG 1 — OUTBOUND"
                            : "ROUTE CALCULATED",
                        from: pickupLocation,
                        to: deliveryLocation,
                      },
                      ...(tripType === "ROUND_TRIP" && returnRouteData?.success
                        ? [
                            {
                              rd: returnRouteData,
                              leg: "LEG 2 — RETURN",
                              from: deliveryLocation,
                              to: returnLocation,
                            },
                          ]
                        : []),
                    ].map(({ rd, leg, from, to }) => (
                      <div
                        key={leg}
                        style={{
                          padding: "14px 16px",
                          background: "var(--bg-surface-hover)",
                          borderRadius: 2,
                          border: `1px solid ${rd.source === "tomtom" ? "var(--accent-primary)" : "var(--status-warning)"}`,
                        }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-tertiary)",
                              letterSpacing: "0.08em",
                            }}>
                            {leg}
                          </div>
                          <span
                            style={{
                              padding: "2px 8px",
                              background:
                                rd.source === "tomtom"
                                  ? "var(--accent-glow)"
                                  : "var(--bg-surface-hover)",
                              border: `1px solid ${rd.source === "tomtom" ? "var(--accent-primary)" : "var(--status-warning)"}`,
                              borderRadius: 2,
                              fontSize: 9,
                              fontWeight: 600,
                              fontFamily: "var(--font-mono)",
                              color:
                                rd.source === "tomtom"
                                  ? "var(--accent-primary)"
                                  : "var(--status-warning)",
                            }}>
                            {rd.source === "tomtom" ? "LIVE" : "ESTIMATED"}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            fontFamily: "var(--font-mono)",
                            marginBottom: 10,
                          }}>
                          {from} → {to}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 12,
                            marginBottom: 10,
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                          }}>
                          <div>
                            <div
                              style={{
                                color: "var(--text-tertiary)",
                                fontSize: 9,
                                marginBottom: 3,
                              }}>
                              DISTANCE
                            </div>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                fontWeight: 700,
                                fontSize: 16,
                              }}>
                              {Math.round(rd.distance_km)} km
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                color: "var(--text-tertiary)",
                                fontSize: 9,
                                marginBottom: 3,
                              }}>
                              DURATION
                            </div>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                fontWeight: 700,
                                fontSize: 16,
                              }}>
                              {Math.floor(rd.duration_minutes / 60)}h{" "}
                              {rd.duration_minutes % 60}m
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                color: "var(--text-tertiary)",
                                fontSize: 9,
                                marginBottom: 3,
                              }}>
                              FUEL
                            </div>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                fontWeight: 700,
                                fontSize: 16,
                              }}>
                              {Math.round(rd.fuel_usage_litres)} L
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const fiasaPrice =
                            fuelPriceData?.diesel_inland ?? 21.7;
                          const effectivePrice =
                            customFuelPricePerL &&
                            !isNaN(parseFloat(customFuelPricePerL))
                              ? parseFloat(customFuelPricePerL)
                              : fiasaPrice;
                          const displayedFuelCost =
                            rd.fuel_usage_litres * effectivePrice;
                          const weightTons = parseFloat(weight || "0");

                          // Weight impact hint
                          const weightHint =
                            weightTons <= 0
                              ? null
                              : weightTons < 5
                                ? {
                                    label: `${weightTons}t load`,
                                    note: "Light — ~25–30 L/100km",
                                    color: "var(--status-success)",
                                  }
                                : weightTons < 10
                                  ? {
                                      label: `${weightTons}t load`,
                                      note: "Medium — ~32–38 L/100km",
                                      color: "#a3a300",
                                    }
                                  : weightTons < 20
                                    ? {
                                        label: `${weightTons}t load`,
                                        note: "Heavy — ~38–45 L/100km",
                                        color: "var(--status-warning)",
                                      }
                                    : {
                                        label: `${weightTons}t load`,
                                        note: "Very heavy — ~45–55 L/100km",
                                        color: "var(--status-danger)",
                                      };

                          // Terrain impact hints
                          const terrain = selectedRoute?.terrain ?? [];
                          const terrainHints: {
                            label: string;
                            note: string;
                          }[] = [];
                          if (terrain.includes("Mountain Passes"))
                            terrainHints.push({
                              label: "⛰️ Mountain Passes",
                              note: "+12–18% fuel",
                            });
                          if (terrain.includes("Escarpment"))
                            terrainHints.push({
                              label: "🗻 Escarpment",
                              note: "+8–12% fuel",
                            });
                          if (terrain.includes("Karoo"))
                            terrainHints.push({
                              label: "🏜️ Karoo",
                              note: "Flat — avg fuel",
                            });
                          if (terrain.includes("Coastal"))
                            terrainHints.push({
                              label: "🌊 Coastal",
                              note: "+5% (wind)",
                            });
                          if (terrain.includes("Highveld / Flat"))
                            terrainHints.push({
                              label: "🟫 Highveld",
                              note: "Flat — avg fuel",
                            });

                          const motorwayPct = selectedRoute?.motorway_pct ?? 0;
                          const roadNote =
                            motorwayPct >= 70
                              ? "Mostly highway — efficient"
                              : motorwayPct >= 40
                                ? "Mixed roads — moderate"
                                : "Mostly city/arterial — higher idle consumption";

                          const baseRateCost =
                            rd.distance_km *
                            (selectedVehicleTypeBaseRate ??
                              parseFloat(baseRatePerKm || "0"));
                          const driverAllowanceAmt =
                            parseFloat(driverAllowanceInput || "0") || 0;
                          const fuelBasedTotal =
                            displayedFuelCost +
                            rd.toll_cost_zar +
                            driverAllowanceAmt;
                          const baseRateTotal =
                            baseRateCost +
                            rd.toll_cost_zar +
                            driverAllowanceAmt;
                          const computedTotal =
                            costMode === "base_rate"
                              ? baseRateTotal
                              : fuelBasedTotal;
                          const totalCost =
                            editableTotalCostStr !== ""
                              ? parseFloat(editableTotalCostStr) || 0
                              : computedTotal;

                          return (
                            <div
                              style={{
                                borderTop: "1px solid var(--border-subtle)",
                                paddingTop: 12,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                              }}>
                              {/* Live market fuel price banner */}
                              <div
                                style={{
                                  background: "var(--bg-elevated)",
                                  borderRadius: 2,
                                  padding: "10px 12px",
                                  border: "1px solid var(--border-subtle)",
                                }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 6,
                                  }}>
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--text-tertiary)",
                                      letterSpacing: "0.07em",
                                    }}>
                                    LIVE DIESEL PRICE · FIASA
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 9,
                                      padding: "1px 6px",
                                      background: "var(--accent-glow)",
                                      border: "1px solid var(--accent-primary)",
                                      borderRadius: 2,
                                      color: "var(--accent-primary)",
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 600,
                                    }}>
                                    MARKET RATE
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 6,
                                  }}>
                                  <span
                                    style={{
                                      fontSize: 22,
                                      fontWeight: 700,
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--text-primary)",
                                    }}>
                                    R {fiasaPrice.toFixed(2)}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-tertiary)",
                                      fontFamily: "var(--font-sans)",
                                    }}>
                                    per litre (inland diesel)
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--text-tertiary)",
                                    fontFamily: "var(--font-mono)",
                                    marginTop: 4,
                                  }}>
                                  {Math.round(rd.fuel_usage_litres)} L × R{" "}
                                  {fiasaPrice.toFixed(2)}/L = R{" "}
                                  {Math.round(
                                    rd.fuel_usage_litres * fiasaPrice,
                                  ).toLocaleString()}
                                </div>
                              </div>

                              {/* Factor hints */}
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--text-tertiary)",
                                    letterSpacing: "0.07em",
                                    marginBottom: 6,
                                  }}>
                                  FACTORS AFFECTING YOUR FUEL COST
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 5,
                                  }}>
                                  {weightHint && (
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: 11,
                                        fontFamily: "var(--font-sans)",
                                      }}>
                                      <span
                                        style={{
                                          color: "var(--text-secondary)",
                                        }}>
                                        ⚖️ {weightHint.label}
                                      </span>
                                      <span
                                        style={{
                                          color: weightHint.color,
                                          fontFamily: "var(--font-mono)",
                                          fontSize: 10,
                                        }}>
                                        {weightHint.note}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: 11,
                                      fontFamily: "var(--font-sans)",
                                    }}>
                                    <span
                                      style={{
                                        color: "var(--text-secondary)",
                                      }}>
                                      🛣️ Road mix ({motorwayPct}% highway)
                                    </span>
                                    <span
                                      style={{
                                        color: "var(--text-tertiary)",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                      }}>
                                      {roadNote}
                                    </span>
                                  </div>
                                  {terrainHints.map((th) => (
                                    <div
                                      key={th.label}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: 11,
                                        fontFamily: "var(--font-sans)",
                                      }}>
                                      <span
                                        style={{
                                          color: "var(--text-secondary)",
                                        }}>
                                        {th.label}
                                      </span>
                                      <span
                                        style={{
                                          color: "var(--text-tertiary)",
                                          fontFamily: "var(--font-mono)",
                                          fontSize: 10,
                                        }}>
                                        {th.note}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Cost mode selector — compact */}
                              <div
                                style={{
                                  borderTop: "1px solid var(--border-subtle)",
                                  paddingTop: 10,
                                }}>
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--text-tertiary)",
                                    letterSpacing: "0.07em",
                                    marginBottom: 6,
                                  }}>
                                  PRICING METHOD
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 6,
                                    marginBottom: 10,
                                  }}>
                                  <div
                                    onClick={() => setCostMode("fuel")}
                                    style={{
                                      border: `2px solid ${costMode === "fuel" ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                                      borderRadius: 4,
                                      padding: "7px 10px",
                                      cursor: "pointer",
                                      background:
                                        costMode === "fuel"
                                          ? "var(--accent-glow)"
                                          : "var(--bg-elevated)",
                                      transition: "all 0.15s",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color:
                                          costMode === "fuel"
                                            ? "var(--accent-primary)"
                                            : "var(--text-tertiary)",
                                        letterSpacing: "0.05em",
                                        marginBottom: 2,
                                      }}>
                                      FUEL COST
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontFamily: "var(--font-mono)",
                                        fontWeight: 700,
                                        color:
                                          costMode === "fuel"
                                            ? "var(--accent-primary)"
                                            : "var(--text-primary)",
                                      }}>
                                      R{" "}
                                      {Math.round(
                                        fuelBasedTotal,
                                      ).toLocaleString()}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-tertiary)",
                                        fontFamily: "var(--font-mono)",
                                        marginTop: 2,
                                      }}>
                                      {Math.round(rd.fuel_usage_litres)}L × R
                                      {effectivePrice.toFixed(2)}
                                    </div>
                                  </div>
                                  <div
                                    onClick={() => setCostMode("base_rate")}
                                    style={{
                                      border: `2px solid ${costMode === "base_rate" ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                                      borderRadius: 4,
                                      padding: "7px 10px",
                                      cursor: "pointer",
                                      background:
                                        costMode === "base_rate"
                                          ? "var(--accent-glow)"
                                          : "var(--bg-elevated)",
                                      transition: "all 0.15s",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontFamily: "var(--font-mono)",
                                        color:
                                          costMode === "base_rate"
                                            ? "var(--accent-primary)"
                                            : "var(--text-tertiary)",
                                        letterSpacing: "0.05em",
                                        marginBottom: 2,
                                      }}>
                                      BASE RATE
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontFamily: "var(--font-mono)",
                                        fontWeight: 700,
                                        color:
                                          costMode === "base_rate"
                                            ? "var(--accent-primary)"
                                            : "var(--text-primary)",
                                      }}>
                                      R{" "}
                                      {Math.round(
                                        baseRateTotal,
                                      ).toLocaleString()}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-tertiary)",
                                        fontFamily: "var(--font-mono)",
                                        marginTop: 2,
                                      }}>
                                      {Math.round(rd.distance_km)}km × R
                                      {(
                                        selectedVehicleTypeBaseRate ??
                                        parseFloat(baseRatePerKm || "0")
                                      ).toFixed(2)}
                                    </div>
                                  </div>
                                </div>

                                {/* Editable toll + total */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                  }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: 12,
                                    }}>
                                    <span
                                      style={{
                                        color: "var(--text-secondary)",
                                      }}>
                                      Toll Cost:
                                    </span>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: "var(--text-tertiary)",
                                          fontFamily: "var(--font-mono)",
                                        }}>
                                        R
                                      </span>
                                      <input
                                        type="number"
                                        value={
                                          editableTollCost !== null
                                            ? editableTollCost
                                            : Math.round(rd.toll_cost_zar)
                                        }
                                        onChange={(e) => {
                                          setEditableTollCost(
                                            parseFloat(e.target.value) || 0,
                                          );
                                          setEditableTotalCostStr("");
                                        }}
                                        style={{
                                          ...inputStyle,
                                          width: 110,
                                          padding: "5px 8px",
                                          fontSize: 12,
                                          textAlign: "right",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: 12,
                                    }}>
                                    <span
                                      style={{
                                        color: "var(--text-secondary)",
                                      }}>
                                      Driver Allowance:
                                    </span>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: "var(--text-tertiary)",
                                          fontFamily: "var(--font-mono)",
                                        }}>
                                        R
                                      </span>
                                      <input
                                        type="number"
                                        value={driverAllowanceInput}
                                        onChange={(e) => {
                                          setDriverAllowanceInput(
                                            e.target.value,
                                          );
                                          setEditableTotalCostStr("");
                                        }}
                                        placeholder="0"
                                        style={{
                                          ...inputStyle,
                                          width: 110,
                                          padding: "5px 8px",
                                          fontSize: 12,
                                          textAlign: "right",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: 13,
                                      fontWeight: 700,
                                      borderTop:
                                        "1px solid var(--border-subtle)",
                                      paddingTop: 8,
                                      marginTop: 2,
                                    }}>
                                    <span
                                      style={{ color: "var(--text-primary)" }}>
                                      Estimated Trip Cost:
                                    </span>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          color: "var(--text-tertiary)",
                                          fontFamily: "var(--font-mono)",
                                        }}>
                                        R
                                      </span>
                                      <input
                                        type="number"
                                        value={
                                          editableTotalCostStr !== ""
                                            ? editableTotalCostStr
                                            : String(Math.round(computedTotal))
                                        }
                                        onChange={(e) =>
                                          setEditableTotalCostStr(
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          ...inputStyle,
                                          width: 130,
                                          padding: "5px 8px",
                                          fontSize: 13,
                                          fontWeight: 700,
                                          textAlign: "right",
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                    {tripType === "ROUND_TRIP" && returnRouteData?.success && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "var(--bg-surface)",
                          borderRadius: 2,
                          border: "1px solid var(--border-subtle)",
                        }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-tertiary)",
                            letterSpacing: "0.08em",
                            marginBottom: 8,
                          }}>
                          RETURN LEG RATE (AUTO-CALCULATED, EDITABLE)
                        </div>
                        <input
                          type="number"
                          value={returnBaseRate}
                          onChange={(e) => setReturnBaseRate(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!canGoToStep2}
                  className="btn-action"
                  style={{
                    width: "100%",
                    opacity: canGoToStep2 ? 1 : 0.4,
                    cursor: canGoToStep2 ? "pointer" : "not-allowed",
                    marginTop: 8,
                  }}>
                  NEXT →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Freight Details */}
      {currentStep === 2 && (
        <div
          className="card"
          style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Step 2: Freight Details
          </div>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--status-danger)",
                borderRadius: 2,
                color: "var(--status-danger)",
                fontSize: 12,
                marginBottom: 16,
              }}>
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 16,
            }}>
            <div>
              {label("Driver")}
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedVehicle?.driver != null
                        ? "— No driver assigned to this vehicle —"
                        : "— Select a driver (optional) —"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => {
                    const name =
                      d.user_details?.name ||
                      [d.user_details?.first_name, d.user_details?.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      d.user_details?.username ||
                      `Driver #${d.id}`;
                    return (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {name}
                        {d.status !== "active" ? ` (${d.status})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 16,
            }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.08em",
                  }}>
                  CUSTOMER
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCustomerForm({
                      name: "",
                      email: "",
                      phone: "",
                      city: "",
                    });
                    setShowNewCustomer(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    padding: 0,
                    textTransform: "uppercase",
                  }}>
                  + New Customer
                </button>
              </div>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {(
                    customers as {
                      id: number;
                      name: string;
                      company_name?: string;
                    }[]
                  ).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.company_name ? ` — ${c.company_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {label("Notes (Optional)")}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}>
              <div>
                {label("Status")}
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as "DRAFT" | "SENT")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Send to Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                {label("Confidence")}
                <Select
                  value={confidence}
                  onValueChange={(val) =>
                    setConfidence(val as "HIGH" | "MEDIUM" | "LOW")
                  }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}>
              <div>
                {label("SLA (Hours)")}
                <input
                  type="number"
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  placeholder="48"
                  style={inputStyle}
                />
              </div>
              <div>
                {label("Valid Until")}
                <DatePicker value={validUntil} onChange={setValidUntil} />
              </div>
            </div>
          </div>

          {/* UPGRADE 4: Enhanced Revenue Guard Badge */}
          {revenueGuard && (
            <div
              style={{
                padding: "16px",
                background:
                  revenueGuard.risk_level === "AT_RISK"
                    ? "rgba(239, 68, 68, 0.05)"
                    : revenueGuard.risk_level === "CAUTION"
                      ? "rgba(251, 191, 36, 0.05)"
                      : "rgba(34, 197, 94, 0.05)",
                borderRadius: 2,
                border: `1px solid var(--status-${revenueGuard.color})`,
                marginBottom: 16,
              }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.08em",
                  }}>
                  REVENUE GUARD
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}>
                    Margin: {(revenueGuard.margin_pct ?? 0).toFixed(1)}%
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      background: `var(--status-${revenueGuard.color})`,
                      borderRadius: 2,
                      fontSize: 10,
                      color: "#fff",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                    }}>
                    {revenueGuard.risk_level === "SAFE" && (
                      <>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>{" "}
                        SAFE
                      </>
                    )}
                    {revenueGuard.risk_level === "CAUTION" && (
                      <>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>{" "}
                        CAUTION
                      </>
                    )}
                    {revenueGuard.risk_level === "AT_RISK" && (
                      <>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>{" "}
                        AT RISK
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Margin Floor Display */}
              {revenueGuard.margin_floor && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: 12,
                  }}>
                  Minimum viable price (0% margin):{" "}
                  <span
                    style={{ color: "var(--status-danger)", fontWeight: 600 }}>
                    {revenueGuard.margin_floor_display ||
                      `R${Math.round(revenueGuard.margin_floor).toLocaleString()}`}
                  </span>
                </div>
              )}

              {/* Explanations Section (expandable for CAUTION/SAFE, pre-expanded for AT_RISK) */}
              {revenueGuard.explanations &&
                revenueGuard.explanations.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setGuardExpanded(!guardExpanded)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-primary)",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        cursor: "pointer",
                        padding: "4px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 8,
                      }}>
                      <span>
                        {guardExpanded || revenueGuard.risk_level === "AT_RISK"
                          ? "▼"
                          : "▶"}
                      </span>
                      <span>
                        Why is this {revenueGuard.risk_level.replace("_", " ")}?
                      </span>
                    </button>
                    {(guardExpanded ||
                      revenueGuard.risk_level === "AT_RISK") && (
                      <div
                        style={{
                          padding: "10px",
                          background: "var(--bg-surface)",
                          borderRadius: 2,
                          marginBottom: 8,
                        }}>
                        {revenueGuard.explanations.map((explanation, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              marginBottom:
                                idx < revenueGuard.explanations!.length - 1
                                  ? 6
                                  : 0,
                              fontFamily: "var(--font-sans)",
                              lineHeight: 1.5,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>{" "}
                            {explanation}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {/* Suggestions Section (expandable for CAUTION/SAFE, pre-expanded for AT_RISK) */}
              {revenueGuard.suggestions &&
                revenueGuard.suggestions.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-primary)",
                        marginBottom: 8,
                        fontWeight: 600,
                      }}>
                      How to fix it:
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        background: "var(--bg-surface)",
                        borderRadius: 2,
                      }}>
                      {revenueGuard.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            marginBottom:
                              idx < revenueGuard.suggestions!.length - 1
                                ? 6
                                : 0,
                            fontFamily: "var(--font-sans)",
                            lineHeight: 1.5,
                          }}>
                          → {suggestion}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Action Buttons */}
              {revenueGuard.risk_level === "AT_RISK" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {revenueGuard.recommended_surcharge_zar && (
                    <button
                      onClick={() => {
                        const surcharge =
                          revenueGuard.recommended_surcharge_zar!;
                        const newAdditionalCharges =
                          _weightSurcharge + _additionalCosts + surcharge;
                        setDriverAllowanceInput(
                          String(parseFloat(driverAllowanceInput) + surcharge),
                        );
                        setNotes(
                          (prev) =>
                            prev +
                            (prev ? "\n" : "") +
                            `Fuel surcharge added: +R${Math.round(surcharge).toLocaleString()} due to diesel price increase`,
                        );
                      }}
                      className="btn-action"
                      style={{
                        fontSize: 10,
                        padding: "8px 12px",
                        background: "var(--status-warning)",
                        border: "none",
                        color: "#000",
                        flex: 1,
                      }}>
                      ADD SURCHARGE
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNotes(
                        (prev) =>
                          prev +
                          (prev ? "\n\n" : "") +
                          "**PAYMENT TERM:** 50% deposit required before dispatch. 50% balance due on delivery.",
                      );
                    }}
                    className="btn-action"
                    style={{
                      fontSize: 10,
                      padding: "8px 12px",
                      background: "var(--accent-primary)",
                      border: "none",
                      color: "#fff",
                      flex: 1,
                    }}>
                    REQUIRE DEPOSIT
                  </button>
                </div>
              )}

              {/* Old warnings (fallback) */}
              {(!revenueGuard.explanations ||
                revenueGuard.explanations.length === 0) &&
                revenueGuard.warnings.length > 0 && (
                  <div
                    style={{
                      padding: "8px",
                      background: "var(--bg-surface)",
                      borderRadius: 2,
                    }}>
                    {revenueGuard.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 10,
                          color: "var(--text-secondary)",
                          marginBottom:
                            idx < revenueGuard.warnings.length - 1 ? 4 : 0,
                          fontFamily: "var(--font-sans)",
                        }}>
                        • {warning}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-action"
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                minWidth: 120,
              }}>
              ← BACK
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={!canGoToStep3}
              className="btn-action"
              style={{ minWidth: 120 }}>
              NEXT →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Customer & Summary */}
      {currentStep === 3 && (
        <div
          className="card"
          style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Step 3: Quote Summary
          </div>

          {/* Quote details recap (read-only — entered in Step 2) */}
          <div
            style={{
              padding: "16px",
              background: "var(--bg-surface-hover)",
              borderRadius: 2,
              marginBottom: 16,
            }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-tertiary)",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}>
              QUOTE DETAILS
            </div>
            {(() => {
              const cust = (
                customers as {
                  id: number;
                  name: string;
                  company_name?: string;
                }[]
              ).find((c) => String(c.id) === String(customerId));
              const rows: [string, string][] = [
                [
                  "Customer",
                  cust
                    ? cust.company_name
                      ? `${cust.name} — ${cust.company_name}`
                      : cust.name
                    : "—",
                ],
                ["Status", status === "SENT" ? "Send to customer" : "Draft"],
                [
                  "Confidence",
                  confidence
                    ? confidence.charAt(0) + confidence.slice(1).toLowerCase()
                    : "—",
                ],
                ["SLA", `${slaHours || 48} hours`],
                ["Valid until", validUntil ? String(validUntil) : "—"],
              ];
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows.map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        gap: 12,
                      }}>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-sans)",
                        }}>
                        {k}:
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          textAlign: "right",
                        }}>
                        {v}
                      </span>
                    </div>
                  ))}
                  {notes && notes.trim() && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginTop: 4,
                      }}>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-sans)",
                          fontSize: 12,
                        }}>
                        Notes:
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                        }}>
                        {notes}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Full cost breakdown */}
          <div
            style={{
              padding: "16px",
              background: "var(--bg-surface-hover)",
              borderRadius: 2,
              marginBottom: 16,
            }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-tertiary)",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}>
              FINAL COST BREAKDOWN
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12,
                marginBottom: 12,
              }}>
              {/* Trip type badge */}
              {tripType === "ROUND_TRIP" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Trip Type:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent-primary)",
                      fontWeight: 700,
                      fontSize: 11,
                    }}>
                    ROUND TRIP
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  {tripType === "ROUND_TRIP" ? "Leg 1 Route:" : "Route:"}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  {pickupLocation} → {deliveryLocation}
                </span>
              </div>
              {tripType === "ROUND_TRIP" && returnLocation && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Leg 2 Route:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent-primary)",
                    }}>
                    {deliveryLocation} → {returnLocation}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Distance:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  {Math.round(distanceKm)} km
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Cargo:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  {weight}t {vehicleType}
                </span>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12,
              }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Fuel Surcharge:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  R {Math.round(fuelCost).toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Toll Charges:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  R {Math.round(tollCost).toLocaleString()}
                </span>
              </div>
              {_weightSurcharge > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Weight Surcharge ({Math.round(weightSurchargePct * 100)}%
                    over{" "}
                    {weightThreshold >= 1000
                      ? `${weightThreshold / 1000}T`
                      : `${weightThreshold}kg`}
                    ):
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--status-warning)",
                    }}>
                    R {Math.round(_weightSurcharge).toLocaleString()}
                  </span>
                </div>
              )}
              {_additionalCosts > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Cross-Border Fees:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--status-warning)",
                    }}>
                    R {Math.round(_additionalCosts).toLocaleString()}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}>
                  Driver Allowance:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                  R {driverAllowance.toLocaleString()}
                </span>
              </div>
              {serviceCharge > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                    Service Charge:
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    R {Math.round(serviceCharge).toLocaleString()}
                  </span>
                </div>
              )}
              {tripType === "ROUND_TRIP" && _returnRate > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px dashed var(--border-subtle)",
                  }}>
                  <span
                    style={{
                      color: "var(--accent-primary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Return Leg ({returnCargo ? "with cargo" : "empty return"}):
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent-primary)",
                      fontWeight: 600,
                    }}>
                    R {Math.round(_returnRate).toLocaleString()}
                  </span>
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "var(--font-sans)",
                  }}>
                  {tripType === "ROUND_TRIP"
                    ? "Total (both legs):"
                    : "Quote Total:"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--accent-primary)",
                  }}>
                  R {Math.round(total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* UPGRADE 5: Market Benchmark Card */}
          {marketBenchmark && (
            <div
              style={{
                padding: "16px",
                background: "var(--bg-surface-hover)",
                borderRadius: 2,
                border: "1px solid var(--border-subtle)",
                marginBottom: 16,
              }}>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>{" "}
                SA MARKET RATE FOR {marketBenchmark.origin}→
                {marketBenchmark.destination} {vehicleType.toUpperCase()}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 12,
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Market Average:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}>
                    R{" "}
                    {Math.round(
                      marketBenchmark.market_avg_rate,
                    ).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                  }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Market Range:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                    }}>
                    R{" "}
                    {Math.round(
                      marketBenchmark.market_range_low,
                    ).toLocaleString()}{" "}
                    — R{" "}
                    {Math.round(
                      marketBenchmark.market_range_high,
                    ).toLocaleString()}
                  </span>
                </div>
                {marketBenchmark.data_points > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                    }}>
                    From {marketBenchmark.data_points} recent quotes ·
                    Confidence: {marketBenchmark.confidence}
                  </div>
                )}
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: 10,
                  marginBottom: 12,
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 6,
                  }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Your Quote:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent-primary)",
                      fontWeight: 700,
                    }}>
                    R {Math.round(total).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                  }}>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                    }}>
                    Position:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color:
                        marketBenchmark.your_vs_market_pct < 0
                          ? "var(--status-success)"
                          : marketBenchmark.your_vs_market_pct > 10
                            ? "var(--status-danger)"
                            : "var(--status-warning)",
                      fontWeight: 600,
                    }}>
                    {(marketBenchmark.your_vs_market_pct ?? 0) > 0 ? "+" : ""}
                    {(marketBenchmark.your_vs_market_pct ?? 0).toFixed(1)}%{" "}
                    {(marketBenchmark.your_vs_market_pct ?? 0) < 0
                      ? "below"
                      : "above"}{" "}
                    market
                    {(marketBenchmark.your_vs_market_pct ?? 0) < 0 && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          marginLeft: 4,
                          display: "inline-block",
                          verticalAlign: "middle",
                        }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>

              {marketBenchmark.recommendation && (
                <div
                  style={{
                    padding: "10px",
                    background: "var(--bg-surface)",
                    borderRadius: 2,
                    marginBottom: 10,
                  }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>{" "}
                    RECOMMENDATION
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-sans)",
                      lineHeight: 1.5,
                    }}>
                    {marketBenchmark.recommendation}
                  </div>
                </div>
              )}

              {marketBenchmark.data_points < 10 && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--status-warning)",
                    fontFamily: "var(--font-sans)",
                    marginBottom: 10,
                    padding: "8px",
                    background: "rgba(251, 191, 36, 0.1)",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>{" "}
                  {marketBenchmark.data_points < 5
                    ? "Market data building — not enough quotes on this lane yet. Using industry averages."
                    : "Limited market data for this lane. Take recommendation as guidance."}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowBenchmarkModal(true)}
                  className="btn-action"
                  style={{
                    fontSize: 10,
                    padding: "8px 12px",
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    flex: 1,
                  }}>
                  LEARN MORE
                </button>
                <button
                  onClick={() => {
                    // Adjust price to market average
                    const marketPrice = marketBenchmark.market_avg_rate;
                    const currentCosts =
                      fuelCost +
                      tollCost +
                      driverAllowance +
                      _weightSurcharge +
                      _additionalCosts;
                    const newBaseRate =
                      (marketPrice - currentCosts) / distanceKm;
                    setBaseRatePerKm(newBaseRate.toFixed(2));
                  }}
                  className="btn-action"
                  style={{
                    fontSize: 10,
                    padding: "8px 12px",
                    background: "var(--accent-primary)",
                    border: "none",
                    color: "#fff",
                    flex: 1,
                  }}>
                  ADJUST TO MARKET AVG
                </button>
              </div>
            </div>
          )}

          {/* Learn More Modal */}
          {showBenchmarkModal && marketBenchmark && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setShowBenchmarkModal(false)}>
              <div
                className="card"
                style={{ padding: 24, maxWidth: 500, margin: 20 }}
                onClick={(e) => e.stopPropagation()}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 16,
                  }}>
                  How is this calculated?
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}>
                  We track accepted quotes on this lane and route over the past
                  90 days. The "market average" is the median price of recent,
                  accepted jobs.
                </div>
                <div
                  style={{
                    padding: "12px",
                    background: "var(--bg-surface-hover)",
                    borderRadius: 2,
                    marginBottom: 16,
                  }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      fontSize: 12,
                    }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}>
                        Lane:
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}>
                        {marketBenchmark.origin} → {marketBenchmark.destination}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}>
                        Vehicle Type:
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {marketBenchmark.vehicle_type}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}>
                        Data Points:
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}>
                        {marketBenchmark.data_points} quotes (past 90 days)
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}>
                        Market Average:
                      </span>
                      <span
                        style={{
                          color: "var(--accent-primary)",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                        }}>
                        R{" "}
                        {Math.round(
                          marketBenchmark.market_avg_rate,
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}>
                        Range:
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}>
                        R{" "}
                        {Math.round(
                          marketBenchmark.market_range_low,
                        ).toLocaleString()}{" "}
                        — R{" "}
                        {Math.round(
                          marketBenchmark.market_range_high,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}>
                  Your quote (R {Math.round(total).toLocaleString()}) is{" "}
                  {Math.abs(marketBenchmark.your_vs_market_pct ?? 0).toFixed(1)}
                  %{" "}
                  {(marketBenchmark.your_vs_market_pct ?? 0) < 0
                    ? "below"
                    : "above"}{" "}
                  average, which is{" "}
                  {(marketBenchmark.your_vs_market_pct ?? 0) < 0
                    ? "competitive"
                    : (marketBenchmark.your_vs_market_pct ?? 0) > 15
                      ? "significantly above market"
                      : "within range"}
                  .
                </div>
                <button
                  onClick={() => setShowBenchmarkModal(false)}
                  className="btn-action"
                  style={{ width: "100%" }}>
                  CLOSE
                </button>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--status-danger)",
                borderRadius: 2,
                color: "var(--status-danger)",
                fontSize: 12,
                marginBottom: 16,
              }}>
              {error}
            </div>
          )}

          {/* Expected-profit-maximising price. Shown only once all mandatory data is filled. */}
          {canSave && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={fetchOptimal}
                disabled={optimizing}
                className="btn-action"
                style={{
                  width: "100%",
                  background: "var(--accent-primary)",
                  border: "none",
                  color: "var(--bg-deep)",
                  cursor: optimizing ? "wait" : "pointer",
                  fontWeight: 600,
                }}>
                {optimizing ? "OPTIMISING…" : "✦ FIND OPTIMAL PRICE"}
              </button>

              {analysis && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 16,
                    background: "var(--bg-surface-hover)",
                    borderRadius: 2,
                    border: "1px solid var(--accent-primary)",
                  }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                      letterSpacing: "0.08em",
                      marginBottom: 12,
                    }}>
                    AI QUOTE ANALYSIS
                  </div>

                  {analysis.narrative && (
                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 2, padding: "10px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.07em", marginBottom: 6 }}>
                        {analysis.narrative_source === "llm" ? "✦ AI SUMMARY" : "SUMMARY"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.55 }}>{analysis.narrative}</div>
                    </div>
                  )}

                  {analysis.cost_analysis?.success && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Cost vs route:</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 2, color: "#fff", background: `var(--status-${analysis.cost_analysis.color || "success"})` }}>
                          {(analysis.cost_analysis.risk_level || "").replace("_", " ")} · {analysis.cost_analysis.margin_pct?.toFixed(1)}%
                        </span>
                      </div>
                      {analysis.cost_analysis.cost_per_km != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Cost per km:</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>R {analysis.cost_analysis.cost_per_km.toFixed(2)}</span>
                        </div>
                      )}
                      {(analysis.cost_analysis.explanations || []).slice(0, 2).map((e) => (
                        <div key={e} style={{ fontSize: 11, color: "var(--text-tertiary)" }}>• {e}</div>
                      ))}
                    </div>
                  )}

                  {analysis.fuel_analysis && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Fuel price:</span>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {analysis.fuel_analysis.current_price != null && (
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>R {analysis.fuel_analysis.current_price.toFixed(2)}/L</span>
                          )}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2, color: "#fff", background: analysis.fuel_analysis.is_stale ? "var(--status-warning)" : "var(--status-success)" }}>
                            {analysis.fuel_analysis.is_stale ? "STALE" : "LIVE"}
                          </span>
                        </span>
                      </div>
                      {analysis.fuel_analysis.fuel_pct_of_total != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Fuel share of total:</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{analysis.fuel_analysis.fuel_pct_of_total}%</span>
                        </div>
                      )}
                      {(analysis.fuel_analysis.stale_warning || analysis.fuel_analysis.price_note) && (
                        <div style={{ fontSize: 11, color: "var(--status-warning)" }}>{analysis.fuel_analysis.stale_warning || analysis.fuel_analysis.price_note}</div>
                      )}
                    </div>
                  )}

                  {analysis.market_analysis?.market_rate != null && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Market rate:</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>R {Math.round(analysis.market_analysis.market_rate).toLocaleString()}</span>
                      </div>
                      {analysis.market_analysis.your_vs_market_pct != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Your quote vs market:</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: analysis.market_analysis.your_vs_market_pct >= 0 ? "var(--status-success)" : "var(--status-warning)" }}>
                            {analysis.market_analysis.your_vs_market_pct >= 0 ? "+" : ""}{analysis.market_analysis.your_vs_market_pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {optimal && (
                  <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      fontSize: 12,
                      marginBottom: 12,
                    }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Optimal price:
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--accent-primary)",
                        }}>
                        R {Math.round(optimal.optimal_price).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Margin:
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                        }}>
                        {optimal.optimal_margin_pct?.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Win probability:
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                        }}>
                        {Math.round(
                          (optimal.win_probability_at_optimal || 0) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Expected profit:
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--status-success)",
                          fontWeight: 600,
                        }}>
                        R{" "}
                        {Math.round(
                          optimal.expected_profit || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {Array.isArray(optimal.curve) &&
                    optimal.curve.length > 1 &&
                    (() => {
                      const data = optimal.curve.map((c: any) => ({
                        margin: c.margin_pct,
                        win: Math.round((c.win_probability || 0) * 100),
                        profit: Math.round(c.expected_profit || 0),
                      }));
                      return (
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-tertiary)",
                              letterSpacing: "0.08em",
                              marginBottom: 6,
                            }}>
                            PROFIT SWEET-SPOT · expected profit (area) vs
                            win-rate (line) across margin
                          </div>
                          {modelStats?.win_model && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                padding: "2px 8px",
                                borderRadius: 2,
                                marginBottom: 8,
                                background: "var(--bg-surface)",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-secondary)",
                              }}>
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 6,
                                  background:
                                    modelStats.win_model.mode === "learned"
                                      ? "var(--status-success)"
                                      : "var(--status-warning)",
                                }}
                              />
                              {modelStats.win_model.mode === "learned"
                                ? `Win model: learned${modelStats.win_model.auc != null ? ` · AUC ${modelStats.win_model.auc.toFixed(2)}` : ""} · ${modelStats.win_model.outcomes_collected} outcomes`
                                : `Win model: heuristic · ${modelStats.win_model.outcomes_collected}/${modelStats.win_model.outcomes_needed} outcomes to learn`}
                            </div>
                          )}
                          <ResponsiveContainer width="100%" height={150}>
                            <ComposedChart
                              data={data}
                              margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient
                                  id="evGrad"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1">
                                  <stop
                                    offset="5%"
                                    stopColor="var(--status-success)"
                                    stopOpacity={0.35}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="var(--status-success)"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="margin"
                                stroke="var(--text-tertiary)"
                                tickFormatter={(v: number) => `${v}%`}
                                style={{
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono)",
                                }}
                              />
                              <YAxis yAxisId="p" hide />
                              <YAxis
                                yAxisId="w"
                                orientation="right"
                                domain={[0, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                                stroke="var(--text-tertiary)"
                                style={{
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono)",
                                }}
                                width={32}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "var(--bg-deep)",
                                  border: "1px solid var(--border-subtle)",
                                  borderRadius: 2,
                                  fontSize: 11,
                                  fontFamily: "var(--font-mono)",
                                }}
                                labelFormatter={(v: any) => `Margin ${v}%`}
                                formatter={(val: any, name: any) =>
                                  name === "profit"
                                    ? [
                                        `R ${Number(val).toLocaleString()}`,
                                        "Exp. profit",
                                      ]
                                    : [`${val}%`, "Win rate"]
                                }
                              />
                              <Area
                                yAxisId="p"
                                type="monotone"
                                dataKey="profit"
                                stroke="var(--status-success)"
                                strokeWidth={2}
                                fill="url(#evGrad)"
                              />
                              <Line
                                yAxisId="w"
                                type="monotone"
                                dataKey="win"
                                stroke="var(--accent-primary)"
                                strokeWidth={2}
                                dot={false}
                              />
                              {optimal.optimal_margin_pct != null && (
                                <ReferenceLine
                                  yAxisId="p"
                                  x={
                                    Math.round(
                                      optimal.optimal_margin_pct * 10,
                                    ) / 10
                                  }
                                  stroke="var(--accent-primary)"
                                  strokeDasharray="3 3"
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </>
                  )}
                  {analysis.suggested_price_rationale && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10 }}>
                      {analysis.suggested_price_rationale}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-action"
                      onClick={applyOptimal}
                      style={{
                        flex: 1,
                        background: "var(--accent-primary)",
                        border: "none",
                        color: "var(--bg-deep)",
                        fontWeight: 600,
                      }}>
                      APPLY SUGGESTED PRICE
                    </button>
                    <button
                      className="btn-action"
                      onClick={() => { setOptimal(null); setAnalysis(null); }}
                      style={{
                        background: "none",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}>
                      DISMISS
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-action"
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                minWidth: 120,
              }}>
              ← BACK
            </button>
            <button
              onClick={handleSave}
              disabled={mutation.isPending || !canSave}
              className="btn-action"
              style={{ minWidth: 140 }}>
              {mutation.isPending
                ? "SAVING..."
                : isEditing
                  ? "UPDATE QUOTE"
                  : "SAVE QUOTE"}
            </button>
          </div>
        </div>
      )}
      {/* Quick-create customer slide-out */}
      {showNewCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "flex",
            justifyContent: "flex-end",
          }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--modal-backdrop)",
            }}
            onClick={() => setShowNewCustomer(false)}
          />
          <div
            style={{
              position: "relative",
              width: 440,
              background: "var(--bg-deep)",
              borderLeft: "1px solid var(--border-subtle)",
              padding: 28,
              overflowY: "auto",
            }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}>
                New Customer
              </div>
              <button
                onClick={() => setShowNewCustomer(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  fontSize: 18,
                }}>
                ✕
              </button>
            </div>
            {(
              [
                {
                  key: "name",
                  label: "Full Name",
                  placeholder: "e.g. John Doe",
                  required: true,
                },
                {
                  key: "email",
                  label: "Email",
                  placeholder: "e.g. john@company.com",
                  required: true,
                  type: "email",
                },
                {
                  key: "phone",
                  label: "Phone",
                  placeholder: "e.g. +27 11 000 0000",
                  required: true,
                },
                {
                  key: "city",
                  label: "City",
                  placeholder: "e.g. Johannesburg",
                  required: true,
                },
              ] as {
                key: "name" | "email" | "phone" | "city";
                label: string;
                placeholder: string;
                required: boolean;
                type?: string;
              }[]
            ).map((f) => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}>
                  {f.label}
                  <span
                    style={{ color: "var(--status-danger)", marginLeft: 2 }}>
                    *
                  </span>
                </label>
                <input
                  type={(f as any).type || "text"}
                  placeholder={f.placeholder}
                  value={newCustomerForm[f.key]}
                  onChange={(e) =>
                    setNewCustomerForm((p) => ({
                      ...p,
                      [f.key]: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    padding: "10px 12px",
                    borderRadius: 2,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                disabled={savingCustomer}
                onClick={async () => {
                  if (
                    !newCustomerForm.name.trim() ||
                    !newCustomerForm.email.trim() ||
                    !newCustomerForm.phone.trim() ||
                    !newCustomerForm.city.trim()
                  ) {
                    toast.warning("All fields are required");
                    return;
                  }
                  setSavingCustomer(true);
                  try {
                    const created = await postData({
                      url: "api/v1/customers/",
                      data: { ...newCustomerForm, status: "ACTIVE" },
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["customers"],
                    });
                    setCustomerId(String(created.id));
                    setShowNewCustomer(false);
                    setNewCustomerForm({
                      name: "",
                      email: "",
                      phone: "",
                      city: "",
                    });
                    toast.success(`"${created.name}" added and selected`);
                  } catch (e) {
                    toast.error(
                      (e as Error)?.message || "Failed to create customer",
                    );
                  }
                  setSavingCustomer(false);
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  background: "var(--accent-primary)",
                  color: "var(--bg-deep)",
                  border: "none",
                  borderRadius: 2,
                  cursor: savingCustomer ? "wait" : "pointer",
                  fontWeight: 600,
                }}>
                {savingCustomer ? "SAVING..." : "CREATE & SELECT"}
              </button>
              <button
                onClick={() => setShowNewCustomer(false)}
                style={{
                  padding: "10px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  background: "none",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  borderRadius: 2,
                  cursor: "pointer",
                }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
