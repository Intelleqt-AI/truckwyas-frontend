import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, Polyline, LeafletMouseEvent } from 'leaflet';
import type { LocationCoords } from './LocationInput';

type LeafletModule = typeof import('leaflet');
type MapField = 'pickup' | 'delivery' | 'return';

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
const SA_CENTER: [number, number] = [-28.4793, 24.6727];

interface MapLocationPickerProps {
  pickupCoords: LocationCoords | null;
  deliveryCoords: LocationCoords | null;
  returnCoords?: LocationCoords | null;
  showReturn?: boolean;
  activeField: MapField;
  onActiveFieldChange: (field: MapField) => void;
  onLocationSelect: (field: MapField, label: string, coords: LocationCoords) => void;
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
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ map: LeafletMap; L: LeafletModule } | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);
  const returnMarkerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const returnLineRef = useRef<Polyline | null>(null);
  const activeFieldRef = useRef<MapField>(activeField);
  const onActiveFieldChangeRef = useRef(onActiveFieldChange);
  const onLocationSelectRef = useRef(onLocationSelect);
  const showReturnRef = useRef(showReturn);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

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

      const map = L.map(mapRef.current, { center: SA_CENTER, zoom: 5, zoomControl: true });

      const tileUrl = TOMTOM_KEY
        ? `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        attribution: TOMTOM_KEY ? '© TomTom' : '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', async (e: LeafletMouseEvent) => {
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
      if (instanceRef.current?.map) {
        instanceRef.current.map.remove();
        instanceRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Update markers + lines whenever coords change (mapReady ensures this re-runs after remount)
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst || !mapReady) return;
    const { map, L } = inst;

    if (pickupMarkerRef.current) { map.removeLayer(pickupMarkerRef.current); pickupMarkerRef.current = null; }
    if (deliveryMarkerRef.current) { map.removeLayer(deliveryMarkerRef.current); deliveryMarkerRef.current = null; }
    if (returnMarkerRef.current) { map.removeLayer(returnMarkerRef.current); returnMarkerRef.current = null; }
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (returnLineRef.current) { map.removeLayer(returnLineRef.current); returnLineRef.current = null; }

    if (pickupCoords) {
      pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lon], {
        icon: L.divIcon({
          html: '<div style="background:#0057FF;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">P</div>',
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      }).addTo(map);
    }

    if (deliveryCoords) {
      deliveryMarkerRef.current = L.marker([deliveryCoords.lat, deliveryCoords.lon], {
        icon: L.divIcon({
          html: '<div style="background:#e85d04;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">D</div>',
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      }).addTo(map);
    }

    if (returnCoords) {
      returnMarkerRef.current = L.marker([returnCoords.lat, returnCoords.lon], {
        icon: L.divIcon({
          html: '<div style="background:#16a34a;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">R</div>',
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      }).addTo(map);
    }

    // Outbound leg: P → D
    if (pickupCoords && deliveryCoords) {
      map.fitBounds(
        [[pickupCoords.lat, pickupCoords.lon], [deliveryCoords.lat, deliveryCoords.lon]],
        { padding: [40, 40], maxZoom: 12 }
      );
      fetchRoute(pickupCoords, deliveryCoords).then((pts) => {
        if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
        lineRef.current = L.polyline(pts, { color: '#0057FF', weight: 4, opacity: 0.85 }).addTo(map);
        // Fit to include return marker too if present
        const bounds = lineRef.current.getBounds();
        if (returnCoords) bounds.extend([returnCoords.lat, returnCoords.lon]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      });
    } else if (pickupCoords) {
      map.setView([pickupCoords.lat, pickupCoords.lon], 12);
    } else if (deliveryCoords) {
      map.setView([deliveryCoords.lat, deliveryCoords.lon], 12);
    }

    // Return leg: D → R
    if (deliveryCoords && returnCoords) {
      fetchRoute(deliveryCoords, returnCoords).then((pts) => {
        if (returnLineRef.current) { map.removeLayer(returnLineRef.current); returnLineRef.current = null; }
        returnLineRef.current = L.polyline(pts, { color: '#16a34a', weight: 4, opacity: 0.8, dashArray: '8 5' }).addTo(map);
      });
    }
  }, [pickupCoords, deliveryCoords, returnCoords, mapReady]);

  const FIELD_CONFIG: { key: MapField; label: string; color: string; visible: boolean }[] = [
    { key: 'pickup', label: '● PICKUP', color: '#0057FF', visible: true },
    { key: 'delivery', label: '● DELIVERY', color: '#e85d04', visible: true },
    { key: 'return', label: '● RETURN', color: '#16a34a', visible: showReturn },
  ];

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 2,
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.15s',
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {FIELD_CONFIG.filter((f) => f.visible).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => onActiveFieldChange(key)}
            style={{
              ...btnBase,
              background: activeField === key ? color : 'var(--bg-surface)',
              border: `1px solid ${activeField === key ? color : 'var(--border-subtle)'}`,
              color: activeField === key ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', border: '1px solid var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
        <div ref={mapRef} style={{ height: 270, width: '100%' }} />

        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 500,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          borderRadius: 3, padding: '3px 8px',
          fontSize: 9, color: '#fff', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.07em', pointerEvents: 'none',
        }}>
          CLICK MAP TO SET {activeField.toUpperCase()}
        </div>

        {geocoding && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 500,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 2, padding: '4px 8px',
            fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
          }}>
            LOCATING…
          </div>
        )}
      </div>
    </div>
  );
}
