import { useEffect, useState } from 'react';

// Tracks a max-width media query as a boolean, live — used to switch between
// genuinely different layouts (not just CSS reflow) for the same page, e.g.
// the auth pages' compact single-column mobile layout vs. their desktop
// side-by-side split. matchMedia's own 'change' event fires on resize AND on
// device rotation, so this stays correct without a manual resize listener.
export function useIsMobile(breakpoint = 860): boolean {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
