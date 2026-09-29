import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Two-column detail pages end within 48px of each other (R6). On the booking
 * and quote details the main column holds a route map, so the map takes up
 * the difference: before paint, the main card and the rail are measured and
 * the map height moves by the gap, within [min, max]. It settles in one
 * extra render and re-runs on resize. `onStuck` is called when the map is
 * at its smallest and the main column is still longer by more than 48px, so
 * the page can move a card to the rail instead.
 *
 *   const fill = useMapFill({ base: 220, min: 180, max: 380 });
 *   <section ref={fill.mainRef}>… <Map height={fill.height} /></section>
 *   <aside ref={fill.sideRef}>…</aside>
 */
export function useMapFill(opts: { base: number; min: number; max: number; paused?: boolean; oneColumnMq?: string; onStuck?: () => void }) {
  const { base, min, max, paused = false, oneColumnMq = '(max-width: 1000px)', onStuck } = opts;
  const mainRef = useRef<HTMLElement | null>(null);
  const sideRef = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(base);
  const [, setEpoch] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(t); t = setTimeout(() => setEpoch((e) => e + 1), 120); };
    window.addEventListener('resize', on);
    return () => { clearTimeout(t); window.removeEventListener('resize', on); };
  }, []);

  // Runs after every render on purpose (content above the map can change
  // with any data); it settles because it stops once the ends are within 4px
  // or the height is clamped.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const main = mainRef.current;
    const side = sideRef.current;
    if (!main || !side || paused) return;
    if (window.matchMedia(oneColumnMq).matches) { if (height !== base) setHeight(base); return; }
    const diff = side.offsetHeight - main.offsetHeight;
    if (Math.abs(diff) <= 4) return;
    const next = Math.max(min, Math.min(max, height + diff));
    if (next === height) { if (diff < -48) onStuck?.(); return; }
    setHeight(next);
    // A map already drawn at the old size re-measures on window resize.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });

  return { mainRef, sideRef, height };
}
