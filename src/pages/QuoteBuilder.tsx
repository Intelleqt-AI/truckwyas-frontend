import "@/components/layout/section-header.css";
import { isForeignCountry, tripIsInternational } from "@/lib/tripInternational";
import { savedRouteMatches, savedBorderOverride, reuseSavedRoute } from "@/lib/savedRoute";
import { borderCostsUnknown } from "@/lib/borderUnknown";
import { routeChipLabel, borderTotalWithAgentFee, tripBorderEstimate, borderEstimate, abnormalLoadRelevant, type TollItem, type BorderItem } from "@/lib/routeTolls";
import { TollPop, BorderPop } from "@/components/pricing/RouteCostPops";
import SectionHeader from "@/components/layout/SectionHeader";
import "./quote-invoice-roles.css";
import { localDateISO } from '@/lib/dates';
import "./quote-builder-controls.css";
import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, patchData, fetchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { formatCurrency, formatMoneyWhole, formatNumber, formatDateTime, sentenceCaseLabel } from "@/lib/formatters";
import { DatePicker } from "@/components/ui/date-picker";
import { fuelInputFor, fuelKind, dieselSourceNote, randPerLitre, currentPeriodStartIso, isoDay, shortDate, type QuoteWarning } from "@/lib/dieselPrice";
import { compute, changesSincePriced, fmtNum, suggestTruck, capacityTonnes, vehicleClass, CLASS_OPERATING_DEFAULTS, cents, type CostingInputs, type DieselInput } from "@/lib/quoteRules";
import { useCostBreakdown } from "@/components/pricing/useCostBreakdown";
import { sendBlockedMessage, SEND_CHECK_KEY } from "@/lib/quoteWarnings";
import { ownDieselImpactText } from "@/lib/quoteStatus";
import { LocationInput, type LocationCoords } from "@/components/LocationInput";
import { RouteMapView } from "@/components/RouteMapView";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { DescribeFeedback, VoiceListening } from "@/components/pricing/DescribeFeedback";
import { vt, uiLangFrom, loadLangMode, saveLangMode, nextLangMode, langModeText, isConflict, samePlace, sameText, saNum,
  shortDate as nlDate, borderPostShort, spokenPlace, FIELD_LABELS, didntCatchLine, isLow,
  type UiLang, type VoiceLangMode, type FieldTarget, type ConflictLine, type AppliedSummary, type FillInfo } from "@/lib/voiceQuote";
import { AIChatPanel, type ChatMessage } from "@/components/AIChatPanel";
import { useAuth } from "@/lib/AuthContext";
import { isSubscriptionBlocked, subscriptionStatusDetail } from "@/lib/subscriptionStatus";
import { MessageCircle, Map, Info, Maximize2, Mic, Square, X, Plus, GripVertical, ChevronDown, ChevronUp, AlertTriangle, Pencil } from "lucide-react";
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

type TollBreakdownItem = TollItem & { route: string; location_km: number };
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
const impactText = ownDieselImpactText;

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
          <button type="button" className="qb-warn__title">{w.title}{impactText(w) ? <span className="qb-warn__more"> · {impactText(w)!.replace(" on this quote.", "")}</span> : null}{sorted.length > 1 ? <span className="qb-warn__more"> +{sorted.length - 1} more</span> : null}</button>
        </PopoverTrigger>
        {/* Above the whole bar, never over its margin line. */}
        <PopoverContent align="start" side="top" sideOffset={48} className="qb-pop qb-pop--warn">
          {sorted.map((x) => (
            <div key={x.code} className="qb-pop__warn">
              <div className={`qb-pop__warn-title is-${x.severity}`}>{x.title}</div>
              {(x.detail || impactText(x)) && <div className="qb-pop__warn-detail">{[x.detail, impactText(x)].filter(Boolean).join(" ")}</div>}
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
  /** "Fastest · via N17/N3 (plazas) · tolls R 887" (the server's). */
  toll_summary?: string | null; toll_plazas?: string[]; tolls_unavailable_reason?: string | null;
  // Each option's own border data and way back (newer servers).
  cross_border?: boolean; countries?: string[];
  additional_costs?: { border_fees?: number; weighbridge_fees?: number; non_sa_tolls?: number };
  cross_border_breakdown?: BorderItem[];
  border_costs_unknown?: { countries?: string[]; crossings?: string[] } | null;
  border_vehicle_profile?: BorderVehicleProfile | null;
  return_leg?: ReturnLeg | null;
}
/** What the border charges assumed about the truck (gross mass, axles). */
interface BorderVehicleProfile { gross_assumed?: boolean; assumptions?: { field: string; message: string }[] }
/** The way home, priced on its own TomTom route (include_return). */
interface ReturnLeg {
  available?: boolean; distance_km?: number; toll_cost_zar?: number | null; tolls_unknown?: boolean;
  tolls_unavailable_reason?: string | null; toll_breakdown?: TollBreakdownItem[];
  additional_costs?: { border_fees?: number; weighbridge_fees?: number; non_sa_tolls?: number };
  cross_border_breakdown?: BorderItem[];
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
  cross_border_breakdown?: BorderItem[];
  /** Countries / crossings on the route with no border figures on file (codes). */
  border_costs_unknown?: { countries?: string[]; crossings?: string[] } | null;
  border_costs_complete?: boolean;
  toll_breakdown?: TollBreakdownItem[]; warnings?: string[];
  origin_resolved?: string; dest_resolved?: string;
  stops_count?: number;
  /** "estimated" = straight-line fallback (routing failed). */
  source?: string; distance_estimated?: boolean;
  tolls_unavailable?: boolean; tolls_unknown?: boolean; toll_warning?: string | null;
  tolls_unavailable_reason?: string | null;
  /** Toll amounts are incl. VAT (a company not registered for VAT). */
  toll_cost_includes_vat?: boolean; toll_sanral_class?: number | null;
  /** The trip date is after the newest published toll schedule. */
  toll_schedule_warning?: { message?: string } | string | null;
  return_leg?: ReturnLeg | null;
  border_vehicle_profile?: BorderVehicleProfile | null;
}

// ---- display-only formatting (render strings only; never read back into
// state or any calculation) ----
/** Vehicle capacity at render: "20 t", "7,5 t" (house style, not "20.00t"). */
const capLabel = (c: unknown) => `${formatNumber(Number(c), { maximumFractionDigits: 1 })}\u00a0t`;
/** prefers-reduced-motion: the recording bars become a static level dot. */
function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** One field a Fill would set: applied now, or after Replace when it is a conflict. */
interface NlChange { target: FieldTarget; conflict: ConflictLine | null; apply: () => void; revert: () => void; filled: string | null; summary: AppliedSummary }

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
  // Nights out set for this quote (Describe the load "3 nights out — Apply"):
  // the costing prices these nights at the allowance, and the line reads
  // "3 nights". A typed driver figure still wins. Saved as driver_nights.
  const [driverNightsSet, setDriverNightsSet] = useState<number | null>(null);
  // §5: a one-way trip ≥ the company's minimum km includes the empty return
  // unless a return load is booked.
  const [returnLoadBooked, setReturnLoadBooked] = useState(false);
  // §6: unknown tolls / an estimated distance block until fixed or confirmed.
  const [tollsNone, setTollsNone] = useState(false);
  // Border costs typed for this quote (all legs); "" = the route's.
  const [borderTyped, setBorderTyped] = useState("");
  // The user's own clearing-agent fee (per crossing), in place of the route's agent estimate.
  const [agentFee, setAgentFee] = useState<number | null>(null);
  // Zimbabwe: an abnormal load (e.g. a low-bed carrying machinery) pays the
  // Abnormal border access toll; legal interlinks up to 56 t pay the goods vehicle toll.
  const [abnormalLoad, setAbnormalLoad] = useState(false);
  // Tolls are a figure, not a box: an explicit edit (pencil) opens the input.
  const [tollEditing, setTollEditing] = useState(false);
  const [fuelRefreshing, setFuelRefreshing] = useState(false);
  const [distanceConfirmed, setDistanceConfirmed] = useState(false);
  // diesel_own_off "Use official" for this quote only.
  const [useOfficialDiesel, setUseOfficialDiesel] = useState(false);
  // The price in the bar, when the user (or a choice, or a reopened quote)
  // set one; null = the default price (cost floor + target margin).
  const [priceSet, setPriceSet] = useState<number | null>(null);
  // The bar's chip says "Saved price" for a reopened quote's own price.
  const [savedPriceShown, setSavedPriceShown] = useState(false);
  // The analysis' suggested choice price and the floor it was made for.
  const [analysisSuggested, setAnalysisSuggested] = useState<{ price: number; floor: number | null } | null>(null);
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
  // A reopened quote's saved border line (all legs), restored as typed once
  // the route is in when the route's own figure differs: a figure the user
  // typed must survive a reopen (it is saved in costing_inputs.border_cost).
  const savedBorderRef = useRef<number | null>(null);
  // The border figure the reopen notice must wait for (it compares floors).
  const borderRestoreRef = useRef<string | null>(null);
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
  // ---- Describe the load: language, what a Fill set, Replace / Keep, Undo ----
  // Voice language chip (Auto / English / Afrikaans), remembered per device.
  const [langMode, setLangModeState] = useState<VoiceLangMode>(() => loadLangMode());
  const setLangMode = (m: VoiceLangMode) => { setLangModeState(m); saveLangMode(m); };
  // The voice UI and chips speak Afrikaans after an Afrikaans answer.
  const [uiLang, setUiLang] = useState<UiLang>("en");
  // "Heard in Afrikaans" under the bar after a voice clip.
  const [heard, setHeard] = useState<{ label: string | null; confidence: string | null } | null>(null);
  // What the last Fill set (chips), what it didn't catch, and its suggestions.
  const [fillInfo, setFillInfo] = useState<FillInfo | null>(null);
  // Fields the user had set that the last Fill would change: Replace / Keep mine.
  const [nlConflict, setNlConflict] = useState<{ lines: ConflictLine[]; changes: NlChange[] } | null>(null);
  // Undo for 8 s after a Fill: restores the exact pre-Fill values it changed.
  const [nlUndo, setNlUndo] = useState<{ reverts: (() => void)[]; at: number } | null>(null);
  // The one polite live region's text (status, then the reply once).
  const [nlLive, setNlLive] = useState("");
  // The value each field last got from a Fill: equal to it = Fill-set, so a
  // follow-up ("make it 30 ton") replaces it without asking.
  const nlFilledRef = useRef<Partial<Record<FieldTarget, string>>>({});
  // Toggles have a default, so only a click makes them the user's own.
  const nlTouchedRef = useRef<Set<FieldTarget>>(new Set());
  // Cross-border as said, used only while no geocoded country is known; the
  // border post shows in the border line's hint.
  const [nlInternational, setNlInternational] = useState<boolean | null>(null);
  const [nlBorderPost, setNlBorderPost] = useState<string | null>(null);
  // How a filled place was said, when it differs from the geocoded name
  // ("Kaapstad" for Cape Town): a small hint under the field.
  const [nlSaid, setNlSaid] = useState<{ pickup?: string; delivery?: string }>({});
  const nlInputRef = useRef<HTMLInputElement | null>(null);
  const nlReplaceRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
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
  // "+ New" opens the client / truck page in a new tab: coming back refreshes
  // these lists, so what was just added is there to pick.
  const { data: customersRaw } = useQuery({ queryKey: ["customers"], queryFn: () => fetchData("api/v1/customers/"), refetchOnWindowFocus: "always" });
  const { data: vehicleTypesRaw } = useQuery({ queryKey: ["vehicle-types"], queryFn: () => fetchData("api/v1/vehicle-types/"), refetchOnWindowFocus: "always" });
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
  // A cross-border trip (route or any point outside SA): no border cost blocks.
  // The chosen route option's own border lines, countries and way back (a
  // direct SA→Namibia option has no Botswana charges); older servers send
  // them for the fastest route only, at the top level.
  const optB = routeData?.routes?.[selectedRouteIndex];
  const routeB: RouteOption | RouteData | null = optB && "cross_border" in optB ? optB : routeData;
  const tripPoints = [pickupCoords?.country_code, deliveryCoords?.country_code, ...stops.map(st => st.coords?.country_code)];
  // A cross-border trip said in Describe the load counts only while nothing
  // geocoded or routed says which countries the trip touches.
  const countryKnown = !!routeB || tripPoints.some(Boolean);
  const tripInternational = tripIsInternational(routeB, tripPoints) || (!countryKnown && nlInternational === true);
  // Parts of the route with no border figures on file (e.g. Angola): the
  // costing blocks until the user enters the border costs (their own figure
  // then covers every crossing). Sent on every costing call and saved.
  const borderUnknown = borderCostsUnknown(routeB?.border_costs_unknown, routeB?.cross_border_breakdown);
  const borderCostIsOverride = borderTyped !== "";
  // The server prices driver nights at the cross-border allowance on an
  // international trip, so it must be told (every cost-breakdown call).
  const breakdownPayload = customerId && pickupCoords && deliveryCoords && loadT > 0 && preDistance > 0 ? {
    is_international: tripInternational,
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
  // The way home on its own route (asked for with include_return): its own
  // plazas and the exit-only border charges.
  const returnLegRaw = routeB?.return_leg ?? routeData?.return_leg ?? null;
  // What the border charges assumed about the truck ("Assumed 56 t gross — set your truck's gross mass").
  const borderAssumptions = (routeB?.border_vehicle_profile?.assumptions ?? []).map(a => a.message).filter(Boolean);
  const returnLeg = returnLegRaw?.available ? returnLegRaw : null;
  const returnTolls: number | null = returnLeg && !returnLeg.tolls_unknown && returnLeg.toll_cost_zar != null ? Number(returnLeg.toll_cost_zar) : null;
  // The route's own toll figure (not a typed or market one) can use the return leg's.
  const routeTollsInUse = !tollManuallyEdited && !aiTollActive;
  const borderSum = (ac?: { border_fees?: number; weighbridge_fees?: number; non_sa_tolls?: number }) =>
    (ac?.border_fees || 0) + (ac?.weighbridge_fees || 0) + (ac?.non_sa_tolls || 0);
  const routeBorderOut = borderTotalWithAgentFee(routeB?.cross_border_breakdown, borderSum(routeB?.additional_costs), agentFee);
  const routeBorderBack: number | null = returnLeg?.additional_costs
    ? borderTotalWithAgentFee(returnLeg.cross_border_breakdown, borderSum(returnLeg.additional_costs), agentFee) : null;
  // Loaded leg(s): a round trip's way back on its own charges when priced.
  const routeBorderLoaded = tripType === "ROUND_TRIP" ? routeBorderOut + (routeBorderBack ?? routeBorderOut) : routeBorderOut;
  const borderLoaded = borderTyped !== "" ? (Number(borderTyped) || 0) : routeBorderLoaded;
  const borderEmptyBack: number | null = tripType !== "ROUND_TRIP" && borderTyped === "" ? routeBorderBack : null;
  const borderEstimated: number | null = borderTyped !== "" ? null
    : tripBorderEstimate(routeB?.cross_border_breakdown, returnLeg?.cross_border_breakdown, agentFee, tripType === "ROUND_TRIP");
  // The empty run home's estimated part (its own exit-only lines).
  const borderEstimatedBack: number | null = borderEmptyBack != null ? (borderEstimate(returnLeg?.cross_border_breakdown, agentFee) || null) : null;
  const weightKg = loadT * 1000;

  // ---- company figures the costing needs: the server's resolution
  // (POST /quotes/cost-breakdown/) when in, else the profile's own ----
  // 2nd request: the costing for the truck actually priced (same query when
  // the truck was chosen). Its company figures are used only for that truck.
  const serverBreakdown = useCostBreakdown(breakdownPayload && selectedVT
    ? { ...breakdownPayload, vehicle_type_id: selectedVT.id ?? null, vehicle_type: selectedVT.name,
        cross_border_cost: Math.round(borderLoaded * 100) / 100,
        ...(borderEmptyBack != null ? { cross_border_cost_empty_return: borderEmptyBack } : {}),
        ...(borderEstimated ? { cross_border_estimate_zar: borderEstimated } : {}),
        ...(borderEstimatedBack ? { cross_border_estimate_empty_return_zar: borderEstimatedBack } : {}),
        ...(pickupDate ? { pickup_date: pickupDate } : {}),
        abnormal_load: abnormalLoad,
        ...(borderUnknown ? { border_costs_unknown: borderUnknown } : {}), border_cost_is_override: borderCostIsOverride } : null);
  const siRaw = serverBreakdown?.inputs ?? null;
  // The trip runs after the newest published toll schedule (route or server says so).
  const tollScheduleWarning: string | null = (() => {
    const w = routeData?.toll_schedule_warning;
    const fromRoute = typeof w === "string" ? w : w?.message ?? null;
    const fromServer = (serverBreakdown?.warnings as { code?: string; detail?: string; message?: string }[] | undefined)
      ?.find((x) => x?.code === "toll_tariffs_not_published");
    return fromRoute || fromServer?.detail || fromServer?.message || null;
  })();
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
    tolls: { one_way: tollsOneWay, lookup_failed: tollsOneWay == null && routeTollsUnknown, confirmed_none: tollsNone,
      empty_return: routeTollsInUse && tripType !== "ROUND_TRIP" ? returnTolls : null,
      return_leg: routeTollsInUse && tripType === "ROUND_TRIP" ? returnTolls : null },
    driver: { allowance_per_night: allowancePerNight, nights: driverEdited ? null : driverNightsSet, amount: driverEdited ? (driverAllowanceInput === "" ? null : Number(driverAllowanceInput) || 0) : null },
    hours_per_day: si?.hours_per_day ?? null,
    border_cost: borderLoaded,
    border_cost_empty_return: borderEmptyBack,
    border_estimate: borderEstimated,
    border_estimate_empty_return: borderEstimatedBack,
    border_costs_unknown: borderUnknown,
    border_cost_is_override: borderCostIsOverride,
    international: tripInternational,
    include_empty_return: returnLoadBooked ? false : null,
    settings: si?.settings ?? {
      include_empty_return_default: companyProfile?.include_empty_return_default ?? true,
      // 0 is a real setting (every one-way trip): only a missing value is null.
      empty_return_min_km: companyProfile?.empty_return_min_km != null && companyProfile.empty_return_min_km !== "" && Number.isFinite(Number(companyProfile.empty_return_min_km)) ? Number(companyProfile.empty_return_min_km) : null,
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
  // The suggested price IS a choice: no market → Safe, a real market → the
  // recommended choice (kept while the floor it was made for is unchanged).
  // Until the analysis answers, the costing's own default (same rounding).
  const defaultPrice: number | null = analysisSuggested && analysisSuggested.floor === costing.floor
    ? analysisSuggested.price : costing.default_price;
  const total = cents(priceSet ?? defaultPrice ?? 0);
  // The same costing at the price in the bar: margin, below floor / minimum.
  const costingAtPrice = total > 0 ? compute({ ...costingInputs, price: total }) : costing;
  // §5 the other trip shape, priced the same way: "Loaded back R 25 100".
  // Loaded back: the costing's alternative_with_return_load; empty back
  // (a return load is booked): the same costing with the empty return in.
  const altReturnPrice: number | null = !costing.trip.empty_return_default ? null
    : costing.trip.empty_return_included ? costing.alternative_with_return_load?.default_price ?? null
    : compute({ ...costingInputs, include_empty_return: true }).default_price;
  // Empty ↔ Loaded back. The switch changes what the trip costs, so a price
  // already set (applied, typed, or a reopened quote's) moves to the other
  // shape's price too, the figure the "Loaded back R x" button shows. With no
  // price set the bar follows the new default on its own.
  const setReturnShape = (booked: boolean) => {
    if (booked === returnLoadBooked) return;
    setReturnLoadBooked(booked);
    if (priceSet == null) return;
    if (altReturnPrice != null && altReturnPrice > 0) setPriceSet(Math.round(altReturnPrice * 100) / 100);
    else setPriceSet(null);
    setSavedPriceShown(false);
  };

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
  // A reopened quote's saved route (route_snapshot request + response): used
  // instead of a fresh calculation while collection, delivery, stops and
  // truck are what it was calculated for, so a just-saved quote reopens on
  // the same distance and tolls (a new lookup can differ: 410 vs 406 km).
  const restoreRouteRef = useRef<{ request: Record<string, unknown>; response: RouteData; index: number } | null>(null);
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
        // Tariffs in force on the trip date (SANRAL years run from 1 March).
        ...(pickupDate ? { trip_date: pickupDate } : {}),
        // The way home on its own route: a round trip's back leg, or the empty return.
        ...(wantReturnLeg ? { include_return: true } : {}),
        // The user's own clearing-agent fee replaces the agent estimate ("Your figure").
        ...(agentFee != null ? { clearing_agent_fee_zar: agentFee } : {}),
        abnormal_load: abnormalLoad,
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
  // The truck priced (chosen or suggested) shapes the route's tolls and class:
  // a change of truck is a new route, so a save is never priced on the old one.
  // A round trip, or a company whose one-way quotes include the empty return.
  const wantReturnLeg = tripType === "ROUND_TRIP" || companyProfile?.include_empty_return_default !== false;
  const routeRequestKey = JSON.stringify([pickupCoords?.lat, pickupCoords?.lon, deliveryCoords?.lat, deliveryCoords?.lon,
    truckName || "Flatbed", selectedVT?.id ?? null, stopsRouteKey, pickupDate || null, wantReturnLeg, abnormalLoad]);
  const routeIsCurrent = !!route && !calculatingRoute && lastRouteKeyRef.current === routeRequestKey;

  useEffect(() => {
    if (!ready || billingBlocked) return;
    if (calcRef.current) clearTimeout(calcRef.current);
    const saved = restoreRouteRef.current;
    if (saved && savedRouteMatches(saved.request, {
      pickup: pickupCoords, delivery: deliveryCoords, truckId: selectedVT?.id ?? null, truckName: truckName || "Flatbed",
      stops: stops.filter(st => st.coords).map(st => ({ lat: st.coords!.lat, lon: st.coords!.lon })),
    })) {
      restoreRouteRef.current = null;
      routeReqIdRef.current += 1; // a calculation already on its way is dropped
      setCalculatingRoute(false);
      lastRouteRequestRef.current = saved.request;
      lastRouteKeyRef.current = routeRequestKey;
      setRouteData(saved.response);
      setSelectedRouteIndex(saved.index);
      setRouteError(false);
      return;
    }
    calcRef.current = setTimeout(() => { calculateRoute(); }, 500);
    return () => { if (calcRef.current) clearTimeout(calcRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickupCoords, deliveryCoords, truckName, selectedVT?.id, billingBlocked, stopsRouteKey, pickupDate, wantReturnLeg, abnormalLoad]);

  // ---- natural-language input (typed or transcribed from voice) ----
  // Shared by the top quick-fill bar and the AI chat panel — both are just
  // different entry points into the same conversation, so every message
  // (whichever surface it came from) is recorded in chatMessages with real
  // history/current_fields sent to the backend for follow-up context.
  // The place a Fill names, geocoded the same way as a picked one: the field
  // shows the geocoded label (Cape Town), the coords carry the country.
  const geocodeNL = async (q: string): Promise<{ label: string; coords: LocationCoords } | null> => {
    const g = await fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(q)}`).catch(() => null);
    const s = g?.results?.[0] || g?.[0];
    return s ? { label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : q,
      coords: { lat: Number(s.lat), lon: Number(s.lon), ...(s.country_code ? { country_code: s.country_code } : {}) } } : null;
  };

  // Scrolls to a field and focuses it (the filled chips and the truck hint).
  const focusNlField = (target: FieldTarget, openPicker = false) => {
    const el = document.querySelector<HTMLElement>(`[data-nl-field="${target}"]`)
      ?? document.querySelector<HTMLElement>(`[data-nl-field="${target === "return" || target === "abnormal" ? "trip" : "pickup"}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    const f = el.matches("input, select, textarea, button") ? el : el.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button");
    f?.focus({ preventScroll: true });
    if (openPicker && f instanceof HTMLSelectElement) { try { (f as HTMLSelectElement & { showPicker?: () => void }).showPicker?.(); } catch { /* not supported: focused is enough */ } }
  };

  // Undo lasts 8 s from the last Fill (or Replace).
  useEffect(() => {
    if (!nlUndo) return;
    const t = setTimeout(() => setNlUndo(null), Math.max(0, nlUndo.at + 8000 - Date.now()));
    return () => clearTimeout(t);
  }, [nlUndo]);
  // The confirm takes focus when it appears, and gives it back to the bar after.
  useEffect(() => { if (nlConflict) nlReplaceRef.current?.focus(); }, [nlConflict]);

  const applyNlChanges = (changes: NlChange[]) => {
    for (const c of changes) { c.apply(); if (c.filled !== null) nlFilledRef.current[c.target] = c.filled; }
  };
  const undoNl = () => {
    if (!nlUndo) return;
    [...nlUndo.reverts].reverse().forEach(r => r());
    setNlUndo(null); setNlConflict(null); setFillInfo(null);
    nlInputRef.current?.focus();
  };
  const resolveNlConflict = (replace: boolean) => {
    const c = nlConflict;
    setNlConflict(null);
    if (c && replace) {
      applyNlChanges(c.changes);
      setFillInfo(prev => prev ? { ...prev, applied: c.changes.reduce((a, ch) => ({ ...a, ...ch.summary }), prev.applied) } : prev);
      setNlUndo(prev => ({ reverts: [...(prev?.reverts ?? []), ...c.changes.map(ch => ch.revert)], at: Date.now() }));
    }
    requestAnimationFrame(() => nlInputRef.current?.focus());
  };

  const submitNL = async (textOverride?: string, detectedLanguage?: string | null, alternateText?: string | null) => {
    const text = (textOverride ?? nlText).trim();
    if (!text) return;
    // Only the user's own turns go back as history: the assistant's replies
    // can name clients, and current_fields already carries the form.
    const history = chatMessages.filter(m => m.role === "user").map(m => ({ role: m.role, content: m.text }));
    setChatMessages(prev => [...prev, { role: "user", text }]);
    // The panel isn't opened for a Fill: the chips say what happened. It
    // opens only when the reply needs an answer (see below), or on request.
    setNlBusy(true);
    setNlLive(vt(uiLang, "reading"));
    setNlConflict(null);
    // A typed Fill: the last clip's badges no longer describe what is in the bar.
    if (!textOverride) { setHeard(null); voiceNoticeRef.current?.(); }
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
        // The other language's transcript (mixed speech): the backend fills
        // only what the main one missed from it, at lower confidence.
        ...(alternateText ? { alternate_text: alternateText } : {}),
      } });
      setPendingEntity(res?.pending_entity ?? null);
      if (res?.declined_entity) setDeclinedEntities(prev => [...prev, String(res.declined_entity).toLowerCase()]);
      const f = res?.extracted_fields || {};
      const conf: Record<string, number> = res?.field_confidence && typeof res.field_confidence === "object" ? res.field_confidence : {};
      const L = res?.language ? uiLangFrom(res.language) : uiLang;
      setUiLang(L);
      // A client/vehicle type just created via chat isn't in the cached
      // dropdown list yet — refetch so it actually appears as a selectable option.
      if (f.customer_id) queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (f.vehicle_type) queryClient.invalidateQueries({ queryKey: ["vehicle-types"] });

      // §4: every field this answer sets, compared with what the form holds.
      // Empty or Fill-set fields change now; the user's own values wait for
      // Replace / Keep mine. Same place written two ways is not a change.
      const labels = FIELD_LABELS[L];
      // Optional: how each place was said, when the server sends it.
      const spoken: Record<string, string | undefined> = res?.spoken_places && typeof res.spoken_places === "object" ? res.spoken_places : {};
      const filled = nlFilledRef.current;
      const changes: NlChange[] = [];
      const text_ = (target: FieldTarget, cur: string, next: string, from: string, to: string, set: (v: string) => void, summary: AppliedSummary) => {
        if (sameText(cur, next)) return;
        changes.push({ target, filled: next, summary, apply: () => set(next), revert: () => set(cur),
          conflict: isConflict(cur, next, filled[target]) ? { label: labels[target], from, to } : null });
      };
      const place = async (target: "pickup" | "delivery", next: string) => {
        const cur = target === "pickup" ? pickup : delivery;
        const curCoords = target === "pickup" ? pickupCoords : deliveryCoords;
        const setText = target === "pickup" ? setPickup : setDelivery;
        const setCoords = target === "pickup" ? setPickupCoords : setDeliveryCoords;
        if (sameText(cur, next)) return;
        const g = await geocodeNL(next);
        const shown = g?.label ?? next;
        if (sameText(cur, shown)) return;
        if (cur.trim() && samePlace(curCoords, g?.coords)) return; // Kaapstad = Cape Town
        // spoken_places is keyed { pickup, delivery } (older: pickup_location).
        const said = spokenPlace(next, text, spoken[target] ?? spoken[`${target}_location`]);
        const prevSaid = nlSaid[target];
        changes.push({ target, filled: shown, summary: { [target]: said },
          apply: () => { setText(shown); setCoords(g?.coords ?? null); setNlSaid(p => ({ ...p, [target]: sameText(said, shown) ? undefined : said })); },
          revert: () => { setText(cur); setCoords(curCoords); setNlSaid(p => ({ ...p, [target]: prevSaid })); },
          conflict: isConflict(cur, shown, filled[target]) ? { label: labels[target], from: cur, to: said } : null });
      };
      const toggle = (target: FieldTarget, cur: boolean | string, next: boolean | string, from: string, to: string, set: (v: never) => void, summary: AppliedSummary) => {
        if (cur === next) return;
        const own = nlTouchedRef.current.has(target) && filled[target] !== String(cur);
        changes.push({ target, filled: String(next), summary, apply: () => (set as (v: typeof next) => void)(next),
          revert: () => (set as (v: typeof cur) => void)(cur), conflict: own ? { label: labels[target], from, to } : null });
      };
      if (typeof f.pickup_location === "string" && f.pickup_location) await place("pickup", f.pickup_location);
      if (typeof f.delivery_location === "string" && f.delivery_location) await place("delivery", f.delivery_location);
      // Stops are appended, never replacing the user's own.
      const newStopNames: string[] = Array.isArray(f.stops)
        ? f.stops.filter((s: unknown): s is string => typeof s === "string" && !!s.trim()
          && !stops.some(st => sameText(st.location, s)) && !sameText(s, f.pickup_location || pickup) && !sameText(s, f.delivery_location || delivery))
        : [];
      if (newStopNames.length) {
        const added = await Promise.all(newStopNames.map(async (name) => {
          stopIdRef.current += 1;
          const id = `stop-${stopIdRef.current}`;
          const g = await geocodeNL(name);
          return { id, location: g?.label ?? name, coords: g?.coords ?? null };
        }));
        const ids = added.map(a => a.id);
        changes.push({ target: "stops", filled: null, summary: { stops: newStopNames.map(n => spokenPlace(n, text)) }, conflict: null,
          apply: () => { setStops(prev => [...prev, ...added]); setStopsExpanded(true); },
          revert: () => setStops(prev => prev.filter(s => !ids.includes(s.id))) });
      }
      if (Number(f.weight) > 0) {
        const t = String(Number(f.weight) / 1000);
        if (Number(weight) !== Number(t)) text_("weight", weight, t, `${saNum(Number(weight))} t`, `${saNum(Number(t))} t`, setWeight, { weightKg: Number(f.weight) });
      }
      if (typeof f.cargo_description === "string" && f.cargo_description) text_("cargo", cargo, f.cargo_description, cargo, f.cargo_description, setCargo, { cargo: f.cargo_description });
      if (typeof f.vehicle_type === "string" && f.vehicle_type) text_("truck", vehicleType, f.vehicle_type, sentenceCaseLabel(vehicleType), sentenceCaseLabel(f.vehicle_type), applyVehicleType, { truck: sentenceCaseLabel(f.vehicle_type) });
      {
        const byName = typeof f.customer_name === "string" ? customers.find((c: { name?: unknown }) => sameText(String(c.name), f.customer_name)) : null;
        const cid = f.customer_id ? String(f.customer_id) : byName ? String(byName.id) : "";
        if (cid) {
          const nameOf = (id: string) => customers.find((c: { id?: unknown }) => String(c.id) === id)?.name || f.customer_name || "";
          text_("client", customerId, cid, nameOf(customerId), nameOf(cid), setCustomerId, { client: nameOf(cid) });
        }
      }
      const iso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
      // trip_date is always the pickup date (already sent as trip_date to the route).
      if (iso(f.pickup_date)) text_("pickup_date", pickupDate, f.pickup_date, nlDate(pickupDate, L), nlDate(f.pickup_date, L), setPickupDate, { pickupDate: f.pickup_date });
      if (iso(f.delivery_date)) text_("delivery_date", deliveryDate, f.delivery_date, nlDate(deliveryDate, L), nlDate(f.delivery_date, L), setDeliveryDate, { deliveryDate: f.delivery_date });
      if (iso(f.valid_until)) text_("valid_until", validUntil, f.valid_until, nlDate(validUntil, L), nlDate(f.valid_until, L), setValidUntil, { validUntil: f.valid_until });
      const tripWord = (t: string) => L === "af" ? (t === "ROUND_TRIP" ? "heen en terug" : "eenrigting") : (t === "ROUND_TRIP" ? "round trip" : "one way");
      const nextTrip: "ONE_WAY" | "ROUND_TRIP" = f.trip_type === "ONE_WAY" || f.trip_type === "ROUND_TRIP" ? f.trip_type : tripType;
      if (nextTrip !== tripType) toggle("trip", tripType, nextTrip, tripWord(tripType), tripWord(nextTrip), setTripType as (v: never) => void, { tripType: nextTrip });
      else if (f.trip_type) changes.push({ target: "trip", filled: nextTrip, summary: { tripType: nextTrip }, conflict: null, apply: () => {}, revert: () => {} });
      // A booked return load applies to one-way trips only.
      if (typeof f.return_load_booked === "boolean" && nextTrip === "ONE_WAY") {
        const backWord = (b: boolean) => L === "af" ? (b ? "gelaai" : "leeg") : (b ? "loaded" : "empty");
        if (f.return_load_booked !== returnLoadBooked) toggle("return", returnLoadBooked, f.return_load_booked, backWord(returnLoadBooked), backWord(f.return_load_booked), setReturnLoadBooked as (v: never) => void, { returnLoadBooked: f.return_load_booked, tripType: nextTrip });
        else changes.push({ target: "return", filled: String(f.return_load_booked), summary: { returnLoadBooked: f.return_load_booked, tripType: nextTrip }, conflict: null, apply: () => {}, revert: () => {} });
      }
      if (typeof f.abnormal_load === "boolean") {
        const yes = (b: boolean) => L === "af" ? (b ? "ja" : "nee") : (b ? "yes" : "no");
        if (f.abnormal_load !== abnormalLoad) toggle("abnormal", abnormalLoad, f.abnormal_load, yes(abnormalLoad), yes(f.abnormal_load), setAbnormalLoad as (v: never) => void, { abnormal: f.abnormal_load });
      }
      // Cross-border as said: never overrides the countries the route knows.
      if (typeof f.international === "boolean" || typeof f.border_post === "string") {
        const prevI = nlInternational, prevB = nlBorderPost;
        const nextI = typeof f.international === "boolean" ? f.international : prevI;
        const nextB = typeof f.border_post === "string" && f.border_post ? f.border_post : prevB;
        changes.push({ target: "pickup", filled: null, conflict: null,
          summary: { international: nextI === true || undefined, borderPost: nextB ?? undefined },
          apply: () => { setNlInternational(nextI); setNlBorderPost(nextB); },
          revert: () => { setNlInternational(prevI); setNlBorderPost(prevB); } });
      }

      const now = changes.filter(c => !c.conflict);
      const later = changes.filter(c => c.conflict);
      applyNlChanges(now);
      setNlUndo(now.length ? { reverts: now.map(c => c.revert), at: Date.now() } : null);
      setNlConflict(later.length ? { lines: later.map(c => c.conflict!), changes: later } : null);
      setFillInfo({
        applied: now.reduce((a, c) => ({ ...a, ...c.summary }), {} as AppliedSummary), conf,
        didntCatch: didntCatchLine(res?.not_understood, L),
        // A truck was named but none in the fleet matches it.
        vehicleHint: res?.vehicle_hint && !f.vehicle_type && !res?.pending_entity ? String(res.vehicle_hint) : null,
        vehicleHintLabel: typeof res?.vehicle_hint_label === "string" ? res.vehicle_hint_label : null,
        driverNights: Number(f.driver_nights) > 0 ? Math.trunc(Number(f.driver_nights)) : null,
        fuelPrice: Number(f.fuel_price_override) > 0 ? Number(f.fuel_price_override) : null,
      });
      const reply = res?.reply || (L === "af" ? "Reg so. Die vorm is bygewerk." : "Got it. I updated the form.");
      setNlLive(reply);
      setChatMessages(prev => [...prev, { role: "assistant", text: reply, link: res?.link || undefined }]);
      // Something to answer: a create-this-client/truck question, or nothing
      // could be filled (the reply says what to try).
      if (res?.pending_entity || changes.length === 0) setChatOpen(true);
      if (!textOverride) setNlText("");
    } catch {
      setNlLive("");
      setChatOpen(true);
      setChatMessages(prev => [...prev, { role: "assistant", text: "Sorry, I couldn't read that. Try rephrasing or use the fields directly." }]);
    }
    finally { setNlBusy(false); }
  };

  const voiceNoticeRef = useRef<(() => void) | null>(null);
  const voice = useVoiceRecorder((text, lang, alt, meta) => {
    setNlText(text);
    setHeard({ label: meta.languageLabel, confidence: meta.languageConfidence });
    submitNL(text, lang, alt);
  }, langMode === "auto" ? undefined : langMode, uiLang);
  voiceNoticeRef.current = voice.clearNotice;
  useEffect(() => {
    if (voice.recording) setNlLive(`${vt(uiLang, "listening")} ${langMode === "auto" ? vt(uiLang, "lang_auto") : langModeText(langMode, uiLang)}`);
    else if (voice.transcribing) setNlLive(vt(uiLang, "reading"));
    else if (voice.stoppedAtLimit) setNlLive(vt(uiLang, "too_long"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording, voice.transcribing, voice.stoppedAtLimit]);

  // §3.2: a field the last Fill set with low confidence, still as filled,
  // gets a dotted underline and "Check this" (never red: it isn't an error).
  const NL_CONF_FIELDS: Partial<Record<FieldTarget, string[]>> = {
    pickup: ["pickup_location"], delivery: ["delivery_location"], weight: ["weight"], cargo: ["cargo_description"],
    truck: ["vehicle_type"], client: ["customer_id", "customer_name"], pickup_date: ["pickup_date"],
    delivery_date: ["delivery_date"], valid_until: ["valid_until"], trip: ["trip_type"], return: ["return_load_booked"], abnormal: ["abnormal_load"],
  };
  const nlCurrent: Record<FieldTarget, string> = {
    pickup, delivery, weight, cargo, truck: vehicleType, client: customerId, pickup_date: pickupDate, delivery_date: deliveryDate,
    valid_until: validUntil, trip: tripType, return: String(returnLoadBooked), abnormal: String(abnormalLoad), stops: "",
  };
  const nlCheck = (t: FieldTarget) => !!fillInfo && (NL_CONF_FIELDS[t] ?? []).some(k => isLow(fillInfo.conf, k))
    && nlFilledRef.current[t] !== undefined && nlFilledRef.current[t] === nlCurrent[t];
  const nlCheckHint = (t: FieldTarget) => nlCheck(t) ? <span className="qb-nl-checkhint">{vt(uiLang, "check_this")}</span> : null;
  const nlFieldProps = (t: FieldTarget) => ({ "data-nl-field": t, className: nlCheck(t) ? "qb-nl-check" : undefined, title: nlCheck(t) ? vt(uiLang, "check_this") : undefined });

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
      // A typed driver figure comes back as typed; otherwise nights × allowance again.
      if (q.driver_allowance != null && q.costing_inputs?.driver_cost_is_override === true) { setDriverAllowanceInput(String(Number(q.driver_allowance))); setDriverEdited(true); }
      else if (Number(q.costing_inputs?.driver_nights) > 0) setDriverNightsSet(Math.trunc(Number(q.costing_inputs.driver_nights)));
      // Theirs (53856f8): the stored pricing decision describes this quote only
      // while its final price still equals the quote's total (to 50 cents,
      // QuoteDetail's rule) and the server hasn't marked it stale. Otherwise
      // the quote reopens at its saved total, never put back to the decision's.
      const decision = q.pricing_decision;
      const decidedPrice = Number(decision?.final_price);
      const decisionCurrent = !!decision && !decision.stale && decidedPrice > 0
        && Math.abs(decidedPrice - Number(q.total_amount)) <= 0.5;
      savedFinalPriceRef.current = decisionCurrent ? decidedPrice : Number(q.total_amount) > 0 ? Number(q.total_amount) : null;
      { const sn = q.route_snapshot || {};
        const ci = q.costing_inputs || {};
        // §11: what it was priced on (the server's snapshot, else the decision).
        const floor = Number(q.cost_floor ?? sn.cost_floor ?? (decisionCurrent ? decision?.floor : null));
        const price = decisionCurrent ? decidedPrice : Number(q.total_amount);
        savedPricingRef.current = floor > 0 && price > 0
          ? { price, floor, pricedAt: isoDay(q.priced_at), pricedAtRaw: q.priced_at ?? null, fuelPrice: Number(q.fuel_price_used) || null }
          : null;
        // Only the user's own border figure comes back as typed; otherwise the
        // fresh route's border lines stand and the "costs changed" notice says so.
        savedBorderRef.current = savedBorderOverride(ci);
        setAgentFee(ci.clearing_agent_fee != null && Number.isFinite(Number(ci.clearing_agent_fee)) ? Number(ci.clearing_agent_fee) : null);
        setAbnormalLoad(ci.abnormal_load === true);
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
      { const sr = snap.request, resp = snap.response;
        // Reused unless its prices can have moved since: a cross-border trip
        // (exchange rates) or a quote priced before the toll tariffs now in
        // force; then the route is calculated again and the notice says so.
        const crossBorder = !!resp?.cross_border || (Array.isArray(resp?.countries) && resp.countries.length > 1)
          || (Array.isArray(resp?.routes) && resp.routes.some((r: { cross_border?: boolean }) => r?.cross_border));
        restoreRouteRef.current = sr && typeof sr === "object" && resp && typeof resp === "object" && (Array.isArray(resp.routes) ? resp.routes.length > 0 : true)
          && reuseSavedRoute({ crossBorder, pricedAt: q.priced_at })
          ? { request: sr, response: resp as RouteData, index: Number(snap.selected_route_index) || 0 } : null; }
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
    if (d.tolls != null && (d.tollsSource ?? "manual") === "manual") { setEditableTollCost(String(d.tolls)); setTollManuallyEdited(true); }
    if (d.aiToll && Number(d.aiToll.oneWay) > 0) setAiToll(d.aiToll);
    if (d.aiFuel && Number(d.aiFuel.pricePerL) > 0) setAiFuel(d.aiFuel);
    if (d.useOfficialDiesel === true) setUseOfficialDiesel(true);
    if (d.distanceConfirmed === true) setDistanceConfirmed(true);
    if (typeof d.border === "string" && d.border !== "") setBorderTyped(d.border);
    if (d.driver != null) { setDriverAllowanceInput(String(d.driver)); setDriverEdited(true); }
    if (Number(d.driverNights) > 0) setDriverNightsSet(Math.trunc(Number(d.driverNights)));
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
    setDriverEdited(false); setDriverNightsSet(null); setReturnLoadBooked(false); setTollsNone(false); setBorderTyped(""); setAgentFee(null); setAbnormalLoad(false); setDistanceConfirmed(false); setUseOfficialDiesel(false);
    restoreRouteRef.current = null;
    savedFinalPriceRef.current = null; savedPricingRef.current = null; savedBorderRef.current = null; borderRestoreRef.current = null; setReopenNotice(null); setPriceSet(null); setSavedPriceShown(false);
    setRouteError(false);
    setRouteData(null); setSelectedRouteIndex(0); setRouteBlockedMessage(null);
    setAiFuel(null); setAiToll(null);
    lastRouteKeyRef.current = null;
    setChatMessages([]); setChatOpen(false); setPendingEntity(null); setDeclinedEntities([]);
    setValidUntil("");
    setNlSaid({});
    setFillInfo(null); setNlConflict(null); setNlUndo(null); setHeard(null); setNlInternational(null); setNlBorderPost(null);
    nlFilledRef.current = {}; nlTouchedRef.current = new Set();
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
          tolls: tollManuallyEdited ? editableTollCost : null, driver: driverEdited ? driverAllowanceInput : null, driverNights: driverNightsSet,
          price: priceSet, returnLoadBooked, tollsNone,
          // Restored as they were (never "manual" unless typed).
          tollsSource: tollManuallyEdited ? "manual" : aiToll ? "market_check" : "route", aiToll, aiFuel,
          useOfficialDiesel, distanceConfirmed, border: borderTyped,
        }));
        setLastSavedAt(new Date());
      } catch { /* ignore */ }
    };
    draftFlushRef.current = doSave;
    draftRef.current = setTimeout(() => { draftFlushRef.current = null; doSave(); }, 800);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, customerId, vehicleType, pickup, delivery, pickupCoords, deliveryCoords, weight, cargo, notes, tripType,
    pickupDate, deliveryDate, validUntil, stops, tollManuallyEdited, editableTollCost, driverEdited, driverAllowanceInput, driverNightsSet, priceSet, returnLoadBooked, tollsNone,
    aiToll, aiFuel, useOfficialDiesel, distanceConfirmed, borderTyped]);

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
  const isInternational = !!routeB?.cross_border
    || (routeB?.countries || []).some(c => isForeignCountry(c))
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
      use_official_fuel: useOfficialDiesel,
      ...(borderUnknown ? { border_costs_unknown: borderUnknown } : {}), border_cost_is_override: borderCostIsOverride,
      ...(aiFuelActive ? { fuel_price_override: aiFuel!.pricePerL } : {}),
      ...(emptyReturn.applicable ? { include_empty_return: emptyReturn.included } : {}),
      // The way home on its own route's tolls and border charges (one way
      // stated, so the server never splits a total that includes them).
      ...(tollsOneWay != null ? { toll_cost_one_way: round2(tollsOneWay) } : {}),
      ...(costingInputs.tolls?.return_leg != null ? { toll_cost_return: costingInputs.tolls.return_leg } : {}),
      ...(costingInputs.tolls?.empty_return != null ? { toll_cost_empty_return: costingInputs.tolls.empty_return } : {}),
      ...(borderEmptyBack != null ? { cross_border_cost_empty_return: borderEmptyBack } : {}),
      ...(borderEstimated ? { cross_border_estimate_zar: borderEstimated } : {}),
      ...(borderEstimatedBack ? { cross_border_estimate_empty_return_zar: borderEstimatedBack } : {}),
      abnormal_load: abnormalLoad,
    },
    tollCost, routePlazas: tollBreakdown.map(b => ({ plaza: b.plaza, route: b.route, tariff: Number(b.tariff) })),
    countryCodes: route?.country_codes ?? routeB?.countries ?? null,
    crossBorderCost, isInternational,
    pickupDate: pickupDate || null,
    // Only a figure the user typed (sent as an override); else the server prices the nights.
    driverAllowance: driverEdited || driverNightsSet != null ? driverAllowance : null,
    includeReturn: legs === 1 ? emptyReturn.included : null,
    yourPrice: total > 0 ? total : null,
  } : null;
  const pricing = usePricingAnalysis(pricingInputs, pricingPhase === "ready");
  // The price in the bar, read live against the last analysis.
  // ONE FLOOR: every margin on screen is the price less the costing's floor
  // (the Costs card total). The analysis is used for choices and chance to
  // win only while it answers exactly these inputs; a stale, offline or
  // refreshing one is shown out of date and never read for margin or "Use …".
  const analysisCurrent = pricing.isCurrent && pricing.status === "ready";
  const currentData = analysisCurrent ? pricing.data : null;
  const liveReading = readPrice(currentData, total, costing.floor);
  // The bar's one price story: the build-up until a price is applied, then the
  // applied price (a choice, or the user's own).
  const atBuildUp = priceSet == null;
  // No "Recommended" without evidence: the server's recommendation key decides.
  const recChoice = currentData && currentData.recommendation?.key !== null
    ? currentData.choices.find(c => c.recommended) ?? null : null;
  const appliedChoice = liveReading.matchedChoice ? currentData?.choices.find(c => c.key === liveReading.matchedChoice) ?? null : null;
  // "Use Balanced R 25 100" sits in the bar until a price is applied.
  const recLk = recChoice && currentData ? rowLikelihoods(currentData, currentData.choices).get(recChoice.key) ?? null : null;
  const recLessLikely = !!recLk && lkTone(recLk) === "less_likely";
  const useRec = atBuildUp && !!recChoice && !recLessLikely && liveReading.margin != null && Math.abs(recChoice.price - total) >= 0.005;
  // Keep the suggested choice in step with the current analysis.
  useEffect(() => {
    if (!currentData || costing.floor == null) return;
    const realMarket = !!currentData.market?.available && !currentData.market.isEstimate;
    const pick = (realMarket ? recChoice : null) ?? currentData.choices.find(c => c.key === "safe") ?? null;
    const next = pick ? { price: pick.price, floor: costing.floor } : null;
    setAnalysisSuggested(prev => (prev?.price === next?.price && prev?.floor === next?.floor ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData, costing.floor]);

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
  // A reopened quote's own border figure (border_cost_is_override): once the
  // route is in, keep it when the route's own one differs.
  useEffect(() => {
    const saved = savedBorderRef.current;
    if (saved == null || !routeIsCurrent) return;
    savedBorderRef.current = null;
    if (Math.abs(routeBorderLoaded - saved) < 0.5) return;
    const typed = String(round2(saved));
    borderRestoreRef.current = typed;
    setBorderTyped(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIsCurrent]);
  // §11: costs changed since the quote was priced → one compact notice. The
  // floor is the one the panel shows (the server's), else the local costing.
  // One floor everywhere: the costing (the panel's floor is the same compute()).
  const floorNow = costing.floor;
  useEffect(() => {
    const sp = savedPricingRef.current;
    if (!sp || !routeIsCurrent || floorNow == null) return;
    // Wait for the company figures the server prices with (operating cost,
    // driver allowance for this trip): the profile's stand-ins would show a
    // false "Costs up" on a quote that has not changed.
    if (breakdownPayload && selectedVT && (!si || serverBreakdown?.placeholder)) return;
    // Wait for a restored border figure, else the floor looks R x lower.
    if (savedBorderRef.current != null || (borderRestoreRef.current != null && borderTyped !== borderRestoreRef.current)) return;
    borderRestoreRef.current = null;
    savedPricingRef.current = null;
    const ch = changesSincePriced(sp.price, sp.floor, floorNow, sp.pricedAtRaw);
    if (!ch.changed || !ch.notice) return;
    setReopenNotice({ text: ch.notice, since: sp.pricedAt, reprice: ch.repriced_price_keep_margin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIsCurrent, floorNow, borderTyped, !!si, !!serverBreakdown?.placeholder]);

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
  const serverAtPrice = currentData?.yourPrice && Math.abs(currentData.yourPrice.price - total) <= 0.005
    ? currentData.yourPrice : null;
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
    // The empty return's own tolls (its route home), when that leg was priced.
    tolls_empty_return: costingInputs.tolls?.empty_return ?? null,
    // Both legs as shown: the way back's own tolls and border, the estimated
    // part of the border and the user's clearing-agent fee.
    toll_cost_return: costingInputs.tolls?.return_leg ?? null,
    border_cost_empty_return: borderEmptyBack,
    border_estimate: borderEstimated,
    border_estimate_empty_return: borderEstimatedBack,
    clearing_agent_fee: agentFee,
    // Zimbabwe abnormal load (Abnormal access-toll class): saved so a reopened quote prices the same.
    abnormal_load: abnormalLoad,
    // The border line (all legs): additional_charges can't be read back as it.
    border_cost: crossBorderCost > 0 ? round2(crossBorderCost) : null,
    border_costs_unknown: borderUnknown,
    border_cost_is_override: borderCostIsOverride,
    // The saved driver figure is the user's only when they typed it.
    driver_cost_is_override: driverEdited,
    // Nights out set for this quote (not typed as a figure): the server
    // prices the same nights (quote_costing reads driver_nights).
    driver_nights: !driverEdited && driverNightsSet != null ? driverNightsSet : null,
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
    // only when the floor is known, so an edit never wipes a saved figure, and
    // only from an analysis of exactly these values (not one still refreshing).
    ...(pricing.isCurrent && liveReading.marginPct != null ? { margin_percentage: Math.max(-999.99, Math.min(999.99, Math.round(liveReading.marginPct * 100) / 100)) } : {}),
    notes, status,
    sla_hours: Number(companyProfile?.default_sla_hours) || 48, valid_until: validUntilToSave, trip_type: tripType,
    // No heuristic win_probability any more: the server sets it from the
    // model's likelihood at the final price (model level only). What was shown
    // and picked is saved, additively, as pricing_decision.
    // Only an analysis of exactly what is being saved (theirs, 53856f8): while
    // one is still refreshing the quote saves without it (the old decision is
    // then marked superseded on the server if the price moved).
    ...(pricing.data && pricing.isCurrent ? { pricing_decision: pricingDecision(pricing.data, total, liveReading.matchedChoice ?? "custom", defaultPrice != null ? round2(total - defaultPrice) : 0) } : {}),
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
    // Never saved on a route worked out for other inputs (e.g. the previous truck).
    if (pickupCoords && deliveryCoords && !routeIsCurrent && !routeError) return "The route is still updating: try again in a moment";
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

  // "Try again" on a stale official price: ask the server to re-check the
  // official source now, then say what came back.
  const refreshFuel = async () => {
    if (fuelRefreshing) return;
    setFuelRefreshing(true);
    const before = costing.diesel.official_effective_from;
    try {
      // POST /fuel-prices/refresh/: answers like GET current/ plus
      // refresh {attempted, ok, throttled, changed, message}.
      const res = await postData({ url: "api/v1/fuel-prices/refresh/", data: {} }) as
        { refresh?: { ok?: boolean; changed?: boolean; throttled?: boolean; message?: string }; effective_from?: string | null;
          company_price?: { official?: { effective_from?: string | null } } } | null;
      await queryClient.invalidateQueries({ queryKey: ["fuel-price-current"] });
      await queryClient.invalidateQueries({ queryKey: ["company-profile"] });
      const r = res?.refresh;
      const after = res?.company_price?.official?.effective_from ?? res?.effective_from ?? null;
      const fallback = r?.changed && after ? `New official price loaded, from ${shortDate(after)}.`
        : `Still the latest official price${(after ?? before) ? ` (from ${shortDate((after ?? before)!)})` : ""}.`;
      const msg = r?.message || fallback;
      if (r?.changed) toast.success(msg);
      else if (r && r.ok === false && !r.throttled) toast.warning(msg);
      else toast.info(msg);
    } catch (e: unknown) {
      toast.error((e as { message?: string } | null)?.message || "Couldn't reach the official price source");
    } finally {
      setFuelRefreshing(false);
    }
  };

  // §10 warning actions (one handler for every surface).
  const runWarningAction = (id: string) => {
    switch (id) {
      case "use_official": setUseOfficialDiesel(true); break;
      case "update_own": navigate("/settings/company#fuel"); break;
      case "update_allowance": window.open("/settings/company#pricing", "_blank", "noopener"); break;
      case "retry_diesel": refreshFuel(); break;
      case "enter_tolls": document.getElementById("qb-tolls-input")?.focus(); break;
      case "enter_border_costs": document.getElementById("qb-border-input")?.focus(); break;
      case "confirm_no_tolls": setTollsNone(true); break;
      case "recalculate_route": setDistanceConfirmed(false); calculateRoute(); break;
      case "confirm_distance": setDistanceConfirmed(true); break;
      case "enter_driver_cost": document.getElementById("qb-driver-input")?.focus(); break;
      case "enter_weight": document.getElementById("qb-weight-input")?.focus(); break;
      case "choose_vehicle": document.getElementById("qb-truck-select")?.focus(); break;
      case "edit_vehicle": case "add_vehicle": window.open("/settings/vehicle-types", "_blank", "noopener"); break;
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
        <div style={{ padding: "10px", borderTop: "1px solid var(--border-subtle)" }} data-nl-field="stops">
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
                  {/* "Fastest · via N17/N3 · tolls R 887" (fastest is the default). */}
                  {routeChipLabel(r, i)}
                  <span className="qb-routeopt__sub"> · {formatNumber(Math.round(r.distance_km))} km</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 13, lineHeight: "20px", padding: "10px 12px", maxWidth: 280, borderRadius: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 12px" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>Distance</span><span>{Math.round(r.distance_km)} km</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Duration</span><span>{formatDuration(r.duration_minutes ?? r.duration_min)}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>Tolls</span><span>{r.tolls_unavailable || r.tolls_unknown || r.toll_cost_zar == null ? "Unknown" : formatCurrency(r.toll_cost_zar)}</span>
                  {/* This option's own plazas, in driving order. */}
                  {(r.toll_breakdown ?? []).map((b, j) => (
                    <Fragment key={`${b.plaza}-${j}`}><span style={{ color: "var(--text-tertiary)", paddingLeft: 8 }}>{b.plaza}</span><span>{formatCurrency(Number(b.tariff))}</span></Fragment>
                  ))}
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
  // Never gated on the typed price (theirs, issue 18): clearing the price box
  // to retype (0) must not hide the bar being typed into. Shown once there is
  // a floor, a price set, or a block to say.
  const showPriceBar = !billingBlocked && ready && !isDemoQuotaExceeded && !routeBlockedMessage
    && (costing.floor != null || priceSet != null || blockWarnings.length > 0);

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
      {/* NL input — typed or voice. The mic stays the same button while it
          records (Space / Enter toggles it, Esc cancels and discards). */}
      <div className={`qb-nl${voice.recording ? " is-recording" : ""}`} style={{ ...cardS, border: "1px solid var(--border-control)", display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 14px", marginBottom: fillInfo || nlConflict || heard || voice.stoppedAtLimit ? 8 : 16, minHeight: 44 }}>
        <div className="qb-nl__main">
          {voice.recording ? (
            <VoiceListening lang={uiLang} mode={langMode} levels={voice.levels} elapsed={voice.elapsed} remaining={voice.remaining} reducedMotion={reducedMotion} />
          ) : voice.transcribing ? (
            <div className="qb-nl__status">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ animation: reducedMotion ? undefined : "spin 1s linear infinite" }}>
                <circle cx="8" cy="8" r="6" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
              </svg>
              {vt(uiLang, "reading")}
            </div>
          ) : (
            <>
              <MessageCircle size={16} color="var(--text-tertiary)" aria-hidden="true" className="qb-nl__icon" style={{ flexShrink: 0 }} />
              <input ref={nlInputRef} value={nlText} onChange={e => { setNlText(e.target.value); if (heard) setHeard(null); }} onKeyDown={e => e.key === "Enter" && submitNL()}
                placeholder={vt(uiLang, "placeholder")} aria-label="Describe the load" style={{ ...inputS, border: "none", background: "transparent", paddingLeft: 4, minWidth: 0 }} />
            </>
          )}
        </div>
        {!voice.transcribing && (
          <button type="button" className="tw-btn qb-nl__lang" onClick={() => setLangMode(nextLangMode(langMode))} disabled={voice.recording}
            aria-label={vt(uiLang, "mode_label", { mode: langModeText(langMode, uiLang) })} title={vt(uiLang, "mode_label", { mode: langModeText(langMode, uiLang) })}>
            {langMode === "auto" ? vt(uiLang, "mode_auto") : langMode.toUpperCase()}
          </button>
        )}
        <button type="button" onClick={voice.recording ? voice.stop : voice.start} disabled={voice.transcribing || nlBusy}
          aria-pressed={voice.recording} aria-label={vt(uiLang, voice.recording ? "stop_label" : "mic_label")} title={vt(uiLang, voice.recording ? "stop_label" : "mic_label")}
          className={`tw-btn qb-nl__mic${voice.recording ? " is-on" : ""}`}>
          {voice.recording ? <><Square size={12} fill="currentColor" aria-hidden="true" /><span>{vt(uiLang, "stop")}</span></> : <Mic size={16} aria-hidden="true" />}
        </button>
        {!voice.recording && !voice.transcribing && (
          <button type="button" onClick={() => submitNL()} disabled={nlBusy || !nlText.trim()} className="tw-btn qb-nl__fill">{nlBusy ? vt(uiLang, "reading") : vt(uiLang, "fill")}</button>
        )}
        {/* Assistant launcher slot (filled by AIChatPanel via a portal). */}
        {!showPriceBar && <span ref={nlChatSlotRef} className="qb-chatslot qb-chatslot--nl" />}
      </div>
      {/* One polite live region: Listening… / Reading… / the reply, once. */}
      <div className="qb-sr" role="status" aria-live="polite" aria-atomic="true">{nlLive}</div>
      <DescribeFeedback
        lang={uiLang}
        heard={heard}
        stoppedAtLimit={voice.stoppedAtLimit && !voice.recording}
        info={fillInfo}
        conflict={nlConflict ? nlConflict.lines : null}
        replaceRef={nlReplaceRef}
        onReplace={() => resolveNlConflict(true)}
        onKeep={() => resolveNlConflict(false)}
        undo={!!nlUndo}
        onUndo={undoNl}
        onChip={(t) => focusNlField(t)}
        onPickTruck={() => focusNlField("truck", true)}
        onApplyNights={(n) => { setDriverEdited(false); setDriverAllowanceInput(""); setDriverNightsSet(n); setFillInfo(prev => prev ? { ...prev, driverNights: null } : prev); }}
        onUseFuel={(p) => { setAiFuel({ pricePerL: p, fuelType }); setFillInfo(prev => prev ? { ...prev, fuelPrice: null } : prev); }}
      />

      {/* 1 — inputs */}
      {/* One 4-column grid for every field row (inputs, details, cargo/trip),
          same template and gap, so field edges line up row to row. */}
      <div className="qb-grid qb-grid--inputs" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={fieldLabelS}><span>Client<Req />{nlCheckHint("client")}</span>{!authUser?.is_demo && <button type="button" className="qb-textbtn qb-textbtn--label" aria-label="New client (opens in a new tab)" onClick={() => window.open("/customers", "_blank", "noopener")}><Plus size={12} aria-hidden="true" />New</button>}</div>
          <div className={`qb-select${nlCheck("client") ? " qb-nl-check" : ""}`} data-nl-field="client">
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={inputS} data-empty={customerId ? undefined : ""} aria-label="Client">
              <option value="">Select client…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="qb-select__chev" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div style={fieldLabelS}><span>Weight (t)<Req />{nlCheckHint("weight")}</span></div>
          <div {...nlFieldProps("weight")}><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 15" style={inputS} aria-label="Weight in tonnes" id="qb-weight-input" /></div>
        </div>
        <div className="qb-loc">
          <div style={fieldLabelS}><span>Collection<Req />{nlCheckHint("pickup")}</span></div>
          <div {...nlFieldProps("pickup")}><LocationInput value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c || null); }} placeholder="City / address" style={inputS} /></div>
          {nlSaid.pickup && nlFilledRef.current.pickup === pickup && <div className="qb-nl-said">{vt(uiLang, "said", { place: nlSaid.pickup })}</div>}
        </div>
        <div className="qb-loc">
          <div style={fieldLabelS}><span>Delivery<Req />{nlCheckHint("delivery")}</span></div>
          <div {...nlFieldProps("delivery")}><LocationInput value={delivery} onChange={(v, c) => { setDelivery(v); setDeliveryCoords(c || null); }} placeholder="City / address" style={inputS} /></div>
          {nlSaid.delivery && nlFilledRef.current.delivery === delivery && <div className="qb-nl-said">{vt(uiLang, "said", { place: nlSaid.delivery })}</div>}
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
            ["qb-date-pickup", "Pickup date", pickupDate, setPickupDate, "pickup_date"],
            ["qb-date-delivery", "Delivery date", deliveryDate, setDeliveryDate, "delivery_date"],
            ["qb-date-valid", "Valid until", validUntil, setValidUntil, "valid_until"],
          ] as const).map(([id, label, value, set, nlKey]) => (
            <div key={id} role="group" aria-labelledby={id} className={`qb-date${nlCheck(nlKey) ? " qb-nl-check" : ""}`} data-nl-field={nlKey}>
              <div style={fieldLabelS}><span id={id}>{label}</span>{nlCheckHint(nlKey)}</div>
              <DatePicker value={value} onChange={set} style={{ minHeight: "var(--field-h, 40px)", boxSizing: "border-box" }} />
            </div>
          ))}
          <div className="qb-vehicle">
            <div style={fieldLabelS}><span>Truck{nlCheckHint("truck")}</span>{!authUser?.is_demo && <button type="button" className="qb-textbtn qb-textbtn--label" aria-label="New vehicle type (opens in a new tab)" onClick={() => window.open("/settings/vehicle-types", "_blank", "noopener")}><Plus size={12} aria-hidden="true" />New</button>}</div>
            <div className={`qb-select${nlCheck("truck") ? " qb-nl-check" : ""}`} data-nl-field="truck">
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
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span>Cargo{nlCheckHint("cargo")}</span></div><div {...nlFieldProps("cargo")}><input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="e.g. palletised steel" style={inputS} aria-label="Cargo" /></div></div>
          <div style={{ gridColumn: "span 2" }}><div style={fieldLabelS}><span id="qb-trip-label">Trip{nlCheckHint("trip")}</span></div>
            {/* The shared segmented control: neutral track, raised active option. */}
            <div className={`tw-seg tw-seg--block qb-trip${nlCheck("trip") ? " qb-nl-check" : ""}`} role="group" aria-labelledby="qb-trip-label" data-nl-field="trip">
              {(["ONE_WAY", "ROUND_TRIP"] as const).map(t => <button key={t} type="button" onClick={() => { nlTouchedRef.current.add("trip"); setTripType(t); }} aria-pressed={tripType === t} aria-label={t === "ONE_WAY" ? "One way" : "Round trip, loaded both ways"} className={`tw-seg__opt${tripType === t ? " is-active" : ""}`}>{t === "ONE_WAY" ? "One way" : <><span className="qb-trip-long">Round trip, loaded</span><span className="qb-trip-short">Round, loaded</span></>}</button>)}
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
              // Floor gap chips (theirs, 53856f8) on the one floor's own lines:
              // "Check" for R 0 tolls / flagged operating costs, "Not set" for
              // border costs an international trip still needs (server flags).
              const paLine = (k: string) => (pricing.isCurrent ? pricing.data?.costFloor?.lines.find(l => l.key === k) : null) ?? null;
              // The costing's own code border_costs_missing
              // (border line needs_input); the server's operating_cost_overlap.
              const opCheck = !!currentData?.warnings.some(w => w.code === "operating_cost_overlap") || !!paLine("fixed_cost")?.check;
              const borderLine = costing.lines.find(l => l.key === "border") ?? null;
              const borderNotSet = borderLine?.status === "needs_input";
              const opEstimate = opLine?.source === "vehicle_default";
              const money = (v: number | null | undefined) => (v == null ? "—" : formatMoneyWhole(v));
              const rIn = (node: React.ReactNode) => <span className="qb-cost__money"><span aria-hidden="true">R</span>{node}</span>;
              return (<>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Operating costs
                  {opCheck ? <span className="qb-cost__tag">Check</span> : opEstimate && <span className="qb-cost__tag">Estimate</span>}
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
                    ["Burn", fuelConsumption != null ? `≈ ${fmtNum(fuelConsumption, 1)} L/100 km` : "Not set"],
                    ["Distance", `${formatNumber(Math.round(chargeDistance))} km${legs === 2 ? " (both ways)" : ""}`],
                    ["Litres", fuelConsumption != null ? `≈ ${fmtNum(fuelLitres)} L` : "—"],
                  ]} total={lineAmt("fuel") != null ? ["Fuel", money(fuelCost)] : undefined} />
                  {aiFuelActive && <button type="button" className="qb-linkbtn" onClick={() => setAiFuel(null)}>Reset</button>}
                  {/* Only when there is an own price for this truck's fuel to go back to. */}
                  {useOfficialDiesel && costing.diesel.own_price != null && costing.diesel.mode === "OWN" && <button type="button" className="qb-linkbtn" onClick={() => setUseOfficialDiesel(false)}>Use mine</button>}
                  {/* The warning on the line it concerns (the bar keeps the count). */}
                  {costing.warnings.some(w => w.code === "diesel_stale") && (<>
                    <span className="qb-cost__tag" title="The official price on record may be out of date">Price from {shortDate(costing.diesel.official_effective_from) ?? "an earlier period"}</span>
                    <button type="button" className="qb-linkbtn" onClick={refreshFuel} disabled={fuelRefreshing}>{fuelRefreshing ? "Checking…" : "Try again"}</button>
                  </>)}
                </span>
                <span className="qb-cost__value">{lineAmt("fuel") != null ? money(fuelCost) : "—"}</span>
              </div>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Tolls
                  <TollPop sanralClass={routeData?.toll_sanral_class ?? null} includesVat={routeData?.toll_cost_includes_vat === true}
                    scheduleWarning={tollScheduleWarning}
                    legs={[
                      { title: tripType === "ROUND_TRIP" || returnLeg ? "Out" : "One way", items: tollBreakdown,
                        total: routeTollsUnknown || routeToll == null ? null : Number(routeToll),
                        unknownReason: routeTollsUnknown ? (route?.tolls_unavailable_reason ?? routeData?.tolls_unavailable_reason ?? "unknown") : null },
                      ...(returnLeg && (tripType === "ROUND_TRIP" || emptyReturn.included) ? [{
                        title: tripType === "ROUND_TRIP" ? "Back" : "Back, empty", items: returnLeg.toll_breakdown ?? [],
                        total: returnTolls, unknownReason: returnLeg.tolls_unknown ? (returnLeg.tolls_unavailable_reason ?? "unknown") : null }] : []),
                    ]} />
                  {tollScheduleWarning && <span className="qb-cost__tag" title={tollScheduleWarning}>Tariffs not published</span>}
                  {aiTollActive && !tollManuallyEdited && <button type="button" className="qb-linkbtn" onClick={() => setAiToll(null)}>Reset</button>}
                  {tollManuallyEdited && <button type="button" className="qb-linkbtn" onClick={() => { setTollManuallyEdited(false); setEditableTollCost(""); setTollEditing(false); }}>Use route</button>}
                </span>
                {/* Known tolls (R 0 included) are a figure with a quiet pencil;
                    the box shows only when they're unknown or being edited. */}
                {lineAmt("tolls") == null || tollEditing || tollManuallyEdited
                  ? rIn(<NumberField id="qb-tolls-input" decimals={0} autoFocus={tollEditing} value={tollManuallyEdited ? (editableTollCost === "" ? null : Number(editableTollCost)) : lineAmt("tolls")}
                      placeholder="Unknown"
                      onBlur={() => setTollEditing(false)}
                      onValue={(n) => { setEditableTollCost(n == null ? "" : String(n)); setTollManuallyEdited(true); }}
                      aria-label="Tolls (R)" aria-invalid={lineAmt("tolls") == null || undefined} className={`qb-mini qb-cost__input${lineAmt("tolls") == null ? " is-missing" : ""}`} />)
                  : <span className="qb-cost__value">
                      <button type="button" className="qb-cost__edit" aria-label="Edit tolls" title="Edit tolls" onClick={() => setTollEditing(true)}><Pencil size={12} aria-hidden="true" /></button>
                      {money(lineAmt("tolls"))}
                    </span>}
              </div>
              <div className="qb-cost__row">
                <span className="qb-cost__label">
                  Driver allowance{driverNights != null && driverNights > 0 && <span className="qb-cost__meta">{driverNights} night{driverNights === 1 ? "" : "s"}</span>}
                  {!driverEdited && serverBreakdown?.resolution?.driver_rate_detail && (
                    <InfoPop label="Driver allowance rate" title="Driver allowance" rows={[[serverBreakdown.resolution.driver_rate_detail, ""]]} />)}
                  {costing.warnings.some(w => w.code === "driver_allowance_missing") && (<>
                    <span className="qb-cost__tag">No rate set</span>
                    <button type="button" className="qb-linkbtn" onClick={() => runWarningAction("update_allowance")}>Set allowance</button>
                  </>)}
                  {driverEdited && driverLineC?.suggested != null && Math.abs(driverAllowance - Number(driverLineC.suggested)) >= 0.5 && (
                    <button type="button" className="qb-linkbtn" onClick={() => { setDriverEdited(false); setDriverAllowanceInput(""); setDriverNightsSet(null); }}>Reset</button>
                  )}
                  {!driverEdited && driverNightsSet != null && (
                    <button type="button" className="qb-linkbtn" onClick={() => setDriverNightsSet(null)}>Reset</button>
                  )}
                </span>
                {rIn(<NumberField id="qb-driver-input" decimals={0} value={driverEdited ? (driverAllowanceInput === "" ? null : Number(driverAllowanceInput) || 0) : driverLineC?.amount ?? null}
                  placeholder="Needed"
                  onValue={(n) => { setDriverAllowanceInput(n == null ? "" : String(n)); setDriverEdited(true); setDriverNightsSet(null); }}
                  aria-label="Driver allowance (R)" className={`qb-mini qb-cost__input${driverLineC?.amount == null ? " is-missing" : ""}`} />)}
              </div>
              {(borderNotSet || borderTyped !== "") && (
                <div className="qb-cost__row">
                  <span className="qb-cost__label">Border fees{nlBorderPost && <span className="qb-cost__meta">{vt(uiLang, "via", { post: borderPostShort(nlBorderPost) })}</span>}{borderNotSet && <span className="qb-cost__tag">Not set</span>}
                    {/* Part of the route has no border figures on file: what is known, what is missing.
                        The figure entered here is the whole border cost (every crossing). */}
                    {borderUnknown && (
                      <BorderPop title={routeB?.countries?.length ? routeB.countries.join(" → ") : "Border charges"}
                        agentFee={agentFee} onAgentFee={setAgentFee} assumptions={borderAssumptions}
                        note={`Not on file: ${(borderUnknown.crossings.length ? borderUnknown.crossings : borderUnknown.countries).join(", ")}. Enter the total for every crossing.`}
                        legs={(routeB?.cross_border_breakdown || []).length
                          ? [{ title: "On file", items: (routeB?.cross_border_breakdown || []).filter(it => Number(it.amount) > 0), total: routeBorderOut }] : []} />)}
                    {borderTyped !== "" && <button type="button" className="qb-linkbtn" onClick={() => setBorderTyped("")}>Reset</button>}</span>
                  {rIn(<NumberField id="qb-border-input" decimals={0} value={borderTyped === "" ? null : Number(borderTyped)} placeholder="Needed"
                    onValue={(n) => setBorderTyped(n == null ? "" : String(n))}
                    aria-label="Border fees (R)" className={`qb-mini qb-cost__input${borderNotSet ? " is-missing" : ""}`} />)}
                </div>
              )}
              {crossBorderCost > 0 && borderTyped === "" && !borderNotSet && (() => {
                const outItems = (routeB?.cross_border_breakdown || []).filter(it => Number(it.amount) > 0);
                const backItems = (returnLeg?.cross_border_breakdown || []).filter(it => Number(it.amount) > 0);
                const showBack = !!returnLeg && routeBorderBack != null && (tripType === "ROUND_TRIP" || emptyReturn.included);
                const estimates = [...outItems, ...(showBack ? backItems : [])].some(it => !it.verified);
                return (
                  <div className="qb-cost__row">
                    <span className="qb-cost__label">
                      Border fees{nlBorderPost && <span className="qb-cost__meta">{vt(uiLang, "via", { post: borderPostShort(nlBorderPost) })}</span>}
                      <BorderPop title={routeB?.countries?.length ? routeB.countries.join(" → ") : "Border charges"}
                        agentFee={agentFee} onAgentFee={setAgentFee} assumptions={borderAssumptions}
                        legs={[
                          { title: showBack ? "Out" : "Border fees", items: outItems, total: routeBorderOut },
                          ...(showBack ? [{ title: tripType === "ROUND_TRIP" ? "Back" : "Back, empty", items: backItems, total: routeBorderBack! }] : []),
                        ]} />
                      {estimates && <span className="qb-cost__tag" title="Some charges are estimates: see the list">Includes estimates</span>}
                      {abnormalLoadRelevant(routeB?.countries) && (
                        <label className={`qb-cost__check${nlCheck("abnormal") ? " qb-nl-check" : ""}`} data-nl-field="abnormal" title={nlCheck("abnormal") ? vt(uiLang, "check_this") : "Tick only for an abnormal load (e.g. a low-bed carrying machinery). Legal interlinks up to 56 t pay the goods vehicle toll."}>
                          <input type="checkbox" checked={abnormalLoad} onChange={(e) => { nlTouchedRef.current.add("abnormal"); setAbnormalLoad(e.target.checked); }} /> Abnormal load
                        </label>)}
                    </span>
                    <span className="qb-cost__value">{money(crossBorderCost)}</span>
                  </div>
                );
              })()}
              {emptyReturn.applicable && (
                <div className="qb-cost__row">
                  <span className="qb-cost__label">
                    Truck comes back
                    <span className={`tw-seg tw-seg--sm qb-cost__seg${nlCheck("return") ? " qb-nl-check" : ""}`} role="group" aria-label="Truck comes back" data-nl-field="return">
                      {([["Empty", false], ["Loaded", true]] as const).map(([lbl, booked]) => (
                        <button key={lbl} type="button" aria-pressed={returnLoadBooked === booked} onClick={() => { nlTouchedRef.current.add("return"); setReturnShape(booked); }}
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
          firstBlockCode={blockWarnings[0]?.code ?? null}
          paused={blockWarnings.length > 0}
          needs={pricingNeeds}
          customerName={customers.find((c: any) => String(c.id) === String(customerId))?.name ?? null}
          price={settledTotal}
          distanceKm={distance}
          buildUp={costSum}
          costFloor={costing.floor}
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
          onIncludeReturn={(v) => setReturnShape(!v)}
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
        // Only an analysis of exactly these inputs; margins from the one floor.
        const data = currentData;
        const floorKnown = costing.floor != null;
        const ready = floorKnown && liveReading.margin != null;
        const waiting = !floorKnown && (pricing.status === "loading" || pricing.status === "refreshing" || pricing.status === "idle" || pricingPhase === "route");
        // The bar's figures: the choice's own at a choice price, the server's
        // at a settled custom price, else a neutral client reading.
        const rowLk = appliedChoice && data ? rowLikelihoods(data, data.choices).get(appliedChoice.key) ?? null : null;
        // Settled = not mid-typing (the margin itself never waits for the server).
        const settled = !priceTyping && ready;
        const margin = liveReading.margin;
        const marginPct = liveReading.marginPct;
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
                <button type="button" className="qb-linkbtn qb-pricebar__alt" onClick={() => setReturnShape(!returnLoadBooked)}
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

      <AIChatPanel messages={chatMessages} busy={nlBusy} open={chatOpen} onOpenChange={setChatOpen} onSend={(t, lang, alt) => submitNL(t, lang, alt)} launcherSlot={chatSlot} />
    </div>
  );
}
