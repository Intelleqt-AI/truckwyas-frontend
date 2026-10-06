import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * v3 methodology tip (DESIGN-PRINCIPLES §9): the basis of a number lives
 * behind this icon, never as body text in the card. Opens on hover, focus
 * and tap (a click pins it); Escape, a second click or a tap elsewhere closes it.
 */
export function InfoTip({ children, label = 'How this is calculated', align = 'start' }: {
  children: ReactNode;
  label?: string;
  align?: 'start' | 'end';
}) {
  // Three ways in, one way out: a mouse hover previews it, keyboard focus
  // shows it, and a click or tap pins it open; a second click, Escape, a tap
  // elsewhere or moving focus away closes it. (A click no longer closes a
  // tip that the hover just opened.)
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hover || focused;
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const close = () => { setPinned(false); setHover(false); setFocused(false); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <button
      ref={ref}
      type="button"
      className="tw-info"
      aria-label={label}
      aria-expanded={open}
      aria-describedby={open ? id : undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(false); }}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocused(true); }}
      onBlur={() => { setFocused(false); setPinned(false); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (pinned) close(); else setPinned(true); }}
    >
      <Info size={14} strokeWidth={1.75} aria-hidden="true" />
      {open && (
        <span id={id} role="tooltip" className={`tw-info__pop${align === 'end' ? ' tw-info__pop--end' : ''}`}>
          {children}
        </span>
      )}
    </button>
  );
}
