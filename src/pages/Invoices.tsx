import "./table-heading-roles.css";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import "./finance-brand.css";
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import SectionHeader, { FINANCE_TABS } from "@/components/layout/SectionHeader";
import RowActions from "@/components/ui/RowActions";
import { InfoTip } from "@/components/ui/InfoTip";
import { wholeRand } from "@/components/finance/FinTile";
import { KpiRow, KpiTile } from "@/components/ui/KpiTile";
import { Segmented } from "@/components/ui/Segmented";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import LoadError, { loadFailed } from "@/components/data/LoadError";
import InvoiceSendPreview, { type InvoiceMessageKind } from "@/components/finance/InvoiceSendPreview";
import { canSendReminder, invoiceBalance, isInvoiceOverdue } from "@/lib/invoiceStatus";
import { rowLink } from "@/lib/rowLink";

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

// Invoice statuses use the product-wide StatusChip map (Sent is info
// everywhere). Fast Pay risk tiers keep their own tone.
const TIER_TONE: Record<string, StatusTone> = {
  prime: "success",
  standard: "info",
  elevated: "warning",
  high: "danger",
};

// Sentence-case a status/token for display: "PARTIALLY_PAID" → "Partially paid".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";

const safeDate = (d?: string) => {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : formatDate(t);
};

const PAGE_SIZE = 10;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
// The list endpoint pages at 20. Filters and the Overdue tile must agree, so the
// remaining pages are fetched too (same endpoint, `?page=n`, in parallel), up to
// a bound that keeps request volume modest under the API's per-user rate limit.
// A later page that fails leaves the list partial (and labelled so), never
// failing the whole page.
const MAX_INVOICE_PAGES = 10;

async function loadInvoicesPage() {
  const [data, statsData] = await Promise.all([
    fetchData("/api/v1/invoices/"),
    fetchData("/api/v1/invoices/stats/").catch(() => null),
  ]);
  // API returns paginated {count, results} — extract results
  const invoices = Array.isArray(data) ? [...data] : [...(data?.results || [])];
  const pageSize = invoices.length;
  if (!Array.isArray(data) && data?.next && typeof data?.count === "number" && pageSize > 0) {
    const pages = Math.min(Math.ceil(data.count / pageSize), MAX_INVOICE_PAGES);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
        fetchData(`/api/v1/invoices/?page=${i + 2}`).catch(() => null),
      ),
    );
    for (const pageData of rest) {
      if (!pageData) break; // keep pages in order; stop at the first gap
      invoices.push(...(Array.isArray(pageData) ? pageData : pageData?.results || []));
    }
  }
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
  // Outgoing messages are previewed and confirmed before they are sent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preview, setPreview] = useState<{ kind: InvoiceMessageKind; invoice: any } | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(loadAppliedIds);

  // Invoices + stats, cached across navigations.
  const invoicesQuery = useQuery({
    queryKey: ["invoices-page"],
    queryFn: loadInvoicesPage,
  });
  const { data: invoicesData, refetch: refetchInvoices } = invoicesQuery;
  // Nothing to show because the request failed (or is failing and retrying):
  // the page says so instead of spinning or showing an empty list.
  const failed = loadFailed(invoicesQuery);
  const loading = invoicesQuery.isLoading && !failed;
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

  const handleSendInvoice = async (e: React.MouseEvent | null, invoiceId: string) => {
    e?.stopPropagation();
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

  const handleDownloadPDF = async (e: React.MouseEvent | null, invoiceId: string) => {
    e?.stopPropagation();
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

  const handleSendReminder = async (e: React.MouseEvent | null, invoiceId: string) => {
    e?.stopPropagation();
    setSendingReminderId(invoiceId);
    try {
      await postData({
        url: `/api/v1/invoices/${invoiceId}/send_reminder/`,
        data: {},
      });
      flash("Reminder sent");
      refetchInvoices();
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

  // "Overdue" uses the one shared definition (unpaid, sent, past due),
  // whatever the status string says, so it matches the Overdue tile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusMatches = (inv: any, status: string) =>
    status === "All" ||
    (status === "OVERDUE" ? isInvoiceOverdue(inv) : inv.status?.toUpperCase() === status);

  const filtered = allInvoices.filter((inv) => {
    const matchStatus = statusMatches(inv, statusFilter);
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
  const monthName = MONTH_NAMES[now.getMonth()];
  const byStatus = stats?.by_status ?? {};
  const draftCount: number = byStatus.DRAFT ?? 0;
  const invoicedMtd: number = stats?.total_invoiced_mtd ?? 0;
  const collectedMtd: number = stats?.total_collected_mtd ?? 0;
  const monthActive = invoicedMtd > 0 || collectedMtd > 0;
  const truncatedList = totalInvoices > invoices.length;
  // Overdue tile: when every invoice is loaded, count them with the same
  // definition the filter uses so the two always agree. Only when the list is
  // partial (the API pages at 20) does it fall back to the server's figure.
  const overdueList = invoices.filter((i) => isInvoiceOverdue(i));
  const overdueFromList = !truncatedList;
  const overdueCount: number = overdueFromList ? overdueList.length : (stats?.overdue_count ?? 0);
  const overdueAmount: number = overdueFromList
    ? overdueList.reduce((sum, i) => sum + invoiceBalance(i), 0)
    : (stats?.overdue_amount ?? 0);
  const paidCount: number = byStatus.PAID ?? 0;
  const avgDays: number | null = paidCount > 0 && stats?.avg_days_to_pay ? stats.avg_days_to_pay : null;
  const truncated = truncatedList;
  // Drafts waiting to be sent: a decision (send them), counted from the list
  // when it is complete, otherwise from the server's status counts.
  const draftList = invoices.filter((i) => (i.status || "").toUpperCase() === "DRAFT");
  const draftsCount: number = truncatedList ? draftCount : draftList.length;
  // At most four tiles: the drafts tile only fills a row that has room.
  const showDrafts = draftsCount > 0 && (monthActive ? 2 : 0) + (overdueCount > 0 ? 1 : 0) + (avgDays != null ? 1 : 0) < 4;
  const draftAmount: number | null = truncatedList
    ? null
    : draftList.reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);

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
  const lastMonthName = MONTH_NAMES[lastMonthStart.getMonth()];
  const invoicedDelta = (() => {
    if (invoicedLastMonth == null) return null;
    if (invoicedLastMonth === 0) return `Nothing invoiced in ${lastMonthName}`;
    const pct = ((invoicedMtd - invoicedLastMonth) / invoicedLastMonth) * 100;
    return `${pct >= 0 ? "+" : "−"}${formatPercent(Math.abs(pct), 0)} vs ${lastMonthName}`;
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

      {preview && (
        <InvoiceSendPreview
          kind={preview.kind}
          invoice={preview.invoice}
          sending={preview.kind === "reminder" ? sendingReminderId === preview.invoice.id : sendingId === preview.invoice.id}
          onCancel={() => setPreview(null)}
          onConfirm={async () => {
            const { kind, invoice } = preview;
            if (kind === "reminder") await handleSendReminder(null, invoice.id);
            else await handleSendInvoice(null, invoice.id);
            setPreview(null);
          }}
        />
      )}

      {failed ? (
        <LoadError
          what="invoices"
          error={invoicesQuery.error ?? invoicesQuery.failureReason}
          busy={invoicesQuery.isFetching}
          onRetry={() => refetchInvoices()}
        />
      ) : (
      <>
      {/* Headline: tiles only where the number drives a decision */}
      {loading ? (
        <div className="tw-kpi-row fin-kpi-row" aria-busy="true" aria-label="Loading totals">
          {[0, 1, 2].map((i) => <div key={i} className="tw-kpi fin-skel-tile" aria-hidden="true" />)}
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
        // The standard tile: only figures that drive a decision, never a dash.
        (monthActive || overdueCount > 0 || avgDays != null || showDrafts) && (
        <KpiRow className="fin-kpi-row">
          {/* Separate children (not a fragment) so KpiRow counts the tiles. */}
          {monthActive && (
              <KpiTile
                label={`Invoiced in ${monthName}`}
                aside={<InfoTip>{`Invoice totals incl. VAT, by issue date since the 1st. Covers all invoices.${invoicedLastMonth == null ? "" : ` Change compares ${lastMonthName}.`}`}</InfoTip>}
                figure={<span title={formatCurrency(invoicedMtd)}>{wholeRand(invoicedMtd)}</span>}
                note={invoicedDelta ?? "By issue date"}
              />
          )}
          {monthActive && (
              <KpiTile
                label="Collected"
                aside={<InfoTip>{`Paid amount of invoices issued in ${monthName}. Covers all invoices.`}</InfoTip>}
                figure={<span title={formatCurrency(collectedMtd)}>{wholeRand(collectedMtd)}</span>}
                note={invoicedMtd > 0 ? `${Math.round((stats.collection_rate ?? 0) * 100)}% of ${monthName} invoiced` : `On ${monthName} invoices`}
              />
          )}

          {overdueCount > 0 && (
            <KpiTile
              label="Overdue"
              aside={
                <InfoTip>
                  {overdueFromList
                    ? "Unpaid balance incl. VAT on sent invoices past their due date, including part-paid ones. Covers all invoices. Select to show them."
                    : "Unpaid balance incl. VAT on invoices past their due date, from the server's count of all invoices. Select to show them."}
                </InfoTip>
              }
              figure={<span title={formatCurrency(overdueAmount)}>{wholeRand(overdueAmount)}</span>}
              note={`${overdueCount} ${overdueCount === 1 ? "invoice" : "invoices"} late`}
              tone="danger"
              onClick={statusFilter !== "OVERDUE" ? () => showStatus("OVERDUE") : undefined}
              aria-label={`Overdue: ${formatCurrency(overdueAmount)}, ${overdueCount} late. Show overdue invoices`}
            />
          )}
          {avgDays != null && (
            <KpiTile
              label="Time to get paid"
              aside={<InfoTip>Average from issue date to payment date, across all paid invoices.</InfoTip>}
              figure={<>{formatNumber(avgDays, { maximumFractionDigits: 1 })}<span className="fin-tile__unit">days</span></>}
              note={`Average, ${paidCount} paid ${paidCount === 1 ? "invoice" : "invoices"}`}
            />
          )}
          {showDrafts && (
            <KpiTile
              label="Not sent yet"
              aside={<InfoTip>Draft invoices, incl. VAT. They are not owed until you send them. Select to show them.</InfoTip>}
              figure={draftAmount != null
                ? <span title={formatCurrency(draftAmount)}>{wholeRand(draftAmount)}</span>
                : <>{draftsCount}<span className="fin-tile__unit">{draftsCount === 1 ? "draft" : "drafts"}</span></>}
              note={draftAmount != null ? `${draftsCount} ${draftsCount === 1 ? "draft" : "drafts"} to send` : "Drafts to send"}
              onClick={statusFilter !== "DRAFT" ? () => showStatus("DRAFT") : undefined}
              aria-label={`Not sent yet: ${draftsCount} ${draftsCount === 1 ? "draft" : "drafts"}. Show drafts`}
            />
          )}
        </KpiRow>
        )
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
        <Segmented
          label="Filter by status"
          className="fin-seg"
          value={statusFilter}
          onChange={showStatus}
          options={STATUSES.map((s) => ({
            value: s,
            label: s === "All" ? "All" : formatStatus(s),
            // Counts over the loaded list, with the same rules as the filter.
            count: loading ? undefined : allInvoices.filter((inv) => statusMatches(inv, s)).length,
          }))}
        />
        <span className="fin-toolbar__count">
          {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
          {!loading && truncated && (
            <>
              {` · latest ${allInvoices.length} of ${totalInvoices}`}
              <InfoTip align="end">
                This list holds the {allInvoices.length} most recent of {totalInvoices} invoices; search and filters apply to
                these. The figures above cover all {totalInvoices}.
              </InfoTip>
            </>
          )}
        </span>
      </div>

      {/* Table: 10 per page, clickable */}
      <div className="card fin-table-card fin-table-card--fit">
        <div className="fin-table-scroll">
          <table className="fin-table fin-table--stack table-heading-roles">
            <thead>
              <tr>
                <th className="fin-cell-fill">Customer</th>
                <th>Issued</th>
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
                  <td colSpan={6} style={{ padding: 0 }}>
                    {loading ? (
                      <div className="fin-empty fin-empty--compact">Loading invoices…</div>
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
                      {...rowLink(() => navigate(`/finance/invoices/${inv.id}`))}
                      onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                      <td className="fin-strong m-party m-span2 fin-cell-2 fin-cell-fill">
                        <div className="fin-truncate fin-truncate--fill" title={custName}>
                          {custName}
                        </div>
                        <span className="fin-cell-sub">
                          <span className="fin-id">{invNumber}</span>
                        </span>
                      </td>
                      <td className="fin-date m-hide">{safeDate(inv.issue_date)}</td>
                      <td className={`fin-date m-due${agingLabel ? "" : " m-hide"}`}>
                        <span className="fin-mobile-only">Due </span>
                        {safeDate(dueDate)}
                        {agingLabel && (
                          <span className={ageDays > 0 ? "fin-text-danger" : "fin-text-muted"}> · {agingLabel}</span>
                        )}
                      </td>
                      <td className="m-status">
                        <span className="fin-inline-list" style={{ flexWrap: "nowrap" }}>
                          <StatusChip status={invStatus} size="sm" />
                          {capitalEntry && tier && (
                            <StatusChip
                              tone={TIER_TONE[tier] ?? "neutral"}
                              label={formatStatus(tier)}
                              size="sm"
                              title="Fast Pay risk tier"
                            />
                          )}
                        </span>
                      </td>
                      <td className="num m-amount">{formatCurrency(amount)}</td>
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          label={`Invoice ${invNumber}`}
                          items={[
                            { label: "Open invoice", onSelect: () => navigate(`/finance/invoices/${inv.id}`) },
                            ...(invStatus === "DRAFT"
                              ? [{
                                  label: sendingId === inv.id ? "Sending…" : "Send to customer",
                                  onSelect: () => setPreview({ kind: "invoice", invoice: inv }),
                                  disabled: sendingId === inv.id,
                                }]
                              : []),
                            ...(canSendReminder(inv)
                              ? [{
                                  label: sendingReminderId === inv.id ? "Sending…" : "Send reminder",
                                  onSelect: () => setPreview({ kind: "reminder", invoice: inv }),
                                  disabled: sendingReminderId === inv.id,
                                }]
                              : []),
                            ...(invStatus !== "DRAFT"
                              ? [{ label: "Download PDF", onSelect: () => handleDownloadPDF(null, inv.id) }]
                              : []),
                            ...(capitalEntry
                              ? applied
                                ? [{ label: "Applied for Fast Pay", hint: "Your earlier application is on record.", onSelect: () => {}, disabled: true }]
                                : [{
                                    // No handler until Fast Pay launches (unchanged behaviour).
                                    label: CAPITAL_LAUNCHED ? "Request Fast Pay" : "Request Fast Pay (coming soon)",
                                    hint: CAPITAL_LAUNCHED ? undefined : CAPITAL_COMING_SOON,
                                    onSelect: () => {},
                                    disabled: !CAPITAL_LAUNCHED,
                                  }]
                              : []),
                            ...(ineligibleEntry
                              ? [{ label: "Not eligible for Fast Pay", hint: String(ineligibleEntry.reason ?? ""), onSelect: () => {}, disabled: true }]
                              : []),
                          ]}
                        />
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
      </>
      )}
    </div>
  );
}
