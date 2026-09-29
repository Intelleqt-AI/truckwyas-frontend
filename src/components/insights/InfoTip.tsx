import './findings.css';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/* Info icon that holds the methodology (DESIGN-PRINCIPLES section 9: method
   lives behind an info icon, never as body text). Click or tap toggles it;
   hover and keyboard focus show it too. The panel is fixed-positioned and
   clamped to the viewport so it never causes horizontal scroll on a phone.
   Closes on Escape, outside click and scroll. */
export default function InfoTip({ label = 'How this is calculated', children, tone }: {
  label?: string;
  children: ReactNode;
  /** 'inverse' when the icon sits on a solid accent surface. */
  tone?: 'inverse';
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const width = Math.min(320, vw - 32);
    const left = Math.min(Math.max(16, b.right - width + 8), vw - width - 16);
    const h = panel.current?.offsetHeight ?? 120;
    const above = b.bottom + 8 + h > vh - 16 && b.top - 8 - h > 16;
    setPos({ left, top: above ? b.top - 8 - h : b.bottom + 8, width, above });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setPinned(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btn.current?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !panel.current?.contains(t)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span className={`it${tone === 'inverse' ? ' it--inverse' : ''}`}>
      <button
        ref={btn}
        type="button"
        className="it__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { if (pinned) { setOpen(false); setPinned(false); } else { setOpen(true); setPinned(true); } }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !pinned) setOpen(false); }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { if (!pinned && !panel.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 7.2v3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="tooltip"
          className="it__panel"
          style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: 'hidden', left: 0, top: 0 }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
