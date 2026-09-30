import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Keeps a detail page's side rail in view while the main column scrolls
 * (DESIGN-PRINCIPLES §11.7: rails are sticky rather than stretched).
 *
 * The CSS sets `position: sticky` on the rail; this hook only sets its `top`.
 * A rail shorter than the scroll viewport sticks 24px from the top. A taller
 * rail gets a negative `top`, so it scrolls with the page until its bottom
 * is 24px above the viewport's bottom and then holds there: its last card
 * (usually the actions) is never out of reach.
 *
 *   const railRef = useStickyRail<HTMLDivElement>();
 *   <aside ref={railRef} className="…rail…">
 */
export function useStickyRail<T extends HTMLElement>(gap = 24) {
  const [el, setEl] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useLayoutEffect(() => {
    if (!el) return;
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const update = () => {
      const vh = scroller ? scroller.clientHeight : window.innerHeight;
      el.style.top = `${Math.min(gap, vh - el.offsetHeight - gap)}px`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (scroller) ro.observe(scroller);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [el, gap]);

  return ref;
}
