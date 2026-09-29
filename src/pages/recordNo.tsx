// Record numbers on narrow tables (R7/R8): shared by Quotes, Orders, History
// and Customer detail, kept apart from the Quotes board module.

/** Record numbers like "LOAD-20260310-1004": on narrow rows the prefix and
 *  year are the same on every row, so the phone shows the distinguishing
 *  tail ("…0310-1004"), never a cut-off prefix (R7). Full number in the
 *  title and for screen readers. */
export const idTail = (n?: string | null) => {
  const v = String(n || '');
  const m = v.match(/^[A-Z]+-\d{4}(\d{4}-\d+)$/);
  return m ? `…${m[1]}` : v;
};
export function RecordNo({ value }: { value?: string | null }) {
  const v = String(value || '');
  return (
    <span className="bk-phone-sub" title={v}>
      <span className="bk-id-long">{v}</span>
      <span className="bk-id-short">{idTail(v)}</span>
    </span>
  );
}

/** The same ID rule inside a table's own ID column (Customer detail): the
 *  full number where it fits, the tail on narrow tables (R8). */
export function RecordId({ value }: { value?: string | null }) {
  const v = String(value || '');
  return (
    <span className="bk-record-id" title={v}>
      <span className="bk-id-long">{v}</span>
      <span className="bk-id-short">{idTail(v)}</span>
    </span>
  );
}
