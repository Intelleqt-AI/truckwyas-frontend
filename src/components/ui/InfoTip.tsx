import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * v3 methodology tip (DESIGN-PRINCIPLES §9): the basis of a number lives
 * behind this icon, never as body text in the card. Opens on hover, focus
 * and tap; Escape or a tap elsewhere closes it.
 */
export function InfoTip({ children, label = 'How this is calculated', align = 'start' }: {
  children: ReactNode;
  label?: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
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
