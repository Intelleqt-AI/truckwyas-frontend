// Company settings price checks (the server's ranges), as inline messages.
// Pure (no "@/" imports): node tests them.

const toRaw = (text: string) => text.replace(/[\s  ]/g, "").replace(",", ".");
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

type Rule = { ok: (n: number) => boolean; msg: string };
export const PRICE_RULES: Record<string, Rule> = {
  fuel_price_electric: { ok: (n) => n > 0 && n <= 20, msg: "Enter more than R 0 and up to R 20 per kWh, or leave it empty." },
  fuel_price_hybrid: { ok: (n) => n > 0 && n <= 100, msg: "Enter more than R 0 and up to R 100 per litre, or leave it empty." },
  default_base_rate_per_km: { ok: (n) => n >= 0 && n <= 1000, msg: "Enter R 0 to R 1 000 per km, or leave it empty." },
  // The DB column's own maximum (DecimalField 8,2 → 999 999,99).
  default_toll_rate_per_km: { ok: (n) => n >= 0 && n <= 999_999, msg: "Enter R 0 to R 999 999 per km, or leave it empty." },
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
