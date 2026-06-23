import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, Polyline, LeafletMouseEvent } from 'leaflet';
import type { LocationCoords } from './LocationInput';

type LeafletModule = typeof import('leaflet');

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
const SA_CENTER: [number, number] = [-28.4793, 24.6727];

interface MapLocationPickerProps {
  pickupCoords: LocationCoords | null;
  deliveryCoords: LocationCoords | null;
  onLocationSelect: (field: 'pickup' | 'delivery', label: string, coords: LocationCoords) => void;
}

/** Fetch a road-following route between two points.
 *  Tries TomTom Routing API first, falls back to OSRM (free, no key). */
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

  // OSRM fallback — free, no key
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length > 1) {
      return coords.map(([lng, lat]) => [lat, lng]); // GeoJSON is [lng,lat], Leaflet wants [lat,lng]
    }
  } catch {
    // fall through to straight line
  }

  // Final fallback: straight line
  return [[from.lat, from.lon], [to.lat, to.lon]];
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Try TomTom first if key is available
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

  // Nominatim fallback (free, no key needed)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.display_name) {
      // Trim to most useful parts: road/suburb, city, country
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

export function MapLocationPicker({ pickupCoords, deliveryCoords, onLocationSelect }: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ map: LeafletMap; L: LeafletModule } | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const activeFieldRef = useRef<'pickup' | 'delivery'>('pickup');
  const onLocationSelectRef = useRef(onLocationSelect);
  const [activeField, setActiveField] = useState<'pickup' | 'delivery'>('pickup');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  useEffect(() => { onLocationSelectRef.current = onLocationSelect; }, [onLocationSelect]);

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
          // After setting pickup, auto-switch to delivery so the next click sets it
          if (field === 'pickup') {
            setActiveField('delivery');
          }
        } finally {
          setGeocoding(false);
        }
      });

      instanceRef.current = { map, L };
    })();

    return () => {
      destroyed = true;
      if (instanceRef.current?.map) {
        instanceRef.current.map.remove();
        instanceRef.current = null;
      }
    };
  }, []);

  // Update markers + line whenever coords change
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    const { map, L } = inst;

    // Remove old markers and line
    if (pickupMarkerRef.current) { map.removeLayer(pickupMarkerRef.current); pickupMarkerRef.current = null; }
    if (deliveryMarkerRef.current) { map.removeLayer(deliveryMarkerRef.current); deliveryMarkerRef.current = null; }
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }

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

    // Draw road-following route between P and D when both are set
    if (pickupCoords && deliveryCoords) {
      // Fit bounds immediately using straight-line corners while route loads
      map.fitBounds(
        [[pickupCoords.lat, pickupCoords.lon], [deliveryCoords.lat, deliveryCoords.lon]],
        { padding: [40, 40], maxZoom: 12 }
      );

      fetchRoute(pickupCoords, deliveryCoords).then((routePoints) => {
        if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
        lineRef.current = L.polyline(routePoints, {
          color: '#0057FF',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
        map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40], maxZoom: 12 });
      });
    } else if (pickupCoords) {
      map.setView([pickupCoords.lat, pickupCoords.lon], 12);
    } else if (deliveryCoords) {
      map.setView([deliveryCoords.lat, deliveryCoords.lon], 12);
    }
  }, [pickupCoords, deliveryCoords]);

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
        <button
          type="button"
          onClick={() => setActiveField('pickup')}
          style={{
            ...btnBase,
            background: activeField === 'pickup' ? '#0057FF' : 'var(--bg-surface)',
            border: `1px solid ${activeField === 'pickup' ? '#0057FF' : 'var(--border-subtle)'}`,
            color: activeField === 'pickup' ? '#fff' : 'var(--text-tertiary)',
          }}
        >
          ● PICKUP
        </button>
        <button
          type="button"
          onClick={() => setActiveField('delivery')}
          style={{
            ...btnBase,
            background: activeField === 'delivery' ? '#e85d04' : 'var(--bg-surface)',
            border: `1px solid ${activeField === 'delivery' ? '#e85d04' : 'var(--border-subtle)'}`,
            color: activeField === 'delivery' ? '#fff' : 'var(--text-tertiary)',
          }}
        >
          ● DELIVERY
        </button>
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
