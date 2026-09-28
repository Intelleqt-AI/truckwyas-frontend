import type { KeyboardEvent } from 'react';

/**
 * Props for a table row that opens a record on click, so it is also reachable
 * with Tab and opens with Enter (or Space). Keys pressed on controls inside the
 * row (row menus, checkboxes, links) are left to those controls.
 *
 *   <tr {...rowLink(() => navigate(`/x/${id}`))} onClick={...}>
 */
export function rowLink(open: () => void) {
  return {
    tabIndex: 0,
    'data-row-link': '',
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    },
  };
}
