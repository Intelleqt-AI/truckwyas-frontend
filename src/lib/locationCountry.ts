// A "used before" location is stored without its country, but the country
// drives cross-border detection (border fees, 0% VAT, the cross-border
// block) before the route is in. It is looked up from the live geocoder:
// the result nearest the saved point (within ~5 km) gives it.
export interface GeoPoint { lat: number | string; lon: number | string; country_code?: string }

export function countryNear(results: GeoPoint[], lat: number, lon: number): string | undefined {
  let best: GeoPoint | null = null;
  let bestD = Infinity;
  for (const r of results || []) {
    const rl = Number(r?.lat), ro = Number(r?.lon);
    if (!r?.country_code || !Number.isFinite(rl) || !Number.isFinite(ro)) continue;
    const d = Math.hypot(rl - lat, ro - lon);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best && bestD <= 0.05 ? best.country_code : undefined;
}
