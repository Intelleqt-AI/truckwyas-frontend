import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './map/map.css';
import type { Map as LeafletMap, Marker, Polyline, TileLayer, LeafletMouseEvent } from 'leaflet';
import type { LocationCoords } from './LocationInput';

type LeafletModule = typeof import('leaflet');
type MapField = 'pickup' | 'delivery' | 'return';

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
const SA_CENTER: [number, number] = [-28.4793, 24.6727];

// The app's theme lives on <html data-theme> (dark is the default when unset).
const isDarkTheme = () =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';

// Same TomTom Map Display endpoint and key; only the style segment changes
// (`main` in light, `night` in dark). Without a key: OpenStreetMap, darkened
// in dark theme by a CSS filter on the base layer (map/map.css).
const baseTileUrl = (dark: boolean) =>
  TOMTOM_KEY
    ? `https://api.tomtom.com/map/1/tile/basic/${dark ? 'night' : 'main'}/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Marker icons: colours come from theme tokens via map/map.css classes.
function pickupIcon(L: LeafletModule) {
  return L.divIcon({
    className: '',
    html: '<span class="tw-pin"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" class="f-accent s-casing" stroke-width="2"/><circle cx="11" cy="11" r="3.5" class="f-white"/></svg></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function deliveryIcon(L: LeafletModule) {
  return L.divIcon({
    className: '',
    html: '<span class="tw-pin"><svg width="26" height="32" viewBox="0 0 24 30" aria-hidden="true"><path class="f-ink s-casing" stroke-width="1.5" d="M12 1.5C6.2 1.5 1.5 6.1 1.5 11.8c0 7.3 8.9 15.6 9.9 16.5a.9.9 0 0 0 1.2 0c1-.9 9.9-9.2 9.9-16.5C22.5 6.1 17.8 1.5 12 1.5z"/><rect x="8.6" y="8.4" width="6.8" height="6.8" rx="1.4" class="f-casing"/></svg></span>',
    iconSize: [26, 32],
    iconAnchor: [13, 31],
  });
}

function returnIcon(L: LeafletModule) {
  return L.divIcon({ className: '', html: '<div class="tw-pin-letter">R</div>', iconSize: [20, 20], iconAnchor: [10, 10] });
}

interface RouteOptionGeo {
  index: number;
  is_best: boolean;
  geometry: { lat: number; lon: number }[];
}

interface MapLocationPickerProps {
  pickupCoords: LocationCoords | null;
  deliveryCoords: LocationCoords | null;
  returnCoords?: LocationCoords | null;
  showReturn?: boolean;
  activeField: MapField;
  onActiveFieldChange: (field: MapField) => void;
  onLocationSelect: (field: MapField, label: string, coords: LocationCoords) => void;
  onExpand?: () => void;
  onClose?: () => void;
  mapHeight?: number;
  // Outbound TomTom routes (best + alternatives). When provided, the map draws all of
  // them — selected/best in green, the rest grey & clickable — instead of one preview line.
  routeOptions?: RouteOptionGeo[];
  selectedRouteIndex?: number;
  onSelectRoute?: (index: number) => void;
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
      const points: { latitude: number; longitude: number }[] =
        data?.routes?.[0]?.legs?.[0]?.points ?? [];
      if (points.length > 1) {
        return points.map((p) => [p.latitude, p.longitude]);
      }
    } catch {
      // fall through to OSRM
    }
  }

  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length > 1) {
      return coords.map(([lng, lat]) => [lat, lng]);
    }
  } catch {
    // fall through
  }

  return [[from.lat, from.lon], [to.lat, to.lon]];
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (TOMTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}`
      );
      const data = await res.json();
      const addr = data?.addresses?.[0]?.address;
      if (addr?.freeformAddress) return addr.freeformAddress;
    } catch {
      // fall through to Nominatim
    }
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.display_name) {
      const a = data.address || {};
      const parts = [
        a.road || a.suburb || a.neighbourhood,
        a.city || a.town || a.village || a.county,
        a.country,
      ].filter(Boolean);
      return parts.length >= 2 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',').trim();
    }
  } catch {
    // fall through
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function MapLocationPicker({
  pickupCoords,
  deliveryCoords,
  returnCoords,
  showReturn = false,
  activeField,
  onActiveFieldChange,
  onLocationSelect,
  onExpand,
  onClose,
  mapHeight = 270,
  routeOptions,
  selectedRouteIndex = 0,
  onSelectRoute,
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ map: LeafletMap; L: LeafletModule } | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);
  const returnMarkerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const returnLineRef = useRef<Polyline | null>(null);
  const routeLinesRef = useRef<Polyline[]>([]);
  const routeLabelsRef = useRef<Marker[]>([]);
  const trafficLayerRef = useRef<TileLayer | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const activeFieldRef = useRef<MapField>(activeField);
  const onActiveFieldChangeRef = useRef(onActiveFieldChange);
  const onLocationSelectRef = useRef(onLocationSelect);
  const showReturnRef = useRef(showReturn);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [dark, setDark] = useState(isDarkTheme);
  const darkRef = useRef(dark);

  // Follow live theme switches (OSLayout toggles html[data-theme]).
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(isDarkTheme());
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  useEffect(() => { onActiveFieldChangeRef.current = onActiveFieldChange; }, [onActiveFieldChange]);
  useEffect(() => { onLocationSelectRef.current = onLocationSelect; }, [onLocationSelect]);
  useEffect(() => { showReturnRef.current = showReturn; }, [showReturn]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;
    let destroyed = false;

    (async () => {
      const L = await import('leaflet');
      if (destroyed || !mapRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      // doubleClickZoom off: a double-tap selects the point (see 'dblclick' below) instead of zooming.
      const map = L.map(mapRef.current, { center: SA_CENTER, zoom: 5, zoomControl: true, doubleClickZoom: false });

      // Theme read at creation so the first load already uses the right style
      // (no extra tile requests); later switches swap the URL in place.
      darkRef.current = isDarkTheme();
      baseLayerRef.current = L.tileLayer(baseTileUrl(darkRef.current), {
        attribution: TOMTOM_KEY ? '© TomTom' : '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'tw-map-base',
      }).addTo(map);

      // Live traffic flow overlay (relative0 = Google-Maps-style green→red congestion colours).
      // Created here; the toggle effect adds/removes it based on `showTraffic`.
      if (TOMTOM_KEY) {
        trafficLayerRef.current = L.tileLayer(
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`,
          { opacity: 0.75, maxZoom: 22, zIndex: 5 }
        );
      }

      map.on('dblclick', async (e: LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const field = activeFieldRef.current;
        setGeocoding(true);
        try {
          const label = await reverseGeocode(lat, lng);
          onLocationSelectRef.current(field, label, { lat, lon: lng });
          if (field === 'pickup') {
            onActiveFieldChangeRef.current('delivery');
          } else if (field === 'delivery' && showReturnRef.current) {
            onActiveFieldChangeRef.current('return');
          }
        } finally {
          setGeocoding(false);
        }
      });

      instanceRef.current = { map, L };
      setMapReady(true);
    })();

    return () => {
      destroyed = true;
      baseLayerRef.current = null;
      if (instanceRef.current?.map) {
        instanceRef.current.map.remove();
        instanceRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Theme switched while mounted: TomTom `main` <-> `night` via setUrl (same
  // layer, same map, markers and state untouched). OSM needs no swap: the CSS
  // filter follows html[data-theme] on its own.
  useEffect(() => {
    if (!mapReady || !TOMTOM_KEY || !baseLayerRef.current) return;
    if (darkRef.current === dark) return;
    darkRef.current = dark;
    baseLayerRef.current.setUrl(baseTileUrl(dark));
  }, [dark, mapReady]);

  // Show/hide the live traffic flow overlay
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst || !mapReady || !trafficLayerRef.current) return;
    if (showTraffic) trafficLayerRef.current.addTo(inst.map);
    else inst.map.removeLayer(trafficLayerRef.current);
  }, [showTraffic, mapReady]);

  // Update markers + lines whenever coords change (mapReady ensures this re-runs after remount)
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst || !mapReady) return;
    const { map, L } = inst;
    let cancelled = false;

    if (pickupMarkerRef.current) { map.removeLayer(pickupMarkerRef.current); pickupMarkerRef.current = null; }
    if (deliveryMarkerRef.current) { map.removeLayer(deliveryMarkerRef.current); deliveryMarkerRef.current = null; }
    if (returnMarkerRef.current) { map.removeLayer(returnMarkerRef.current); returnMarkerRef.current = null; }
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (returnLineRef.current) { map.removeLayer(returnLineRef.current); returnLineRef.current = null; }
    routeLinesRef.current.forEach((ln) => map.removeLayer(ln));
    routeLinesRef.current = [];
    routeLabelsRef.current.forEach((m) => map.removeLayer(m));
    routeLabelsRef.current = [];

    if (pickupCoords) {
      pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lon], { icon: pickupIcon(L) }).addTo(map);
    }

    if (deliveryCoords) {
      deliveryMarkerRef.current = L.marker([deliveryCoords.lat, deliveryCoords.lon], { icon: deliveryIcon(L) }).addTo(map);
    }

    if (returnCoords) {
      returnMarkerRef.current = L.marker([returnCoords.lat, returnCoords.lon], { icon: returnIcon(L) }).addTo(map);
    }

    // Outbound leg: P → D
    if (pickupCoords && deliveryCoords) {
      map.fitBounds(
        [[pickupCoords.lat, pickupCoords.lon], [deliveryCoords.lat, deliveryCoords.lon]],
        { padding: [40, 40], maxZoom: 12 }
      );
      if (routeOptions && routeOptions.length > 0) {
        // Distinct color per route so users can match map lines to the option list.
        const ROUTE_COLORS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed'];
        const allPts: [number, number][] = [];
        // Draw non-selected first so the selected route ends up on top.
        const ordered = [...routeOptions].sort(
          (a, b) => Number(a.index === selectedRouteIndex) - Number(b.index === selectedRouteIndex)
        );
        ordered.forEach((r) => {
          const pts = (r.geometry || []).map((p) => [p.lat, p.lon] as [number, number]);
          if (pts.length < 2) return;
          const isSel = r.index === selectedRouteIndex;
          const color = ROUTE_COLORS[r.index % ROUTE_COLORS.length];
          // Soft casing under the selected route so it reads on any tile.
          if (isSel) {
            routeLinesRef.current.push(
              L.polyline(pts, { className: 'tw-route-casing', color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(map)
            );
          }
          const line = L.polyline(
            pts,
            isSel
              ? { color, weight: 6, opacity: 0.95 }
              : { color, weight: 4, opacity: 0.45 }
          ).addTo(map);
          if (onSelectRoute) line.on('click', () => onSelectRoute(r.index));
          if (isSel) line.bringToFront();
          routeLinesRef.current.push(line);
          pts.forEach((pt) => allPts.push(pt));

          // Numbered badge at the midpoint of each route
          const mid = pts[Math.floor(pts.length / 2)];
          const label = L.marker(mid, {
            icon: L.divIcon({
              html: `<div class="tw-pin-num" style="background:${color};color:#fff;border:0;opacity:${isSel ? 1 : 0.7}">${r.index + 1}</div>`,
              className: '',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          }).addTo(map);
          routeLabelsRef.current.push(label);
        });
        if (allPts.length) {
          const bounds = L.latLngBounds(allPts);
          if (returnCoords) bounds.extend([returnCoords.lat, returnCoords.lon]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }
      } else {
        // No backend routes yet — lightweight single-line preview (pre-calculation).
        fetchRoute(pickupCoords, deliveryCoords).then((pts) => {
          if (cancelled) return;
          if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
          // Accent 4px on a 7px casing, grouped so the existing ref removes both.
          lineRef.current = L.polyline(pts, { className: 'tw-route', color: '#2563EB', weight: 4, opacity: 1 });
          const casing = L.polyline(pts, { className: 'tw-route-casing', color: '#ffffff', weight: 7, opacity: 0.9, interactive: false });
          routeLinesRef.current.push(casing.addTo(map));
          lineRef.current.addTo(map);
          // Fit to include return marker too if present
          const bounds = lineRef.current.getBounds();
          if (returnCoords) bounds.extend([returnCoords.lat, returnCoords.lon]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        });
      }
    } else if (pickupCoords) {
      map.setView([pickupCoords.lat, pickupCoords.lon], 12);
    } else if (deliveryCoords) {
      map.setView([deliveryCoords.lat, deliveryCoords.lon], 12);
    }

    // Return leg: D → R
    if (deliveryCoords && returnCoords) {
      fetchRoute(deliveryCoords, returnCoords).then((pts) => {
        if (cancelled) return;
        if (returnLineRef.current) { map.removeLayer(returnLineRef.current); returnLineRef.current = null; }
        returnLineRef.current = L.polyline(pts, { className: 'tw-route--return', color: '#434A55', weight: 3, opacity: 0.9, dashArray: '8 6', lineCap: 'round' }).addTo(map);
      });
    }

    return () => { cancelled = true; };
  }, [pickupCoords, deliveryCoords, returnCoords, mapReady, routeOptions, selectedRouteIndex]);

  // Dot colours match the map markers (accent pickup, ink drop-off, neutral return).
  const FIELD_CONFIG: { key: MapField; label: string; color: string; visible: boolean }[] = [
    { key: 'pickup', label: 'Pickup', color: 'var(--accent-primary, #2563EB)', visible: true },
    { key: 'delivery', label: 'Delivery', color: 'var(--text-primary, #0E1116)', visible: true },
    { key: 'return', label: 'Return', color: 'var(--text-secondary, #434A55)', visible: showReturn },
  ];

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    minHeight: 40,
    borderRadius: 'var(--radius-control)',
    fontSize: 14,
    lineHeight: '20px',
    fontFamily: 'var(--font-sans)',
    letterSpacing: 'normal',
    cursor: 'pointer',
    fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
  };

  const hasTopRightButton = !!(onExpand || onClose);

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {FIELD_CONFIG.filter((f) => f.visible).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => onActiveFieldChange(key)}
            aria-pressed={activeField === key}
            style={{
              ...btnBase,
              background: activeField === key ? 'var(--accent-dim)' : 'var(--bg-surface)',
              border: `1px solid ${activeField === key ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              color: activeField === key ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <span aria-hidden="true" className="tw-map-dot" style={{ background: color }} />
            {label}
          </button>
        ))}
      </div>

      <div className={TOMTOM_KEY ? 'tw-map' : 'tw-map tw-map--osm'}>
        <div ref={mapRef} style={{ height: mapHeight, width: '100%' }} />

        <div className="tw-map-chip" style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 500, pointerEvents: 'none' }}>
          Double-tap the map to set <strong>{activeField}</strong>
        </div>

        {geocoding && (
          <div className="tw-map-chip" role="status" style={{ position: 'absolute', top: 8, right: hasTopRightButton ? 48 : 8, zIndex: 500 }}>
            Locating…
          </div>
        )}

        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Expand map"
            aria-label="Expand map"
            className="tw-map-btn"
            style={{ zIndex: 500 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" /><path d="M9 21H3v-6" /></svg>
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close fullscreen"
            aria-label="Close fullscreen"
            className="tw-map-btn"
            style={{ zIndex: 500 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        )}

        {TOMTOM_KEY && (
          <div style={{
            position: 'absolute', bottom: 28, right: 8, zIndex: 500,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
          }}>
            <button
              type="button"
              onClick={() => setShowTraffic((v) => !v)}
              title="Toggle live traffic"
              className="tw-map-chip"
              aria-pressed={showTraffic}
            >
              <span aria-hidden="true" className="tw-map-dot" style={{
                background: showTraffic ? '#2EAB30' : 'transparent',
                boxShadow: showTraffic ? 'none' : 'inset 0 0 0 1.5px var(--text-tertiary)',
              }} />
              {showTraffic ? 'Traffic on' : 'Traffic off'}
            </button>
            {showTraffic && (
              <div className="tw-map-chip" style={{ gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span aria-hidden="true" className="tw-map-dot" style={{ background: '#2EAB30' }} /> Clear</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span aria-hidden="true" className="tw-map-dot" style={{ background: '#F1BF40' }} /> Light</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span aria-hidden="true" className="tw-map-dot" style={{ background: '#F18237' }} /> Moderate</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span aria-hidden="true" className="tw-map-dot" style={{ background: '#E70704' }} /> Heavy</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
