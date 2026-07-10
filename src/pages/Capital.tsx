import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";

const RISK_BAND_COLOR: Record<string, string> = {
  LOW: "var(--status-success)",
  MEDIUM: "var(--status-warning)",
  HIGH: "var(--status-danger)",
  CRITICAL: "var(--status-danger)",
  NEW: "var(--text-tertiary)",
};

const MC_URL =
  "https://getstarted.merchantcapital.co.za?actiontype=C_C&channel=Part_Trad&who=IA_SP";


const MC_STORAGE_KEY = "mc_applied_invoice_ids";

function loadAppliedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MC_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAppliedId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current).add(id);
  localStorage.setItem(MC_STORAGE_KEY, JSON.stringify([...next]));
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
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
            Capital
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}>
            Fast Pay Facility
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div
                style={{
                  height: 16,
                  background: "var(--bg-surface)",
                  borderRadius: 4,
                  marginBottom: 12,
                  width: "60%",
                }}
              />
              <div
                style={{
                  height: 32,
                  background: "var(--bg-surface)",
                  borderRadius: 4,
                  width: "40%",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}>
          Capital
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}>
            Fast Pay Facility
          </div>
          <LiveBadge />
        </div>
      </div>

      {/* Merchant Capital partnership banner */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: 24,
          borderLeft: "3px solid var(--accent-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}>
            Fast Pay powered by Merchant Capital
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Get paid faster on your eligible invoices. Apply via our trusted
            lending partner — approval in minutes.
          </div>
        </div>
        <a
          href={MC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-action"
          style={{
            whiteSpace: "nowrap",
            textDecoration: "none",
            padding: "10px 20px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            display: "inline-block",
          }}>
          APPLY FOR CAPITAL →
        </a>
      </div>

      {/* Facility overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}>
        {[
          {
            label: "Available Capital",
            value: formatCurrency(available),
            sub: `of ${formatCurrency(facilityLimit)} limit`,
            color: "var(--status-success)",
          },
          {
            label: "In Use",
            value: formatCurrency(outstanding),
            sub: `${utilization}% utilization`,
            color: "var(--status-warning)",
          },
          {
            label: "Eligible Invoices",
            value: eligibleInvoices.length,
            sub: "ready for fast pay",
            color: "var(--accent-primary)",
          },
          {
            label: "Eligible Value",
            value: formatCurrency(eligibleTotal),
            sub: "total available",
            color: "var(--text-primary)",
          },
        ].map((m) => (
          <div key={m.label} className="card metric-card">
            <div className="card-header">
              <span className="card-title">{m.label}</span>
            </div>
            <div
              className="metric-value"
              style={{ fontSize: 20, color: m.color }}>
              {m.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Facility utilization bar */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}>
          <span style={{ color: "var(--text-tertiary)" }}>FACILITY METER</span>
          <span
            style={{
              color:
                utilization > 75
                  ? "var(--status-warning)"
                  : "var(--status-success)",
            }}>
            {utilization}% USED
          </span>
        </div>
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: 2,
            height: 12,
            width: "100%",
            overflow: "hidden",
            position: "relative",
          }}>
          <div
            style={{
              width: `${utilization}%`,
              height: "100%",
              background:
                utilization > 90
                  ? "var(--status-danger)"
                  : utilization > 75
                    ? "var(--status-warning)"
                    : "var(--accent-primary)",
              borderRadius: 2,
              transition: "width 0.3s",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
          }}>
          <div>
            <div style={{ color: "var(--status-danger)", fontWeight: 600 }}>
              OUTSTANDING
            </div>
            <div>{formatCurrency(outstanding)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              LIMIT
            </div>
            <div>{formatCurrency(facilityLimit)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--status-success)", fontWeight: 600 }}>
              AVAILABLE
            </div>
            <div>{formatCurrency(available)}</div>
          </div>
        </div>
      </div>

      {/* Eligible invoices */}
      <div className="card table-card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Fast Pay NOW — Eligible Invoices</span>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}>
            {eligibleInvoices.length} INVOICES · {formatCurrency(eligibleTotal)}{" "}
            AVAILABLE
          </span>
        </div>
        {eligibleInvoices.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--text-tertiary)",
              fontSize: 13,
            }}>
            No eligible invoices. Complete deliveries with POD to unlock Fast
            Pay.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>AI Risk</th>
                <th>Amount</th>
                <th>Fundable</th>
                <th className="text-right">Action</th>
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
                const riskColor = RISK_BAND_COLOR[riskBand] || "var(--text-tertiary)";
                return (
                  <tr key={inv.id}>
                    <td className="mono">
                      {inv.invoice_number || inv.invoiceNumber}
                    </td>
                    <td>
                      {inv.customer || inv.customer_name || inv.customerName}
                    </td>
                    <td>
                      {riskPct === null || riskPct === undefined ? (
                        <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>
                      ) : (
                        <button
                          onClick={() => inv.customer_id && navigate(`/customers/${inv.customer_id}/risk`)}
                          title="Open AI risk profile"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: riskColor,
                            background: "none",
                            border: `1px solid ${riskColor}`,
                            borderRadius: 999,
                            padding: "2px 10px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}>
                          {riskPct}%{riskBand === "NEW" ? " · NEW" : ""}
                        </button>
                      )}
                    </td>
                    <td className="mono">{formatCurrency(amount)}</td>
                    <td className="mono" style={{ color: fundable < amount ? "var(--status-warning)" : undefined }}>
                      {formatCurrency(fundable)}
                    </td>
                    <td className="text-left">
                      {blocked ? (
                        <span
                          title={`Customer risk ${riskPct}% — above the 70% fast-pay limit`}
                          style={{
                            fontSize: 10,
                            padding: "4px 12px",
                            background: "none",
                            color: "var(--status-danger)",
                            border: "1px solid var(--status-danger)",
                            borderRadius: 2,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            opacity: 0.85,
                          }}>
                          HIGH RISK
                        </span>
                      ) : (
                        <a
                          href={MC_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-action"
                          onClick={() =>
                            setAppliedIds((prev) =>
                              saveAppliedId(String(inv.id), prev),
                            )
                          }
                          style={{
                            fontSize: 10,
                            padding: "4px 12px",
                            background: appliedIds.has(String(inv.id))
                              ? "var(--status-success)"
                              : "var(--accent-primary)",
                            color: "var(--btn-action-color)",
                            border: "none",
                            borderRadius: 2,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            textDecoration: "none",
                            display: "inline-block",
                            whiteSpace: "nowrap",
                          }}>
                          {appliedIds.has(String(inv.id)) ? "Applied ✓" : "APPLY"}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Ineligible invoices — collapsible */}
      {ineligibleInvoices.length > 0 && (
        <div className="card table-card" style={{ marginTop: 16 }}>
          <div
            className="card-header"
            style={{ marginBottom: showIneligible ? 16 : 0, cursor: "pointer" }}
            onClick={() => setShowIneligible((v) => !v)}>
            <span
              className="card-title"
              style={{ color: "var(--text-secondary)" }}>
              Not Eligible ({ineligibleInvoices.length})
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                userSelect: "none",
              }}>
              {showIneligible ? "▲ HIDE" : "▼ SHOW REASONS"}
            </span>
          </div>
          {showIneligible && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {ineligibleInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td>{inv.customer}</td>
                    <td className="mono">{formatCurrency(inv.amount)}</td>
                    <td
                      style={{
                        color: "var(--status-danger)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}>
                      {inv.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
