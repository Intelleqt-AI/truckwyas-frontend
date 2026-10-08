// Tonnage quotes (rate per tonne): display helpers and API shapes shared by the
// quote builder, the order page and the contracts page. The maths lives in
// quoteRules.ts (computeTonnage, golden-checked against the backend).
import { fmtNum, fmtRand, type Tonnage, type TonnageTruck } from "./quoteRules.ts";

/** "30 t", "22,75 t", "27,5 t": SA format, up to 2 decimals, no trailing zeros. */
export function fmtTonnes(v: number | string | null | undefined): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "—";
  let txt = fmtNum(n, 2);
  if (txt.includes(",")) txt = txt.replace(/0+$/, "").replace(/,$/, "");
  return `${txt} t`;
}

/** "R 1 300/t", "R 1 300,50/t"; whole: costs to the rand ("R 4 996/t"). */
export function fmtRatePerTonne(v: number | string | null | undefined, whole = false): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "—";
  return `${fmtRand(n, whole || Number.isInteger(n) ? 0 : 2)}/t`;
}

/** "Superlink 34 t" */
export const truckText = (t: Pick<TonnageTruck, "name" | "payload_t">) => `${t.name || "Truck"} ${fmtTonnes(t.payload_t)}`;

/** One line: which truck the quote is priced on, and why. `held`: the
 *  builder holds the auto truck (see nextAutoBasis), so no reason is claimed. */
export function basisReason(t: Tonnage | null | undefined, held = false): string | null {
  if (!t) return null;
  const basis = t.trucks.find((x) => x.is_basis);
  if (!basis) return null;
  if (held) return `Priced on ${truckText(basis)}.`;
  if (t.basis_reason === "chosen") return `Priced on ${truckText(basis)}, your choice.`;
  if (t.basis_reason === "costs_unknown") return `Priced on ${truckText(basis)} until costs are known.`;
  return t.trucks.length > 1
    ? `Priced on ${truckText(basis)}: highest cost per tonne, so any truck covers it.`
    : `Priced on ${truckText(basis)}, the only truck that fits.`;
}

/** "1 load", "20 loads" */
export const loadsText = (n: number | null | undefined) => (n == null ? "—" : `${fmtNum(n)} load${n === 1 ? "" : "s"}`);

/** Load API `tonnage` (core.services.tonnage_jobs.load_billing). */
export interface LoadTonnage {
  tonnes: number; tonnes_source: "actual" | "planned"; min_tonnes: number | null; billable_tonnes: number;
  rate_per_tonne: number; amount: number; awaiting_weighbridge: boolean; flag: string | null;
}

/** Quote API `volume_contract`. */
export interface VolumeContract {
  total_tonnes: number; booked_tonnes: number; delivered_tonnes?: number; remaining_tonnes: number;
  loads_booked: number; loads_planned: number | null; tonnes_per_load: number | null;
  /** The most one call-off can carry (the largest eligible truck), when known. */
  max_tonnes_per_load?: number | null;
  contract_start?: string | null; contract_end?: string | null;
  loads?: { id: number; load_number: string; status: string; pickup_date: string | null; planned_tonnes: number | null;
    actual_tonnes: number | null; weighbridge_slip: string | null; total_amount: number }[];
}

/** Share of the contract booked, 0–100 (whole). */
export const contractPct = (c: VolumeContract) =>
  c.total_tonnes > 0 ? Math.min(100, Math.round((c.booked_tonnes / c.total_tonnes) * 100)) : 0;

/** "1 Oct – 31 Dec 2026" style period in SAST from yyyy-mm-dd strings. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function periodText(start?: string | null, end?: string | null): string | null {
  const p = (s?: string | null) => {
    const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
  };
  const a = p(start), b = p(end);
  if (!a && !b) return null;
  const f = (x: { y: number; m: number; d: number }, year: boolean) => `${x.d} ${MONTHS[x.m]}${year ? ` ${x.y}` : ""}`;
  if (a && b) return `${f(a, a.y !== b.y)} to ${f(b, true)}`;
  return a ? `From ${f(a, true)}` : `Until ${f(b!, true)}`;
}

/**
 * Truck unknown: the builder routes and prices on the tonnage basis truck, and
 * the basis can depend on that route (toll class), so following it could flip
 * back and forth. One rule for web and app:
 *  - only a basis worked out on known costs (basis_reason "safest") is followed;
 *    one picked while costs were unknown is never held on to;
 *  - a new set of inputs (key: tonnes, lane, trip, cargo; not the truck) starts
 *    afresh;
 *  - A -> B -> A within one key holds the current truck (`held`): the builder
 *    then prices on that truck by id, so the Truck field, the Costs card and
 *    the "Priced on" line always name the same truck.
 */
export interface AutoBasis { key: string; name: string | null; flips: string[]; held: boolean }
export const AUTO_BASIS_START: AutoBasis = { key: "", name: null, flips: [], held: false };
export function nextAutoBasis(state: AutoBasis, key: string, basisName: string | null | undefined,
  reason: string | null | undefined): AutoBasis {
  const s = key !== state.key ? { key, name: state.name, flips: [], held: false } : state;
  if (reason !== "safest" || !basisName || basisName === s.name || s.held) return s;
  const flips = [...s.flips, basisName];
  if (flips.length >= 3 && flips[flips.length - 1] === flips[flips.length - 3]) return { ...s, flips, held: true };
  return { ...s, flips, name: basisName };
}

/** The most the next call-off can carry: what is left, and no more than the
 *  largest eligible truck (the server's cap, same on web and app). */
export function callOffCap(c: Pick<VolumeContract, "remaining_tonnes" | "max_tonnes_per_load">): number {
  return c.max_tonnes_per_load != null ? Math.min(c.remaining_tonnes, c.max_tonnes_per_load) : c.remaining_tonnes;
}
/** Call-off tonnes as typed -> number, or the reason it can't be booked. */
export function checkCallOff(text: string, cap: number): { tonnes: number | null; error: string | null } {
  const t = text.replace(/\s/g, "").replace(",", ".");
  const n = Number(t);
  if (t === "" || !Number.isFinite(n) || !/^\d+(\.\d{1,3})?$/.test(t)) return { tonnes: null, error: "Enter the tonnes, e.g. 28,5." };
  if (n < 0.1) return { tonnes: null, error: "A load is at least 0,1 t." };
  if (n > cap + 1e-9) return { tonnes: null, error: `Up to ${fmtTonnes(cap)} on this load.` };
  return { tonnes: n, error: null };
}
