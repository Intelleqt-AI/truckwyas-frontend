import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fetchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const BAND_COLOR: Record<string, string> = {
  LOW: "var(--status-success)",
  MEDIUM: "var(--status-warning)",
  HIGH: "var(--status-danger)",
  CRITICAL: "var(--status-danger)",
  NEW: "var(--text-tertiary)",
};

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
    document.title = "AI Risk Profile - TruckWys";
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 40 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ height: 16, background: "var(--bg-surface)", borderRadius: 4, marginBottom: 12, width: "40%" }} />
          <div style={{ height: 32, background: "var(--bg-surface)", borderRadius: 4, width: "25%" }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 13, color: "var(--status-danger)", marginBottom: 12 }}>
          Customer risk profile not found
        </div>
        <button className="btn-action" onClick={() => navigate("/capital")}>Back to Capital</button>
      </div>
    );
  }

  const bandColor = BAND_COLOR[data.band] || "var(--text-tertiary)";
  const rows: RiskRow[] = data.rows || [];
  const stats = data.stats || {};

  // Chronological for the chart (endpoint returns newest first)
  const chartData = [...rows]
    .filter((r) => r.days_late !== null)
    .reverse()
    .map((r) => ({
      ...r,
      label: (r.issue_date || r.due_date || "").slice(5), // MM-DD
    }));

  const onTime = rows.filter((r) => r.paid_date && (r.days_late ?? 0) <= 0).length;
  const normalLate = rows.filter((r) => (r.days_late ?? 0) > 0 && (r.days_late ?? 0) <= 30).length;
  const beyond30 = rows.filter((r) => (r.days_late ?? 0) > 30).length;
  const compTotal = Math.max(1, onTime + normalLate + beyond30);

  const kpis = [
    { label: "AI RISK", value: `${data.risk_pct}%`, color: bandColor },
    { label: "AVG DAYS TO PAY", value: stats.avg_days_to_pay ?? "—" },
    { label: "ON-TIME RATE", value: stats.on_time_pct !== null && stats.on_time_pct !== undefined ? `${stats.on_time_pct}%` : "—" },
    { label: "OVERDUE >30D", value: formatCurrency(stats.overdue_30_total || 0) },
  ];

  const legend = [
    { label: "Early / on time", color: "var(--status-success)" },
    { label: "Late ≤30d (normal)", color: "var(--accent-primary)" },
    { label: "Late >30d", color: "var(--status-danger)" },
  ];

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)", cursor: "pointer", padding: 0, marginBottom: 14, letterSpacing: "0.06em" }}>
        ← BACK
      </button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 4 }}>
            AI RISK PROFILE
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>{data.customer_name}</div>
        </div>
        <div
          title={data.insufficient_history ? "Fewer than 3 invoices — insufficient history" : `Risk band: ${data.band}`}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: bandColor,
            border: `2px solid ${bandColor}`, borderRadius: 8, padding: "10px 22px",
          }}>
          {data.risk_pct}%
          <span style={{ fontSize: 10, display: "block", textAlign: "center", letterSpacing: "0.08em" }}>{data.band}</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ color: (k as any).color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 8 }}>
          REAL-TIME AI SUMMARY
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, textAlign: "justify" }}>
          {data.ai_summary}
        </div>
      </div>

      {/* Lateness chart */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 4 }}>
          <span className="card-title">Payment lateness by invoice</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            DAYS PAST DUE · 30D = NORMAL LIMIT
          </span>
        </div>
        {/* Legend — identity never by color alone (threshold line + table below) */}
        <div style={{ display: "flex", gap: 16, margin: "6px 0 10px" }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: "inline-block" }} />
              {l.label}
            </span>
          ))}
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
            No payment history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 11 }}
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
                label={{ value: "30d normal limit", position: "insideTopRight", fontSize: 10, fill: "var(--status-warning)", fontFamily: "var(--font-mono)" }}
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
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
              {onTime > 0 && <div style={{ flex: onTime / compTotal, background: "var(--status-success)" }} />}
              {normalLate > 0 && <div style={{ flex: normalLate / compTotal, background: "var(--accent-primary)" }} />}
              {beyond30 > 0 && <div style={{ flex: beyond30 / compTotal, background: "var(--status-danger)" }} />}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              <span>{onTime} on time</span>
              <span>{normalLate} late ≤30d</span>
              <span>{beyond30} late &gt;30d</span>
            </div>
          </div>
        )}
      </div>

      {/* Payment behavior table */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Payment Behavior</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            {rows.length} INVOICES
          </span>
        </div>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
            No invoices for this customer yet.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Payment Date</th>
                <th>Days to Pay</th>
                <th>Days Late</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoice_number}>
                  <td className="mono">{r.invoice_number}</td>
                  <td className="mono">{r.issue_date || "—"}</td>
                  <td className="mono">{r.due_date}</td>
                  <td className="mono">{r.paid_date || "—"}</td>
                  <td className="mono">{r.days_to_pay ?? "—"}</td>
                  <td className="mono" style={{ color: lateColor(r.days_late) }}>
                    {r.days_late === null ? "—" : r.days_late > 0 ? `+${r.days_late}` : r.days_late}
                  </td>
                  <td className="mono">{formatCurrency(r.amount)}</td>
                  <td>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: r.status === "PAID" ? "var(--status-success)" : r.days_late !== null && r.days_late > 30 ? "var(--status-danger)" : "var(--text-secondary)" }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
