/* "Change status" for a record's own detail page (vehicle, driver, booking,
   quote). Status is shown once, as a StatusChip beside the title; this is the
   action that changes it. It is a button with a menu (never a segmented
   control or a bare select, which read as filters), and the choice is
   confirmed before anything is written. The caller keeps its own PATCH call:
   `onChange` runs only after the confirmation. */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { statusTone } from '@/components/ui/StatusChip';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import '@/components/ui/row-actions.css';
import '@/pages/bookings-section.css';

export interface StatusOption {
  value: string;
  label: string;
  /** One short line under the option, e.g. what the change means. */
  hint?: string;
  /** Listed but not selectable (with the reason as a tooltip). */
  disabledReason?: string;
}

export interface StatusMenuProps {
  /** The record, for labels: "Change status of GP 333 CCC". */
  subject: string;
  current: string;
  options: StatusOption[];
  /** Runs after the person confirms. Keep the page's existing PATCH here. */
  onChange: (value: string) => void;
  busy?: boolean;
  /** Blocks the control and says why (billing, demo, permissions). */
  disabledReason?: string;
  /** Optional body text for the confirmation; defaults to a plain sentence. */
  confirmText?: (to: StatusOption, from: StatusOption | undefined) => string;
  /**
   * Options that open their own flow instead of the confirmation (for example
   * a quote moving to Sent opens the email preview). Return true if handled.
   */
  intercept?: (value: string) => boolean;
  /** Button text; defaults to "Change status". */
  buttonLabel?: string;
}

export function StatusMenu({
  subject, current, options, onChange, busy, disabledReason, confirmText, intercept, buttonLabel = 'Change status',
}: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [pending, setPending] = useState<StatusOption | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const menuId = `status-menu-${uid}`;
  const blocked = !!disabledReason;
  useFocusTrap(dialogRef, !!pending);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const w = menuRef.current?.offsetWidth || 220;
    const h = menuRef.current?.offsetHeight || 44 * options.length + 8;
    const up = r.bottom + 4 + h > window.innerHeight - 8 && r.top - 4 - h > 8;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    setPos({ top: up ? r.top - 4 - h : r.bottom + 4, left });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const n = e.target as Node;
      if (menuRef.current?.contains(n) || triggerRef.current?.contains(n)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', () => setOpen(false), { once: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pos) return;
    const all = itemRefs.current.filter((b): b is HTMLButtonElement => !!b);
    (all.find(b => b.getAttribute('aria-disabled') !== 'true') ?? all[0])?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  const move = (dir: 1 | -1) => {
    const all = itemRefs.current.filter((b): b is HTMLButtonElement => !!b);
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    all[(i + dir + all.length) % all.length]?.focus();
  };

  const choose = (o: StatusOption) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (o.value === current || o.disabledReason) return;
    if (intercept?.(o.value)) return;
    setPending(o);
  };

  const from = options.find(o => o.value === current);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="bk-btn bk-btn--secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${buttonLabel} of ${subject}`}
        aria-disabled={blocked || busy || undefined}
        title={disabledReason}
        onClick={() => { if (!blocked && !busy) setOpen(o => !o); }}
        onKeyDown={(e) => {
          if (!blocked && !busy && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); }
        }}
        style={blocked || busy ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {busy ? 'Saving…' : buttonLabel}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`${buttonLabel} of ${subject}`}
          tabIndex={-1}
          className="tw-rowact-menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden', minWidth: 220 }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
          }}
        >
          {options.map((o, i) => {
            const isCurrent = o.value === current;
            const off = isCurrent || !!o.disabledReason;
            return (
              <button
                key={o.value}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                aria-disabled={off || undefined}
                title={o.disabledReason}
                className={`tw-rowact-menu__item${o.disabledReason ? ' is-disabled' : ''}`}
                onClick={() => choose(o)}
              >
                <span className="tw-rowact-menu__label" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span className={`bk-dot bk-dot--${statusTone(o.value)}`} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {isCurrent && <Check size={16} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />}
                </span>
                {(isCurrent || o.hint) && (
                  <span className="tw-rowact-menu__hint" style={{ paddingLeft: 16 }}>{isCurrent ? 'Current status' : o.hint}</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
      {pending && createPortal(
        <div className="bk-dialog-backdrop" onClick={() => setPending(null)}>
          <div
            ref={dialogRef}
            className="bk-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-title`}
            aria-describedby={`${menuId}-body`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="bk-dialog__title" id={`${menuId}-title`}>Change status to {pending.label.toLowerCase()}?</h2>
            <p className="bk-dialog__body" id={`${menuId}-body`}>
              {confirmText
                ? confirmText(pending, from)
                : `${subject} changes from ${from ? from.label.toLowerCase() : 'its current status'} to ${pending.label.toLowerCase()}.`}
            </p>
            <div className="bk-dialog__footer">
              <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setPending(null)}>Cancel</button>
              <button
                type="button"
                className="bk-btn bk-btn--primary"
                data-autofocus
                onClick={() => { const v = pending.value; setPending(null); onChange(v); }}
              >
                Change to {pending.label.toLowerCase()}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default StatusMenu;
