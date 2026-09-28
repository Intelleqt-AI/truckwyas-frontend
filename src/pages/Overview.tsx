import { CAPITAL_LAUNCHED } from '@/lib/features';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import '@/components/data/stale-data-notice.css';
import './overview-typography.css';
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { CircleAlert, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { InfoTip } from "@/components/ui/InfoTip";
import { MicroBars, RevenueCostBars, PipelineBars, usePipeline } from "@/components/overview/today";

// Fetches + derives all dashboard data. Lives in the queryFn so the result is
// cached by TanStack Query (keyed below) and survives navigation — revisiting
// the page no longer refires these 8 requests until the cache goes stale.
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
    fetchData("api/v1/dashboard/finance/").catch(track("revenue and margin", null)),
    fetchData("api/v1/dashboard/signals/").catch(() =>
      fetchData("api/v1/dashboard/insights/").catch(track("alerts", [])),
    ),
    fetchData("api/v1/advances/").catch(track("advances", [])),
    fetchData("api/v1/quotes/?limit=5").catch(track("recent quotes", [])),
    fetchData("api/v1/loads/").catch(track("loads", [])),
    fetchData("api/v1/activity/").catch(track("recent activity", [])),
    fetchData("api/v1/vehicles/").catch(track("vehicles", [])),
    fetchData("api/v1/fleet/overview/").catch(track("fleet utilisation", null)),
    // Invoices that qualify for a fast-pay advance but don't have one
    // requested yet: the actionable Capital opportunity on this page.
    fetchData("api/v1/capital/eligible/").catch(track("capital eligibility", null)),
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
  const totalVehicles = vehicles.length;
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

const CARD_MENUS: Record<string, { label: string; route: string }[]> = {
  revenue: [
    { label: "View revenue report", route: "/finance/reports" },
    { label: "View all invoices",   route: "/finance/invoices" },
    { label: "New invoice",         route: "/finance/invoices/new" },
  ],
  margin: [
    { label: "View finance reports", route: "/finance/reports" },
    { label: "View expenses",        route: "/finance/expenses" },
  ],
  outstanding: [
    { label: "View outstanding invoices", route: "/finance/invoices?status=OVERDUE" },
    { label: "View all invoices",         route: "/finance/invoices" },
    { label: CAPITAL_LAUNCHED ? "Request capital advance" : "See Fast Pay (not live yet)", route: "/capital" },
  ],
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";

// Accessible KPI "more" menu: a named 40px button with real menu items.
function KpiMenu({
  id, label, openMenu, setOpenMenu, minWidth, onGo,
}: {
  id: string;
  label: string;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  minWidth: number;
  onGo: (route: string) => void;
}) {
  const open = openMenu === id;
  return (
    <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="overview-kpi-menu-trigger"
        aria-label={`More options for ${label.toLowerCase()}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenMenu(open ? null : id)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpenMenu(null); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label={`${label} options`} className="overview-kpi-menu" style={{ minWidth }}>
          {CARD_MENUS[id].map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.route}
              className="overview-kpi-menu-item"
              onKeyDown={(e) => { if (e.key === "Escape") setOpenMenu(null); }}
              onClick={() => { setOpenMenu(null); onGo(item.route); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Presentation-only helpers.
const shortPlace = (s?: string) =>
  (s || "").split(" ").slice(0, 2).join(" ").replace(/[,\s]+$/, "") || "—";
// Backend signal titles use " — " as a separator; show a colon instead.
const cleanSignalText = (s?: string) => (s || "").replace(/\s+—\s+/g, ": ");
const isFastPaySignal = (i: any) => /fast\s*pay|advance/i.test(`${i.title} ${i.body}`);
const wholeRand = (v: number) => formatCurrency(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function Delta({ value, unit, period }: { value: number; unit: "%" | "pts"; period: string }) {
  const up = value > 0;
  const flat = value === 0;
  const sign = up ? "+" : value < 0 ? "−" : "";
  const shown = `${sign}${Math.abs(value)}${unit === "%" ? "%" : " pts"}`;
  const Glyph = up ? TrendingUp : TrendingDown;
  return (
    <span className={`tw-delta ${flat ? "" : up ? "is-up" : "is-down"}`}>
      {!flat && <Glyph size={14} strokeWidth={2} aria-hidden="true" />}
      <span>{shown}</span>
      <span className="tw-delta__period">{period}</span>
    </span>
  );
}

const POSITIVE = ["ACCEPTED", "DELIVERED", "COMPLETED", "PAID"];
function StatusChip({ status }: { status?: string }) {
  const s = String(status || "").toUpperCase();
  return <span className={`tw-chip${POSITIVE.includes(s) ? " tw-chip--ok" : ""}`}>{titleCase(status)}</span>;
}

export default function Overview() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [recentTab, setRecentTab] = useState<"quotes" | "loads">("quotes");

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenu]);

  const { data, isLoading: loading, refetch, dataUpdatedAt, isRefetchError, isError } = useQuery({
    queryKey: ["overview-dashboard"],
    queryFn: loadOverview,
  });

  // Cached data drives the view; defaults keep the first render safe.
  const financeData = data?.financeData ?? null;
  const failed = data?.failedSources ?? [];
  // Fast Pay is not live: its signals (advance amounts, fees, payout times)
  // describe money that is not available, so they are not shown.
  const insights = (data?.insights ?? []).filter((i: any) => CAPITAL_LAUNCHED || !isFastPaySignal(i));
  const recentQuotes = data?.recentQuotes ?? [];
  const allQuotes: any[] = data?.quotes ?? [];
  const quotesTotal: number | undefined = data?.quotesTotal;
  const recentLoads = data?.recentLoads ?? [];
  const activeLoadsCount = data?.activeLoadsCount ?? 0;
  const totalVehicles = data?.totalVehicles ?? 0;
  const availableVehicles = data?.availableVehicles ?? 0;
  const heatmapData: number[] = data?.heatmapData ?? [];
  const pipeline = usePipeline(allQuotes);

  useEffect(() => {
    document.title = "Today - TruckWys";
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

  // ---- Derived presentation values (no new calculations of business figures) ----
  const trend: any[] = financeData?.monthly_trend || [];
  const monthLabel = (m: any) => MONTHS_SHORT[Number(String(m.month).slice(5, 7)) - 1] || m.month || "";
  const revenueSeries = trend.map((m) => Number(m.revenue) || 0);
  const marginSeries = trend.map((m) => (m.revenue > 0 ? ((m.revenue - m.expenses) / m.revenue) * 100 : null));
  const marginBasis = financeData
    ? financeData.revenue_mtd > 0 ? "this month" : financeData.total_revenue > 0 ? "all time" : null
    : null;
  const loads28 = heatmapData.reduce((a, b) => a + b, 0);
  const vehiclesFailed = failed.includes("vehicles") && !data?.totalVehicles;
  const outstanding = Number(financeData?.outstanding_invoices_total || 0);
  const overdue = Number(financeData?.overdue_invoices_total || 0);
  const pastShare = outstanding > 0 ? Math.min(Math.max(overdue, 0), outstanding) / outstanding : 0;

  const skeleton = <span className="ov-skel" aria-label="Loading" />;
  const unavailable = !loading && !financeData;

  return (
    <div className="overview-typography ov-page">
      <header className="tw-page-head">
        <div className="tw-page-head__titles">
          <h1 className="tw-title">Today</h1>
          <p className="tw-subtitle">{today}</p>
        </div>
        <div className="tw-page-head__actions">
          <button type="button" className="tw-btn" onClick={() => navigate("/finance/expenses")}>Add expense</button>
          <button type="button" className="tw-btn" onClick={() => navigate("/finance/invoices/new")}>Create invoice</button>
          <button type="button" className="tw-btn tw-btn--primary" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
        </div>
      </header>

      <div className="ov-notices">
        <StaleDataNotice updatedAt={dataUpdatedAt} refreshFailed={isRefetchError} onRetry={() => refetch()} />
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
      </div>

      {/* KPI tiles: label, big figure, change against a named period, micro trend. */}
      <div className="td-kpis">
        {/* Emphasis tile: the money that needs chasing. */}
        <section className="td-kpi td-kpi--emphasis" aria-label="Owed to you">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Owed to you
              <InfoTip>Sent invoices not yet paid. Past due means after the invoice due date.</InfoTip>
            </h2>
            <KpiMenu id="outstanding" label="Owed to you" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={220} onGo={navigate} />
          </div>
          <div className="td-kpi__value" title={financeData ? formatCurrency(outstanding) : undefined}>
            {loading ? skeleton : financeData ? wholeRand(outstanding) : "—"}
          </div>
          <div className="td-kpi__meta">
            {financeData ? (
              outstanding <= 0 ? <span>Nothing outstanding</span>
                : <span>{overdue >= outstanding ? "All past due" : overdue > 0 ? `${wholeRand(overdue)} past due` : "None past due"}</span>
            ) : unavailable ? <span>Unavailable</span> : null}
          </div>
          {financeData && outstanding > 0 && (
            <div className="td-kpi__strip" role="img" aria-label={`${Math.round(pastShare * 100)}% of what you are owed is past due`}>
              <span style={{ width: `${pastShare * 100}%` }} />
            </div>
          )}
          <div className="td-kpi__foot">
            {financeData && outstanding > 0 && (financeData.dso > 0
              ? `${Math.round(financeData.dso)} days to pay, on average`
              : "Time to pay needs recent invoices")}
          </div>
        </section>

        <section className="td-kpi" aria-label="Revenue received">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Revenue received
              <InfoTip>Invoices paid, all time. Change compares the last 30 days with the 30 before. Bars show each month.</InfoTip>
            </h2>
            <KpiMenu id="revenue" label="Revenue" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div className="td-kpi__value" title={financeData ? formatCurrency(financeData.total_revenue || 0) : undefined}>
              {loading ? skeleton : financeData ? wholeRand(financeData.total_revenue || 0) : "—"}
            </div>
          <div className="td-kpi__row">
            <div className="td-kpi__meta">
            {typeof financeData?.revenue_change_pct === "number" ? (
              <Delta value={financeData.revenue_change_pct} unit="%" period="vs prior 30 days" />
            ) : financeData ? <span>No prior 30 days</span> : unavailable ? <span>Unavailable</span> : null}
            </div>
            <MicroBars values={revenueSeries} ariaLabel="Revenue received per month" />
          </div>
        </section>

        <section className="td-kpi" aria-label="Net margin">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Net margin{marginBasis ? `, ${marginBasis}` : ""}
              <InfoTip>Revenue received minus approved expenses, as a share of revenue. Change is in percentage points, last 30 days vs the 30 before.</InfoTip>
            </h2>
            <KpiMenu id="margin" label="Net margin" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div className="td-kpi__value">
              {loading ? skeleton : financeData && marginBasis ? formatPercent(financeData.net_margin_percent || 0) : "—"}
            </div>
          <div className="td-kpi__row">
            <div className="td-kpi__meta">
            {typeof financeData?.margin_change_pts === "number" ? (
              <Delta value={financeData.margin_change_pts} unit="pts" period="vs prior 30 days" />
            ) : financeData ? <span>{marginBasis ? "Too little revenue" : "No revenue yet"}</span> : unavailable ? <span>Unavailable</span> : null}
            </div>
            <MicroBars values={marginSeries} ariaLabel="Net margin per month" />
          </div>
        </section>

        <section className="td-kpi" aria-label="Active loads">
          <div className="td-kpi__head">
            <h2 className="td-kpi__label">
              Active loads
              <InfoTip>Loads not yet delivered, invoiced or cancelled. Bars show loads booked per day, last 28 days. Available trucks come from your vehicle list.</InfoTip>
            </h2>
            <Link to="/bookings" className="td-kpi__go" aria-label="Open loads"><ArrowUpRight size={16} strokeWidth={1.75} /></Link>
          </div>
          <div className="td-kpi__value">{loading ? skeleton : failed.includes("loads") ? "—" : activeLoadsCount}</div>
          <div className="td-kpi__row">
            <div className="td-kpi__meta">
            {data && !failed.includes("loads") && <span>{loads28} booked in 28 days</span>}
            </div>
            <MicroBars values={heatmapData} ariaLabel={`Loads booked per day, last 28 days: ${loads28} in total`} />
          </div>
          <div className="td-kpi__foot">
            {!loading && !vehiclesFailed && totalVehicles > 0 && `${availableVehicles} of ${totalVehicles} trucks available`}
          </div>
        </section>
      </div>

      <div className="td-grid">
        <section className="tw-card td-chart-card" aria-labelledby="td-chart-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="td-chart-title" className="tw-card__title">
                Revenue vs costs
                <InfoTip>Revenue: invoices paid in the month. Costs: approved expenses dated in the month.</InfoTip>
              </h2>
              <p className="tw-card__sub">Per month, last {trend.length || 6}</p>
            </div>
            <div className="td-legend" aria-hidden="true">
              <span><i className="td-legend__rev" />Revenue</span>
              <span><i className="td-legend__cost" />Costs</span>
            </div>
          </div>
          {loading ? (
            <div className="ov-skel-block" />
          ) : trend.length === 0 ? (
            <p className="td-empty">{financeData ? "No monthly figures yet." : "Figures couldn't load."}</p>
          ) : (
            <RevenueCostBars
              months={trend.map((m) => ({
                label: monthLabel(m),
                full: `${monthLabel(m)} ${String(m.month).slice(0, 4)}`,
                revenue: Number(m.revenue) || 0,
                costs: Number(m.expenses) || 0,
              }))}
            />
          )}
        </section>

        <section className="tw-card td-needs" aria-labelledby="td-needs-title">
          <div className="tw-card__head">
            <div className="tw-card__titles">
              <h2 id="td-needs-title" className="tw-card__title">Needs you</h2>
              <p className="tw-card__sub">Invoices, quotes and fleet</p>
            </div>
            {insights.length > 0 && <span className="tw-chip">{insights.length}</span>}
          </div>
          {loading ? (
            <div className="ov-skel-block ov-skel-block--short" />
          ) : insights.length > 0 ? (
            <ul className="td-needs__list">
              {insights.slice(0, 5).map((insight: any, idx: number) => {
                const sev = String(insight.severity || "").toLowerCase();
                const tone = ["high", "critical"].includes(sev) ? "bad" : sev === "medium" ? "warn" : "info";
                return (
                  <li key={idx} className="td-needs__row">
                    <span className={`td-needs__icon is-${tone}`} aria-hidden="true"><CircleAlert size={16} strokeWidth={1.75} /></span>
                    <div className="td-needs__text">
                      <div className="td-needs__title">{cleanSignalText(insight.title || insight.message)}</div>
                      {insight.body && insight.body !== insight.title && (
                        <div className="td-needs__body" title={cleanSignalText(insight.body)}>{cleanSignalText(insight.body)}</div>
                      )}
                    </div>
                    <span className="ov-sr-only">{titleCase(String(insight.severity || "low"))} priority</span>
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
                        <td><StatusChip status={quote.status} /></td>
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

        <div className="td-side">
          <section className="tw-card" aria-labelledby="td-pipe-title">
            <div className="tw-card__head">
              <div className="tw-card__titles">
                <h2 id="td-pipe-title" className="tw-card__title">
                  Quote pipeline
                  <InfoTip align="end">Each stage counts quotes that reached it, by current status. Percent is of the stage before.</InfoTip>
                </h2>
                <p className="tw-card__sub">
                  {loading ? "Quotes by stage" : allQuotes.length > 0 && quotesTotal != null && quotesTotal > allQuotes.length
                    ? `Latest ${allQuotes.length} of ${quotesTotal} quotes`
                    : `All ${allQuotes.length} quotes`}
                </p>
              </div>
              <Link to="/bookings/quotes" className="td-kpi__go" aria-label="Open quotes"><ArrowUpRight size={16} strokeWidth={1.75} /></Link>
            </div>
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : allQuotes.length === 0 ? (
              <div className="td-empty">
                <p>{failed.includes("recent quotes") ? "Quotes couldn't load." : "No quotes yet."}</p>
                <button type="button" className="tw-btn" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
              </div>
            ) : (
              <>
                <PipelineBars stages={pipeline.stages} />
                <dl className="td-stats">
                  <div><dt>Awaiting reply</dt><dd>{pipeline.awaiting}</dd></div>
                  <div><dt>Drafts</dt><dd>{pipeline.drafts}</dd></div>
                  <div><dt>Win rate</dt><dd>{pipeline.winRate != null ? `${pipeline.winRate}%` : "—"}</dd></div>
                </dl>
              </>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
