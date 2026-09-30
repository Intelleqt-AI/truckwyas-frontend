import '@/pages/admin/admin-brand.css';
import '@/pages/admin/ai-admin.css';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { KpiStats } from '@/components/ui/KpiTile';
import { InfoTip } from '@/components/ui/InfoTip';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate, formatDateTime, formatMoney, formatMoneyWhole, formatNumber, MISSING } from '@/lib/formatters';

// OpenAI cost of the quote price check only (not a platform-wide LLM-cost
// dashboard: Copilot chat and the other LLM call sites don't track cost yet).
// Backend shapes supported:
//  - per-check (PR #113): every quote check was a paid web search, so the
//    panel shows checks, cost per user and failed runs;
//  - stored figures (backend PR #114): quote checks compare with stored
//    figures and cost nothing; the only spend is the monthly refresh job's
//    lookups. The response adds `by_trigger`:
//    {check|refresh|auto|manual: {calls, total_cost_usd}} (all time), where
//    auto/manual are the older paid web-search checks, kept as history;
//  - `refresh_jobs` (an earlier guess at the redesign) still renders if sent.

// Rand figures are estimates. The backend may send its own rate; otherwise a
// fixed planning rate is used, and the tip says so.
const PLANNING_USD_ZAR = 18;

interface Totals {
  calls?: number; success_calls?: number; failed_calls?: number; total_cost_usd: number; total_tokens?: number;
  refresh_runs?: number;
}
interface ByUserRow {
  user_id: number; name: string; email: string; company_id: number | null; company_name: string | null;
  calls: number; total_cost_usd: number;
}
interface RecentFailure {
  id: number; created_at: string; quote_id: number | null; failed_at_call: string; error_message: string; triggered_by__username: string | null;
}
interface MonthRow { month: string; total_calls?: number; runs?: number; total_cost_usd: number; }
interface RefreshJob {
  id: number; started_at?: string | null; ran_at?: string | null; finished_at?: string | null; status?: string | null;
  total_cost_usd?: number | null; cost_usd?: number | null;
  figures_checked?: number | null; items_checked?: number | null;
  proposals?: number | null; proposed_updates?: number | null;
}
interface TriggerTotals { calls: number; total_cost_usd: number; }
type Trigger = 'check' | 'refresh' | 'auto' | 'manual';
interface AiUsageResponse {
  all_time: Totals; this_month: Totals;
  by_trigger?: Partial<Record<Trigger | string, TriggerTotals>>;
  by_month?: MonthRow[];
  by_user?: ByUserRow[];
  recent_failures?: RecentFailure[];
  refresh_jobs?: RefreshJob[];
  usd_zar_rate?: number | null;
}

const count = (n?: number | null) => formatNumber(n ?? 0, { maximumFractionDigits: 0 });
// US$ at 2 dp everywhere (4 dp in the tooltip), rand whole.
const usd = (n?: number | null) => `US$\u00A0${formatNumber(n ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdExact = (n?: number | null) => `US$ ${formatNumber(n ?? 0, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const monthLabel = (m: string) => formatDate(`${m}-01`, { day: undefined });
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

function UsdCell({ value, rate }: { value?: number | null; rate: number }) {
  return (
    <td className="num" title={usdExact(value)}>
      {usd(value)}
      <span className="aiu-zar">≈ {formatMoneyWhole((value ?? 0) * rate)}</span>
    </td>
  );
}

export default function AiUsagePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<AiUsageResponse>({
    queryKey: ['admin-ai-usage'],
    queryFn: () => fetchData('api/v1/admin/ai-usage/'),
    refetchInterval: 60_000,
    retry: 1,
  });

  const rate = Number(data?.usd_zar_rate) > 0 ? Number(data!.usd_zar_rate) : PLANNING_USD_ZAR;
  const rateNote = Number(data?.usd_zar_rate) > 0
    ? `Rand figures use the server's rate of ${formatNumber(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per US$.`
    : `Rand figures are estimates at R ${formatNumber(rate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per US$, a fixed planning rate, not a live exchange rate.`;
  const jobs = data?.refresh_jobs ?? [];
  const hasJobs = Array.isArray(data?.refresh_jobs);
  const byTrigger = data?.by_trigger && typeof data.by_trigger === 'object' ? data.by_trigger : null;
  const trig = (k: Trigger): TriggerTotals => ({ calls: byTrigger?.[k]?.calls ?? 0, total_cost_usd: byTrigger?.[k]?.total_cost_usd ?? 0 });
  // Stored-figure backend: by_trigger (PR #114), or the older refresh_jobs guess.
  const storedModel = !!byTrigger || hasJobs;
  const legacy = { calls: trig('auto').calls + trig('manual').calls, total_cost_usd: trig('auto').total_cost_usd + trig('manual').total_cost_usd };
  const triggerRows = byTrigger ? [
    { key: 'check', label: 'Price checks on quotes', note: 'Stored figures, no OpenAI call', ...trig('check') },
    { key: 'refresh', label: 'Rate refresh lookups', note: 'Monthly job, web search', ...trig('refresh') },
    ...(legacy.calls > 0 ? [{ key: 'legacy', label: 'Older web-search checks', note: 'Before stored figures, history', ...legacy }] : []),
  ] : [];
  const byUser = [...(data?.by_user ?? [])].filter((r) => r.calls > 0).sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  const failures = data?.recent_failures ?? [];
  const months = [...(data?.by_month ?? [])].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

  const totalsNote = (t?: Totals) => {
    if (!t) return '';
    const zar = `≈ ${formatMoneyWhole(t.total_cost_usd * rate)}`;
    if (hasJobs && !byTrigger) return `${zar} · ${plural(t.refresh_runs ?? 0, 'refresh run')}`;
    if (byTrigger) return `${zar} · ${plural(t.calls ?? 0, 'run')}${t.failed_calls ? ` · ${count(t.failed_calls)} failed` : ''}`;
    return `${zar} · ${plural(t.calls ?? 0, 'check')}${t.failed_calls ? ` · ${count(t.failed_calls)} failed` : ''}`;
  };
  const perCheck = !storedModel && data && (data.all_time.calls ?? 0) > 0
    ? data.all_time.total_cost_usd / (data.all_time.calls ?? 1) : null;

  const tip = (
    <InfoTip label="What this counts">
      OpenAI cost of the quote price check only. {storedModel
        ? 'Price checks on quotes compare with stored figures and cost nothing. The spend is the monthly job that re-checks toll tariffs and the driver allowance on their source pages. Runs count both.'
        : 'Every price check on a quote runs a paid web search.'} Copilot chat and other AI features aren't tracked here yet. {rateNote}
    </InfoTip>
  );

  if (isError) {
    return (
      <section className="tw-card aiu-error" aria-labelledby="aiu-error-title">
        <div className="tw-card__head">
          <div className="tw-card__titles">
            <h2 id="aiu-error-title" className="tw-card__title">AI price check cost</h2>
          </div>
        </div>
        <p className="aiu-line">
          <span className="aiu-line__strong">Couldn't load usage.</span> Nothing is lost. Try again in a moment.
        </p>
        <button type="button" className="tw-btn aiu-retry" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </section>
    );
  }

  const skel = <span className="aiu-skel" aria-hidden="true" />;
  const statItems = [
    {
      label: 'This month', aside: tip,
      figure: data ? <span title={usdExact(data.this_month.total_cost_usd)}>{usd(data.this_month.total_cost_usd)}</span> : skel,
      note: data ? totalsNote(data.this_month) : <span className="aiu-skel aiu-skel--note" aria-hidden="true" />,
    },
    {
      label: 'All time',
      figure: data ? <span title={usdExact(data.all_time.total_cost_usd)}>{usd(data.all_time.total_cost_usd)}</span> : skel,
      note: data ? totalsNote(data.all_time) : <span className="aiu-skel aiu-skel--note" aria-hidden="true" />,
    },
    ...(perCheck != null ? [{
      label: 'Per check',
      figure: <span title={usdExact(perCheck)}>{usd(perCheck)}</span>,
      note: `≈ ${formatMoney(perCheck * rate)} on average`,
    }] : []),
  ];

  return (
    <div className="aiu" aria-busy={isLoading || undefined}>
      {/* The stats line and the checks-vs-refresh split answer the same
          question (what did it cost), so they share a row on wide screens. */}
      <div className={byTrigger ? 'aiu-top' : undefined}>
        <KpiStats title="AI price check cost" aria-label="AI price check cost" items={statItems} />
        {byTrigger && (
        <section className="tw-card" aria-labelledby="aiu-trig-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="aiu-trig-title" className="tw-card__title">Checks vs refresh</h2>
              <p className="tw-card__sub">All time, what each kind of run cost</p>
            </div>
          </div>
          <table className="admin-table aiu-table">
            <thead>
              <tr><th scope="col">Run</th><th scope="col" className="num">Runs</th><th scope="col" className="num">Cost</th></tr>
            </thead>
            <tbody>
              {triggerRows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}<span className="aiu-sub">{r.note}</span></td>
                  <td className="num">{count(r.calls)}</td>
                  <UsdCell value={r.total_cost_usd} rate={rate} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        )}
      </div>

      {(isLoading || months.length > 0) && (
        <section className="tw-card" aria-labelledby="aiu-months-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="aiu-months-title" className="tw-card__title">By month</h2>
              <p className="tw-card__sub">Last 12 months, US$ with a rand estimate</p>
            </div>
          </div>
          <table className="admin-table aiu-table">
            <thead>
              <tr><th scope="col">Month</th><th scope="col" className="num">{byTrigger ? 'Runs' : hasJobs ? 'Refresh runs' : 'Checks'}</th><th scope="col" className="num">Cost</th></tr>
            </thead>
            <tbody>
              {isLoading && [0, 1, 2].map((i) => (
                <tr key={i} aria-hidden="true"><td>{skel}</td><td className="num">{skel}</td><td className="num">{skel}</td></tr>
              ))}
              {months.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td className="num">{count(m.runs ?? m.total_calls)}</td>
                  <UsdCell value={m.total_cost_usd} rate={rate} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hasJobs && (
        <section className="tw-card" aria-labelledby="aiu-jobs-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="aiu-jobs-title" className="tw-card__title">Monthly rate refresh</h2>
              <p className="tw-card__sub">Runs that re-check tolls and allowances</p>
            </div>
          </div>
          {jobs.length === 0 ? (
            <p className="aiu-line">No refresh has run yet.</p>
          ) : (
            <table className="admin-table aiu-table">
              <thead>
                <tr>
                  <th scope="col">Ran</th>
                  <th scope="col" className="aiu-col-wide">Status</th>
                  <th scope="col" className="num aiu-col-wide">Checked</th>
                  <th scope="col" className="num">Updates</th>
                  <th scope="col" className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const when = j.ran_at || j.started_at;
                  const status = (j.status || '').toLowerCase();
                  const tone = status === 'failed' ? 'danger' : status === 'running' ? 'info' : 'success';
                  return (
                    <tr key={j.id}>
                      <td>
                        {when ? formatDate(when) : MISSING}
                        <span className="aiu-sub aiu-phone-only">{status ? `${status[0].toUpperCase()}${status.slice(1)}` : ''}</span>
                      </td>
                      <td className="aiu-col-wide">{status ? <StatusChip tone={tone} label={`${status[0].toUpperCase()}${status.slice(1)}`} /> : MISSING}</td>
                      <td className="num aiu-col-wide">{count(j.figures_checked ?? j.items_checked)}</td>
                      <td className="num">{count(j.proposals ?? j.proposed_updates)}</td>
                      <UsdCell value={j.total_cost_usd ?? j.cost_usd} rate={rate} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {(!storedModel ? (isLoading || byUser.length > 0 || data) : byUser.length > 0) && (
        <section className="tw-card" aria-labelledby="aiu-users-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="aiu-users-title" className="tw-card__title">By user</h2>
              <p className="tw-card__sub">{byTrigger ? 'All time, runs they started' : 'All time, most spend first'}</p>
            </div>
          </div>
          {!isLoading && byUser.length === 0 ? (
            <p className="aiu-line">No price checks yet.</p>
          ) : (
            <table className="admin-table aiu-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="aiu-col-wide">Company</th>
                  <th scope="col" className="num">{byTrigger ? 'Runs' : 'Checks'}</th>
                  <th scope="col" className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [0, 1, 2].map((i) => (
                  <tr key={i} aria-hidden="true"><td>{skel}</td><td className="aiu-col-wide">{skel}</td><td className="num">{skel}</td><td className="num">{skel}</td></tr>
                ))}
                {byUser.map((row) => (
                  <tr key={row.user_id}>
                    <td>
                      {row.name || row.email}
                      <span className="aiu-sub">{row.email}</span>
                      <span className="aiu-sub aiu-phone-only">{row.company_name || 'No company'}</span>
                    </td>
                    <td className="aiu-col-wide">{row.company_name || MISSING}</td>
                    <td className="num">{count(row.calls)}</td>
                    <UsdCell value={row.total_cost_usd} rate={rate} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {failures.length > 0 && (
        <section className="tw-card" aria-labelledby="aiu-fail-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="aiu-fail-title" className="tw-card__title">Recent failures</h2>
              <p className="tw-card__sub">Raw error text, for platform admins</p>
            </div>
          </div>
          <table className="admin-table aiu-table aiu-table--fail">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col" className="aiu-col-wide">Stage</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id}>
                  <td className="aiu-nowrap">
                    {formatDateTime(f.created_at)}
                    <span className="aiu-sub">{[f.triggered_by__username, f.quote_id ? `quote ${f.quote_id}` : null].filter(Boolean).join(' · ') || MISSING}</span>
                    <span className="aiu-sub aiu-phone-only">{f.failed_at_call || MISSING}</span>
                  </td>
                  <td className="aiu-col-wide">{f.failed_at_call || MISSING}</td>
                  <td className="aiu-error-text">{f.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
