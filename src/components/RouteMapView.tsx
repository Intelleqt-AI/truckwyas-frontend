import { useEffect, useRef } from 'react';
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

interface RouteMapViewProps {
  pickup: string;
  delivery: string;
  height?: number;
}

export function RouteMapView({ pickup, delivery, height = 260 }: RouteMapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ map: LeafletMap; L: LeafletModule } | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);

  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;

    import('leaflet').then(async (L) => {
      if (!mapDivRef.current) return;

      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: false,
        attributionControl: false,
      }).setView(SA_CENTER, 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://openstreetmap.org">OSM</a>',
      }).addTo(map);

      L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = { map, L };

      const [pickupCoords, deliveryCoords] = await Promise.all([
        geocodeText(pickup),
        geocodeText(delivery),
      ]);

      if (!mapInstanceRef.current) return;

      if (pickupCoords) {
        pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lon], { icon: dotIcon(L, '#16a34a') })
          .bindTooltip(`Pickup: ${pickup}`, { direction: 'top' })
          .addTo(map);
      }
      if (deliveryCoords) {
        deliveryMarkerRef.current = L.marker([deliveryCoords.lat, deliveryCoords.lon], { icon: dotIcon(L, '#dc2626') })
          .bindTooltip(`Delivery: ${delivery}`, { direction: 'top' })
          .addTo(map);
      }

      if (pickupCoords && deliveryCoords) {
        const points = await fetchRoute(pickupCoords, deliveryCoords);
        routeLineRef.current = L.polyline(points, { color: '#1d4ed8', weight: 3, opacity: 0.85 }).addTo(map);
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      } else if (pickupCoords) {
        map.setView([pickupCoords.lat, pickupCoords.lon], 9);
      } else if (deliveryCoords) {
        map.setView([deliveryCoords.lat, deliveryCoords.lon], 9);
      }
    });

    return () => {
      mapInstanceRef.current?.map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // pickup/delivery don't change on this static view

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
