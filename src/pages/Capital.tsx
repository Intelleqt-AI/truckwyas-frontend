import './capital-typography.css';
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import './table-heading-roles.css';
import './finance-brand.css';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";

const RISK_BAND_TONE: Record<string, string> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
  NEW: "neutral",
};

// External Fast Pay application link. The applied-state key is unchanged so
// invoices already marked "Applied" stay marked.
const FAST_PAY_STORAGE_KEY = "mc_applied_invoice_ids";

function loadAppliedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAST_PAY_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAppliedId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current).add(id);
  localStorage.setItem(FAST_PAY_STORAGE_KEY, JSON.stringify([...next]));
  return next;
}

export default function Capital() {
  const navigate = useNavigate();
  const [showIneligible, setShowIneligible] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(loadAppliedIds);

  // Facility data for metrics
  const {
    data,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["capital-page"],
    queryFn: async () => {
      const facilityData = await fetchData("api/v1/facilities/");
      const facilityList = Array.isArray(facilityData)
        ? facilityData
        : facilityData?.results || [];
      return { facility: facilityList[0] || null };
    },
  });

  // Eligible invoices — shared cache with Invoices + InvoiceDetail pages
  const { data: eligibleData } = useQuery({
    queryKey: ["capital-eligible"],
    queryFn: () => fetchData("api/v1/capital/eligible/").catch(() => null),
  });

  const facility = data?.facility ?? null;
  const eligibleInvoices: any[] = eligibleData?.invoices ?? [];
  const ineligibleInvoices: any[] = eligibleData?.ineligible_invoices ?? [];

  const eligibleTotal = eligibleInvoices.reduce(
    (sum, inv) => sum + (inv.total_amount || inv.amount || 0),
    0,
  );
  // FacilitySerializer exposes limit/outstanding/available/utilization_percent
  const outstanding = Number(facility?.outstanding ?? 0);
  const facilityLimit = Number(facility?.limit ?? 1000000);
  const available = Number(facility?.available ?? facilityLimit - outstanding);
  const utilization = Math.round(
    Number(facility?.utilization_percent ?? (outstanding / facilityLimit) * 100),
  );

  useEffect(() => {
    document.title = "Capital - TruckWys";
  }, []);

  useAutoRefresh(refetch);

  if (loading) {
    return <Loader fullScreen />;
  }

  const utilTone = utilization > 90 ? "danger" : utilization > 75 ? "warning" : "";

  return (
    <div className="capital-typography fin-page">
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
          Capital
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 28 }}>
          <h1 style={{ fontSize: 22, lineHeight: "28px", margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
            Fast Pay facility
          </h1>
        </div>
      </header>

      {/* About Fast Pay — neutral, factual status */}
      <section className="card fin-section" aria-labelledby="fast-pay-about" style={{ borderLeft: "3px solid var(--accent-primary)" }}>
        <h2 id="fast-pay-about" className="fin-h2" style={{ marginBottom: 4 }}>Fast Pay</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--text-secondary)" }}>
          Get paid early on eligible invoices. Fast Pay is being set up — you can check eligibility now.
        </p>
      </section>

      {/* Facility overview */}
      <div className="fin-kpis">
        {[
          {
            label: "Available capital",
            value: facility ? formatCurrency(available) : "—",
            sub: facility ? `of ${formatCurrency(facilityLimit)} limit` : "No facility set up",
          },
          {
            label: "In use",
            value: facility ? formatCurrency(outstanding) : "—",
            sub: facility ? `${utilization}% utilisation` : "No facility set up",
            tone: facility && utilTone ? `fin-text-${utilTone}` : "",
          },
          {
            label: "Eligible invoices",
            value: String(eligibleInvoices.length),
            sub: "Ready for Fast Pay",
          },
          {
            label: "Eligible value",
            value: formatCurrency(eligibleTotal),
            sub: "Total invoice value",
          },
        ].map((m) => (
          <div key={m.label} className="card fin-kpi">
            <span className="fin-kpi__label">{m.label}</span>
            <span className={`fin-kpi__value ${m.tone ?? ""}`}>{m.value}</span>
            <span className="fin-kpi__sub">{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Facility utilisation meter */}
      {facility && (
        <section className="card fin-section" aria-labelledby="facility-meter">
          <div className="fin-card-head" style={{ marginBottom: 12 }}>
            <h2 id="facility-meter" className="fin-h2">Facility usage</h2>
            <span className={utilTone ? `fin-text-${utilTone}` : ""} style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {utilization}% used
            </span>
          </div>
          <div
            className="fin-meter"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={utilization}
            aria-label="Facility used"
            style={{ height: 12 }}>
            <div
              className="fin-meter__fill"
              style={{
                width: `${Math.min(utilization, 100)}%`,
                background:
                  utilization > 90
                    ? "var(--status-danger)"
                    : utilization > 75
                      ? "var(--status-warning)"
                      : "var(--accent-primary)",
                transition: "width 0.3s",
              }}
            />
          </div>
          <dl
            className="capital-facility-values"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, margin: "12px 0 0", fontSize: 13, lineHeight: "20px" }}>
            <div>
              <dt style={{ color: "var(--text-tertiary)" }}>Outstanding</dt>
              <dd style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(outstanding)}</dd>
            </div>
            <div style={{ textAlign: "center" }}>
              <dt style={{ color: "var(--text-tertiary)" }}>Limit</dt>
              <dd style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(facilityLimit)}</dd>
            </div>
            <div style={{ textAlign: "right" }}>
              <dt style={{ color: "var(--text-tertiary)" }}>Available</dt>
              <dd style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(available)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* Eligible invoices */}
      <section className="card fin-table-card fin-section" aria-labelledby="eligible-title">
        <div className="fin-table-card__head">
          <h2 id="eligible-title" className="fin-h2">Eligible invoices</h2>
          <span className="fin-support" style={{ fontVariantNumeric: "tabular-nums" }}>
            {eligibleInvoices.length} {eligibleInvoices.length === 1 ? "invoice" : "invoices"} · {formatCurrency(eligibleTotal)}
          </span>
        </div>
        {eligibleInvoices.length === 0 ? (
          <div className="fin-empty fin-empty--compact">
            No eligible invoices. Complete deliveries with POD to unlock Fast Pay.
          </div>
        ) : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>AI risk</th>
                  <th className="num">Amount</th>
                  <th className="num">Fundable</th>
                  <th className="actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {eligibleInvoices.map((inv) => {
                  const amount = Number(
                    inv.total_amount || inv.amount || inv.invoice_amount || 0,
                  );
                  const riskPct = inv.customer_risk_pct;
                  const riskBand: string = inv.customer_risk_band || "NEW";
                  const blocked = !!inv.risk_blocked;
                  const fundable = Number(inv.fundable_amount_zar ?? amount);
                  const riskTone = RISK_BAND_TONE[riskBand] || "neutral";
                  const applied = appliedIds.has(String(inv.id));
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span className="fin-id">{inv.invoice_number || inv.invoiceNumber}</span>
                      </td>
                      <td className="fin-strong">
                        {inv.customer || inv.customer_name || inv.customerName}
                      </td>
                      <td>
                        {riskPct === null || riskPct === undefined ? (
                          <span className="fin-text-muted">—</span>
                        ) : (
                          <button
                            type="button"
                            className={`fin-chip fin-chip--outline${riskTone === "neutral" ? "" : ` fin-chip--${riskTone}`}`}
                            onClick={() => inv.customer_id && navigate(`/customers/${inv.customer_id}/risk`)}
                            title="Open AI risk profile"
                            style={{ fontVariantNumeric: "tabular-nums" }}>
                            {riskPct}%{riskBand === "NEW" ? " · New" : ""}
                          </button>
                        )}
                      </td>
                      <td className="num capital-amount">{formatCurrency(amount)}</td>
                      <td className={`num capital-amount ${fundable < amount ? "fin-text-warning" : ""}`}>
                        {formatCurrency(fundable)}
                      </td>
                      <td className="actions">
                        {blocked ? (
                          <span
                            className="fin-chip fin-chip--danger"
                            title={`Customer risk ${riskPct}% — above the 70% Fast Pay limit`}>
                            High risk
                          </span>
                        ) : applied ? (
                          <span className="fin-chip fin-chip--success" title="Your earlier application is on record">Applied</span>
                        ) : (
                          <button type="button" className="btn-action fin-btn-secondary"
                            disabled={!CAPITAL_LAUNCHED} title={CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON}>
                            {CAPITAL_LAUNCHED ? "Apply" : "Coming soon"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ineligible invoices — collapsible */}
      {ineligibleInvoices.length > 0 && (
        <section className="card fin-table-card" aria-labelledby="ineligible-title">
          <div className="fin-table-card__head" style={{ paddingBottom: showIneligible ? 12 : 20 }}>
            <h2 id="ineligible-title" className="fin-h2" style={{ color: "var(--text-secondary)" }}>
              Not eligible ({ineligibleInvoices.length})
            </h2>
            <button
              type="button"
              className="btn-action fin-btn-secondary"
              aria-expanded={showIneligible}
              aria-controls="ineligible-table"
              onClick={() => setShowIneligible((v) => !v)}>
              {showIneligible ? "Hide reasons" : "Show reasons"}
            </button>
          </div>
          {showIneligible && (
            <div className="fin-table-scroll" id="ineligible-table">
              <table className="fin-table table-heading-roles">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th className="num">Amount</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {ineligibleInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <span className="fin-id">{inv.invoice_number}</span>
                      </td>
                      <td className="fin-strong">{inv.customer}</td>
                      <td className="num capital-amount">{formatCurrency(inv.amount)}</td>
                      <td>{inv.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
