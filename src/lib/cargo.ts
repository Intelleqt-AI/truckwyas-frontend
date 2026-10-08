// Words that name a truck or its body, never a cargo. Used when the vehicle
// type is not known (a booking carries the cargo text but not the quote's
// vehicle type), so "28t Superlink Tautliner" still reads as no cargo.
const TRUCK_WORDS = new Set([
  'superlink', 'tautliner', 'tautliners', 'tri', 'axle', 'triaxle', 'rigid', 'interlink', 'semi', 'trailer',
  'truck', 'horse', 'flatbed', 'flat', 'deck', 'reefer', 'refrigerated', 'tanker', 'box', 'curtainsider',
  'curtain', 'side', 'sider', 'tipper', 'lowbed', 'ldv', 'light', 'medium', 'heavy', 'vehicle', 'tonnes',
  'tonne', 'ton', 't', 'x', '6x4', '4x2', '8x4', 'and',
]);

function onlyTruckWords(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[&/–—-]/g, ' ')
    .split(/[^a-z0-9x]+/)
    .filter((w) => w && !/^\d+$/.test(w));
  return words.length > 0 && words.every((w) => TRUCK_WORDS.has(w));
}

/**
 * The cargo as the operator described it, or null. The quote builder saves
 * "<weight>t <vehicle type>" when Cargo is left blank (so the field is never
 * empty for older readers); that placeholder names the truck, not the cargo,
 * so screens show it as not specified. Without the vehicle type (bookings),
 * a "<weight>t" text made only of truck words is the same placeholder.
 */
export function cargoText(cargo: unknown, vehicleType?: unknown): string | null {
  const c = String(cargo ?? '').trim();
  if (!c) return null;
  const m = c.match(/^\d+(?:[.,]\d+)?\s*t(?:\s+(.*))?$/i);
  if (m) {
    const rest = (m[1] || '').trim().toLowerCase();
    const vt = String(vehicleType ?? '').trim().toLowerCase();
    if (!rest || (vt && rest === vt) || onlyTruckWords(rest)) return null;
  }
  return c.replace(/^\s*\S/, (ch) => ch.toUpperCase());
}
