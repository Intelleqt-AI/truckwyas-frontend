import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";
import { type RiskTier } from "@/lib/risk-engine";
import {
  allInvoices,
  operators,
  getPortfolioSummary,
  type InvoiceWithRisk,
} from "@/mocks/risk-mock-data";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Tier Config ──────────────────────────────────────────────────

const TIER_CONFIG: Record<RiskTier, { label: string; color: string; bgAlpha: string }> = {
  prime:      { label: "PRIME",      color: "#10B981", bgAlpha: "rgba(16,185,129,0.08)" },
  standard:   { label: "STANDARD",   color: "#2563EB", bgAlpha: "rgba(37,99,235,0.08)" },
  elevated:   { label: "ELEVATED",   color: "#F59E0B", bgAlpha: "rgba(245,158,11,0.08)" },
  high:       { label: "HIGH",       color: "#EF4444", bgAlpha: "rgba(239,68,68,0.08)" },
  ineligible: { label: "INELIGIBLE", color: "#64748B", bgAlpha: "rgba(100,116,139,0.08)" },
};

// ─── Chart tooltip style ──────────────────────────────────────────

const chartTooltipStyle = {
  contentStyle: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  itemStyle: { color: "#0F172A" },
  labelStyle: { color: "#94A3B8", fontSize: 11 },
};

// ─── Sub-components ───────────────────────────────────────────────

function KPICard({ label, value, color, sub }: {
  label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div className="card metric-card">
      <div className="card-header"><span className="card-title">{label}</span></div>
      <div
        className="metric-value"
        style={{ fontSize: 20, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
      marginBottom: 12, letterSpacing: "0.02em",
    }}>
      {children}
    </div>
  );
}

function TierBadge({ tier }: { tier: RiskTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      color: cfg.color, background: cfg.bgAlpha,
      padding: "2px 8px", borderRadius: 2, textTransform: "uppercase",
      letterSpacing: "0.06em",
    }}>
      {cfg.label}
    </span>
  );
}

// ─── SHAP-style Waterfall Chart ───────────────────────────────────

function SHAPWaterfall({ invoice }: { invoice: InvoiceWithRisk }) {
  const pillars = invoice.riskScore.pillarBreakdown;
  const avgScore = 50; // baseline reference

  const waterfallData = pillars.map(p => {
    const deviation = p.rawScore - avgScore;
    return {
      name: p.pillar.replace(" & ", " & ").replace("Proof of Delivery & Documentation", "POD & Docs"),
      value: deviation,
      rawScore: p.rawScore,
      weight: p.weight,
      fill: deviation >= 0 ? "#10B981" : "#EF4444",
    };
  }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Risk Factor Contributions
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          Deviation from baseline (50)
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={waterfallData} layout="vertical" margin={{ left: 120, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
          <XAxis
            type="number"
            domain={[-50, 50]}
            tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickFormatter={v => v > 0 ? `+${v}` : `${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#475569", fontSize: 10 }}
            width={115}
          />
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value: number, _name: string, props: any) => {
              const entry = props.payload;
              return [
                `${value > 0 ? "+" : ""}${value.toFixed(0)} (raw: ${entry.rawScore}, weight: ${(entry.weight * 100).toFixed(0)}%)`,
                "Contribution",
              ];
            }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
            {waterfallData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Top risk drivers and strengths */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#EF4444", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
            TOP RISK DRIVERS
          </div>
          {invoice.riskScore.topRiskDrivers.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>None identified</div>
          ) : (
            invoice.riskScore.topRiskDrivers.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2, display: "flex", gap: 6 }}>
                <span style={{ color: "#EF4444", fontFamily: "var(--font-mono)", minWidth: 55, fontSize: 10 }}>{d.impact}</span>
                <span>{d.factor}</span>
              </div>
            ))
          )}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#10B981", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
            TOP STRENGTHS
          </div>
          {invoice.riskScore.topStrengths.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2, display: "flex", gap: 6 }}>
              <span style={{ color: "#10B981", fontFamily: "var(--font-mono)", minWidth: 55, fontSize: 10 }}>{s.impact}</span>
              <span>{s.factor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Facility Gauge ───────────────────────────────────────────────

function FacilityGauge({ utilization, outstanding, limit, available }: {
  utilization: number; outstanding: number; limit: number; available: number;
}) {
  const gaugeColor = utilization > 90 ? "#EF4444" : utilization > 75 ? "#F59E0B" : utilization > 50 ? "#2563EB" : "#10B981";

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>Facility Utilisation</SectionTitle>
        <div style={{
          fontSize: 20, fontWeight: 700, color: gaugeColor,
          fontFamily: "var(--font-mono)",
        }}>
          {utilization}%
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{
          background: "var(--bg-surface)", borderRadius: 4, height: 20, width: "100%",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(utilization, 100)}%`,
            height: "100%",
            background: gaugeColor,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }} />
        </div>
        {/* Warning threshold markers */}
        <div style={{ position: "absolute", left: "75%", top: -4, bottom: -4, width: 1, borderLeft: "1px dashed #F59E0B" }} />
        <div style={{ position: "absolute", left: "90%", top: -4, bottom: -4, width: 1, borderLeft: "1px dashed #EF4444" }} />
      </div>

      {/* Breakdown strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 2 }}>
            OUTSTANDING
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#EF4444", fontFamily: "var(--font-mono)" }}>
            {formatCurrency(outstanding)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 2 }}>
            FACILITY LIMIT
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            {formatCurrency(limit)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 2 }}>
            AVAILABLE
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#10B981", fontFamily: "var(--font-mono)" }}>
            {formatCurrency(available)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function Capital() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facility, setFacility] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [eligibleInvoices, setEligibleInvoices] = useState<any[]>([]);
  const [requestingIds, setRequestingIds] = useState<Set<number>>(new Set());
  const [settlingIds, setSettlingIds] = useState<Set<number>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedAdvance, setExpandedAdvance] = useState<string | null>(null);

  // ─── Derived mock data ──────────────────────────────────────────
  const mockData = useMemo(() => {
    const portfolio = getPortfolioSummary();
    const eligible = allInvoices.filter(i => i.riskScore.isEligible);
    const tiers: RiskTier[] = ["prime", "standard", "elevated", "high", "ineligible"];

    const tierData = tiers.map(t => {
      const items = allInvoices.filter(i => i.riskScore.riskTier === t);
      return {
        tier: TIER_CONFIG[t].label,
        key: t as RiskTier,
        color: TIER_CONFIG[t].color,
        count: items.length,
        amount: items.reduce((s, i) => s + i.invoice.amount, 0),
        pct: allInvoices.length > 0 ? (items.length / allInvoices.length) * 100 : 0,
      };
    });

    // Use first 3 operators as example for facility data
    const totalFacility = operators.reduce((s, o) => s + o.facilityLimit, 0);
    const totalUsed = operators.reduce(
      (s, o) => s + (o.facilityLimit * o.clientFinancial.advanceUtilizationRate / 100), 0
    );

    // Recent advances (mock from allInvoices that are eligible, sorted by score)
    const advanceHistory = allInvoices
      .filter(i => i.riskScore.isEligible)
      .sort((a, b) => b.riskScore.finalScore - a.riskScore.finalScore)
      .slice(0, 12)
      .map((inv, idx) => ({
        ...inv,
        advanceId: `ADV-2026-${String(idx + 1).padStart(3, "0")}`,
        advanceDate: new Date(Date.now() - (idx * 3 + Math.random() * 5) * 24 * 60 * 60 * 1000).toISOString(),
        status: idx < 3 ? "ACTIVE" : idx < 6 ? "DISBURSED" : "SETTLED",
      }));

    return {
      portfolio,
      tierData,
      eligible,
      totalFacility,
      totalUsed,
      advanceHistory,
    };
  }, []);

  // ─── API calls ──────────────────────────────────────────────────

  const handleRequestAdvance = async (invoice: any) => {
    setRequestingIds(prev => new Set(prev).add(invoice.id));
    setSuccessMessage(null);
    try {
      await postData({ url: "api/v1/advances/", data: { invoice_id: invoice.id } });
      setSuccessMessage(`Advance request submitted for ${invoice.invoice_number}`);
      const advancesData = await fetchData("api/v1/advances/");
      const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
      setAdvances(advancesList.filter((a: any) => a.status === "ACTIVE" || a.status === "FUNDED" || a.status === "DISBURSED"));
      const eligibleData = await fetchData("api/v1/capital/eligible/");
      setEligibleInvoices(eligibleData?.invoices || []);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.invoice_id?.[0] || err?.message || "Request failed";
      setSuccessMessage(null);
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setRequestingIds(prev => { const n = new Set(prev); n.delete(invoice.id); return n; });
    }
  };

  const handleSettleAdvance = async (advance: any) => {
    setSettlingIds(prev => new Set(prev).add(advance.id));
    setSuccessMessage(null);
    try {
      await postData({ url: `/api/v1/advances/${advance.id}/settle/`, data: {} });
      setSuccessMessage(`Advance ${advance.invoice_number} settled successfully`);
      const advancesData = await fetchData("api/v1/advances/");
      const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
      setAdvances(advancesList.filter((a: any) => a.status === "ACTIVE" || a.status === "FUNDED" || a.status === "DISBURSED"));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage("Failed to settle advance. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setSettlingIds(prev => { const n = new Set(prev); n.delete(advance.id); return n; });
    }
  };

  // ─── Computed values ────────────────────────────────────────────

  const eligibleTotal = eligibleInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.amount || 0), 0);
  const outstanding = facility?.outstanding_advances || 0;
  const facilityLimit = facility?.facility_limit || 1000000;
  const available = facilityLimit - outstanding;
  const utilization = facilityLimit > 0 ? Math.round((outstanding / facilityLimit) * 100) : 0;

  // ─── Load data ──────────────────────────────────────────────────

  useEffect(() => {
    document.title = "Capital - TruckWys";
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const facilityData = await fetchData("api/v1/facilities/");
        const facilityList = Array.isArray(facilityData) ? facilityData : (facilityData?.results || []);
        setFacility(facilityList[0] || null);

        const advancesData = await fetchData("api/v1/advances/");
        const advancesList = Array.isArray(advancesData) ? advancesData : (advancesData?.results || []);
        setAdvances(advancesList.filter((a: any) => a.status === "ACTIVE" || a.status === "FUNDED" || a.status === "DISBURSED"));

        const eligibleData = await fetchData("api/v1/capital/eligible/");
        setEligibleInvoices(eligibleData?.invoices || []);
      } catch {
        setError("Failed to load capital data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ─── Loading skeleton ──────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>Fast Pay Facility</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <div className="animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 12, background: "var(--bg-surface)", borderRadius: 4, width: "60%" }} />
                <div style={{ height: 24, background: "var(--bg-surface)", borderRadius: 4, width: "40%" }} />
                <div style={{ height: 10, background: "var(--bg-surface)", borderRadius: 4, width: "50%" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {[1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <div className="animate-pulse">
                <div style={{ height: 16, background: "var(--bg-surface)", borderRadius: 4, width: "30%", marginBottom: 16 }} />
                <div style={{ height: 200, background: "var(--bg-surface)", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="animate-pulse">
            <div style={{ height: 16, background: "var(--bg-surface)", borderRadius: 4, width: "20%", marginBottom: 16 }} />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 40, background: "var(--bg-surface)", borderRadius: 4, marginBottom: 8 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>Fast Pay Facility</div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }}>—</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{error}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Unable to load capital data. Please try again later.</div>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Capital</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>Fast Pay Facility</div>
        </div>
        {eligibleInvoices.length > 0 && (
          <button
            onClick={() => navigate("/capital/request")}
            style={{
              background: "var(--accent-primary)",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 20px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            REQUEST EARLY PAY
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
          color: "#10B981", padding: "10px 16px", borderRadius: 4, marginBottom: 16,
          fontSize: 12, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontWeight: 600 }}>OK</span> {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#EF4444", padding: "10px 16px", borderRadius: 4, marginBottom: 16,
          fontSize: 12, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontWeight: 600 }}>ERR</span> {errorMessage}
        </div>
      )}

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KPICard
          label="Available Capital"
          value={formatCurrency(available)}
          color="#10B981"
          sub={`of ${formatCurrency(facilityLimit)} limit`}
        />
        <KPICard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          color={utilization > 75 ? "#EF4444" : "#F59E0B"}
          sub={`${utilization}% utilisation`}
        />
        <KPICard
          label="Eligible Invoices"
          value={eligibleInvoices.length}
          color="var(--accent-primary)"
          sub="ready for fast pay"
        />
        <KPICard
          label="Eligible Value"
          value={formatCurrency(eligibleTotal)}
          sub="total available"
        />
      </div>

      {/* Facility Gauge + Risk Distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <FacilityGauge
          utilization={utilization}
          outstanding={outstanding}
          limit={facilityLimit}
          available={available}
        />

        {/* Risk Distribution */}
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Portfolio Risk Distribution</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={mockData.tierData.filter(d => d.count > 0)}
                  dataKey="count"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={35}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {mockData.tierData.filter(d => d.count > 0).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(value: number, name: string) => [`${value} invoices`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mockData.tierData.map(d => (
                <div key={d.tier} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{d.tier}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 500 }}>
                      {d.count}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", minWidth: 36, textAlign: "right" }}>
                      {d.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier exposure bar chart */}
          <div style={{ marginTop: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 8 }}>
              EXPOSURE BY TIER
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={mockData.tierData.filter(d => d.count > 0)} layout="vertical" margin={{ left: 70, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="tier" tick={{ fill: "#94A3B8", fontSize: 9 }} width={65} axisLine={false} tickLine={false} />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(value: number) => [formatCurrency(value), "Exposure"]}
                />
                <Bar dataKey="amount" radius={[0, 3, 3, 0]} barSize={12}>
                  {mockData.tierData.filter(d => d.count > 0).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Advances from API */}
      {advances.length > 0 && (
        <div className="card table-card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Active Advances</span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {advances.length} IN USE
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th className="text-right">Invoice Amount</th>
                <th className="text-right">Advanced</th>
                <th className="text-right">Fee</th>
                <th>Due</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {advances.map(adv => (
                <tr key={adv.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/capital/advances/${adv.id}`)}>
                  <td className="mono">{adv.invoice_number || adv.invoiceNumber}</td>
                  <td>{adv.customer_name || adv.customerName}</td>
                  <td className="mono text-right">{formatCurrency(adv.gross_amount || adv.invoice_amount || adv.amount)}</td>
                  <td className="mono text-right" style={{ color: "var(--accent-primary)" }}>
                    {formatCurrency(adv.net_amount || adv.advanced_amount || adv.advancedAmount)}
                  </td>
                  <td className="mono text-right" style={{ color: "var(--text-secondary)" }}>
                    {formatCurrency(adv.fee_amount || adv.fee)}
                  </td>
                  <td className="mono">{adv.repayment_date || adv.due_date || adv.dueDate}</td>
                  <td className="text-right" style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: adv.status === "DISBURSED" ? "#10B981" : "#F59E0B",
                      padding: "2px 6px", background: "var(--bg-surface-hover)",
                      borderRadius: 2, textTransform: "uppercase",
                    }}>{adv.status || "FUNDED"}</span>
                    {adv.status === "DISBURSED" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSettleAdvance(adv); }}
                        disabled={settlingIds.has(adv.id)}
                        style={{
                          background: "transparent", border: "1px solid #10B981",
                          color: "#10B981", padding: "4px 10px", fontSize: 10,
                          fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
                          borderRadius: 2, cursor: settlingIds.has(adv.id) ? "not-allowed" : "pointer",
                          opacity: settlingIds.has(adv.id) ? 0.5 : 1,
                        }}
                      >
                        {settlingIds.has(adv.id) ? "SETTLING..." : "SETTLE"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Advance History Table with SHAP expansion (mock data) */}
      <div className="card table-card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Advance History &amp; Risk Breakdown</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            {mockData.advanceHistory.length} RECORDS · CLICK ROW FOR RISK WATERFALL
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Advance ID</th>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Route</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Score</th>
              <th>Tier</th>
              <th className="text-right">Fee</th>
              <th className="text-right">Net Advance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mockData.advanceHistory.map(adv => {
              const isExpanded = expandedAdvance === adv.advanceId;
              return (
                <tr key={adv.advanceId} style={{ cursor: "pointer" }} onClick={() => setExpandedAdvance(isExpanded ? null : adv.advanceId)}>
                  <td className="mono" style={{ fontSize: 11 }}>{adv.advanceId}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{adv.invoice.invoiceId}</td>
                  <td style={{ fontWeight: 500 }}>{adv.customer.customerName}</td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {adv.routeData.routeName.length > 20
                      ? adv.routeData.routeName.slice(0, 18) + "..."
                      : adv.routeData.routeName}
                  </td>
                  <td className="mono text-right">{formatCurrency(adv.invoice.amount)}</td>
                  <td className="mono text-right" style={{ fontWeight: 600 }}>
                    <span style={{ color: TIER_CONFIG[adv.riskScore.riskTier].color }}>
                      {adv.riskScore.finalScore}
                    </span>
                  </td>
                  <td><TierBadge tier={adv.riskScore.riskTier} /></td>
                  <td className="mono text-right" style={{ color: "var(--text-secondary)" }}>
                    {formatPercent(adv.riskScore.finalFeePercent)}
                  </td>
                  <td className="mono text-right" style={{ color: "var(--accent-primary)" }}>
                    {formatCurrency(adv.riskScore.netAdvance)}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em",
                      color: adv.status === "SETTLED" ? "#10B981" : adv.status === "DISBURSED" ? "#2563EB" : "#F59E0B",
                      padding: "2px 6px", background: "var(--bg-surface-hover)", borderRadius: 2,
                    }}>
                      {adv.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Expanded SHAP waterfall for selected advance */}
        {expandedAdvance && (() => {
          const adv = mockData.advanceHistory.find(a => a.advanceId === expandedAdvance);
          if (!adv) return null;
          return (
            <div style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: 20, background: "var(--bg-surface)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {adv.advanceId}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 12 }}>
                    {adv.customer.customerName} · {adv.routeData.routeName}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>CONFIDENCE </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                      color: adv.riskScore.confidenceLevel >= 80 ? "#10B981" : adv.riskScore.confidenceLevel >= 60 ? "#F59E0B" : "#EF4444",
                    }}>
                      {adv.riskScore.confidenceLevel}%
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>FINAL SCORE </span>
                    <span style={{
                      fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)",
                      color: TIER_CONFIG[adv.riskScore.riskTier].color,
                    }}>
                      {adv.riskScore.finalScore}
                    </span>
                  </div>
                  <TierBadge tier={adv.riskScore.riskTier} />
                </div>
              </div>

              {/* Pillar scores strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 16 }}>
                {adv.riskScore.pillarBreakdown.map(p => (
                  <div key={p.pillar} style={{
                    padding: "8px 10px", border: "1px solid var(--border-subtle)", borderRadius: 4,
                    background: "#FFFFFF",
                  }}>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 4, lineHeight: 1.3 }}>
                      {p.pillar.split(" ").slice(0, 2).join(" ").toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)",
                      color: p.rawScore >= 70 ? "#10B981" : p.rawScore >= 50 ? "#F59E0B" : "#EF4444",
                    }}>
                      {p.rawScore}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      w: {(p.weight * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>

              <SHAPWaterfall invoice={adv} />

              {/* Score adjustments */}
              {adv.riskScore.adjustments.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
                    SCORE ADJUSTMENTS
                  </div>
                  {adv.riskScore.adjustments.map((adj, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{adj.description}</span>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontWeight: 600,
                        color: adj.amountPoints > 0 ? "#10B981" : "#EF4444",
                      }}>
                        {adj.amountPoints > 0 ? "+" : ""}{adj.amountPoints}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing summary */}
              <div style={{
                marginTop: 16, padding: 12, borderRadius: 4,
                background: "#FFFFFF", border: "1px solid var(--border-subtle)",
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12,
              }}>
                {[
                  { label: "Invoice", value: formatCurrency(adv.riskScore.invoiceAmount) },
                  { label: "Max Advance %", value: `${adv.riskScore.maxAdvancePercent}%` },
                  { label: "Fee Rate", value: formatPercent(adv.riskScore.finalFeePercent) },
                  { label: "Fee Amount", value: formatCurrency(adv.riskScore.feeAmount), color: "#EF4444" },
                  { label: "Net Advance", value: formatCurrency(adv.riskScore.netAdvance), color: "#10B981" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 4 }}>
                      {item.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: item.color || "var(--text-primary)" }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Eligible Invoices CTA */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Eligible Invoices — Request Early Pay</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {eligibleInvoices.length} INVOICES · {formatCurrency(eligibleTotal)}
            </span>
            <button onClick={() => navigate("/capital/risk-scores")} style={{
              fontSize: 10, fontFamily: "var(--font-mono)", background: "none",
              border: "1px solid var(--border-subtle)", color: "var(--text-secondary)",
              padding: "3px 10px", borderRadius: 2, cursor: "pointer", letterSpacing: "0.06em",
            }}>
              VIEW RISK SCORES
            </button>
          </div>
        </div>
        {eligibleInvoices.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }}>—</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
              No eligible invoices
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 320, margin: "0 auto" }}>
              Complete deliveries with Proof of Delivery to unlock Fast Pay. Invoices under 90 days with verified POD qualify.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th className="text-right">Amount</th>
                <th>Tier</th>
                <th className="text-right">Fee</th>
                <th className="text-right">You Receive</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {eligibleInvoices.map(inv => {
                const tier = (inv.risk_tier || inv.tier || "standard") as RiskTier;
                const amount = inv.total_amount || inv.amount || 0;
                const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.standard;
                const feeNum = tier === "prime" ? 0.02 : tier === "standard" ? 0.025 : 0.035;
                const netPayout = amount * (1 - feeNum);
                return (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number || inv.invoiceNumber}</td>
                    <td>{inv.customer_name || inv.customerName}</td>
                    <td className="mono text-right">{formatCurrency(amount)}</td>
                    <td>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                        color: tierCfg.color, background: tierCfg.bgAlpha,
                        padding: "2px 8px", borderRadius: 2, textTransform: "uppercase",
                      }}>
                        {tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono text-right" style={{ color: "var(--text-secondary)" }}>
                      {formatPercent(feeNum * 100)}
                    </td>
                    <td className="mono text-right" style={{ color: "#10B981", fontWeight: 600 }}>
                      {formatCurrency(netPayout)}
                    </td>
                    <td className="text-right">
                      <button
                        disabled={requestingIds.has(inv.id)}
                        onClick={() => handleRequestAdvance(inv)}
                        style={{
                          fontSize: 10, padding: "4px 14px",
                          background: requestingIds.has(inv.id) ? "var(--border-subtle)" : "var(--accent-primary)",
                          color: "#FFFFFF", border: "none", borderRadius: 2,
                          cursor: requestingIds.has(inv.id) ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-mono)", fontWeight: 600,
                          opacity: requestingIds.has(inv.id) ? 0.6 : 1,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {requestingIds.has(inv.id) ? "REQUESTING..." : "REQUEST"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
