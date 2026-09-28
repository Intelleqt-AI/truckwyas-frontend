/* Content-only loading placeholders for the operational pages (Fleet,
   Bookings, Customers, Settings, Admin). The page head renders straight away;
   only the area that waits for data shows these quiet grey bars, so a click
   never blanks the header behind a full-page spinner. */
import '@/pages/ops-tiles.css';

export function TableSkeleton({ rows = 6, cols = 5, label = 'Loading', bare = false }: { rows?: number; cols?: number; label?: string; bare?: boolean }) {
  return (
    <div className={bare ? 'ops-skel-table ops-skel-table--bare' : 'ops-skel-table'} aria-busy="true" aria-label={label} role="status">
      <div className="ops-skel-row ops-skel-row--head">
        {Array.from({ length: cols }, (_, i) => <span key={i} className="ops-skel" style={{ width: i === 0 ? '60%' : '40%' }} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="ops-skel-row">
          {Array.from({ length: cols }, (_, i) => <span key={i} className="ops-skel" style={{ width: `${45 + ((r * 7 + i * 13) % 40)}%` }} />)}
        </div>
      ))}
    </div>
  );
}

export function TilesSkeleton({ count = 3 }: { count?: number }) {
  // Same markup as KpiRow / KpiTile, so the tiles land without moving.
  return (
    <div className="tw-kpi-row ops-kpis" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="tw-kpi">
          <span className="ops-skel" style={{ width: 96, height: 12 }} />
          <span className="ops-skel" style={{ width: 120, height: 24 }} />
          <span className="ops-skel" style={{ width: 80, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ height = 240, label = 'Loading' }: { height?: number; label?: string }) {
  return <div className="ops-skel-block" style={{ height }} aria-busy="true" aria-label={label} role="status" />;
}

/** Placeholder rows for a real table body: same <tr> markup, so they take
 *  the table's own row height and the page does not shift when data lands. */
export function SkeletonRows({ rows = 8, cols = 5, skipFirst = false }: { rows?: number; cols?: number; skipFirst?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={`skel-${r}`} aria-hidden="true" className="ops-skel-tr">
          {Array.from({ length: cols }, (_, i) => (
            <td key={i}>
              {skipFirst && i === 0 ? null : <span className="ops-skel" style={{ width: `${40 + ((r * 7 + i * 13) % 45)}%` }} />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
