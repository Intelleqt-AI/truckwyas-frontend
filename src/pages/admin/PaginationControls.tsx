// Shared Prev/Next pager for the admin dashboard's list views (Companies,
// Users, Audit Log) — the one bit of UI genuinely identical in all three,
// unlike the rest of src/pages/admin/* which is deliberately self-contained
// per file. Dumb/presentational: the parent owns the `page` state.

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  borderRadius: 2,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.04em',
  cursor: 'pointer',
};

interface PaginationControlsProps {
  page: number;
  numPages: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function PaginationControls({ page, numPages, count, onPrev, onNext }: PaginationControlsProps) {
  if (numPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        Page {page} of {numPages} · {count} total
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btnStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }} disabled={page <= 1} onClick={onPrev}>
          Prev
        </button>
        <button style={{ ...btnStyle, opacity: page >= numPages ? 0.4 : 1, cursor: page >= numPages ? 'default' : 'pointer' }} disabled={page >= numPages} onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
