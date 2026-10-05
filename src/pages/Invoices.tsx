import "./table-heading-roles.css";
import { CAPITAL_LAUNCHED, CAPITAL_COMING_SOON } from '@/lib/features';
import { useFastPayInvoices } from '@/lib/capital/api';
import type { Offer } from '@/lib/capital/types';
import "./finance-brand.css";
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { fetchData, postData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import SectionHeader, { FINANCE_TABS } from "@/components/layout/SectionHeader";
import RowActions from "@/components/ui/RowActions";
import { providerConfig, usePaymentsManaged } from "@/lib/accounting";
import { InfoTip } from "@/components/ui/InfoTip";
import { wholeRand } from "@/components/finance/FinTile";
import { KpiRow, KpiTile } from "@/components/ui/KpiTile";
import { Toolbar, SearchInput } from "@/components/ui/Toolbar";
import { Segmented } from "@/components/ui/Segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import LoadError, { loadFailed } from "@/components/data/LoadError";
import InvoiceSendPreview, { type InvoiceMessageKind } from "@/components/finance/InvoiceSendPreview";
import { canSendReminder, invoiceBalance } from "@/lib/invoiceStatus";
import { rowLink } from "@/lib/rowLink";
import { daysBetween, todayISO } from "@/components/reports/data";

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

// Server-side list: one page of rows for the chosen status and search (the
// API filters, sorts newest-first and pages), plus the summary for the tiles
// and chip counts over every invoice (GET invoices/summary/, the same rules
// the page used to apply to its full download).
type InvoiceSummary = {
  month: string; invoiced_mtd: number; collected_mtd: number; collection_rate: number;
  invoiced_last_month: number; overdue_count: number; overdue_amount: number;
  paid_count: number; avg_days_to_pay: number | null; draft_count: number; draft_amount: number;
  status_counts: Record<string, number>;
};
const invoicesUrl = (status: string, search: string, page: number) => {
  const q = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (status !== "All") q.set("status", status);
  if (search.trim()) q.set("search", search.trim());
  return `/api/v1/invoices/?${q.toString()}`;
};

export default function Invoices() {
  const navigate = useNavigate();
  // While an accounting system owns payments, the row menu sends people there.
  const { managed: paymentsManaged } = usePaymentsManaged();
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

  // Search waits for a pause in typing before asking the server.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // One server page; the previous page stays on screen while the next loads.
  const invoicesQuery = useQuery({
    queryKey: ["invoices-page", statusFilter, debouncedSearch, page],
    queryFn: () => fetchData(invoicesUrl(statusFilter, debouncedSearch, page)),
    placeholderData: keepPreviousData,
  });
  const summaryQuery = useQuery<InvoiceSummary>({
    queryKey: ["invoices-summary"],
    queryFn: () => fetchData("/api/v1/invoices/summary/"),
  });
  const refetchInvoices = () => { invoicesQuery.refetch(); summaryQuery.refetch(); };
  // Nothing to show because the request failed (or is failing and retrying):
  // the page says so instead of spinning or showing an empty list.
  const failed = loadFailed(invoicesQuery);
  const loading = invoicesQuery.isLoading && !failed;
  const listData = invoicesQuery.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(listData) ? listData : (listData?.results ?? []);
  const matchCount: number = typeof listData?.count === "number" ? listData.count : rows.length;
  const summary = summaryQuery.data ?? null;
  const searching = search !== debouncedSearch || (invoicesQuery.isFetching && invoicesQuery.isPlaceholderData);

  // Capital-eligible invoices — fetched once, cached; silently ignored if no facility
  const { data: capitalData } = useQuery({
    queryKey: ["capital-eligible"],
    queryFn: () => fetchData("api/v1/capital/eligible/").catch(() => null),
    // Launched, Fast Pay reads the server offers instead (below).
    enabled: !CAPITAL_LAUNCHED,
  });
  // Launched: each invoice's Fast Pay offer or live request, from the server.
  const fastPay = useFastPayInvoices({ enabled: CAPITAL_LAUNCHED });
  const offerById = new Map<string, Offer>(
    [...(fastPay.data?.offers ?? []), ...(fastPay.data?.ineligible ?? [])].map((o) => [String(o.invoice_id), o]),
  );
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

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

  // Headline figures and chip counts come from the server's summary over every
  // invoice (core/services/invoice_list.py: the Reports ledger rules), so they
  // don't depend on which page or filter is showing. Bases:
  //   invoiced this month  issued invoices incl. VAT, by issue date since the 1st
  //   collected this month paid amount of those invoices
  //   overdue              unpaid balance incl. VAT, due date passed
  //   time to get paid     issue date to paid date, all paid invoices
  const now = new Date();
  const monthName = MONTH_NAMES[now.getMonth()];
  const invoicedMtd = summary?.invoiced_mtd ?? 0;
  const collectedMtd = summary?.collected_mtd ?? 0;
  const collectionRate = summary?.collection_rate ?? 0;
  const monthActive = invoicedMtd > 0 || collectedMtd > 0;
  const overdueCount = summary?.overdue_count ?? 0;
  const overdueAmount = summary?.overdue_amount ?? 0;
  const paidCount = summary?.paid_count ?? 0;
  const avgDays: number | null = summary?.avg_days_to_pay ?? null;
  const draftsCount = summary?.draft_count ?? 0;
  const draftAmount: number | null = summary ? summary.draft_amount : null;
  // At most four tiles: the drafts tile only fills a row that has room.
  const showDrafts = draftsCount > 0 && (monthActive ? 2 : 0) + (overdueCount > 0 ? 1 : 0) + (avgDays != null ? 1 : 0) < 4;
  const totalInvoices = summary?.status_counts?.All ?? null;

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const invoicedLastMonth = summary ? summary.invoiced_last_month : null;
  const lastMonthName = MONTH_NAMES[lastMonthStart.getMonth()];
  const invoicedDelta = (() => {
    if (invoicedLastMonth == null) return null;
    if (invoicedLastMonth === 0) return `Nothing invoiced in ${lastMonthName}`;
    const pct = ((invoicedMtd - invoicedLastMonth) / invoicedLastMonth) * 100;
    return `${pct >= 0 ? "+" : "−"}${formatPercent(Math.abs(pct), 0)} vs ${lastMonthName}`;
  })();

  const statusOptions = STATUSES.map((st) => ({
    value: st,
    label: st === "All" ? "All" : formatStatus(st),
    count: summary?.status_counts?.[st],
  }));

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
          <button type="button" className="tw-btn tw-btn--primary" onClick={() => navigate("/finance/invoices/new")}>
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
      ) : summaryQuery.isError && !summary ? (
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
                note={invoicedMtd > 0 ? `${Math.round(collectionRate * 100)}% of ${monthName} invoiced` : `On ${monthName} invoices`}
              />
          )}

          {overdueCount > 0 && (
            <KpiTile
              label="Overdue"
              aside={
                <InfoTip>
                  Unpaid balance incl. VAT on sent invoices past their due date, including part-paid ones. Covers all invoices. Select to show them.
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
              aside={<InfoTip>Average days from issue date to the date the invoice was paid in full, across every paid invoice (the Paid filter below).</InfoTip>}
              figure={<>{formatNumber(avgDays, { maximumFractionDigits: 1 })}<span className="fin-tile__unit">days</span></>}
              note={`${paidCount} paid ${paidCount === 1 ? "invoice" : "invoices"}`}
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

      {/* Filters: the shared toolbar (36px controls), as on every list. */}
      <Toolbar
        className="fin-toolbar"
        aria-label="Filter invoices"
        meta={
          <>
            {matchCount} {matchCount === 1 ? "invoice" : "invoices"}
          </>
        }
      >
        <SearchInput
          wrapClassName="inv-search"
          placeholder="Search invoices"
          aria-label="Search invoices by number or customer"
          busy={searching}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {/* Five statuses: the segmented control on wide screens, a compact
            menu beside the search on phones (no 5-option strip). */}
        <span className="inv-status-seg">
          <Segmented
            label="Filter by status"
            className="fin-seg"
            value={statusFilter}
            onChange={showStatus}
            options={statusOptions}
          />
        </span>
        <span className="inv-status-menu">
          <Select value={statusFilter} onValueChange={showStatus}>
            <SelectTrigger aria-label="Filter by status" className="inv-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}{o.count != null ? ` (${o.count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </Toolbar>

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
                    ) : totalInvoices === 0 ? (
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
                  const today = todayISO();
                  const invStatus = inv.status?.toUpperCase();
                  const amount = parseFloat(inv.total_amount || inv.amount) || 0;
                  const invNumber = inv.invoice_number || inv.invoiceNumber;
                  const custName = inv.customer_name || inv.customerName;
                  const dueDate = inv.due_date || inv.dueDate;
                  // Days relative to the due date, stated in words next to it:
                  // whole SA calendar days, the Debtors report's count.
                  const ageDays = dueDate ? daysBetween(String(dueDate), today) : 0;
                  const open = invStatus !== "PAID" && invStatus !== "DRAFT" && invStatus !== "CANCELLED" && invStatus !== "CREDITED" && !!dueDate;
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
                          {/* Cancelled invoices are shown as "Void". */}
                          <StatusChip status={invStatus} label={invStatus === "CANCELLED" ? "Void" : undefined} size="sm" />
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
                      <td className={`num m-amount${(invStatus === "PARTIALLY_PAID" && invoiceBalance(inv) > 0.005) || (invStatus !== "CREDITED" && parseFloat(inv.credited_amount || "0") > 0.005) ? " fin-cell-2" : ""}`}>
                        {/* Lists show whole rands; cents stay on the invoice and in the title (R8). */}
                        <span title={formatCurrency(amount)}>{wholeRand(amount)}</span>
                        {/* Part-paid: what is still owed, under the invoice total. */}
                        {invStatus === "PARTIALLY_PAID" && invoiceBalance(inv) > 0.005 && (
                          <span className="fin-cell-sub" title={`${formatCurrency(invoiceBalance(inv))} due`}>{wholeRand(invoiceBalance(inv))} due</span>
                        )}
                        {/* Part-credited: what credit notes took off. */}
                        {invStatus !== "PARTIALLY_PAID" && invStatus !== "CREDITED" && parseFloat(inv.credited_amount || "0") > 0.005 && (
                          <span className="fin-cell-sub" title={`${formatCurrency(inv.credited_amount)} credited`}>{wholeRand(parseFloat(inv.credited_amount))} credited</span>
                        )}
                      </td>
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          label={`Invoice ${invNumber}`}
                          items={[
                            { label: "Open invoice", onSelect: () => navigate(`/finance/invoices/${inv.id}`) },
                            ...(inv.accounting_sync?.url
                              ? [{
                                  label: paymentsManaged && ["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID"].includes(invStatus)
                                    ? `Record payment in ${providerConfig(inv.accounting_sync.provider).short}`
                                    : `Open in ${providerConfig(inv.accounting_sync.provider).short}`,
                                  hint: paymentsManaged ? `Payments sync from ${providerConfig(inv.accounting_sync.provider).short} automatically.` : undefined,
                                  onSelect: () => { window.open(inv.accounting_sync.url, "_blank", "noopener,noreferrer"); },
                                }]
                              : []),
                            ...(invStatus === "DRAFT"
                              ? [{ label: "Edit draft", onSelect: () => navigate(`/finance/invoices/${inv.id}/edit`) }]
                              : []),
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
                            ...(CAPITAL_LAUNCHED ? fastPayMenu(offerById.get(String(inv.id)), navigate) : []),
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
              {(page - 1) * PAGE_SIZE + 1} to {(page - 1) * PAGE_SIZE + rows.length} of {matchCount}
            </span>
            <div className="fin-table-foot__nav">
              <button
                type="button"
                className="tw-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}>
                Previous
              </button>
              <button
                type="button"
                className="tw-btn"
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

/** Launched: the invoice row's Fast Pay menu item, from the server offer. */
function fastPayMenu(offer: Offer | undefined, navigate: (to: string) => void) {
  if (!offer) return [];
  if (offer.advance) {
    const advanceId = offer.advance.id;
    return [{ label: `Fast Pay: ${offer.advance.status_label}`, onSelect: () => navigate(`/capital/advances/${advanceId}`) }];
  }
  if (offer.decision === "DECLINE" || !offer.eligible) {
    return [{ label: "Not eligible for Fast Pay", hint: offer.reasons?.[0]?.text ?? offer.explanation, onSelect: () => {}, disabled: true }];
  }
  return [{ label: "Request Fast Pay", onSelect: () => navigate(`/capital?request=${offer.invoice_id}`) }];
}
