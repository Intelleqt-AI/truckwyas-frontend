/**
 * The cargo as the operator described it, or null. The quote builder saves
 * "<weight>t <vehicle type>" when Cargo is left blank (so the field is never
 * empty for older readers); that placeholder names the truck, not the cargo,
 * so screens show it as not specified.
 */
export function cargoText(cargo: unknown, vehicleType?: unknown): string | null {
  const c = String(cargo ?? '').trim();
  if (!c) return null;
  const m = c.match(/^\d+(?:[.,]\d+)?\s*t(?:\s+(.*))?$/i);
  if (m) {
    const rest = (m[1] || '').trim().toLowerCase();
    const vt = String(vehicleType ?? '').trim().toLowerCase();
    if (!rest || (vt && rest === vt)) return null;
  }
  return c.replace(/^\s*\S/, (ch) => ch.toUpperCase());
}
