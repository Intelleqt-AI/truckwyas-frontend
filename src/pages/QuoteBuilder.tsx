import "@/components/layout/section-header.css";
import SectionHeader from "@/components/layout/SectionHeader";
import "./quote-invoice-roles.css";
import { localDateISO } from '@/lib/dates';
import "./quote-builder-controls.css";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, patchData, fetchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { formatCurrency, formatMoneyWhole, formatNumber, formatDateTime, normaliseFigures, sentenceCaseLabel } from "@/lib/formatters";
import { DatePicker } from "@/components/ui/date-picker";
import { resolveDieselPrice, dieselBasisNote, liveDieselHint } from "@/lib/dieselPrice";
import { LocationInput, type LocationCoords } from "@/components/LocationInput";
import { RouteMapView } from "@/components/RouteMapView";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AIChatPanel, type ChatMessage } from "@/components/AIChatPanel";
import { useAuth } from "@/lib/AuthContext";
import { isSubscriptionBlocked, subscriptionStatusDetail } from "@/lib/subscriptionStatus";
import { MessageCircle, Map, Info, Maximize2, Mic, Square, X, Plus, GripVertical, ChevronDown, ChevronUp, Check, AlertTriangle } from "lucide-react";
import { formatRand } from "@/lib/pricing";
import { PricingPanel, lkTone, likelihoodShort, signedPct, wayOutChoice, type PricingPhase } from "@/components/pricing/PricingPanel";
import { usePricingAnalysis } from "@/components/pricing/usePricingAnalysis";
import { readPrice, pricingDecision, rowLikelihoods } from "@/components/pricing/evaluate";
import { NumberField } from "@/components/pricing/NumberField";
import type { ChoiceKey, PricingInputs } from "@/components/pricing/types";
import "@/components/pricing/quote-builder-pricing.css";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader } from "@/components/Loader";
import QuoteSendPreview from "@/components/QuoteSendPreview";

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
// Market figures applied by the former market price check. Quotes saved with
// them reopen with them (route_snapshot), and the cost lines offer a way back.
type AiFuel = { pricePerL: number; fuelType: string };
type AiToll = { oneWay: number; routeKey: string };
const FUEL_FALLBACK: Record<string, number> = {
  Flatbed: 32, Tautliner: 33, Refrigerated: 38, Tanker: 35, "Box Truck": 28, "Danger Load": 34,
};
// VehicleType.capacity is *documented* as tonnes but real rows are a mix —
// only the seeded defaults were unit-fixed, so hand-added and imported rows
// can still be kilograms. Same >999 => kg heuristic the backend uses
// (core/services/vehicle_types.py capacity_tonnes), so a 20000 kg row doesn't
// get read as a 20,000-tonne truck when we pick a reference for the load.
const CARGO_CLASSES: { key: string; label: string; typeRe: RegExp; cargoRe: RegExp }[] = [
  { key: "tanker", label: "liquid and bulk",
    typeRe: /tanker|bowser|bulk/i,
    cargoRe: /fuel|diesel|petrol|oil|chemical|liquid|milk|water|acid|lpg|gas|slurry|molasses/i },
  { key: "reefer", label: "temperature-controlled",
    typeRe: /reefer|refriger|chill|frozen|cold/i,
    cargoRe: /frozen|chilled|refrigerat|perishable|fresh|meat|dairy|produce|vaccine|ice ?cream/i },
  { key: "livestock", label: "livestock",
    typeRe: /livestock|cattle|animal/i,
    cargoRe: /livestock|cattle|sheep|goat|pig|poultry|animal/i },
  { key: "car", label: "vehicles",
    typeRe: /car ?carrier|vehicle ?carrier|transporter/i,
    cargoRe: /cars?|vehicles?|bakkies?|tractors?/i },
  { key: "hazmat", label: "dangerous goods",
    typeRe: /danger|hazmat|explosive/i,
    cargoRe: /danger|hazard|explosive|flammable|toxic|corrosive/i },
];
/** Which cargo class a vehicle type is built for; "general" = carries anything. */
function typeCargoClass(name: string) {
  return CARGO_CLASSES.find((c) => c.typeRe.test(name || ""))?.key ?? "general";
}
/** What the user typed in Cargo, read as a class; "general" when it says nothing specific. */
function describedCargoClass(text: string) {
  return CARGO_CLASSES.find((c) => c.cargoRe.test(text || ""))?.key ?? "general";
}
function cargoClassLabel(key: string) {
  return CARGO_CLASSES.find((c) => c.key === key)?.label ?? "general freight";
}
const KG_SCALE_THRESHOLD = 999;
const MIN_PLAUSIBLE_T = 0.3, MAX_PLAUSIBLE_T = 80;
function capacityTons(raw: any): number | null {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return null;
  const t = v > KG_SCALE_THRESHOLD ? v / 1000 : v;
  return t >= MIN_PLAUSIBLE_T && t <= MAX_PLAUSIBLE_T ? t : null;
}
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
      <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-raised)", color: "var(--text-primary)", boxShadow: "inset 0 0 0 1px var(--border-default)", fontSize: 11, fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {index + 1}
      </span>
      <span {...attributes} {...listeners} title="Drag to reorder"
        style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: "var(--text-tertiary)", flexShrink: 0, touchAction: "none" }}>
        <GripVertical size={14} />
      </span>
      <div className="qb-loc" style={{ flex: 1, minWidth: 0 }}>
        <LocationInput value={stop.location} onChange={onLocationChange} placeholder="Stop location" style={inputStyle} />
      </div>
      <button type="button" onClick={handleRemoveClick} title="Remove stop"
        onMouseEnter={() => setHoverRemove(true)} onMouseLeave={() => setHoverRemove(false)}
        style={{
          width: 20, height: 20, marginTop: 6, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center", border: "none",
          background: hoverRemove ? "var(--status-danger-bg)" : "transparent",
          color: "var(--status-danger-text, var(--status-danger))", cursor: "pointer", flexShrink: 0,
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
      <button type="button" onClick={onSelect} aria-pressed={active} aria-label={`Stop ${index + 1}`}
        className={`tw-seg__opt${active ? " is-active" : ""}`} style={{ minWidth: 28, fontVariantNumeric: "tabular-nums" }}>
        <span className={`qb-pin qb-pin--stop${filled ? " is-set" : ""}`} aria-hidden="true" />
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
  road_type?: string; motorway_pct?: number; traffic_status?: string; congested_km?: number; terrain?: string[];
  fuel_usage_litres?: number; country_codes?: string[];
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
  // Named line items — each border charge, the amortised SA permit, each
  // country's weighbridge and tolls. A sibling of additional_costs, not a key
  // inside it: that dict is summed server-side, so a list in there breaks the
  // whole route calculation. Absent on route responses cached before this.
  cross_border_breakdown?: { type: string; description: string; amount: number }[];
  toll_breakdown?: TollBreakdownItem[]; warnings?: string[];
  origin_resolved?: string; dest_resolved?: string;
  stops_count?: number;
}

// ---- display-only formatting (render strings only; never read back into
// state or any calculation) ----
/** Vehicle capacity at render: "20 t", "7,5 t" (house style, not "20.00t"). */
const capLabel = (c: unknown) => `${formatNumber(Number(c), { maximumFractionDigits: 1 })}\u00a0t`;
/** One-decimal figure in house style: "32,6". */
const oneDp = (n: number) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** True below a width (presentation only: picks a shorter placeholder). */
function useNarrow(maxPx: number) {
  const q = `(max-width: ${maxPx}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return narrow;
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
  // Every demo visitor logs into the same shared demo@truckwys.com account,
  // but each login gets its own session-scoped quote allowance server-side
  // (core/views.py QuoteViewSet.create) — this just avoids the visitor
  // filling out the whole form before finding out THEIR session used it.
  const isDemoQuotaExceeded = !!(authUser?.is_demo && authUser?.demo_quote_used);

  // ---- core inputs ----
  const [customerId, setCustomerId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [delivery, setDelivery] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState<LocationCoords | null>(null);

  // ---- intermediate stops: routed through (RouteCalculatorView) and saved
  // with the quote (buildPayload `stops`) ----
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
    const d = new Date(); d.setDate(d.getDate() + 7); return localDateISO(d);
  });
  // Which field the next map click fills. Auto-advances to the empty one so a
  // "click collection, click delivery" flow needs no manual toggling — but stays
  // user-controlled via the pills so either point can be re-picked later.
  // "pickup" | "delivery" | a stop's id — which target the next map
  // double-click sets.
  const [pickMode, setPickMode] = useState<string>("pickup");

  // ---- pricing overrides ----
  // Raw text, not a number — mirrors driverAllowanceInput below. Binding the
  // input to a derived number instead means Number('') coerces to 0 the
  // instant the field is cleared, so the box snaps straight back to showing
  // "0" and the user can never see it empty while typing.
  const [editableTollCost, setEditableTollCost] = useState("");
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
  // True once the user typed a driver allowance (or a saved quote had one).
  // Until then the pricing analysis prefills the approved allowance × nights.
  const [driverEdited, setDriverEdited] = useState(false);
  // Pricing analysis: empty-return toggle (null = the company's default).
  const [includeReturn, setIncludeReturn] = useState<boolean | null>(null);
  const [baseRatePerKm, setBaseRatePerKm] = useState("10");
  const [serviceCharge, setServiceCharge] = useState(0);
  // Market fuel price applied from the AI price panel. Tied to the fuel type
  // it was verified for, so switching to a truck on another fuel falls back
  // to the company price instead of pricing petrol at a diesel rate.
  const [aiFuel, setAiFuel] = useState<AiFuel | null>(null);
  // AI-verified toll total, stored per ONE-WAY leg and tied to the route and
  // truck it was verified for: a round trip doubles it, and a different route
  // or vehicle falls back to that route's own tolls instead of keeping the
  // old plazas. (Typing in Tolls still pins the field, as before.)
  const [aiToll, setAiToll] = useState<AiToll | null>(null);
  // A saved quote priced with the pricing analysis reopens at the price that
  // was decided (pricing_decision.final_price), applied once its route is in.
  const savedFinalPriceRef = useRef<number | null>(null);

  // ---- computed / async state ----
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  // The last route calculation failed — the AI panel says so instead of
  // waiting forever on "Preparing…".
  const [routeError, setRouteError] = useState(false);
  // Set when the backend's cross-border company-policy gate refuses this
  // route (RouteCalculatorView) — shown in place of the cost breakdown.
  const [routeBlockedMessage, setRouteBlockedMessage] = useState<string | null>(null);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  // Persistent AI conversation — every message and reply lands here (see
  // AIChatPanel) instead of a one-shot toast with no way to reply to it.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  // Presentation only: where the assistant's launcher button is placed. It is
  // an ordinary icon button in the Describe bar, and moves into the price bar
  // while that bar shows, so it never floats over a field or the bar.
  // The slot is picked in a passive effect (same pass as the other mount
  // effects), and the Describe bar's slot reserves its box, so the launcher
  // arriving never moves anything.
  const nlChatSlotRef = useRef<HTMLSpanElement | null>(null);
  const barChatSlotRef = useRef<HTMLSpanElement | null>(null);
  const [chatSlot, setChatSlot] = useState<HTMLSpanElement | null>(null);
  useEffect(() => { setChatSlot(barChatSlotRef.current ?? nlChatSlotRef.current); });
  // Presentation only (R10): the in-page map is 50px shorter while the
  // "+ Add stop" row shows, so the map card stays close to the cost card's
  // height instead of ending ~80px below it. Leaflet only
  // re-measures on a window resize, so nudge it after the height changes
  // (before the async route draw fits the view).
  const inlineMapH = pickupCoords && deliveryCoords && stops.length === 0 ? 250 : 300;
  useEffect(() => {
    const r = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(r);
  }, [inlineMapH]);
  const narrowNl = useNarrow(640);
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

  // ---- reference data ----
  const { data: companyProfile } = useQuery({ queryKey: ["company-profile"], queryFn: () => fetchData("api/v1/company/profile/") });
  const { data: customersRaw } = useQuery({ queryKey: ["customers"], queryFn: () => fetchData("api/v1/customers/") });
  const { data: vehicleTypesRaw } = useQuery({ queryKey: ["vehicle-types"], queryFn: () => fetchData("api/v1/vehicle-types/") });
  // Live diesel for the company's fuel zone. A failure just means no live
  // price (the company setting is used, as before) — never blocks the quote.
  const { data: liveFuel } = useQuery({ queryKey: ["fuel-price-current"], queryFn: () => fetchData("api/v1/fuel-prices/current/").catch(() => null), staleTime: 10 * 60 * 1000 });

  const customers: any[] = customersRaw?.results || customersRaw || [];
  // Available types, de-duplicated by name (the fleet can have several vehicles of one type).
  const vehicleTypes: any[] = Object.values(
    (vehicleTypesRaw?.results || vehicleTypesRaw || [])
      .filter((v: any) => (v.available_vehicle_count ?? 1) > 0)
      .reduce((acc: Record<string, any>, v: any) => { if (!acc[v.name]) acc[v.name] = v; return acc; }, {})
  );
  // Every type the company has on file, de-duplicated by name and NOT filtered
  // by what happens to be free today. `vehicleTypes` above is the dropdown's
  // list (availability-gated); this one exists purely to price a load, where a
  // truck that is on the road right now is still the truck that will run it.
  const allVehicleTypes: any[] = Object.values(
    (vehicleTypesRaw?.results || vehicleTypesRaw || [])
      .reduce((acc: Record<string, any>, v: any) => { if (!acc[v.name]) acc[v.name] = v; return acc; }, {})
  );

  const selectedVT = useMemo(() => vehicleTypes.find((v: any) => v.name === vehicleType), [vehicleTypes, vehicleType]);
  // Fuel price is keyed by the SELECTED vehicle type's fuel type, not always
  // Diesel. Non-diesel types use the company's per-fuel-type default.
  const fuelType = selectedVT?.fuel_type || 'Diesel';
  const companyFuelPriceField = (FUEL_PRICE_FIELD_BY_TYPE as Record<string, string>)[fuelType] || 'fuel_price_per_litre';
  // Diesel: the live price for the company's zone, unless the fleet has set
  // its own price (anything other than the untouched 23.50 model default) —
  // see src/lib/dieselPrice.ts. Other fuel types are unchanged.
  const isDieselPricing = companyFuelPriceField === 'fuel_price_per_litre';
  const diesel = resolveDieselPrice({ company: companyProfile, live: liveFuel });
  const companyFuelPricePerL = (isDieselPricing ? diesel.price : null) || Number(companyProfile?.[companyFuelPriceField]) || Number(companyProfile?.fuel_price_per_litre) || 21.7;
  // An applied AI market price overrides the company price for this fuel type.
  const aiFuelActive = !!aiFuel && aiFuel.fuelType === fuelType;
  const fuelPricePerL = aiFuelActive ? aiFuel!.pricePerL : companyFuelPricePerL;
  // Diesel is gazetted per zone (coastal ports vs inland, ~R0.87/L apart), so
  // say which one this price is and where it came from (live / your price).
  // Only diesel is split that way, so the note is omitted for other fuel types.
  // An applied market price says so instead (it is the official FIASA price).
  const fuelZoneNote = aiFuelActive ? ' · official price' : isDieselPricing ? dieselBasisNote(diesel) : '';
  const liveDieselHintText = isDieselPricing && !aiFuelActive ? liveDieselHint(diesel) : null;
  // Which fuel price the quote really uses (the cost card's footnote and the
  // saved route snapshot say the same thing).
  const fuelSourceWord = aiFuelActive ? "official diesel price"
    : isDieselPricing ? (diesel.source === "live" ? "live diesel" : diesel.source === "own" ? "your diesel price" : "company diesel price")
    : `company ${fuelType.toLowerCase()} price`;
  // With no vehicle type picked there is no reference tonnage to scale fuel
  // from, and a flat figure would price a 5t load and a 30t load identically.
  // So infer the truck the load will run on from the load itself: of the types
  // that can legally carry this weight, the one that burns LEAST at it.
  //
  // Picking the smallest type that fits (the obvious rule) is wrong: base
  // consumption isn't ordered by capacity. A 17t reefer burns 42 L/100km — it
  // runs a fridge — against 36 for a 20t flatbed, so a 15t load came out
  // pricier than a 20t one. Across this fleet that rule reversed at six
  // different weights. Choosing the minimum can't reverse: as weight rises
  // each candidate burns more and the candidate set only shrinks, so the
  // result is non-decreasing by construction.
  //
  // Nothing big enough (an abnormal load) extrapolates the largest type rather
  // than dropping to the flat rate, so heavier still means dearer.
  const inferredVT = useMemo(() => {
    if (vehicleType) return null;              // an explicit choice always wins
    const t = Number(weight) || 0;
    if (t <= 0) return null;
    const rated = allVehicleTypes
      .map((v: any) => ({ vt: v, cap: capacityTons(v.capacity) }))
      .filter((x): x is { vt: any; cap: number } => x.cap != null);
    if (!rated.length) return null;
    const burn = (x: { vt: any; cap: number }) =>
      (Number(x.vt.fuel_consumption_l_per_100km) || 32) *
      Math.pow(1 + (Number(x.vt.fuel_consumption_sensitivity_pct) || 2) / 100, t - x.cap);
    const canCarry = rated.filter((x) => x.cap >= t);
    if (!canCarry.length) {
      return rated.sort((a, b) => b.cap - a.cap)[0].vt;   // biggest truck, extrapolated up
    }
    return canCarry.sort((a, b) => burn(a) - burn(b))[0].vt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType, weight, vehicleTypesRaw]);

  // The type the fuel maths is actually based on: the one picked, else the one
  // inferred from the load. Everything else on the quote still treats "no type
  // picked" as exactly that — this only supplies a reference for consumption.
  const fuelBasisVT = selectedVT || inferredVT;

  // What to OFFER the user when they haven't picked a truck: the smallest
  // general-freight type that can carry the load — the one an owner would
  // actually send. Deliberately a different rule from `inferredVT` above,
  // because the two answer different questions. `inferredVT` only estimates
  // fuel and is chosen to never step backwards as the weight changes; this one
  // sets the RATE the moment it's accepted, and "cheapest to run" would put an
  // 8t load on a 28t semi at R30/km instead of a rigid at R18/km.
  //
  // Up to three trucks worth offering for this load, best first.
  //
  // Only types the fleet actually OWNS a vehicle of (owned_vehicle_count), and
  // deliberately NOT `vehicleTypes` (the dropdown's options): those are filtered
  // to a vehicle free *today*, the wrong test for a load running next month.
  //
  // Ranked on cargo suitability first, then tightest capacity. When Cargo names
  // something specific ("diesel", "frozen chicken") the truck built for it wins;
  // when it says nothing, general freight wins because it carries anything and
  // a tanker carries almost nothing. Capacity only breaks ties within a rank,
  // so a 25t tanker never beats a 34t interlink for unspecified cargo.
  const suggestions = useMemo(() => {
    if (vehicleType) return [];                // never second-guess a choice
    const t = Number(weight) || 0;
    if (t <= 0) return [];
    const wanted = describedCargoClass(cargo);
    return allVehicleTypes
      .filter((v: any) => Number(v.owned_vehicle_count) > 0)
      .map((v: any) => ({ vt: v, cap: capacityTons(v.capacity) }))
      .filter((x): x is { vt: any; cap: number } => x.cap != null && x.cap >= t)
      .map((x) => {
        const cls = typeCargoClass(x.vt.name);
        // 0 best. A truck built for the named cargo wins outright; otherwise
        // general freight; a truck built for some *other* cargo ranks last.
        const rank = wanted !== "general"
          ? (cls === wanted ? 0 : cls === "general" ? 1 : 2)
          : (cls === "general" ? 0 : 1);
        return { ...x, cls, rank };
      })
      .sort((a, b) => a.rank - b.rank || a.cap - b.cap)
      .slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType, weight, cargo, vehicleTypesRaw]);

  /** Why this truck is being offered — plain sentences for its info popover. */
  const suggestionReasons = (x: { vt: any; cap: number; cls: string }) => {
    const t = Number(weight) || 0;
    const spare = Math.round((x.cap - t) * 10) / 10;
    const wanted = describedCargoClass(cargo);
    const owned = Number(x.vt.owned_vehicle_count) || 0;
    const burn = (Number(x.vt.fuel_consumption_l_per_100km) || 32) *
      Math.pow(1 + (Number(x.vt.fuel_consumption_sensitivity_pct) || 2) / 100, t - x.cap);
    const out: string[] = [
      spare <= 0
        ? `Rated for ${x.cap}t, an exact fit for this ${t}t load.`
        : `Rated for ${x.cap}t, so it carries this ${t}t load with ${spare}t to spare.`,
    ];
    if (wanted !== "general") {
      out.push(x.cls === wanted
        ? `Built for ${cargoClassLabel(wanted)}, which is what your cargo describes.`
        : x.cls === "general"
          ? `General freight. Your cargo reads as ${cargoClassLabel(wanted)}, so a purpose-built truck would suit it better if you have one.`
          : `Built for ${cargoClassLabel(x.cls)}, not the ${cargoClassLabel(wanted)} your cargo describes. Check before using it.`);
    } else {
      out.push(x.cls === "general"
        ? "General freight, so it carries most cargo."
        : `Built for ${cargoClassLabel(x.cls)}. Describe the cargo above and the ranking will take that into account.`);
    }
    out.push(`You own ${owned} of these.`);
    out.push(`Picking it prices at R${Number(x.vt.base_rate) > 0 ? Number(x.vt.base_rate).toFixed(2) : "—"}/km and about ${burn.toFixed(1)} L/100km for this weight.`);
    return out;
  };

  // A heavier load genuinely burns more fuel — consumption_ref (the type's
  // configured L/100km) is scaled by how far the quote's own weight sits
  // from the type's reference tonnage (its "capacity"), compounding at
  // `sensitivity`%/tonne. See plan/fuel-consumption-by-weight.md. Skipped
  // entirely (falls back to the flat rate) when there is no reference tonnage
  // to scale from — guessing one would be worse than no adjustment at all.
  const fuelConsumptionRef = Number(fuelBasisVT?.fuel_consumption_l_per_100km) || FUEL_FALLBACK[vehicleType] || 32;
  const fuelRefCapacityTons = capacityTons(fuelBasisVT?.capacity) ?? 0;
  const fuelSensitivity = (Number(fuelBasisVT?.fuel_consumption_sensitivity_pct) || 2) / 100;
  const fuelConsumption = fuelRefCapacityTons > 0
    ? fuelConsumptionRef * Math.pow(1 + fuelSensitivity, (Number(weight) || 0) - fuelRefCapacityTons)
    : fuelConsumptionRef;
  // Shown next to the fuel line so the figure is never unexplained: says which
  // truck class it came from when nobody picked one.
  const fuelBasisNote = !vehicleType && inferredVT && fuelRefCapacityTons > 0
    ? " · est. from your fleet"
    : "";

  // Fallback only, for before any vehicle type is picked — once one is
  // selected, applyVehicleType() below takes over and uses that type's own
  // rate instead (Settings > Vehicle Types labels this field "R/km", so it's
  // the more specific, more correct source once it's available).
  useEffect(() => {
    if (companyProfile && !vehicleType) {
      if (Number(companyProfile.default_base_rate_per_km) > 0) {
        setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
      }
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
    const vt = allVehicleTypes.find((v: any) => v.name === name)
      || vehicleTypes.find((v: any) => v.name === name);
    // Compared numerically, not by truthiness: DRF serialises DecimalField to
    // a string, so a type with no rate configured arrives as "0.00" — truthy
    // in JS. Testing the raw value would price the load at R0/km instead of
    // falling back to the company default.
    if (Number(vt?.base_rate) > 0) {
      setBaseRatePerKm(String(vt.base_rate));
    } else if (Number(companyProfile?.default_base_rate_per_km) > 0) {
      setBaseRatePerKm(String(companyProfile.default_base_rate_per_km));
    }
  };

  // Vehicle type is deliberately NOT required. A fleet quoting a load a month
  // out often doesn't know yet which truck will be free, and the owner picks a
  // truck that fits the load when the time comes. Without a type the quote
  // prices on the company defaults (base rate per km, standard consumption)
  // and the capacity check below stays off — see `weightBlockedMessage`.
  const ready = !!(customerId && pickup && delivery && pickupCoords && deliveryCoords && Number(weight) > 0);
  // True only when a specific type was chosen, so the UI can say what a number
  // was actually based on rather than implying a truck that isn't picked.
  const hasVehicleType = !!vehicleType;
  // Display only (R11): one spelling of a truck name across the form, the
  // same sentence case as the suggestions and the quote detail. The stored
  // value (vehicleType, option values) is unchanged.
  const vtLabel = sentenceCaseLabel(vehicleType);

  // ---- derived costs ----
  const route = routeData?.routes?.[selectedRouteIndex] || null;
  // `distance` is always the ONE-WAY lane distance (what the map + route options
  // show, and what we persist). A round trip drives it twice, so distance-based
  // costs multiply by `legs`. Keeping `distance` one-way makes reload math simple:
  // base_rate/(distance×legs) always recovers the per-km rate.
  const distance = route?.distance_km ?? routeData?.distance_km ?? 0;
  const legs = tripType === "ROUND_TRIP" ? 2 : 1;
  const chargeDistance = distance * legs;
  // The price check sends these exact litres and the backend rounds
  // litres × market price, so an applied market fuel price is rounded the same
  // way to land on the rand the panel showed. Every other quote keeps main's
  // formula unchanged.
  const fuelLitres = chargeDistance * fuelConsumption / 100;
  const fuelCost = aiFuelActive
    ? Math.round(fuelLitres * fuelPricePerL)
    : Math.round(chargeDistance * fuelConsumption * fuelPricePerL / 100);
  const tollRate = Number(companyProfile?.default_toll_rate_per_km) || 0.95;
  const autoToll = Math.round((route?.toll_cost_zar ?? routeData?.toll_cost_zar ?? distance * tollRate) * legs);
  const tollBreakdown = route?.toll_breakdown ?? routeData?.toll_breakdown ?? [];
  // The plazas and truck an applied AI toll figure was verified for.
  const tollRouteKey = JSON.stringify([vehicleType, tollBreakdown.map(b => b.plaza)]);
  const aiTollActive = !!aiToll && aiToll.routeKey === tollRouteKey;
  const tollCost = tollManuallyEdited
    ? (Number(editableTollCost) || 0)
    : aiTollActive ? Math.round(aiToll!.oneWay * legs * 100) / 100 : autoToll;
  const tollBreakdownOneWay = tollBreakdown.reduce((s, b) => s + Number(b.tariff), 0);
  const crossBorderCost = ((routeData?.additional_costs?.border_fees || 0) + (routeData?.additional_costs?.weighbridge_fees || 0) + (routeData?.additional_costs?.non_sa_tolls || 0)) * legs;
  const driverAllowance = Number(driverAllowanceInput) || 0;
  const weightKg = (Number(weight) || 0) * 1000;
  // A load can't legally exceed the selected vehicle's rated capacity by more
  // than the Road Traffic Act's 5% tolerance — past that it's an offence, and
  // well past it it's not a chargeable "surcharge", it's a different kind of
  // job (abnormal-load permits, escorts, route approval). No legitimate price
  // bump exists below capacity, so this blocks the quote instead of pricing it.
  // Runs ONLY when a vehicle type is selected: with no type there is no rated
  // capacity to measure against, so there is nothing to enforce. The owner
  // assigns a truck that fits the load later, and the check applies again the
  // moment a type is on the quote.
  const OVERLOAD_TOLERANCE = 1.05; // Road Traffic Act legal tolerance
  const vehicleCapacityTons = Number(selectedVT?.capacity) || 0;
  const weightBlockedMessage = (() => {
    if (!vehicleCapacityTons || Number(weight) <= vehicleCapacityTons) return null;
    if (Number(weight) <= vehicleCapacityTons * OVERLOAD_TOLERANCE) {
      return `${weight}t exceeds the ${vtLabel}'s rated capacity of ${vehicleCapacityTons}t. Even within the legal 5% tolerance this is an overload. Pick a larger vehicle or reduce the weight.`;
    }
    return `${weight}t is well beyond the ${vtLabel}'s ${vehicleCapacityTons}t capacity. This needs an abnormal-load permit (route approval, possibly escorts) and can't be priced through a standard quote.`;
  })();
  const baseRateSource = (() => {
    const v = Number(baseRatePerKm);
    if (!(v > 0)) return null;
    if (hasVehicleType && Number(selectedVT?.base_rate) === v) return `From ${vtLabel}`;
    if (Number(companyProfile?.default_base_rate_per_km) === v) return "From company settings";
    return "Custom rate";
  })();
  const baseCost = Math.round(chargeDistance * Number(baseRatePerKm));
  const total = baseCost + fuelCost + tollCost + crossBorderCost + driverAllowance + serviceCharge;
  // serviceCharge is the price adjustment: whatever the price in the bar is
  // above (or below) the calculated lines. Margin is never read from it; the
  // one margin is price − full cost floor (pricing analysis).

  // ---- route calculation (debounced auto-run) ----
  const calcRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The exact request payload behind the current `routeData` — captured so
  // buildPayload() can save the full request+response pair as route_snapshot
  // at quote-save time, for future ML training. Not React state: nothing
  // ever needs to re-render off this, it's read once at save time.
  const lastRouteRequestRef = useRef<Record<string, unknown> | null>(null);
  // Which inputs the current `routeData` was calculated for (see
  // routeIsCurrent) — so the AI panel never auto-runs on a previous route.
  const lastRouteKeyRef = useRef<string | null>(null);
  const routeReqIdRef = useRef(0);
  const calculateRoute = async () => {
    if (!pickupCoords || !deliveryCoords) return;
    const reqId = ++routeReqIdRef.current;
    setCalculatingRoute(true);
    setRouteBlockedMessage(null);
    try {
      const requestPayload = {
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
      };
      const requestKey = routeRequestKey;
      const data = await postData({ url: "/api/v1/route/calculate/", data: requestPayload });
      if (reqId !== routeReqIdRef.current) return; // a newer calculation superseded this one
      if (data?.success !== false) {
        lastRouteRequestRef.current = requestPayload;
        lastRouteKeyRef.current = requestKey;
        setRouteError(false);
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
        if (reqId === routeReqIdRef.current) setRouteError(true);
        toast.error("Couldn't calculate the route");
      }
    }
    // Only the newest calculation clears the spinner: a superseded one
    // finishing early must not drop it while the newer one is in flight.
    finally { if (reqId === routeReqIdRef.current) setCalculatingRoute(false); }
  };

  // Stable key so the route only recalculates when a stop's actual
  // coordinates change (added/removed/reordered/relocated) — a new array
  // reference on every render would otherwise refire this on every keystroke
  // elsewhere in the form.
  const stopsRouteKey = stops.filter(s => s.coords).map(s => `${s.coords!.lat},${s.coords!.lon}`).join("|");
  // Everything the route calculation depends on (same deps as the effect
  // below). routeIsCurrent: `route` really is the route for these inputs, not
  // a leftover from before an address edit or the distance-only stub an
  // edited quote starts with.
  const routeRequestKey = JSON.stringify([pickupCoords?.lat, pickupCoords?.lon, deliveryCoords?.lat, deliveryCoords?.lon,
    vehicleType || "Flatbed", stopsRouteKey]);
  const routeIsCurrent = !!route && !calculatingRoute && lastRouteKeyRef.current === routeRequestKey;

  useEffect(() => {
    if (!ready || billingBlocked) return;
    if (calcRef.current) clearTimeout(calcRef.current);
    calcRef.current = setTimeout(() => { calculateRoute(); }, 500);
    return () => { if (calcRef.current) clearTimeout(calcRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickupCoords, deliveryCoords, vehicleType, billingBlocked, stopsRouteKey]);

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
      setChatMessages(prev => [...prev, { role: "assistant", text: res?.reply || "Got it. I updated the form.", link: res?.link || undefined }]);
      if (!textOverride) setNlText("");
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "Sorry, I couldn't read that. Try rephrasing or use the fields directly." }]);
    }
    finally { setNlBusy(false); }
  };

  const voice = useVoiceRecorder((text, lang) => { setNlText(text); submitNL(text, lang); });

  // ---- edit mode: load existing quote ----
  useEffect(() => {
    if (!editId) return;
    fetchData(`api/v1/quotes/${editId}/`).then((q: any) => {
      setCustomerId(String(q.customer || ""));
      setPickup(q.pickup_location || ""); setDelivery(q.delivery_location || "");
      if (q.pickup_lat) setPickupCoords({ lat: Number(q.pickup_lat), lon: Number(q.pickup_lng) });
      if (q.delivery_lat) setDeliveryCoords({ lat: Number(q.delivery_lat), lon: Number(q.delivery_lng) });
      if (Array.isArray(q.stops) && q.stops.length > 0) {
        setStops(q.stops.map((s: { location: string; lat: number; lon: number }, i: number) => ({
          id: `saved-${i}`, location: s.location, coords: { lat: s.lat, lon: s.lon },
        })));
        setStopsExpanded(true);
      }
      setVehicleType(q.vehicle_type || ""); setWeight(String((Number(q.weight) || 0) / 1000));
      setCargo(q.cargo_description || ""); setNotes(q.notes || "");
      setDriverAllowanceInput(String(q.driver_allowance || 0));
      setDriverEdited(Number(q.driver_allowance) > 0);
      savedFinalPriceRef.current = Number(q.pricing_decision?.final_price) > 0 ? Number(q.pricing_decision.final_price) : null;
      if (q.toll_charges != null) setEditableTollCost(String(q.toll_charges));
      // An applied AI fuel price and a typed/AI toll figure are the user's
      // choice, so they survive a reload. Route-derived tolls still don't pin
      // (see tollManuallyEdited above).
      const snap = q.route_snapshot || {};
      setAiFuel(["market_check", "ai_market"].includes(snap.fuel_price_source) && Number(snap.fuel_price_per_litre_used) > 0
        ? { pricePerL: Number(snap.fuel_price_per_litre_used), fuelType: snap.fuel_type_used || "Diesel" } : null);
      setTollManuallyEdited(snap.toll_charges_source === "manual" && q.toll_charges != null);
      // Re-applies only while the recalculated route has the same plazas.
      setAiToll(["market_check", "ai_market"].includes(snap.toll_charges_source) && Number(snap.ai_toll_one_way) > 0 && snap.ai_toll_route_key
        ? { oneWay: Number(snap.ai_toll_one_way), routeKey: String(snap.ai_toll_route_key) } : null);
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
      // A price set in the bar was saved inside base_rate; split it back out
      // so the quote reopens explaining itself the same way (rate + adjustment).
      { const adj = Number(q.pricing_decision?.price_adjustment);
        if (Number.isFinite(adj) && Math.abs(adj) >= 0.5 && q.distance && q.base_rate) {
          const loadLegs = q.trip_type === "ROUND_TRIP" ? 2 : 1;
          setBaseRatePerKm(String(Math.round(((Number(q.base_rate) - adj) / (Number(q.distance) * loadLegs)) * 100) / 100));
          setServiceCharge(adj);
        } }
      setSavedQuoteId(Number(editId));
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
    if (d.pickupDate) setPickupDate(d.pickupDate);
    if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
    if (d.validUntil) setValidUntil(d.validUntil);
    if (Array.isArray(d.stops) && d.stops.length) {
      setStops(d.stops.map((st: { location: string; coords: LocationCoords }, i: number) => ({ id: `resumed-${i}`, location: st.location, coords: st.coords })));
      setStopsExpanded(true);
    }
    if (d.tolls != null) { setEditableTollCost(String(d.tolls)); setTollManuallyEdited(true); }
    if (d.driver != null) { setDriverAllowanceInput(String(d.driver)); setDriverEdited(true); }
    // After applyVehicleType above, so a rate typed for this quote wins.
    if (d.baseRatePerKm) setBaseRatePerKm(String(d.baseRatePerKm));
    if (Number(d.priceAdjustment)) setServiceCharge(Number(d.priceAdjustment));
    if (typeof d.includeReturn === "boolean") setIncludeReturn(d.includeReturn);
    setResumable(null);
  };
  const discardResumable = () => { localStorage.removeItem(DRAFT_KEY); setResumable(null); };

  // Blank the form for a brand-new quote. React Router reuses this component
  // across /edit/:id ↔ /new (only the param changes, no remount), so we reset
  // every field explicitly rather than relying on a remount. Also the "Clear
  // & New Quote" button's handler on a not-yet-saved quote — an explicit
  // clear, so dropping the local draft here (like the Resume banner's
  // Discard) is the intended behavior, not data loss.
  const startNew = () => {
    localStorage.removeItem(DRAFT_KEY);
    setSavedQuoteId(null); setLastSavedAt(null); setResumable(null);
    setCustomerId(""); setVehicleType(""); setPickup(""); setDelivery("");
    setPickupCoords(null); setDeliveryCoords(null);
    setStops([]); setPickMode("pickup"); setStopsExpanded(false);
    setWeight(""); setCargo(""); setNotes(""); setTripType("ONE_WAY");
    setPickupDate(""); setDeliveryDate(""); setNlText("");
    setEditableTollCost(""); setTollManuallyEdited(false); setDriverAllowanceInput("0"); setServiceCharge(0);
    setDriverEdited(false); setIncludeReturn(null); savedFinalPriceRef.current = null;
    setRouteError(false);
    setRouteData(null); setSelectedRouteIndex(0); setRouteBlockedMessage(null);
    setAiFuel(null); setAiToll(null);
    lastRouteKeyRef.current = null;
    setChatMessages([]); setChatOpen(false); setPendingEntity(null); setDeclinedEntities([]);
    { const d = new Date(); d.setDate(d.getDate() + 7); setValidUntil(localDateISO(d)); }
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
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType,
          pickupDate, deliveryDate, validUntil, stops: stops.filter(st => st.coords).map(st => ({ location: st.location, coords: st.coords })),
          tolls: tollManuallyEdited ? editableTollCost : null, driver: driverEdited ? driverAllowanceInput : null,
          baseRatePerKm, priceAdjustment: serviceCharge, includeReturn,
        }));
        setLastSavedAt(new Date());
      } catch { /* ignore */ }
    };
    draftFlushRef.current = doSave;
    draftRef.current = setTimeout(() => { draftFlushRef.current = null; doSave(); }, 800);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType,
    pickupDate, deliveryDate, validUntil, stops, tollManuallyEdited, editableTollCost, driverEdited, driverAllowanceInput, baseRatePerKm, serviceCharge, includeReturn]);

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
  // The trip leaves South Africa: the route crossed a border, or the pickup,
  // delivery or a stop is outside SA. Known once a route or a point's country
  // is in hand; until then the saved quote keeps whatever it had.
  const pointCountries = [pickupCoords?.country_code, deliveryCoords?.country_code, ...stops.map(st => st.coords?.country_code)];
  const internationalKnown = !!routeData || pointCountries.some(Boolean);
  const isInternational = !!routeData?.cross_border
    || (routeData?.countries || []).some(c => isForeignCountry(c))
    || pointCountries.some(c => isForeignCountry(c));
  // The send preview's VAT for this unsaved quote: the backend rule
  // (core/services/quote_vat.py) on the figures on screen, so the preview
  // matches the email the save then sends.
  const previewVat = (() => {
    const excl = Math.round(total * 100) / 100;
    if (companyProfile?.vat_registered === false) return { vat_registered: false, vat_amount: 0, total_incl_vat: excl };
    const vatAmt = isInternational ? 0 : Math.round(excl * 0.15 * 100) / 100;
    return {
      vat_registered: true,
      vat_label: isInternational ? 'VAT 0% (zero-rated international transport)' : 'VAT (15%)',
      vat_amount: vatAmt,
      total_incl_vat: Math.round((excl + vatAmt) * 100) / 100,
    };
  })();
  // The route response kept on the quote for ML training, without the map
  // paths: every alternative's full point list made a long trip's snapshot
  // ~870 KB, over the backend's 200 KB cap (the save failed). The priced
  // route's path is saved on its own as route_geometry; distances, times,
  // tolls, traffic and terrain all stay. Traffic sections go only if a
  // snapshot would still be near the cap.
  const SNAPSHOT_SOFT_MAX = 180_000;
  type Json = Record<string, unknown>;
  const compactRouteResponse = (data: RouteData | null) => {
    if (!data) return data;
    const strip = (rt: unknown, dropSections: boolean): unknown => {
      if (!rt || typeof rt !== "object") return rt;
      const { geometry, sections, ...rest } = rt as Json;
      return {
        ...rest,
        ...(Array.isArray(geometry) ? { geometry_points: geometry.length } : {}),
        ...(dropSections ? (Array.isArray(sections) ? { sections_count: sections.length } : {}) : { sections }),
      };
    };
    const build = (dropSections: boolean) => {
      const out = strip(data, dropSections) as Json;
      const routes = (data as unknown as Json).routes;
      if (Array.isArray(routes)) out.routes = routes.map((rt) => strip(rt, dropSections));
      return out;
    };
    const full = build(false);
    return JSON.stringify(full).length > SNAPSHOT_SOFT_MAX ? build(true) : full;
  };
  // Same class of bug as the coordinates above, different field: base_rate,
  // fuel_surcharge, toll_charges, driver_allowance, additional_charges and
  // total_amount are all DecimalField(max_digits=10, decimal_places=2) —
  // summing floats (crossBorderCost + serviceCharge, etc.) can leave a
  // trailing artifact like 2269.0000000000002, which fails "no more than
  // 10 digits" before Django ever gets to round it to 2dp.
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ---- pricing analysis ----
  // Consumes the builder's own computed figures (distance, fuel, tolls +
  // plazas, cross-border, vehicle, weight, client). No route, geocode or toll
  // call of its own; the request is debounced and stale ones are cancelled.
  const pricingBlockedReason = billingBlocked ? "Pricing analysis is paused while quoting is blocked."
    : isDemoQuotaExceeded ? "Pricing analysis is paused: this demo session's quote is used."
    : routeBlockedMessage ? "This route isn't allowed for your company, so there is nothing to price."
    : weightBlockedMessage ? "The load is over this vehicle's capacity, so there is nothing to price yet."
    : null;
  const pricingPhase: PricingPhase = pricingBlockedReason ? "blocked"
    : !ready ? "needs"
    : routeError && !calculatingRoute ? "route_error"
    : !routeIsCurrent || total <= 0 ? "route"
    : "ready";
  const pricingNeeds = [
    !customerId && "client",
    !(pickup && pickupCoords) && "collection",
    !(delivery && deliveryCoords) && "delivery",
    !(Number(weight) > 0) && "weight",
  ].filter((x): x is string => !!x);
  const pricingInputs: PricingInputs | null = pricingPhase === "ready" ? {
    quoteId: savedQuoteId || (isEditing ? Number(editId) : null),
    customerId: customerId ? Number(customerId) : null,
    origin: extractCode(pickup), destination: extractCode(delivery),
    originLabel: pickup, destinationLabel: delivery,
    distanceKm: chargeDistance, oneWayDistanceKm: distance, legs, tripType,
    durationMinutes: route?.duration_minutes ?? route?.duration_min ?? routeData?.duration_minutes ?? null,
    vehicleTypeId: selectedVT?.id ?? null, vehicleType: vehicleType || null,
    weightKg: weightKg > 0 ? weightKg : null,
    fuelType, fuelZone: isDieselPricing ? (companyProfile?.fuel_zone === "COASTAL" ? "COASTAL" : "INLAND") : null,
    fuelCost, fuelLitres, fuelPricePerL, fuelConsumption,
    tollCost, routePlazas: tollBreakdown.map(b => ({ plaza: b.plaza, route: b.route, tariff: Number(b.tariff) })),
    countryCodes: route?.country_codes ?? routeData?.countries ?? null,
    crossBorderCost, isInternational,
    pickupDate: pickupDate || null,
    driverAllowance: driverEdited ? driverAllowance : null,
    includeReturn,
    yourPrice: total,
  } : null;
  const pricing = usePricingAnalysis(pricingInputs, pricingPhase === "ready");
  // The price in the bar, read live against the last analysis.
  const liveReading = readPrice(pricing.data, total);
  // The bar's one price story: the build-up until a price is applied, then the
  // applied price (a choice, or the user's own).
  const atBuildUp = Math.abs(serviceCharge) < 0.005;
  const recChoice = pricing.data?.choices.find(c => c.recommended) ?? null;
  const appliedChoice = liveReading.matchedChoice ? pricing.data?.choices.find(c => c.key === liveReading.matchedChoice) ?? null : null;
  // "Use Balanced R 25 100" sits in the bar until a price is applied.
  const useRec = atBuildUp && !!recChoice && liveReading.margin != null && Math.abs(recChoice.price - total) >= 0.005;

  // Driver allowance: the approved allowance × nights from the analysis is
  // OFFERED next to the Driver input (one tap applies it). The builder's own
  // total never changes on its own.
  const driverLine = pricing.data?.costFloor?.lines.find(l => l.key === "driver_allowance") ?? null;
  const driverSuggested = driverLine?.suggested ?? null;
  const driverNights = driverLine?.details.find(d => /night/i.test(d.label))?.value?.match(/^\d+/)?.[0] ?? (driverLine?.nights ? String(driverLine.nights) : null);
  // Priced from the company's own "allowance per night" setting (no approved rate).
  const driverFromSetting = driverLine?.source.kind === "user";

  // Put a price in the bar: the cost lines stay exactly as calculated and the
  // difference is the price adjustment (serviceCharge), so total === price.
  const costSum = total - serviceCharge;
  const applyPrice = (price: number) => {
    if (!(price >= 0) || !Number.isFinite(price)) return;
    setServiceCharge(round2(price - costSum));
  };
  // No toast: the applied card ("In your quote") and the bar confirm it.
  const applyChoice = (price: number, _key: ChoiceKey) => { applyPrice(price); };
  // A reopened quote priced with the analysis: keep the price that was decided.
  useEffect(() => {
    const saved = savedFinalPriceRef.current;
    if (saved == null || !routeIsCurrent) return;
    savedFinalPriceRef.current = null;
    // To the cent: a quote saved at R 24 999,99 reopens at R 24 999,99, and a
    // no-change re-save stores the same total.
    if (Math.abs(saved - total) >= 0.005) applyPrice(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIsCurrent]);

  // Price bar height as a CSS variable (sticky aside, toasts sit above it).
  const priceBarRef = useRef<HTMLElement | null>(null);
  const [priceBarEl, setPriceBarEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setPriceBarEl(priceBarRef.current); });
  useEffect(() => {
    const root = document.documentElement;
    if (!priceBarEl) { root.style.removeProperty("--pricebar-h"); return; }
    const set = () => root.style.setProperty("--pricebar-h", `${Math.round(priceBarEl.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(priceBarEl);
    return () => { ro.disconnect(); root.style.removeProperty("--pricebar-h"); };
  }, [priceBarEl]);
  // Phones: the bar folds to one compact row while scrolling down, and opens
  // again on scroll up, a tap, or focus.
  const [barCompact, setBarCompact] = useState(false);
  useEffect(() => {
    let last = -1;
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!t || !(t instanceof HTMLElement) || !t.classList?.contains("os-app-main")) return;
      if (!window.matchMedia("(max-width: 640px)").matches) { setBarCompact(false); return; }
      if (document.activeElement?.id === "qb-price-input") return;
      const y = t.scrollTop;
      if (last >= 0 && Math.abs(y - last) > 6) setBarCompact(y > last && y > 120);
      last = y;
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  // The aside's bottom fade only shows while it really scrolls and isn't at the end.
  const asideRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const upd = () => el.classList.toggle("is-overflowing", el.scrollHeight - el.clientHeight - el.scrollTop > 4);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", upd, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", upd); };
  }, []);

  // Desktop geometry (≥1024): the price bar is fixed to the window's foot,
  // spanning the main column (its edges from .qb-controls), and the sticky
  // aside is clamped to sit 16px under the top bar and 16px above the bar at
  // every scroll position.
  const controlsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = controlsRef.current;
    if (!root) return;
    let raf = 0;
    const desk = () => window.matchMedia("(min-width: 1024px)").matches;
    const place = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      root.style.setProperty("--qb-main-left", `${Math.round(r.left)}px`);
      root.style.setProperty("--qb-main-right", `${Math.max(0, Math.round(window.innerWidth - r.right))}px`);
      const aside = asideRef.current;
      if (!aside) return;
      if (!desk()) { aside.style.maxHeight = ""; return; }
      const scroller = root.closest(".os-app-main") as HTMLElement | null;
      const topbarBottom = scroller ? scroller.getBoundingClientRect().top : 0;
      const bar = priceBarRef.current;
      const vh = window.innerHeight;
      const barTop = bar ? bar.getBoundingClientRect().top : vh;
      const barH = bar ? bar.getBoundingClientRect().height + 12 : 0;
      const asideTop = aside.getBoundingClientRect().top;
      const max = Math.min(vh - topbarBottom - 16 - 16 - barH, barTop - 16 - asideTop);
      aside.style.maxHeight = `${Math.max(160, Math.floor(max))}px`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    if (priceBarRef.current) ro.observe(priceBarRef.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      ro.disconnect(); if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, { capture: true } as EventListenerOptions);
    };
  }, [priceBarEl]);

  // While the price is being typed it isn't judged: no colour, no "below
  // floor", until it is settled: blur, Enter, or 900 ms without a keystroke,
  // AND the analysis for that exact price has landed (B-2.4). Settled figures
  // are the server's own (`your_price`), or the choice's at a choice price.
  const [priceTyping, setPriceTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlePrice = () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); setPriceTyping(false); };
  const serverAtPrice = pricing.data?.yourPrice && pricing.status === "ready" && Math.abs(pricing.data.yourPrice.price - total) <= 0.005
    ? pricing.data.yourPrice : null;
  const barSettled = !priceTyping && (!!appliedChoice || !!serverAtPrice);
  const [settledTotal, setSettledTotal] = useState(total);
  useEffect(() => { if (barSettled || !pricing.data) setSettledTotal(total); }, [total, barSettled, pricing.data]);
  const onPriceInput = (n: number | null) => {
    setPriceTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setPriceTyping(false), 900);
    if (n != null && Number.isFinite(n) && n >= 0) applyPrice(n);
  };
  useEffect(() => () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); }, []);

  // A price set in the bar is a change to what the haulage (base rate) line
  // charges, so it is saved there: the line items still add up to the total,
  // additional_charges stays the border line, and a reopened quote recovers
  // the same R/km (base_rate ÷ km) and price. Only a price below the
  // pass-through costs leaves a (negative) remainder in additional_charges.
  const savedBase = Math.max(0, baseCost + serviceCharge);
  const savedBaseShortfall = Math.min(0, baseCost + serviceCharge);
  // ---- build the save payload (matches production) ----
  const buildPayload = (status: "DRAFT" | "SENT") => ({
    customer: parseInt(customerId), pickup_location: pickup, delivery_location: delivery,
    pickup_date: pickupDate || null, delivery_date: deliveryDate || null,
    origin: extractCode(pickup), destination: extractCode(delivery),
    pickup_lat: round6(pickupCoords?.lat), pickup_lng: round6(pickupCoords?.lon), delivery_lat: round6(deliveryCoords?.lat), delivery_lng: round6(deliveryCoords?.lon),
    cargo_description: cargo || `${weight || 0}t ${vehicleType}`.trim(), weight: weightKg, distance,
    estimated_duration_minutes: route?.duration_min ? Math.round(route.duration_min) : (routeData?.duration_minutes || null),
    vehicle_type: vehicleType, base_rate: round2(savedBase), fuel_surcharge: round2(fuelCost), toll_charges: round2(tollCost),
    // International transport is zero-rated for VAT (the customer sees VAT 0%):
    // sent only when the route or a point's country says so either way.
    ...(internationalKnown ? { is_international: isInternational } : {}),
    driver_allowance: round2(driverAllowance), additional_charges: round2(crossBorderCost + savedBaseShortfall),
    total_amount: round2(total),
    // One margin definition: price − full cost floor (pricing analysis). Sent
    // only when the floor is known, so an edit never wipes a saved figure.
    ...(liveReading.marginPct != null ? { margin_percentage: Math.max(-999.99, Math.min(999.99, Math.round(liveReading.marginPct * 100) / 100)) } : {}),
    notes, status,
    sla_hours: Number(companyProfile?.default_sla_hours) || 48, valid_until: validUntil, trip_type: tripType,
    // No heuristic win_probability any more: the server sets it from the
    // model's likelihood at the final price (model level only). What was shown
    // and picked is saved, additively, as pricing_decision.
    ...(pricing.data ? { pricing_decision: pricingDecision(pricing.data, total, liveReading.matchedChoice ?? "custom", serviceCharge) } : {}),
    base_rate_per_km: serviceCharge !== 0 && chargeDistance > 0 ? round2(savedBase / chargeDistance) : Number(baseRatePerKm) || null,
    // Full raw request+response of the route-calculate call behind the
    // currently-selected route, captured for future ML training — see
    // Quote.route_snapshot. Only set once a route has actually resolved.
    // Omitted (not null) with no route: the field isn't nullable, and an
    // edit must not wipe the snapshot already saved.
    // Only for a route calculated for these inputs — never the stub an edited
    // quote starts with, which would overwrite the saved snapshot.
    ...(routeIsCurrent ? { route_snapshot: {
      request: lastRouteRequestRef.current, response: compactRouteResponse(routeData), selected_route_index: selectedRouteIndex,
      fuel_price_per_litre_used: fuelPricePerL, fuel_type_used: fuelType,
      // "market_check": applied from the market price check ("ai_market" is
      // still read back from quotes saved before the rename).
      fuel_price_source: aiFuelActive ? "market_check" : isDieselPricing && diesel.source === "live" ? "live" : "company_setting",
      toll_charges_source: tollManuallyEdited ? "manual" : aiTollActive ? "market_check" : "route",
      ...(aiTollActive && !tollManuallyEdited ? { ai_toll_one_way: aiToll!.oneWay, ai_toll_route_key: aiToll!.routeKey } : {}),
    } } : {}),
    // Only stops with a resolved location count — same rule the route-calc
    // call already applies (see the routeData effect below). Previously
    // these never made it into the save payload at all: used for live
    // pricing, then silently discarded — nothing downstream (Quote Detail,
    // the quotes table, the customer share link, the converted Order) could
    // ever show them.
    stops: stops.filter(s => s.coords).map(s => ({
      location: s.location, lat: round6(s.coords!.lat), lon: round6(s.coords!.lon),
    })),
    // The exact selected route's path — same "used live, never saved" gap
    // stops had. Without this, any map showing this quote/order later has
    // to run its own fresh routing call, which can return a materially
    // different road path than the one actually priced and shown here.
    route_geometry: (route?.geometry || []).map(p => ({ lat: round6(p.lat), lon: round6(p.lon) })),
  });

  // ---- explicit save / send ----
  // Why the quote can't be saved or sent yet (null when it can). Shared by
  // save() and the Send button, which checks before opening the preview.
  const saveBlocker = (): string | null => {
    if (!customerId) return "Pick a client first";
    if (!ready) return "Add collection, delivery and weight";
    if (routeBlockedMessage) return routeBlockedMessage;
    if (weightBlockedMessage) return weightBlockedMessage;
    if (isDemoQuotaExceeded) return "You've used this demo session's one free quote. Log out and log back in (or click \"View Demo\" again) to start a fresh session.";
    return null;
  };
  // Send emails the client: it opens a preview first and sends only on confirm.
  const [sendPreviewOpen, setSendPreviewOpen] = useState(false);
  const openSendPreview = () => {
    const blocker = saveBlocker();
    if (blocker) { toast.error(blocker); return; }
    setSendPreviewOpen(true);
  };

  const save = async (send: boolean) => {
    const blocker = saveBlocker();
    if (blocker) { toast.error(blocker); return; }
    setSaving(true);
    try {
      let quoteId = savedQuoteId || (isEditing ? Number(editId) : null);
      if (quoteId) await patchData({ url: `api/v1/quotes/${quoteId}/`, data: buildPayload(send ? "SENT" : "DRAFT") });
      else { const res = await postData({ url: "api/v1/quotes/", data: buildPayload(send ? "SENT" : "DRAFT") }); quoteId = res?.id; }
      if (send && quoteId) {
        const r = await postData({ url: `api/v1/quotes/${quoteId}/send_to_customer/`, data: {} }).catch(() => null);
        toast.success(r?.email_sent ? "Quote sent to client" : "Quote saved. Email pending.");
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
  // `fill`: the map grows to fill its card (the in-page card is stretched to
  // the cost card's height), with `height` as its minimum.
  const renderMapPanel = (height: number, expandButton?: React.ReactNode, closeButton?: React.ReactNode, fill = false) => {
    const map = (
      <RouteMapView pickup={pickup} delivery={delivery} pickupCoords={pickupCoords} deliveryCoords={deliveryCoords} height={fill ? "100%" : height}
        onMapClick={handleMapClick}
        stops={stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lon: s.coords!.lon, label: s.location }))}
        geometry={route?.geometry && route.geometry.length > 1
          ? route.geometry.map(p => [p.lat, p.lon] as [number, number])
          : undefined} />
    );
    return (
    <>
      <div className="qb-maphead">
        <span className="qb-maphead__hint">
          <Map size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
          {(() => {
            // pickMode is "pickup", "delivery", or a stop's id — resolve
            // whichever one is currently selected to its display label and
            // whether it already has a pin, so the hint always names the
            // actual target instead of assuming pickup/delivery.
            const activeStopIdx = stops.findIndex(s => s.id === pickMode);
            const activeStop = activeStopIdx >= 0 ? stops[activeStopIdx] : null;
            const activeLabel = pickMode === "pickup" ? "collection"
              : pickMode === "delivery" ? "delivery"
              : activeStop ? `stop ${activeStopIdx + 1}` : null;
            const activeFilled = pickMode === "pickup" ? !!pickupCoords
              : pickMode === "delivery" ? !!deliveryCoords
              : !!activeStop?.coords;
            // Same gesture on both: Leaflet reads a double-tap as its dblclick.
            // Only the verb changes, by input type (CSS, no logic).
            const verb = <><span className="qb-hint-mouse">Double-click</span><span className="qb-hint-touch">Double-tap</span></>;
            return activeFilled || !activeLabel
              ? <span>{verb} the map to move a pin, or search above</span>
              : <span>{verb} the map to set <b style={{ fontWeight: 500, color: "var(--text-primary)" }}>{activeLabel}</b></span>;
          })()}
        </span>
        <div className="qb-maphead__tools">
          <div className="tw-seg tw-seg--sm qb-picks" role="group" aria-label="Which point the map sets">
          <button type="button" onClick={() => setPickMode("pickup")} aria-pressed={pickMode === "pickup"}
            className={`tw-seg__opt${pickMode === "pickup" ? " is-active" : ""}`}>
            <span className={`qb-pin qb-pin--from${pickupCoords ? " is-set" : ""}`} aria-hidden="true" />
            Collection
          </button>
          {stops.map((stop, i) => (
            <StopPickPill key={stop.id} index={i} active={pickMode === stop.id} filled={!!stop.coords}
              onSelect={() => setPickMode(stop.id)} onRemove={() => removeStop(stop.id)} />
          ))}
          {/* No bare "+" between the two targets: "+ Add stop" under the
              map is the one way to add a stop (R10). */}
          <button type="button" onClick={() => setPickMode("delivery")} aria-pressed={pickMode === "delivery"}
            className={`tw-seg__opt${pickMode === "delivery" ? " is-active" : ""}`}>
            <span className={`qb-pin qb-pin--to${deliveryCoords ? " is-set" : ""}`} aria-hidden="true" />
            Delivery
          </button>
          </div>
          {expandButton}
          {closeButton}
        </div>
      </div>
      {fill ? (
        <div style={{ position: "relative", flex: "1 1 auto", minHeight: height }}>
          <div style={{ position: "absolute", inset: 0 }}>{map}</div>
        </div>
      ) : map}
      {/* Stops — optional intermediate points between Collection and Delivery,
          actually routed through (RouteCalculatorView chains them into the
          TomTom call) and reflected in distance/fuel/toll/base-rate. Right
          below the map, only once both locations are set: a plain
          "+ Add stop" trigger until the first stop exists, at which point
          the trigger is replaced by a collapsible header + the stop list. */}
      {pickupCoords && deliveryCoords && (
        <div style={{ padding: "10px", borderTop: "1px solid var(--border-subtle)" }}>
          {stops.length === 0 ? (
            <button type="button" onClick={addStop} className="qb-textbtn">
              <Plus size={12} aria-hidden="true" /> Add stop
            </button>
          ) : (
            <div>
              <div onClick={() => setStopsExpanded(v => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", marginBottom: stopsExpanded ? 8 : 0 }}>
                <span style={{ ...labelS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stops.length} stop{stops.length > 1 ? "s" : ""}
                  {!stopsExpanded && `: ${stops.map(s => s.location || "…").join(" → ")}`}
                </span>
                {stopsExpanded ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
              </div>

              {stopsExpanded && (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 1, background: "var(--border-subtle)" }} />

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-surface)", border: "2px solid var(--accent-primary)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", fontWeight: 400 }}>{pickup || "Collection"}</span>
                  </div>

                  <DndContext sensors={stopSensors} onDragEnd={handleStopDragEnd}>
                    <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {stops.map((stop, i) => (
                        <SortableStopRow
                          key={stop.id}
                          stop={stop}
                          index={i}
                          inputStyle={{ ...inputS, fontFamily: "var(--font-sans)", padding: "7px 10px", minHeight: 0 }}
                          onLocationChange={(v, c) => updateStop(stop.id, { location: v, coords: c || null })}
                          onRemove={() => removeStop(stop.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  <button type="button" onClick={addStop} className="qb-textbtn" style={{ position: "relative", margin: "0 0 10px 28px" }}>
                    <Plus size={12} aria-hidden="true" /> Add stop
                  </button>

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ position: "relative", zIndex: 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-surface)", border: "2px solid var(--text-primary)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", fontWeight: 400 }}>{delivery || "Delivery"}</span>
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
                  type="button"
                  onClick={() => setSelectedRouteIndex(i)}
                  aria-pressed={i === selectedRouteIndex}
                  className="qb-routeopt">
                  {/^best routes?$/i.test((r.label || "").trim()) ? "Recommended route" : (r.label || r.summary || `Route ${i + 1}`)} · {Math.round(r.distance_km)} km
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 13, lineHeight: "20px", padding: "10px 12px", maxWidth: 220, borderRadius: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 12px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Distance</span><span>{Math.round(r.distance_km)} km</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Duration</span><span>{formatDuration(r.duration_minutes ?? r.duration_min)}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Fuel</span><span>{formatCurrency(r.fuel_cost_zar)}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Tolls</span><span>{formatCurrency(r.toll_cost_zar)}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Fuel + tolls</span><span>{formatCurrency(r.total_cost_zar)}</span>
                  {r.road_type && (<><span style={{ color: "var(--text-tertiary)" }}>Road</span><span>{r.road_type}</span></>)}
                  {r.terrain && r.terrain.length > 0 && (<><span style={{ color: "var(--text-tertiary)" }}>Terrain</span><span>{r.terrain.join(", ")}</span></>)}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg-raised)", borderRadius: "var(--radius-nested, 8px)" }}>
            <Map size={13} color="var(--text-tertiary)" aria-hidden="true" />
            <span style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums", fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
              Route via {routeData.stops_count ?? stops.length} stop{(routeData.stops_count ?? stops.length) > 1 ? "s" : ""} · {Math.round(routeData.routes[0].distance_km)} km · {formatDuration(routeData.routes[0].duration_minutes)}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: "20px", color: "var(--text-tertiary)" }}>
            Alternative routes aren't available once stops are added.
          </div>
        </div>
      )}
    </>
    );
  };

  // ---- styles ----
  // Principles v2: 1px border, no shadow, 12px card radius.
  const cardS: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-card, 12px)", boxShadow: "none" };
  // Brand label role: 13/20/500 sans, sentence case (label strings are
  // authored in sentence case; no uppercase transform).
  const labelS: React.CSSProperties = { fontSize: 13, lineHeight: "20px", fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text-secondary)", letterSpacing: "normal", textTransform: "none" };
  // Field label row: label left, an optional quiet "New" text button right.
  const fieldLabelS: React.CSSProperties = { ...labelS, marginBottom: 6, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
  // Marks a field required for the cost calculation to run (see `ready`).
  const Req = () => <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "var(--status-danger)", marginLeft: 5, verticalAlign: "middle" }} />;
  const inputS: React.CSSProperties = { background: "var(--input-bg)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-control, 8px)", padding: "9px 11px", color: "var(--text-primary)", fontSize: 14, lineHeight: "20px", fontFamily: "var(--font-sans)", width: "100%", minHeight: "var(--field-h, 40px)", boxSizing: "border-box" };

  // Same condition the price bar renders on (display only).
  const showPriceBar = !billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && !weightBlockedMessage && total > 0;

  return (
    <div ref={controlsRef} className={`qi-form qb-controls${showPriceBar ? " qb-has-pricebar" : ""}`}>
      {/* header */}
      {/* Same page head as every page (layout only): H1 on the title row,
          one grey line under it, actions on the right. */}
      {/* The shared page head: breadcrumb back to Quotes on the subtitle
          line, with the autosave state as a quiet status after it (never
          over the title). One head action; Send lives in the price bar. */}
      <SectionHeader
        title={isEditing ? "Edit quote" : "New quote"}
        back={isEditing ? { to: `/bookings/quotes/${editId}`, label: "Quote" } : { to: "/bookings/quotes", label: "Quotes" }}
        description={
          <span className="qb-savestate" aria-live="polite">
            {saving ? "Saving…" : isEditing || savedQuoteId ? "Saved quote · changes save when you press Save or Send"
              : lastSavedAt ? `Not saved yet · draft kept on this device at ${formatDateTime(lastSavedAt).split(", ")[1]}` : "Not saved yet · a draft is kept on this device"}
          </span>
        }
        actions={
          <button type="button" className="tw-btn" onClick={startNew} title="Clear every field and start a fresh quote (this one stays saved)">
            Clear &amp; new quote
          </button>
        }
      />

      {/* Resume-unsaved banner — opt-in, only before the first DB save */}
      {resumable && !isEditing && (
        <div className="qb-resume" style={{ ...cardS, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", minWidth: 0 }}>
            You have an unsaved quote from earlier{resumable.pickup ? ` (${resumable.pickup}${resumable.delivery ? ` → ${resumable.delivery}` : ""})` : ""}.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="tw-btn tw-btn--ghost" onClick={discardResumable}>Discard</button>
            <button type="button" className="tw-btn tw-btn--primary" onClick={applyResumable}>Resume</button>
          </div>
        </div>
      )}

      {/* Form left, pricing analysis right (≥1024px); on narrower screens the
          analysis stacks under the cost breakdown. */}
      <div className="qb-layout">
      <div className="qb-main">
      {/* NL input — typed or voice */}
      <div className="qb-nl" style={{ ...cardS, border: "1px solid var(--border-control)", display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 14px", marginBottom: 16, minHeight: 44 }}>
        {voice.recording ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-danger)", flexShrink: 0, animation: "pulse-dot 1s infinite" }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 32 }}>
              {voice.levels.map((h, i) => (
                <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: "var(--accent-primary)" }} />
              ))}
            </div>
            <button onClick={voice.stop} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, lineHeight: "20px", fontWeight: 500, background: "var(--status-danger)", color: "#fff", border: "none", borderRadius: "var(--radius-control, 8px)", padding: "9px 14px", cursor: "pointer" }}>
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
            <MessageCircle size={16} color="var(--text-tertiary)" aria-hidden="true" className="qb-nl__icon" style={{ flexShrink: 0 }} />
            <input value={nlText} onChange={e => setNlText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitNL()}
              placeholder={narrowNl ? "Describe the load" : "Describe it, e.g. “Move 28 tonnes of steel coils from Johannesburg to Durban”"} aria-label="Describe the load" style={{ ...inputS, border: "none", background: "transparent", paddingLeft: 4, minWidth: 0 }} />
            <button type="button" onClick={voice.start} title="Record voice" aria-label="Record voice"
              className="tw-btn qb-nl__mic">
              <Mic size={16} />
            </button>
            <button type="button" onClick={() => submitNL()} disabled={nlBusy || !nlText.trim()} className="tw-btn qb-nl__fill">{nlBusy ? "Reading…" : "Fill"}</button>
          </>
        )}
        {/* Assistant launcher slot (filled by AIChatPanel via a portal). */}
        {!showPriceBar && <span ref={nlChatSlotRef} className="qb-chatslot qb-chatslot--nl" />}
      </div>

      {/* 1 — inputs */}
      {/* One 4-column grid for every field row (inputs, details, cargo/trip),
          same template and gap, so field edges line up row to row. */}
      <div className="qb-grid qb-grid--inputs" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={fieldLabelS}><span>Client<Req /></span>{!authUser?.is_demo && <button type="button" className="qb-textbtn qb-textbtn--label" aria-label="New client" onClick={() => navigate("/customers")}><Plus size={12} aria-hidden="true" />New</button>}</div>
          <div className="qb-select">
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={inputS} data-empty={customerId ? undefined : ""} aria-label="Client">
              <option value="">Select client…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="qb-select__chev" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div style={fieldLabelS}><span>Weight (t)<Req /></span></div>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 15" style={inputS} aria-label="Weight in tonnes" />
        </div>
        <div className="qb-loc">
          <div style={fieldLabelS}><span>Collection<Req /></span></div>
          <LocationInput value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c || null); }} placeholder="City / address" style={inputS} />
        </div>
        <div className="qb-loc">
          <div style={fieldLabelS}><span>Delivery<Req /></span></div>
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
            This location is outside South Africa, but your company isn't set up for cross-border routes (Settings → Company Details). This quote will be refused once calculated. Pick a domestic location or ask an admin to enable cross-border routes.
          </span>
        </div>
      )}

      {/* details */}
      <div style={{ marginBottom: 24 }}>
        <div className="qb-grid qb-grid--details" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {/* The app's shared DatePicker: it hands back the same "yyyy-MM-dd"
              string the native date input did, straight to the same setter. */}
          {([
            ["qb-date-pickup", "Pickup date", pickupDate, setPickupDate],
            ["qb-date-delivery", "Delivery date", deliveryDate, setDeliveryDate],
            ["qb-date-valid", "Valid until", validUntil, setValidUntil],
          ] as const).map(([id, label, value, set]) => (
            <div key={id} role="group" aria-labelledby={id} className="qb-date">
              <div style={fieldLabelS}><span id={id}>{label}</span></div>
              <DatePicker value={value} onChange={set} style={{ minHeight: "var(--field-h, 40px)", boxSizing: "border-box" }} />
            </div>
          ))}
          <div className="qb-vehicle">
            <div style={fieldLabelS}><span>Vehicle type</span>{!authUser?.is_demo && <button type="button" className="qb-textbtn qb-textbtn--label" aria-label="New vehicle type" onClick={() => navigate("/fleet/vehicles")}><Plus size={12} aria-hidden="true" />New</button>}</div>
            <div className="qb-select">
            <select value={vehicleType} onChange={e => applyVehicleType(e.target.value)} style={inputS} aria-label="Vehicle type">
              <option value="">Not decided yet</option>
              {vehicleTypes.map((v: any) => (
                <option key={v.id || v.name} value={v.name}>{sentenceCaseLabel(v.name)}{Number(v.capacity) > 0 ? ` (${capLabel(v.capacity)})` : ""}</option>
              ))}
              {/* The options above only cover types with a vehicle free today.
                  A suggested or already-saved type outside that set still has to
                  be selectable, or the field renders blank. */}
              {[...suggestions.map((x) => x.vt.name as string), vehicleType]
                .filter((n): n is string => !!n && !vehicleTypes.some((v: any) => v.name === n))
                .filter((n, i, a) => a.indexOf(n) === i)
                .map((n) => {
                  const v = allVehicleTypes.find((x: any) => x.name === n);
                  return <option key={n} value={n}>{sentenceCaseLabel(n)}{Number(v?.capacity) > 0 ? ` (${capLabel(v.capacity)})` : ""}</option>;
                })}
            </select>
            <ChevronDown size={14} className="qb-select__chev" aria-hidden="true" />
            </div>
          </div>
          {/* Spans the grid on the row right under Vehicle type (the last
              field of the row above), aligned to its end, so the options stay
              on one line. Markup order = visual order at every width (R11):
              dates, Vehicle type, these suggestions, then Cargo and Trip, so
              Tab never jumps back up a row. Rendered only when there is
              something to show, so an empty row adds no second grid gap. */}
          {suggestions.length > 0 && <div className="qb-suggest-row" style={{ gridColumn: "1 / -1", marginTop: -8 }}>
          {/* Offered, not applied. Accepting one is a real selection, so the
              rate, the capacity check and the lane benchmark all switch on
              together — the same as picking it from the list by hand. */}
          {suggestions.length > 0 && (
            <div className="qb-suggest" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 16px", fontSize: 13, lineHeight: "20px" }}>
              {/* Label sits on the same line as the options: it's a lead-in, not
                  a field heading, so it keeps the form's spacing tight. */}
              <span style={labelS}>
                Suggested for this {capLabel(weight)} load:
              </span>
              {suggestions.map((x) => (
                <span key={x.vt.id || x.vt.name} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => applyVehicleType(x.vt.name)}
                    className="qb-textbtn qb-textbtn--pick"
                  >
                    {/* Display only: sentence case, as on the quote detail. */}
                    {sentenceCaseLabel(x.vt.name)} ({capLabel(x.cap)})
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" title={`Why ${sentenceCaseLabel(x.vt.name)} suits this load`} aria-label={`Why ${sentenceCaseLabel(x.vt.name)} suits this load`} className="qb-info">
                        <Info size={14} aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" style={{ width: 270, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: "20px", color: "var(--text-primary)" }}>
                      <div style={{ ...labelS, marginBottom: 8 }}>{sentenceCaseLabel(x.vt.name)}</div>
                      {suggestionReasons(x).map((reason, ri) => (
                        <div key={ri} style={{ display: "flex", gap: 7, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 6 }}>
                          <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>&middot;</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </span>
              ))}
            </div>
          )}
          </div>}
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span>Cargo</span></div><input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="e.g. palletised steel" style={inputS} aria-label="Cargo" /></div>
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span id="qb-trip-label">Trip</span></div>
            {/* The shared segmented control: neutral track, raised active option. */}
            <div className="tw-seg tw-seg--block qb-trip" role="group" aria-labelledby="qb-trip-label">
              {(["ONE_WAY", "ROUND_TRIP"] as const).map(t => <button key={t} type="button" onClick={() => setTripType(t)} aria-pressed={tripType === t} className={`tw-seg__opt${tripType === t ? " is-active" : ""}`}>{t === "ONE_WAY" ? "One way" : "Round"}</button>)}
            </div>
          </div>
        </div>
      </div>

      {/* 2 — map + cost */}
      {/* Stretched: both cards share the row's height, and the map grows to
          fill its card (never below inlineMapH), so the two always line up. */}
      <div className="qb-grid qb-grid--mapcost" style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", alignItems: "stretch", gap: 16, marginBottom: 16 }}>
          <div style={{ ...cardS, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderMapPanel(inlineMapH, (
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" title="Expand map" aria-label="Expand map" className="qb-iconbtn">
                    <Maximize2 size={14} aria-hidden="true" />
                  </button>
                </DialogTrigger>
                <DialogContent style={{ ...cardS, borderRadius: "var(--radius-dialog, 16px)", width: "min(1400px, 95vw)", padding: 0 }} hideClose>
                  {renderMapPanel(Math.round(Math.min(window.innerHeight * 0.78, 780)), undefined, (
                    <DialogClose asChild>
                      <button type="button" title="Close" aria-label="Close map" className="qb-iconbtn">
                        <X size={14} aria-hidden="true" />
                      </button>
                    </DialogClose>
                  ))}
                </DialogContent>
              </Dialog>
            ), undefined, true)}
          </div>
          <section className="qb-cost" aria-labelledby="qb-cost-title" style={{ ...cardS, padding: "var(--card-pad, 20px)" }}>
            <div className="qb-cost__head">
              <h2 id="qb-cost-title" className="qb-cost__title">Price build-up</h2>
              <p className="qb-cost__sub">{vehicleType ? `On your ${vtLabel} rates. Fuel, tolls, driver and border pass through; the base rate carries your fixed costs and margin.` : "No truck picked, so company defaults. Fuel, tolls, driver and border pass through; the base rate carries your fixed costs and margin."}</p>
            </div>
            {billingBlocked && (
              <div style={{
                padding: 14, marginBottom: ready ? 14 : 0, borderRadius: "var(--radius-nested, 8px)",
                background: "var(--status-danger-bg)", border: "1px solid var(--status-danger)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-danger-text, var(--status-danger))", marginBottom: 4 }}>
                  Quoting is blocked
                </div>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", marginBottom: 10 }}>
                  {subscriptionStatusDetail(authUser?.subscription_status)}
                </div>
                <button
                  onClick={() => navigate("/settings/billing")}
                  className="btn-action"
                >
                  Go to billing
                </button>
              </div>
            )}
            {!billingBlocked && !ready && (() => {
              // Empty state: what pricing still needs, read from the same four
              // inputs `ready` checks (display only).
              const clientName = customers.find((c: any) => String(c.id) === String(customerId))?.name;
              // Third item: text typed but no suggestion picked yet (pricing
              // waits for a picked match, so the row asks for one).
              const needs: [string, string | null, string?][] = [
                ["Client", customerId ? (clientName || "Chosen") : null],
                ["Collection", pickup && pickupCoords ? pickup : null, pickup],
                ["Delivery", delivery && deliveryCoords ? delivery : null, delivery],
                ["Weight", Number(weight) > 0 ? `${weight} t` : null],
              ];
              return (
                <div className="qb-need">
                  <ul className="qb-need__list" aria-label="Needed to price this quote">
                    {needs.map(([k, v, typed]) => (
                      <li key={k} className={`qb-need__row${v ? " is-done" : typed ? " is-typed" : ""}`}>
                        <span className="qb-need__mark" aria-hidden="true">{v ? <Check size={12} strokeWidth={2.5} /> : null}</span>
                        <span className="qb-need__k">{k}</span>
                        <span className="qb-need__v" title={v || typed || undefined}>{v || (typed ? "Typed · pick a match" : "Needed")}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="qb-need__foot">Fuel, tolls, driver allowance, base rate and a suggested price follow as soon as all four are in.</p>
                </div>
              );
            })()}
            {!billingBlocked && ready && isDemoQuotaExceeded && (
              <div style={{ padding: "20px 4px" }}>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--status-danger-text, var(--status-danger))", fontWeight: 600, marginBottom: 6 }}>Demo quota reached</div>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)" }}>You've used this demo session's one free quote. Log out and log back in (or click &quot;View Demo&quot; again) to start a fresh session.</div>
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && routeBlockedMessage && (
              <div style={{ padding: "20px 4px" }}>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--status-danger-text, var(--status-danger))", fontWeight: 600, marginBottom: 6 }}>Route not allowed</div>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)" }}>{routeBlockedMessage}</div>
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && weightBlockedMessage && (
              <div style={{ padding: "20px 4px" }}>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--status-danger-text, var(--status-danger))", fontWeight: 600, marginBottom: 6 }}>Overloaded for this vehicle</div>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)" }}>{weightBlockedMessage}</div>
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && !weightBlockedMessage && calculatingRoute && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                <Loader size={44} label="Calculating route…" />
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && !weightBlockedMessage && !calculatingRoute && (<>
              {[
                { key: "fuel", l: `Fuel: ${oneDp(fuelConsumption)} L/100 km at ${formatCurrency(fuelPricePerL)}/L${fuelZoneNote}${fuelBasisNote}`, v: fuelCost, c: "var(--status-danger)" },
                { key: "tolls", l: `Tolls (SA plazas${aiTollActive && !tollManuallyEdited ? " · checked tariffs" : ""})`, v: tollCost, c: "var(--status-warning)" },
                ...(crossBorderCost > 0 ? [{ key: "cb", l: "Cross-border / weighbridge", v: crossBorderCost, c: "#2BB6A6" }] : []),
                { key: "driver", l: "Driver allowance", v: driverAllowance, c: "var(--text-tertiary)" },
                { key: "base", l: `Base rate (${hasVehicleType ? vtLabel : "company default"})`, v: baseCost, c: "var(--accent-primary)" },
              ].map((r, i) => (
                <div key={i} className="qb-cost__row">
                  <span className="qb-cost__label">
                    {r.key === "fuel" && liveDieselHintText ? (
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span>{r.l}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{normaliseFigures(liveDieselHintText)}</span>
                      </span>
                    ) : r.l}
                    {r.key === "driver" && driverSuggested != null && Math.abs(driverSuggested - driverAllowance) >= 0.5 && (
                      <button type="button" className="qb-linkbtn" onClick={() => { setDriverAllowanceInput(String(driverSuggested)); setDriverEdited(true); }}
                        title={driverFromSetting ? "Your allowance per night (company settings) for the nights this trip keeps the driver away" : "The approved allowance for the nights this trip keeps the driver away"}>
                        Use {formatMoneyWhole(driverSuggested)} ({driverFromSetting ? "your setting" : "approved"}{driverNights ? ` × ${driverNights} night${driverNights === "1" ? "" : "s"}` : ""})
                      </button>
                    )}
                    {r.key === "driver" && driverLine && driverSuggested == null && !driverEdited && (
                      <span className="qb-cost__hint">No approved allowance on record</span>
                    )}
                    {r.key === "base" && (
                      <span className="qb-cost__rate">
                        <NumberField decimals={2} value={baseRatePerKm === "" ? null : Number(baseRatePerKm)}
                          onValue={(n) => setBaseRatePerKm(n == null ? "" : String(n))}
                          aria-label="Base rate per km" className="qb-mini qb-cost__input qb-cost__input--rate"
                          title={baseRateSource || undefined} />
                        <span aria-hidden="true">/km</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" title="Where this rate comes from"
                              className="qb-info">
                              <Info size={14} aria-hidden="true" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" style={{ width: 260, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: "20px", color: "var(--text-primary)" }}>
                            <div style={{ ...labelS, marginBottom: 8 }}>Base rate per km</div>
                            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                              What this quote charges per kilometre, before fuel, tolls and allowances.
                            </div>
                            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 8 }}>
                              A vehicle type's own rate is used whenever one is picked. With no type,
                              or a type that has no rate of its own, the quote falls back to your
                              company default.
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-row)" }}>
                              <span style={{ color: "var(--text-tertiary)" }}>Company default</span>
                              <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                                {Number(companyProfile?.default_base_rate_per_km) > 0
                                  ? formatCurrency(companyProfile.default_base_rate_per_km)
                                  : "not set"}
                              </span>
                            </div>
                            {hasVehicleType && (
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 5 }}>
                                <span style={{ color: "var(--text-tertiary)" }}>{vtLabel}</span>
                                <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                                  {Number(selectedVT?.base_rate) > 0
                                    ? formatCurrency(selectedVT.base_rate)
                                    : "not set"}
                                </span>
                              </div>
                            )}
                            <div style={{ color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.5 }}>
                              Change them in Settings &rarr; Company Details, or Settings &rarr; Vehicle Types.
                              Editing the box here only affects this quote.
                            </div>
                          </PopoverContent>
                        </Popover>
                      </span>
                    )}
                    {/* The only way back from an AI fuel price on a reopened quote (the undo snapshot doesn't survive a reload). */}
                    {r.key === "fuel" && aiFuelActive && (
                      <button type="button" className="qb-linkbtn" onClick={() => setAiFuel(null)} title="Price fuel at your company's own R/L again">
                        Use company price
                      </button>
                    )}
                    {r.key === "fuel" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" title="How this fuel figure was worked out"
                            className="qb-info">
                            <Info size={14} aria-hidden="true" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" style={{ width: 280, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: "20px", color: "var(--text-primary)" }}>
                          <div style={{ ...labelS, marginBottom: 8 }}>How this fuel figure is worked out</div>
                          {fuelRefCapacityTons > 0 ? (<>
                            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                              {hasVehicleType
                                ? `Your ${vtLabel}'s own consumption, adjusted for this load.`
                                : `No truck is picked, so this uses ${sentenceCaseLabel(fuelBasisVT?.name)}, the most economical type in your fleet that can carry ${weight}t.`}
                            </div>
                            {[
                              ["Truck used", `${fuelBasisVT?.name ? sentenceCaseLabel(fuelBasisVT.name) : "—"} (${capLabel(fuelRefCapacityTons)})`],
                              ["Its rated burn", `${oneDp(fuelConsumptionRef)} L/100 km at ${capLabel(fuelRefCapacityTons)}`],
                              ["This load", capLabel(weight || 0)],
                              ["Weight effect", `${oneDp(fuelSensitivity * 100)}% per tonne`],
                            ].map(([k, v]) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0" }}>
                                <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                                <span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{v}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                              <span>Burn for this load</span>
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>{oneDp(fuelConsumption)} L/100 km</span>
                            </div>
                          </>) : (
                            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                              Nothing in your fleet has a rated capacity to work from, so this uses a
                              standard {oneDp(fuelConsumption)} L/100 km with no adjustment for weight.
                              Set a capacity on your vehicle types to price this properly.
                            </div>
                          )}
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-row)" }}>
                            {[
                              ["Distance", `${formatNumber(Math.round(chargeDistance))} km${legs === 2 ? " (round trip)" : ""}`],
                              ["Diesel used", `${formatNumber(Math.round(chargeDistance * fuelConsumption / 100))} L`],
                              ["Diesel price", `${formatCurrency(fuelPricePerL)}/L${fuelZoneNote.replace(' · ', ' ')}`],
                              ...(liveDieselHintText ? [["Live diesel", normaliseFigures(liveDieselHintText.replace(/^Live diesel: /, ''))]] : []),
                            ].map(([k, v]) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0" }}>
                                <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                                <span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{v}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                              <span>Fuel cost</span>
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(fuelCost)}</span>
                            </div>
                          </div>
                          {!hasVehicleType && fuelRefCapacityTons > 0 && (
                            <div style={{ color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.5 }}>
                              This is a fleet-wide estimate, picked so the figure doesn't jump
                              around as you change the weight.{suggestions.length ? ` Choose ${sentenceCaseLabel(suggestions[0].vt.name)} above to price on the truck you'd actually send.` : " Pick a vehicle type to price on that truck exactly."}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                    {r.key === "tolls" && aiTollActive && !tollManuallyEdited && (
                      <button type="button" className="qb-linkbtn" onClick={() => setAiToll(null)} title="Charge this route's own toll figure again">
                        Use route tolls
                      </button>
                    )}
                    {r.key === "tolls" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" title="Toll breakdown"
                            className="qb-info">
                            <Info size={14} aria-hidden="true" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" style={{ width: 260, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: "20px", color: "var(--text-primary)" }}>
                          <div style={{ ...labelS, marginBottom: 8 }}>Toll plazas on this route</div>
                          {tollBreakdown.length === 0 ? (
                            <div style={{ color: "var(--text-tertiary)" }}>No SANRAL plazas matched on this route.</div>
                          ) : (<>
                            {tollBreakdown.map((b, bi) => (
                              <div key={bi} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-row)" }}>
                                <span>{b.plaza} <span style={{ color: "var(--text-tertiary)" }}>({b.route})</span></span>
                                <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatCurrency(b.tariff)}</span>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                              <span>One way total</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(tollBreakdownOneWay)}</span>
                            </div>
                            {legs === 2 && <div style={{ color: "var(--text-tertiary)", marginTop: 4 }}>× 2 for round trip = {formatCurrency(tollBreakdownOneWay * 2)}</div>}
                          </>)}
                          {aiTollActive && !tollManuallyEdited && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-row)", color: "var(--text-secondary)" }}>
                              Charged at the published tariffs checked on their source pages instead: {formatCurrency(aiToll!.oneWay)} one way
                              {legs === 2 ? ` × 2 = ${formatCurrency(tollCost)}` : ""}.
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                    {r.key === "cb" && (() => {
                      const border = routeData?.additional_costs?.border_fees || 0;
                      const weighbridge = routeData?.additional_costs?.weighbridge_fees || 0;
                      const nonSaTolls = routeData?.additional_costs?.non_sa_tolls || 0;
                      // Prefer the itemised breakdown — it names the actual
                      // charge ("SA C-BRTA Class 2 permit (R8,761/yr over 24
                      // crossings)") instead of a bucket total, which is what
                      // lets an operator check a quote against a real invoice.
                      // Falls back to the three totals for route responses
                      // cached before the backend started sending it.
                      const items = routeData?.cross_border_breakdown || [];
                      const cbRows = items.length
                        ? items.filter(i => i.amount > 0).map(i => ({ label: i.description, v: i.amount }))
                        : [
                            { label: "Border fees", v: border },
                            { label: "Weighbridge fees", v: weighbridge },
                            { label: "Non-SA tolls", v: nonSaTolls },
                          ].filter(row => row.v > 0);
                      const cbOneWayTotal = border + weighbridge + nonSaTolls;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" title="Cross-border breakdown"
                              className="qb-info">
                              <Info size={14} aria-hidden="true" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" style={{ width: 260, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: "20px", color: "var(--text-primary)" }}>
                            <div style={{ ...labelS, marginBottom: 8 }}>
                              Cross-border charges{routeData?.countries?.length ? ` · crosses ${routeData.countries.join("→")}` : ""}
                            </div>
                            {cbRows.length === 0 ? (
                              <div style={{ color: "var(--text-tertiary)" }}>No itemised breakdown available for this route.</div>
                            ) : (<>
                              {cbRows.map((row, ri) => (
                                <div key={ri} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-row)" }}>
                                  <span>{row.label}</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatCurrency(row.v)}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)", fontWeight: 600 }}>
                                <span>One way total</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cbOneWayTotal)}</span>
                              </div>
                              {legs === 2 && <div style={{ color: "var(--text-tertiary)", marginTop: 4 }}>× 2 for round trip = {formatCurrency(cbOneWayTotal * 2)}</div>}
                            </>)}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </span>
                  {r.key === "tolls" ? (
                    <NumberField value={tollManuallyEdited ? (editableTollCost === "" ? null : Number(editableTollCost)) : tollCost}
                      onValue={(n) => { setEditableTollCost(n == null ? "" : String(n)); setTollManuallyEdited(true); }}
                      aria-label="Tolls (R)" className="qb-mini qb-cost__input" />
                  ) : r.key === "driver" ? (
                    <NumberField value={driverAllowanceInput === "" ? null : Number(driverAllowanceInput) || 0}
                      onValue={(n) => { setDriverAllowanceInput(n == null ? "" : String(n)); setDriverEdited(true); }}
                      aria-label="Driver allowance (R)" className="qb-mini qb-cost__input" />
                  ) : (
                    <span className="qb-cost__value">{formatMoneyWhole(r.v)}</span>
                  )}
                </div>
              ))}
              {Math.abs(serviceCharge) >= 0.005 && (
                <div className="qb-cost__row">
                  <span className="qb-cost__label">
                    Price adjustment
                    <button type="button" className="qb-linkbtn" onClick={() => setServiceCharge(0)} title="Go back to the sum of the lines above">
                      Remove
                    </button>
                  </span>
                  <span className="qb-cost__value">{serviceCharge > 0 ? "+" : ""}{formatMoneyWhole(serviceCharge)}</span>
                </div>
              )}
              {/* One price display: the price bar. This is the lines' sum (hidden on
                  phones, where the bar sits right under it). */}
              <div className="qb-cost__total">
                <span>Quote price excl. VAT</span>
                <span className="qb-cost__total-fig">{formatRand(total)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-tertiary)", marginTop: 8 }}>{formatNumber(Math.round(distance))} km {legs === 2 ? `one way · ${formatNumber(Math.round(chargeDistance))} km round trip` : "one way"} · {fuelSourceWord} · {hasVehicleType ? `your ${vtLabel} settings` : "your company defaults"}{crossBorderCost > 0 ? ` · crosses ${(routeData?.countries || []).join("→")}` : ""}</div>
            </>)}
          </section>
      </div>

      </div>

      {/* 3 — pricing analysis */}
      <aside className="qb-aside" aria-label="Pricing analysis" ref={asideRef}>
        <PricingPanel
          state={pricing}
          phase={pricingPhase}
          blockedReason={pricingBlockedReason}
          needs={pricingNeeds}
          customerName={customers.find((c: any) => String(c.id) === String(customerId))?.name ?? null}
          price={settledTotal}
          distanceKm={distance}
          buildUp={costSum}
          settingsHref="/settings/company#pricing"
          onApplyPrice={applyChoice}
          driver={{
            value: driverAllowanceInput,
            edited: driverEdited,
            onChange: (v) => { setDriverAllowanceInput(v); setDriverEdited(true); },
            onReset: () => { if (driverSuggested != null) { setDriverAllowanceInput(String(driverSuggested)); setDriverEdited(true); } else setDriverEdited(false); },
          }}
          buildUpDriver={driverAllowance}
          onAddDriverToBuildUp={(amount) => { setDriverAllowanceInput(String(amount)); setDriverEdited(true); }}
          includeReturn={includeReturn}
          onIncludeReturn={setIncludeReturn}
          returnApplicable={legs === 1}
          revealKey={`${pickup}|${delivery}|${selectedVT?.id ?? vehicleType}|${tripType}|${customerId}`}
          atBuildUp={atBuildUp}
        />
      </aside>

      <div className="qb-after">
      {/* notes: above the price bar so they are filled in before sending */}
      {ready && <div style={{ marginBottom: 16 }}><div style={fieldLabelS}><label htmlFor="qb-notes">Notes (optional)</label></div><textarea id="qb-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything for the client or your team…" style={{ ...inputS, resize: "vertical" }} /></div>}
      </div>
      </div>

      {/* One price, next to Send. Fixed to the window's foot on desktop
          (sticky on narrower screens) so Send stays in reach. */}
      {showPriceBar && (() => {
        const data = pricing.data;
        const ready = liveReading.margin != null;
        const waiting = !ready && (pricing.status === "loading" || pricing.status === "refreshing" || pricing.status === "idle" || pricingPhase === "route");
        const failed = !ready && !waiting;
        // The bar's figures: the choice's own at a choice price (the row says
        // the same), the server's at a settled custom price, else a neutral
        // client reading while typing or waiting (never coloured).
        const rowLk = appliedChoice && data ? rowLikelihoods(data, data.choices).get(appliedChoice.key) ?? null : null;
        const settled = barSettled && ready;
        const margin = settled && appliedChoice ? appliedChoice.margin
          : settled && serverAtPrice?.margin != null ? serverAtPrice.margin : liveReading.margin;
        const marginPct = settled && appliedChoice ? appliedChoice.marginPct
          : settled && serverAtPrice?.marginPct != null ? serverAtPrice.marginPct : liveReading.marginPct;
        const below = margin != null && margin < 0;
        const lk = !settled || below ? null : appliedChoice ? rowLk : serverAtPrice?.likelihood ?? null;
        const showLk = lk && !(lk.level === "rules" && lk.band == null);
        const loss = settled && below;
        const wayOut = loss ? wayOutChoice(data?.choices ?? [], liveReading.floor) : null;
        const sendPrimary = !useRec && !waiting;
        // Where the price comes from: the build-up's rate and what it adds.
        const adds = ["fuel", "tolls", ...(crossBorderCost > 0 ? ["border"] : []), ...(driverAllowance > 0 ? ["driver"] : [])].slice(0, 3);
        const addsText = adds.length > 1 ? `${adds.slice(0, -1).join(", ")} and ${adds[adds.length - 1]}` : adds[0];
        return (
        <section ref={priceBarRef} className={`qb-pricebar${barCompact ? " is-compact" : ""}${atBuildUp && !priceTyping ? " is-buildup" : ""}`} aria-label="Quote price and send"
          onClick={() => { if (barCompact) setBarCompact(false); }}>
          <div className="qb-pricebar__price">
            <label className="qb-pricebar__label" htmlFor="qb-price-input">Quote price · excl. VAT</label>
            <span className="qb-pricebar__field">
              <span className="qb-pricebar__cur" aria-hidden="true">R</span>
              <NumberField id="qb-price-input" className="qb-pricebar__input" aria-describedby="qb-price-read"
                value={total}
                onFocus={() => setBarCompact(false)}
                onBlur={() => settlePrice()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
                onValue={(n) => onPriceInput(n)} />
            </span>
            {atBuildUp && !priceTyping ? (
              <span className="qb-pricebar__sub qb-pricebar__src">
                <span className="qb-pricebar__chip">Build-up</span>
                <span className="qb-pricebar__rate">
                  {chargeDistance > 0 && Number(baseRatePerKm) > 0
                    ? <>{formatCurrency(Number(baseRatePerKm))}/km × {formatNumber(Math.round(chargeDistance))} km{legs === 2 ? " (return)" : ""} + {addsText}</>
                    : "Sum of the cost lines"}
                </span>
              </span>
            ) : (
              <span className="qb-pricebar__sub qb-pricebar__src">
                <span className="qb-pricebar__chip">{appliedChoice && !priceTyping ? appliedChoice.label : "Your price"}</span>
                <button type="button" className="qb-linkbtn" onClick={() => applyPrice(costSum)}>
                  Back to build-up {formatMoneyWhole(costSum)}
                </button>
              </span>
            )}
          </div>
          <div className="qb-pricebar__read" id="qb-price-read" aria-live="off">
            <span className={`qb-pricebar__line${settled ? "" : " is-neutral"}${loss ? " qb-pricebar__loss" : ""}`}>
              {!ready ? (
                <span className="qb-pricebar__muted">{failed ? "Margin and chance to win unavailable right now" : "Working out margin and chance to win…"}</span>
              ) : below ? (
                <span>Loss of <span className="qb-pricebar__num">{formatMoneyWhole(-margin!)}</span>
                  {loss && <> · below your cost floor of <span className="qb-pricebar__num">{formatMoneyWhole(liveReading.floor)}</span></>}</span>
              ) : (
                <span>Margin <span className="qb-pricebar__num">{formatMoneyWhole(margin)} · {signedPct(marginPct ?? 0)}</span></span>
              )}
              {ready && showLk && (
                <span className={`qb-pricebar__lk qb-pricebar__lk--${lkTone(lk!)}`}>{likelihoodShort(lk!)}</span>
              )}
            </span>
            {useRec && ready && !priceTyping ? (
              <span className="qb-pricebar__next">
                <button type="button" className="tw-btn tw-btn--primary tw-btn--sm qb-pricebar__use" onClick={() => applyPrice(recChoice!.price)}>
                  Use {recChoice!.label} {formatMoneyWhole(recChoice!.price)}
                </button>
              </span>
            ) : wayOut ? (
              <span className="qb-pricebar__next">
                <button type="button" className="qb-linkbtn qb-linkbtn--strong" onClick={() => applyPrice(wayOut.price)}>
                  Use {wayOut.label} {formatMoneyWhole(wayOut.price)}
                </button>
              </span>
            ) : !hasVehicleType && !priceTyping ? (
              /* No truck: the price runs on the company default rate. */
              <span className="qb-pricebar__next qb-pricebar__nudge">
                No truck picked: company default rate.
                {suggestions.length > 0 && (
                  <button type="button" className="qb-linkbtn" onClick={() => applyVehicleType(suggestions[0].vt.name)}>
                    Use {sentenceCaseLabel(suggestions[0].vt.name)}
                  </button>
                )}
              </span>
            ) : null}
          </div>
          <div className="qb-pricebar__actions">
            <button type="button" className="tw-btn" onClick={() => save(false)} disabled={saving}>
              <span className="qb-lbl-long">Save as draft</span><span className="qb-lbl-short">Save draft</span>
            </button>
            {/* One primary action at a time: while the recommended price is
                on offer that button leads; once a price is set, Send does. */}
            <button type="button" className={`tw-btn${sendPrimary ? " tw-btn--primary" : ""}`} onClick={openSendPreview} disabled={saving}>Send quote</button>
            {/* Assistant launcher slot while the bar shows (see nlChatSlotRef). */}
            <span ref={barChatSlotRef} className="qb-chatslot" />
          </div>
        </section>
        );
      })()}

      {sendPreviewOpen && (() => {
        const client = customers.find((c: any) => String(c.id) === String(customerId));
        return (
          <QuoteSendPreview
            quote={{
              customer_name: client?.name,
              customer_email: client ? (client.email || null) : null,
              pickup_location: pickup,
              delivery_location: delivery,
              pickup_date: pickupDate || null,
              total_amount: round2(total),
              customer_price: previewVat,
              valid_until: validUntil,
            }}
            sending={saving}
            onCancel={() => setSendPreviewOpen(false)}
            onConfirm={async () => { await save(true); setSendPreviewOpen(false); }}
          />
        );
      })()}

      <AIChatPanel messages={chatMessages} busy={nlBusy} open={chatOpen} onOpenChange={setChatOpen} onSend={(t, lang) => submitNL(t, lang)} launcherSlot={chatSlot} />
    </div>
  );
}
