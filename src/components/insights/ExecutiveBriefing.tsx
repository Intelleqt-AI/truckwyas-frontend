import './executive-briefing.css';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

/* Executive briefing — presentation of GET /api/v1/dashboard/briefing/.
   Every number shown comes straight from the response; nothing is recalculated.
   The narrative is kept, but only inside the "Full summary" disclosure. */

export interface BriefingRecommendation {
  type: string;
  severity?: string;
  title: string;
  detail?: string | null;
}

export interface BriefingMetrics {
  company_name?: string;
  period?: { from?: string; to?: string };
  invoice_count?: number;
  invoices_issued_in_period?: number;
  loads_delivered_in_period?: number;
  quotes_in_period?: number;
  revenue_collected?: number;
  expenses_period?: number;
  net_margin?: number;
  net_margin_pct?: number;
  outstanding_total?: number;
  overdue_total?: number;
  top_recommendations?: BriefingRecommendation[];
}

export interface BriefingResponse {
  narrative?: string;
  source?: string;
  ai_available?: boolean;
  metrics?: BriefingMetrics;
}

/** Richer recommendation rows from /dashboard/insights/ (already loaded by the
 *  Briefing tab). Used only to resolve links and invoice details by title. */
export interface RecommendationDetail {
  type: string;
  severity?: string;
  title: string;
  message?: string;
  customer_name?: string;
  invoice_id?: number;
  invoice_number?: string;
  amount?: number;
  days_overdue?: number;
  link?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseIso = (iso?: string) => {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};

export const formatDay = (iso?: string, withYear = true) => {
  const p = parseIso(iso);
  if (!p) return iso || '';
  return `${p.d} ${MONTHS[p.m]}${withYear ? ` ${p.y}` : ''}`;
};

export const formatPeriod = (from?: string, to?: string) => {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return [from, to].filter(Boolean).join(' – ');
  if (a.y === b.y && a.m === b.m && a.d === b.d) return formatDay(to);
  return `${formatDay(from, a.y !== b.y)} – ${formatDay(to)}`;
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const money = (v: unknown) => (isNum(v) ? formatCurrency(v) : '—');

const sentence = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

type Tone = 'danger' | 'warning' | 'neutral';

const severityTone = (severity?: string): Tone => {
  const s = (severity || '').toUpperCase();
  if (s === 'HIGH' || s === 'CRITICAL') return 'danger';
  if (s === 'MEDIUM') return 'warning';
  return 'neutral';
};
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Plural-aware group heading for a recommendation type. */
const groupHeading = (type: string, count: number) => {
  const t = type.toUpperCase();
  if (t === 'OVERDUE_ALERT') return `${count} overdue ${count === 1 ? 'invoice' : 'invoices'}`;
  return count > 1 ? `${sentence(type)} (${count})` : sentence(type);
};

/** Strip the "Invoice Overdue: " style prefix so the row shows the identifier. */
const rowSubject = (title: string) => {
  const i = title.indexOf(': ');
  return i >= 0 ? title.slice(i + 2) : title;
};
const looksLikeIdentifier = (s: string) => /^[A-Z]{2,5}-[\w-]+$/.test(s);

export function SeverityChip({ severity }: { severity?: string }) {
  const tone = severityTone(severity);
  return (
    <span className={`eb-chip eb-chip--${tone}`}>
      {severity ? sentence(severity) : 'Info'}
      <span className="eb-sr"> priority</span>
    </span>
  );
}

interface Group {
  type: string;
  severity?: string;
  rows: Array<BriefingRecommendation & { detailRow?: RecommendationDetail }>;
}

const buildGroups = (recs: BriefingRecommendation[], details: RecommendationDetail[]): Group[] => {
  const byTitle = new Map(details.map(d => [d.title, d]));
  const groups = new Map<string, Group>();
  recs.forEach(r => {
    const g = groups.get(r.type) || { type: r.type, severity: r.severity, rows: [] };
    if ((SEVERITY_RANK[(r.severity || '').toUpperCase()] || 0) > (SEVERITY_RANK[(g.severity || '').toUpperCase()] || 0)) g.severity = r.severity;
    g.rows.push({ ...r, detailRow: byTitle.get(r.title) });
    groups.set(r.type, g);
  });
  return [...groups.values()].sort(
    (a, b) => (SEVERITY_RANK[(b.severity || '').toUpperCase()] || 0) - (SEVERITY_RANK[(a.severity || '').toUpperCase()] || 0),
  );
};

/** Grouped recommendation list — shared by the briefing and the full list. */
export function RecommendationGroups({
  recommendations,
  details = [],
  initialRows = Infinity,
  headingLevel = 3,
}: {
  recommendations: BriefingRecommendation[];
  details?: RecommendationDetail[];
  initialRows?: number;
  headingLevel?: 3 | 4;
}) {
  const groups = useMemo(() => buildGroups(recommendations, details), [recommendations, details]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const Heading = headingLevel === 3 ? 'h3' : 'h4';

  return (
    <div className="eb-groups">
      {groups.map(g => {
        const isInvoice = g.type.toUpperCase() === 'OVERDUE_ALERT';
        const showAll = expanded[g.type] || g.rows.length <= initialRows;
        const rows = showAll ? g.rows : g.rows.slice(0, initialRows);
        const headingId = `eb-group-${g.type}-${headingLevel}`;
        return (
          <section key={g.type} className="eb-group" aria-labelledby={headingId}>
            <div className="eb-group__head">
              <Heading id={headingId} className="eb-group__title">{groupHeading(g.type, g.rows.length)}</Heading>
              <SeverityChip severity={g.severity} />
            </div>
            <ul className="eb-rows">
              {rows.map((r, i) => {
                const d = r.detailRow;
                const subject = d?.invoice_number || rowSubject(r.title);
                const href = d?.link || (d?.invoice_id ? `/finance/invoices/${d.invoice_id}` : isInvoice ? '/finance/invoices' : undefined);
                const meta = [d?.customer_name, isNum(d?.days_overdue) ? `${d!.days_overdue} days overdue` : null, r.detail]
                  .filter(Boolean)
                  .join(' · ') || d?.message || '';
                const content = (
                  <>
                    <span className="eb-row__main">
                      <span className="eb-row__line">
                        <span className={looksLikeIdentifier(subject) ? 'eb-row__id' : 'eb-row__subject'}>{subject}</span>
                        {isNum(d?.amount) && <span className="eb-row__amount">{formatCurrency(d!.amount)}</span>}
                      </span>
                      {meta && <span className="eb-row__meta">{meta}</span>}
                    </span>
                    {href && <ChevronRight className="eb-row__chevron" size={16} aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={`${r.title}-${i}`}>
                    {href ? (
                      <Link
                        to={href}
                        className="eb-row eb-row--link"
                        aria-label={`Open ${isInvoice ? 'invoice ' : ''}${subject}${d?.customer_name ? ` for ${d.customer_name}` : ''}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="eb-row">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {(!showAll || isInvoice) && (
              <div className="eb-group__foot">
                {!showAll && (
                  <button type="button" className="eb-text-button" onClick={() => setExpanded(e => ({ ...e, [g.type]: true }))}>
                    Show all {g.rows.length}
                  </button>
                )}
                {isInvoice && (
                  <Link to="/finance/invoices" className="eb-text-button">
                    Go to invoices
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' | 'warning' }) {
  return (
    <div className="eb-metric">
      <dt className="eb-metric__label">{label}</dt>
      <dd className={`eb-metric__value${tone ? ` eb-metric__value--${tone}` : ''}`}>{value}</dd>
      {sub && <dd className="eb-metric__sub">{sub}</dd>}
    </div>
  );
}

export default function ExecutiveBriefing({
  data,
  isLoading,
  isError,
  onRetry,
  details = [],
  onShowLongerPeriod,
}: {
  data: BriefingResponse | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  details?: RecommendationDetail[];
  onShowLongerPeriod?: () => void;
}) {
  const header = (periodLabel?: string, company?: string, ai?: boolean) => (
    <header className="eb-header">
      <div className="eb-header__text">
        <h2 id="eb-title" className="eb-title">Executive briefing</h2>
        {(periodLabel || company) && (
          <p className="eb-period">{[periodLabel, company].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {ai && <span className="eb-chip eb-chip--accent">AI summary</span>}
    </header>
  );

  if (isLoading) {
    return (
      <section className="card eb-card" aria-labelledby="eb-title" aria-busy="true">
        {header()}
        <p className="eb-sr" role="status">Loading executive briefing</p>
        <div className="eb-skeleton-row" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="eb-skeleton eb-skeleton--metric" />)}
        </div>
        <div className="eb-skeleton eb-skeleton--list" aria-hidden="true" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card eb-card" aria-labelledby="eb-title">
        {header()}
        <div className="eb-state" role="alert">
          <p className="eb-state__title">The executive briefing couldn't be loaded.</p>
          <p className="eb-state__body">Your data is unchanged. Check your connection and try again.</p>
          <button type="button" className="btn-action eb-retry" onClick={onRetry}>Retry loading</button>
        </div>
      </section>
    );
  }

  const m = data?.metrics;
  if (!data || (!m && !data.narrative)) {
    return (
      <section className="card eb-card" aria-labelledby="eb-title">
        {header()}
        <div className="eb-state">
          <p className="eb-state__title">No briefing is available for this period.</p>
          <p className="eb-state__body">Choose a different period above to see collections, costs and what needs attention.</p>
        </div>
      </section>
    );
  }

  const ai = data.ai_available === true && data.source !== 'rules';
  const periodLabel = m?.period ? formatPeriod(m.period.from, m.period.to) : undefined;
  const asOf = m?.period?.to ? formatDay(m.period.to) : undefined;

  // Metrics missing (older backend): fall back to the narrative, clearly labelled.
  if (!m) {
    return (
      <section className="card eb-card" aria-labelledby="eb-title">
        {header(undefined, undefined, ai)}
        <p className="eb-narrative">{data.narrative}</p>
      </section>
    );
  }

  const issued = m.invoices_issued_in_period ?? 0;
  const delivered = m.loads_delivered_in_period ?? 0;
  const quotes = m.quotes_in_period ?? 0;
  const noActivity =
    issued === 0 && delivered === 0 && quotes === 0 && !(m.revenue_collected) && !(m.expenses_period);
  const overdue = m.overdue_total ?? 0;
  const margin = m.net_margin;
  const recs = m.top_recommendations || [];

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <section className="card eb-card" aria-labelledby="eb-title">
      {header(periodLabel, m.company_name, ai)}

      <div className="eb-metrics">
        <div className="eb-metric-group" aria-labelledby="eb-period-heading">
          <h3 id="eb-period-heading" className="eb-group-label">This period</h3>
          {noActivity ? (
            <div className="eb-empty">
              <p className="eb-empty__title">No invoices issued, loads delivered or quotes in this period.</p>
              <p className="eb-empty__body">Collected {money(m.revenue_collected)} · Costs {money(m.expenses_period)}</p>
              {onShowLongerPeriod && (
                <button type="button" className="eb-text-button eb-text-button--inline" onClick={onShowLongerPeriod}>
                  Show the last 3 months
                </button>
              )}
            </div>
          ) : (
            <>
              <dl className="eb-metric-row eb-metric-row--3">
                <Metric label="Collected" value={money(m.revenue_collected)} />
                <Metric label="Costs" value={money(m.expenses_period)} />
                <Metric
                  label="Net margin"
                  value={money(margin)}
                  sub={isNum(m.net_margin_pct) ? `${m.net_margin_pct.toFixed(1)}% of collected` : undefined}
                  tone={isNum(margin) && margin < 0 ? 'danger' : undefined}
                />
              </dl>
              <p className="eb-activity">
                {plural(issued, 'invoice', 'invoices')} issued · {plural(delivered, 'load', 'loads')} delivered · {plural(quotes, 'quote', 'quotes')}
              </p>
            </>
          )}
        </div>

        <div className="eb-metric-group" aria-labelledby="eb-asof-heading">
          <h3 id="eb-asof-heading" className="eb-group-label">{asOf ? `Receivables as of ${asOf}` : 'Receivables'}</h3>
          <dl className="eb-metric-row eb-metric-row--2">
            <Metric
              label="Outstanding"
              value={money(m.outstanding_total)}
              sub={isNum(m.invoice_count) ? `Across ${plural(m.invoice_count, 'invoice', 'invoices')}` : undefined}
            />
            <Metric
              label="Overdue"
              value={money(m.overdue_total)}
              sub={overdue > 0 ? 'Past due date' : 'Nothing overdue'}
              tone={overdue > 0 ? 'danger' : undefined}
            />
          </dl>
        </div>
      </div>

      <div className="eb-attention" aria-labelledby="eb-attention-heading">
        <h3 id="eb-attention-heading" className="eb-section-title">Needs attention</h3>
        {recs.length > 0 ? (
          <RecommendationGroups recommendations={recs} details={details} headingLevel={4} />
        ) : (
          <p className="eb-state__body">Nothing needs attention right now.</p>
        )}
      </div>

      {data.narrative && (
        <details className="eb-details">
          <summary>Full summary</summary>
          <p className="eb-narrative">{data.narrative}</p>
          {!ai && <p className="eb-footnote">Written from your records by fixed rules, not by AI.</p>}
        </details>
      )}
    </section>
  );
}
