import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";

// Fetches + derives all dashboard data. Lives in the queryFn so the result is
// cached by TanStack Query (keyed below) and survives navigation — revisiting
// the page no longer refires these 8 requests until the cache goes stale.
async function loadOverview() {
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
    fetchData("api/v1/dashboard/finance/").catch(() => null),
    fetchData("api/v1/dashboard/signals/").catch(() =>
      fetchData("api/v1/dashboard/insights/").catch(() => []),
    ),
    fetchData("api/v1/advances/").catch(() => []),
    fetchData("api/v1/quotes/?limit=5").catch(() => []),
    fetchData("api/v1/loads/").catch(() => []),
    fetchData("api/v1/activity/").catch(() => []),
    fetchData("api/v1/vehicles/").catch(() => []),
    fetchData("api/v1/fleet/overview/").catch(() => null),
    // Invoices that qualify for a fast-pay advance but don't have one
    // requested yet — this is the actionable "Capital" opportunity today,
    // since the Capital page's "Apply" button routes to an external lender
    // (Merchant Capital) and never creates an internal AdvanceRequest.
    fetchData("api/v1/capital/eligible/").catch(() => null),
  ]);

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
    fleetData?.active_vehicles ||
    vehicles.filter(
      (v: any) => v.status === "AVAILABLE" || v.status === "IN_USE",
    ).length ||
    0;

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
    financeData: finance,
    insights,
    advances,
    eligibleInvoicesCount,
    recentQuotes,
    recentLoads,
    activeLoadsCount,
    totalVehicles,
    activeVehicles,
    activity,
    heatmapData,
  };
}

const CARD_MENUS: Record<string, { label: string; route: string }[]> = {
  revenue: [
    { label: "View Revenue Report", route: "/finance/reports" },
    { label: "View All Invoices",   route: "/finance/invoices" },
    { label: "New Invoice",         route: "/finance/invoices/new" },
  ],
  margin: [
    { label: "View Finance Reports", route: "/finance/reports" },
    { label: "View Expenses",        route: "/finance/expenses" },
  ],
  outstanding: [
    { label: "View Outstanding Invoices", route: "/finance/invoices?status=OVERDUE" },
    { label: "View All Invoices",         route: "/finance/invoices" },
    { label: "Request Capital Advance",   route: "/capital" },
  ],
};

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";

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

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["overview-dashboard"],
    queryFn: loadOverview,
  });

  // Cached data drives the view; defaults keep the first render safe.
  const financeData = data?.financeData ?? null;
  const insights = data?.insights ?? [];
  const advances = data?.advances ?? [];
  // Advances actually in TruckWys's own request pipeline — REQUESTED
  // (submitted, not yet scored) or SCORING (risk engine actively evaluating
  // it). In practice this is usually 0: the Capital page's "Apply" button
  // routes to an external lender (Merchant Capital) rather than creating an
  // AdvanceRequest, so it's added to the eligible-invoice count below rather
  // than shown alone.
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
    return date.toLocaleDateString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
    <div style={{ display: "flex", gap: 24, alignItems: "start" }}>
      {/* MAIN WORKSPACE */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          alignContent: "start",
        }}>
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
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                  {formatDate(currentTime)}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    marginTop: 1,
                  }}>
                  {formatTime(currentTime)}{" "}
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      marginLeft: 4,
                    }}>
                    SAST
                  </span>
                </div>
              </div>
              <LiveBadge />
            </div>

            {/* Actionable pulse — clickable */}
            <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
              {(
                [
                  {
                    label: "Active loads",
                    value: String(activeLoadsCount),
                    route: "/bookings",
                    warn: false,
                  },
                  {
                    label: "Fleet ready",
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
                <div
                  key={s.label}
                  onClick={() => navigate(s.route)}
                  style={{ cursor: "pointer", textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 2,
                    }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: s.warn
                        ? "var(--status-warning)"
                        : "var(--text-primary)",
                    }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">
              {loading ? "Loading..." : "Total Revenue"}
            </span>
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                className="card-action"
                onClick={() => setOpenMenu(openMenu === "revenue" ? null : "revenue")}>
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
              {openMenu === "revenue" && (
                <div style={{ position: "absolute", top: 22, right: 0, zIndex: 1000, background: "var(--bg-deep)", border: "1px solid var(--border-active)", borderRadius: 6, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {CARD_MENUS.revenue.map(item => (
                    <div key={item.route} onClick={() => { setOpenMenu(null); navigate(item.route); }}
                      style={{ padding: "9px 14px", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--accent-glow)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="metric-value">
            {loading ? "..." : formatCurrency(financeData?.total_revenue || 0)}
          </div>
          {typeof financeData?.revenue_change_pct === "number" ? (
            <div
              className={`metric-delta ${financeData.revenue_change_pct >= 0 ? "delta-up" : "delta-down"}`}>
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
            <div className="metric-delta delta-neutral">
              <span>last 30 days</span>
            </div>
          )}
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">
              {loading ? "Loading..." : "Net Margin"}
            </span>
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                className="card-action"
                onClick={() => setOpenMenu(openMenu === "margin" ? null : "margin")}>
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
              {openMenu === "margin" && (
                <div style={{ position: "absolute", top: 22, right: 0, zIndex: 1000, background: "var(--bg-deep)", border: "1px solid var(--border-active)", borderRadius: 6, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {CARD_MENUS.margin.map(item => (
                    <div key={item.route} onClick={() => { setOpenMenu(null); navigate(item.route); }}
                      style={{ padding: "9px 14px", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--accent-glow)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className="metric-value"
            style={{ color: "var(--accent-primary)" }}>
            {loading
              ? "..."
              : formatPercent(financeData?.net_margin_percent || 0)}
          </div>
          {typeof financeData?.margin_change_pts === "number" ? (
            <div
              className={`metric-delta ${financeData.margin_change_pts >= 0 ? "delta-up" : "delta-down"}`}>
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
            <div className="metric-delta delta-neutral">
              <span>last 30 days</span>
            </div>
          )}
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span className="card-title">
              {loading ? "Loading..." : "Outstanding"}
            </span>
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                className="card-action"
                onClick={() => setOpenMenu(openMenu === "outstanding" ? null : "outstanding")}>
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
              {openMenu === "outstanding" && (
                <div style={{ position: "absolute", top: 22, right: 0, zIndex: 1000, background: "var(--bg-deep)", border: "1px solid var(--border-active)", borderRadius: 6, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {CARD_MENUS.outstanding.map(item => (
                    <div key={item.route} onClick={() => { setOpenMenu(null); navigate(item.route); }}
                      style={{ padding: "9px 14px", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--accent-glow)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className="metric-value"
            style={{ color: "var(--status-warning)" }}>
            {loading
              ? "..."
              : formatCurrency(financeData?.outstanding_invoices_total || 0)}
          </div>
          <div className="metric-delta delta-neutral">
            <span>
              DSO: {loading ? "—" : Math.round(financeData?.dso || 0)} days
            </span>
          </div>
        </div>

        {/* Chart card */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">
              Revenue vs Fuel Cost (Last 30 Days)
            </span>
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 10,
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
                Fuel cost
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
            const labels = trend.map((m: any) => m.month?.slice(5) || "");
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
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                  }}>
                  {labels.slice(-4).map((l: string, i: number) => (
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
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}>
            <span>
              Net Margin{" "}
              <span style={{ color: "var(--accent-primary)" }}>
                {financeData?.net_margin_percent != null
                  ? `${(financeData.net_margin_percent || 0).toFixed(1)}%`
                  : "—"}
              </span>
            </span>
            <span>
              Fuel/Rev ratio{" "}
              <span style={{ color: "var(--status-warning)" }}>
                {financeData?.monthly_trend?.length > 0
                  ? `${Math.round(((financeData.monthly_trend.at(-1)?.expenses || 0) / Math.max(financeData.monthly_trend.at(-1)?.revenue || 1, 1)) * 100)}%`
                  : "—"}
              </span>
            </span>
            <span>
              Trend{" "}
              <span style={{ color: "var(--status-success)" }}>
                ↑ improving
              </span>
            </span>
          </div>
        </div>

        {/* Utilization card */}
        <div className="card utilization-card">
          <div className="card-header">
            <span className="card-title">Fleet Utilization (Last 28 Days)</span>
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
                  fontSize: 24,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}>
                {totalVehicles > 0
                  ? `${Math.round((activeVehicles / totalVehicles) * 100)}%`
                  : "—"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}>
                {activeVehicles} of {totalVehicles} vehicles active
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Active Loads
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--accent-primary)",
                  fontFamily: "var(--font-mono)",
                }}>
                {activeLoadsCount}
              </div>
            </div>
          </div>
          <div className="heatmap-grid">
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
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}>
            {totalVehicles > 0
              ? `${totalVehicles - activeVehicles} vehicle${totalVehicles - activeVehicles !== 1 ? "s" : ""} available`
              : "Loading..."}
          </div>
        </div>

        {/* Recent Quotes */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent Quotes</span>
            <button
              onClick={() => navigate("/bookings/quotes")}
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "4px 8px",
                fontSize: 10,
                borderRadius: 2,
                cursor: "pointer",
              }}>
              View all
            </button>
          </div>
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}>
              Loading quotes...
            </div>
          ) : recentQuotes.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Total</th>
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
                      style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                      {quote.pickup_location?.split(" ").slice(0, 2).join(" ")}{" "}
                      →{" "}
                      {quote.delivery_location
                        ?.split(" ")
                        .slice(0, 2)
                        .join(" ")}
                    </td>
                    <td
                      style={{
                        color: "var(--accent-primary)",
                        fontFamily: "var(--font-mono)",
                      }}>
                      {formatCurrency(parseFloat(quote.total_amount || "0"))}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color:
                            quote.status === "ACCEPTED"
                              ? "var(--status-success)"
                              : quote.status === "SENT"
                                ? "var(--status-warning)"
                                : "var(--text-tertiary)",
                          padding: "2px 6px",
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

        {/* Recent Bookings */}
        <div className="card table-card">
          <div className="card-header">
            <span className="card-title">Recent Bookings</span>
            <button
              onClick={() => navigate("/bookings")}
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "4px 8px",
                fontSize: 10,
                borderRadius: 2,
                cursor: "pointer",
              }}>
              View all
            </button>
          </div>
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}>
              Loading bookings...
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
                      style={{ color: "var(--text-secondary)", fontSize: 11 }}>
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
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color:
                            load.status === "DELIVERED"
                              ? "var(--status-success)"
                              : load.status === "IN_TRANSIT"
                                ? "var(--accent-primary)"
                                : "var(--text-tertiary)",
                          padding: "2px 6px",
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

        {/* Quick Actions */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Quick Actions
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}>
            <button
              onClick={() => navigate("/finance/invoices/new")}
              className="btn-action"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 12px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
              }}>
              Create Invoice
            </button>
            <button
              onClick={() => navigate("/capital")}
              className="btn-action"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 12px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              Request Advance
            </button>
            <button
              onClick={() => navigate("/finance/expenses")}
              className="btn-action"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 12px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              Add Expense
            </button>
            <button
              onClick={() => navigate("/finance/reports")}
              className="btn-action"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 12px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
              View Reports
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Recent Activity
          </div>
          {activityLoading ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              Loading...
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
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {e.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
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
      </div>

      {/* AGENT SIDEBAR */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--card-radius)",
          background: "var(--bg-sidebar)",
          display: "flex",
          flexDirection: "column",
        }}>
        <div className="agent-header">
          <div className="live-dot" />
          Agent Activity Stream
        </div>
        <div className="agent-feed">
          {loading ? (
            <div className="feed-item">
              <div className="feed-meta">
                <span>LOADING</span>
                <span>...</span>
              </div>
              <div className="feed-content">Loading insights...</div>
            </div>
          ) : insights.length > 0 ? (
            insights.slice(0, 5).map((insight: any, idx: number) => (
              <div key={idx} className="feed-item">
                <div className="feed-meta">
                  <span
                    style={{
                      color:
                        insight.priority === "high"
                          ? "var(--accent-primary)"
                          : "inherit",
                    }}>
                    {insight.category?.toUpperCase() || "INSIGHT"}
                  </span>
                  <span>{insight.time_ago || "NOW"}</span>
                </div>
                <div className="feed-content">
                  <span className="highlight-text">
                    {insight.title || insight.message}
                  </span>
                  {insight.description && ` ${insight.description}`}
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
                <span>AGENT</span>
                <span>—</span>
              </div>
              <div className="feed-content">
                No agent activity yet. As your quotes, invoices and fleet data grow,
                insights will appear here.{" "}
                <button
                  className="btn-action"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate("/copilot")}>
                  ASK COPILOT
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
