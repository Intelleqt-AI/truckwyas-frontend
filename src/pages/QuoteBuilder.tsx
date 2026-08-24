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
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AIChatPanel, type ChatMessage } from "@/components/AIChatPanel";
import { useAuth } from "@/lib/AuthContext";
import { isSubscriptionBlocked, subscriptionStatusDetail } from "@/lib/subscriptionStatus";
import { MessageCircle, Map, Info, Sparkles, Maximize2, Mic, Square, X, Plus, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
// Which company-level default price applies, keyed by a vehicle type's own
// fuel_type — Company stores one default per fuel type (fuel_price_per_litre
// doubles as the Diesel default, since it predates the other three).
const FUEL_PRICE_FIELD_BY_TYPE: Record<string, string> = {
  Diesel: "fuel_price_per_litre",
  Petrol: "fuel_price_petrol",
  Electric: "fuel_price_electric",
  Hybrid: "fuel_price_hybrid",
};
const extractCode = (s: string) => {
  const m: Record<string, string> = { johannesburg: "JHB", joburg: "JHB", jhb: "JHB", "cape town": "CPT", cpt: "CPT", durban: "DUR", dur: "DUR", "port elizabeth": "PE", pretoria: "PTA", bloemfontein: "BFN" };
  const k = (s || "").toLowerCase();
  for (const key in m) if (k.includes(key)) return m[key];
  return (s || "").slice(0, 3).toUpperCase();
};
// Mirrors the backend's country detection (core/services/cross_border.py):
// anything that isn't South Africa itself counts as a foreign location.
const isForeignCountry = (code?: string) => !!code && !["ZA", "ZAF"].includes(code.toUpperCase());

interface TollBreakdownItem { plaza: string; route: string; location_km: number; tariff: number; }
interface QuoteStop { id: string; location: string; coords: LocationCoords | null; }

// One draggable stop row — a plain grip + location input + remove button,
// no card/box around it (matches the rest of the form's flat inputs).
// useSortable needs its own component instance per item, so this can't be
// inlined into the .map() below.
function SortableStopRow({ stop, index, inputStyle, onLocationChange, onRemove }: {
  stop: QuoteStop; index: number; inputStyle: React.CSSProperties;
  onLocationChange: (v: string, c: LocationCoords | null) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const [hoverRemove, setHoverRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Play the fade/shrink first, then actually drop it from state — an
  // instant removal reads as the list glitching, not as something deleted.
  const handleRemoveClick = () => {
    setRemoving(true);
    setTimeout(onRemove, 160);
  };
  const dragTransform = CSS.Transform.toString(transform);
  return (
    <div ref={setNodeRef} style={{
      position: "relative", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8,
      transform: removing ? `${dragTransform ?? ""} scale(0.95)`.trim() : dragTransform,
      transition: removing ? "opacity 160ms ease, transform 160ms ease" : transition,
      opacity: removing ? 0 : (isDragging ? 0.5 : 1),
      zIndex: isDragging ? 2 : "auto",
    }}>
      <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "var(--btn-action-color)", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {index + 1}
      </span>
      <span {...attributes} {...listeners} title="Drag to reorder"
        style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: "var(--text-tertiary)", flexShrink: 0, touchAction: "none" }}>
        <GripVertical size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LocationInput value={stop.location} onChange={onLocationChange} placeholder="Stop location" style={inputStyle} />
      </div>
      <button type="button" onClick={handleRemoveClick} title="Remove stop"
        onMouseEnter={() => setHoverRemove(true)} onMouseLeave={() => setHoverRemove(false)}
        style={{
          width: 20, height: 20, marginTop: 6, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center", border: "none",
          background: hoverRemove ? "var(--status-danger-bg)" : "transparent",
          color: "var(--status-danger)", cursor: "pointer", flexShrink: 0,
          transition: "background 120ms ease",
        }}>
        <X size={14} />
      </button>
    </div>
  );
}

// The map header's numbered pick-target pill for one stop — a hover-only
// remove button in the corner needs its own hover state per pill, so this
// can't be inlined into the .map() below either.
function StopPickPill({ index, active, filled, onSelect, onRemove }: {
  index: number; active: boolean; filled: boolean; onSelect: () => void; onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onSelect}
        style={{ height: 24, minWidth: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-mono)", padding: "0 8px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
          border: `1px solid ${active || filled ? "var(--accent-primary)" : "var(--border-subtle)"}`,
          background: active ? "var(--status-success-bg)" : "transparent",
          color: active || filled ? "var(--accent-primary)" : "var(--text-tertiary)" }}>
        {index + 1}
      </button>
      {hovered && (
        <button type="button" onClick={onRemove} title="Remove stop"
          style={{
            position: "absolute", top: -6, right: -6, width: 15, height: 15, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            border: "1px solid var(--bg-surface)", background: "var(--status-danger)", color: "#fff", cursor: "pointer",
          }}>
          <X size={9} />
        </button>
      )}
    </div>
  );
}

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
  stops_count?: number;
}

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: editId } = useParams();
  const isEditing = !!editId;

  // Known from the same /auth/me/ call the whole app already makes on load —
  // no need to wait for a 402 to discover this. Mirrors exactly what
  // PlanLimitsMiddleware blocks server-side (POST/PATCH/PUT quotes, POST
  // invoices), so gating the AI calls and the send/save actions on it here
  // never disagrees with what the backend would actually allow.
  const { user: authUser } = useAuth();
  const billingBlocked = isSubscriptionBlocked(authUser?.subscription_status);

  // ---- core inputs ----
  const [customerId, setCustomerId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [delivery, setDelivery] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState<LocationCoords | null>(null);

  // ---- intermediate stops (UI only for now — not yet sent to the backend
  // or factored into route/distance calculation; that's the follow-up once
  // this is wired up server-side) ----
  const [stops, setStops] = useState<QuoteStop[]>([]);
  const stopIdRef = useRef(0);
  const addStop = () => {
    stopIdRef.current += 1;
    const id = `stop-${stopIdRef.current}`;
    setStops(prev => [...prev, { id, location: "", coords: null }]);
    // Auto-select the new stop as the map-pick target — same "just added,
    // now pick where" flow as Collection auto-advancing to Delivery below.
    setPickMode(id);
  };
  const [stopsExpanded, setStopsExpanded] = useState(false);
  const removeStop = (id: string) => setStops(prev => prev.filter(s => s.id !== id));
  const updateStop = (id: string, patch: Partial<QuoteStop>) =>
    setStops(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const stopSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleStopDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStops(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // ---- details ----
  const [weight, setWeight] = useState("");
  const [cargo, setCargo] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [tripType, setTripType] = useState<"ONE_WAY" | "ROUND_TRIP">("ONE_WAY");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [showDetails, setShowDetails] = useState(true);
  // Which field the next map click fills. Auto-advances to the empty one so a
  // "click collection, click delivery" flow needs no manual toggling — but stays
  // user-controlled via the pills so either point can be re-picked later.
  // "pickup" | "delivery" | a stop's id — which target the next map
  // double-click sets.
  const [pickMode, setPickMode] = useState<string>("pickup");

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
  // Set when the backend's cross-border company-policy gate refuses this
  // route (RouteCalculatorView) — shown in place of the cost breakdown.
  const [routeBlockedMessage, setRouteBlockedMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [guard, setGuard] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  // Persistent AI conversation — every message and reply lands here (see
  // AIChatPanel) instead of a one-shot toast with no way to reply to it.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  // In-progress "create this client/vehicle type" mini-conversation (see
  // backend/core/services/quote_entity_chat.py) — round-tripped every turn
  // since the endpoint is otherwise stateless. declinedEntities remembers
  // names the user said no to this session so they aren't re-asked.
  const [pendingEntity, setPendingEntity] = useState<any>(null);
  const [declinedEntities, setDeclinedEntities] = useState<string[]>([]);
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
  // Fuel price comes from the company's own per-fuel-type defaults, keyed by
  // the SELECTED vehicle type's fuel type — not a separately-fetched live
  // diesel price, and not always Diesel regardless of what's actually chosen.
  const companyFuelPriceField = (FUEL_PRICE_FIELD_BY_TYPE as Record<string, string>)[selectedVT?.fuel_type || 'Diesel'] || 'fuel_price_per_litre';
  const fuelPricePerL = Number(companyProfile?.[companyFuelPriceField]) || Number(companyProfile?.fuel_price_per_litre) || 21.7;
  const fuelConsumption = Number(selectedVT?.fuel_consumption_l_per_100km) || FUEL_FALLBACK[vehicleType] || 32;

  // Fallback only, for before any vehicle type is picked — once one is
  // selected, applyVehicleType() below takes over and uses that type's own
  // rate instead (Settings > Vehicle Types labels this field "R/km", so it's
  // the more specific, more correct source once it's available).
  useEffect(() => {
    if (companyProfile && !vehicleType) {
      if (companyProfile.default_base_rate_per_km) setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
    }
  }, [companyProfile, vehicleType]);

  // Selecting a vehicle type prefills the per-km rate from that type's own
  // configured rate, falling back to the company default if it has none set.
  // Weight is deliberately left alone — it's the real cargo weight, not
  // something to guess from the truck's max capacity. This only runs on an
  // actual selection (called from the dropdown's onChange, AI/voice
  // extraction, and resuming a draft) — never from a passive effect keyed on
  // the selected type, which would incorrectly re-fire and clobber the saved
  // rate whenever an existing quote is loaded for editing (its own saved
  // value is restored separately).
  const applyVehicleType = (name: string) => {
    setVehicleType(name);
    const vt = vehicleTypes.find((v: any) => v.name === name);
    if (vt?.base_rate) {
      setBaseRatePerKm(String(vt.base_rate));
    } else if (companyProfile?.default_base_rate_per_km) {
      setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
    }
  };

  const ready = !!(customerId && vehicleType && pickup && delivery && pickupCoords && deliveryCoords && Number(weight) > 0);

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
    setRouteBlockedMessage(null);
    try {
      const data = await postData({ url: "/api/v1/route/calculate/", data: {
        origin: pickup, destination: delivery,
        origin_lat: pickupCoords.lat, origin_lon: pickupCoords.lon, origin_country: pickupCoords.country_code,
        dest_lat: deliveryCoords.lat, dest_lon: deliveryCoords.lon, dest_country: deliveryCoords.country_code,
        vehicle_type: vehicleType || "Flatbed", weight_kg: weightKg || 20000,
        // Only stops with a resolved location count as routing waypoints —
        // one still being typed in is skipped rather than breaking the calc.
        // Route alternatives aren't available once stops are involved (a
        // TomTom limitation, not ours), so `routes` comes back with exactly
        // one entry in that case — see the single-route summary below.
        stops: stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lon: s.coords!.lon })),
      }});
      if (data?.success !== false) {
        setRouteData(data);
        setSelectedRouteIndex(data.best_index ?? 0);
      }
    } catch (e: any) {
      // Company policy gate (see RouteCalculatorView): this route genuinely
      // crosses a border but the company isn't set up for cross-border work.
      // Surface the real reason instead of a generic failure toast. Api.ts's
      // response interceptor reshapes axios errors into a plain Error with
      // .data/.status (not .response.data) — read from there, not .response.
      const body = e?.data;
      if (body?.error === "cross_border_not_allowed") {
        setRouteBlockedMessage(body.message || "This route isn't allowed for your company.");
        setRouteData(null);
      } else {
        toast.error("Couldn't calculate the route");
      }
    }
    finally { setCalculatingRoute(false); }
  };

  // Stable key so the route only recalculates when a stop's actual
  // coordinates change (added/removed/reordered/relocated) — a new array
  // reference on every render would otherwise refire this on every keystroke
  // elsewhere in the form.
  const stopsRouteKey = stops.filter(s => s.coords).map(s => `${s.coords!.lat},${s.coords!.lon}`).join("|");

  useEffect(() => {
    if (!ready || billingBlocked) return;
    if (calcRef.current) clearTimeout(calcRef.current);
    calcRef.current = setTimeout(() => { calculateRoute(); }, 500);
    return () => { if (calcRef.current) clearTimeout(calcRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickupCoords, deliveryCoords, vehicleType, billingBlocked, stopsRouteKey]);

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
    // Billing blocked: quotes can't be sent/saved anyway, so skip the AI
    // round-trips entirely rather than call them just to discard the result.
    if (billingBlocked) { setAnalysis(null); setGuard(null); setOptimizing(false); return; }
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
  }, [routeData, total, selectedRouteIndex, legs, billingBlocked]);

  // benchmark on lane resolve
  useEffect(() => {
    if (!routeData || billingBlocked) return;
    fetchData(`/api/v1/quotes/benchmark/?origin=${extractCode(pickup)}&destination=${extractCode(delivery)}&vehicle_type=${vehicleType.toLowerCase()}`)
      .then(b => { if (b?.success !== false) setBenchmark(b); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData, billingBlocked]);

  const opt = analysis?.price_optimization;
  // Single source of truth for "the AI-recommended price" — used for the
  // on-screen number AND the apply target, so clicking Apply always sets the
  // total to the exact figure the user just saw. In learning mode this is
  // "true cost + 25%" based on directCost (never on `total`, which may
  // already include a previously-applied markup — using `total` here would
  // make the suggestion compound upward on every apply).
  const suggestedPrice = aiLearning
    ? Math.round(directCost * 1.25)
    : (opt?.optimal_price || analysis?.suggested_price || null);
  // Once the total already matches the suggestion (within a rand), there's
  // nothing left to apply — hide the button instead of leaving a no-op
  // control that looks like the recommendation "came back".
  const alreadyApplied = suggestedPrice != null && Math.abs(total - suggestedPrice) < 1;
  const applyOptimal = () => {
    // Floored at 0: serviceCharge has no visible line item in the cost
    // breakdown, so letting it go negative would silently apply a hidden
    // discount below full cost with no on-screen explanation.
    if (suggestedPrice && suggestedPrice > 0) { setServiceCharge(prev => Math.max(0, prev + (suggestedPrice - total))); toast.success("Applied AI-recommended price"); }
  };
  // serviceCharge is only ever written by applyOptimal (or the form reset) —
  // there's no other manual markup control — so it's purely the AI delta.
  // Zeroing it drops the total back to directCost, the real cost-based price.
  const cancelAiPrice = () => { setServiceCharge(0); toast.success("Reverted to actual price"); };

  // ---- natural-language input (typed or transcribed from voice) ----
  // Shared by the top quick-fill bar and the AI chat panel — both are just
  // different entry points into the same conversation, so every message
  // (whichever surface it came from) is recorded in chatMessages with real
  // history/current_fields sent to the backend for follow-up context.
  const submitNL = async (textOverride?: string, detectedLanguage?: string | null) => {
    const text = (textOverride ?? nlText).trim();
    if (!text) return;
    const history = chatMessages.map(m => ({ role: m.role, content: m.text }));
    setChatMessages(prev => [...prev, { role: "user", text }]);
    setChatOpen(true);
    setNlBusy(true);
    try {
      const selectedCustomerName = customers.find((c: any) => String(c.id) === customerId)?.name || "";
      const current_fields = {
        pickup_location: pickup, delivery_location: delivery, weight_kg: weightKg,
        vehicle_type: vehicleType, customer_name: selectedCustomerName, cargo_description: cargo,
        pickup_date: pickupDate, delivery_date: deliveryDate, valid_until: validUntil, trip_type: tripType,
      };
      const res = await postData({ url: "api/v1/ai/chat-quote/", data: {
        message: text, history, current_fields,
        pending_entity: pendingEntity, declined_entities: declinedEntities,
        // Voice-sourced: Whisper's own authoritative language code, so the
        // assistant's reply matches it instead of guessing from the text.
        // Typed messages omit this — the backend runs its own text detector.
        ...(detectedLanguage ? { detected_language: detectedLanguage } : {}),
      } });
      setPendingEntity(res?.pending_entity ?? null);
      if (res?.declined_entity) setDeclinedEntities(prev => [...prev, String(res.declined_entity).toLowerCase()]);
      const f = res?.extracted_fields || {};
      // A client/vehicle type just created via chat isn't in the cached
      // dropdown list yet — refetch so it actually appears as a selectable option.
      if (f.customer_id) queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (f.vehicle_type) queryClient.invalidateQueries({ queryKey: ["vehicle-types"] });
      if (f.pickup_location) { setPickup(f.pickup_location); const g = await fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(f.pickup_location)}`).catch(() => null); const s = g?.results?.[0] || g?.[0]; if (s) setPickupCoords({ lat: s.lat, lon: s.lon }); }
      if (f.delivery_location) { setDelivery(f.delivery_location); const g = await fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(f.delivery_location)}`).catch(() => null); const s = g?.results?.[0] || g?.[0]; if (s) setDeliveryCoords({ lat: s.lat, lon: s.lon }); }
      if (f.cargo_description) setCargo(f.cargo_description);
      if (f.weight) setWeight(String((f.weight / 1000) || ""));
      if (f.vehicle_type) applyVehicleType(f.vehicle_type);
      if (f.customer_id) setCustomerId(String(f.customer_id));
      if (f.pickup_date) setPickupDate(f.pickup_date);
      if (f.delivery_date) setDeliveryDate(f.delivery_date);
      if (f.valid_until) setValidUntil(f.valid_until);
      if (f.trip_type === "ONE_WAY" || f.trip_type === "ROUND_TRIP") setTripType(f.trip_type);
      if (f.pickup_location || f.delivery_location || f.pickup_date || f.delivery_date) setShowDetails(true);
      setChatMessages(prev => [...prev, { role: "assistant", text: res?.reply || "Got it — updated the form.", link: res?.link || undefined }]);
      if (!textOverride) setNlText("");
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "Sorry, I couldn't read that — try rephrasing or use the fields directly." }]);
    }
    finally { setNlBusy(false); }
  };

  const voice = useVoiceRecorder((text, lang) => { setNlText(text); submitNL(text, lang); });

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
    setCustomerId(d.customerId || ""); if (d.vehicleType) applyVehicleType(d.vehicleType);
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
    setStops([]); setPickMode("pickup"); setStopsExpanded(false);
    setWeight(""); setCargo(""); setNotes(""); setTripType("ONE_WAY");
    setPickupDate(""); setDeliveryDate(""); setShowDetails(false); setNlText("");
    setEditableTollCost(null); setTollManuallyEdited(false); setDriverAllowanceInput("0"); setServiceCharge(0);
    setRouteData(null); setSelectedRouteIndex(0); setRouteBlockedMessage(null);
    setAnalysis(null); setGuard(null); setBenchmark(null);
    setChatMessages([]); setChatOpen(false); setPendingEntity(null); setDeclinedEntities([]);
    { const d = new Date(); d.setDate(d.getDate() + 7); setValidUntil(d.toISOString().slice(0, 10)); }
    if (isEditing) navigate("/bookings/quotes/new", { replace: true });
    toast.success("Started a new quote");
  };

  const draftRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds a closure over "what would be saved right now" — read by the
  // unmount-flush effect below so navigating away mid-debounce still writes
  // the latest edits instead of the pending save just getting cancelled.
  const draftFlushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (isEditing) return;
    // Don't persist an empty form — otherwise a blank "New quote" mount would
    // overwrite (and destroy) the unsaved draft the Resume banner is offering.
    if (!(customerId || pickup || delivery)) return;
    if (draftRef.current) clearTimeout(draftRef.current);
    const doSave = () => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType })); } catch { /* ignore */ }
    };
    draftFlushRef.current = doSave;
    draftRef.current = setTimeout(() => { draftFlushRef.current = null; doSave(); }, 800);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
  }, [isEditing, customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType]);

  // Runs its cleanup ONLY on true unmount (empty deps) — unlike the effect
  // above, whose cleanup also fires on every keystroke as it re-debounces.
  // This is what actually flushes a still-pending save when the user leaves
  // the page before the debounce timer would have fired on its own.
  useEffect(() => {
    return () => { draftFlushRef.current?.(); };
  }, []);

  // Backend stores coords as DecimalField(max_digits=12, decimal_places=7) —
  // a raw JS float (map click, some geocoders) can carry 15+ significant
  // digits and gets rejected outright ("no more than 12 digits in total").
  // 6dp (~11cm precision) is far more than a freight quote needs.
  const round6 = (n?: number) => (n == null ? n : Math.round(n * 1e6) / 1e6);
  // Same class of bug as the coordinates above, different field: base_rate,
  // fuel_surcharge, toll_charges, driver_allowance, additional_charges and
  // total_amount are all DecimalField(max_digits=10, decimal_places=2) —
  // summing floats (weightSurcharge + crossBorderCost + serviceCharge, etc.)
  // can leave a trailing artifact like 2269.0000000000002, which fails
  // "no more than 10 digits" before Django ever gets to round it to 2dp.
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ---- build the save payload (matches production) ----
  const buildPayload = (status: "DRAFT" | "SENT") => ({
    customer: parseInt(customerId), pickup_location: pickup, delivery_location: delivery,
    pickup_date: pickupDate || null, delivery_date: deliveryDate || null,
    origin: extractCode(pickup), destination: extractCode(delivery),
    pickup_lat: round6(pickupCoords?.lat), pickup_lng: round6(pickupCoords?.lon), delivery_lat: round6(deliveryCoords?.lat), delivery_lng: round6(deliveryCoords?.lon),
    cargo_description: cargo || `${weight || 0}t ${vehicleType}`.trim(), weight: weightKg, distance,
    estimated_duration_minutes: route?.duration_min ? Math.round(route.duration_min) : (routeData?.duration_minutes || null),
    vehicle_type: vehicleType, base_rate: round2(baseCost), fuel_surcharge: round2(fuelCost), toll_charges: round2(tollCost),
    driver_allowance: round2(driverAllowance), additional_charges: round2(weightSurcharge + crossBorderCost + serviceCharge),
    total_amount: round2(total), margin_percentage: marginPct, notes, status, confidence: "MEDIUM",
    sla_hours: Number(companyProfile?.default_sla_hours) || 48, valid_until: validUntil, trip_type: tripType,
    win_probability: opt?.win_probability_at_optimal != null ? Math.round(opt.win_probability_at_optimal * 100) : null,
  });

  // ---- auto-save DB draft once substantive (debounced) ----
  const dbRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same "flush on real unmount" pattern as the localStorage draft above —
  // without it, filling in the form and immediately navigating away (within
  // the 1.5s debounce window) cancelled the pending save instead of firing
  // it, so the quote was never actually written to the database at all.
  const dbFlushRef = useRef<((isFlush: boolean) => void) | null>(null);
  const substantive = ready && total > 0;
  useEffect(() => {
    // Autosave a brand-new quote, or one we created this session (createdRef).
    // A pre-existing quote opened for editing saves explicitly, not on every keystroke.
    if (isEditing && !createdRef.current) return;
    if (!substantive) return;
    // Billing blocked: POST/PATCH /quotes/ would just 402 anyway (matches
    // PlanLimitsMiddleware) — don't fire it at all rather than fail silently
    // in the background on every keystroke.
    if (billingBlocked) return;
    if (dbRef.current) clearTimeout(dbRef.current);
    const doSave = async (isFlush: boolean) => {
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
            // A flush-on-unmount save means the user is already navigating
            // somewhere else on their own — redirecting them back to this
            // quote's edit URL would fight that. Still save, just don't redirect.
            if (!isFlush) navigate(`/bookings/quotes/${res.id}/edit`, { replace: true });
          }
          creatingRef.current = false;
        }
        setLastSavedAt(new Date());
      } catch { creatingRef.current = false; /* silent — localStorage still holds it */ }
    };
    dbFlushRef.current = doSave;
    dbRef.current = setTimeout(() => { dbFlushRef.current = null; doSave(false); }, 1500);
    return () => { if (dbRef.current) clearTimeout(dbRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substantive, total, customerId, vehicleType, pickup, delivery, tollCost, driverAllowance, serviceCharge, billingBlocked]);

  // True unmount only (empty deps) — flushes whatever save is still pending
  // the instant the user actually leaves the page.
  useEffect(() => {
    return () => { dbFlushRef.current?.(true); };
  }, []);

  // ---- explicit save / send ----
  const save = async (send: boolean) => {
    if (!customerId) { toast.error("Pick a client first"); return; }
    if (!ready) { toast.error("Add vehicle type, collection, delivery and weight"); return; }
    if (routeBlockedMessage) { toast.error(routeBlockedMessage); return; }
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

  // ---- map click-to-pick ----
  const handleMapClick = (point: { lat: number; lon: number; label: string }) => {
    if (pickMode === "pickup") {
      setPickup(point.label); setPickupCoords({ lat: point.lat, lon: point.lon });
      if (!deliveryCoords) setPickMode("delivery");
    } else if (pickMode === "delivery") {
      setDelivery(point.label); setDeliveryCoords({ lat: point.lat, lon: point.lon });
      if (!pickupCoords) setPickMode("pickup");
    } else {
      // pickMode is a stop's id
      updateStop(pickMode, { location: point.label, coords: { lat: point.lat, lon: point.lon } });
    }
  };

  // ---- map panel (shared between the inline card and the expanded modal) ----
  const renderMapPanel = (height: number, expandButton?: React.ReactNode) => (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
          <Map size={13} />
          {pickupCoords && deliveryCoords
            ? "Double-click the map to move a pin, or search above"
            : <>Double-click the map to set <b style={{ color: "var(--text-secondary)" }}>{pickMode === "pickup" ? "collection" : "delivery"}</b></>}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setPickMode("pickup")}
            style={{ height: 24, display: "inline-flex", alignItems: "center", fontSize: 11, fontFamily: "var(--font-mono)", padding: "0 8px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${pickMode === "pickup" || pickupCoords ? "#16a34a" : "var(--border-subtle)"}`,
              background: pickMode === "pickup" ? "color-mix(in srgb, #16a34a 12%, transparent)" : "transparent",
              color: pickMode === "pickup" || pickupCoords ? "#16a34a" : "var(--text-tertiary)" }}>
            Collection
          </button>
          {stops.map((stop, i) => (
            <StopPickPill key={stop.id} index={i} active={pickMode === stop.id} filled={!!stop.coords}
              onSelect={() => setPickMode(stop.id)} onRemove={() => removeStop(stop.id)} />
          ))}
          {pickupCoords && deliveryCoords && (
            <button type="button" onClick={addStop} title="Add stop"
              style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: 4, cursor: "pointer", flexShrink: 0,
                border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--accent-primary)" }}>
              <Plus size={13} />
            </button>
          )}
          <button onClick={() => setPickMode("delivery")}
            style={{ height: 24, display: "inline-flex", alignItems: "center", fontSize: 11, fontFamily: "var(--font-mono)", padding: "0 8px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${pickMode === "delivery" || deliveryCoords ? "#dc2626" : "var(--border-subtle)"}`,
              background: pickMode === "delivery" ? "color-mix(in srgb, #dc2626 12%, transparent)" : "transparent",
              color: pickMode === "delivery" || deliveryCoords ? "#dc2626" : "var(--text-tertiary)" }}>
            Delivery
          </button>
          {expandButton}
        </div>
      </div>
      <RouteMapView pickup={pickup} delivery={delivery} pickupCoords={pickupCoords} deliveryCoords={deliveryCoords} height={height}
        onMapClick={handleMapClick}
        stops={stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lon: s.coords!.lon, label: s.location }))}
        geometry={route?.geometry && route.geometry.length > 1
          ? route.geometry.map(p => [p.lat, p.lon] as [number, number])
          : undefined} />
      {/* Stops — optional intermediate points between Collection and Delivery,
          actually routed through (RouteCalculatorView chains them into the
          TomTom call) and reflected in distance/fuel/toll/base-rate. Right
          below the map, only once both locations are set: a plain
          "+ Add stop" trigger until the first stop exists, at which point
          the trigger is replaced by a collapsible header + the stop list. */}
      {pickupCoords && deliveryCoords && (
        <div style={{ padding: "10px", borderTop: "1px solid var(--border-subtle)" }}>
          {stops.length === 0 ? (
            <button type="button" onClick={addStop}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, color: "var(--accent-primary)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              <Plus size={12} /> Add stop
            </button>
          ) : (
            <div>
              <div onClick={() => setStopsExpanded(v => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", marginBottom: stopsExpanded ? 8 : 0 }}>
                <span style={{ ...labelS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stops.length} stop{stops.length > 1 ? "s" : ""}
                  {!stopsExpanded && ` — ${stops.map(s => s.location || "…").join(" → ")}`}
                </span>
                {stopsExpanded ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
              </div>

              {stopsExpanded && (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 1, background: "var(--border-subtle)" }} />

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-surface)", border: "2px solid #16a34a", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>{pickup || "Collection"}</span>
                  </div>

                  <DndContext sensors={stopSensors} onDragEnd={handleStopDragEnd}>
                    <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {stops.map((stop, i) => (
                        <SortableStopRow
                          key={stop.id}
                          stop={stop}
                          index={i}
                          inputStyle={{ ...inputS, fontSize: 12, fontFamily: "var(--font-sans)", padding: "7px 10px" }}
                          onLocationChange={(v, c) => updateStop(stop.id, { location: v, coords: c || null })}
                          onRemove={() => removeStop(stop.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  <button type="button" onClick={addStop} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: "0 0 10px 28px", color: "var(--accent-primary)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                    <Plus size={12} /> Add stop
                  </button>

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-surface)", border: "2px solid #dc2626", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>{delivery || "Delivery"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
      {/* Once stops are involved, TomTom returns exactly one route (no
          alternatives — see RouteCalculatorView._route) — a single summary
          instead of the picker above, so the UI is honest about there being
          only one option rather than silently showing nothing. */}
      {routeData?.routes?.length === 1 && (routeData.stops_count ?? stops.length) > 0 && (
        <div style={{ padding: 10, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--status-success-bg)", border: "1px solid var(--accent-primary)", borderRadius: 4 }}>
            <Map size={13} color="var(--accent-primary)" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--accent-primary)" }}>
              Route via {routeData.stops_count ?? stops.length} stop{(routeData.stops_count ?? stops.length) > 1 ? "s" : ""} · {Math.round(routeData.routes[0].distance_km)} km · {formatDuration(routeData.routes[0].duration_minutes)}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
            Alternative routes aren't available once stops are added.
          </div>
        </div>
      )}
    </>
  );

  // ---- styles ----
  const cardS: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 4, boxShadow: "var(--shadow-card)" };
  const labelS: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" };
  // Marks a field required for the cost calculation to run (see `ready`).
  const Req = () => <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "var(--status-danger)", marginLeft: 5, verticalAlign: "middle" }} />;
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
          <button onClick={startNew} title="Clear every field and start a fresh quote (this one stays saved)"
            style={{ fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--accent-primary)", border: "1px solid var(--accent-primary)", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>
            Clear &amp; New Quote
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

      {/* NL input — typed or voice */}
      <div style={{ ...cardS, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 14, background: "var(--bg-surface-hover)", minHeight: 44 }}>
        {voice.recording ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-danger)", flexShrink: 0, animation: "pulse-dot 1s infinite" }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 32 }}>
              {voice.levels.map((h, i) => (
                <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: "var(--accent-primary)" }} />
              ))}
            </div>
            <button onClick={voice.stop} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, background: "var(--status-danger)", color: "#fff", border: "none", borderRadius: 4, padding: "7px 14px", cursor: "pointer" }}>
              <Square size={12} fill="#fff" /> Stop
            </button>
          </>
        ) : voice.transcribing ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-tertiary)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="8" cy="8" r="6" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
            Transcribing…
          </div>
        ) : (
          <>
            <MessageCircle size={16} color="var(--text-tertiary)" />
            <input value={nlText} onChange={e => setNlText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitNL()}
              placeholder="Describe it — “20t steel, JHB to Cape Town, flatbed, Tuesday”" style={{ ...inputS, border: "none", background: "transparent" }} />
            <button type="button" onClick={voice.start} title="Record voice"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--accent-primary)", cursor: "pointer", flexShrink: 0, padding: 0 }}>
              <Mic size={14} />
            </button>
            <button onClick={() => submitNL()} disabled={nlBusy || !nlText.trim()} style={{ fontSize: 13, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "7px 14px", cursor: "pointer", opacity: nlText.trim() ? 1 : 0.5 }}>{nlBusy ? "Reading…" : "Fill"}</button>
          </>
        )}
      </div>

      {/* 1 — inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ ...labelS, marginBottom: 5, display: "flex", justifyContent: "space-between" }}><span>Client<Req /></span><span onClick={() => navigate("/customers")} style={{ color: "var(--accent-primary)", cursor: "pointer" }}>+ New</span></div>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={inputS}>
            <option value="">Select client…</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5, display: "flex", justifyContent: "space-between" }}><span>Vehicle type<Req /></span><span onClick={() => navigate("/fleet/vehicles")} style={{ color: "var(--accent-primary)", cursor: "pointer" }}>+ New</span></div>
          <select value={vehicleType} onChange={e => applyVehicleType(e.target.value)} style={inputS}>
            <option value="">Select…</option>
            {vehicleTypes.map((v: any) => <option key={v.id || v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5 }}>Collection<Req /></div>
          <LocationInput value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c || null); }} placeholder="City / address" style={inputS} />
        </div>
        <div>
          <div style={{ ...labelS, marginBottom: 5 }}>Delivery<Req /></div>
          <LocationInput value={delivery} onChange={(v, c) => { setDelivery(v); setDeliveryCoords(c || null); }} placeholder="City / address" style={inputS} />
        </div>
      </div>

      {/* Early heads-up the moment a picked location is outside SA, before the
          rest of the form is even filled in — the real enforcement (blocking
          the actual quote) only happens once /route/calculate runs, see
          routeBlockedMessage below. This just avoids the user filling out the
          whole form before finding out. */}
      {companyProfile?.allow_cross_border === false && (isForeignCountry(pickupCoords?.country_code) || isForeignCountry(deliveryCoords?.country_code)) && (
        <div style={{ ...cardS, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 12, borderColor: "var(--status-warning)", background: "var(--status-warning-bg)" }}>
          <Info size={14} color="var(--status-warning)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            This location is outside South Africa, but your company isn't set up for cross-border routes (Settings → Company Details). This quote will be refused once calculated — pick a domestic location or ask an admin to enable cross-border routes.
          </span>
        </div>
      )}

      {/* details (collapsible) */}
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => setShowDetails(s => !s)} style={{ ...labelS, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>{showDetails ? "▾" : "▸"} Details · weight, dates, trip type</button>
        {showDetails && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }}>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Weight (t)<Req /></div><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 15" style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Pickup date</div><input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Delivery date</div><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={inputS} /></div>
            <div><div style={{ ...labelS, marginBottom: 5 }}>Valid until</div><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inputS} /></div>
            <div style={{ gridColumn: "span 2" }}><div style={{ ...labelS, marginBottom: 5 }}>Cargo</div><input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="e.g. palletised steel" style={inputS} /></div>
            <div style={{ gridColumn: "span 2" }}><div style={{ ...labelS, marginBottom: 5 }}>Trip</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ONE_WAY", "ROUND_TRIP"] as const).map(t => <button key={t} onClick={() => setTripType(t)} style={{ ...inputS, width: "auto", flex: 1, cursor: "pointer", background: tripType === t ? "var(--accent-primary)" : "var(--input-bg)", color: tripType === t ? "var(--btn-action-color)" : "var(--text-secondary)", fontSize: 12 }}>{t === "ONE_WAY" ? "One way" : "Round"}</button>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2 — map + cost */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ ...cardS, overflow: "hidden" }}>
            {renderMapPanel(300, (
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" title="Expand map"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 4, cursor: "pointer",
                      border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)" }}>
                    <Maximize2 size={12} />
                  </button>
                </DialogTrigger>
                <DialogContent style={{ ...cardS, width: "min(1100px, 92vw)", padding: 0 }}>
                  {renderMapPanel(560)}
                </DialogContent>
              </Dialog>
            ))}
          </div>
          <div style={{ ...cardS, padding: "14px 16px" }}>
            <div style={{ ...labelS, marginBottom: 8 }}>Cost breakdown · {vehicleType || "—"}</div>
            {billingBlocked && (
              <div style={{
                padding: 14, marginBottom: ready ? 14 : 0, borderRadius: 6,
                background: "var(--status-danger-bg)", border: "1px solid var(--status-danger)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-danger)", marginBottom: 4 }}>
                  Quoting is blocked
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                  {subscriptionStatusDetail(authUser?.subscription_status)}
                </div>
                <button
                  onClick={() => navigate("/settings/billing")}
                  className="btn-action"
                  style={{ fontSize: 12 }}
                >
                  GO TO BILLING
                </button>
              </div>
            )}
            {!billingBlocked && !ready && (
              <div style={{ padding: "30px 4px", textAlign: "center", color: "var(--text-tertiary)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add a client, vehicle type, collection, delivery and weight</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Costs and the AI quote appear here automatically.</div>
              </div>
            )}
            {!billingBlocked && ready && routeBlockedMessage && (
              <div style={{ padding: "20px 4px" }}>
                <div style={{ fontSize: 13, color: "var(--status-danger)", fontWeight: 600, marginBottom: 6 }}>Route not allowed</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{routeBlockedMessage}</div>
              </div>
            )}
            {!billingBlocked && ready && !routeBlockedMessage && calculatingRoute && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Calculating route…</div>}
            {!billingBlocked && ready && !routeBlockedMessage && !calculatingRoute && (<>
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
                    {r.key === "cb" && (() => {
                      const border = routeData?.additional_costs?.border_fees || 0;
                      const weighbridge = routeData?.additional_costs?.weighbridge_fees || 0;
                      const nonSaTolls = routeData?.additional_costs?.non_sa_tolls || 0;
                      const cbRows = [
                        { label: "Border fees", v: border },
                        { label: "Weighbridge fees", v: weighbridge },
                        { label: "Non-SA tolls", v: nonSaTolls },
                      ].filter(row => row.v > 0);
                      const cbOneWayTotal = border + weighbridge + nonSaTolls;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" title="Cross-border breakdown"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "var(--bg-surface-hover)", color: "var(--text-tertiary)", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                              <Info size={11} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" style={{ width: 260, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: 12, fontSize: 12, color: "var(--text-primary)" }}>
                            <div style={{ ...labelS, marginBottom: 8 }}>
                              Cross-border charges{routeData?.countries?.length ? ` · crosses ${routeData.countries.join("→")}` : ""}
                            </div>
                            {cbRows.length === 0 ? (
                              <div style={{ color: "var(--text-tertiary)" }}>No itemised breakdown available for this route.</div>
                            ) : (<>
                              {cbRows.map((row, ri) => (
                                <div key={ri} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-row)" }}>
                                  <span>{row.label}</span>
                                  <span style={{ fontFamily: "var(--font-mono)", flexShrink: 0 }}>{formatCurrency(row.v)}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                                <span>One way total</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(cbOneWayTotal)}</span>
                              </div>
                              {legs === 2 && <div style={{ color: "var(--text-tertiary)", marginTop: 4 }}>× 2 for round trip = {formatCurrency(cbOneWayTotal * 2)}</div>}
                            </>)}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
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

      {/* 3 — AI quote */}
      {!billingBlocked && ready && !routeBlockedMessage && total > 0 && (
        <div style={{ ...cardS, border: "1px solid color-mix(in srgb, var(--accent-primary) 35%, var(--border-subtle))", marginBottom: 14 }}>
          {/* still learning — shown first, above the price block, while under the outcome threshold */}
          {aiLearning && (
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-row)", background: "var(--status-warning-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <Sparkles size={16} color="var(--status-warning)" style={{ flexShrink: 0 }} />
                <div><b>AI pricing is still learning your fleet.</b><span style={{ color: "var(--text-secondary)" }}> Priced on true cost + your {vehicleType} base rate for now. Every quote you close sharpens it.</span></div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                  {winModel.outcomes_collected}/{winModel.outcomes_needed} <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>logged</span>
                </div>
                <div style={{ marginTop: 4, width: 110, height: 5, borderRadius: 3, background: "var(--bg-surface-hover)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.round((winModel.outcomes_collected / winModel.outcomes_needed) * 100))}%`, background: "var(--status-warning)" }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr" }}>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>{aiLearning ? "Suggested price" : "Recommended price"}</div>
              {aiLoading ? aiSpinner : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: aiLearning ? undefined : "var(--accent-primary)", marginTop: 4 }}>{suggestedPrice ? formatCurrency(suggestedPrice) : formatCurrency(total)}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{aiLearning ? "true cost + 25%" : "to this client"}</div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>Margin</div>
              {aiLoading ? aiSpinner : aiLearning ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>Unlocks after training</div>
              ) : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>{opt?.optimal_margin_pct ? `${Math.round(opt.optimal_margin_pct)}%` : `${marginPct}%`}</div>
                <div style={{ fontSize: 12, color: "var(--status-success)", marginTop: 2 }}>{formatCurrency(opt?.expected_profit ?? ((suggestedPrice || total) - directCost))} profit</div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border-row)" }}>
              <div style={labelS}>Win probability</div>
              {aiLoading ? aiSpinner : aiLearning ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>Unlocks after training</div>
              ) : (<>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>{opt?.win_probability_at_optimal != null ? `${Math.round(opt.win_probability_at_optimal * 100)}%` : "—"}</div>
                <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "var(--bg-surface-hover)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round((opt?.win_probability_at_optimal || 0) * 100)}%`, background: "var(--accent-primary)" }} /></div>
              </>)}
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={labelS}>Profit sweet-spot</div>
              {aiLoading ? aiSpinner : aiLearning ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>Unlocks after training</div>
              ) : curveData.length > 1 ? (
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

          {/* actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--border-row)" }}>
            {!aiLoading && suggestedPrice != null && suggestedPrice > 0 && !alreadyApplied && <button onClick={applyOptimal} style={{ fontSize: 14, fontWeight: 500, background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", borderRadius: 4, padding: "9px 14px", cursor: "pointer" }}>Apply recommended</button>}
            {!aiLoading && alreadyApplied && (
              <>
                <span style={{ fontSize: 13, color: "var(--status-success)" }}>✓ AI price applied</span>
                <button onClick={cancelAiPrice} style={{ fontSize: 14, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Use actual price</button>
              </>
            )}
            <button onClick={() => save(true)} disabled={saving} style={{ fontSize: 14, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Send quote to client</button>
            <button onClick={() => save(false)} disabled={saving} style={{ fontSize: 14, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Save as draft</button>
            {benchmark?.market_avg_rate ? <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text-tertiary)" }}>Benchmark: {formatCurrency(benchmark.market_avg_rate)} avg · {benchmark.recommendation || ""}</span> : null}
          </div>
        </div>
      )}

      {/* notes */}
      {ready && <div style={{ marginBottom: 40 }}><div style={{ ...labelS, marginBottom: 5 }}>Notes (optional)</div><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything for the client or your team…" style={{ ...inputS, resize: "vertical" }} /></div>}

      <AIChatPanel messages={chatMessages} busy={nlBusy} open={chatOpen} onOpenChange={setChatOpen} onSend={(t, lang) => submitNL(t, lang)} />
    </div>
  );
}
