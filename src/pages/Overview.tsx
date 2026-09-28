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
import { Loader } from "@/components/Loader";
import SectionHeader from "@/components/layout/SectionHeader";
import { FleetActivity, QuoteConversion, OwedStrip } from "@/components/overview/charts";
import { Sparkline, CoverDumbbell } from "@/components/viz";

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

// Presentation-only helpers for the redesigned panels.
const shortPlace = (s?: string) =>
  (s || "").split(" ").slice(0, 2).join(" ").replace(/[,\s]+$/, "") || "—";
// Backend signal titles use " — " as a separator; show a colon instead.
const cleanSignalText = (s?: string) => (s || "").replace(/\s+—\s+/g, ": ");
const isFastPaySignal = (i: any) => /fast\s*pay|advance/i.test(`${i.title} ${i.body}`);

function Delta({ value, unit, period }: { value: number; unit: "%" | "pts"; period: string }) {
  const up = value > 0;
  const flat = value === 0;
  const sign = up ? "+" : value < 0 ? "−" : "";
  const shown = `${sign}${Math.abs(value)}${unit === "%" ? "%" : " pts"}`;
  return (
    <span className={`ov-delta ${flat ? "" : up ? "is-up" : "is-down"}`}>
      {!flat && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      )}
      <span>{shown}</span>
      <span className="ov-delta__period">{period}</span>
    </span>
  );
}

function StatusChip({ status, positive }: { status?: string; positive: boolean }) {
  return <span className={`ov-chip${positive ? " is-positive" : ""}`}>{titleCase(status)}</span>;
}

export default function Overview() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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
  const activeVehicles = data?.activeVehicles ?? 0;
  const availableVehicles = data?.availableVehicles ?? 0;
  const activity = data?.activity ?? [];
  const heatmapData: number[] = data?.heatmapData ?? [];

  useEffect(() => {
    document.title = "Overview - TruckWys";
  }, []);

  useAutoRefresh(refetch);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

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
  const trendLabels = trend.map((m) => `${monthLabel(m)} ${String(m.month).slice(0, 4)}`);
  const dayLabels28 = heatmapData.map((_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86400000);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  });
  const vehiclesFailed = failed.includes("vehicles") && !data?.totalVehicles;
  const outstanding = Number(financeData?.outstanding_invoices_total || 0);
  const overdue = Number(financeData?.overdue_invoices_total || 0);

  const skeleton = <span className="ov-skel" aria-label="Loading" />;

  return (
    <div className="overview-typography ov-page">
      <SectionHeader
        title="Overview"
        description={today}
        actions={
          <>
            <button type="button" className="ov-btn" onClick={() => navigate("/finance/expenses")}>Add expense</button>
            <button type="button" className="ov-btn" onClick={() => navigate("/finance/reports")}>View reports</button>
            <button type="button" className="ov-btn ov-btn--primary" onClick={() => navigate("/finance/invoices/new")}>Create invoice</button>
          </>
        }
      />

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

      {/* KPI tiles: label, value, change against the previous period, trend. */}
      <div className="ov-kpis">
        <section className="ov-card ov-kpi" aria-label="Revenue received to date">
          <div className="ov-kpi__head">
            <h3 className="ov-kpi__label">Revenue received to date</h3>
            <KpiMenu id="revenue" label="Revenue" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div className="ov-kpi__value">
            {loading ? skeleton : financeData ? formatCurrency(financeData.total_revenue || 0) : "—"}
          </div>
          <div className="ov-kpi__context">
            {typeof financeData?.revenue_change_pct === "number" ? (
              <Delta value={financeData.revenue_change_pct} unit="%" period="last 30 days vs the 30 before" />
            ) : financeData ? (
              <span>No payments in the previous 30 days to compare</span>
            ) : !loading ? <span>Unavailable</span> : null}
          </div>
          <Sparkline
            values={revenueSeries}
            labels={trendLabels}
            format={(v) => formatCurrency(v)}
            ariaLabel={`Revenue received per month, ${trendLabels[0] || ""} to ${trendLabels[trendLabels.length - 1] || ""}`}
          />
        </section>

        <section className="ov-card ov-kpi" aria-label="Net margin">
          <div className="ov-kpi__head">
            <h3 className="ov-kpi__label">Net margin{marginBasis ? `, ${marginBasis}` : ""}</h3>
            <KpiMenu id="margin" label="Net margin" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div className="ov-kpi__value">
            {loading ? skeleton : financeData && marginBasis ? formatPercent(financeData.net_margin_percent || 0) : "—"}
          </div>
          <div className="ov-kpi__context">
            {typeof financeData?.margin_change_pts === "number" ? (
              <Delta value={financeData.margin_change_pts} unit="pts" period="last 30 days vs the 30 before" />
            ) : financeData ? (
              <span>{marginBasis ? "Not enough revenue in both periods to compare" : "No revenue received yet"}</span>
            ) : !loading ? <span>Unavailable</span> : null}
          </div>
          <Sparkline
            values={marginSeries}
            labels={trendLabels}
            format={(v) => `${v.toFixed(1)}%`}
            ariaLabel="Net margin per month. Months without revenue are gaps."
          />
        </section>

        <section className="ov-card ov-kpi" aria-label="Owed to you">
          <div className="ov-kpi__head">
            <h3 className="ov-kpi__label">Owed to you</h3>
            <KpiMenu id="outstanding" label="Owed to you" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={220} onGo={navigate} />
          </div>
          <div className="ov-kpi__value">
            {loading ? skeleton : financeData ? formatCurrency(outstanding) : "—"}
          </div>
          <div className="ov-kpi__context">
            {financeData ? (
              outstanding <= 0 ? (
                <span>Every sent invoice is paid</span>
              ) : (
                <span className={overdue > 0 ? "ov-attention" : ""}>
                  {overdue >= outstanding ? "All of it is past due" : overdue > 0 ? `${formatCurrency(overdue)} past due` : "None of it is past due"}
                </span>
              )
            ) : !loading ? <span>Unavailable</span> : null}
          </div>
          {financeData && <OwedStrip outstanding={outstanding} overdue={overdue} />}
          <div className="ov-kpi__foot">
            {financeData && outstanding > 0 && (financeData.dso > 0
              ? `Customers take ${Math.round(financeData.dso)} days to pay on average`
              : "Time to pay needs invoices issued in the last 90 days")}
          </div>
        </section>

        <section className="ov-card ov-kpi" aria-label="Active loads">
          <div className="ov-kpi__head">
            <h3 className="ov-kpi__label">Active loads</h3>
            <Link to="/bookings" className="ov-link">Bookings</Link>
          </div>
          <div className="ov-kpi__value">{loading ? skeleton : failed.includes("loads") ? "—" : activeLoadsCount}</div>
          <div className="ov-kpi__context">
            {data && !failed.includes("loads") && <span>{loads28} booked in the last 28 days</span>}
          </div>
          <Sparkline
            values={heatmapData}
            labels={dayLabels28}
            variant="bars"
            format={(v) => `${v} ${v === 1 ? "load" : "loads"} booked`}
            ariaLabel={`Loads booked per day, last 28 days: ${loads28} in total`}
          />
        </section>
      </div>

      <div className="ov-columns">
        <div className="ov-stack">
          <section className="ov-card" aria-labelledby="ov-chart-title">
            <div className="ov-card__head">
              <h2 id="ov-chart-title" className="ov-card__title">Did revenue cover costs each month?</h2>
              <p className="ov-card__desc">Each month shows revenue (invoices paid in the month) against costs (approved expenses dated in the month). The line between them is what was left over, or the shortfall.</p>
            </div>
            {loading ? (
              <div className="ov-skel-block" />
            ) : trend.length === 0 ? (
              <p className="ov-empty">{financeData ? "No monthly figures yet." : "Revenue and cost figures couldn't load."}</p>
            ) : (
              <CoverDumbbell
                periods={trend.map((m, i) => ({
                  label: monthLabel(m),
                  revenue: Number(m.revenue) || 0,
                  costs: Number(m.expenses) || 0,
                  isCurrent: i === trend.length - 1,
                }))}
              />
            )}
          </section>

          <section className="ov-card ov-card--table" aria-labelledby="ov-quotes-title">
            <div className="ov-card__head ov-card__head--split">
              <div>
                <h2 id="ov-quotes-title" className="ov-card__title">How far do your quotes get?</h2>
                <p className="ov-card__desc">
                  {allQuotes.length > 0
                    ? `Each stage counts quotes that reached it, from ${quotesTotal != null && quotesTotal > allQuotes.length ? `your ${allQuotes.length} most recent quotes (of ${quotesTotal})` : `all ${allQuotes.length} quotes`}, by current status. Invoicing and payment are not linked to quotes here.`
                    : "Quotes by how far they progressed, then the five most recent."}
                </p>
              </div>
              <Link to="/bookings/quotes" className="ov-link">View all</Link>
            </div>
            {!loading && allQuotes.length > 0 && (
              <div className="ov-funnel">
                <QuoteConversion quotes={allQuotes} />
                <h3 className="ov-subhead">Latest five</h3>
              </div>
            )}
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : recentQuotes.length > 0 ? (
              <div className="ov-table-wrap">
                <table className="ov-table">
                  <thead>
                    <tr>
                      <th scope="col">Quote</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Route</th>
                      <th scope="col" className="num">Total</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuotes.map((quote: any) => (
                      <tr key={quote.id} onClick={() => navigate(`/bookings/quotes/${quote.id}`)}>
                        <td><Link className="ov-id" to={`/bookings/quotes/${quote.id}`} onClick={(e) => e.stopPropagation()}>{quote.quote_number}</Link></td>
                        <td>{quote.customer_name || "—"}</td>
                        <td className="ov-muted">{shortPlace(quote.pickup_location)} to {shortPlace(quote.delivery_location)}</td>
                        <td className="num">{formatCurrency(parseFloat(quote.total_amount || "0"))}</td>
                        <td><StatusChip status={quote.status} positive={quote.status === "ACCEPTED"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ov-empty">{failed.includes("recent quotes") ? "Quotes couldn't load." : "No quotes yet."}</p>
            )}
          </section>

          <section className="ov-card ov-card--table" aria-labelledby="ov-loads-title">
            <div className="ov-card__head ov-card__head--split">
              <div>
                <h2 id="ov-loads-title" className="ov-card__title">Latest bookings</h2>
                <p className="ov-card__desc">The five most recent loads and where each one stands.</p>
              </div>
              <Link to="/bookings" className="ov-link">View all</Link>
            </div>
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : recentLoads.length > 0 ? (
              <div className="ov-table-wrap">
                <table className="ov-table">
                  <thead>
                    <tr>
                      <th scope="col">Load</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Route</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoads.map((load: any) => (
                      <tr key={load.id} onClick={() => navigate(`/bookings/${load.id}`)}>
                        <td><Link className="ov-id" to={`/bookings/${load.id}`} onClick={(e) => e.stopPropagation()}>{load.load_number || `LD-${load.id}`}</Link></td>
                        <td>{load.customer_name || load.customer?.company_name || "—"}</td>
                        <td className="ov-muted">
                          {shortPlace(load.pickup_location || load.origin)} to {shortPlace(load.delivery_location || load.destination)}
                        </td>
                        <td><StatusChip status={load.status} positive={load.status === "DELIVERED"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ov-empty">{failed.includes("loads") ? "Bookings couldn't load." : "No bookings yet."}</p>
            )}
          </section>
        </div>

        <div className="ov-stack">
          <section className="ov-card" aria-labelledby="ov-fleet-title">
            <div className="ov-card__head">
              <h2 id="ov-fleet-title" className="ov-card__title">Is the fleet working?</h2>
              <p className="ov-card__desc">Each square is a day in the last 28. Filled means the truck had a load between pickup and delivery. Only loads with a truck assigned count.</p>
            </div>
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : vehiclesFailed ? (
              <p className="ov-empty">Vehicle figures couldn't load. Try again from the notice above.</p>
            ) : totalVehicles === 0 ? (
              <div className="ov-empty">
                <p>No vehicles added yet.</p>
                <Link to="/fleet" className="ov-link">Add vehicles</Link>
              </div>
            ) : (
              <>
                <FleetActivity
                  loads={data?.loads ?? []}
                  loadsTotal={data?.loadsTotal}
                  vehicles={data?.vehicles ?? []}
                  activeVehicles={activeVehicles}
                  totalVehicles={totalVehicles}
                />
                <dl className="ov-dl">
                  <div><dt>Available now</dt><dd>{availableVehicles}</dd></div>
                  <div><dt>Active loads</dt><dd>{activeLoadsCount}</dd></div>
                </dl>
              </>
            )}
          </section>

          <section className="ov-card" aria-labelledby="ov-signals-title">
            <div className="ov-card__head">
              <h2 id="ov-signals-title" className="ov-card__title">What needs your attention</h2>
              <p className="ov-card__desc">Signals from your invoices, quotes and fleet.</p>
            </div>
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : insights.length > 0 ? (
              <ul className="ov-signals">
                {insights.slice(0, 5).map((insight: any, idx: number) => {
                  const sev = String(insight.severity || "").toLowerCase();
                  return (
                    <li key={idx}>
                      <div className="ov-signals__meta">
                        <span>{titleCase(insight.category || "Signal")}</span>
                        {insight.severity && (
                          <span className={["high", "critical"].includes(sev) ? "ov-sev-high" : sev === "medium" ? "ov-sev-med" : ""}>
                            {titleCase(String(insight.severity))} priority
                          </span>
                        )}
                      </div>
                      <div className="ov-signals__title">{cleanSignalText(insight.title || insight.message)}</div>
                      {insight.body && insight.body !== insight.title && (
                        <p className="ov-signals__body">{cleanSignalText(insight.body)}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ov-empty">
                <p>Nothing needs attention right now. Signals appear here as your quotes, invoices and fleet data grow.</p>
                <button type="button" className="ov-btn" onClick={() => navigate("/copilot")}>Ask Copilot</button>
              </div>
            )}
          </section>

          <section className="ov-card" aria-labelledby="ov-activity-title">
            <div className="ov-card__head">
              <h2 id="ov-activity-title" className="ov-card__title">What changed recently</h2>
              <p className="ov-card__desc">The latest events in your workspace.</p>
            </div>
            {loading ? (
              <div className="ov-skel-block ov-skel-block--short" />
            ) : activity.length === 0 ? (
              <p className="ov-empty">{failed.includes("recent activity") ? "Activity couldn't load." : "No activity yet."}</p>
            ) : (
              <ul className="ov-activity">
                {activity.slice(0, 5).map((e: any) => (
                  <li key={e.id}>
                    <span className="ov-activity__title">{e.title}</span>
                    <span className="ov-activity__time">{timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
