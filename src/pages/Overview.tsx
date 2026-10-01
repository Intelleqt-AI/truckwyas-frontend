import { CAPITAL_LAUNCHED } from '@/lib/features';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import '@/components/data/stale-data-notice.css';
import './overview-typography.css';
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatMoney, formatMoneyWhole, formatPercent } from "@/lib/formatters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { CircleAlert, ArrowUpRight, TrendingUp, TrendingDown, Truck, FileText } from "lucide-react";
import { InfoTip } from "@/components/ui/InfoTip";
import SectionHeader from "@/components/layout/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { MicroBars, RevenueCostBars, PipelineBars, usePipeline, boardStage } from "@/components/overview/today";
import { presentSignal, staleSignal, idleSignal, isInTransitSignal, isIdleVehiclesSignal, idleVehiclesUrl } from "@/components/overview/signals";
import { isOpenLoad, staleWork } from "@/lib/staleWork";
import { HOME_LIVE, useAllQuotes, useAllVehicles, useHomeLedger } from "@/components/overview/ledger";

// Fetches + derives all dashboard data. Lives in the queryFn so the result is
// cached by TanStack Query (keyed below) and survives navigation — revisiting
// the page no longer refires these 8 requests until the cache goes stale.
// Home fires its GETs together with the full ledgers; a throttled (429) or
// dropped request is retried twice with a short back-off before the page says
// a figure couldn't load. GET only; the same endpoints as before.
async function getWithRetry(path: string, attempts = 3): Promise<any> {
  for (let i = 0; ; i++) {
    try {
      return await fetchData(path);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const transient = status == null || status === 429 || status >= 500;
      if (!transient || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

async function loadOverview() {
  // Each source may fail on its own; record which ones did so the page can
  // say so instead of presenting an empty fallback as a real zero.
  const failedSources: string[] = [];
  const track = <T,>(label: string, fallback: T) => (err: unknown): T => {
    failedSources.push(label);
    return fallback;
  };
  const [
    finance,
    insightsData,
    advancesData,
    quotesData,
    loadsData,
    activityData,
    vehiclesData,
    fleetData,
    eligibleData,
  ] = await Promise.all([
    getWithRetry("api/v1/dashboard/finance/").catch(track("revenue and margin", null)),
    getWithRetry("api/v1/dashboard/signals/").catch(() =>
      getWithRetry("api/v1/dashboard/insights/").catch(track("alerts", [])),
    ),
    getWithRetry("api/v1/advances/").catch(track("advances", [])),
    getWithRetry("api/v1/quotes/?limit=5").catch(track("recent quotes", [])),
    getWithRetry("api/v1/loads/").catch(track("loads", [])),
    getWithRetry("api/v1/activity/").catch(track("recent activity", [])),
    getWithRetry("api/v1/vehicles/").catch(track("vehicles", [])),
    getWithRetry("api/v1/fleet/overview/").catch(track("fleet utilisation", null)),
    // Invoices that qualify for a fast-pay advance but don't have one
    // requested yet: the actionable Capital opportunity on this page.
    getWithRetry("api/v1/capital/eligible/").catch(track("capital eligibility", null)),
  ]);

  if (failedSources.length >= 9) {
    throw new Error("Overview data is unavailable");
  }

  const insightsArr = Array.isArray(insightsData)
    ? insightsData
    : insightsData?.signals || [];
  const insights = insightsArr.map((s: any) => ({
    category: s.category || s.type || "Update",
    title: s.title || "",
    // The backend appends invented loss estimates (e.g. "Estimated revenue
    // loss: R 72,000/day") with no basis. Drop them until the backend stops.
    body: String(s.body || s.message || "")
      .replace(/\s*Estimated revenue loss:[^.]*\.?/gi, "")
      .trim(),
    action: s.action || "VIEW",
    actionUrl: typeof s.action_url === "string" && s.action_url.startsWith("/") ? s.action_url : null,
    severity: s.severity || "low",
    type: s.type || "INFO",
  }));

  const advances = Array.isArray(advancesData)
    ? advancesData
    : advancesData?.results || [];

  // The backend already excludes invoices that have an active AdvanceRequest
  // from this eligible list (see CapitalEligibleInvoicesView), so this and
  // pendingAdvancesCount below count disjoint invoices — safe to add together.
  const eligibleInvoicesCount = (eligibleData?.invoices || []).length;

  const quotes = quotesData?.results || quotesData || [];
  const recentQuotes = quotes.slice(0, 5);
  const quotesTotal: number | undefined = quotesData?.count;

  const loads = loadsData?.results || loadsData || [];
  // "Active" = anywhere in the open lifecycle (PENDING/ASSIGNED/LOADING/
  // IN_TRANSIT), not just physically moving — matches what the Bookings page
  // this tile links to actually shows as open orders. Excluding by terminal
  // status (rather than listing the active ones) means a new in-progress
  // status added later is counted by default instead of silently dropped.
  const TERMINAL_LOAD_STATUSES = ["DELIVERED", "INVOICED", "CANCELLED"];
  const activeLoadsCount = loads.filter(
    (l: any) => !TERMINAL_LOAD_STATUSES.includes(l.status),
  ).length;
  const recentLoads = loads.slice(0, 5);
  const loadsTotal: number | undefined = loadsData?.count;

  const vehicles = vehiclesData?.results || vehiclesData || [];
  // The list is paginated: use the server count, and only derive "available"
  // from the rows when the page holds the whole fleet.
  const totalVehicles: number = typeof vehiclesData?.count === "number" ? vehiclesData.count : vehicles.length;
  const vehiclesComplete = vehicles.length >= totalVehicles;
  const activeVehicles =
    fleetData?.active_vehicles ??
    vehicles.filter(
      (v: any) => ["AVAILABLE", "IN_USE", "ACTIVE"].includes(v.status),
    ).length;
  const availableVehicles = vehicles.filter((v: any) => v.status === "AVAILABLE").length;

  // Generate heatmap data from last 28 days of load activity
  const heatmapData = new Array(28).fill(0);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  loads.forEach((load: any) => {
    const createdAt = load.created_at || load.pickup_date;
    if (createdAt) {
      const loadTime = new Date(createdAt).getTime();
      const daysAgo = Math.floor((now - loadTime) / dayMs);
      if (daysAgo >= 0 && daysAgo < 28) {
        heatmapData[27 - daysAgo]++;
      }
    }
  });

  const activity = Array.isArray(activityData)
    ? activityData
    : activityData?.results || [];

  return {
    failedSources,
    financeData: finance,
    insights,
    advances,
    eligibleInvoicesCount,
    recentQuotes,
    recentLoads,
    activeLoadsCount,
    totalVehicles,
    activeVehicles,
    availableVehicles,
    vehiclesComplete,
    activity,
    heatmapData,
    // Full lists already fetched above, kept for the charts (no new requests).
    quotes,
    quotesTotal,
    loads,
    loadsTotal,
    vehicles,
  };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";

// Presentation-only helpers.
const shortPlace = (s?: string) =>
  (s || "").split(" ").slice(0, 2).join(" ").replace(/[,\s]+$/, "") || "—";
const isFastPaySignal = (i: any) => /fast\s*pay|advance/i.test(`${i.title} ${i.body}`);
const wholeRand = (v: number) => formatMoneyWhole(v);

function Delta({ value, unit, period }: { value: number; unit: "%" | "pts"; period: string }) {
  const up = value > 0;
  const flat = value === 0;
  const sign = up ? "+" : value < 0 ? "−" : "";
  const shown = unit === "%" ? `${sign}${formatPercent(Math.abs(value))}` : `${sign}${formatPercent(Math.abs(value)).replace("%", "")}\u00A0pts`;
  const Glyph = up ? TrendingUp : TrendingDown;
  return (
    <span className={`tw-delta ${flat ? "" : up ? "is-up" : "is-down"}`}>
      {!flat && <Glyph size={14} strokeWidth={2} aria-hidden="true" />}
      <span>{shown}</span>
      <span className="tw-delta__period">{period}</span>
    </span>
  );
}


export default function Overview() {
  const navigate = useNavigate();
  const [recentTab, setRecentTab] = useState<"quotes" | "loads">("quotes");

  const { data, isLoading: loading, refetch, dataUpdatedAt, isRefetchError, isError, isFetching } = useQuery({
    queryKey: ["overview-dashboard"],
    queryFn: loadOverview,
    ...HOME_LIVE,
  });
  const queryClient = useQueryClient();

  // Cached data drives the view; defaults keep the first render safe.
  const financeData = data?.financeData ?? null;
  const failed = data?.failedSources ?? [];
  // Fast Pay is not live: its signals (advance amounts, fees, payout times)
  // describe money that is not available, so they are not shown.
  const signals = (data?.insights ?? []).filter((i: any) => CAPITAL_LAUNCHED || !isFastPaySignal(i));
  const recentQuotes = data?.recentQuotes ?? [];
  const allQuotes: any[] = data?.quotes ?? [];
  const quotesTotal: number | undefined = data?.quotesTotal;
  const recentLoads = data?.recentLoads ?? [];
  const totalVehicles = data?.totalVehicles ?? 0;
  const availableVehicles = data?.availableVehicles ?? 0;
  // Money, loads and quotes come from the full ledgers the Reports use, so
  // Home agrees with Cash, P&L and Debtors (see components/overview/ledger.ts).
  const ledger = useHomeLedger();
  const money = ledger.money;
  const moneyLoading = ledger.loading;
  const moneyFailed = ledger.error;
  const quotesAll = useAllQuotes();
  const pipelineQuotes: any[] = quotesAll.data?.rows ?? allQuotes;
  const pipelineComplete = quotesAll.data ? quotesAll.data.complete : false;
  const allLoads: any[] = (ledger.data?.loads as any[] | undefined) ?? data?.loads ?? [];
  const pipeline = usePipeline(pipelineQuotes, allLoads);
  // Needs you: stale open loads come from the shared rule (src/lib/staleWork.ts),
  // the same count as Orders and Findings; the backend's "N loads in transit"
  // signal is replaced by that row. Everything else is the backend's signals.
  // Wait for the full loads ledger so the count never changes after paint.
  // The idle-vehicles row is computed here from every vehicle and load (the
  // Vehicles page's own sources and rule), never from the backend's plate list.
  const allVehicles = useAllVehicles();

  // ---- freshness: every query on Home counts, not just the overview ----
  // The notice reads the OLDEST figure on the page, and "Refresh now"
  // refetches everything the page shows (overview, ledgers, quotes, fleet),
  // so it can't clear while some tiles still show old numbers.
  const [refreshing, setRefreshing] = useState(false);
  const oldest = Math.min(...[dataUpdatedAt, ledger.oldestUpdatedAt, quotesAll.dataUpdatedAt, allVehicles.dataUpdatedAt]
    .map((t) => t || Infinity));
  const homeUpdatedAt = Number.isFinite(oldest) ? oldest : 0;
  const homeRefreshFailed = isRefetchError || ledger.refreshFailed || quotesAll.isRefetchError || allVehicles.isRefetchError;
  const homeFetching = isFetching || ledger.fetching || quotesAll.isFetching || allVehicles.isFetching;
  const refreshHome = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  };
  const vehiclesSettled = !!allVehicles.data || (allVehicles.isError && !allVehicles.isFetching);
  const needsLoading = loading || (!ledger.data && !ledger.error) || !vehiclesSettled;
  const stale = !needsLoading && allLoads.length ? staleSignal(allLoads) : null;
  const idle = !needsLoading && allVehicles.data && ledger.data ? idleSignal(allVehicles.data.rows, allLoads) : null;
  const needs: { row: ReturnType<typeof presentSignal>; actionUrl: string | null; severity: string }[] = [
    ...(stale ? [{ row: stale, actionUrl: stale.actionUrl, severity: "medium" }] : []),
    ...signals
      .filter((i: any) => !(stale && isInTransitSignal(i)))
      // Idle row: ours when the full fleet loaded (dropped if none are idle);
      // else the backend's count only, without its plate list.
      .flatMap((i: any) => {
        if (!isIdleVehiclesSignal(i)) return [{ row: presentSignal(i, allLoads), actionUrl: i.actionUrl as string | null, severity: String(i.severity || "low") }];
        if (allVehicles.data && ledger.data) return idle ? [{ row: idle as ReturnType<typeof presentSignal>, actionUrl: idle.actionUrl, severity: String(i.severity || "low") }] : [];
        return [{ row: { ...presentSignal(i, allLoads), detail: "" }, actionUrl: idleVehiclesUrl, severity: String(i.severity || "low") }];
      }),
  ];

  useEffect(() => {
    document.title = "Home - TruckWys";
  }, []);

  useAutoRefresh(refetch);

  const today = (() => {
    // Built from parts so every browser shows "Monday, 28 Sep 2026" (no "Sept").
    const parts = new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg", weekday: "long", year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("weekday")}, ${Number(get("day"))} ${MONTHS_SHORT[Number(get("month")) - 1] || ""} ${get("year")}`;
  })();

  // ---- Derived presentation values ----
  const monthLabel = (ym: string) => MONTHS_SHORT[Number(ym.slice(5, 7)) - 1] || ym;
  const trend = money?.months ?? [];
  const spanText = trend.length ? `${monthLabel(trend[0].ym)} ${trend[0].ym.slice(0, 4)} to ${monthLabel(trend[trend.length - 1].ym)} ${trend[trend.length - 1].ym.slice(0, 4)}` : "";
  const vehiclesFailed = failed.includes("vehicles") && !data?.totalVehicles;
  const outstanding = money?.owed ?? 0;
  const overdue = money?.pastDue ?? 0;
  const pastShare = outstanding > 0 ? Math.min(Math.max(overdue, 0), outstanding) / outstanding : 0;
  const receivedChange = money && money.receivedPrior != null && money.receivedPrior > 0.005
    ? ((money.received - money.receivedPrior) / money.receivedPrior) * 100 : null;
  const marginChange = money && money.margin != null && money.marginPrior != null ? money.margin - money.marginPrior : null;
  // Net after pending costs: revenue excl. VAT less approved and pending costs (Margin tab "With pending costs").
  const afterPending = money ? money.revenueExcl - money.costs - money.pending : 0;
  const marginDeltaText = marginChange != null && money && money.pending > 0.005
    ? `${marginChange >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(marginChange)).replace("%", "")} pts vs the prior 12 months` : "";

  // Active loads and the 28-day bars use every load (all pages), not page 1.
  // R7: "active" means open AND current. Open loads past their delivery date
  // or open more than 30 days (src/lib/staleWork.ts) are "left open": they
  // are counted beside the figure, never in it (the Needs you row lists them).
  // Wait for the full ledger so the figure never changes after paint.
  const loadsReady = !!ledger.data || !!ledger.error;
  const openLoads = allLoads.filter((l: any) => isOpenLoad(l));
  const notClosedCount = openLoads.filter((l: any) => staleWork(l)).length;
  const activeLoadsCount = openLoads.length - notClosedCount;
  const heatmapData: number[] = (() => {
    const out = new Array(28).fill(0);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    allLoads.forEach((load: any) => {
      const at = load.created_at || load.pickup_date;
      if (!at) return;
      const daysAgo = Math.floor((now - new Date(at).getTime()) / dayMs);
      if (daysAgo >= 0 && daysAgo < 28) out[27 - daysAgo]++;
    });
    return out;
  })();
  const loads28 = heatmapData.reduce((a, b) => a + b, 0);
  const loadsFailed = failed.includes("loads") && !ledger.data;

  const skeleton = <span className="ov-skel" aria-label="Loading" />;
  const unavailable = !moneyLoading && !money;

  return (
    <div className="overview-typography ov-page">
      {/* The shared page head: on phones "New quote" stays on the title row
          and the other two actions move into its "⋯" menu. */}
      <SectionHeader
        title="Home"
        description={today}
        actions={<>
          <button type="button" className="tw-btn" onClick={() => navigate("/finance/expenses")}>Add expense</button>
          <button type="button" className="tw-btn" onClick={() => navigate("/finance/invoices/new")}>Create invoice</button>
          <button type="button" className="tw-btn tw-btn--primary" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
        </>}
      />

      <div className="ov-notices">
        {/* An automatic refresh in progress isn't news; only a manual one is shown. */}
        {(refreshing || !homeFetching) && (
          <StaleDataNotice updatedAt={homeUpdatedAt} refreshFailed={homeRefreshFailed} refreshing={refreshing} onRetry={refreshHome} />
        )}
        {isError && !data && (
          <div className="stale-data-notice" role="alert">
            <span>The overview couldn't be loaded.</span>
            <button type="button" className="stale-data-notice__retry" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {!isRefetchError && failed.length > 0 && (
          <div className="stale-data-notice" role="status">
            <span>Some figures couldn't load: {failed.join(", ")}.</span>
            <button type="button" className="stale-data-notice__retry" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {moneyFailed && (
          <div className="stale-data-notice" role="status">
            <span>Invoices, payments or expenses couldn&rsquo;t load, so money figures are not shown.</span>
            <button type="button" className="stale-data-notice__retry" onClick={() => ledger.retry()}>
              Try again
            </button>
          </div>
        )}
        {money && money.partial.length > 0 && (
          <div className="stale-data-notice" role="status">
            <span>Figures use the {money.partial.join(", ")} that loaded.</span>
          </div>
        )}
      </div>

      {/* KPI tiles: label, big figure, one line. Money figures reconcile with Reports. */}
      <div className="td-kpis">
        {/* Emphasis tile: the money that needs chasing (= Debtors report, owed now). */}
        <section className="td-kpi td-kpi--emphasis" aria-label="Owed to you">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Owed to you
              <InfoTip>
                Balance on sent invoices not yet paid, incl. VAT, the same figure as the Debtors report. Past due means after the invoice due date.
                {financeData && outstanding > 0 && financeData.dso > 0 ? ` Customers take ${Math.round(financeData.dso)} days to pay, on average.` : ""}
              </InfoTip>
            </h2>
          </div>
          <div className="td-kpi__body">
            <div className="td-kpi__value" title={money ? formatMoney(outstanding) : undefined}>
              {moneyLoading ? skeleton : money ? wholeRand(outstanding) : "—"}
            </div>
            {money && pastShare > 0 && pastShare < 1 && (
              <div className="td-kpi__strip" role="img" aria-label={`${Math.round(pastShare * 100)}% of what you are owed is past due`}>
                <span style={{ width: `${pastShare * 100}%` }} />
              </div>
            )}
          </div>
          <div className="td-kpi__meta">
            {money ? (
              outstanding <= 0 ? <span>Nothing outstanding</span>
                : <span>{overdue >= outstanding - 0.005 ? "All past due" : overdue > 0 ? `${wholeRand(overdue)} past due` : "None past due"}</span>
            ) : unavailable ? <span>Unavailable</span> : null}
          </div>
        </section>

        <section className="td-kpi" aria-label="Revenue received, last 12 months">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              <span>Revenue<span className="td-hide-sm"> received</span>, 12 months</span>
              <InfoTip>Money received from customers in the last 12 months, incl. VAT, by payment date: the Cash report&rsquo;s money in for the same period.</InfoTip>
            </h2>
          </div>
          <div className="td-kpi__body">
            <div className="td-kpi__value" title={money ? formatMoney(money.received) : undefined}>
              {moneyLoading ? skeleton : money ? wholeRand(money.received) : "—"}
            </div>
          </div>
          <div className="td-kpi__meta">
            {money ? (
              receivedChange != null
                ? <><span>Incl. VAT · </span><Delta value={Math.round(receivedChange * 10) / 10} unit="%" period="vs prior 12 months" /></>
                : <span>Paid, incl. VAT</span>
            ) : unavailable ? <span>Unavailable</span> : null}
          </div>
        </section>

        <section className="td-kpi" aria-label="Net margin, last 12 months">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              <span><span className="td-hide-sm">Net margin</span><span className="td-show-sm">Margin</span>, 12 months</span>
              <InfoTip>Revenue received excl. VAT, minus approved expenses, as a share of that revenue. The same figure as the Profit and loss report, cash basis, last 12 months. Pending expenses are not deducted{money && money.pending > 0.005 ? `: ${money.pendingCount} (${wholeRand(money.pending)}) are waiting for approval, and approving them leaves ${wholeRand(afterPending)}` : ""}.{marginDeltaText ? ` ${marginDeltaText}.` : ""}</InfoTip>
            </h2>
          </div>
          <div className="td-kpi__body">
            <div className="td-kpi__value">
              {moneyLoading ? skeleton : money && money.margin != null ? formatPercent(money.margin) : "—"}
            </div>
            {/* The figure it becomes, read with the note under it: "−R 60 698 · if the R 87 129 pending is approved". */}
            {money && money.margin != null && money.pending > 0.005 && (
              <span className={`td-kpi__alt td-hide-sm${afterPending < 0 ? " is-loss" : ""}`}>{wholeRand(afterPending)}</span>
            )}
          </div>
          <div className="td-kpi__meta">
            {money ? (
              money.margin == null ? <span>No revenue yet</span>
                // R6: pending costs change the answer, so the tile says what it becomes (the Margin tab's rule).
                : money.pending > 0.005 ? (
                  <span className="td-kpi__if">
                    <span className={`td-show-sm${afterPending < 0 ? " is-loss" : ""}`}>{wholeRand(afterPending)} </span>if <span className="td-hide-sm">the </span>{wholeRand(money.pending)} pending is approved
                  </span>
                )
                : marginChange != null ? <Delta value={Math.round(marginChange * 10) / 10} unit="pts" period="vs prior 12 months" />
                  : <span>Excl. VAT, cash basis</span>
            ) : unavailable ? <span>Unavailable</span> : null}
          </div>
        </section>

        <section className="td-kpi" aria-label="Active loads">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Active loads
              <InfoTip align="end">
                Open loads that are on schedule: not past their delivery date and open 30 days or less. Loads past that are counted as left open, never as active; Needs you lists them. Bars show loads booked per day, last 28 days.
                {!loading && !vehiclesFailed && totalVehicles > 0 && data?.vehiclesComplete && ` ${availableVehicles} of ${totalVehicles} trucks are available now.`}
              </InfoTip>
            </h2>
            <Link to="/bookings/orders" className="td-kpi__go" aria-label="Open orders"><ArrowUpRight size={16} strokeWidth={1.75} /></Link>
          </div>
          <div className="td-kpi__body">
            <div className="td-kpi__value">{!loadsReady ? skeleton : loadsFailed ? "—" : activeLoadsCount}</div>
            <MicroBars values={heatmapData} ariaLabel={`Loads booked per day, last 28 days: ${loads28} in total`} />
          </div>
          <div className="td-kpi__meta">
            {/* "0 · 11 left open": the stale loads are said beside the figure,
                not in it. Phones keep the short form so the note never clips. */}
            {loadsReady && !loadsFailed && (notClosedCount > 0
              ? <span>{notClosedCount} left open<span className="td-hide-sm"> · {loads28 === 0 ? "none" : loads28} booked in 28 days</span></span>
              : <span>{loads28 === 0 ? "None booked" : `${loads28} booked`} in<span className="td-hide-sm"> the last</span> 28 days</span>)}
          </div>
        </section>
      </div>

      {/* Two independent columns so a tall card never leaves a gap beside a short one (§11.7). */}
      <div className="td-grid">
        <div className="td-col td-col--main">
        <section className="tw-card td-chart-card" aria-labelledby="td-chart-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="td-chart-title" className="tw-card__title">
                Revenue vs costs
                <InfoTip>
                  Revenue: money received in the month, excl. VAT (cash basis, as in the Profit and loss report). Costs: approved expenses dated in the month.
                  {money?.trimmed ? ` ${money.trimmed}` : ""}
                </InfoTip>
              </h2>
              <p className="tw-card__sub">
                {trend.length ? `Excl. VAT, cash basis, ${spanText}` : "Excl. VAT, cash basis"}
              </p>
            </div>
            <div className="td-legend" aria-hidden="true">
              <span><i className="td-legend__rev" />Revenue</span>
              <span><i className="td-legend__cost" />Costs</span>
            </div>
          </div>
          {moneyLoading ? (
            <div className="ov-skel-block" />
          ) : !money || trend.length === 0 || trend.every((m) => m.revenue === 0 && m.costs === 0) ? (
            <p className="td-empty">{money ? "No money in or out in the last 12 months." : moneyFailed ? "Figures couldn't load." : "No monthly figures yet."}</p>
          ) : (
            <RevenueCostBars
              months={trend.map((m) => ({
                label: monthLabel(m.ym),
                full: `${monthLabel(m.ym)} ${m.ym.slice(0, 4)}`,
                revenue: m.revenue,
                costs: m.costs,
              }))}
            />
          )}
        </section>

        <section className="tw-card tw-card--flush td-recent" aria-labelledby="td-recent-title">
          <div className="tw-card__head td-recent__head">
            <div className="tw-card__titles">
              <h2 id="td-recent-title" className="tw-card__title">Latest work</h2>
              <p className="tw-card__sub">Five most recent</p>
            </div>
            <div className="td-recent__tools">
              <div className="tw-seg" role="tablist" aria-label="Show">
                <button type="button" role="tab" aria-selected={recentTab === "quotes"} className={`tw-seg__opt${recentTab === "quotes" ? " is-active" : ""}`} onClick={() => setRecentTab("quotes")}>Quotes</button>
                <button type="button" role="tab" aria-selected={recentTab === "loads"} className={`tw-seg__opt${recentTab === "loads" ? " is-active" : ""}`} onClick={() => setRecentTab("loads")}>Loads</button>
              </div>
              <Link to={recentTab === "quotes" ? "/bookings/quotes" : "/bookings"} className="tw-btn tw-btn--ghost">View all</Link>
            </div>
          </div>
          {loading ? (
            <div className="ov-skel-block ov-skel-block--short td-recent__skel" />
          ) : recentTab === "quotes" ? (
            recentQuotes.length > 0 ? (
              <div className="ov-table-wrap">
                <table className="ov-table td-table">
                  <thead>
                    <tr>
                      <th scope="col">Quote</th>
                      <th scope="col" className="td-hide-sm">Customer</th>
                      <th scope="col" className="td-hide-sm">Route</th>
                      <th scope="col" className="num">Total</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuotes.map((quote: any) => (
                      <tr key={quote.id} onClick={() => navigate(`/bookings/quotes/${quote.id}`)}>
                        <td><Link className="ov-id" to={`/bookings/quotes/${quote.id}`} onClick={(e) => e.stopPropagation()}>{quote.quote_number}</Link><div className="td-sub">{quote.customer_name || "—"}</div></td>
                        <td className="td-ellipsis td-hide-sm">{quote.customer_name || "—"}</td>
                        <td className="ov-muted td-hide-sm">{shortPlace(quote.pickup_location)} to {shortPlace(quote.delivery_location)}</td>
                        <td className="num">{wholeRand(parseFloat(quote.total_amount || "0"))}</td>
                        <td><StatusChip status={boardStage(quote) === 'EXPIRED' ? 'EXPIRED' : quote.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="td-empty td-recent__empty">{failed.includes("recent quotes") ? "Quotes couldn't load." : "No quotes yet."}</p>
            )
          ) : recentLoads.length > 0 ? (
            <div className="ov-table-wrap">
              <table className="ov-table td-table">
                <thead>
                  <tr>
                    <th scope="col">Load</th>
                    <th scope="col" className="td-hide-sm">Customer</th>
                    <th scope="col" className="td-hide-sm">Route</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoads.map((load: any) => (
                    <tr key={load.id} onClick={() => navigate(`/bookings/${load.id}`)}>
                      <td><Link className="ov-id" to={`/bookings/${load.id}`} onClick={(e) => e.stopPropagation()}>{load.load_number || `LD-${load.id}`}</Link><div className="td-sub">{load.customer_name || load.customer?.company_name || "—"}</div></td>
                      <td className="td-ellipsis td-hide-sm">{load.customer_name || load.customer?.company_name || "—"}</td>
                      <td className="ov-muted td-hide-sm">
                        {shortPlace(load.pickup_location || load.origin)} to {shortPlace(load.delivery_location || load.destination)}
                      </td>
                      <td><StatusChip status={load.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="td-empty td-recent__empty">{failed.includes("loads") ? "Loads couldn't load." : "No loads yet."}</p>
          )}
        </section>
        </div>

        <div className="td-col td-side">
        <section className="tw-card td-needs" aria-labelledby="td-needs-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="td-needs-title" className="tw-card__title">Needs you</h2>
              <p className="tw-card__sub">Invoices, quotes and fleet</p>
            </div>
            {!needsLoading && needs.length > 0 && <span className="tw-chip">{needs.length}</span>}
          </div>
          {needsLoading ? (
            <div className="ov-skel-block ov-skel-block--short" />
          ) : needs.length > 0 ? (
            <ul className="td-needs__list">
              {needs.slice(0, 5).map(({ row, actionUrl, severity }, idx: number) => {
                const Icon = row.kind === "invoice" ? FileText : row.kind === "fleet" ? Truck : CircleAlert;
                return (
                  <li key={idx} className="td-needs__row">
                    <Icon className="td-needs__icon" size={16} strokeWidth={1.75} aria-hidden="true" />
                    <div className="td-needs__text">
                      {row.amount ? (
                        <div className="td-needs__line">
                          <div className="td-needs__title">{row.title}<span className="ov-sr-only"> owes</span></div>
                          <span className="td-needs__amount">{row.amount}</span>
                        </div>
                      ) : <div className="td-needs__title">{row.title}</div>}
                      {row.detail && <div className="td-needs__body" title={row.detailTitle || row.detail}>{row.detail}</div>}
                    </div>
                    {row.actionLabel && actionUrl && (
                      <Link to={actionUrl} className="tw-btn tw-btn--sm td-needs__action" aria-label={`${row.actionLabel}: ${row.title}`}>{row.actionLabel}</Link>
                    )}
                    <span className="ov-sr-only">{titleCase(severity)} priority</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="td-empty">
              <p>Nothing needs you right now.</p>
              <button type="button" className="tw-btn" onClick={() => navigate("/copilot")}>Ask Copilot</button>
            </div>
          )}
        </section>

          <section className="tw-card td-pipe-card" aria-labelledby="td-pipe-title">
            <div className="tw-card__head">
              <div className="tw-card__titles">
                <h2 id="td-pipe-title" className="tw-card__title">
                  Quote pipeline
                  <InfoTip align="end">Draft, Sent, Accepted, Declined and Expired are the Quotes board columns (a quote marked lost counts as Declined; a draft or sent quote past its valid-until date is Expired and not counted as live). On the road counts in-transit loads still on schedule; in-transit loads past their delivery date are said under that row as left open. Win rate is accepted as a share of every quote sent{pipeline.sentEver > 0 ? `: ${pipeline.accepted} of ${pipeline.sentEver}` : ""}.</InfoTip>
                </h2>
                <p className="tw-card__sub">
                  {quotesAll.isLoading && loading ? "Quotes by stage"
                    : pipelineComplete ? `All ${pipelineQuotes.length} quotes`
                      : quotesTotal != null && quotesTotal > pipelineQuotes.length ? `Latest ${pipelineQuotes.length} of ${quotesTotal} quotes`
                        : `All ${pipelineQuotes.length} quotes`}
                </p>
              </div>
              <Link to="/bookings/quotes" className="td-kpi__go" aria-label="Open quotes"><ArrowUpRight size={16} strokeWidth={1.75} /></Link>
            </div>
            {loading && quotesAll.isLoading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : pipelineQuotes.length === 0 ? (
              <div className="td-empty">
                <p>{failed.includes("recent quotes") ? "Quotes couldn't load." : "No quotes yet."}</p>
                <button type="button" className="tw-btn" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
              </div>
            ) : (
              <>
                <PipelineBars stages={pipeline.stages} />
                {/* One fact once: the rate. The counts behind it ("6 of 9") are in the card's tip. */}
                <dl className="td-stats td-stats--one">
                  <div><dt>Win rate</dt><dd>{pipeline.winRate != null ? formatPercent(pipeline.winRate, 0) : "—"}</dd></div>
                </dl>
              </>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
