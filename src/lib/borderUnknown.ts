// The route's "border costs not on file" report (border_costs_unknown
// {countries, crossings} + cross_border_breakdown) as compute()'s
// border_costs_unknown input — the same as the backend's
// quote_costing.border_costs_unknown_input: country codes become names,
// "NA-AO" becomes "Namibia→Angola", the known parts are labelled.
// null when every part of the route has its figures on file.
export const COUNTRY_NAMES: Record<string, string> = {
  SA: "South Africa", ZW: "Zimbabwe", MZ: "Mozambique", BW: "Botswana", NA: "Namibia",
  LS: "Lesotho", SZ: "Eswatini", ZM: "Zambia", MW: "Malawi", TZ: "Tanzania", KE: "Kenya",
  AO: "Angola", CD: "the DR Congo", CG: "the Republic of the Congo", UG: "Uganda", RW: "Rwanda",
  BI: "Burundi", MG: "Madagascar",
};

export interface BorderUnknown { countries: string[]; crossings: string[]; known: { label: string; amount: number }[] }

type Raw = { countries?: unknown; crossings?: unknown; known?: unknown } | null | undefined;
type Item = { type?: string; description?: string | null; amount?: unknown };

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function crossingName(code: string): string {
  const parts = code.split("-");
  return parts.length === 2 ? parts.map((p) => COUNTRY_NAMES[p] ?? p).join("→") : code;
}

function knownLabel(item: Item): string {
  const desc = String(item.description ?? "");
  if (item.type === "border_crossing") return desc.replace(" border crossing", "").replace(" → ", "→").split(" (")[0];
  if (item.type === "sa_permit") return "permit";
  return desc.split(" (")[0];
}

export function borderCostsUnknown(raw: Raw, breakdown?: Item[] | null): BorderUnknown | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((c) => c);
  const countries = list(raw.countries).map((c) => COUNTRY_NAMES[String(c).toUpperCase()] ?? String(c)).slice(0, 10);
  const crossings = list(raw.crossings).map((c) => (String(c).includes("→") ? String(c) : crossingName(String(c)))).slice(0, 10);
  if (!countries.length && !crossings.length) return null;
  const knownRaw: { label?: unknown; amount?: unknown }[] = Array.isArray(raw.known)
    ? raw.known as { label?: unknown; amount?: unknown }[]
    : (breakdown || []).filter((b) => b && typeof b === "object").map((b) => ({ label: knownLabel(b), amount: numOrNull(b.amount) }));
  const known = knownRaw.slice(0, 12)
    .filter((k) => k && typeof k === "object" && numOrNull(k.amount) !== null)
    .map((k) => ({ label: String(k.label ?? "").slice(0, 60), amount: numOrNull(k.amount) as number }));
  return { countries, crossings, known };
}
