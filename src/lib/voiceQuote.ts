// "Describe the load" (typed or voice): the copy, the language chip, and the
// pure helpers behind the filled chips, the Replace / Keep mine confirm and
// Undo. Presentation and form-filling only: nothing here prices anything.
// Spec: VOICE-CLIENT-SPEC.md §2–§6 (web and app behave the same).

export type UiLang = "en" | "af";
export type VoiceLangMode = "auto" | "en" | "af";

const COPY = {
  en: {
    listening: "Listening…",
    lang_auto: "English or Afrikaans",
    lang_en: "English",
    lang_af: "Afrikaans",
    heard_in: "Heard in {lang}",
    heard_mixed: "Heard in English + Afrikaans",
    reading: "Reading…",
    filled: "Filled",
    check_this: "Check this",
    didnt_catch: "Didn't catch:",
    replace_q: "Replace {n} fields?",
    replace_q1: "Replace 1 field?",
    replace: "Replace",
    keep: "Keep mine",
    undo: "Undo",
    abnormal: "Abnormal load",
    no_speech: "Didn't catch any speech — try again a bit closer to the mic.",
    too_long: "Stopped at 1 minute",
    mic_denied: "Microphone permission is needed to record",
    placeholder: "Describe the load, e.g. 28 t steel coils Joburg to Durban",
    placeholder_short: "e.g. 28 t steel, Joburg to Durban",
    mic_label: "Record voice description",
    stop_label: "Stop recording",
    stop: "Stop",
    fill: "Fill",
    mode_auto: "Auto",
    mode_label: "Voice language: {mode}. Change",
    pick_truck: "{hint}? Pick a truck",
    nights_apply: "{n} nights out",
    night_apply: "1 night out",
    apply: "Apply",
    diesel_use: "Diesel {price}/L",
    use_quote: "Use for this quote",
    via: "Via {post}",
    seconds_left: "{s} s left",
    filled_aria: "filled",
    chip_go: "go to the field",
  },
  af: {
    listening: "Luister…",
    lang_auto: "Engels of Afrikaans",
    lang_en: "Engels",
    lang_af: "Afrikaans",
    heard_in: "Gehoor in {lang}",
    heard_mixed: "Engels + Afrikaans gehoor",
    reading: "Lees…",
    filled: "Ingevul",
    check_this: "Kyk gerus",
    didnt_catch: "Nie verstaan nie:",
    replace_q: "Vervang {n} velde?",
    replace_q1: "Vervang 1 veld?",
    replace: "Vervang",
    keep: "Hou myne",
    undo: "Ontdoen",
    abnormal: "Abnormale vrag",
    no_speech: "Niks gehoor nie — probeer weer, bietjie nader aan die mikrofoon.",
    too_long: "Gestop by 1 minuut",
    mic_denied: "Mikrofoontoestemming is nodig om op te neem",
    placeholder: "Beskryf die vrag, bv. 28 ton staalrolle Joburg na Durban",
    placeholder_short: "bv. 28 ton staal, Joburg na Durban",
    mic_label: "Neem stembeskrywing op",
    stop_label: "Stop opname",
    stop: "Stop",
    fill: "Vul in",
    mode_auto: "Outo",
    mode_label: "Taal vir stem: {mode}. Verander",
    pick_truck: "{hint}? Kies ’n trok",
    nights_apply: "{n} nagte weg",
    night_apply: "1 nag weg",
    apply: "Pas toe",
    diesel_use: "Diesel {price}/L",
    use_quote: "Gebruik vir hierdie kwotasie",
    via: "Oor {post}",
    seconds_left: "{s} s oor",
    filled_aria: "ingevul",
    chip_go: "gaan na die veld",
  },
} as const;

export type CopyKey = keyof typeof COPY.en;

export function vt(lang: UiLang, key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = COPY[lang][key] ?? COPY.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** The voice UI follows the last voice/chat answer: Afrikaans only when it said "af". */
export const uiLangFrom = (language: string | null | undefined): UiLang => (language === "af" ? "af" : "en");

// ---- language chip (Auto → English → Afrikaans), remembered per device ----
export const LANG_MODE_KEY = "tw.voice.language";
export const nextLangMode = (m: VoiceLangMode): VoiceLangMode => (m === "auto" ? "en" : m === "en" ? "af" : "auto");
export function langModeText(m: VoiceLangMode, lang: UiLang): string {
  return m === "auto" ? vt(lang, "mode_auto") : m === "en" ? vt(lang, "lang_en") : vt(lang, "lang_af");
}
/** The line under "Listening…": both languages in auto mode, else the forced one. */
export function listeningLangLine(m: VoiceLangMode, lang: UiLang): string {
  return m === "auto" ? vt(lang, "lang_auto") : m === "en" ? vt(lang, "lang_en") : vt(lang, "lang_af");
}
export function loadLangMode(): VoiceLangMode {
  try {
    const v = window.localStorage.getItem(LANG_MODE_KEY);
    return v === "en" || v === "af" ? v : "auto";
  } catch { return "auto"; }
}
export function saveLangMode(m: VoiceLangMode): void {
  try { window.localStorage.setItem(LANG_MODE_KEY, m); } catch { /* private window: not remembered */ }
}

/** "Heard in Afrikaans", or the mixed badge when the two passes scored close. */
export function heardBadge(lang: UiLang, languageLabel: string | null | undefined, confidence: string | null | undefined): string | null {
  if (confidence === "low") return vt(lang, "heard_mixed");
  if (!languageLabel) return null;
  const label = lang === "af" && /^english$/i.test(languageLabel) ? "Engels" : languageLabel;
  return vt(lang, "heard_in", { lang: label });
}

// ---- voice-quote errors: the server's plain English, or Afrikaans by status ----
const AF_VOICE_ERRORS: Record<number, string> = {
  400: "Die opname was leeg — probeer weer.",
  413: "Die opname is te lank — hou dit onder ’n minuut.",
  422: COPY.af.no_speech,
  502: "Die klank kon nie gelees word nie — probeer weer.",
  503: "Stem is nou nie beskikbaar nie — tik eerder die beskrywing.",
  500: "Kon nie die opname lees nie — probeer weer.",
};
export function voiceErrorText(status: number | null | undefined, serverError: string | null | undefined, lang: UiLang): string {
  if (lang === "af") return AF_VOICE_ERRORS[status ?? 500] ?? AF_VOICE_ERRORS[500];
  if (status === 422) return COPY.en.no_speech;
  return serverError?.trim() || "Couldn't read that recording — try again.";
}

// ---- wording (mirrors the backend reply's _summary) ----
const AF_MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-09" → "9 Oct" ("9 Okt"); the year only when it is not this year. */
export function shortDate(iso: string, lang: UiLang, thisYear = new Date().getFullYear()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso;
  const mon = (lang === "af" ? AF_MONTHS : EN_MONTHS)[Number(m[2]) - 1];
  return `${Number(m[3])} ${mon}${Number(m[1]) !== thisYear ? ` ${m[1]}` : ""}`;
}
/** SA number: decimal comma, no trailing zeros. 1.5 → "1,5". */
export const saNum = (n: number, dp = 2): string => String(Math.round(n * 10 ** dp) / 10 ** dp).replace(".", ",");
export const tonnes = (kg: number): string => `${saNum(kg / 1000)} t`;
export const randPerL = (p: number): string => `R ${p.toFixed(2).replace(".", ",")}`;
/** "Oshoek / Ngwenya" → "Oshoek" (the SA side, as the border line shows it). */
export const borderPostShort = (post: string): string => post.split(" / ")[0].trim();

// The backend fills places with their geocodable (English/official) name;
// the chip shows the place as the user said it when that was the Afrikaans
// name (mirrors quote_nl._AF_PLACE).
const AF_PLACES: Record<string, string> = {
  "cape town": "Kaapstad", "east london": "Oos-Londen", "richards bay": "Richardsbaai", "mossel bay": "Mosselbaai",
  "walvis bay": "Walvisbaai", "namibia": "Namibië", "zambia": "Zambië", "mozambique": "Mosambiek",
};
/**
 * How the user said a place: an explicit spoken form from the server when it
 * sends one, else the Afrikaans name when that is what the message used,
 * else the filled name.
 */
export function spokenPlace(filled: string, message: string, spoken?: string | null): string {
  if (spoken && spoken.trim()) return spoken.trim();
  const af = AF_PLACES[filled.trim().toLowerCase()];
  return af && message.toLowerCase().includes(af.toLowerCase()) ? af : filled;
}

const VEHICLE_HINT_NAMES: Record<string, string> = {
  interlink: "Superlink", tautliner: "Tautliner", reefer: "Reefer", tipper: "Tipper", flatbed: "Flatbed",
  tanker: "Tanker", lowbed: "Low-bed", ldv: "LDV", semi: "Semi-trailer", rigid: "Rigid",
};
export const vehicleHintName = (hint: string): string => VEHICLE_HINT_NAMES[hint] ?? hint.charAt(0).toUpperCase() + hint.slice(1);

export function tripShapeText(tripType: string | undefined, returnLoadBooked: boolean | undefined, lang: UiLang): string | null {
  const af = lang === "af";
  if (tripType === "ROUND_TRIP") return af ? "heen en terug, gelaai" : "round trip, loaded both ways";
  if (returnLoadBooked === true) return af ? "eenrigting, retoervrag bespreek" : "one way, return load booked";
  if (returnLoadBooked === false) return af ? "eenrigting, leeg terug" : "one way, empty back";
  if (tripType === "ONE_WAY") return af ? "eenrigting" : "one way";
  return null;
}

// ---- chips: one per field this turn actually set ----
/** Where a chip takes the user (the page maps these to its fields). */
export type FieldTarget = "pickup" | "delivery" | "weight" | "cargo" | "truck" | "client"
  | "pickup_date" | "delivery_date" | "valid_until" | "trip" | "return" | "abnormal" | "stops";

/** What this Fill set, in display form (only the keys it set). */
export interface AppliedSummary {
  pickup?: string; delivery?: string; stops?: string[];
  weightKg?: number; cargo?: string; truck?: string; client?: string;
  pickupDate?: string; deliveryDate?: string; validUntil?: string;
  tripType?: string; returnLoadBooked?: boolean;
  borderPost?: string; international?: boolean; abnormal?: boolean;
}

/** What the last Fill set and said, for the feedback under the bar. */
export interface FillInfo {
  applied: AppliedSummary; conf: Record<string, number>; didntCatch: string | null;
  vehicleHint: string | null; driverNights: number | null; fuelPrice: number | null;
}

export interface FillChip { key: string; text: string; target: FieldTarget; check: boolean; aria: string }

/** Backend field names behind each chip, for field_confidence. */
const CHIP_FIELDS: Record<string, string[]> = {
  route: ["pickup_location", "delivery_location", "stops"], load: ["weight", "cargo_description"],
  truck: ["vehicle_type"], client: ["customer_id", "customer_name"], pickup_date: ["pickup_date"],
  delivery_date: ["delivery_date"], valid_until: ["valid_until"], trip: ["trip_type", "return_load_booked"],
  border: ["international", "border_post"], abnormal: ["abnormal_load"],
};
export const LOW_CONFIDENCE = 0.7;
export const isLow = (conf: Record<string, number> | null | undefined, field: string): boolean =>
  !!conf && typeof conf[field] === "number" && conf[field] < LOW_CONFIDENCE;

export function buildFillChips(a: AppliedSummary, conf: Record<string, number> | null | undefined, lang: UiLang): FillChip[] {
  const af = lang === "af";
  const chips: Omit<FillChip, "check" | "aria">[] = [];
  const checked = new Set<string>();
  const low = (key: string, fields?: string[]) => { if ((fields ?? CHIP_FIELDS[key]).some(f => isLow(conf, f))) checked.add(key); };
  // route
  if (a.pickup || a.delivery || a.stops?.length) {
    // Only the ends this Fill set ("Bloemfontein → Durban", or just "Durban").
    let text = [a.pickup, a.delivery].filter(Boolean).join(" → ");
    if (a.stops?.length) text = text ? `${text} ${af ? "oor" : "via"} ${a.stops.join(", ")}` : `${af ? "Oor" : "Via"} ${a.stops.join(", ")}`;
    chips.push({ key: "route", text, target: a.pickup ? "pickup" : a.delivery ? "delivery" : "stops" });
    const f: string[] = [];
    if (a.pickup) f.push("pickup_location");
    if (a.delivery) f.push("delivery_location");
    if (a.stops?.length) f.push("stops");
    low("route", f);
  }
  // weight + cargo
  if (a.weightKg != null || a.cargo) {
    const text = [a.weightKg != null ? tonnes(a.weightKg) : "", a.cargo ?? ""].filter(Boolean).join(" ");
    chips.push({ key: "load", text, target: a.weightKg != null ? "weight" : "cargo" });
    low("load", [...(a.weightKg != null ? ["weight"] : []), ...(a.cargo ? ["cargo_description"] : [])]);
  }
  if (a.truck) { chips.push({ key: "truck", text: a.truck, target: "truck" }); low("truck"); }
  if (a.client) { chips.push({ key: "client", text: `${af ? "kliënt" : "client"} ${a.client}`, target: "client" }); low("client"); }
  if (a.pickupDate) { chips.push({ key: "pickup_date", text: `${af ? "oplaai" : "pickup"} ${shortDate(a.pickupDate, lang)}`, target: "pickup_date" }); low("pickup_date"); }
  if (a.deliveryDate) { chips.push({ key: "delivery_date", text: `${af ? "aflewer" : "deliver"} ${shortDate(a.deliveryDate, lang)}`, target: "delivery_date" }); low("delivery_date"); }
  if (a.validUntil) { chips.push({ key: "valid_until", text: `${af ? "geldig tot" : "valid until"} ${shortDate(a.validUntil, lang)}`, target: "valid_until" }); low("valid_until"); }
  const shape = tripShapeText(a.tripType, a.returnLoadBooked, lang);
  if (shape) { chips.push({ key: "trip", text: shape, target: a.returnLoadBooked != null && a.tripType !== "ROUND_TRIP" ? "return" : "trip" }); low("trip", [...(a.tripType ? ["trip_type"] : []), ...(a.returnLoadBooked != null ? ["return_load_booked"] : [])]); }
  if (a.international || a.borderPost) {
    chips.push({ key: "border", text: (af ? "oorgrens" : "cross-border") + (a.borderPost ? ` (${borderPostShort(a.borderPost)})` : ""), target: "pickup" });
    low("border");
  }
  if (a.abnormal != null) {
    chips.push({ key: "abnormal", text: a.abnormal ? vt(lang, "abnormal").toLowerCase() : (af ? "nie abnormaal nie" : "not abnormal"), target: "abnormal" });
    low("abnormal");
  }
  return chips.map(c => {
    const check = checked.has(c.key);
    const text = c.text.charAt(0).toUpperCase() + c.text.slice(1);
    return { ...c, text, check, aria: `${text}, ${vt(lang, "filled_aria")}${check ? `, ${vt(lang, "check_this").toLowerCase()}` : ""}` };
  });
}

/** "Didn't catch: a; b" — nothing when the list is empty. */
export function didntCatchLine(items: unknown, lang: UiLang): string | null {
  const list = Array.isArray(items) ? items.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 5) : [];
  return list.length ? `${vt(lang, "didnt_catch")} ${list.join("; ")}` : null;
}

// ---- Replace / Keep mine ----
/** Same text, ignoring case, spacing and punctuation ("Cape Town" = "cape town,"). */
export const sameText = (a: string, b: string): boolean =>
  a.trim().toLowerCase().replace(/[\s,.;]+/g, " ").trim() === b.trim().toLowerCase().replace(/[\s,.;]+/g, " ").trim();

/** Two points within ~3 km are the same place written two ways (Kaapstad / Cape Town). */
export function samePlace(a: { lat: number; lon: number } | null | undefined, b: { lat: number; lon: number } | null | undefined): boolean {
  if (!a || !b) return false;
  const dLat = (a.lat - b.lat) * 111;
  const dLon = (a.lon - b.lon) * 111 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLon) < 3;
}

/**
 * A field the Fill would change is a conflict only when the form holds a
 * value the user set (typed / picked / a reopened quote's), not one an
 * earlier Fill set, and it differs from the new one.
 */
export function isConflict(current: string, next: string, lastFilled: string | undefined, isEmpty = current.trim() === ""): boolean {
  if (isEmpty) return false;
  if (lastFilled !== undefined && current === lastFilled) return false;
  return !sameText(current, next);
}

export interface ConflictLine { label: string; from: string; to: string }
export function replaceQuestion(lines: ConflictLine[], lang: UiLang): string {
  const q = lines.length === 1 ? vt(lang, "replace_q1") : vt(lang, "replace_q", { n: lines.length });
  return `${q} ${lines.map(l => `${l.label} ${l.from} → ${l.to}`).join(" · ")}`;
}

export const FIELD_LABELS: Record<UiLang, Record<FieldTarget, string>> = {
  en: { pickup: "Collection", delivery: "Delivery", weight: "Weight", cargo: "Cargo", truck: "Truck", client: "Client",
    pickup_date: "Pickup date", delivery_date: "Delivery date", valid_until: "Valid until", trip: "Trip",
    return: "Truck comes back", abnormal: "Abnormal load", stops: "Stops" },
  af: { pickup: "Oplaai", delivery: "Aflewering", weight: "Gewig", cargo: "Vrag", truck: "Trok", client: "Kliënt",
    pickup_date: "Oplaaidatum", delivery_date: "Afleweringsdatum", valid_until: "Geldig tot", trip: "Rit",
    return: "Trok kom terug", abnormal: "Abnormale vrag", stops: "Stops" },
};
