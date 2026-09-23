import { useState } from 'react';
import { postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';

/** The app's secondary button: mono, 11px, square-ish corners — matches the
 *  Heatmap/Reset buttons the rest of the pages already use. Defined once here
 *  because the import and delete controls were each re-inventing it slightly
 *  differently, and the 0-vertical-padding version sat visibly short beside a
 *  primary button. */
export const secondaryButtonStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  background: 'none',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  padding: '8px 14px',
  borderRadius: 6,
  minHeight: 40,
  cursor: 'pointer',
};

/**
 * The bar that appears once rows are ticked.
 *
 * Confirms inline rather than in a modal: deleting is destructive, so it needs
 * a deliberate second click, but a dialog over a table you are still reading
 * hides the very rows you are deciding about.
 *
 * Quotes, invoices, loads and trips PROTECT the records a fleet most wants to
 * tidy up, so a partial result is the normal case, not an edge one — whatever
 * can go, goes, and the rest come back named with the reason.
 */
interface Props {
  entity: 'customers' | 'vehicles';
  selected: number[];
  onClear: () => void;
  /** Called after the request so the caller can refetch and drop the selection. */
  onDeleted: (deleted: number) => void;
}

export function BulkDeleteBar({ entity, selected, onClear, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (selected.length === 0) return null;
  const noun = selected.length === 1
    ? (entity === 'customers' ? 'customer' : 'vehicle')
    : entity;

  const run = async () => {
    setBusy(true);
    try {
      const res: any = await postData({
        url: `api/v1/${entity}/bulk-delete/`,
        data: { ids: selected },
      });
      const deleted = res?.deleted ?? 0;
      const blocked: { name: string; reason: string }[] = res?.blocked || [];

      if (deleted > 0) toast.success(`Deleted ${deleted} ${deleted === 1 ? noun : entity}`);
      if (blocked.length > 0) {
        // Name them: "3 couldn't be deleted" with no reason is the kind of
        // message that sends someone to support.
        const shown = blocked.slice(0, 3).map(b => `${b.name} — ${b.reason}`).join('; ');
        const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : '';
        toast.error(`Kept ${blocked.length}: ${shown}${more}`);
      }
      if (deleted === 0 && blocked.length === 0) toast.error('Nothing was deleted');
      onDeleted(deleted);
    } catch (e: any) {
      toast.error(e?.message || e?.error || 'Could not delete');
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 16px', marginBottom: 12, borderRadius: 4,
      background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
        {selected.length} selected
      </span>

      {!confirming ? (
        <>
          <button
            onClick={() => setConfirming(true)}
            style={{
              ...secondaryButtonStyle,
              borderColor: 'var(--status-danger)', color: 'var(--status-danger)',
            }}
          >Delete</button>
          <button
            onClick={onClear}
            style={{
              ...secondaryButtonStyle, border: 'none',
              color: 'var(--text-tertiary)', padding: '8px 4px',
            }}
          >Clear selection</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Delete {selected.length} {noun}? This cannot be undone.
          </span>
          <button
            onClick={run}
            disabled={busy}
            style={{
              ...secondaryButtonStyle,
              background: 'var(--status-danger)', borderColor: 'var(--status-danger)',
              color: '#fff', cursor: busy ? 'wait' : 'pointer', minWidth: 96,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >{busy ? <Loader size={12} color="currentColor" /> : 'Yes, delete'}</button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            style={secondaryButtonStyle}
          >Cancel</button>
        </>
      )}
    </div>
  );
}

/** Square tick box sized for a table row. Stops its click reaching the row, so
 *  ticking never navigates away from the list you are selecting in. */
export function RowCheckbox({ checked, onChange, title }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      title={title}
      onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); onChange(e.target.checked); }}
      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
    />
  );
}
