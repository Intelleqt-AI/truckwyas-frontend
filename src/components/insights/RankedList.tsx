import './ranked-list.css';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* Ranked list (docs/brand/DESIGN-PRINCIPLES.md section 5).
   One row: label (with its sample size), a thin 6px bar on a muted track that
   encodes the SAME value the list is sorted by, the value right-aligned in
   tabular figures, then the share of the total. Rows with too little evidence
   are never ranked; they sit muted beneath the ranking. Presentation only: the
   caller passes values it has already calculated. */

export interface RankedRow {
  id: string;
  label: ReactNode;
  /** Plain-text label for accessible names; defaults to label when it is a string. */
  labelText?: string;
  /** Use the monospace identifier role for the label (plates, invoice numbers). */
  mono?: boolean;
  /** The metric the list is ranked by. null / NaN means no value recorded. */
  value: number | null | undefined;
  /** Sample size behind the value (trips, invoices, entries). */
  count?: number;
  /** Secondary muted line under the label. */
  meta?: ReactNode;
  /** Makes the row a link. */
  href?: string;
}

export interface RankedListProps {
  rows: RankedRow[];
  /** Formats the ranked value. */
  format: (value: number) => string;
  /** Formats the sample size, e.g. n => `${n} trips`. Omit to hide counts. */
  formatCount?: (count: number) => string;
  /** Rows with count below this are kept out of the ranking. */
  minCount?: number;
  /** Heading for the unranked, thin-data rows. */
  thinLabel?: string;
  /** Rows with no value (null, NaN, or zero when zeroIsEmpty) go here. */
  noValueLabel?: string;
  zeroIsEmpty?: boolean;
  /** Show each row's share of the total of all rows with a value. */
  showShare?: boolean;
  /** Keep the given order (for bands with a natural order) instead of sorting. */
  preserveOrder?: boolean;
  /** Sort ascending instead of descending. */
  ascending?: boolean;
  /** How many ranked rows to show before "Show all". */
  topN?: number;
  /** Accessible name for the list. */
  ariaLabel: string;
  /** Shown when there are no rows at all. */
  empty?: ReactNode;
  /** Shown instead of the ranking when every row is thin or empty. */
  noRankedMessage?: ReactNode;
}

const UNRANKED_PREVIEW = 5;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export default function RankedList({
  rows,
  format,
  formatCount,
  minCount = 0,
  thinLabel = 'Too little data to rank',
  noValueLabel = 'No value recorded',
  zeroIsEmpty = false,
  showShare = false,
  preserveOrder = false,
  ascending = false,
  topN = 8,
  ariaLabel,
  empty = 'Nothing to show yet.',
  noRankedMessage,
}: RankedListProps) {
  const [showAll, setShowAll] = useState(false);
  const [showThin, setShowThin] = useState(false);
  const [showAllThin, setShowAllThin] = useState(false);
  const thinId = useId();

  const { ranked, thin, noValue, total, max, evidenced, isThin } = useMemo(() => {
    const clean = rows.map(r => ({ ...r, value: r.value == null ? null : Number(r.value) }));
    const hasValue = (r: { value: number | null }) => isNum(r.value) && !(zeroIsEmpty && r.value === 0);
    const noValue = clean.filter(r => !hasValue(r));
    const withValue = clean.filter(hasValue) as Array<RankedRow & { value: number }>;
    const isThin = (r: RankedRow) => minCount > 0 && (r.count ?? 0) < minCount;
    // In natural-order mode (bands) thin rows stay in place, muted and without a bar.
    let ranked = preserveOrder ? withValue : withValue.filter(r => !isThin(r));
    let thin = preserveOrder ? [] : withValue.filter(isThin);
    if (!preserveOrder) {
      const dir = ascending ? 1 : -1;
      ranked = [...ranked].sort((a, b) => dir * (a.value - b.value));
      thin = [...thin].sort((a, b) => dir * (a.value - b.value));
    }
    const total = withValue.reduce((s, r) => s + r.value, 0);
    const max = Math.max(0, ...ranked.filter(r => !isThin(r)).map(r => Math.abs(r.value)));
    const evidenced = ranked.filter(r => !isThin(r)).length;
    return { ranked, thin, noValue, total, max, evidenced, isThin };
  }, [rows, minCount, zeroIsEmpty, preserveOrder, ascending]);

  if (rows.length === 0) {
    return <p className="rl-empty">{empty}</p>;
  }

  const visible = showAll ? ranked : ranked.slice(0, topN);
  const hidden = ranked.length - visible.length;
  const unrankedCount = thin.length + noValue.length;
  const unrankedAll = [
    ...thin.map(row => ({ row, reason: thinLabel, hideValue: false })),
    ...noValue.map(row => ({ row, reason: noValueLabel, hideValue: true })),
  ];
  const unrankedRows = showAllThin ? unrankedAll : unrankedAll.slice(0, UNRANKED_PREVIEW);

  const labelOf = (r: RankedRow) => r.labelText ?? (typeof r.label === 'string' ? r.label : r.id);
  const share = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(0)}%` : '');

  const renderRow = (r: RankedRow, opts: { muted?: string; hideValue?: boolean }) => {
    const v = isNum(r.value) && !opts.hideValue ? r.value : null;
    const pct = v != null && max > 0 ? Math.max(0, Math.min(100, (Math.abs(v) / max) * 100)) : 0;
    const countText = formatCount && r.count != null ? formatCount(r.count) : null;
    const body = (
      <>
        <span className="rl-label">
          <span className="rl-label__line">
            <span className={r.mono ? 'rl-label__text rl-label__text--mono' : 'rl-label__text'}>{r.label}</span>
            {countText && <span className="rl-count">{countText}</span>}
          </span>
          {r.meta && <span className="rl-meta">{r.meta}</span>}
        </span>
        {opts.muted && preserveOrder ? (
          <span className="rl-bar-note">{opts.muted}</span>
        ) : (
          <span className="rl-bar" aria-hidden="true">
            {!opts.muted && <span className="rl-bar__fill" style={{ width: `${pct}%` }} />}
          </span>
        )}
        <span className="rl-value">{v != null ? format(v) : ''}</span>
        {showShare && <span className="rl-share">{!opts.muted && v != null ? share(v) : ''}</span>}
      </>
    );
    const cls = `rl-row${opts.muted ? ' rl-row--muted' : ''}${showShare ? ' rl-row--share' : ''}${r.href ? ' rl-row--link' : ''}`;
    return (
      <li key={r.id}>
        {r.href ? (
          <Link to={r.href} className={cls} aria-label={`${labelOf(r)}: ${v != null ? format(v) : 'not recorded'}${countText ? `, ${countText}` : ''}`}>
            {body}
          </Link>
        ) : (
          <div className={cls}>{body}</div>
        )}
      </li>
    );
  };

  return (
    <div className="rl">
      {evidenced === 0 && <p className="rl-empty">{noRankedMessage ?? 'Not enough data to rank yet.'}</p>}
      {ranked.length > 0 && (evidenced > 0 || preserveOrder) && (
        <ol className="rl-list" aria-label={ariaLabel}>
          {visible.map(r => renderRow(r, isThin(r) ? { muted: thinLabel } : {}))}
        </ol>
      )}
      {hidden > 0 && (
        <button type="button" className="rl-more" onClick={() => setShowAll(true)}>
          Show all {ranked.length}
        </button>
      )}
      {showAll && ranked.length > topN && (
        <button type="button" className="rl-more" onClick={() => setShowAll(false)}>
          Show top {topN}
        </button>
      )}
      {unrankedCount > 0 && (
        <div className="rl-unranked">
          {ranked.length === 0 ? (
            <p className="rl-unranked__title">{groupSummary(thin.length, thinLabel, noValue.length, noValueLabel)}</p>
          ) : (
            <button
              type="button"
              className="rl-unranked__toggle"
              aria-expanded={showThin}
              aria-controls={thinId}
              onClick={() => setShowThin(s => !s)}
            >
              {groupSummary(thin.length, thinLabel, noValue.length, noValueLabel)}
            </button>
          )}
          {(showThin || ranked.length === 0) && (
            <ul id={thinId} className="rl-list rl-list--muted" aria-label={`${ariaLabel}, not ranked`}>
              {unrankedRows.map(({ row, reason, hideValue }) => renderRow(row, { muted: reason, hideValue }))}
            </ul>
          )}
          {(showThin || ranked.length === 0) && !showAllThin && unrankedCount > UNRANKED_PREVIEW && (
            <button type="button" className="rl-more" onClick={() => setShowAllThin(true)}>
              Show all {unrankedCount}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupSummary(thin: number, thinLabel: string, none: number, noneLabel: string) {
  const parts: string[] = [];
  if (thin > 0) parts.push(`${thinLabel} (${thin})`);
  if (none > 0) parts.push(`${noneLabel} (${none})`);
  return parts.join(' · ');
}
