import { useId } from 'react';
import OverflowMenu, { type MenuItem } from './OverflowMenu';
import './row-actions.css';

export type RowActionItem = Pick<MenuItem, 'label' | 'onSelect' | 'danger' | 'disabled' | 'hint' | 'title'>;

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
 *
 * Disabled items (and a disabled Edit, via `editDisabledReason`) stay
 * focusable so keyboard and screen-reader users can find out why they are
 * unavailable; the reason shows as a tooltip and is announced.
 */
export default function RowActions({ label, onEdit, editDisabledReason, items }: {
  label: string;
  onEdit?: () => void;
  /** Show Edit but make it unavailable, with this reason as its tooltip. */
  editDisabledReason?: string;
  items?: RowActionItem[];
}) {
  const uid = useId();
  const list = items ?? [];
  const editDisabled = !!editDisabledReason;

  if (!list.length) {
    if (!onEdit) return null;
    const reasonId = `rowact-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}-edit-reason`;
    return (
      <>
        <button
          type="button"
          className="tw-rowact tw-rowact--text"
          aria-label={`Edit ${label}`}
          aria-disabled={editDisabled || undefined}
          aria-describedby={editDisabled ? reasonId : undefined}
          title={editDisabledReason}
          onClick={(e) => { e.stopPropagation(); if (!editDisabled) onEdit(); }}
        >
          Edit
        </button>
        {editDisabled && <span id={reasonId} className="tw-rowact-sr">{editDisabledReason}</span>}
      </>
    );
  }

  // With a menu, Edit becomes its first item so the row keeps one control.
  const menuItems: MenuItem[] = onEdit
    ? [{ label: 'Edit', onSelect: onEdit, disabled: editDisabled, title: editDisabledReason }, ...list]
    : list;
  return <OverflowMenu label={`${label} actions`} items={menuItems} />;
}
