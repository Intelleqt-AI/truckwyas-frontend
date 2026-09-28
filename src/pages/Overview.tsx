import "@/components/ui/dashboard-kpi.css";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import '@/components/data/stale-data-notice.css';
import './overview-typography.css';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";
import { DashboardMetricIcon } from "@/components/ui/DashboardMetricIcon";

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
    body: s.body || s.message || "",
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
    { label: "Request capital advance",   route: "/capital" },
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

export default function Overview() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
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
  const insights = data?.insights ?? [];
  const advances = data?.advances ?? [];
  // Advances actually in TruckWys's own request pipeline — REQUESTED
  // (submitted, not yet scored) or SCORING (risk engine actively evaluating
  // it). In practice this is usually 0 while Fast Pay is being set up, so
  // it's added to the eligible-invoice count below rather than shown alone.
  const pendingAdvancesCount = advances.filter(
    (a: any) => a.status === "REQUESTED" || a.status === "SCORING",
  ).length;
  // Invoices that qualify for an advance but don't have one requested yet —
  // the backend excludes invoices with an active request from this list, so
  // it's disjoint from pendingAdvancesCount and safe to add.
  const eligibleInvoicesCount = data?.eligibleInvoicesCount ?? 0;
  const advancesActionableCount = pendingAdvancesCount + eligibleInvoicesCount;
  const recentQuotes = data?.recentQuotes ?? [];
  const recentLoads = data?.recentLoads ?? [];
  const activeLoadsCount = data?.activeLoadsCount ?? 0;
  const totalVehicles = data?.totalVehicles ?? 0;
  const activeVehicles = data?.activeVehicles ?? 0;
  const availableVehicles = data?.availableVehicles ?? 0;
  const activity = data?.activity ?? [];
  const heatmapData = data?.heatmapData ?? [];
  const activityLoading = loading;

  useEffect(() => {
    document.title = "Overview - TruckWys";

    // Real-time clock update
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    // Built from parts so every browser shows "Mon, 28 Sep 2026" (no "Sept").
    const parts = new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("weekday")}, ${Number(get("day"))} ${MONTHS_SHORT[Number(get("month")) - 1] || ""} ${get("year")}`;
  };

  const getHeatClass = (count: number) => {
    if (count === 0) return "";
    const max = Math.max(...heatmapData, 1);
    const ratio = count / max;
    if (ratio >= 0.75) return "heat-high";
    if (ratio >= 0.5) return "heat-med";
    if (ratio > 0) return "heat-low";
    return "";
  };

  return (
    <div
      className="overview-typography"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        // "dense": the default (sparse) packing advances a one-way cursor —
        // once a 2-wide card (e.g. Recent Bookings) can't fit in a single
        // leftover column, the algorithm moves on and never backfills that
        // gap with a later, smaller card. Dense packing fills those gaps
        // instead — the actual cause of the empty column-3 strip between
        // Fleet Utilization and Recent Activity. Doesn't affect DOM/reading
        // order, only visual position.
        gridAutoFlow: "dense",
        gap: 16,
        alignContent: "start",
      }}>
      {/* One semantic H1 per screen. The dashboard deliberately leads with the
          clock/command bar instead of a visible title, so the heading is
          visually hidden but still announced to assistive technology. */}
      <h1
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
          fontSize: 22,
          lineHeight: "28px",
          fontWeight: 600,
        }}>
        Dashboard
      </h1>
      {/* Command bar — compact clock + actionable live pulse */}
      <div
          className="card"
          style={{
            gridColumn: "span 3",
            padding: "12px 20px",
            background: "var(--bg-surface)",
          }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}>
            {/* Compact date / time */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 13, lineHeight: "20px",
                    fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                    color: "var(--text-tertiary)",
                    letterSpacing: "normal",
                    textTransform: "none",
                  }}>
                  {formatDate(currentTime)}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                    marginTop: 1,
                  }}>
                  {formatTime(currentTime)}{" "}
                  <span
                    style={{
                      fontSize: 13, lineHeight: "20px",
                      color: "var(--text-tertiary)",
                      marginLeft: 4,
                    }}>
                    SAST
                  </span>
                </div>
              </div>
              <StaleDataNotice updatedAt={dataUpdatedAt} refreshFailed={isRefetchError} onRetry={() => refetch()} />
              {isError && !data && (
                <div className="stale-data-notice" role="alert">
                  <span>The overview couldn't be loaded.</span>
                  <button type="button" className="stale-data-notice__retry" onClick={() => refetch()}>
                    Try again
                  </button>
                </div>
              )}
              {!isRefetchError && (data?.failedSources?.length ?? 0) > 0 && (
                <div className="stale-data-notice" role="status">
                  <span>
                    Some figures couldn't load: {data!.failedSources.join(", ")}.
                  </span>
                  <button type="button" className="stale-data-notice__retry" onClick={() => refetch()}>
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Actionable pulse — clickable */}
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              {(
                [
                  {
                    label: "Active loads",
                    value: String(activeLoadsCount),
                    route: "/bookings",
                    warn: false,
                  },
                  {
                    label: "Active vehicles",
                    value: `${activeVehicles}/${totalVehicles}`,
                    route: "/fleet",
                    warn: false,
                  },
                  {
                    label: "Advances pending",
                    value: String(advancesActionableCount),
                    route: "/capital",
                    warn: advancesActionableCount > 0,
                  },
                ] as const
              ).map((s) => (
                <button
                  type="button"
                  key={s.label}
                  className="overview-pulse"
                  onClick={() => navigate(s.route)}>
                  <div
                    style={{
                      fontSize: 13, lineHeight: "20px",
                      fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                      color: "var(--text-tertiary)",
                      textTransform: "none",
                      letterSpacing: "normal",
                      marginBottom: 2,
                    }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      lineHeight: "24px",
                      fontWeight: 600,
                      fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                      color: s.warn
                        ? "var(--status-warning-text, var(--status-warning))"
                        : "var(--text-primary)",
                    }}>
                    {s.value}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions — moved up from the bottom of the page so the most
            common next steps are reachable without scrolling past every
            chart/table first. A slim horizontal bar (not a 2x2 box) keeps it
            from eating much vertical space up here. */}
        <div
          className="card"
          style={{
            gridColumn: "span 3",
            padding: "16px 20px",
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}>
            <span className="card-title" style={{ marginRight: 4 }}>
              Quick actions
            </span>
            <button
              onClick={() => navigate("/finance/invoices/new")}
              className="btn-action"
              style={{
                padding: "8px 16px",
              }}>
              Create invoice
            </button>
            <button
              onClick={() => CAPITAL_LAUNCHED && navigate("/capital")}
              disabled={!CAPITAL_LAUNCHED}
              title={CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON}
              className="btn-action"
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              {CAPITAL_LAUNCHED ? "Request advance" : "Request advance (coming soon)"}
            </button>
            <button
              onClick={() => navigate("/finance/expenses")}
              className="btn-action"
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              Add expense
            </button>
            <button
              onClick={() => navigate("/finance/reports")}
              className="btn-action"
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              View reports
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="card metric-card dashboard-kpi-card">
          <div className="card-header dashboard-kpi-label">
            <span className="card-title dashboard-kpi-label"><span className="dashboard-metric-label-content"><DashboardMetricIcon kind="money" /><span className="dashboard-metric-label-text">
              Total revenue
            </span></span></span>
            <KpiMenu id="revenue" label="Total revenue" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div className="metric-value dashboard-kpi-value">
            {loading ? "..." : financeData ? formatCurrency(financeData.total_revenue || 0) : "—"}
          </div>
          {typeof financeData?.revenue_change_pct === "number" ? (
            <div
              className={`dashboard-kpi-context metric-delta ${financeData.revenue_change_pct >= 0 ? "delta-up" : "delta-down"}`}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3">
                <polyline
                  points={
                    financeData.revenue_change_pct >= 0
                      ? "18 15 12 9 6 15"
                      : "6 9 12 15 18 9"
                  }
                />
              </svg>
              <span>
                {financeData.revenue_change_pct >= 0 ? "+" : ""}
                {financeData.revenue_change_pct}% vs prev 30d
              </span>
            </div>
          ) : (
            <div className="metric-delta delta-neutral dashboard-kpi-context">
              <span>last 30 days</span>
            </div>
          )}
        </div>

        <div className="card metric-card dashboard-kpi-card">
          <div className="card-header dashboard-kpi-label">
            <span className="card-title dashboard-kpi-label"><span className="dashboard-metric-label-content"><DashboardMetricIcon kind="percent" /><span className="dashboard-metric-label-text">
              Net margin
            </span></span></span>
            <KpiMenu id="margin" label="Net margin" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={200} onGo={navigate} />
          </div>
          <div
            className="metric-value dashboard-kpi-value">
            {loading
              ? "..."
              : financeData ? formatPercent(financeData.net_margin_percent || 0) : "—"}
          </div>
          {typeof financeData?.margin_change_pts === "number" ? (
            <div
              className={`dashboard-kpi-context metric-delta ${financeData.margin_change_pts >= 0 ? "delta-up" : "delta-down"}`}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3">
                <polyline
                  points={
                    financeData.margin_change_pts >= 0
                      ? "18 15 12 9 6 15"
                      : "6 9 12 15 18 9"
                  }
                />
              </svg>
              <span>
                {financeData.margin_change_pts >= 0 ? "+" : ""}
                {financeData.margin_change_pts} pts vs prev 30d
              </span>
            </div>
          ) : (
            <div className="metric-delta delta-neutral dashboard-kpi-context">
              <span>last 30 days</span>
            </div>
          )}
        </div>

        <div className="card metric-card dashboard-kpi-card">
          <div className="card-header dashboard-kpi-label">
            <span className="card-title dashboard-kpi-label"><span className="dashboard-metric-label-content"><DashboardMetricIcon kind="overdue" /><span className="dashboard-metric-label-text">
              Outstanding
            </span></span></span>
            <KpiMenu id="outstanding" label="Outstanding" openMenu={openMenu} setOpenMenu={setOpenMenu} minWidth={220} onGo={navigate} />
          </div>
          <div
            className="metric-value dashboard-kpi-value"
            style={{ color: "var(--status-warning-text, var(--status-warning))" }}>
            {loading
              ? "..."
              : financeData ? formatCurrency(financeData.outstanding_invoices_total || 0) : "—"}
          </div>
          <div className="metric-delta delta-neutral dashboard-kpi-context">
            <span>
              DSO: {loading || !financeData ? "—" : Math.round(financeData.dso || 0)} days
            </span>
          </div>
        </div>

        {/* Chart card */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">
              Revenue vs costs by month
            </span>
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 13, lineHeight: "20px",
                color: "var(--text-secondary)",
              }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 20,
                    height: 2,
                    background: "var(--accent-primary)",
                    display: "inline-block",
                    borderRadius: 1,
                  }}
                />
                Revenue
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 20,
                    height: 2,
                    background: "var(--status-danger)",
                    display: "inline-block",
                    borderRadius: 1,
                  }}
                />
                Costs
              </span>
            </div>
          </div>
          {(() => {
            const trend = financeData?.monthly_trend || [];
            const rev =
              trend.length > 0 ? trend.map((m: any) => m.revenue / 1000) : [0];
            const fuel =
              trend.length > 0 ? trend.map((m: any) => m.expenses / 1000) : [0];
            const maxV = Math.max(...rev, ...fuel, 1) * 1.1;
            const pts = (arr: number[]) =>
              arr
                .map(
                  (v, i) =>
                    `${(i / Math.max(arr.length - 1, 1)) * 100},${100 - (v / maxV) * 100}`,
                )
                .join(" ");
            const labels = trend.map((m: any) => MONTHS_SHORT[Number(m.month?.slice(5, 7)) - 1] || m.month || "");
            return (
              <>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    width: "100%",
                    height: 120,
                    display: "block",
                    marginTop: 8,
                  }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--accent-primary)"
                        stopOpacity="0.15"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--accent-primary)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`0,100 ${pts(rev)} 100,100`}
                    fill="url(#revGrad)"
                  />
                  <polyline
                    points={pts(rev)}
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={pts(fuel)}
                    fill="none"
                    stroke="var(--status-danger)"
                    strokeWidth="1.2"
                    strokeDasharray="3,2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                    fontSize: 13, lineHeight: "20px",
                    color: "var(--text-secondary)",
                  }}>
                  {labels.map((l: string, i: number) => (
                    <span key={i}>{l}</span>
                  ))}
                </div>
              </>
            );
          })()}
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              marginTop: 8,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
              fontSize: 13, lineHeight: "20px",
            }}>
            <span>
              Net margin{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {financeData?.net_margin_percent != null
                  ? `${(financeData.net_margin_percent || 0).toFixed(1)}%`
                  : "—"}
              </span>
            </span>
            <span>
              Costs as % of revenue, latest month{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {financeData?.monthly_trend?.length > 0
                  ? `${Math.round(((financeData.monthly_trend.at(-1)?.expenses || 0) / Math.max(financeData.monthly_trend.at(-1)?.revenue || 1, 1)) * 100)}%`
                  : "—"}
              </span>
            </span>
          </div>
        </div>

        {/* Utilization card */}
        <div className="card utilization-card">
          <div className="card-header">
            <span className="card-title">Fleet utilisation</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 12,
            }}>
            <div>
              <div
                style={{
                  fontSize: 28,
                  lineHeight: "36px",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-primary)",
                }}>
                {totalVehicles > 0
                  ? `${Math.round((activeVehicles / totalVehicles) * 100)}%`
                  : "—"}
              </div>
              <div
                style={{
                  fontSize: 13, lineHeight: "20px",
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}>
                {activeVehicles} of {totalVehicles} vehicles active
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-tertiary)" }}>
                Active loads
              </div>
              <div
                style={{
                  fontSize: 16,
                  lineHeight: "24px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                }}>
                {activeLoadsCount}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)" }}>
            Loads created per day, last 28 days
          </div>
          <div className="heatmap-grid" role="img" aria-label={`Loads created per day over the last 28 days: ${heatmapData.reduce((a: number, b: number) => a + b, 0)} in total`}>
            {(heatmapData.length > 0 ? heatmapData : new Array(28).fill(0)).map(
              (count, i) => (
                <div
                  key={i}
                  className={`heat-cell ${getHeatClass(count)}`}
                  title={`${count} load${count !== 1 ? "s" : ""}`}
                />
              ),
            )}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 13, lineHeight: "20px",
              color: "var(--text-tertiary)",
            }}>
            {data
              ? `${availableVehicles} vehicle${availableVehicles !== 1 ? "s" : ""} available`
              : "Loading..."}
          </div>
        </div>

        {/* Recent quotes */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent quotes</span>
            <button
              onClick={() => navigate("/bookings/quotes")}
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "8px 16px",
                minHeight: 40,
                fontSize: 14, lineHeight: "20px",
                fontFamily: "var(--font-sans)",
                borderRadius: 6,
                cursor: "pointer",
              }}>
              View all
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
              <Loader size={24} />
            </div>
          ) : recentQuotes.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((quote: any) => (
                  <tr
                    key={quote.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/bookings/quotes/${quote.id}`)}>
                    <td className="mono">{quote.quote_number}</td>
                    <td>{quote.customer_name}</td>
                    <td
                      style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: "20px" }}>
                      {quote.pickup_location?.split(" ").slice(0, 2).join(" ")}{" "}
                      →{" "}
                      {quote.delivery_location
                        ?.split(" ")
                        .slice(0, 2)
                        .join(" ")}
                    </td>
                    <td
                      style={{
                        color: "var(--text-primary)",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
                      }}>
                      {formatCurrency(parseFloat(quote.total_amount || "0"))}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13, lineHeight: "20px",
                          color:
                            quote.status === "ACCEPTED"
                              ? "var(--status-success-text, var(--status-success))"
                              : quote.status === "SENT"
                                ? "var(--status-warning-text, var(--status-warning))"
                                : "var(--text-secondary)",
                          padding: "2px 8px",
                          background: "var(--bg-surface-hover)",
                          borderRadius: 4,
                          display: "inline-block",
                          whiteSpace: "nowrap",
                        }}>
                        {titleCase(quote.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}>
              No recent quotes
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent bookings</span>
            <button
              onClick={() => navigate("/bookings")}
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "8px 16px",
                minHeight: 40,
                fontSize: 14, lineHeight: "20px",
                fontFamily: "var(--font-sans)",
                borderRadius: 6,
                cursor: "pointer",
              }}>
              View all
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
              <Loader size={24} />
            </div>
          ) : recentLoads.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Load #</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLoads.map((load: any) => (
                  <tr
                    key={load.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/bookings/${load.id}`)}>
                    <td className="mono">
                      {load.load_number || `LD-${load.id}`}
                    </td>
                    <td>
                      {load.customer_name || load.customer?.company_name || "—"}
                    </td>
                    <td
                      style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: "20px" }}>
                      {(load.pickup_location || load.origin || "")
                        .split(" ")
                        .slice(0, 2)
                        .join(" ") || "—"}{" "}
                      →{" "}
                      {(load.delivery_location || load.destination || "")
                        .split(" ")
                        .slice(0, 2)
                        .join(" ") || "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13, lineHeight: "20px",
                          color:
                            load.status === "DELIVERED"
                              ? "var(--status-success-text, var(--status-success))"
                              : load.status === "IN_TRANSIT"
                                ? "var(--accent-primary)"
                                : "var(--text-secondary)",
                          padding: "2px 8px",
                          background: "var(--bg-surface-hover)",
                          borderRadius: 4,
                          display: "inline-block",
                          whiteSpace: "nowrap",
                        }}>
                        {titleCase(load.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}>
              No recent bookings
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Recent activity
          </div>
          {activityLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <Loader size={20} />
            </div>
          ) : activity.length === 0 ? (
            <div
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                padding: "16px 0",
              }}>
              No recent activity
            </div>
          ) : (
            <div>
              {activity.slice(0, 8).map((e: any) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-row)",
                  }}>
                  <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--text-primary)", minWidth: 0, overflowWrap: "anywhere" }}>
                    {e.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13, lineHeight: "20px",
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                      marginLeft: 16,
                    }}>
                    {timeAgo(e.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Agent Activity Stream — a regular grid card now, not a separate
          full-height rail: that layout reserved a fixed-width column that
          stayed mostly blank whenever there were only a couple of insights,
          leaving a large empty strip down the right side of the page. As a
          grid card it's only as tall as its own content. */}
      <div className="card" style={{ padding: 0, background: "var(--bg-sidebar)" }}>
        <div className="agent-header">
          Alerts and signals
        </div>
        <div className="agent-feed">
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <Loader size={20} />
            </div>
          ) : insights.length > 0 ? (
            insights.slice(0, 5).map((insight: any, idx: number) => (
              <div key={idx} className="feed-item">
                <div className="feed-meta">
                  <span>{titleCase(insight.category || "Insight")}</span>
                  {insight.severity && (
                    <span
                      style={{
                        color: ["high", "critical"].includes(String(insight.severity).toLowerCase())
                          ? "var(--status-danger-text, var(--status-danger))"
                          : String(insight.severity).toLowerCase() === "medium"
                            ? "var(--status-warning-text, var(--status-warning))"
                            : "var(--text-secondary)",
                      }}>
                      {titleCase(String(insight.severity))} priority
                    </span>
                  )}
                </div>
                <div className="feed-content">
                  <span className="highlight-text">
                    {insight.title || insight.message}
                  </span>
                  {insight.body && insight.body !== insight.title && (
                    <span style={{ display: "block", color: "var(--text-secondary)" }}>{insight.body}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            // Honest empty state — the old fallback rendered hardcoded FAKE
            // activity (Truck 42, INV-2024-09, LogiCorp, TRK-892) that looked
            // live but matched no real record, so clicking "Ask Copilot" about it
            // returned "no such record". Show nothing invented instead.
            <div className="feed-item">
              <div className="feed-meta">
                <span>Alerts</span>
              </div>
              <div className="feed-content">
                No alerts yet. As your quotes, invoices and fleet data grow,
                signals will appear here.{" "}
                <button
                  className="btn-action"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate("/copilot")}>
                  Ask Copilot
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
