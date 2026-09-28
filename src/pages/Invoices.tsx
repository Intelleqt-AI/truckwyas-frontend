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
  SENT: "info",
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
  const invoices = Array.isArray(data) ? data : data?.results || [];
  return {
    invoices,
    // The list endpoint is paginated; `count` is the tenant's full total, so
    // the page can say how much of it the table is based on.
    total: typeof data?.count === "number" ? data.count : invoices.length,
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
  const totalInvoices: number = invoicesData?.total ?? invoices.length;

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
        flash("Reminder recorded. The customer will be contacted.");
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

  // Headline figures come from the stats endpoint, which covers every invoice
  // (not just the page loaded below). Bases, from the API:
  //   invoiced this month  total incl. VAT, by issue date since the 1st
  //   collected this month paid amount of PAID invoices issued this month
  //   overdue              unpaid balance incl. VAT, due date passed
  //   avg days to pay      issue date to paid date, all paid invoices
  const now = new Date();
  const monthName = now.toLocaleString("en-GB", { month: "long" });
  const byStatus = stats?.by_status ?? {};
  const draftCount: number = byStatus.DRAFT ?? 0;
  const invoicedMtd: number = stats?.total_invoiced_mtd ?? 0;
  const collectedMtd: number = stats?.total_collected_mtd ?? 0;
  const monthActive = invoicedMtd > 0 || collectedMtd > 0;
  const overdueCount: number = stats?.overdue_count ?? 0;
  const paidCount: number = byStatus.PAID ?? 0;
  const avgDays: number | null = paidCount > 0 && stats?.avg_days_to_pay ? stats.avg_days_to_pay : null;
  const truncated = totalInvoices > allInvoices.length;

  // Previous-month comparison only when every invoice is loaded; a partial
  // page would understate last month.
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const invoicedLastMonth = truncated
    ? null
    : allInvoices
        .filter((i) => {
          const d = new Date(i.issue_date || i.created_at);
          return d >= lastMonthStart && d < monthStart;
        })
        .reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const lastMonthName = lastMonthStart.toLocaleString("en-GB", { month: "long" });
  const invoicedDelta = (() => {
    if (invoicedLastMonth == null) return null;
    if (invoicedLastMonth === 0) return `Nothing invoiced in ${lastMonthName}`;
    const pct = ((invoicedMtd - invoicedLastMonth) / invoicedLastMonth) * 100;
    return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}% vs ${lastMonthName} (${formatCurrency(invoicedLastMonth)})`;
  })();

  const showStatus = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };

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

      {/* Headline: tiles only where the number drives a decision */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", marginBottom: 24 }}>
          <Loader size={28} />
        </div>
      ) : !stats ? (
        <div className="card fin-summary">
          <div className="fin-summary__text">
            <p className="fin-summary__title">Invoice totals are unavailable</p>
            <p className="fin-summary__body">The summary didn’t load. The invoice list below is unaffected.</p>
          </div>
          <div className="fin-summary__actions">
            <button className="btn-action fin-btn-secondary" onClick={() => refetchInvoices()}>
              Retry loading
            </button>
          </div>
        </div>
      ) : (
        <div className="fin-kpis">
          {monthActive ? (
            <>
              <div className="card fin-kpi">
                <span className="fin-kpi__label">Invoiced in {monthName}</span>
                <span className="fin-kpi__value">{formatCurrency(invoicedMtd)}</span>
                <span className="fin-kpi__delta">{invoicedDelta ?? "By issue date, incl. VAT"}</span>
              </div>
              <div className="card fin-kpi">
                <span className="fin-kpi__label">Collected on {monthName} invoices</span>
                <span className="fin-kpi__value">{formatCurrency(collectedMtd)}</span>
                <span className="fin-kpi__sub">
                  {invoicedMtd > 0
                    ? `${Math.round((stats.collection_rate ?? 0) * 100)}% of the amount invoiced this month`
                    : "Paid invoices issued this month"}
                </span>
              </div>
            </>
          ) : (
            <div className="card fin-kpi fin-kpi--wide">
              <p className="fin-summary__title">Nothing invoiced in {monthName} yet</p>
              <p className="fin-summary__body">
                No invoice has an issue date this month, so there is nothing collected to compare.
                {draftCount > 0 &&
                  ` ${draftCount} ${draftCount === 1 ? "draft is" : "drafts are"} ready to send.`}
              </p>
              {draftCount > 0 && (
                <div className="fin-kpi__action">
                  <button type="button" className="fin-link" onClick={() => showStatus("DRAFT")}>
                    Review drafts
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Overdue balance</span>
            <span className="fin-kpi__value">{formatCurrency(stats.overdue_amount ?? 0)}</span>
            <span className={`fin-kpi__sub ${overdueCount > 0 ? "fin-text-danger" : ""}`}>
              {overdueCount > 0
                ? `${overdueCount} ${overdueCount === 1 ? "invoice" : "invoices"} past the due date`
                : "No invoice is past its due date"}
            </span>
            <span className="fin-kpi__sub">Unpaid amount incl. VAT</span>
          </div>
          <div className="card fin-kpi">
            <span className="fin-kpi__label">Average time to get paid</span>
            <span className="fin-kpi__value">{avgDays == null ? "—" : `${avgDays} days`}</span>
            <span className="fin-kpi__sub">
              {avgDays == null
                ? "Shown once an invoice is paid"
                : `Issue date to payment, across ${paidCount} paid ${paidCount === 1 ? "invoice" : "invoices"}`}
            </span>
          </div>
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
      {!loading && truncated && (
        <p className="fin-coverage">
          This list holds the {allInvoices.length} most recent of {totalInvoices} invoices; search and filters apply to
          these. The totals above cover all {totalInvoices}.
        </p>
      )}

      {/* Table: 10 per page, clickable */}
      <div className="card fin-table-card">
        <div className="fin-table-scroll">
          <table className="fin-table fin-table--stack table-heading-roles">
            <thead>
              <tr>
                <th>Issued</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Amount incl. VAT</th>
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
                  <td colSpan={7} style={{ padding: 0 }}>
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
                  // Days relative to the due date, stated in words next to it.
                  const ageDays = dueDate
                    ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
                    : 0;
                  const open = invStatus !== "PAID" && invStatus !== "DRAFT" && !!dueDate;
                  const agingLabel = !open
                    ? null
                    : ageDays > 0
                      ? `${ageDays} ${ageDays === 1 ? "day" : "days"} late`
                      : ageDays === 0
                        ? "due today"
                        : `in ${Math.abs(ageDays)} ${Math.abs(ageDays) === 1 ? "day" : "days"}`;

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
                      <td className="fin-date m-hide">{safeDate(inv.issue_date)}</td>
                      <td className="m-meta">
                        <span className="fin-id">{invNumber}</span>
                      </td>
                      <td className="fin-strong m-party">
                        <div className="fin-truncate" title={custName}>
                          {custName}
                        </div>
                      </td>
                      <td className={`fin-date m-due${agingLabel ? "" : " m-hide"}`}>
                        <span className="fin-mobile-only">Due </span>
                        {safeDate(dueDate)}
                        {agingLabel && (
                          <span className={ageDays > 0 ? "fin-text-danger" : "fin-text-muted"}> · {agingLabel}</span>
                        )}
                      </td>
                      <td className="m-status">
                        <span className="fin-inline-list" style={{ flexWrap: "nowrap" }}>
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
                      <td className="num m-amount">{formatCurrency(amount)}</td>
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
              {(page - 1) * PAGE_SIZE + 1} to {(page - 1) * PAGE_SIZE + rows.length} of {filtered.length}
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
