/**
 * The footer under a server-paginated table: "21 to 40 of 312" and
 * Previous / Next. Renders nothing when everything fits on one page.
 * Styles: .tw-pager in styles/theme.css (same look as .fin-table-foot).
 */
export function TablePager({ page, pageSize, count, onPage, busy }: {
  page: number;
  pageSize: number;
  count: number;
  onPage: (page: number) => void;
  /** The next page is loading: the buttons wait. */
  busy?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="tw-pager">
      <span>{(page - 1) * pageSize + 1} to {Math.min(page * pageSize, count)} of {count}</span>
      <div className="tw-pager__nav">
        <button type="button" className="tw-btn" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1 || busy}>Previous</button>
        <button type="button" className="tw-btn" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages || busy}>Next</button>
      </div>
    </div>
  );
}

