import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import './row-actions.css';

export interface RowActionItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Optional second line, e.g. why an item is unavailable. */
  hint?: string;
}

/**
 * One action control per table row (owner review, 28 Sep 2026: "edit and
 * delete needs 1 edit button rather").
 *
 * - Only `onEdit`: a compact "Edit" button.
 * - `items`: a single "⋯" button that opens a small menu. Danger items
 *   (Delete) always render last, after a divider, in danger text.
 *
 * The menu is portalled to <body> with fixed positioning so it is never
 * clipped by a table's own scroll region. Keyboard: Enter/Space/ArrowDown
 * opens, arrows and Home/End move, Escape or Tab closes, focus returns to the
 * trigger. 32px with a mouse, 44px on touch (pointer: coarse).
 */
export default function RowActions({ label, onEdit, items }: {
  label: string;
  onEdit?: () => void;
  items?: RowActionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusFirstOnOpen = useRef<'first' | 'last' | null>(null);

  const list = items ?? [];
  const safe = list.filter((i) => !i.danger);
  const danger = list.filter((i) => i.danger);
  const ordered = [...safe, ...danger];

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const menuW = menuRef.current?.offsetWidth || 200;
    const menuH = menuRef.current?.offsetHeight || 40 * Math.max(1, ordered.length) + 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const up = r.bottom + 4 + menuH > vh - 8 && r.top - 4 - menuH > 8;
    let left = r.right - menuW;
    if (left < 8) left = Math.min(r.left, vw - menuW - 8);
    left = Math.max(8, left);
    setPos({ top: up ? r.top - 4 - menuH : r.bottom + 4, left, up });
  }, [ordered.length]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Measure again once the menu has real dimensions.
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
    // Any scroll outside the menu (page or table region) closes it rather than
    // leaving it detached from its row.
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pos) return;
    const want = focusFirstOnOpen.current;
    focusFirstOnOpen.current = null;
    const enabled = itemRefs.current.filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    if (!enabled.length) { menuRef.current?.focus(); return; }
    (want === 'last' ? enabled[enabled.length - 1] : enabled[0]).focus();
  }, [open, pos]);

  if (!list.length) {
    if (!onEdit) return null;
    return (
      <button
        type="button"
        className="tw-rowact tw-rowact--text"
        aria-label={`Edit ${label}`}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
      >
        Edit
      </button>
    );
  }

  // With a menu, Edit becomes its first item so the row keeps one control.
  const menuItems: RowActionItem[] = onEdit ? [{ label: 'Edit', onSelect: onEdit }, ...ordered] : ordered;
  const firstDanger = menuItems.findIndex((i) => i.danger);

  const moveFocus = (dir: 1 | -1 | 'first' | 'last') => {
    const enabled = itemRefs.current.filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    if (!enabled.length) return;
    const cur = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (dir === 'first') next = 0;
    else if (dir === 'last') next = enabled.length - 1;
    else next = cur < 0 ? 0 : (cur + dir + enabled.length) % enabled.length;
    enabled[next].focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      focusFirstOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveFocus(1); break;
      case 'ArrowUp': e.preventDefault(); moveFocus(-1); break;
      case 'Home': e.preventDefault(); moveFocus('first'); break;
      case 'End': e.preventDefault(); moveFocus('last'); break;
      case 'Escape': e.preventDefault(); close(true); break;
      case 'Tab': e.preventDefault(); close(true); break;
      default: break;
    }
  };

  const menuId = `rowact-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tw-rowact tw-rowact--icon"
        aria-label={`${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={onTriggerKey}
      >
        <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`${label} actions`}
          tabIndex={-1}
          className="tw-rowact-menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
          onKeyDown={onMenuKey}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item, i) => (
            <div key={`${item.label}-${i}`} role="none">
              {i === firstDanger && firstDanger > 0 && <div className="tw-rowact-menu__sep" role="separator" />}
              <button
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                className={`tw-rowact-menu__item${item.danger ? ' is-danger' : ''}`}
                onClick={() => {
                  if (item.disabled) return;
                  close(true);
                  item.onSelect();
                }}
              >
                <span className="tw-rowact-menu__label">{item.label}</span>
                {item.hint && <span className="tw-rowact-menu__hint">{item.hint}</span>}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
