import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MoreHorizontal } from 'lucide-react';
import './row-actions.css';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Optional second line, e.g. what the action does or why it is unavailable. */
  hint?: string;
  /** Tooltip; on a disabled item this is the reason (also announced). Falls back to `hint`. */
  title?: string;
  /** Leading icon (decorative). */
  icon?: ReactNode;
  /**
   * A two-state item (role="menuitemcheckbox"), e.g. "Dark theme". Shows a
   * check when true. Selecting it keeps the menu open so the new state is seen.
   */
  checked?: boolean;
  /** Keep the menu open after this item is selected. Defaults to true for `checked` items. */
  keepOpen?: boolean;
}

export interface OverflowMenuProps {
  /** Accessible name of the menu, e.g. "Invoice INV-1 actions". */
  label: string;
  /** The items, or a function that builds them when the menu opens. Danger items render last, after a divider. */
  items: MenuItem[] | (() => MenuItem[]);
  /** Accessible name of the trigger. Defaults to `label`. */
  triggerLabel?: string;
  /** Trigger content. Defaults to a "⋯" icon. */
  trigger?: ReactNode;
  /** Trigger class. Defaults to the quiet 32px icon button (44px on touch). */
  triggerClassName?: string;
  triggerTitle?: string;
  /** Non-interactive content above the items (e.g. the signed-in account). */
  header?: ReactNode;
  /** Menu class. Defaults to the shared popover menu (.tw-rowact-menu). */
  menuClassName?: string;
  /** Item class. Defaults to .tw-rowact-menu__item. */
  itemClassName?: string;
  /**
   * true (default): the menu is portalled to <body> with fixed positioning so
   * no scroll region clips it. false: it renders next to the trigger and the
   * caller's `menuClassName` positions it.
   */
  portal?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * THE "⋯" menu (WAI-ARIA menu button). Used by RowActions, the page head's
 * phone overflow and the account menu.
 *
 * Keyboard: Enter, Space or ArrowDown on the trigger opens it and focuses the
 * first item (ArrowUp: the last). In the menu: ArrowUp/ArrowDown move (and
 * wrap), Home/End jump, a letter jumps to the next item starting with it,
 * Escape closes and returns focus to the trigger, Tab closes and moves on.
 * Disabled items stay focusable so their reason can be read.
 */
export default function OverflowMenu({
  label, items, triggerLabel, trigger, triggerClassName = 'tw-rowact tw-rowact--icon', triggerTitle,
  header, menuClassName = 'tw-rowact-menu', itemClassName = 'tw-rowact-menu__item', portal = true, onOpenChange,
}: OverflowMenuProps) {
  const [open, setOpenState] = useState(false);
  const [resolved, setResolved] = useState<MenuItem[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const uid = useId();
  const menuId = `menu-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const resolve = useCallback(() => {
    const list = typeof items === 'function' ? items() : items;
    return [...list.filter((i) => !i.danger), ...list.filter((i) => i.danger)];
  }, [items]);
  const shown = open ? (typeof items === 'function' ? resolved : resolve()) : [];

  const setOpen = useCallback((v: boolean) => {
    if (v) setResolved(resolve());
    else setPos(null);
    setOpenState(v);
    onOpenChange?.(v);
  }, [resolve, onOpenChange]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, [setOpen]);

  const place = useCallback(() => {
    if (!portal) { setPos({ top: 0, left: 0 }); return; }
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const menuW = menuRef.current?.offsetWidth || 200;
    const menuH = menuRef.current?.offsetHeight || 40 * Math.max(1, shown.length) + 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const up = r.bottom + 4 + menuH > vh - 8 && r.top - 4 - menuH > 8;
    let left = r.right - menuW;
    if (left < 8) left = Math.min(r.left, vw - menuW - 8);
    left = Math.max(8, left);
    setPos({ top: up ? r.top - 4 - menuH : r.bottom + 4, left });
  }, [portal, shown.length]);

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
    // A scroll outside the menu closes it rather than leaving it detached.
    const onScroll = (e: Event) => {
      if (!portal) return;
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
  }, [open, portal, setOpen]);

  // Focus the first (or last) item once the menu is placed.
  const placed = open && !!pos;
  useEffect(() => {
    if (!placed) return;
    const all = itemRefs.current.filter((b): b is HTMLButtonElement => !!b);
    if (!all.length) { menuRef.current?.focus(); return; }
    (focusOnOpen.current === 'last' ? all[all.length - 1] : all[0]).focus();
    focusOnOpen.current = 'first';
  }, [placed]);

  const moveFocus = (dir: 1 | -1 | 'first' | 'last') => {
    const all = itemRefs.current.filter((b): b is HTMLButtonElement => !!b);
    if (!all.length) return;
    const cur = all.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (dir === 'first') next = 0;
    else if (dir === 'last') next = all.length - 1;
    else next = cur < 0 ? 0 : (cur + dir + all.length) % all.length;
    all[next].focus();
  };

  const typeAhead = (ch: string) => {
    const all = itemRefs.current.filter((b): b is HTMLButtonElement => !!b);
    const cur = all.indexOf(document.activeElement as HTMLButtonElement);
    for (let k = 1; k <= all.length; k++) {
      const b = all[(cur + k) % all.length];
      if ((b.textContent || '').trim().toLowerCase().startsWith(ch)) { b.focus(); return; }
    }
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      if (open && (e.key === 'Enter' || e.key === ' ')) { close(true); return; }
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
      // Tab: close and let the browser move on from the trigger.
      case 'Tab': triggerRef.current?.focus(); setOpen(false); break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) typeAhead(e.key.toLowerCase());
    }
  };

  const firstDanger = shown.findIndex((i) => i.danger);
  itemRefs.current = [];

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className={menuClassName}
      style={portal ? { top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' } : undefined}
      onKeyDown={onMenuKey}
      onClick={(e) => e.stopPropagation()}
    >
      {header && <div role="presentation">{header}</div>}
      {shown.map((item, i) => {
        const tip = item.title ?? (item.disabled ? item.hint : undefined);
        const reasonId = item.disabled && item.title && item.title !== item.hint ? `${menuId}-reason-${i}` : undefined;
        const checkable = item.checked !== undefined;
        return (
          <div key={`${item.label}-${i}`} role="none">
            {i === firstDanger && firstDanger > 0 && <div className="tw-rowact-menu__sep" role="separator" />}
            <button
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role={checkable ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={checkable ? !!item.checked : undefined}
              aria-disabled={item.disabled || undefined}
              aria-describedby={reasonId}
              tabIndex={-1}
              title={tip}
              className={`${itemClassName}${item.danger ? ' is-danger' : ''}${item.disabled ? ' is-disabled' : ''}${checkable ? ' is-checkable' : ''}`}
              onClick={() => {
                if (item.disabled) return;
                const stay = item.keepOpen ?? checkable;
                if (!stay) close(true);
                item.onSelect();
                if (stay) setResolved(resolve());
              }}
            >
              {item.icon && <span className="tw-menu-icon" aria-hidden="true">{item.icon}</span>}
              <span className="tw-rowact-menu__label">{item.label}</span>
              {checkable && (
                <span className={`tw-menu-check${item.checked ? ' is-on' : ''}`} aria-hidden="true">
                  {item.checked && <Check size={16} strokeWidth={2} />}
                </span>
              )}
              {item.hint && <span className="tw-rowact-menu__hint">{item.hint}</span>}
              {reasonId && <span id={reasonId} className="tw-rowact-sr">{item.title}</span>}
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel ?? label}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => { e.stopPropagation(); if (open) close(false); else { focusOnOpen.current = 'first'; setOpen(true); } }}
        onKeyDown={onTriggerKey}
      >
        {trigger ?? <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />}
      </button>
      {menu && (portal ? createPortal(menu, document.body) : menu)}
    </>
  );
}
