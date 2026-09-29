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
import { formatCurrency, formatDate, formatDays, formatPercent } from "@/lib/formatters";
import LoadError, { loadFailed } from "@/components/data/LoadError";
import { KpiRow, KpiStats, KpiTile } from "@/components/ui/KpiTile";
import { InfoTip } from "@/components/ui/InfoTip";
import SectionHeader from "@/components/layout/SectionHeader";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";

const BAND_TONE: Record<string, StatusTone> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
  NEW: "neutral",
};
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

// Lateness relative to the 30-day "normal" threshold. Only lateness beyond
// 30 days counts against the customer, so only that gets a colour; the
// reference line, legend and payment table carry the same information.
const lateColor = (daysLate: number | null) => {
  if (daysLate === null) return "var(--text-tertiary)";
  if (daysLate > 30) return "var(--status-danger)";
  return "var(--text-tertiary)";
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
  const backTo = id ? `/customers/${id}` : "/customers";
  const navigate = useNavigate();

  const riskQuery = useQuery({
    queryKey: ["customer-risk", id],
    queryFn: () => fetchData(`api/v1/customers/${id}/risk-profile/`),
    retry: 1,
  });
  const { data, isLoading, error } = riskQuery;
  const riskFailed = loadFailed(riskQuery);
  const riskError = (riskQuery.error ?? riskQuery.failureReason) as { status?: number } | null;

  useEffect(() => {
    document.title = "Payment risk profile - TruckWys";
  }, []);

  // A failed request is not a missing profile: only a 404 says "not found".
  if (riskFailed && riskError?.status !== 404) {
    return (
      <div className="fin-page">
        <LoadError what="this risk profile" error={riskError} busy={riskQuery.isFetching} onRetry={() => riskQuery.refetch()} />
      </div>
    );
  }

  // Loading: back link and head placeholder at once; only the content waits.
  if (isLoading && !riskFailed) {
    return (
      <div className="fin-page" aria-busy="true" aria-label="Loading risk profile">
        <SectionHeader title="Payment risk profile" back={{ to: backTo, label: 'Customer' }} />
        <div key="skel" className="fin-skel fin-skel--card" aria-hidden="true" style={{ marginTop: 0 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fin-page">
        <div className="card fin-empty">
          <h1 className="fin-empty__title">Risk profile not found</h1>
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

  const invoiceCount: number = stats.invoice_count ?? rows.length;
  const paidCount: number = stats.paid_count ?? rows.filter((r) => r.paid_date).length;
  const lateCount: number = stats.late_count ?? beyond30;
  const name = data.customer_name;

  // Standard tiles; a tile with nothing to show is left out, never a dash.
  const kpis: { label: string; value: string; sub: string; show: boolean }[] = [
    {
      label: "Late-payment risk",
      value: formatPercent(data.risk_pct, Number.isInteger(Number(data.risk_pct)) ? 0 : 1),
      sub: data.insufficient_history
        ? `Fewer than 3 invoices, so this is a starting estimate`
        : `${lateCount} of ${invoiceCount} invoices more than 30 days late`,
      show: true,
    },
    {
      label: "Average time to pay",
      value: stats.avg_days_to_pay != null ? formatDays(stats.avg_days_to_pay) : "—",
      sub: paidCount > 0 ? `Issue to payment, across ${paidCount} paid ${paidCount === 1 ? "invoice" : "invoices"}` : "No paid invoices yet",
      show: stats.avg_days_to_pay != null,
    },
    {
      label: "Paid by the due date",
      value: stats.on_time_pct != null ? formatPercent(stats.on_time_pct, Number.isInteger(Number(stats.on_time_pct)) ? 0 : 1) : "—",
      sub: paidCount > 0 ? `Of ${paidCount} paid ${paidCount === 1 ? "invoice" : "invoices"}` : "No paid invoices yet",
      show: stats.on_time_pct != null,
    },
    {
      label: "Owed more than 30 days late",
      value: (stats.overdue_30_total || 0) > 0 ? formatCurrency(stats.overdue_30_total) : "Nothing",
      sub: stats.outstanding_total != null ? `Of ${formatCurrency(stats.outstanding_total)} unpaid, incl. VAT` : "Unpaid balance, incl. VAT",
      show: (stats.overdue_30_total || 0) > 0,
    },
  ];

  const shownKpis = kpis.filter((k) => k.show);

  const legend = [
    { label: "Paid or open, up to 30 days late (normal)", color: "var(--text-tertiary)" },
    { label: "More than 30 days late", color: "var(--status-danger)" },
  ];

  return (
    <div className="fin-page">
      <SectionHeader
        title={name}
        titleAdornment={
          <StatusChip
            tone={bandTone}
            label={bandLabel}
            title={data.insufficient_history ? "Fewer than 3 invoices: not enough history" : `Risk band: ${fmtStatus(data.band)}`}
          />
        }
        back={{ to: backTo, label: "Customer" }}
        description={<>Payment risk profile{data.blocked && ", invoices can't be advanced"}</>}
      />

      <div key="stack" className="fin-stack fin-stack--16 risk-stack">
      {/* One or two figures: a stats line in one card; three or four: tiles. */}
      {shownKpis.length <= 2 ? (
        <KpiStats
          aria-label="Risk figures"
          items={shownKpis.map((k, i) => ({
            label: k.label,
            aside: i === 0 ? <InfoTip>{"Scored only from how this customer pays: up to 30 days late is treated as normal; later payments and money still owed beyond 30 days raise the risk."}</InfoTip> : undefined,
            figure: k.value,
            note: <span title={k.sub}>{k.sub}</span>,
          }))}
        />
      ) : (
        <KpiRow className="fin-kpi-row">
          {shownKpis.map((k, i) => (
            <KpiTile key={k.label} label={k.label} aside={i === 0 ? <InfoTip>{"Scored only from how this customer pays: up to 30 days late is treated as normal; later payments and money still owed beyond 30 days raise the risk."}</InfoTip> : undefined} figure={k.value} note={<span title={k.sub}>{k.sub}</span>} />
          ))}
        </KpiRow>
      )}

      {data.ai_summary && (
        <section className="card fin-section" aria-labelledby="summary-title">
          <div className="fin-panel-head" style={{ marginBottom: 8 }}>
            <div className="fin-panel-head__text">
              <h2 id="summary-title" className="fin-panel-title">What does this mean for {name}?</h2>
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: "20px", color: "var(--text-secondary)", margin: 0, maxWidth: "80ch" }}>
            {/* The deterministic fallback summary calls the rule-based score "AI"; it isn't. */}
            {String(data.ai_summary).replace(/\ban AI risk score\b/g, "a late-payment risk score")}
          </p>
        </section>
      )}

      <section className="card fin-section" aria-labelledby="lateness-title">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="lateness-title" className="fin-panel-title">How late does {name} pay?</h2>
            <p className="fin-panel-desc">
              Days past the due date for each invoice, oldest first by issue date. Settled invoices show when they were paid; open ones show days late so far.
            </p>
          </div>
        </div>
        <div className="fin-legend-inline" style={{ marginBottom: 12 }}>
          {legend.map((l) => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </div>
        {chartData.length === 0 ? (
          <div className="fin-empty fin-empty--compact">No payment history yet.</div>
        ) : (
          <div role="img" aria-label={`Days late per invoice: ${chartData.map((r) => `${r.invoice_number} ${r.days_late} days`).join("; ")}`}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid stroke="var(--border-row)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontFamily: "var(--font-sans)", fontSize: 13, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: "var(--font-sans)", fontSize: 13, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: "var(--bg-surface-hover)" }}
                  contentStyle={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontFamily: "var(--font-sans)", fontSize: 13 }}
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
                  stroke="var(--text-secondary)"
                  strokeDasharray="4 4"
                  label={{ value: "30 days", position: "insideTopRight", fontSize: 13, fill: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}
                />
                <Bar dataKey="days_late" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={lateColor(entry.days_late)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {rows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 2 }} aria-hidden="true">
              {onTime > 0 && <div style={{ flex: onTime / compTotal, background: "var(--text-tertiary)", opacity: 0.6 }} />}
              {normalLate > 0 && <div style={{ flex: normalLate / compTotal, background: "var(--text-tertiary)" }} />}
              {beyond30 > 0 && <div style={{ flex: beyond30 / compTotal, background: "var(--status-danger)" }} />}
            </div>
            <div className="fin-legend-inline" style={{ marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
              <span>{onTime} paid on time</span>
              <span>{normalLate} up to 30 days late</span>
              <span className={beyond30 > 0 ? "fin-text-danger" : undefined}>{beyond30} more than 30 days late</span>
            </div>
          </div>
        )}
      </section>

      <section className="card fin-table-card" aria-labelledby="behaviour-title">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="behaviour-title" className="fin-panel-title">Which invoices drive the score?</h2>
            <p className="fin-panel-desc">
              {rows.length} {rows.length === 1 ? "invoice" : "invoices"} considered, newest first. Drafts and cancelled invoices are left out.
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="fin-empty fin-empty--compact">No invoices for this customer yet.</div>
        ) : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr>
                  <th>Issued</th>
                  <th>Invoice</th>
                  <th>Due</th>
                  <th>Paid</th>
                  <th className="num">Days to pay</th>
                  <th className="num">Days late</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invoice_number}>
                    <td className="fin-date">{safeDate(r.issue_date)}</td>
                    <td><span className="fin-id">{r.invoice_number}</span></td>
                    <td className="fin-date">{safeDate(r.due_date)}</td>
                    <td className="fin-date">{r.paid_date ? safeDate(r.paid_date) : <span className="fin-text-muted">Not paid</span>}</td>
                    <td className="num">{r.days_to_pay ?? "—"}</td>
                    <td className={`num ${lateTextClass(r.days_late)}`}>
                      {r.days_late === null ? "—" : r.days_late > 0 ? `+${r.days_late}` : r.days_late}
                    </td>
                    <td>
                      <StatusChip size="sm" tone={r.status === "PAID" ? "success" : r.days_late !== null && r.days_late > 30 ? "danger" : "neutral"} label={fmtStatus(r.status)} />
                    </td>
                    <td className="num">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
