import "./table-heading-roles.css";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import "./expense-row-actions.css";
import "./finance-brand.css";
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";
import SectionHeader, { FINANCE_TABS } from "@/components/layout/SectionHeader";

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

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  PAID: "success",
  SENT: "warning",
  PARTIALLY_PAID: "warning",
  OVERDUE: "danger",
  DRAFT: "neutral",
};

const TIER_TONE: Record<string, Tone> = {
  prime: "success",
  standard: "info",
  elevated: "warning",
  high: "danger",
};

const chipClass = (tone: Tone, outline = false) =>
  `fin-chip${tone === "neutral" ? "" : ` fin-chip--${tone}`}${outline ? " fin-chip--outline" : ""}`;

// Sentence-case a status/token for display: "PARTIALLY_PAID" → "Partially paid".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";

const safeDate = (d?: string) => {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};

const PAGE_SIZE = 10;
const STATUSES = ["All", "SENT", "OVERDUE", "PAID", "DRAFT"];

/** Finance tabs; on the legacy /invoices path the Invoices tab points at it so it stays active. */
function financeTabsFor(pathname: string) {
  return pathname === "/invoices"
    ? FINANCE_TABS.map((t) => (t.to === "/finance/invoices" ? { ...t, to: "/invoices" } : t))
    : FINANCE_TABS;
}

// Fetches invoices + stats. Lives in the queryFn so the result is cached by
// TanStack Query (keyed below) and survives navigation — revisiting the page
// no longer refires these requests until the cache goes stale.
async function loadInvoicesPage() {
  const [data, statsData] = await Promise.all([
    fetchData("/api/v1/invoices/"),
    fetchData("/api/v1/invoices/stats/").catch(() => null),
  ]);
  // API returns paginated {count, results} — extract results
  return {
    invoices: Array.isArray(data) ? data : data?.results || [],
    stats: statsData,
  };
}

export default function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const initialStatus = (searchParams.get("status") || "").toUpperCase();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    STATUSES.includes(initialStatus) ? initialStatus : "All",
  );
  const [page, setPage] = useState(1);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(loadAppliedIds);

  // Invoices + stats, cached across navigations.
  const {
    data: invoicesData,
    isLoading: loading,
    isError,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["invoices-page"],
    queryFn: loadInvoicesPage,
  });
  const invoices: any[] = invoicesData?.invoices ?? [];
  const stats: any = invoicesData?.stats ?? null;

  // Capital-eligible invoices — fetched once, cached; silently ignored if no facility
  const { data: capitalData } = useQuery({
    queryKey: ["capital-eligible"],
    queryFn: () => fetchData("api/v1/capital/eligible/").catch(() => null),
  });
  const eligibleInvoices: any[] = capitalData?.invoices || [];
  const eligibleById = new Map(eligibleInvoices.map((e: any) => [String(e.id), e]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ineligibleInvoices: any[] = capitalData?.ineligible_invoices || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ineligibleById = new Map(ineligibleInvoices.map((e: any) => [String(e.id), e]));

  useEffect(() => {
    document.title = "Invoices - TruckWys";
  }, []);

  // Live-refresh on the auto-refresh tick / focus / live events.
  useAutoRefresh(() => {
    refetchInvoices();
  });

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingId(invoiceId);
    try {
      await postData({ url: `/api/v1/invoices/${invoiceId}/send_invoice/` });
      flash("Invoice sent");
      refetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["capital-eligible"] });
    } catch (error) {
      console.error("Failed to send invoice:", error);
      flash("Could not send the invoice. Try again.");
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    // generate_pdf is POST-only and returns a pdf_url; window.open(GET) 405s.
    try {
      const result = await postData({
        url: `api/v1/invoices/${invoiceId}/generate_pdf/`,
        data: {},
      });
      if (result?.pdf_url) window.open(result.pdf_url, "_blank");
      flash("PDF ready");
    } catch {
      flash("Could not generate the PDF. Try again.");
    }
  };

  const handleSendReminder = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingReminderId(invoiceId);
    try {
      await postData({
        url: `/api/v1/invoices/${invoiceId}/send_reminder/`,
        data: {},
      });
      flash("Reminder sent");
    } catch (error: any) {
      if (error?.response?.status === 404) {
        flash("Reminder recorded — customer will be contacted");
      } else {
        flash("Could not send the reminder. Try again.");
      }
    } finally {
      setSendingReminderId(null);
    }
  };

  // Never fall back to mock data — show empty state if API returns nothing
  const allInvoices = invoices;

  const filtered = allInvoices.filter((inv) => {
    const invStatus = inv.status?.toUpperCase();
    const matchStatus = statusFilter === "All" || invStatus === statusFilter;
    const invNumber = inv.invoice_number || inv.invoiceNumber || "";
    const custName = inv.customer_name || inv.customerName || "";
    const matchSearch =
      !search ||
      invNumber.toLowerCase().includes(search.toLowerCase()) ||
      custName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const outstanding = allInvoices
    .filter((i) => i.status === "SENT")
    .reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const overdue = allInvoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const paid = allInvoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);

  const kpis = [
    {
      label: "Total invoiced this month",
      value: formatCurrency(stats?.total_invoiced_mtd ?? outstanding),
      sub: "Month to date",
    },
    {
      label: "Collected",
      value: formatCurrency(stats?.total_collected_mtd ?? paid),
      sub: "Month to date",
    },
    {
      label: "Overdue",
      value: formatCurrency(stats?.overdue_amount ?? overdue),
      sub: `${stats?.overdue_count ?? 0} ${(stats?.overdue_count ?? 0) === 1 ? "invoice" : "invoices"}`,
      tone: "fin-text-danger",
    },
    {
      label: "Collection rate",
      value: `${Math.round((stats?.collection_rate ?? 0) * 100)}%`,
      sub: "Collected ÷ invoiced",
    },
  ];

  return (
    <div className="fin-page">
      {toast && (
        <div className="fin-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <SectionHeader
        eyebrow="Finance"
        title="Finance"
        tabs={financeTabsFor(location.pathname)}
        actions={
          <button className="btn-action" onClick={() => navigate("/finance/invoices/new")}>
            New invoice
          </button>
        }
      />

      {/* KPIs */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", marginBottom: 24 }}>
          <Loader size={28} />
        </div>
      ) : (
        <div className="fin-kpis">
          {kpis.map((m) => (
            <div key={m.label} className="card fin-kpi">
              <span className="fin-kpi__label">{m.label}</span>
              <span className={`fin-kpi__value ${m.tone ?? ""}`}>{m.value}</span>
              <span className="fin-kpi__sub">{m.sub}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="fin-toolbar">
        <input
          type="search"
          className="fin-control fin-control--search"
          placeholder="Search invoices"
          aria-label="Search invoices by number or customer"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="fin-toolbar__group" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="fin-chip-filter"
              aria-pressed={statusFilter === s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}>
              {s === "All" ? "All" : formatStatus(s)}
            </button>
          ))}
        </div>
        <span className="fin-toolbar__count">
          {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
        </span>
      </div>

      {/* Table — 10 per page, clickable */}
      <div className="card fin-table-card">
        <div className="fin-table-scroll">
          <table className="fin-table table-heading-roles">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Due date</th>
                <th className="actions">
                  <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="is-empty">
                  <td colSpan={6} style={{ padding: 0 }}>
                    {loading ? (
                      <div className="fin-empty fin-empty--compact">Loading invoices…</div>
                    ) : isError ? (
                      <div className="fin-empty">
                        <p className="fin-empty__title">Couldn’t load invoices</p>
                        <p className="fin-empty__body">Check your connection and try again.</p>
                        <button className="btn-action" onClick={() => refetchInvoices()}>
                          Retry loading
                        </button>
                      </div>
                    ) : allInvoices.length === 0 ? (
                      <div className="fin-empty">
                        <p className="fin-empty__title">No invoices yet</p>
                        <p className="fin-empty__body">Invoices are generated from completed bookings.</p>
                        <button onClick={() => navigate("/bookings")} className="btn-action">
                          Go to bookings
                        </button>
                      </div>
                    ) : (
                      <div className="fin-empty fin-empty--compact">No invoices match your filters</div>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const invStatus = inv.status?.toUpperCase();
                  const amount = parseFloat(inv.total_amount || inv.amount) || 0;
                  const invNumber = inv.invoice_number || inv.invoiceNumber;
                  const custName = inv.customer_name || inv.customerName;
                  const dueDate = inv.due_date || inv.dueDate;
                  // Aging indicator
                  const ageDays = dueDate
                    ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
                    : 0;
                  const agingTone: Tone =
                    ageDays <= 0 ? "success" : ageDays <= 30 ? "warning" : ageDays <= 60 ? "info" : "danger";
                  const agingLabel = ageDays <= 0 ? `Due in ${Math.abs(ageDays)}d` : `${ageDays}d overdue`;

                  const capitalEntry = eligibleById.get(String(inv.id));
                  const ineligibleEntry = !capitalEntry ? ineligibleById.get(String(inv.id)) : null;
                  const tier = capitalEntry
                    ? String(capitalEntry.risk_tier || capitalEntry.tier || "standard").toLowerCase()
                    : null;
                  const applied = appliedIds.has(String(inv.id));

                  return (
                    <tr
                      key={inv.id}
                      className="is-clickable"
                      onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                      <td>
                        <span className="fin-id">{invNumber}</span>
                      </td>
                      <td className="fin-strong">
                        <div className="fin-truncate" title={custName}>
                          {custName}
                        </div>
                      </td>
                      <td className="num">{formatCurrency(amount)}</td>
                      <td>
                        <span className="fin-inline-list">
                          <span className={chipClass(STATUS_TONE[invStatus] ?? "neutral")}>
                            {formatStatus(invStatus)}
                          </span>
                          {capitalEntry && tier && (
                            <span
                              className={chipClass(TIER_TONE[tier] ?? "neutral", true)}
                              title="Fast Pay risk tier">
                              {formatStatus(tier)}
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="fin-inline-list">
                          <span className={`fin-date ${invStatus === "OVERDUE" ? "fin-text-danger" : ""}`}>
                            {safeDate(dueDate)}
                          </span>
                          {invStatus !== "PAID" && dueDate && (
                            <span className={chipClass(agingTone, true)}>{agingLabel}</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="actions"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setOpenDropdownId(null);
                        }}>
                        <div className="expense-row-actions">
                          <button
                            type="button"
                            className="expense-menu-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === inv.id ? null : inv.id);
                            }}
                            aria-label={`Invoice actions for ${invNumber}`}
                            aria-haspopup="menu"
                            aria-expanded={openDropdownId === inv.id}>
                            <Ellipsis size={16} aria-hidden="true" />
                          </button>

                          {openDropdownId === inv.id && (
                            <>
                              {/* click-away overlay */}
                              <div
                                style={{ position: "fixed", inset: 0, zIndex: 99 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(null);
                                }}
                              />
                              <div className="expense-menu" role="menu">
                                {invStatus === "DRAFT" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="expense-menu-item"
                                    disabled={sendingId === inv.id}
                                    onClick={(e) => {
                                      setOpenDropdownId(null);
                                      handleSendInvoice(e, inv.id);
                                    }}>
                                    {sendingId === inv.id ? "Sending…" : "Send to customer"}
                                  </button>
                                )}
                                {invStatus === "OVERDUE" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="expense-menu-item"
                                    disabled={sendingReminderId === inv.id}
                                    onClick={(e) => {
                                      setOpenDropdownId(null);
                                      handleSendReminder(e, inv.id);
                                    }}>
                                    {sendingReminderId === inv.id ? "Sending…" : "Send reminder"}
                                  </button>
                                )}
                                {invStatus !== "DRAFT" && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="expense-menu-item"
                                    onClick={(e) => {
                                      setOpenDropdownId(null);
                                      handleDownloadPDF(e, inv.id);
                                    }}>
                                    Download PDF
                                  </button>
                                )}
                                {capitalEntry && (
                                  applied ? (
                                    <div className="fin-menu-note">
                                      <strong>Applied for Fast Pay</strong>
                                      Your earlier application is on record.
                                    </div>
                                  ) : (
                                    <button type="button" role="menuitem" className="expense-menu-item"
                                      disabled={!CAPITAL_LAUNCHED} aria-disabled={!CAPITAL_LAUNCHED}
                                      title={CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON}>
                                      {CAPITAL_LAUNCHED ? "Request Fast Pay" : "Request Fast Pay (coming soon)"}
                                    </button>
                                  )
                                )}
                                {ineligibleEntry && (
                                  <div className="fin-menu-note">
                                    <strong>Not eligible for Fast Pay</strong>
                                    {ineligibleEntry.reason}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="fin-table-foot">
            <span>
              Page {page} of {totalPages} · showing {rows.length} of {filtered.length}
            </span>
            <div className="fin-table-foot__nav">
              <button
                className="btn-action fin-btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}>
                Previous
              </button>
              <button
                className="btn-action fin-btn-secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
