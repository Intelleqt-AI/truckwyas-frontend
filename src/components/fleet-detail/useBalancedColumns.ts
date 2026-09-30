import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Two-column detail layouts end within this many px of each other (R5). */
export const BALANCE_TOLERANCE = 48;
/** Below this width the record is one column (fleet-detail.css), so nothing moves. */
const ONE_COLUMN_MQ = '(max-width: 1100px)';

/**
 * Balances a record page's two columns (R5: "two-column detail layouts end
 * within 48px of each other"). The page names the cards that may change
 * column: `toMain` cards live in the rail and may drop to the end of the
 * main column (laid out wide there); `toSide` cards live at the end of the
 * main column and may move to the end of the rail.
 *
 * Before paint (useLayoutEffect) it tries each arrangement of those cards,
 * measures both columns, and keeps the one whose ends are closest, so the
 * page never paints an unbalanced state and then jumps. Cards are never
 * stretched to fake an even end (R6); a page whose arrangements cannot land
 * within the tolerance should offer more movable cards or reflow.
 * It re-runs when `key` changes (new data) or the window is resized; below
 * the one-column breakpoint the default arrangement is kept.
 *
 *   const bal = useBalancedColumns({ toMain: ['contact', 'facts'] }, dataKey);
 *   <div ref={bal.mainRef}>… {bal.inMain('facts') && facts}</div>
 *   <aside ref={bal.sideRef}>… {!bal.inMain('facts') && facts}</aside>
 */
export function useBalancedColumns(opts: { toMain?: string[]; toSide?: string[] }, key: unknown) {
  const movable = [...(opts.toMain ?? []), ...(opts.toSide ?? [])];
  const homeMain = new Set(opts.toSide ?? []);
  const combos = 1 << movable.length;
  const mainRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  // Bit i set: movable[i] is away from its home column.
  const [mask, setMask] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const search = useRef<{ id: string; next: number; best: number; bestDiff: number; done: boolean } | null>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(t); t = setTimeout(() => setEpoch((e) => e + 1), 120); };
    window.addEventListener('resize', on);
    return () => { clearTimeout(t); window.removeEventListener('resize', on); };
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    const side = sideRef.current;
    const id = `${String(key)}|${epoch}`;
    const s0 = search.current;
    if (!s0 || s0.id !== id) {
      search.current = { id, next: 0, best: 0, bestDiff: Infinity, done: false };
      if (mask !== 0) { setMask(0); return; }
    }
    const st = search.current!;
    if (st.done) return;
    if (!main || !side || window.matchMedia(ONE_COLUMN_MQ).matches || combos === 1) {
      st.done = true;
      if (mask !== 0) setMask(0);
      return;
    }
    if (mask === st.next) {
      const diff = Math.abs(main.offsetHeight - side.offsetHeight);
      if (diff < st.bestDiff) { st.best = mask; st.bestDiff = diff; }
      st.next += 1;
      // Try every arrangement (at most 2^3) and keep the closest ends, all before paint.
      if (st.bestDiff > 8 && st.next < combos) { setMask(st.next); return; }
      st.done = true;
      if (st.best !== mask) { setMask(st.best); return; }
    }
  });

  const inMain = useCallback((name: string) => {
    const i = movable.indexOf(name);
    if (i < 0) return false;
    const away = (mask & (1 << i)) !== 0;
    return homeMain.has(name) ? !away : away;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mask, movable.join()]);

  return { mainRef, sideRef, inMain };
}
