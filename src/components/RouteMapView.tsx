import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';

type LeafletModule = typeof import('leaflet');

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
const SA_CENTER: [number, number] = [-28.4793, 24.6727];

async function geocodeText(query: string): Promise<{ lat: number; lon: number } | null> {
  if (TOMTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&limit=1&countrySet=ZA`
      );
      const data = await res.json();
      const pos = data?.results?.[0]?.position;
      if (pos?.lat && pos?.lon) return { lat: pos.lat, lon: pos.lon };
    } catch { /* fallthrough */ }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.[0]?.lat) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { /* fallthrough */ }
  return null;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (TOMTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${TOMTOM_KEY}`
      );
      const data = await res.json();
      const addr = data?.addresses?.[0]?.address?.freeformAddress;
      if (addr) return addr;
    } catch { /* fallthrough */ }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.display_name) return data.display_name as string;
  } catch { /* fallthrough */ }
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

async function fetchRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<[number, number][]> {
  if (TOMTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lon}:${to.lat},${to.lon}/json?key=${TOMTOM_KEY}&travelMode=truck&routeType=fastest`
      );
      const data = await res.json();
      const pts: { latitude: number; longitude: number }[] = data?.routes?.[0]?.legs?.[0]?.points ?? [];
      if (pts.length > 1) return pts.map(p => [p.latitude, p.longitude]);
    } catch { /* fallthrough */ }
  }
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length > 1) return coords.map(([lng, lat]) => [lat, lng]);
  } catch { /* fallthrough */ }
  return [[from.lat, from.lon], [to.lat, to.lon]];
}

function dotIcon(L: LeafletModule, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

interface PointCoords { lat: number; lon: number; }
interface ClickedPoint extends PointCoords { label: string; }

interface RouteMapViewProps {
  pickup: string;
  delivery: string;
  /** Precise coords already known for each end (from search selection or a prior map click). Preferred over re-geocoding the text. */
  pickupCoords?: PointCoords | null;
  deliveryCoords?: PointCoords | null;
  height?: number;
  /**
   * Polyline of the currently selected route, as [lat, lon] pairs. When present
   * this is drawn verbatim — it's the exact route the backend priced — and the
   * map redraws whenever it changes (i.e. when a different route option is
   * selected). When absent the component falls back to geocoding the
   * pickup/delivery text and fetching a route itself.
   */
  geometry?: [number, number][];
  /** Fired when the user clicks the map to pick a point; label is reverse-geocoded. */
  onMapClick?: (point: ClickedPoint) => void;
}

export function RouteMapView({ pickup, delivery, pickupCoords, deliveryCoords, height = 260, geometry, onMapClick }: RouteMapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ map: LeafletMap; L: LeafletModule } | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const tempMarkerRef = useRef<Marker | null>(null);
  const fittedKeyRef = useRef<string | null>(null);

  // onMapClick closes over changing parent state on every render; keep the
  // live callback in a ref so the map (created once) always calls the latest version.
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // Initialise the Leaflet map once.
  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!mapDivRef.current || mapInstanceRef.current) return;

      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: false,
        attributionControl: false,
      }).setView(SA_CENTER, 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://openstreetmap.org">OSM</a>',
      }).addTo(map);

      L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);

      map.on('dblclick', (e: { latlng: { lat: number; lng: number } }) => {
        if (!onMapClickRef.current) return;
        const { lat, lng } = e.latlng;
        // Instant feedback: drop a temp pin right away, reverse-geocode in the background.
        tempMarkerRef.current?.remove();
        tempMarkerRef.current = L.marker([lat, lng], { icon: dotIcon(L, '#6b7280') }).addTo(map);
        reverseGeocode(lat, lng).then((label) => {
          tempMarkerRef.current?.remove();
          tempMarkerRef.current = null;
          onMapClickRef.current?.({ lat, lon: lng, label });
        });
      });

      mapInstanceRef.current = { map, L };
      // Force an initial draw now that the map exists.
      setReady((n) => n + 1);
    });

    return () => {
      tempMarkerRef.current?.remove();
      mapInstanceRef.current?.map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Bumped after map init so the draw effect below runs once the map is ready.
  const [ready, setReady] = useState(0);
  // Stable key for the geometry so the effect only re-runs on an actual change.
  const geomKey = geometry && geometry.length > 1
    ? `${geometry.length}:${geometry[0].join()}:${geometry[geometry.length - 1].join()}`
    : '';

  // Draw / redraw markers + route line whenever the selected route (geometry) or
  // the pickup/delivery text changes.
  useEffect(() => {
    const inst = mapInstanceRef.current;
    if (!inst) return;
    const { map, L } = inst;
    let cancelled = false;

    const clear = () => {
      pickupMarkerRef.current?.remove(); pickupMarkerRef.current = null;
      deliveryMarkerRef.current?.remove(); deliveryMarkerRef.current = null;
      routeLineRef.current?.remove(); routeLineRef.current = null;
    };

    const drawLine = (points: [number, number][], dashed = false) => {
      if (cancelled || points.length < 2) return;
      const [start, end] = [points[0], points[points.length - 1]];
      pickupMarkerRef.current = L.marker(start, { icon: dotIcon(L, '#16a34a') })
        .bindTooltip(`Pickup: ${pickup || 'Collection'}`, { direction: 'top' }).addTo(map);
      deliveryMarkerRef.current = L.marker(end, { icon: dotIcon(L, '#dc2626') })
        .bindTooltip(`Delivery: ${delivery || 'Delivery'}`, { direction: 'top' }).addTo(map);
      routeLineRef.current = L.polyline(points, dashed
        ? { color: '#94a3b8', weight: 2, opacity: 0.8, dashArray: '6 6' }
        : { color: '#1d4ed8', weight: 3, opacity: 0.85 }).addTo(map);
      // Only re-fit the view when the endpoints change. Swapping to an alternate
      // route keeps the same start/end, so we leave the viewport put — avoids the
      // zoom "blink" on every route selection.
      const fitKey = `${start.join()}|${end.join()}`;
      if (fittedKeyRef.current !== fitKey) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
        fittedKeyRef.current = fitKey;
      }
    };

    const drawSingle = (point: [number, number], color: string, tooltip: string, zoom = 9) => {
      if (cancelled) return;
      const marker = L.marker(point, { icon: dotIcon(L, color) }).bindTooltip(tooltip, { direction: 'top' }).addTo(map);
      if (color === '#16a34a') pickupMarkerRef.current = marker; else deliveryMarkerRef.current = marker;
      const fitKey = `single:${point.join()}`;
      if (fittedKeyRef.current !== fitKey) {
        map.setView(point, zoom);
        fittedKeyRef.current = fitKey;
      }
    };

    clear();

    // Preferred path: draw the exact geometry of the selected route.
    if (geometry && geometry.length > 1) {
      drawLine(geometry);
      return () => { cancelled = true; };
    }

    // Next best: coords the parent already has (from search selection or a map
    // click) — no need to re-geocode text we already have precise points for.
    if (pickupCoords && deliveryCoords) {
      fetchRoute(pickupCoords, deliveryCoords).then((points) => { if (!cancelled) drawLine(points, true); });
      return () => { cancelled = true; };
    }
    if (pickupCoords) { drawSingle([pickupCoords.lat, pickupCoords.lon], '#16a34a', `Pickup: ${pickup || 'Collection'}`); return () => { cancelled = true; }; }
    if (deliveryCoords) { drawSingle([deliveryCoords.lat, deliveryCoords.lon], '#dc2626', `Delivery: ${delivery || 'Delivery'}`); return () => { cancelled = true; }; }

    // Last resort: no coords supplied at all, only free text — geocode it ourselves.
    if (!pickup && !delivery) return () => { cancelled = true; };
    (async () => {
      const [pc, dc] = await Promise.all([geocodeText(pickup), geocodeText(delivery)]);
      if (cancelled || !mapInstanceRef.current) return;
      if (pc && dc) {
        const points = await fetchRoute(pc, dc);
        if (!cancelled) drawLine(points, true);
      } else if (pc) {
        drawSingle([pc.lat, pc.lon], '#16a34a', `Pickup: ${pickup}`);
      } else if (dc) {
        drawSingle([dc.lat, dc.lon], '#dc2626', `Delivery: ${delivery}`);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geomKey, pickup, delivery, pickupCoords?.lat, pickupCoords?.lon, deliveryCoords?.lat, deliveryCoords?.lon]);

  return (
    <div
      ref={mapDivRef}
      style={{
        width: '100%',
        height,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
      }}
    />
  );
}
