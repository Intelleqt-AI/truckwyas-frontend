// Which diesel price a quote is priced on (QUOTE-RULES.md §1–2).
//
// Pure (no React, no fetch, no "@/" imports) so node can test it directly.
// Inputs are the company profile (api/v1/company/profile/) and the response of
// GET api/v1/fuel-prices/current/. The rule itself lives in quoteRules.ts
// (resolveDiesel, mirrored from the backend); this file only gathers its
// input from what the API sends:
//  - `company_price` on the fuel-price response (or `diesel_price_in_use` on
//    the profile): the server's own resolution — mode, official, own, stale.
//  - else the profile's fuel_price_mode / fuel_price_own(_set_at) and the
//    official zone price on the fuel-price response;
//  - a profile without fuel_price_mode (older backend) is read with the §1
//    migration rule, so old data never prices on 23.50.
// Never a default number. FALLBACK / FALLBACK_LATEST rows are never priced on.

import { resolveDiesel, dieselWarnings, type DieselInput, type ResolvedDiesel } from "./quoteRules.ts";

export interface QuoteWarning {
  code: string;
  severity: "block" | "warn";
  title: string;
  detail?: string;
  impact_zar?: number | null;
  actions: { id: string; label: string }[];
  [extra: string]: unknown;
}

export type DieselPriceSource = ResolvedDiesel["source"];
export type Zone = "INLAND" | "COASTAL";

export interface ResolvedDieselPrice extends ResolvedDiesel {
  /** SAST day the official price took effect / the own price was set. */
  officialFrom: string | null;
  ownSetAtDay: string | null;
  input: DieselInput;
  warnings: QuoteWarning[];
}

/** The fields read from the server's diesel resolution (company_price / diesel_price_in_use). */
interface ServerDiesel {
  mode?: string; zone?: string; price?: unknown; source?: string;
  /** Petrol resolution only (petrol_price_in_use / company_petrol_price). */
  fuel_type?: string; grade?: string | null;
  official?: { price?: unknown; effective_from?: string | null; stale?: boolean } | null;
  own?: { price?: unknown; set_at?: string | null } | null;
}
/** The company profile fields read here (api/v1/company/profile/). */
export interface CompanyLike {
  fuel_zone?: string | null; fuel_price_mode?: string | null; fuel_price_own?: unknown;
  fuel_price_own_set_at?: string | null; fuel_price_per_litre?: unknown; updated_at?: string | null;
  diesel_price_in_use?: ServerDiesel | null;
  // Petrol (petrol and hybrid trucks), same rule as diesel. Absent on an
  // older backend: petrol is then priced on fuel_price_petrol alone.
  fuel_price_petrol?: unknown; fuel_price_petrol_mode?: string | null; fuel_price_petrol_set_at?: string | null;
  fuel_price_petrol_grade?: string | null; petrol_price_in_use?: ServerDiesel | null;
  fuel_price_electric?: unknown; fuel_price_hybrid?: unknown;
}
/** One official petrol figure on the fuel-price response (null = not published). */
export interface OfficialPetrol { price?: unknown; effective_from?: string | null; source?: string | null; stale?: boolean }
/** The fuel-price response fields read here (api/v1/fuel-prices/current/). */
export interface LiveLike {
  success?: boolean; source?: string | null; zone?: string | null; zone_price?: unknown;
  inland_price?: unknown; coastal_price?: unknown; diesel_500ppm_inland?: unknown; diesel_500ppm_coastal?: unknown;
  effective_from?: string | null; last_updated?: string | null; stale?: boolean; company_price?: ServerDiesel | null;
  petrol?: { inland_95?: OfficialPetrol | null; inland_93?: OfficialPetrol | null; coastal_95?: OfficialPetrol | null; coastal_93?: OfficialPetrol | null } | null;
  company_petrol_price?: ServerDiesel | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FALLBACK_SOURCES = ["FALLBACK", "FALLBACK_LATEST"];
const LEGACY_DEFAULT = 23.5;
const SAST_MS = 2 * 3600 * 1000;

const positive = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** "YYYY-MM-DD" in SAST: a plain date as written, a timestamp converted. */
export const isoDay = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v}Z`);
  if (Number.isNaN(d.getTime())) {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const s = new Date(d.getTime() + SAST_MS);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
};
function sastYear(d: Date) { return new Date(d.getTime() + SAST_MS).getUTCFullYear(); }
/** "2 Sep" (or "2 Sep 2025" when not this year). */
export const shortDate = (iso: string | null, now = new Date()): string | null => {
  const day = isoDay(iso);
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${sastYear(now) === y ? "" : ` ${y}`}`;
};
/** "7 Oct 2026" */
export const longDate = (iso: string | null): string | null => {
  const day = isoDay(iso);
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
/** R/L with comma decimals: "R 32,80". */
export const randPerLitre = (n: number) => `R ${n.toFixed(2).replace(".", ",")}`;

// ---- §2 diesel period: first Wednesday of the month, 00:01 SAST ----
function firstWednesday(y: number, m: number): Date {
  const dow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const day = 1 + ((3 - dow + 7) % 7);
  return new Date(Date.UTC(y, m, day, 0, 1) - SAST_MS);
}
export function currentPeriodStart(now = new Date()): Date {
  const s = new Date(now.getTime() + SAST_MS);
  const y = s.getUTCFullYear(), m = s.getUTCMonth();
  const here = firstWednesday(y, m);
  if (here.getTime() <= now.getTime()) return here;
  return m === 0 ? firstWednesday(y - 1, 11) : firstWednesday(y, m - 1);
}
export function currentPeriodStartIso(now = new Date()): string {
  return isoDay(currentPeriodStart(now).toISOString()) as string;
}

/** §1 migration for a profile that predates fuel_price_mode. */
function legacyMode(company: CompanyLike | null | undefined, live: LiveLike | null | undefined): { mode: "LIVE" | "OWN"; own: number | null; setAt: string | null } {
  const v = positive(company?.fuel_price_per_litre);
  if (v == null || Math.abs(v - LEGACY_DEFAULT) < 0.005) return { mode: "LIVE", own: null, setAt: null };
  const known = [live?.inland_price, live?.coastal_price, live?.diesel_500ppm_inland, live?.diesel_500ppm_coastal, live?.zone_price]
    .map(positive).filter((x): x is number => x != null);
  if (known.some((k) => Math.abs(k - v) <= 0.005)) return { mode: "LIVE", own: null, setAt: null };
  return { mode: "OWN", own: v, setAt: company?.updated_at ?? null };
}

/** The quoteRules diesel input for this company, from what the API sent. */
export function dieselInputFrom({ company, live, now = new Date() }: { company: CompanyLike | null | undefined; live: LiveLike | null | undefined; now?: Date }): DieselInput {
  const server = live?.company_price ?? company?.diesel_price_in_use ?? null;
  if (server && typeof server === "object" && server.official && typeof server.official === "object") {
    return {
      zone: server.zone ?? company?.fuel_zone ?? "INLAND",
      mode: server.mode ?? "LIVE",
      own_price: positive(server.own?.price),
      own_set_at: server.own?.set_at ?? null,
      official_price: positive(server.official.price),
      official_effective_from: server.official.effective_from ?? null,
      official_stale: server.official.stale === true,
    };
  }
  const zone: Zone = (company?.fuel_zone ?? live?.zone) === "COASTAL" ? "COASTAL" : "INLAND";
  let official: number | null = null;
  let from: string | null = null;
  if (live && live.success !== false && !FALLBACK_SOURCES.includes(String(live.source ?? "").toUpperCase())) {
    official = positive(live.zone === zone ? live.zone_price : null) ?? positive(zone === "COASTAL" ? live.coastal_price : live.inland_price);
    from = official == null ? null : (live.effective_from ?? live.last_updated ?? null);
  }
  const hasMode = company && (company.fuel_price_mode === "LIVE" || company.fuel_price_mode === "OWN");
  const m = hasMode
    ? { mode: company.fuel_price_mode as "LIVE" | "OWN", own: positive(company.fuel_price_own), setAt: company.fuel_price_own_set_at ?? null }
    : legacyMode(company, live);
  const fromDay = isoDay(from);
  const stale = official != null && (live?.stale === true || (fromDay != null && fromDay < currentPeriodStartIso(now)));
  return { zone, mode: m.mode, own_price: m.own, own_set_at: m.setAt, official_price: official, official_effective_from: from, official_stale: stale };
}

/** The diesel price (and its §1 warnings) for this company today. */
export function resolveDieselPrice({ company, live, now = new Date(), useOfficial = false, overridePrice = null, litres = null }:
  { company: CompanyLike | null | undefined; live: LiveLike | null | undefined; now?: Date; useOfficial?: boolean; overridePrice?: number | null; litres?: number | null }): ResolvedDieselPrice {
  const input: DieselInput = { ...dieselInputFrom({ company, live, now }), use_official: useOfficial, override_price: overridePrice };
  const r = resolveDiesel(input);
  return {
    ...r,
    officialFrom: isoDay(r.official_effective_from),
    ownSetAtDay: isoDay(r.own_set_at),
    input,
    warnings: dieselWarnings(r, litres) as QuoteWarning[],
  };
}

/** "official inland, 7 Oct" / "your price, 4 Sep" — the one source note. */
export function dieselSourceNote(r: { source: string; zone: string; official_effective_from?: string | null; own_set_at?: string | null }, now = new Date()): string {
  const zone = r.zone === "COASTAL" ? "coastal" : "inland";
  if (r.source === "own") return `your price${r.own_set_at ? `, ${shortDate(r.own_set_at, now)}` : ""}`;
  if (r.source === "official") return `official ${zone}${r.official_effective_from ? `, ${shortDate(r.official_effective_from, now)}` : ""}`;
  if (r.source === "override") return "set for this quote";
  return "missing";
}

// ---- other fuels (petrol, hybrid, electric) ----

/** Which price a truck's fuel_type is priced on: hybrid trucks use petrol. */
export type FuelKind = "Diesel" | "Petrol" | "Electric";
export function fuelKind(fuelType: string | null | undefined): FuelKind {
  const f = String(fuelType || "Diesel").trim().toLowerCase();
  if (f === "petrol" || f === "hybrid") return "Petrol";
  if (f === "electric") return "Electric";
  return "Diesel";
}

/** The official petrol grade a company prices on: 93 only inland and only when chosen. */
export function petrolGrade(company: CompanyLike | null | undefined): "95" | "93" {
  const zone = String(company?.fuel_zone || "INLAND").toUpperCase();
  return String(company?.fuel_price_petrol_grade || "95") === "93" && zone !== "COASTAL" ? "93" : "95";
}

/** True when the backend resolves petrol as Official / My own price. */
export function hasPetrolModes(company: CompanyLike | null | undefined, live?: LiveLike | null): boolean {
  return !!(live?.company_petrol_price || company?.petrol_price_in_use
    || company?.fuel_price_petrol_mode === "LIVE" || company?.fuel_price_petrol_mode === "OWN");
}

/** The quoteRules fuel input for petrol (and hybrid trucks). Never writes or
 * invents a figure: the server's resolution when sent, else the profile's
 * mode + the official zone/grade figure, else (older backend) the company's
 * own petrol price only. `hybridLegacy`: an older backend prices hybrid trucks
 * on fuel_price_hybrid, so match it until the backend has petrol modes. */
export function petrolInputFrom({ company, live, hybridLegacy = false }:
  { company: CompanyLike | null | undefined; live: LiveLike | null | undefined; hybridLegacy?: boolean }): DieselInput {
  const server = live?.company_petrol_price ?? company?.petrol_price_in_use ?? null;
  if (server && typeof server === "object" && server.official && typeof server.official === "object") {
    return {
      zone: server.zone ?? company?.fuel_zone ?? "INLAND",
      mode: server.mode ?? "LIVE",
      own_price: positive(server.own?.price),
      own_set_at: server.own?.set_at ?? null,
      official_price: positive(server.official.price),
      official_effective_from: server.official.effective_from ?? null,
      official_stale: server.official.stale === true,
      fuel_type: "Petrol",
      grade: server.grade ?? petrolGrade(company),
    };
  }
  const zone: Zone = (company?.fuel_zone ?? live?.zone) === "COASTAL" ? "COASTAL" : "INLAND";
  if (hasPetrolModes(company, live)) {
    const grade = petrolGrade(company);
    const rec = live?.petrol?.[`${zone === "COASTAL" ? "coastal" : "inland"}_${grade}` as "inland_95"] ?? null;
    const official = rec && !FALLBACK_SOURCES.includes(String(rec.source ?? "").toUpperCase()) ? positive(rec.price) : null;
    return {
      zone, mode: company?.fuel_price_petrol_mode === "OWN" ? "OWN" : "LIVE",
      own_price: positive(company?.fuel_price_petrol), own_set_at: company?.fuel_price_petrol_set_at ?? null,
      official_price: official, official_effective_from: official != null ? rec?.effective_from ?? null : null,
      official_stale: official != null && rec?.stale === true,
      fuel_type: "Petrol", grade,
    };
  }
  // Older backend: the own price only (no official petrol), missing = blocked.
  const own = hybridLegacy ? positive(company?.fuel_price_hybrid) ?? positive(company?.fuel_price_petrol) : positive(company?.fuel_price_petrol);
  return { zone, mode: "OWN", own_price: own, own_set_at: null, official_price: null, fuel_type: "Petrol" };
}

/** Electric: no official price, the company's own cost per kWh only. */
export function electricInputFrom({ company }: { company: CompanyLike | null | undefined }): DieselInput {
  return { zone: company?.fuel_zone === "COASTAL" ? "COASTAL" : "INLAND", mode: "OWN",
    own_price: positive(company?.fuel_price_electric), own_set_at: null, official_price: null, fuel_type: "Electric" };
}

/** The fuel input for a truck of `fuelType`: diesel and petrol (petrol + hybrid)
 * are Official / My own price; electric is own only. */
export function fuelInputFor({ fuelType, company, live, now = new Date() }:
  { fuelType: string | null | undefined; company: CompanyLike | null | undefined; live: LiveLike | null | undefined; now?: Date }): DieselInput {
  const kind = fuelKind(fuelType);
  if (kind === "Petrol") return petrolInputFrom({ company, live, hybridLegacy: String(fuelType).toLowerCase() === "hybrid" });
  if (kind === "Electric") return electricInputFrom({ company });
  return dieselInputFrom({ company, live, now });
}

/** The petrol price (and its §1 warnings) for this company today. */
export function resolvePetrolPrice({ company, live, useOfficial = false, overridePrice = null, litres = null }:
  { company: CompanyLike | null | undefined; live: LiveLike | null | undefined; useOfficial?: boolean; overridePrice?: number | null; litres?: number | null }): ResolvedDieselPrice {
  const input: DieselInput = { ...petrolInputFrom({ company, live }), use_official: useOfficial, override_price: overridePrice };
  const r = resolveDiesel(input);
  return { ...r, officialFrom: isoDay(r.official_effective_from), ownSetAtDay: isoDay(r.own_set_at), input,
    warnings: dieselWarnings(r, litres) as QuoteWarning[] };
}
