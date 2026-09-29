import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  );
}

// Only the most recently opened trap handles Tab (a confirm dialog opened from
// inside a drawer must not have focus pulled back into the drawer).
const stack: HTMLElement[] = [];

/**
 * Modal focus management for drawers and dialogs:
 * - on open, focus moves into the container (the `[data-autofocus]` element,
 *   else the first field, else the container itself);
 * - Tab and Shift+Tab cycle inside it;
 * - on close, focus returns to whatever had it before (usually the trigger).
 * Escape handling stays with each component.
 *
 * `target` is a ref, or a getter such as `() => document.getElementById(id)`
 * for dialogs rendered inline in a page.
 */
export function useFocusTrap(
  target: RefObject<HTMLElement | null> | (() => HTMLElement | null),
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const root = typeof target === 'function' ? target() : target.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(root);

    const initial = () => {
      if (root.contains(document.activeElement)) return;
      const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
      const target = preferred ?? focusables(root).find((el) => el.matches('input,select,textarea')) ?? focusables(root)[0];
      if (target) target.focus({ preventScroll: true });
      else {
        if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
        root.focus({ preventScroll: true });
      }
    };
    // Wait a frame so portalled / animated content is laid out.
    const raf = requestAnimationFrame(initial);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || stack[stack.length - 1] !== root) return;
      const items = focusables(root);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (!activeEl || !root.contains(activeEl)) {
        // Focus is in a portalled popup opened from inside (a select list, a
        // date picker): leave Tab to that widget. Only reclaim a lost focus.
        if (activeEl && activeEl !== document.body) return;
        e.preventDefault(); (e.shiftKey ? last : first).focus(); return;
      }
      if (e.shiftKey && activeEl === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      const i = stack.lastIndexOf(root);
      if (i >= 0) stack.splice(i, 1);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
    // `target` is read once per activation; callers pass an inline getter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/** The most recently rendered modal dialog: a getter for inline page dialogs. */
export const latestModal = (): HTMLElement | null => {
  const all = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
  return all.length ? all[all.length - 1] : null;
};
