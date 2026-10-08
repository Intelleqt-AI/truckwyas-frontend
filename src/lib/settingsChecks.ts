// Company settings price checks (the server's ranges), as inline messages.
// Pure (no "@/" imports): node tests them.

const toRaw = (text: string) => text.replace(/[\s  ]/g, "").replace(",", ".");
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

type Rule = { ok: (n: number) => boolean; msg: string };
export const PRICE_RULES: Record<string, Rule> = {
  fuel_price_electric: { ok: (n) => n > 0 && n <= 20, msg: "Enter more than R 0 and up to R 20 per kWh, or leave it empty." },
  fuel_price_hybrid: { ok: (n) => n > 0 && n <= 100, msg: "Enter more than R 0 and up to R 100 per litre, or leave it empty." },
  default_base_rate_per_km: { ok: (n) => n >= 0 && n <= 1000, msg: "Enter R 0 to R 1 000 per km, or leave it empty." },
  // The server's bound (2d8d5af).
  default_toll_rate_per_km: { ok: (n) => n >= 0 && n <= 50, msg: "Enter a toll rate between R 0 and R 50 per km, or leave it empty." },
  minimum_charge: { ok: (n) => n >= 0 && n <= 5_000_000, msg: "Enter an amount in rand, or leave it empty." },
};

/** The message for an optional price field (empty is fine), or null. */
export function priceFieldError(key: string, raw: string | null | undefined): string | null {
  const rule = PRICE_RULES[key];
  const t = toRaw(String(raw ?? "").trim());
  if (!rule || t === "") return null;
  if (!PLAIN_NUMBER.test(t)) return rule.msg;
  return rule.ok(Number(t)) ? null : rule.msg;
}

/** An own fuel price ("My own price" chosen): required, R 5 to R 100 per litre. */
export function ownPriceError(raw: string | null | undefined): string | null {
  const t = toRaw(String(raw ?? "").trim());
  const n = PLAIN_NUMBER.test(t) ? Number(t) : NaN;
  if (!(n > 0)) return "Enter your price per litre, or choose Official.";
  return n >= 5 && n <= 100 ? null : "Enter R 5 to R 100 per litre.";
}

/** Errors for the given fields, split: `block` for values the user changed
 *  (they stop the save), `hint` for stored values left as loaded (shown, not
 *  blocking — and not re-sent, so they never fail an unrelated save). */
export function priceFieldErrors(keys: string[], form: Record<string, string>, loaded: Record<string, string> | null) {
  const block: Record<string, string> = {};
  const hint: Record<string, string> = {};
  for (const k of keys) {
    const m = priceFieldError(k, form[k]);
    if (!m) continue;
    if (loaded && (form[k] ?? "") === (loaded[k] ?? "")) hint[k] = m; else block[k] = m;
  }
  return { block, hint };
}

/** A field differs from what was loaded (no snapshot: treat as changed). */
export const fieldChanged = (k: string, form: Record<string, string>, loaded: Record<string, string> | null) =>
  !loaded || (form[k] ?? "") !== (loaded[k] ?? "");

// ---------------------------------------------------------------- fuel change confirmation

export interface FuelFormLike {
  fuel_price_mode?: string; fuel_price_own?: string;
  fuel_price_petrol_mode?: string; fuel_price_petrol?: string; fuel_price_petrol_grade?: string;
  fuel_zone?: string;
}
const rand2 = (n: number) => `R ${n.toFixed(2).replace(".", ",")}`;
const numOf = (raw: string | undefined) => { const t = toRaw(String(raw ?? "").trim()); return PLAIN_NUMBER.test(t) ? Number(t) : null; };

function oneFuel(label: "diesel" | "petrol", wasOwn: boolean, wasPrice: number | null, isOwn: boolean, isPrice: number | null,
  official: number | null, gradeNote: string, gradeChanged: boolean): { line: string; use: string; toast: string } | null {
  const changed = wasOwn !== isOwn || (isOwn && wasPrice !== isPrice) || (!isOwn && gradeChanged);
  if (!changed) return null;
  if (isOwn && isPrice != null) {
    const diff = official != null ? isPrice - official : null;
    const cmp = diff != null && Math.abs(diff) >= 0.005 ? ` (${rand2(Math.abs(diff))}/L ${diff < 0 ? "less" : "more"})` : "";
    return {
      line: `New quotes will use your own ${label} price of ${rand2(isPrice)}/L${official != null ? ` instead of the official ${rand2(official)}/L${cmp}` : ""}.`,
      use: rand2(isPrice),
      toast: `New quotes use your own ${label} price of ${rand2(isPrice)}/L.`,
    };
  }
  return {
    line: `New quotes will use the official ${label}${gradeNote} price${official != null ? ` of ${rand2(official)}/L` : ""}${wasOwn && wasPrice != null ? ` instead of your own ${rand2(wasPrice)}/L` : ""}.`,
    use: "official",
    toast: `New quotes use the official ${label}${gradeNote} price${official != null ? ` of ${rand2(official)}/L` : ""}.`,
  };
}

/** What a settings save changes about the fuel price quotes use, for a
 *  confirmation before saving and a toast after (null: nothing changes). */
export function fuelChangeSummary(loaded: FuelFormLike | null, form: FuelFormLike,
  officials: { diesel: number | null; petrol: number | null }, hasPetrolMode: boolean) {
  if (!loaded) return null;
  const d = oneFuel("diesel", loaded.fuel_price_mode === "OWN", numOf(loaded.fuel_price_own), form.fuel_price_mode === "OWN", numOf(form.fuel_price_own),
    officials.diesel, "", false);
  const grade = form.fuel_price_petrol_grade === "93" ? " ULP 93" : " ULP 95";
  const p = hasPetrolMode ? oneFuel("petrol", loaded.fuel_price_petrol_mode === "OWN", numOf(loaded.fuel_price_petrol), form.fuel_price_petrol_mode === "OWN", numOf(form.fuel_price_petrol),
    officials.petrol, grade, (loaded.fuel_price_petrol_grade ?? "95") !== (form.fuel_price_petrol_grade ?? "95")) : null;
  const parts = [d, p].filter((x): x is NonNullable<typeof d> => !!x);
  if (!parts.length) return null;
  const single = parts.length === 1 ? parts[0] : null;
  return {
    title: parts.length > 1 ? "Change the fuel prices quotes use?" : `Change the ${d ? "diesel" : "petrol"} price quotes use?`,
    message: `${parts.map((x) => x.line).join(" ")} Quotes already sent keep their price; open drafts update when you open them.`,
    confirmLabel: single ? (single.use === "official" ? "Save and use official" : `Save and use ${single.use}`) : "Save and use these prices",
    toast: `Saved. ${parts.map((x) => x.toast).join(" ")}`,
  };
}
