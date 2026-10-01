import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * A single-line figure that never truncates: when the text is wider than its
 * box at the CSS font size, the font size steps down just enough to fit (to a
 * floor of `min` px). Line height is left to CSS, so tiles keep their fixed
 * --kpi-height. Letter spacing in `em` scales with it; tabular numerals stay.
 *
 * Used for KPI figures (KpiTile, FinTile, the Today tiles), where amounts of
 * R 1 000 000 and up used to end in "…" in a four-up row at 1440.
 *
 *   <FitText as="div" className="td-kpi__value">{wholeRand(owed)}</FitText>
 */
export function FitText({
  as: Tag = 'span', className, title, children, min = 14,
}: {
  as?: ElementType;
  className?: string;
  title?: string;
  children?: ReactNode;
  /** Smallest font size in px the figure may shrink to. */
  min?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const fit = () => {
      el.style.fontSize = '';
      const avail = el.clientWidth;
      const need = el.scrollWidth;
      if (avail <= 0 || need <= avail) return;
      const base = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (!base) return;
      let size = Math.max(min, Math.floor(((base * avail) / need) * 10) / 10);
      el.style.fontSize = `${size}px`;
      // Rounding and kerning can leave a pixel over: step down until it fits.
      for (let i = 0; i < 8 && size > min && el.scrollWidth > el.clientWidth; i += 1) {
        size = Math.max(min, size - 0.5);
        el.style.fontSize = `${size}px`;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // The parent carries the width the figure may use (the figure itself may
    // shrink to its content); watch both, and the text, and late web fonts.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    if (el.parentElement) ro?.observe(el.parentElement);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.ready.then(schedule).catch(() => undefined);
    fonts?.addEventListener?.('loadingdone', schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      mo?.disconnect();
      fonts?.removeEventListener?.('loadingdone', schedule);
    };
  }, [min]);

  return <Tag ref={ref} className={className} title={title}>{children}</Tag>;
}

export default FitText;
