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
import { formatCurrency, formatMoneyWhole, formatNumber, formatDateTime, sentenceCaseLabel } from "@/lib/formatters";
import { DatePicker } from "@/components/ui/date-picker";
import { fuelInputFor, fuelKind, dieselSourceNote, randPerLitre, currentPeriodStartIso, isoDay, type QuoteWarning } from "@/lib/dieselPrice";
import { compute, changesSincePriced, suggestTruck, capacityTonnes, vehicleClass, CLASS_OPERATING_DEFAULTS, cents, type CostingInputs, type DieselInput } from "@/lib/quoteRules";
import { useCostBreakdown } from "@/components/pricing/useCostBreakdown";
import { sendBlockedMessage, SEND_CHECK_KEY } from "@/lib/quoteWarnings";
import { LocationInput, type LocationCoords } from "@/components/LocationInput";
import { RouteMapView } from "@/components/RouteMapView";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AIChatPanel, type ChatMessage } from "@/components/AIChatPanel";
import { useAuth } from "@/lib/AuthContext";
import { isSubscriptionBlocked, subscriptionStatusDetail } from "@/lib/subscriptionStatus";
import { MessageCircle, Map, Info, Maximize2, Mic, Square, X, Plus, GripVertical, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
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

/** One info button: a title, label/value rows and an optional total row.
 *  Secondary detail lives here, never in the line itself. */
function InfoPop({ label, title, rows, total }: { label: string; title: string; rows: [string, string][]; total?: [string, string] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title={label} aria-label={label} className="qb-info"><Info size={14} aria-hidden="true" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" className="qb-pop">
        <div className="qb-pop__title">{title}</div>
        {rows.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="qb-pop__row"><span>{k}</span><span>{v}</span></div>
        ))}
        {total && <div className="qb-pop__row qb-pop__total"><span>{total[0]}</span><span>{total[1]}</span></div>}
      </PopoverContent>
    </Popover>
  );
}

/** §10: one line per screen — the first warning's title and its first action;
 *  every warning's detail on tap. Block warnings first. */
function WarnLine({ list, onAction }: { list: QuoteWarning[]; onAction: (id: string) => void }) {
  const sorted = [...list].sort((a, b) => (a.severity === "block" ? 0 : 1) - (b.severity === "block" ? 0 : 1));
  const w = sorted[0];
  if (!w) return null;
  const act = w.actions[0];
  return (
    <span className={`qb-pricebar__next qb-warn qb-warn--${w.severity}`} role={w.severity === "block" ? "alert" : "status"}>
      <AlertTriangle size={13} aria-hidden="true" className="qb-warn__icon" />
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="qb-warn__title">{w.title}{sorted.length > 1 ? <span className="qb-warn__more"> +{sorted.length - 1} more</span> : null}</button>
        </PopoverTrigger>
        <PopoverContent align="start" className="qb-pop qb-pop--warn">
          {sorted.map((x) => (
            <div key={x.code} className="qb-pop__warn">
              <div className={`qb-pop__warn-title is-${x.severity}`}>{x.title}</div>
              {x.detail && <div className="qb-pop__warn-detail">{x.detail}</div>}
              {x.actions.length > 0 && (
                <div className="qb-pop__warn-actions">
                  {x.actions.map(a => <button key={a.id} type="button" className="qb-linkbtn" onClick={() => onAction(a.id)}>{a.label}</button>)}
                </div>
              )}
            </div>
          ))}
        </PopoverContent>
      </Popover>
      {act && <button type="button" className="qb-linkbtn qb-linkbtn--strong" onClick={() => onAction(act.id)}>{act.label}</button>}
    </span>
  );
}

interface RouteOption {
  summary?: string; distance_km: number; duration_min?: number; duration_minutes?: number;
  toll_cost_zar?: number; toll_breakdown?: TollBreakdownItem[]; fuel_cost_zar?: number; total_cost_zar?: number;
  label?: string; geometry?: { lat: number; lon: number }[];
  road_type?: string; motorway_pct?: number; traffic_status?: string; congested_km?: number; terrain?: string[];
  fuel_usage_litres?: number; country_codes?: string[]; tolls_unavailable?: boolean; tolls_unknown?: boolean;
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
  /** "estimated" = straight-line fallback (routing failed). */
  source?: string; distance_estimated?: boolean;
  tolls_unavailable?: boolean; tolls_unknown?: boolean; toll_warning?: string | null;
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
  // Not prefilled: the company's validity applies on save when left empty.
  const [validUntil, setValidUntil] = useState("");
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
  const [driverAllowanceInput, setDriverAllowanceInput] = useState("");
  // True once the user typed a driver figure (or a saved quote had one).
  // Until then it is nights away × the company's allowance per night (§6).
  const [driverEdited, setDriverEdited] = useState(false);
  // §5: a one-way trip ≥ the company's minimum km includes the empty return
  // unless a return load is booked.
  const [returnLoadBooked, setReturnLoadBooked] = useState(false);
  // §6: unknown tolls / an estimated distance block until fixed or confirmed.
  const [tollsNone, setTollsNone] = useState(false);
  const [distanceConfirmed, setDistanceConfirmed] = useState(false);
  // diesel_own_off "Use official" for this quote only.
  const [useOfficialDiesel, setUseOfficialDiesel] = useState(false);
  // The price in the bar, when the user (or a choice, or a reopened quote)
  // set one; null = the default price (cost floor + target margin).
  const [priceSet, setPriceSet] = useState<number | null>(null);
  // The bar's chip says "Saved price" for a reopened quote's own price.
  const [savedPriceShown, setSavedPriceShown] = useState(false);
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
  // §11: what a reopened quote was priced on (its floor and when), so a cost
  // change since then is said once, with Keep price / Re-price.
  const savedPricingRef = useRef<{ price: number; floor: number; pricedAt: string | null; pricedAtRaw: string | null; fuelPrice: number | null } | null>(null);
  const [reopenNotice, setReopenNotice] = useState<{ text: string; since: string | null; reprice: number | null } | null>(null);

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
  const narrowNl = useNarrow(1280);
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

  // ---- truck (§3): every quote is priced on a real vehicle type ----
  // An explicit choice wins; otherwise the suggested truck for the load
  // (smallest capacity ≥ load, tie → lowest rated burn). Priced from every
  // type the company has, not only the ones free today.
  const loadT = Number(weight) > 0 ? Number(weight) : 0;
  // The server's costing for this route and load (POST /quotes/cost-breakdown/):
  // its suggested truck and the company figures it resolved. Sent without a
  // truck while none is chosen, so the server suggests one.
  const chosenVT = vehicleType ? allVehicleTypes.find((v: any) => v.name === vehicleType) ?? null : null;
  const preRoute = routeData?.routes?.[selectedRouteIndex] || null;
  const preDistance = preRoute?.distance_km ?? routeData?.distance_km ?? 0;
  const preDuration = preRoute?.duration_minutes ?? preRoute?.duration_min ?? routeData?.duration_minutes ?? null;
  const breakdownPayload = customerId && pickupCoords && deliveryCoords && loadT > 0 && preDistance > 0 ? {
    trip_type: tripType, one_way_distance_km: Math.round(preDistance * 100) / 100, legs: tripType === "ROUND_TRIP" ? 2 : 1,
    duration_minutes: preDuration != null ? Math.round(Number(preDuration)) : null,
    weight: loadT * 1000, vehicle_type_id: chosenVT?.id ?? null, vehicle_type: vehicleType || null,
  } : null;
  // 1st request: the server's suggestion (no truck sent while none is chosen).
  const suggestBreakdown = useCostBreakdown(breakdownPayload);
  const serverSuggestedId = suggestBreakdown?.resolution?.suggested_vehicle_type_id ?? null;
  // No truck until there is a load to fit it to.
  const localSuggestedVT = useMemo(() => (loadT > 0 ? suggestTruck(allVehicleTypes, loadT) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicleTypesRaw, loadT]);
  const suggestedVT = (serverSuggestedId != null ? allVehicleTypes.find((v: any) => String(v.id) === String(serverSuggestedId)) : null) ?? localSuggestedVT;
  const selectedVT = useMemo(() => (vehicleType
    ? allVehicleTypes.find((v: any) => v.name === vehicleType) ?? vehicleTypes.find((v: any) => v.name === vehicleType)
    : suggestedVT) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicleTypesRaw, vehicleType, suggestedVT?.id]);
  /** The truck the quote is priced and saved on (chosen or suggested). */
  const truckName: string = selectedVT?.name || vehicleType || "";

  // ---- fuel price (§1): own, official or a price set for this quote ----
  const fuelType = selectedVT?.fuel_type || 'Diesel';
  // Diesel -> diesel price; Petrol and Hybrid -> petrol price (official or
  // own, same rule); Electric -> the company's own cost per kWh.
  const fuelPriceKind = fuelKind(fuelType);
  const hasOfficialFuel = fuelPriceKind !== 'Electric';
  // An applied market price (price check) overrides for this fuel type.
  const aiFuelActive = !!aiFuel && aiFuel.fuelType === fuelType;
  const dieselInput: DieselInput = {
    ...fuelInputFor({ fuelType, company: companyProfile, live: liveFuel }),
    use_official: useOfficialDiesel, override_price: aiFuelActive ? aiFuel!.pricePerL : null,
  };

  const applyVehicleType = (name: string) => {
    setVehicleType(name);
  };

  const ready = !!(customerId && pickup && delivery && pickupCoords && deliveryCoords && Number(weight) > 0);

  // ---- route ----
  const route = routeData?.routes?.[selectedRouteIndex] || null;
  // `distance` is the ONE-WAY lane distance; a round trip drives it twice.
  const distance = route?.distance_km ?? routeData?.distance_km ?? 0;
  const legs = tripType === "ROUND_TRIP" ? 2 : 1;
  const chargeDistance = distance * legs;
  const durationMin: number | null = route?.duration_minutes ?? route?.duration_min ?? routeData?.duration_minutes ?? null;
  const distanceEstimated = routeData?.source === "estimated" || routeData?.distance_estimated === true;
  const routeTollsUnknown = (route?.tolls_unavailable ?? routeData?.tolls_unavailable) === true
    || (route?.tolls_unknown ?? routeData?.tolls_unknown) === true;
  const tollBreakdown = route?.toll_breakdown ?? routeData?.toll_breakdown ?? [];
  // The plazas and truck an applied market toll figure was verified for.
  const tollRouteKey = JSON.stringify([truckName, tollBreakdown.map(b => b.plaza)]);
  const aiTollActive = !!aiToll && aiToll.routeKey === tollRouteKey;
  const routeToll = route?.toll_cost_zar ?? routeData?.toll_cost_zar ?? null;
  // One way (§6: per direction; a round trip is ×2). null = unknown.
  const tollsOneWay: number | null = tollManuallyEdited
    ? (editableTollCost === "" ? null : (Number(editableTollCost) || 0) / legs)
    : aiTollActive ? aiToll!.oneWay
    : routeTollsUnknown || routeToll == null ? null : Number(routeToll);
  const tollBreakdownOneWay = tollBreakdown.reduce((s, b) => s + Number(b.tariff), 0);
  const borderOneWay = (routeData?.additional_costs?.border_fees || 0) + (routeData?.additional_costs?.weighbridge_fees || 0) + (routeData?.additional_costs?.non_sa_tolls || 0);
  const weightKg = loadT * 1000;

  // ---- company figures the costing needs: the server's resolution
  // (POST /quotes/cost-breakdown/) when in, else the profile's own ----
  // 2nd request: the costing for the truck actually priced (same query when
  // the truck was chosen). Its company figures are used only for that truck.
  const serverBreakdown = useCostBreakdown(breakdownPayload && selectedVT
    ? { ...breakdownPayload, vehicle_type_id: selectedVT.id ?? null, vehicle_type: selectedVT.name } : null);
  const siRaw = serverBreakdown?.inputs ?? null;
  const si = siRaw && (siRaw as { vehicle?: { id?: unknown } | null }).vehicle?.id != null
    && String((siRaw as { vehicle?: { id?: unknown } }).vehicle!.id) === String(selectedVT?.id) ? siRaw : null;
  const opInUse = companyProfile?.operating_cost_in_use;
  const localOp = (() => {
    if (!companyProfile) return null;
    if (Number(companyProfile.operating_cost_per_km) > 0) return { value: Number(companyProfile.operating_cost_per_km), source: "company_setting" };
    if (opInUse?.source === "company_actuals" && Number(opInUse.actuals_value ?? opInUse.value) > 0) return { value: Number(opInUse.actuals_value ?? opInUse.value), source: "company_actuals" };
    const cls = vehicleClass(truckName, selectedVT?.capacity);
    const est = Number(opInUse?.estimates?.[cls]) > 0 ? Number(opInUse.estimates[cls]) : CLASS_OPERATING_DEFAULTS[cls];
    return { value: est, source: "vehicle_default" };
  })();
  const opPerKm: number | null = si?.operating_cost_per_km ?? localOp?.value ?? null;
  const allowancePerNight: number | null = si?.driver?.allowance_per_night
    ?? (Number(companyProfile?.driver_allowance_per_night) > 0 ? Number(companyProfile.driver_allowance_per_night) : null);
  const minimumCharge: number | null = si ? (si.minimum_charge ?? null) : (Number(companyProfile?.minimum_charge) > 0 ? Number(companyProfile.minimum_charge) : null);

  // ---- the costing (§3–7): the same function as the server ----
  const costingInputs: CostingInputs = {
    trip_type: tripType,
    distance_km: distance > 0 ? distance : null,
    distance_estimated: distanceEstimated, distance_confirmed: distanceConfirmed,
    duration_minutes: durationMin,
    load_kg: weightKg > 0 ? weightKg : null,
    vehicle: selectedVT ? { id: selectedVT.id ?? null, name: selectedVT.name, capacity: selectedVT.capacity, rated_burn_l_per_100km: selectedVT.fuel_consumption_l_per_100km } : null,
    diesel: dieselInput,
    operating_cost_per_km: opPerKm,
    operating_cost_source: si?.operating_cost_source ?? localOp?.source ?? null,
    tolls: { one_way: tollsOneWay, empty_return: null, lookup_failed: tollsOneWay == null && routeTollsUnknown, confirmed_none: tollsNone },
    driver: { allowance_per_night: allowancePerNight, nights: null, amount: driverEdited ? (driverAllowanceInput === "" ? null : Number(driverAllowanceInput) || 0) : null },
    hours_per_day: si?.hours_per_day ?? null,
    border_cost: borderOneWay * legs,
    include_empty_return: returnLoadBooked ? false : null,
    settings: si?.settings ?? {
      include_empty_return_default: companyProfile?.include_empty_return_default ?? true,
      empty_return_min_km: Number(companyProfile?.empty_return_min_km) > 0 ? Number(companyProfile.empty_return_min_km) : null,
    },
    minimum_charge: minimumCharge,
    target_margin_pct: si?.target_margin_pct ?? (companyProfile?.margin_target_pct != null && companyProfile.margin_target_pct !== "" ? Number(companyProfile.margin_target_pct) : null),
    default_price_per_km: si && "default_price_per_km" in si ? (si as { default_price_per_km?: number | null }).default_price_per_km ?? null
      : Number(companyProfile?.default_base_rate_per_km) > 0 ? Number(companyProfile.default_base_rate_per_km) : null,
  };
  const costing = compute(costingInputs);
  const lineAmt = (key: string) => costing.lines.find(l => l.key === key)?.amount ?? null;
  const fuelPricePerL = costing.diesel.price;
  const fuelPriceSource = costing.diesel.source;
  const fuelCost = lineAmt("fuel") ?? 0;
  const fuelLitres = costing.litres.loaded ?? 0;
  const fuelConsumption = costing.vehicle?.burn_loaded_l_per_100km ?? null;
  const tollCost = lineAmt("tolls") ?? 0;
  const crossBorderCost = lineAmt("border") ?? 0;
  const driverLineC = costing.lines.find(l => l.key === "driver") ?? null;
  const driverAllowance = driverLineC?.amount ?? 0;
  const driverNights = (driverLineC?.nights as number | null | undefined) ?? null;
  const returnLines = costing.lines.filter(l => l.leg === "empty_return");
  const emptyReturn = {
    applicable: costing.trip.empty_return_default,
    included: costing.trip.empty_return_included,
    total: cents(returnLines.reduce((s, l) => s + (l.amount ?? 0), 0)),
    lines: returnLines,
    nights: costing.trip.return_nights ?? 0,
  };
  const overload = costing.warnings.find(w => w.code === "overload") ?? null;
  const weightBlockedMessage = overload ? overload.title : null;

  // ONE cost model: the cost lines add up to the cost floor; the price is
  // separate. Default price = cost floor + target margin (never below the
  // minimum charge), or the optional default price per km when that is more;
  // whole rand. Unknown floor → no default price.
  // The costing's own default price (backend rule: ceil(max(rate price,
  // target price)); rate price = company default price per km × loaded km).
  const defaultPrice: number | null = costing.default_price;
  const total = cents(priceSet ?? defaultPrice ?? 0);
  // The same costing at the price in the bar: margin, below floor / minimum.
  const costingAtPrice = total > 0 ? compute({ ...costingInputs, price: total }) : costing;
  // §5 the other trip shape, priced the same way: "Loaded back R 25 100".
  // Loaded back: the costing's alternative_with_return_load; empty back
  // (a return load is booked): the same costing with the empty return in.
  const altReturnPrice: number | null = !costing.trip.empty_return_default ? null
    : costing.trip.empty_return_included ? costing.alternative_with_return_load?.default_price ?? null
    : compute({ ...costingInputs, include_empty_return: true }).default_price;

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
        vehicle_type: truckName || "Flatbed", vehicle_type_id: selectedVT?.id ?? null, weight_kg: weightKg || 20000,
        // Only stops with a resolved location count as routing waypoints —
        // one still being typed in is skipped rather than breaking the calc.
        // Route alternatives aren't available once stops are involved (a
        // TomTom limitation, not ours), so `routes` comes back with exactly
        // one entry in that case — see the single-route summary below.
        stops: stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lon: s.coords!.lon })),
      };
      const requestKey = routeRequestKey;
      // X-TW-Quote-Rules: the backend then says "unknown" (nulls + flags:
      // tolls_unknown, distance_estimated) instead of the legacy guesses.
      const data = await postData({ url: "/api/v1/route/calculate/", data: requestPayload, config: { headers: { "X-TW-Quote-Rules": "1" } } });
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
      // An empty cargo was saved as "Not specified" (older quotes: "28t <truck>").
      { const c = String(q.cargo_description || "").trim();
        const legacy = `${(Number(q.weight) || 0) / 1000}t ${q.vehicle_type || ""}`.trim();
        setCargo(/^not specified$/i.test(c) || c === legacy ? "" : c); } setNotes(q.notes || "");
      // The saved driver figure is the quote's own (kept, not re-prefilled).
      if (q.driver_allowance != null) { setDriverAllowanceInput(String(Number(q.driver_allowance))); setDriverEdited(true); }
      savedFinalPriceRef.current = Number(q.pricing_decision?.final_price) > 0 ? Number(q.pricing_decision.final_price) : null;
      { const sn = q.route_snapshot || {};
        const ci = q.costing_inputs || {};
        // §11: what it was priced on (the server's snapshot, else the decision).
        const floor = Number(q.cost_floor ?? sn.cost_floor ?? q.pricing_decision?.floor);
        const price = Number(q.pricing_decision?.final_price ?? q.total_amount);
        savedPricingRef.current = floor > 0 && price > 0
          ? { price, floor, pricedAt: isoDay(q.priced_at), pricedAtRaw: q.priced_at ?? null, fuelPrice: Number(q.fuel_price_used) || null }
          : null;
        setReturnLoadBooked(ci.include_empty_return === false);
        setTollsNone(ci.tolls_confirmed_none === true);
        setDistanceConfirmed(ci.distance_confirmed === true);
        setUseOfficialDiesel(ci.use_official_fuel === true);
        if (Number(ci.fuel_price_override) > 0) setAiFuel({ pricePerL: Number(ci.fuel_price_override), fuelType: sn.fuel_type_used || "Diesel" }); }
      if (q.toll_charges != null) setEditableTollCost(String(q.toll_charges));
      // An applied AI fuel price and a typed/AI toll figure are the user's
      // choice, so they survive a reload. Route-derived tolls still don't pin
      // (see tollManuallyEdited above).
      const snap = q.route_snapshot || {};
      if (!(Number(q.costing_inputs?.fuel_price_override) > 0)) {
        setAiFuel(["market_check", "ai_market", "override"].includes(snap.fuel_price_source) && Number(snap.fuel_price_per_litre_used) > 0
          ? { pricePerL: Number(snap.fuel_price_per_litre_used), fuelType: snap.fuel_type_used || "Diesel" } : null);
      }
      setTollManuallyEdited(snap.toll_charges_source === "manual" && q.toll_charges != null);
      // Re-applies only while the recalculated route has the same plazas.
      setAiToll(["market_check", "ai_market"].includes(snap.toll_charges_source) && Number(snap.ai_toll_one_way) > 0 && snap.ai_toll_route_key
        ? { oneWay: Number(snap.ai_toll_one_way), routeKey: String(snap.ai_toll_route_key) } : null);
      if (q.trip_type) setTripType(q.trip_type);
      if (q.valid_until) setValidUntil(q.valid_until);
      if (q.pickup_date) setPickupDate(q.pickup_date);
      if (q.delivery_date) setDeliveryDate(q.delivery_date);
      setSavedQuoteId(Number(editId));
      if (q.distance) setRouteData({ distance_km: Number(q.distance), toll_cost_zar: Number(q.toll_charges) / (q.trip_type === "ROUND_TRIP" ? 2 : 1),
        duration_minutes: Number(q.estimated_duration_minutes) > 0 ? Number(q.estimated_duration_minutes) : undefined });
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
    if (Number(d.price) > 0) setPriceSet(Number(d.price));
    if (typeof d.returnLoadBooked === "boolean") setReturnLoadBooked(d.returnLoadBooked);
    if (d.tollsNone) setTollsNone(true);
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
    setEditableTollCost(""); setTollManuallyEdited(false); setDriverAllowanceInput("");
    setDriverEdited(false); setReturnLoadBooked(false); setTollsNone(false); setDistanceConfirmed(false); setUseOfficialDiesel(false);
    savedFinalPriceRef.current = null; savedPricingRef.current = null; setReopenNotice(null); setPriceSet(null); setSavedPriceShown(false);
    setRouteError(false);
    setRouteData(null); setSelectedRouteIndex(0); setRouteBlockedMessage(null);
    setAiFuel(null); setAiToll(null);
    lastRouteKeyRef.current = null;
    setChatMessages([]); setChatOpen(false); setPendingEntity(null); setDeclinedEntities([]);
    setValidUntil("");
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
          price: priceSet, returnLoadBooked, tollsNone,
        }));
        setLastSavedAt(new Date());
      } catch { /* ignore */ }
    };
    draftFlushRef.current = doSave;
    draftRef.current = setTimeout(() => { draftFlushRef.current = null; doSave(); }, 800);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType,
    pickupDate, deliveryDate, validUntil, stops, tollManuallyEdited, editableTollCost, driverEdited, driverAllowanceInput, priceSet, returnLoadBooked, tollsNone]);

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
  // ---- warnings (§10): one list, block first ----
  // The margin line already says "Loss"; the weight is a required field.
  const HIDDEN_WARNINGS = ["below_floor", "load_missing"];
  const quoteWarnings: QuoteWarning[] = ready && !routeBlockedMessage && distance > 0 && !calculatingRoute
    ? costingAtPrice.warnings.filter(w => !HIDDEN_WARNINGS.includes(w.code)) : [];
  const blockWarnings = quoteWarnings.filter(w => w.severity === "block");

  const pricingBlockedReason = billingBlocked ? "Paused while quoting is blocked."
    : isDemoQuotaExceeded ? "This demo session's quote is used."
    : routeBlockedMessage ? "Route not allowed for your company."
    : weightBlockedMessage ? "Load is over the truck's capacity."
    : null;
  const pricingPhase: PricingPhase = pricingBlockedReason ? "blocked"
    : !ready ? "needs"
    : routeError && !calculatingRoute ? "route_error"
    : !routeIsCurrent ? "route"
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
    vehicleTypeId: selectedVT?.id ?? null, vehicleType: truckName || null,
    weightKg: weightKg > 0 ? weightKg : null,
    fuelType, fuelZone: hasOfficialFuel ? (companyProfile?.fuel_zone === "COASTAL" ? "COASTAL" : "INLAND") : null,
    fuelCost, fuelLitres, fuelPricePerL, fuelConsumption,
    fuelPriceSource: fuelPriceSource === "missing" ? null : fuelPriceSource,
    emptyReturnCost: emptyReturn.included ? emptyReturn.total : null,
    costingFlags: {
      tolls_unknown: tollsOneWay == null && !tollsNone, tolls_confirmed_none: tollsNone,
      distance_estimated: distanceEstimated, distance_confirmed: distanceConfirmed,
      use_official_fuel: useOfficialDiesel, ...(aiFuelActive ? { fuel_price_override: aiFuel!.pricePerL } : {}),
      ...(emptyReturn.applicable ? { include_empty_return: emptyReturn.included } : {}),
    },
    tollCost, routePlazas: tollBreakdown.map(b => ({ plaza: b.plaza, route: b.route, tariff: Number(b.tariff) })),
    countryCodes: route?.country_codes ?? routeData?.countries ?? null,
    crossBorderCost, isInternational,
    pickupDate: pickupDate || null,
    // Only a figure the user typed (sent as an override); else the server prices the nights.
    driverAllowance: driverEdited ? driverAllowance : null,
    includeReturn: legs === 1 ? emptyReturn.included : null,
    yourPrice: total > 0 ? total : null,
  } : null;
  const pricing = usePricingAnalysis(pricingInputs, pricingPhase === "ready");
  // The price in the bar, read live against the last analysis.
  const liveReading = readPrice(pricing.data, total);
  // The bar's one price story: the build-up until a price is applied, then the
  // applied price (a choice, or the user's own).
  const atBuildUp = priceSet == null;
  const recChoice = pricing.data?.choices.find(c => c.recommended) ?? null;
  const appliedChoice = liveReading.matchedChoice ? pricing.data?.choices.find(c => c.key === liveReading.matchedChoice) ?? null : null;
  // "Use Balanced R 25 100" sits in the bar until a price is applied.
  const recLk = recChoice && pricing.data ? rowLikelihoods(pricing.data, pricing.data.choices).get(recChoice.key) ?? null : null;
  const recLessLikely = !!recLk && lkTone(recLk) === "less_likely";
  const useRec = atBuildUp && !!recChoice && !recLessLikely && liveReading.margin != null && Math.abs(recChoice.price - total) >= 0.005;

  // Put a price in the bar (the cost lines never change with it).
  const costSum = defaultPrice ?? 0;
  const applyPrice = (price: number) => {
    if (!(price >= 0) || !Number.isFinite(price)) return;
    setPriceSet(round2(price));
    setSavedPriceShown(false);
  };
  const resetPrice = () => { setPriceSet(null); setSavedPriceShown(false); };
  // No toast: the applied card ("In your quote") and the bar confirm it.
  const applyChoice = (price: number, _key: ChoiceKey) => { applyPrice(price); };
  // A reopened quote priced with the analysis: keep the price that was decided.
  useEffect(() => {
    const saved = savedFinalPriceRef.current;
    if (saved == null || !routeIsCurrent) return;
    savedFinalPriceRef.current = null;
    // To the cent: a quote saved at R 24 999,99 reopens at R 24 999,99, and a
    // no-change re-save stores the same total.
    setPriceSet(round2(saved));
    setSavedPriceShown(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIsCurrent]);
  // §11: costs changed since the quote was priced → one compact notice. The
  // floor is the one the panel shows (the server's), else the local costing.
  // One floor everywhere: the costing (the panel's floor is the same compute()).
  const floorNow = costing.floor;
  useEffect(() => {
    const sp = savedPricingRef.current;
    if (!sp || !routeIsCurrent || floorNow == null) return;
    savedPricingRef.current = null;
    const ch = changesSincePriced(sp.price, sp.floor, floorNow, sp.pricedAtRaw);
    if (!ch.changed || !ch.notice) return;
    setReopenNotice({ text: ch.notice, since: sp.pricedAt, reprice: ch.repriced_price_keep_margin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIsCurrent, floorNow]);

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

  // Saved line items still add up to the price: Base rate = price less the
  // pass-through lines (it carries operating costs and margin). Only a price
  // below the pass-throughs leaves a (negative) remainder in additional_charges.
  // The empty run home is part of the haul: it sits in Base rate, not in
  // "other charges" (the customer sees Base rate, Fuel, Tolls, Driver, Border).
  const savedPassThrough = fuelCost + tollCost + driverAllowance + crossBorderCost;
  const savedBase = Math.max(0, total - savedPassThrough);
  const savedBaseShortfall = Math.min(0, total - savedPassThrough);
  // §9: the server snapshots what the quote was priced on at every save; it
  // needs the costing inputs the quote fields don't carry (null keys drop).
  const costingInputsPayload = {
    distance_estimated: distanceEstimated, distance_confirmed: distanceConfirmed,
    tolls_unknown: tollsOneWay == null && !tollsNone, tolls_confirmed_none: tollsNone,
    include_empty_return: emptyReturn.applicable ? emptyReturn.included : null,
    use_official_fuel: useOfficialDiesel,
    fuel_price_override: aiFuelActive ? aiFuel!.pricePerL : null,
    vehicle_type_id: selectedVT?.id != null ? Number(selectedVT.id) : null,
    duration_minutes: durationMin != null ? Math.round(Number(durationMin)) : null,
    toll_cost_one_way: tollsOneWay != null ? round2(tollsOneWay) : null,
  };
  // Valid until: as set, else today + the company's quote validity.
  const validUntilToSave = validUntil || (() => {
    const d = new Date(); d.setDate(d.getDate() + (Number(companyProfile?.default_quote_validity_days) > 0 ? Number(companyProfile.default_quote_validity_days) : 7));
    return localDateISO(d);
  })();
  // ---- build the save payload (matches production) ----
  const buildPayload = (status: "DRAFT" | "SENT") => ({
    customer: parseInt(customerId), pickup_location: pickup, delivery_location: delivery,
    pickup_date: pickupDate || null, delivery_date: deliveryDate || null,
    origin: extractCode(pickup), destination: extractCode(delivery),
    pickup_lat: round6(pickupCoords?.lat), pickup_lng: round6(pickupCoords?.lon), delivery_lat: round6(deliveryCoords?.lat), delivery_lng: round6(deliveryCoords?.lon),
    // Required by the API; never the truck name (it came back as "cargo").
    cargo_description: cargo.trim() || "Not specified", weight: weightKg, distance,
    estimated_duration_minutes: route?.duration_min ? Math.round(route.duration_min) : (routeData?.duration_minutes || null),
    vehicle_type: truckName, base_rate: round2(savedBase), fuel_surcharge: round2(fuelCost), toll_charges: round2(tollCost),
    // International transport is zero-rated for VAT (the customer sees VAT 0%):
    // sent only when the route or a point's country says so either way.
    ...(internationalKnown ? { is_international: isInternational } : {}),
    driver_allowance: round2(driverAllowance), additional_charges: round2(crossBorderCost + savedBaseShortfall),
    total_amount: round2(total),
    // One margin definition: price − full cost floor (pricing analysis). Sent
    // only when the floor is known, so an edit never wipes a saved figure.
    ...(liveReading.marginPct != null ? { margin_percentage: Math.max(-999.99, Math.min(999.99, Math.round(liveReading.marginPct * 100) / 100)) } : {}),
    notes, status,
    sla_hours: Number(companyProfile?.default_sla_hours) || 48, valid_until: validUntilToSave, trip_type: tripType,
    // No heuristic win_probability any more: the server sets it from the
    // model's likelihood at the final price (model level only). What was shown
    // and picked is saved, additively, as pricing_decision.
    ...(pricing.data ? { pricing_decision: pricingDecision(pricing.data, total, liveReading.matchedChoice ?? "custom", defaultPrice != null ? round2(total - defaultPrice) : 0) } : {}),
    base_rate_per_km: chargeDistance > 0 ? round2(savedBase / chargeDistance) : null,
    costing_inputs: costingInputsPayload,
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
      fuel_price_source: fuelPriceSource,
      cost_floor: costing.floor, empty_return_cost: emptyReturn.total,
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
    if (isDemoQuotaExceeded) return "This demo session's quote is used. Log in again for a new one.";
    return null;
  };
  // Send (any path) is blocked by any block warning (§11).
  const sendBlocker = (): string | null => saveBlocker() ?? (blockWarnings[0]?.title || null);
  // Send emails the client: it opens a preview first and sends only on confirm.
  const [sendPreviewOpen, setSendPreviewOpen] = useState(false);
  const openSendPreview = () => {
    const blocker = sendBlocker();
    if (blocker) { toast.error(blocker); return; }
    setSendPreviewOpen(true);
  };

  const save = async (send: boolean) => {
    const blocker = send ? sendBlocker() : saveBlocker();
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
      queryClient.invalidateQueries({ queryKey: [SEND_CHECK_KEY] });
      if (quoteId) queryClient.invalidateQueries({ queryKey: ["quote", String(quoteId)] });
      navigate(quoteId ? `/bookings/quotes/${quoteId}` : "/bookings/quotes");
    } catch (e: unknown) { toast.error(sendBlockedMessage(e) || (e as { message?: string } | null)?.message || "Couldn't save the quote"); }
    finally { setSaving(false); }
  };

  // §10 warning actions (one handler for every surface).
  const runWarningAction = (id: string) => {
    switch (id) {
      case "use_official": setUseOfficialDiesel(true); break;
      case "update_own": navigate("/settings/company#fuel"); break;
      case "update_allowance": navigate("/settings/company#pricing"); break;
      case "retry_diesel": queryClient.invalidateQueries({ queryKey: ["fuel-price-current"] }); break;
      case "enter_tolls": document.getElementById("qb-tolls-input")?.focus(); break;
      case "confirm_no_tolls": setTollsNone(true); break;
      case "recalculate_route": setDistanceConfirmed(false); calculateRoute(); break;
      case "confirm_distance": setDistanceConfirmed(true); break;
      case "enter_driver_cost": document.getElementById("qb-driver-input")?.focus(); break;
      case "enter_weight": document.getElementById("qb-weight-input")?.focus(); break;
      case "choose_vehicle": document.getElementById("qb-truck-select")?.focus(); break;
      case "edit_vehicle": case "add_vehicle": navigate("/fleet/vehicles"); break;
      case "use_minimum": if (minimumCharge != null) applyPrice(minimumCharge); break;
      case "reprice": if (reopenNotice?.reprice != null) { applyPrice(reopenNotice.reprice); setReopenNotice(null); } break;
      case "keep_price": setReopenNotice(null); break;
    }
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
            // Said only while a pin is still to be set (the hint box keeps its size).
            return activeFilled || !activeLabel
              ? null
              : <><Map size={13} aria-hidden="true" style={{ flexShrink: 0 }} /><span>{verb} to set <b style={{ fontWeight: 500, color: "var(--text-primary)" }}>{activeLabel}</b></span></>;
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
                  {formatNumber(Math.round(r.distance_km))} km
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 13, lineHeight: "20px", padding: "10px 12px", maxWidth: 220, borderRadius: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 12px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Distance</span><span>{Math.round(r.distance_km)} km</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Duration</span><span>{formatDuration(r.duration_minutes ?? r.duration_min)}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Tolls</span><span>{r.tolls_unavailable || r.tolls_unknown || r.toll_cost_zar == null ? "Unknown" : formatCurrency(r.toll_cost_zar)}</span>
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
  const showPriceBar = !billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && (total > 0 || blockWarnings.length > 0);

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
            {/* An unsaved draft from earlier is offered here, inline: the form never moves. */}
            {resumable && !isEditing ? (
              <span className="qb-resume-inline">
                Unsaved draft{resumable.pickup ? `: ${resumable.pickup}${resumable.delivery ? ` → ${resumable.delivery}` : ""}` : ""}
                <button type="button" className="qb-linkbtn qb-linkbtn--strong" onClick={applyResumable}>Resume</button>
                <button type="button" className="qb-linkbtn" onClick={discardResumable}>Discard</button>
              </span>
            ) : saving ? "Saving…" : isEditing || savedQuoteId ? "Saved" : lastSavedAt ? `Draft on this device · ${formatDateTime(lastSavedAt).split(", ")[1]}` : "Not saved"}
          </span>
        }
        // On a new quote the page itself is the new quote: no second "New quote".
        actions={isEditing || savedQuoteId ? (
          <button type="button" className="tw-btn" onClick={startNew} title="Start a fresh quote">
            New quote
          </button>
        ) : undefined}
      />

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
              placeholder={narrowNl ? "e.g. 28 t steel, Joburg to Durban" : "Describe the load, e.g. 28 t steel coils Joburg to Durban"} aria-label="Describe the load" style={{ ...inputS, border: "none", background: "transparent", paddingLeft: 4, minWidth: 0 }} />
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
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 15" style={inputS} aria-label="Weight in tonnes" id="qb-weight-input" />
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
            Outside SA, and cross-border is off in settings.
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
            <div style={fieldLabelS}><span>Truck</span>{!authUser?.is_demo && <button type="button" className="qb-textbtn qb-textbtn--label" aria-label="New vehicle type" onClick={() => navigate("/fleet/vehicles")}><Plus size={12} aria-hidden="true" />New</button>}</div>
            <div className="qb-select">
            {/* §3: always a real truck. "" = the suggested one for the load. */}
            <select value={vehicleType} onChange={e => applyVehicleType(e.target.value)} style={inputS} aria-label="Truck" id="qb-truck-select">
              <option value="">{suggestedVT ? `${sentenceCaseLabel(suggestedVT.name)}${capacityTonnes(suggestedVT.capacity) ? ` (${capLabel(capacityTonnes(suggestedVT.capacity))})` : ""} · auto` : allVehicleTypes.length ? "Pick a truck" : "No trucks yet"}</option>
              {allVehicleTypes.map((v: any) => (
                <option key={v.id || v.name} value={v.name}>{sentenceCaseLabel(v.name)}{capacityTonnes(v.capacity) ? ` (${capLabel(capacityTonnes(v.capacity))})` : ""}</option>
              ))}
              {vehicleType && !allVehicleTypes.some((v: any) => v.name === vehicleType) && <option value={vehicleType}>{sentenceCaseLabel(vehicleType)}</option>}
            </select>
            <ChevronDown size={14} className="qb-select__chev" aria-hidden="true" />
            </div>
          </div>
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span>Cargo</span></div><input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="e.g. palletised steel" style={inputS} aria-label="Cargo" /></div>
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span id="qb-trip-label">Trip</span></div>
            {/* The shared segmented control: neutral track, raised active option. */}
            <div className="tw-seg tw-seg--block qb-trip" role="group" aria-labelledby="qb-trip-label">
              {(["ONE_WAY", "ROUND_TRIP"] as const).map(t => <button key={t} type="button" onClick={() => setTripType(t)} aria-pressed={tripType === t} className={`tw-seg__opt${tripType === t ? " is-active" : ""}`}>{t === "ONE_WAY" ? "One way" : <><span className="qb-trip-long">Round trip, loaded</span><span className="qb-trip-short">Round, loaded</span></>}</button>)}
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
              <h2 id="qb-cost-title" className="qb-cost__title">Costs</h2>
            </div>
            {billingBlocked && (
              <div className="qb-cost__state">
                <p className="qb-cost__state-title">Quoting is blocked</p>
                <p className="qb-cost__state-text">{subscriptionStatusDetail(authUser?.subscription_status)}</p>
                <button type="button" onClick={() => navigate("/settings/billing")} className="btn-action">Go to billing</button>
              </div>
            )}
            {!billingBlocked && !ready && (
              <p className="qb-cost__empty">Add client, route and weight.</p>
            )}
            {!billingBlocked && ready && isDemoQuotaExceeded && (
              <div className="qb-cost__state"><p className="qb-cost__state-title">Demo quota reached</p></div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && routeBlockedMessage && (
              <div className="qb-cost__state">
                <p className="qb-cost__state-title">Route not allowed</p>
                <p className="qb-cost__state-text">{routeBlockedMessage}</p>
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && calculatingRoute && !routeIsCurrent && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                <Loader size={44} label="Calculating route…" />
              </div>
            )}
            {!billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage && !(calculatingRoute && !routeIsCurrent) && (() => {
              // ONE cost model: these lines are what the job costs; they add up
              // to the cost floor. The price is in the bar.
              const opLine = costing.lines.find(l => l.key === "operating") ?? null;
              const opEstimate = opLine?.source === "vehicle_default";
              const money = (v: number | null | undefined) => (v == null ? "—" : formatMoneyWhole(v));
              const rIn = (node: React.ReactNode) => <span className="qb-cost__money"><span aria-hidden="true">R</span>{node}</span>;
              return (<>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Operating costs
                  {opEstimate && <span className="qb-cost__tag">Estimate</span>}
                  <InfoPop label="Operating costs working" title="Operating costs" rows={[
                    ["Rate", opLine?.rate_per_km != null ? `${formatCurrency(Number(opLine.rate_per_km))}/km` : "Not set"],
                    ["Distance", `${formatNumber(Math.round(chargeDistance))} km`],
                  ]} total={opLine?.amount != null ? ["Operating costs", money(opLine.amount)] : undefined} />
                </span>
                <span className="qb-cost__value">{money(opLine?.amount)}</span>
              </div>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Fuel
                  <InfoPop label="Fuel working" title="Fuel" rows={[
                    [fuelPriceKind === "Petrol" ? `Petrol${costing.diesel.grade ? ` ${costing.diesel.grade}` : ""}` : fuelPriceKind,
                      fuelPricePerL != null ? `${randPerLitre(fuelPricePerL)}/${fuelPriceKind === "Electric" ? "kWh" : "L"}` : "Missing"],
                    ...(fuelPricePerL != null ? [["Source", aiFuelActive ? "price check" : !hasOfficialFuel ? "your price" : dieselSourceNote(costing.diesel)] as [string, string]] : []),
                    ["Burn", fuelConsumption != null ? `≈ ${oneDp(fuelConsumption)} L/100 km` : "Not set"],
                    ["Distance", `${formatNumber(Math.round(chargeDistance))} km${legs === 2 ? " (both ways)" : ""}`],
                    ["Litres", fuelConsumption != null ? `≈ ${formatNumber(Math.round(fuelLitres))} L` : "—"],
                  ]} total={lineAmt("fuel") != null ? ["Fuel", money(fuelCost)] : undefined} />
                  {aiFuelActive && <button type="button" className="qb-linkbtn" onClick={() => setAiFuel(null)}>Reset</button>}
                  {useOfficialDiesel && <button type="button" className="qb-linkbtn" onClick={() => setUseOfficialDiesel(false)}>Use mine</button>}
                </span>
                <span className="qb-cost__value">{lineAmt("fuel") != null ? money(fuelCost) : "—"}</span>
              </div>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Tolls
                  <InfoPop label="Toll plazas" title="Toll plazas" rows={tollBreakdown.length
                    ? tollBreakdown.map(b => [b.plaza, formatCurrency(b.tariff)] as [string, string])
                    : [[routeTollsUnknown ? "Lookup failed" : "None on this route", ""]]}
                    total={tollBreakdown.length ? [legs === 2 ? "Both ways" : "One way", money(tollBreakdownOneWay * legs)] : undefined} />
                  {aiTollActive && !tollManuallyEdited && <button type="button" className="qb-linkbtn" onClick={() => setAiToll(null)}>Reset</button>}
                </span>
                {rIn(<NumberField id="qb-tolls-input" decimals={0} value={tollManuallyEdited ? (editableTollCost === "" ? null : Number(editableTollCost)) : lineAmt("tolls")}
                  placeholder="Unknown"
                  onValue={(n) => { setEditableTollCost(n == null ? "" : String(n)); setTollManuallyEdited(true); }}
                  aria-label="Tolls (R)" aria-invalid={lineAmt("tolls") == null || undefined} className={`qb-mini qb-cost__input${lineAmt("tolls") == null ? " is-missing" : ""}`} />)}
              </div>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Driver allowance{driverNights != null && driverNights > 0 && <span className="qb-cost__meta">{driverNights} night{driverNights === 1 ? "" : "s"}</span>}
                  {driverEdited && driverLineC?.suggested != null && Math.abs(driverAllowance - Number(driverLineC.suggested)) >= 0.5 && (
                    <button type="button" className="qb-linkbtn" onClick={() => { setDriverEdited(false); setDriverAllowanceInput(""); }}>Reset</button>
                  )}
                </span>
                {rIn(<NumberField id="qb-driver-input" decimals={0} value={driverEdited ? (driverAllowanceInput === "" ? null : Number(driverAllowanceInput) || 0) : driverLineC?.amount ?? null}
                  placeholder="Needed"
                  onValue={(n) => { setDriverAllowanceInput(n == null ? "" : String(n)); setDriverEdited(true); }}
                  aria-label="Driver allowance (R)" className={`qb-mini qb-cost__input${driverLineC?.amount == null ? " is-missing" : ""}`} />)}
              </div>
              {crossBorderCost > 0 && (() => {
                const items = routeData?.cross_border_breakdown || [];
                const rows = items.length
                  ? items.filter(it => it.amount > 0).map(it => [it.description, formatCurrency(it.amount)] as [string, string])
                  : ([["Border fees", routeData?.additional_costs?.border_fees || 0], ["Weighbridge", routeData?.additional_costs?.weighbridge_fees || 0], ["Non-SA tolls", routeData?.additional_costs?.non_sa_tolls || 0]] as [string, number][])
                    .filter(([, v]) => v > 0).map(([k, v]) => [k, formatCurrency(v)] as [string, string]);
                return (
                  <div className="qb-cost__row">
                    <span className="qb-cost__label">
                      Border fees
                      <InfoPop label="Border charges" title={routeData?.countries?.length ? routeData.countries.join(" → ") : "Border charges"} rows={rows}
                        total={["Border fees", money(crossBorderCost)]} />
                    </span>
                    <span className="qb-cost__value">{money(crossBorderCost)}</span>
                  </div>
                );
              })()}
              {emptyReturn.applicable && (
                <div className="qb-cost__row">
                  <span className="qb-cost__label">
                    Truck comes back
                    <span className="tw-seg tw-seg--sm qb-cost__seg" role="group" aria-label="Truck comes back">
                      {([["Empty", false], ["Loaded", true]] as const).map(([lbl, booked]) => (
                        <button key={lbl} type="button" aria-pressed={returnLoadBooked === booked} onClick={() => setReturnLoadBooked(booked)}
                          className={`tw-seg__opt${returnLoadBooked === booked ? " is-active" : ""}`}>{lbl}</button>
                      ))}
                    </span>
                    {emptyReturn.included && (
                      <InfoPop label="Empty return working" title={`${formatNumber(Math.round(distance))} km back empty`}
                        rows={emptyReturn.lines.map(l => [l.label.replace(/, empty return$/, ""), l.amount != null ? formatCurrency(l.amount) : "Unknown"] as [string, string])}
                        total={["Empty return", money(emptyReturn.total)]} />
                    )}
                  </span>
                  <span className={`qb-cost__value${emptyReturn.included ? "" : " is-off"}`}>{emptyReturn.included ? money(emptyReturn.total) : "—"}</span>
                </div>
              )}
              <div className="qb-cost__row qb-cost__total-row">
                <span className="qb-cost__label">Cost floor</span>
                <span className="qb-cost__value">{costing.floor != null ? money(costing.floor) : "Incomplete"}</span>
              </div>
              </>);
            })()}
          </section>
      </div>

      </div>

      {/* 3 — pricing analysis */}
      <aside className="qb-aside" aria-label="Pricing analysis" ref={asideRef}>
        <PricingPanel
          state={pricing}
          phase={pricingPhase}
          blockedReason={pricingBlockedReason}
          paused={blockWarnings.length > 0}
          needs={pricingNeeds}
          customerName={customers.find((c: any) => String(c.id) === String(customerId))?.name ?? null}
          price={settledTotal}
          distanceKm={distance}
          buildUp={costSum}
          settingsHref="/settings/company#pricing"
          onApplyPrice={applyChoice}
          driver={{
            value: driverEdited ? driverAllowanceInput : String(driverAllowance),
            edited: driverEdited,
            onChange: (v) => { setDriverAllowanceInput(v); setDriverEdited(true); },
            onReset: () => { setDriverEdited(false); setDriverAllowanceInput(""); },
          }}
          buildUpDriver={driverAllowance}
          includeReturn={emptyReturn.included}
          onIncludeReturn={(v) => setReturnLoadBooked(!v)}
          returnApplicable={emptyReturn.applicable}
          revealKey={`${pickup}|${delivery}|${selectedVT?.id ?? truckName}|${tripType}|${customerId}`}
          atBuildUp={atBuildUp}
        />
      </aside>

      <div className="qb-after">
      {/* notes: above the price bar so they are filled in before sending */}
      {ready && <div style={{ marginBottom: 16 }}><div style={fieldLabelS}><label htmlFor="qb-notes">Notes</label></div><textarea id="qb-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ ...inputS, resize: "vertical" }} /></div>}
      </div>
      </div>

      {/* One price, next to Send. Fixed to the window's foot on desktop
          (sticky on narrower screens) so Send stays in reach. */}
      {showPriceBar && (() => {
        const data = pricing.data;
        const floorKnown = costing.floor != null;
        const ready = floorKnown && liveReading.margin != null;
        const waiting = floorKnown && !ready && (pricing.status === "loading" || pricing.status === "refreshing" || pricing.status === "idle" || pricingPhase === "route");
        // The bar's figures: the choice's own at a choice price, the server's
        // at a settled custom price, else a neutral client reading.
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
        const blocked = blockWarnings.length > 0;
        const sendPrimary = !blocked && !waiting;
        const chipLabel = priceTyping ? "Your price" : atBuildUp ? "Target" : savedPriceShown ? "Saved price" : appliedChoice ? appliedChoice.label : "Your price";
        // Line 1: margin and chance to win, and the next price as a chip.
        // Line 2 (always reserved, so nothing moves): block > reopen > warn.
        const chip = !ready || priceTyping ? null
          : wayOut ? { label: `Use ${wayOut.label} ${formatMoneyWhole(wayOut.price)}`, price: wayOut.price }
          : useRec ? { label: `Use ${recChoice!.label} ${formatMoneyWhole(recChoice!.price)}`, price: recChoice!.price }
          : null;
        const line2 = blocked ? <WarnLine list={quoteWarnings} onAction={runWarningAction} />
          : reopenNotice ? (
            <span className="qb-pricebar__next qb-pricebar__notice" role="status">
              <span>{reopenNotice.text}</span>
              <button type="button" className="qb-linkbtn" onClick={() => setReopenNotice(null)}>Keep price</button>
              {reopenNotice.reprice != null && <button type="button" className="qb-linkbtn qb-linkbtn--strong" onClick={() => { applyPrice(Math.ceil(reopenNotice.reprice! - 1e-9)); setReopenNotice(null); }}>Re-price</button>}
            </span>)
          : quoteWarnings.length > 0 ? <WarnLine list={quoteWarnings} onAction={runWarningAction} />
          : null;
        return (
        <section ref={priceBarRef} className={`qb-pricebar${barCompact ? " is-compact" : ""}${atBuildUp && !priceTyping ? " is-buildup" : ""}`} aria-label="Quote price and send"
          onClick={() => { if (barCompact) setBarCompact(false); }}>
          <div className="qb-pricebar__price">
            <label className="qb-pricebar__label" htmlFor="qb-price-input">Price · excl. VAT</label>
            <span className="qb-pricebar__field">
              <span className="qb-pricebar__cur" aria-hidden="true">R</span>
              <NumberField id="qb-price-input" className="qb-pricebar__input" aria-describedby="qb-price-read" decimals={0}
                value={total > 0 ? total : null} placeholder="—"
                onFocus={() => setBarCompact(false)}
                onBlur={() => settlePrice()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
                onValue={(n) => onPriceInput(n)} />
            </span>
            <span className="qb-pricebar__sub qb-pricebar__src">
              <span className="qb-pricebar__chip">{chipLabel}</span>
              {!(atBuildUp && !priceTyping) && <button type="button" className="qb-linkbtn" onClick={resetPrice}>Reset</button>}
              {altReturnPrice != null && (
                <button type="button" className="qb-linkbtn qb-pricebar__alt" onClick={() => setReturnLoadBooked(v => !v)}
                  title={emptyReturn.included ? "Price if a load comes back" : "Price if the truck comes back empty"}>
                  {emptyReturn.included ? "Loaded back" : "Empty back"} {formatMoneyWhole(altReturnPrice)}
                </button>
              )}
            </span>
          </div>
          <div className="qb-pricebar__read" id="qb-price-read" aria-live="off">
            <span className={`qb-pricebar__line${settled ? "" : " is-neutral"}${loss ? " qb-pricebar__loss" : ""}`}>
              {!ready ? (
                <span className="qb-pricebar__muted">{waiting && !blocked ? "Working out margin…" : "Margin unavailable"}</span>
              ) : below ? (
                <span>Loss <span className="qb-pricebar__num">{formatMoneyWhole(-margin!)}</span></span>
              ) : (
                <span>Margin <span className="qb-pricebar__num">{formatMoneyWhole(margin)} · {signedPct(marginPct ?? 0)}</span></span>
              )}
              {ready && showLk && (
                <span className={`qb-pricebar__lk qb-pricebar__lk--${lkTone(lk!)}`}>{likelihoodShort(lk!)}</span>
              )}
              {chip && (
                <button type="button" className="qb-pricebar__usechip" onClick={() => applyPrice(chip.price)}>{chip.label}</button>
              )}
            </span>
            <span className="qb-pricebar__warnline">{line2}</span>
          </div>
          <div className="qb-pricebar__actions">
            <button type="button" className="tw-btn qb-pricebar__save" onClick={() => save(false)} disabled={saving}>
              <span className="qb-lbl-long">Save draft</span><span className="qb-lbl-short">Save</span>
            </button>
            {/* Blocked: Send is off and says why. */}
            <button type="button" className={`tw-btn${sendPrimary ? " tw-btn--primary" : ""}`} onClick={openSendPreview}
              disabled={saving || blocked} title={blocked ? blockWarnings[0].title : undefined}>Send</button>
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
              valid_until: validUntilToSave,
            }}
            sending={saving}
            warnings={[...quoteWarnings, ...costingAtPrice.warnings.filter(w => w.code === "below_floor"),
              ...(reopenNotice && reopenNotice.since && reopenNotice.since < currentPeriodStartIso()
                ? [{ code: "priced_earlier_period", severity: "warn" as const, title: "Priced on last period's diesel", actions: [] }] : [])]}
            onCancel={() => setSendPreviewOpen(false)}
            onConfirm={async () => { await save(true); setSendPreviewOpen(false); }}
          />
        );
      })()}

      <AIChatPanel messages={chatMessages} busy={nlBusy} open={chatOpen} onOpenChange={setChatOpen} onSend={(t, lang) => submitNL(t, lang)} launcherSlot={chatSlot} />
    </div>
  );
}
