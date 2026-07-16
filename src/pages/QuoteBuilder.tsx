import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, patchData, fetchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/formatters";
import { LocationInput, type LocationCoords } from "@/components/LocationInput";
import { RouteMapView } from "@/components/RouteMapView";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MessageCircle, Map, Info, Sparkles } from "lucide-react";

/**
 * QuoteBuilder — the redesigned single-page quote flow.
 * Enter client + vehicle type + collection + delivery → the system draws the route,
 * prices every real cost from THIS vehicle's rate + fuel burn, and the AI returns the
 * profit-max quote from the fleet's own history. Auto-saves as you work.
 *
 * Reuses the exact endpoints + save payload of the production NewQuote page so it is
 * fully backend-compatible.
 */

const DRAFT_KEY = "truckwyas_newquote_draft";
const FUEL_FALLBACK: Record<string, number> = {
  Flatbed: 32, Tautliner: 33, Refrigerated: 38, Tanker: 35, "Box Truck": 28, "Danger Load": 34,
};
const extractCode = (s: string) => {
  const m: Record<string, string> = { johannesburg: "JHB", joburg: "JHB", jhb: "JHB", "cape town": "CPT", cpt: "CPT", durban: "DUR", dur: "DUR", "port elizabeth": "PE", pretoria: "PTA", bloemfontein: "BFN" };
  const k = (s || "").toLowerCase();
  for (const key in m) if (k.includes(key)) return m[key];
  return (s || "").slice(0, 3).toUpperCase();
};

interface TollBreakdownItem { plaza: string; route: string; location_km: number; tariff: number; }
interface RouteOption {
  summary?: string; distance_km: number; duration_min?: number; duration_minutes?: number;
  toll_cost_zar?: number; toll_breakdown?: TollBreakdownItem[]; fuel_cost_zar?: number; total_cost_zar?: number;
  label?: string; geometry?: { lat: number; lon: number }[];
  road_type?: string; motorway_pct?: number; traffic_status?: string; congested_km?: number; terrain?: string;
}
const formatDuration = (min?: number) => {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
interface RouteData {
  distance_km: number; duration_minutes?: number; fuel_cost_zar?: number; toll_cost_zar?: number;
  fuel_usage_litres?: number; fuel_price_used?: number; routes?: RouteOption[]; best_index?: number;
  cross_border?: boolean; countries?: string[];
  additional_costs?: { border_fees?: number; weighbridge_fees?: number; non_sa_tolls?: number };
  toll_breakdown?: TollBreakdownItem[]; warnings?: string[];
  origin_resolved?: string; dest_resolved?: string;
}

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: editId } = useParams();
  const isEditing = !!editId;

  // ---- core inputs ----
  const [customerId, setCustomerId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [delivery, setDelivery] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState<LocationCoords | null>(null);

  // ---- details ----
  const [weight, setWeight] = useState("");
  const [cargo, setCargo] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [tripType, setTripType] = useState<"ONE_WAY" | "ROUND_TRIP">("ROUND_TRIP");
  const [crossBorder, setCrossBorder] = useState(true);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [showDetails, setShowDetails] = useState(true);

  // ---- pricing overrides ----
  const [editableTollCost, setEditableTollCost] = useState<number | null>(null);
  // True only once the user has actually typed in the Tolls field this session.
  // A quote loaded for editing pre-fills editableTollCost from its last-saved
  // toll_charges so there's no flash of R0 before the route recalculates, but
  // that saved figure must not permanently pin the field once live route data
  // (route.toll_cost_zar) arrives — otherwise a draft saved back when tolls
  // were mis-priced (e.g. before plazas were seeded) stays stuck at the old
  // wrong number forever, even though the toll breakdown popover shows the
  // correct live total.
  const [tollManuallyEdited, setTollManuallyEdited] = useState(false);
  const [driverAllowanceInput, setDriverAllowanceInput] = useState("0");
  const [baseRatePerKm, setBaseRatePerKm] = useState("10");
  const [serviceCharge, setServiceCharge] = useState(0);

  // ---- computed / async state ----
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [guard, setGuard] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // An unsaved localStorage draft found on mount — offered via a banner, never
  // force-loaded (force-loading hijacked every "New quote" with the last one).
  const [resumable, setResumable] = useState<any>(null);
  // True once THIS session created the DB draft. Lets us bind the URL to the new
  // quote's id without the edit-loader clobbering in-progress fields, and keeps
  // autosave running after that URL flip.
  const createdRef = useRef(false);
  // The draft's DB id, mirrored in a ref so the debounced autosave closure always
  // sees the latest value (React state is async — reading it from the closure
  // caused a POST race that created duplicate drafts). creatingRef locks out a
  // second POST while the first create is still in flight.
  const savedIdRef = useRef<number | null>(null);
  const creatingRef = useRef(false);

  // ---- reference data ----
  const { data: companyProfile } = useQuery({ queryKey: ["company-profile"], queryFn: () => fetchData("api/v1/company/profile/") });
  const { data: customersRaw } = useQuery({ queryKey: ["customers"], queryFn: () => fetchData("api/v1/customers/") });
  const { data: vehicleTypesRaw } = useQuery({ queryKey: ["vehicle-types"], queryFn: () => fetchData("api/v1/vehicle-types/") });
  const { data: fuelPrice } = useQuery({ queryKey: ["fuel-current"], queryFn: () => fetchData("/api/v1/fuel-prices/current/") });
  const { data: modelStats } = useQuery({ queryKey: ["quote-model-stats"], queryFn: () => fetchData("/api/v1/quotes/model-stats/") });

  const customers: any[] = customersRaw?.results || customersRaw || [];
  // Available types, de-duplicated by name (the fleet can have several vehicles of one type).
  const vehicleTypes: any[] = Object.values(
    (vehicleTypesRaw?.results || vehicleTypesRaw || [])
      .filter((v: any) => (v.available_vehicle_count ?? 1) > 0)
      .reduce((acc: Record<string, any>, v: any) => { if (!acc[v.name]) acc[v.name] = v; return acc; }, {})
  );
  const winModel = modelStats?.win_model;
  const aiLearning = winModel && winModel.mode === "heuristic";

  const selectedVT = useMemo(() => vehicleTypes.find((v: any) => v.name === vehicleType), [vehicleTypes, vehicleType]);
  const fuelPricePerL = Number(fuelPrice?.diesel_inland) || Number(companyProfile?.fuel_price_per_litre) || 21.7;
  const fuelConsumption = Number(selectedVT?.fuel_consumption_l_per_100km) || FUEL_FALLBACK[vehicleType] || 32;

  // Apply company defaults once loaded. The per-km rate is the company default
  // (VehicleType.base_rate is a flat/min figure, not a per-km rate).
  useEffect(() => {
    if (companyProfile) {
      if (companyProfile.default_base_rate_per_km) setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
      if (companyProfile.allow_cross_border === false) setCrossBorder(false);
    }
  }, [companyProfile]);

  const ready = !!(customerId && vehicleType && pickup && delivery && pickupCoords && deliveryCoords);

  // ---- derived costs ----
  const route = routeData?.routes?.[selectedRouteIndex] || null;
  // `distance` is always the ONE-WAY lane distance (what the map + route options
  // show, and what we persist). A round trip drives it twice, so distance-based
  // costs multiply by `legs`. Keeping `distance` one-way makes reload math simple:
  // base_rate/(distance×legs) always recovers the per-km rate.
  const distance = route?.distance_km ?? routeData?.distance_km ?? 0;
  const legs = tripType === "ROUND_TRIP" ? 2 : 1;
  const chargeDistance = distance * legs;
  const fuelCost = Math.round(chargeDistance * fuelConsumption * fuelPricePerL / 100);
  const tollRate = Number(companyProfile?.default_toll_rate_per_km) || 0.95;
  const autoToll = Math.round((route?.toll_cost_zar ?? routeData?.toll_cost_zar ?? distance * tollRate) * legs);
  const tollCost = tollManuallyEdited && editableTollCost !== null ? editableTollCost : autoToll;
  const tollBreakdown = route?.toll_breakdown ?? routeData?.toll_breakdown ?? [];
  const tollBreakdownOneWay = tollBreakdown.reduce((s, b) => s + Number(b.tariff), 0);
  const crossBorderCost = ((routeData?.additional_costs?.border_fees || 0) + (routeData?.additional_costs?.weighbridge_fees || 0) + (routeData?.additional_costs?.non_sa_tolls || 0)) * legs;
  const driverAllowance = Number(driverAllowanceInput) || 0;
  const weightKg = (Number(weight) || 0) * 1000;
  const surchargeThreshold = Number(companyProfile?.weight_surcharge_threshold_kg) || 5000;
  const surchargePct = Number(companyProfile?.weight_surcharge_pct) || 15;
  const weightSurcharge = weightKg > surchargeThreshold ? Math.round((chargeDistance * Number(baseRatePerKm)) * (surchargePct / 100)) : 0;
  const baseCost = Math.round(chargeDistance * Number(baseRatePerKm));
  const total = baseCost + fuelCost + tollCost + crossBorderCost + driverAllowance + weightSurcharge + serviceCharge;
  // Every real cost component the carrier must recover — base rate included.
  // Excluding base rate here (as an earlier version did) let the AI optimiser
  // treat it as pure profit already banked, so it could recommend a price
  // *below* the carrier's own base rate alone. Only the discretionary service
  // charge (the markup layered on top) is excluded from the cost floor.
  const directCost = total - serviceCharge;
  const marginPct = total > 0 ? Math.round(((total - directCost) / total) * 100) : 0;

  // ---- route calculation (debounced auto-run) ----
  const calcRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calculateRoute = async () => {
    if (!pickupCoords || !deliveryCoords) return;
    setCalculatingRoute(true);
    try {
      const data = await postData({ url: "/api/v1/route/calculate/", data: {
        origin: pickup, destination: delivery,
        origin_lat: pickupCoords.lat, origin_lon: pickupCoords.lon, origin_country: pickupCoords.country_code,
        dest_lat: deliveryCoords.lat, dest_lon: deliveryCoords.lon, dest_country: deliveryCoords.country_code,
        vehicle_type: vehicleType || "Flatbed", cross_border_enabled: crossBorder, weight_kg: weightKg || 20000,
      }});
      if (data?.success !== false) {
        setRouteData(data);
        setSelectedRouteIndex(data.best_index ?? 0);
      }
    } catch { toast.error("Couldn't calculate the route"); }
    finally { setCalculatingRoute(false); }
  };

  useEffect(() => {
    if (!ready) return;
    if (calcRef.current) clearTimeout(calcRef.current);
    calcRef.current = setTimeout(() => { calculateRoute(); }, 500);
    return () => { if (calcRef.current) clearTimeout(calcRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickupCoords, deliveryCoords, vehicleType, crossBorder]);

  // ---- AI analyze + guard + benchmark once cost is ready ----
  const analyzeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: if the user switches routes (or any
  // other cost input changes) while a call is in flight, a slower earlier call
  // must not overwrite the result of a newer one that resolves first.
  const aiReqRef = useRef(0);
  const runAI = async () => {
    if (!routeData || total <= 0) return;
    const reqId = ++aiReqRef.current;
    setOptimizing(true);
    try {
      const [an, gd] = await Promise.all([
        postData({ url: "api/v1/quotes/analyze/", data: {
          quote_total: total, direct_cost: directCost, distance_km: chargeDistance, origin: extractCode(pickup), destination: extractCode(delivery),
          vehicle_type: vehicleType, weight: weightKg, fuel_cost: fuelCost, toll_cost: tollCost, driver_cost: driverAllowance,
          fuel_usage_litres: Math.round(chargeDistance * fuelConsumption / 100), fuel_price_used: fuelPricePerL,
          market_rate: benchmark?.market_avg_rate || 0, client_tier: "standard",
          // This panel never renders the LLM narrative — skipping it server-side
          // cuts the analyze round-trip from seconds to near-instant.
          skip_narrative: true,
        }}).catch(() => null),
        postData({ url: "/api/v1/quotes/guard/", data: {
          total_cost: directCost, quote_price: total, distance_km: chargeDistance, fuel_cost: fuelCost, toll_cost: tollCost,
        }}).catch(() => null),
      ]);
      if (reqId !== aiReqRef.current) return; // a newer request has since started — this result is stale
      if (an) setAnalysis(an);
      if (gd?.success !== false) setGuard(gd);
    } finally { if (reqId === aiReqRef.current) setOptimizing(false); }
  };
  useEffect(() => {
    if (!routeData || total <= 0) return;
    // Any total-affecting change (trip-type flip, toll/driver/rate edit, route
    // switch) invalidates the numbers on screen: clear them and flag loading so
    // all four AI fields show a spinner together until the fresh analysis lands.
    setAnalysis(null); setGuard(null); setOptimizing(true);
    if (analyzeRef.current) clearTimeout(analyzeRef.current);
    analyzeRef.current = setTimeout(() => { runAI(); }, 700);
    return () => { if (analyzeRef.current) clearTimeout(analyzeRef.current); };
    // selectedRouteIndex/legs are folded into `total`, but list them so an
    // alternate-route pick (or trip-type flip) always re-runs the AI explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData, total, selectedRouteIndex, legs]);

  // benchmark on lane resolve
  useEffect(() => {
    if (!routeData) return;
    fetchData(`/api/v1/quotes/benchmark/?origin=${extractCode(pickup)}&destination=${extractCode(delivery)}&vehicle_type=${vehicleType.toLowerCase()}`)
      .then(b => { if (b?.success !== false) setBenchmark(b); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData]);

  const opt = analysis?.price_optimization;
  const applyOptimal = () => {
    const target = opt?.optimal_price || analysis?.suggested_price;
    // Floored at 0: serviceCharge has no visible line item in the cost
    // breakdown, so letting it go negative would silently apply a hidden
    // discount below full cost with no on-screen explanation.
    if (target && target > 0) { setServiceCharge(prev => Math.max(0, prev + (target - total))); toast.success("Applied AI-recommended price"); }
  };

  // ---- natural-language input ----
  const submitNL = async () => {
    if (!nlText.trim()) return;
    setNlBusy(true);
    try {
      const res = await postData({ url: "api/v1/ai/chat-quote/", data: { message: nlText, history: [], current_fields: {} } });
      const f = res?.extracted_fields || {};
      if (f.pickup_location) { setPickup(f.pickup_location); const g = await fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(f.pickup_location)}`).catch(() => null); const s = g?.results?.[0] || g?.[0]; if (s) setPickupCoords({ lat: s.lat, lon: s.lon }); }
      if (f.delivery_location) { setDelivery(f.delivery_location); const g = await fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(f.delivery_location)}`).catch(() => null); const s = g?.results?.[0] || g?.[0]; if (s) setDeliveryCoords({ lat: s.lat, lon: s.lon }); }
      if (f.cargo_description) setCargo(f.cargo_description);
      if (f.weight) setWeight(String((f.weight / 1000) || ""));
      if (f.vehicle_type) setVehicleType(f.vehicle_type);
      if (f.pickup_location || f.delivery_location) setShowDetails(true);
      toast.success(res?.reply || "Filled from your description");
      setNlText("");
    } catch { toast.error("Couldn't read that — try the fields instead"); }
    finally { setNlBusy(false); }
  };

  // ---- edit mode: load existing quote ----
  useEffect(() => {
    if (!editId) return;
    // We just created this draft and navigated to its URL — fields are already
    // in state; don't refetch and overwrite them.
    if (createdRef.current) return;
    fetchData(`api/v1/quotes/${editId}/`).then((q: any) => {
      setCustomerId(String(q.customer || ""));
      setPickup(q.pickup_location || ""); setDelivery(q.delivery_location || "");
      if (q.pickup_lat) setPickupCoords({ lat: Number(q.pickup_lat), lon: Number(q.pickup_lng) });
      if (q.delivery_lat) setDeliveryCoords({ lat: Number(q.delivery_lat), lon: Number(q.delivery_lng) });
      setVehicleType(q.vehicle_type || ""); setWeight(String((Number(q.weight) || 0) / 1000));
      setCargo(q.cargo_description || ""); setNotes(q.notes || "");
      setDriverAllowanceInput(String(q.driver_allowance || 0));
      if (q.toll_charges != null) setEditableTollCost(Number(q.toll_charges));
      if (q.trip_type) setTripType(q.trip_type);
      // base_rate is the round-trip base (chargeDistance × rate); divide by
      // distance × legs to recover the per-km rate the way the live math computes it.
      if (q.distance && q.base_rate) {
        const loadLegs = q.trip_type === "ROUND_TRIP" ? 2 : 1;
        setBaseRatePerKm(String(Math.round((Number(q.base_rate) / (Number(q.distance) * loadLegs)) * 100) / 100));
      }
      if (q.valid_until) setValidUntil(q.valid_until);
      if (q.pickup_date) setPickupDate(q.pickup_date);
      if (q.delivery_date) setDeliveryDate(q.delivery_date);
      setSavedQuoteId(Number(editId));
      savedIdRef.current = Number(editId);
      if (q.distance) setRouteData({ distance_km: Number(q.distance), toll_cost_zar: Number(q.toll_charges) });
    }).catch(() => toast.error("Couldn't load that quote"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ---- localStorage draft (crash-recovery for a not-yet-saved quote) ----
  // On mount we only OFFER to resume (via a banner); we never auto-load it, so a
  // fresh "New quote" always starts blank. Once the DB draft exists the slot is
  // cleared — the quotes list is then the source of truth for parked drafts.
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && (d.customerId || d.pickup || d.delivery)) setResumable(d);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyResumable = () => {
    const d = resumable; if (!d) return;
    setCustomerId(d.customerId || ""); setVehicleType(d.vehicleType || "");
    setPickup(d.pickup || ""); setDelivery(d.delivery || "");
    setPickupCoords(d.pickupCoords || null); setDeliveryCoords(d.deliveryCoords || null);
    setWeight(d.weight || ""); setCargo(d.cargo || ""); setNotes(d.notes || "");
    setTripType(d.tripType || "ONE_WAY");
    setResumable(null);
  };
  const discardResumable = () => { localStorage.removeItem(DRAFT_KEY); setResumable(null); };

  // Blank the form for a brand-new quote. React Router reuses this component
  // across /edit/:id ↔ /new (only the param changes, no remount), so we reset
  // every field explicitly rather than relying on a remount. The quote being
  // left is already saved (DB draft in the quotes list), so nothing is lost.
  const startNew = () => {
    localStorage.removeItem(DRAFT_KEY);
    createdRef.current = false; savedIdRef.current = null; creatingRef.current = false;
    setSavedQuoteId(null); setLastSavedAt(null); setResumable(null);
    setCustomerId(""); setVehicleType(""); setPickup(""); setDelivery("");
    setPickupCoords(null); setDeliveryCoords(null);
    setWeight(""); setCargo(""); setNotes(""); setTripType("ROUND_TRIP");
    setPickupDate(""); setDeliveryDate(""); setShowDetails(false); setNlText("");
    setEditableTollCost(null); setTollManuallyEdited(false); setDriverAllowanceInput("0"); setServiceCharge(0);
    setRouteData(null); setSelectedRouteIndex(0);
    setAnalysis(null); setGuard(null); setBenchmark(null);
    if (isEditing) navigate("/bookings/quotes/new", { replace: true });
    toast.success("Started a new quote");
  };

  const draftRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isEditing) return;
    // Don't persist an empty form — otherwise a blank "New quote" mount would
    // overwrite (and destroy) the unsaved draft the Resume banner is offering.
    if (!(customerId || pickup || delivery)) return;
    if (draftRef.current) clearTimeout(draftRef.current);
    draftRef.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType })); } catch { /* ignore */ }
    }, 800);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
  }, [isEditing, customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType]);

  // ---- build the save payload (matches production) ----
  const buildPayload = (status: "DRAFT" | "SENT") => ({
    customer: parseInt(customerId), pickup_location: pickup, delivery_location: delivery,
    pickup_date: pickupDate || null, delivery_date: deliveryDate || null,
    origin: extractCode(pickup), destination: extractCode(delivery),
    pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lon, delivery_lat: deliveryCoords?.lat, delivery_lng: deliveryCoords?.lon,
    cargo_description: cargo || `${weight || 0}t ${vehicleType}`.trim(), weight: weightKg, distance,
    estimated_duration_minutes: route?.duration_min ? Math.round(route.duration_min) : (routeData?.duration_minutes || null),
    vehicle_type: vehicleType, base_rate: baseCost, fuel_surcharge: fuelCost, toll_charges: tollCost,
    driver_allowance: driverAllowance, additional_charges: weightSurcharge + crossBorderCost + serviceCharge,
    total_amount: total, margin_percentage: marginPct, notes, status, confidence: "MEDIUM",
    sla_hours: Number(companyProfile?.default_sla_hours) || 48, valid_until: validUntil, trip_type: tripType,
    win_probability: opt?.win_probability_at_optimal != null ? Math.round(opt.win_probability_at_optimal * 100) : null,
  });

  // ---- auto-save DB draft once substantive (debounced) ----
  const dbRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const substantive = ready && total > 0;
  useEffect(() => {
    // Autosave a brand-new quote, or one we created this session (createdRef).
    // A pre-existing quote opened for editing saves explicitly, not on every keystroke.
    if (isEditing && !createdRef.current) return;
    if (!substantive) return;
    if (dbRef.current) clearTimeout(dbRef.current);
    dbRef.current = setTimeout(async () => {
      const existingId = savedIdRef.current ?? savedQuoteId;
      try {
        if (existingId) {
          await patchData({ url: `api/v1/quotes/${existingId}/`, data: buildPayload("DRAFT") });
        } else {
          if (creatingRef.current) return;      // a create is already in flight
          creatingRef.current = true;
          const res = await postData({ url: "api/v1/quotes/", data: buildPayload("DRAFT") });
          if (res?.id) {
            savedIdRef.current = res.id;
            setSavedQuoteId(res.id);
            createdRef.current = true;
            // The DB now owns this draft — drop the local crash-recovery copy and
            // bind the URL to the new quote so a refresh resumes it (no duplicate).
            localStorage.removeItem(DRAFT_KEY);
            setResumable(null);
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            navigate(`/bookings/quotes/${res.id}/edit`, { replace: true });
          }
          creatingRef.current = false;
        }
        setLastSavedAt(new Date());
      } catch { creatingRef.current = false; /* silent — localStorage still holds it */ }
    }, 1500);
    return () => { if (dbRef.current) clearTimeout(dbRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substantive, total, customerId, vehicleType, pickup, delivery, tollCost, driverAllowance, serviceCharge]);

  // ---- explicit save / send ----
  const save = async (send: boolean) => {
    if (!customerId) { toast.error("Pick a client first"); return; }
    if (!ready) { toast.error("Add vehicle type, collection and delivery"); return; }
    setSaving(true);
    try {
      let quoteId = savedQuoteId || (isEditing ? Number(editId) : null);
      if (quoteId) await patchData({ url: `api/v1/quotes/${quoteId}/`, data: buildPayload(send ? "SENT" : "DRAFT") });
      else { const res = await postData({ url: "api/v1/quotes/", data: buildPayload(send ? "SENT" : "DRAFT") }); quoteId = res?.id; }
      if (send && quoteId) {
        const r = await postData({ url: `api/v1/quotes/${quoteId}/send_to_customer/`, data: {} }).catch(() => null);
        toast.success(r?.email_sent ? "Quote sent to client" : "Quote saved — email pending");
      } else toast.success("Quote saved as draft");
      localStorage.removeItem(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      navigate(quoteId ? `/bookings/quotes/${quoteId}` : "/bookings/quotes");
    } catch (e: any) { toast.error(e?.message || "Couldn't save the quote"); }
    finally { setSaving(false); }
  };

  // ---- styles ----
  const cardS: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 4, boxShadow: "var(--shadow-card)" };
  const labelS: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" };
  const inputS: React.CSSProperties = { background: "var(--input-bg)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "9px 11px", color: "var(--text-primary)", fontSize: 14, width: "100%", outline: "none" };
  const dot = (c: string): React.CSSProperties => ({ width: 7, height: 7, borderRadius: 2, background: c, flexShrink: 0 });

  // All four AI fields (recommended price, margin, win probability, sweet-spot)
  // come from the same analyze response — show them together only once it has
  // landed; until then every field renders the same spinner.
  const aiLoading = optimizing || !analysis;
  const aiSpinner = (
    <svg width="18" height="18" viewBox="0 0 16 16" style={{ animation: "spin 1s linear infinite", marginTop: 10, display: "block" }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  );

  const curveData = (opt?.curve || []).map((c: any) => {
    const marginRaw = c.margin_pct != null ? c.margin_pct : (c.margin || 0) * 100;
    return { margin: Math.round(marginRaw), win: Math.round((c.win_probability || 0) * 100), profit: Math.round(c.expected_profit || 0) };
  });

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={labelS}>Operations</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{isEditing && !createdRef.current ? "Edit quote" : "New quote"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Auto-saves as you work"}
            <span style={dot(saving ? "var(--status-warning)" : lastSavedAt ? "var(--status-success)" : "var(--text-tertiary)")} />
          </div>
          <button onClick={startNew} title="Start a fresh quote (this one stays saved)"
            style={{ fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--accent-primary)", border: "1px solid var(--accent-primary)", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>
            + New quote
          </button>
        </div>
      </div>

      {/* Resume-unsaved banner — opt-in, only before the first DB save */}
      {resumable && !isEditing && (
        <div style={{ ...cardS, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", marginBottom: 12, borderColor: "var(--accent-primary)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            You have an unsaved quote from earlier{resumable.pickup ? ` (${resumable.pickup}${resumable.delivery ? ` → ${resumable.delivery}` : ""})` : ""}.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={applyResumable} style={{ fontSize: 13, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>Resume</button>
            <button onClick={discardResumable} style={{ fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>Discard</button>
          </div>
        </div>
      )}

      {/* NL input */}
      <div style={{ ...cardS, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 14, background: "var(--bg-surface-hover)" }}>
        <MessageCircle size={16} color="var(--text-tertiary)" />
        <input value={nlText} onChange={e => setNlText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitNL()}
          placeholder="Describe it — “20t steel, JHB to Cape Town, flatbed, Tuesday”" style={{ ...inputS, border: "none", background: "transparent" }} />
        <button onClick={submitNL} disabled={nlBusy || !nlText.trim()} style={{ fontSize: 13, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "7px 14px", cursor: "pointer", opacity: nlText.trim() ? 1 : 0.5 }}>{nlBusy ? "Reading…" : "Fill"}</button>
      </div>

      {/* 1 — inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ ...labelS, marginBottom: 5, display: "flex", justifyContent: "space-between" }}><span>Client</span><span onClick={() => navigate("/customers")} style={{ color: "var(--accent-primary)", cursor: "pointer" }}>+ New</span></div>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={inputS}>
            <option value="">Select client…</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5 }}>Vehicle type</div>
          <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={inputS}>
            <option value="">Select…</option>
            {vehicleTypes.map((v: any) => <option key={v.id || v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5 }}>Collection</div>
          <LocationInput value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c || null); }} placeholder="City / address" style={inputS} />
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5 }}>Delivery</div>
          <LocationInput value={delivery} onChange={(v, c) => { setDelivery(v); setDeliveryCoords(c || null); }} placeholder="City / address" style={inputS} />
        </div>
      </div>

      {/* details (collapsible) */}
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => setShowDetails(s => !s)} style={{ ...labelS, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>{showDetails ? "▾" : "▸"} Details · weight, dates, trip type</button>
        {showDetails && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }}>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Weight (t)</div><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 15" style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Pickup date</div><input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Delivery date</div><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Valid until</div><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inputS} /></div>
            <div style={{ gridColumn: "span 2" }}><div style={{ ...labelS, marginBottom: 5 }}>Cargo</div><input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="e.g. palletised steel" style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Trip</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ONE_WAY", "ROUND_TRIP"] as const).map(t => <button key={t} onClick={() => setTripType(t)} style={{ ...inputS, width: "auto", flex: 1, cursor: "pointer", background: tripType === t ? "var(--accent-primary)" : "var(--input-bg)", color: tripType === t ? "var(--btn-action-color)" : "var(--text-secondary)", fontSize: 12 }}>{t === "ONE_WAY" ? "One way" : "Round"}</button>)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}><input type="checkbox" checked={crossBorder} onChange={e => setCrossBorder(e.target.checked)} disabled={companyProfile?.allow_cross_border === false} /> Cross-border routes</label></div>
          </div>
        )}
      </div>

      {/* empty state */}
      {!ready && (
        <div style={{ ...cardS, padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
          <div style={{ marginBottom: 10, opacity: 0.4, display: "flex", justifyContent: "center" }}><Map size={32} /></div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>Add a client, vehicle type, collection and delivery</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>The route, costs and AI quote appear here automatically.</div>
        </div>
      )}

      {/* 2 — map + cost */}
      {ready && (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ ...cardS, overflow: "hidden" }}>
            <RouteMapView pickup={pickup} delivery={delivery} height={300}
              geometry={route?.geometry && route.geometry.length > 1
                ? route.geometry.map(p => [p.lat, p.lon] as [number, number])
                : undefined} />
            {routeData?.routes && routeData.routes.length > 1 && (
              <div style={{ display: "flex", gap: 8, padding: 10, flexWrap: "wrap", borderTop: "1px solid var(--border-subtle)" }}>
                {routeData.routes.map((r, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedRouteIndex(i)}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "5px 9px", borderRadius: 4, cursor: "pointer",
                          border: `1px solid ${i === selectedRouteIndex ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                          background: i === selectedRouteIndex ? "var(--status-success-bg)" : "var(--bg-surface)", color: i === selectedRouteIndex ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                        {r.label || r.summary || `Route ${i + 1}`} · {Math.round(r.distance_km)} km
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" style={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 12, padding: "10px 12px", maxWidth: 220 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 12px" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Distance</span><span>{Math.round(r.distance_km)} km</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Duration</span><span>{formatDuration(r.duration_minutes ?? r.duration_min)}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Fuel</span><span>{formatCurrency(r.fuel_cost_zar)}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Tolls</span><span>{formatCurrency(r.toll_cost_zar)}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Total</span><span>{formatCurrency(r.total_cost_zar)}</span>
                        {r.road_type && (<><span style={{ color: "var(--text-tertiary)" }}>Road</span><span>{r.road_type}</span></>)}
                        {r.terrain && (<><span style={{ color: "var(--text-tertiary)" }}>Terrain</span><span>{r.terrain}</span></>)}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
          <div style={{ ...cardS, padding: "14px 16px" }}>
            <div style={{ ...labelS, marginBottom: 8 }}>Cost breakdown · {vehicleType || "—"}</div>
            {calculatingRoute && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Calculating route…</div>}
            {!calculatingRoute && (<>
              {[
                { key: "fuel", l: `Fuel — ${fuelConsumption} L/100km @ R${fuelPricePerL}`, v: fuelCost, c: "var(--status-danger)" },
                { key: "tolls", l: "Tolls (SA plazas)", v: tollCost, c: "var(--status-warning)" },
                ...(crossBorderCost > 0 ? [{ key: "cb", l: "Cross-border / weighbridge", v: crossBorderCost, c: "#2BB6A6" }] : []),
                { key: "driver", l: "Driver allowance", v: driverAllowance, c: "var(--text-tertiary)" },
                ...(weightSurcharge > 0 ? [{ key: "surcharge", l: `Weight surcharge (${surchargePct}%)`, v: weightSurcharge, c: "var(--text-tertiary)" }] : []),
                { key: "base", l: `Base rate (${vehicleType || "—"} · R${baseRatePerKm}/km)`, v: baseCost, c: "var(--accent-primary)" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-row)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={dot(r.c)} />{r.l}
                    {r.key === "tolls" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" title="Toll breakdown"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "var(--bg-surface-hover)", color: "var(--text-tertiary)", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                            <Info size={11} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" style={{ width: 260, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: 12, fontSize: 12, color: "var(--text-primary)" }}>
                          <div style={{ ...labelS, marginBottom: 8 }}>Toll plazas on this route</div>
                          {tollBreakdown.length === 0 ? (
                            <div style={{ color: "var(--text-tertiary)" }}>No SANRAL plazas matched on this route.</div>
                          ) : (<>
                            {tollBreakdown.map((b, bi) => (
                              <div key={bi} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-row)" }}>
                                <span>{b.plaza} <span style={{ color: "var(--text-tertiary)" }}>({b.route})</span></span>
                                <span style={{ fontFamily: "var(--font-mono)", flexShrink: 0 }}>{formatCurrency(b.tariff)}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                              <span>One way total</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(tollBreakdownOneWay)}</span>
                            </div>
                            {legs === 2 && <div style={{ color: "var(--text-tertiary)", marginTop: 4 }}>× 2 for round trip = {formatCurrency(tollBreakdownOneWay * 2)}</div>}
                          </>)}
                        </PopoverContent>
                      </Popover>
                    )}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(r.v)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={labelS}>Quote total</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>{Math.round(distance)} km {legs === 2 ? `one way · ${Math.round(chargeDistance)} km round trip` : "one way"} · live diesel · your {vehicleType} settings{crossBorderCost > 0 ? ` · crosses ${(routeData?.countries || []).join("→")}` : ""}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ ...labelS, marginBottom: 4 }}>Tolls</div><input type="number" value={tollCost} onChange={e => { setEditableTollCost(Number(e.target.value)); setTollManuallyEdited(true); }} style={{ ...inputS, fontSize: 13, padding: "6px 8px" }} /></div>
                <div style={{ flex: 1 }}><div style={{ ...labelS, marginBottom: 4 }}>Driver</div><input type="number" value={driverAllowanceInput} onChange={e => setDriverAllowanceInput(e.target.value)} style={{ ...inputS, fontSize: 13, padding: "6px 8px" }} /></div>
                <div style={{ flex: 1 }}><div style={{ ...labelS, marginBottom: 4 }}>R/km</div><input type="number" value={baseRatePerKm} onChange={e => setBaseRatePerKm(e.target.value)} style={{ ...inputS, fontSize: 13, padding: "6px 8px" }} /></div>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* 3 — AI quote */}
      {ready && total > 0 && (
        <div style={{ ...cardS, border: "1px solid color-mix(in srgb, var(--accent-primary) 35%, var(--border-subtle))", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr" }}>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>Recommended price</div>
              {aiLoading ? aiSpinner : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "var(--accent-primary)", marginTop: 4 }}>{opt?.optimal_price ? formatCurrency(opt.optimal_price) : formatCurrency(total)}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>to this client</div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>Margin</div>
              {aiLoading ? aiSpinner : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>{opt?.optimal_margin_pct ? `${Math.round(opt.optimal_margin_pct)}%` : `${marginPct}%`}</div>
                <div style={{ fontSize: 12, color: "var(--status-success)", marginTop: 2 }}>{formatCurrency(opt?.expected_profit ?? ((opt?.optimal_price || total) - directCost))} profit</div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>Win probability</div>
              {aiLoading ? aiSpinner : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>{opt?.win_probability_at_optimal != null ? `${Math.round(opt.win_probability_at_optimal * 100)}%` : "—"}</div>
                <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "var(--bg-surface-hover)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round((opt?.win_probability_at_optimal || 0) * 100)}%`, background: "var(--accent-primary)" }} /></div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={labelS}>Profit sweet-spot</div>
              {aiLoading ? aiSpinner : curveData.length > 1 ? (
                <ResponsiveContainer width="100%" height={62}>
                  <ComposedChart data={curveData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="qg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--status-success)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--status-success)" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="margin" hide /><YAxis hide />
                    <ChartTooltip contentStyle={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", borderRadius: 4, fontSize: 11 }} formatter={(v: any, n: any) => n === "profit" ? [formatCurrency(Number(v)), "Exp. profit"] : [`${v}%`, "Win"]} labelFormatter={(v: any) => `Margin ${v}%`} />
                    <Area type="monotone" dataKey="profit" stroke="var(--status-success)" strokeWidth={2} fill="url(#qg)" />
                    {opt?.optimal_margin_pct != null && <ReferenceLine x={Math.round(opt.optimal_margin_pct)} stroke="var(--accent-primary)" strokeDasharray="3 3" />}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>—</div>}
            </div>
          </div>

          {/* revenue guard */}
          {guard && guard.risk_level && guard.risk_level !== "SAFE" && (
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border-row)", background: guard.risk_level === "AT_RISK" ? "var(--status-danger-bg)" : "var(--status-warning-bg)", fontSize: 13 }}>
              <b style={{ color: guard.risk_level === "AT_RISK" ? "var(--status-danger)" : "var(--status-warning)" }}>{guard.risk_level === "AT_RISK" ? "At risk" : "Caution"}</b>
              <span style={{ color: "var(--text-secondary)" }}> · {(guard.explanations || guard.warnings || [])[0]}{guard.suggestions?.[0] ? ` — ${guard.suggestions[0]}` : ""}</span>
            </div>
          )}

          {/* still learning */}
          {aiLearning && (
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-row)", background: "var(--status-warning-bg)", display: "flex", gap: 10, fontSize: 13 }}>
              <Sparkles size={16} color="var(--status-warning)" style={{ flexShrink: 0 }} />
              <div><b>AI pricing is still learning your fleet.</b><span style={{ color: "var(--text-secondary)" }}> Priced on true cost + your {vehicleType} base rate for now — the optimiser needs ~{winModel.outcomes_needed} completed loads to learn what wins with your clients ({winModel.outcomes_collected}/{winModel.outcomes_needed} logged). Every quote you close sharpens it.</span></div>
            </div>
          )}

          {/* actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--border-row)" }}>
            {opt && (opt.optimal_price || analysis?.suggested_price) && <button onClick={applyOptimal} style={{ fontSize: 14, fontWeight: 500, background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", borderRadius: 4, padding: "9px 14px", cursor: "pointer" }}>Apply recommended</button>}
            <button onClick={() => save(true)} disabled={saving} style={{ fontSize: 14, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Send quote to client</button>
            <button onClick={() => save(false)} disabled={saving} style={{ fontSize: 14, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Save as draft</button>
            {benchmark?.market_avg_rate ? <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text-tertiary)" }}>Benchmark: {formatCurrency(benchmark.market_avg_rate)} avg · {benchmark.recommendation || ""}</span> : null}
          </div>
        </div>
      )}

      {/* notes */}
      {ready && <div style={{ marginBottom: 40 }}><div style={{ ...labelS, marginBottom: 5 }}>Notes (optional)</div><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything for the client or your team…" style={{ ...inputS, resize: "vertical" }} /></div>}
    </div>
  );
}
