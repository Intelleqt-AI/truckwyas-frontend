// A reopened quote keeps its saved route (route_snapshot) while the inputs
// the route was calculated for are unchanged: collection, delivery, stops
// and truck. Coordinates are compared to ~1 m (6 decimals).
type Pt = { lat: number; lon: number } | null | undefined;
const same = (a: unknown, b: unknown) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) < 1e-6;

export function savedRouteMatches(request: Record<string, unknown> | null | undefined, now: {
  pickup: Pt; delivery: Pt; truckId: number | string | null; truckName: string; stops: { lat: number; lon: number }[];
}): boolean {
  if (!request || !now.pickup || !now.delivery) return false;
  const r = request as Record<string, any>;
  if (!same(r.origin_lat, now.pickup.lat) || !same(r.origin_lon, now.pickup.lon)) return false;
  if (!same(r.dest_lat, now.delivery.lat) || !same(r.dest_lon, now.delivery.lon)) return false;
  const savedTruck = r.vehicle_type_id ?? null;
  if (savedTruck != null || now.truckId != null) {
    if (String(savedTruck) !== String(now.truckId)) return false;
  } else if ((r.vehicle_type || "Flatbed") !== now.truckName) return false;
  const savedStops: any[] = Array.isArray(r.stops) ? r.stops : [];
  if (savedStops.length !== now.stops.length) return false;
  return savedStops.every((st, i) => same(st?.lat, now.stops[i].lat) && same(st?.lon, now.stops[i].lon));
}

/** A reopened quote's border figure to restore as typed: only the user's own
 *  (costing_inputs.border_cost_is_override); else null, so the fresh route's
 *  border lines stand. */
export function savedBorderOverride(ci: Record<string, unknown> | null | undefined): number | null {
  if (!ci || ci.border_cost_is_override !== true) return null;
  const v = Number(ci.border_cost);
  return Number.isFinite(v) && v > 0 ? v : null;
}
