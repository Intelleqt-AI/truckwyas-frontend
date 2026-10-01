import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Horizontal scrollbar for a board of columns, with a small arrow at each end
 * that moves exactly one column per click. The board hides its own native
 * scrollbar; this draws its own rounded track and thumb (native scrollbar
 * styling differs per browser), kept in step with the board. Drag the thumb,
 * or click the track to jump there; trackpad and keyboard scroll the board
 * as usual. Renders nothing while every column fits.
 */
export function BoardScrollbar({ target, label = 'Scroll columns' }: { target: RefObject<HTMLElement>; label?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; perPx: number } | null>(null);
  const [m, setM] = useState({ content: 0, view: 0, left: 0 });

  const measure = useCallback(() => {
    const el = target.current;
    if (!el) return;
    setM({ content: el.scrollWidth, view: el.clientWidth, left: el.scrollLeft });
  }, [target]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [target, measure]);

  const range = Math.max(m.content - m.view, 0);
  const thumbPct = m.content > 0 ? Math.min(100, (m.view / m.content) * 100) : 100;
  const leftPct = range > 0 ? (m.left / range) * (100 - thumbPct) : 0;

  // Pixels of board scroll per pixel of thumb travel.
  const perPx = () => {
    const w = trackRef.current?.getBoundingClientRect().width ?? 0;
    const travel = w * (1 - thumbPct / 100);
    return travel > 0 ? range / travel : 0;
  };

  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, scroll: target.current?.scrollLeft ?? 0, perPx: perPx() };
  };
  const onThumbMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = target.current;
    if (!d || !el) return;
    el.scrollLeft = d.scroll + (e.clientX - d.x) * d.perPx;
  };
  const onThumbUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  // Click on the track: centre the thumb on the click.
  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const r = track.getBoundingClientRect();
    const thumbW = r.width * (thumbPct / 100);
    const x = Math.min(Math.max(e.clientX - r.left - thumbW / 2, 0), r.width - thumbW);
    el.scrollTo({ left: x * perPx(), behavior: 'smooth' });
  };

  // One column per click: snap to the next/previous column's left edge.
  const step = (dir: 1 | -1) => {
    const el = target.current;
    if (!el) return;
    const base = el.getBoundingClientRect().left - el.scrollLeft;
    const lefts = Array.from(el.children).map((c) => (c as HTMLElement).getBoundingClientRect().left - base);
    const at = el.scrollLeft;
    const to = dir > 0
      ? lefts.find((l) => l > at + 1)
      : [...lefts].reverse().find((l) => l < at - 1);
    el.scrollTo({ left: to ?? (dir > 0 ? el.scrollWidth : 0), behavior: 'smooth' });
  };

  if (range <= 1) return null;

  return (
    <div className="bk-hscroll" role="group" aria-label={label}>
      <button type="button" className="bk-hscroll__btn" onClick={() => step(-1)} disabled={m.left <= 1} aria-label="Previous column">
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <div ref={trackRef} className="bk-hscroll__track" onPointerDown={onTrackDown} aria-hidden="true">
        <div
          className="bk-hscroll__thumb"
          style={{ width: `${thumbPct}%`, left: `${leftPct}%` }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          onPointerCancel={onThumbUp}
        />
      </div>
      <button type="button" className="bk-hscroll__btn" onClick={() => step(1)} disabled={m.left >= range - 1} aria-label="Next column">
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
