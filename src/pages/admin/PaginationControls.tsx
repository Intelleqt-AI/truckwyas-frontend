import '@/pages/admin/admin-brand.css';

// Shared Prev/Next pager for the admin dashboard's list views (Companies,
// Users, Audit Log) — the one bit of UI genuinely identical in all three,
// unlike the rest of src/pages/admin/* which is deliberately self-contained
// per file. Dumb/presentational: the parent owns the `page` state.

const btnStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  borderRadius: 6,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  minHeight: 40,
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
        Page {page} of {numPages} · {count} total
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="admin-control" style={{ ...btnStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }} disabled={page <= 1} onClick={onPrev}>
          Previous
        </button>
        <button className="admin-control" style={{ ...btnStyle, opacity: page >= numPages ? 0.4 : 1, cursor: page >= numPages ? 'default' : 'pointer' }} disabled={page >= numPages} onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
