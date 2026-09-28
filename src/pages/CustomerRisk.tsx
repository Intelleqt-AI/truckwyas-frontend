import './table-heading-roles.css';
import './finance-brand.css';
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fetchData } from "@/lib/Api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Loader } from "@/components/Loader";

const BAND_TONE: Record<string, string> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
  NEW: "neutral",
};
const chip = (tone?: string) => `fin-chip${tone && tone !== "neutral" ? ` fin-chip--${tone}` : ""}`;
const fmtStatus = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";
const safeDate = (d?: string | null) => {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};
// Text colour for lateness values (AA text roles, not chart swatches).
const lateTextClass = (daysLate: number | null) =>
  daysLate === null ? "fin-text-muted" : daysLate > 30 ? "fin-text-danger" : "";

// Status encoding for lateness relative to the 30-day "normal" threshold.
// Color never stands alone: the 30d reference line, the legend, and the
// payment table below carry the same information.
const lateColor = (daysLate: number | null) => {
  if (daysLate === null) return "var(--text-tertiary)";
  if (daysLate > 30) return "var(--status-danger)";
  if (daysLate > 0) return "var(--accent-primary)";
  return "var(--status-success)";
};

interface RiskRow {
  invoice_number: string;
  issue_date: string | null;
  due_date: string;
  paid_date: string | null;
  days_to_pay: number | null;
  days_late: number | null;
  amount: number;
  balance: number;
  status: string;
}

export default function CustomerRisk() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-risk", id],
    queryFn: () => fetchData(`api/v1/customers/${id}/risk-profile/`),
    retry: 1,
  });

  useEffect(() => {
    document.title = "AI risk profile - TruckWys";
  }, []);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (error || !data) {
    return (
      <div className="fin-page">
        <div className="card fin-empty">
          <h1 className="fin-empty__title" style={{ fontSize: 22, lineHeight: "28px" }}>Risk profile not found</h1>
          <p className="fin-empty__body">We couldn’t load this customer’s risk profile.</p>
          <button className="btn-action" onClick={() => navigate("/capital")}>Back to Capital</button>
        </div>
      </div>
    );
  }

  const bandTone = BAND_TONE[data.band] || "neutral";
  const bandLabel = data.band === "NEW" ? "New customer" : `${fmtStatus(data.band)} risk`;
  const rows: RiskRow[] = data.rows || [];
  const stats = data.stats || {};

  // Chronological for the chart (endpoint returns newest first)
  const chartData = [...rows]
    .filter((r) => r.days_late !== null)
    .reverse()
    .map((r) => ({
      ...r,
      label: safeDate(r.issue_date || r.due_date).replace(/ \d{4}$/, ""), // e.g. "16 Jun"
    }));

  const onTime = rows.filter((r) => r.paid_date && (r.days_late ?? 0) <= 0).length;
  const normalLate = rows.filter((r) => (r.days_late ?? 0) > 0 && (r.days_late ?? 0) <= 30).length;
  const beyond30 = rows.filter((r) => (r.days_late ?? 0) > 30).length;
  const compTotal = Math.max(1, onTime + normalLate + beyond30);

  const kpis = [
    { label: "AI risk", value: `${data.risk_pct}%`, sub: bandLabel },
    { label: "Average days to pay", value: stats.avg_days_to_pay ?? "—", sub: "Settled invoices" },
    { label: "On-time rate", value: stats.on_time_pct !== null && stats.on_time_pct !== undefined ? `${stats.on_time_pct}%` : "—", sub: "Paid by due date" },
    { label: "Overdue more than 30 days", value: formatCurrency(stats.overdue_30_total || 0), sub: "Outstanding" },
  ];

  const legend = [
    { label: "Early / on time", color: "var(--status-success)" },
    { label: "Late ≤30 days (normal)", color: "var(--accent-primary)" },
    { label: "Late >30 days", color: "var(--status-danger)" },
  ];

  return (
    <div className="fin-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 14, lineHeight: "20px", fontWeight: 500, cursor: "pointer", padding: 0, marginBottom: 8, minHeight: 40 }}>
        ← Back
      </button>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>AI risk profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{data.customer_name}</h1>
            <span
              className={chip(bandTone)}
              title={data.insufficient_history ? "Fewer than 3 invoices — insufficient history" : `Risk band: ${fmtStatus(data.band)}`}>
              {bandLabel} · {data.risk_pct}%
            </span>
          </div>
          {data.insufficient_history && (
            <p className="fin-support" style={{ marginTop: 4 }}>Fewer than 3 invoices — limited history, treat this score with caution.</p>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className="fin-kpis">
        {kpis.map((k, i) => (
          <div key={k.label} className="card fin-kpi">
            <span className="fin-kpi__label">{k.label}</span>
            <span className={`fin-kpi__value ${i === 0 && (bandTone === "danger" || bandTone === "warning") ? `fin-text-${bandTone}` : ""}`}>{k.value}</span>
            <span className="fin-kpi__sub">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <section className="card fin-section" aria-labelledby="ai-summary-title">
        <h2 id="ai-summary-title" className="fin-h2" style={{ marginBottom: 8 }}>AI summary</h2>
        <p style={{ fontSize: 14, lineHeight: "20px", color: "var(--text-secondary)", margin: 0, maxWidth: "80ch" }}>
          {data.ai_summary}
        </p>
      </section>

      {/* Lateness chart */}
      <section className="card fin-section" aria-labelledby="lateness-title">
        <div className="fin-card-head" style={{ marginBottom: 8 }}>
          <h2 id="lateness-title" className="fin-h2">Payment lateness by invoice</h2>
          <span className="fin-support">Days past due · 30 days is the normal limit</span>
        </div>
        {/* Legend — identity never by color alone (threshold line + table below) */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "0 0 12px" }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: "inline-block" }} />
              {l.label}
            </span>
          ))}
        </div>
        {chartData.length === 0 ? (
          <div className="fin-empty fin-empty--compact">No payment history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: 6, fontFamily: "var(--font-sans)", fontSize: 13 }}
                labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }}
                formatter={(value: number, _name, entry: any) => {
                  const r = entry?.payload as RiskRow;
                  const state = r?.paid_date ? "settled" : "still open";
                  return [`${value} days past due (${state})`, r?.invoice_number || ""];
                }}
              />
              <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
              <ReferenceLine
                y={30}
                stroke="var(--status-warning)"
                strokeDasharray="4 4"
                label={{ value: "30-day limit", position: "insideTopRight", fontSize: 12, fill: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}
              />
              <Bar dataKey="days_late" radius={[2, 2, 0, 0]} maxBarSize={26}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={lateColor(entry.days_late)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Composition bar: settled behavior split */}
        {rows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", height: 10, borderRadius: 4, overflow: "hidden", gap: 2 }} aria-hidden="true">
              {onTime > 0 && <div style={{ flex: onTime / compTotal, background: "var(--status-success)" }} />}
              {normalLate > 0 && <div style={{ flex: normalLate / compTotal, background: "var(--accent-primary)" }} />}
              {beyond30 > 0 && <div style={{ flex: beyond30 / compTotal, background: "var(--status-danger)" }} />}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13, lineHeight: "20px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              <span>{onTime} on time</span>
              <span>{normalLate} late ≤30 days</span>
              <span>{beyond30} late &gt;30 days</span>
            </div>
          </div>
        )}
      </section>

      {/* Payment behavior table */}
      <section className="card fin-table-card" aria-labelledby="behaviour-title">
        <div className="fin-table-card__head">
          <h2 id="behaviour-title" className="fin-h2">Payment behaviour</h2>
          <span className="fin-support">{rows.length} {rows.length === 1 ? "invoice" : "invoices"}</span>
        </div>
        {rows.length === 0 ? (
          <div className="fin-empty fin-empty--compact">No invoices for this customer yet.</div>
        ) : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Invoice date</th>
                  <th>Due date</th>
                  <th>Payment date</th>
                  <th className="num">Days to pay</th>
                  <th className="num">Days late</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invoice_number}>
                    <td><span className="fin-id">{r.invoice_number}</span></td>
                    <td className="fin-date">{safeDate(r.issue_date)}</td>
                    <td className="fin-date">{safeDate(r.due_date)}</td>
                    <td className="fin-date">{safeDate(r.paid_date)}</td>
                    <td className="num">{r.days_to_pay ?? "—"}</td>
                    <td className={`num ${lateTextClass(r.days_late)}`}>
                      {r.days_late === null ? "—" : r.days_late > 0 ? `+${r.days_late}` : r.days_late}
                    </td>
                    <td className="num">{formatCurrency(r.amount)}</td>
                    <td>
                      <span className={chip(r.status === "PAID" ? "success" : r.days_late !== null && r.days_late > 30 ? "danger" : "neutral")}>
                        {fmtStatus(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
