import './quote-invoice-roles.css';
import './table-heading-roles.css';
import './bookings-typography.css';
import './bookings-section.css';
import './ops-tiles.css';
import SectionHeader from '@/components/layout/SectionHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { useStickyRail } from '@/components/fleet-detail/useStickyRail';
import { InfoTip } from '@/components/ui/InfoTip';
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { formatCurrency, formatDate, formatMoneyWhole } from '@/lib/formatters';
import { ArrowLeft, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockSkeleton, TilesSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import { usePipeline } from '@/components/overview/today';
import { useLedger, isOpen, num, todayISO, daysBetween } from '@/components/reports/data';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { rowLink } from '@/lib/rowLink';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

// Exact rand amounts, two decimals, shared formatter.
const formatZAR = (v: number) => formatCurrency(v || 0);

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  NET30: "Net 30 days",
  NET60: "Net 60 days",
  NET90: "Net 90 days",
};
// "NET45" → "Net 45 days" for terms outside the fixed list.
const paymentTermsLabel = (v?: string) =>
  !v ? "Net 30 days" : PAYMENT_TERMS_LABEL[v] || (/^NET(\d+)$/.test(v) ? `Net ${v.slice(3)} days` : v);

// Sentence-case a status token for display: "IN_TRANSIT" → "In transit".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase()) : "—";

const QUOTE_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SENT: "warning",
  PENDING: "warning",
  ACCEPTED: "success",
  COMPLETED: "success",
  IT: "info",
  DECLINED: "danger",
  REJECTED: "danger",
  EXPIRED: "neutral",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "8px 12px",
  borderRadius: "var(--radius-control, 8px)",
  fontSize: 14,
  lineHeight: "20px",
  fontFamily: "var(--font-sans)",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  lineHeight: "20px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const PAYMENT_TERMS = [
  { value: "NET30", label: "Net 30 days" },
  { value: "NET60", label: "Net 60 days" },
  { value: "NET90", label: "Net 90 days" },
];

const QUOTES_SHOWN = 5;

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const railRef = useStickyRail<HTMLElement>();
  const [showEdit, setShowEdit] = useState(false);
  useFocusTrap(latestModal, showEdit);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  // Quotes: the 5 most recent, the rest behind "Show all" (many are repeat drafts).
  const [allQuotes, setAllQuotes] = useState(false);

  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchData(`api/v1/customers/${id}/`),
    enabled: !!id,
  });
  const { data: customer, isLoading } = customerQuery;
  const customerFailed = loadFailed(customerQuery);
  const customerError = (customerQuery.error ?? customerQuery.failureReason) as { status?: number } | null;

  const { data: quotesData } = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: () => fetchData(`api/v1/quotes/?customer=${id}&page_size=50`),
    enabled: !!id,
  });
  const quotes: any[] = Array.isArray(quotesData) ? quotesData : (quotesData?.results || []);
  // Win rate uses Home's definition (components/overview/today.tsx): quotes
  // accepted or turned into a load, out of quotes actually sent. Drafts were
  // never offered, so they are neither won nor lost.
  const pipeline = usePipeline(quotes);
  // Their invoices, from the same ledger as Invoices and the Debtors report.
  const ledger = useLedger(['invoices']);

  // A failed request is not a missing record: only a 404 says "not found".
  if (customerFailed && customerError?.status !== 404) return (
    <div className="bk-detail">
      <button type="button" className="bk-back" onClick={() => navigate("/customers")}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to customers
      </button>
      <LoadError what="this customer" error={customerError} busy={customerQuery.isFetching} onRetry={() => customerQuery.refetch()} />
    </div>
  );

  // Loading: keep the back link and page frame; only the content waits.
  if (isLoading && !customerFailed) return (
    <div className="bk-detail bookings-typography">
      <SectionHeader
        title="Loading customer"
        back={{ to: '/customers', label: 'Customers' }}
      />
      <TilesSkeleton count={4} />
      <BlockSkeleton height={280} label="Loading customer" />
    </div>
  );

  if (!customer) return (
    <div className="bk-detail">
      <button type="button" className="bk-back" onClick={() => navigate("/customers")}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to customers
      </button>
      <div className="bk-card">
        <div className="bk-empty" style={{ padding: 16 }}>
          <h1 className="bk-empty__title">Customer not found</h1>
          <p className="bk-empty__text">It may have been removed, or the link is out of date.</p>
          <button type="button" className="bk-btn bk-btn--primary" onClick={() => navigate("/customers")}>View customers</button>
        </div>
      </div>
    </div>
  );

  const totalQuotes = quotes.length;
  const sortedQuotes = [...quotes].sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  // The quotes endpoint is paginated (page_size=50): every figure below is
  // computed from the quotes actually loaded, and says so when that is not all of them.
  const quotesOnServer: number = Array.isArray(quotesData) ? quotes.length : (quotesData?.count ?? quotes.length);
  const basis = quotesOnServer > totalQuotes ? `the latest ${totalQuotes} of ${quotesOnServer} quotes` : `${totalQuotes} ${totalQuotes === 1 ? "quote" : "quotes"}`;
  const WON = ["ACCEPTED", "IT", "COMPLETED"];
  const wonQuotes = quotes.filter((q: any) => WON.includes(String(q.status || "").toUpperCase()));
  const sentQuotes = quotes.length - pipeline.drafts;
  const totalRevenue = wonQuotes.reduce((s: number, q: any) => s + parseFloat(q.total_amount || q.quote_price || "0"), 0);
  const isActive = customer.is_active !== false && customer.status !== "INACTIVE";

  // Money: open invoices (issued, unpaid, balance above zero, incl. VAT).
  const today = todayISO();
  const theirInvoices = (ledger.data?.invoices ?? [])
    .filter(i => i.customer === customer.id)
    .sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""));
  const openInvoices = theirInvoices.filter(isOpen);
  const owed = openInvoices.reduce((t, i) => t + num(i.balance), 0);
  const lateInvoices = openInvoices.filter(i => i.due_date && i.due_date.slice(0, 10) < today);
  const overdue = lateInvoices.reduce((t, i) => t + num(i.balance), 0);
  const oldestLate = lateInvoices.reduce((m, i) => Math.max(m, daysBetween(i.due_date, today)), 0);
  const invoiceRows = [...openInvoices, ...theirInvoices.filter(i => !isOpen(i))].slice(0, 10);
  // Company first; the contact person only when they differ.
  const displayName = (customer.company_name || "").trim() || customer.name;
  const contact = (customer.name || "").trim();
  const showContact = contact && contact.toLowerCase() !== displayName.toLowerCase();

  function openEdit() {
    setEditForm({
      name: customer.name || "",
      company_name: customer.company_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      city: customer.city || "",
      state: customer.state || "",
      address: customer.address || "",
      zip_code: customer.zip_code || "",
      billing_address: customer.billing_address || "",
      payment_terms_default: customer.payment_terms_default || "NET30",
      credit_limit: customer.credit_limit ?? "",
      status: isActive ? "ACTIVE" : "INACTIVE",
    });
    setShowEdit(true);
  }

  async function handleStatusToggle() {
    setUpdating(true);
    try {
      const newStatus = isActive ? "INACTIVE" : "ACTIVE";
      await patchData({ url: `api/v1/customers/${id}/`, data: { status: newStatus, is_active: !isActive } });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      toast.success(`Customer marked ${newStatus.toLowerCase()}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    }
    setUpdating(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (payload.credit_limit === "") payload.credit_limit = null;
      else if (payload.credit_limit) payload.credit_limit = parseFloat(String(payload.credit_limit));
      payload.is_active = payload.status !== "INACTIVE";
      await patchData({ url: `api/v1/customers/${id}/`, data: payload });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      setShowEdit(false);
      toast.success("Customer updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update customer");
    }
    setSaving(false);
  }

  // Tiles show whole rands; the exact amount sits in the title.
  const wholeRand = (n: number) => formatMoneyWhole(n);

  return (
    <div className="bk-detail bookings-typography">
      {/* Back + Header */}
      <SectionHeader
        title={displayName}
        back={{ to: '/customers', label: 'Customers' }}
        titleAdornment={<><StatusChip status={isActive ? "ACTIVE" : "INACTIVE"} /></>}
        description={showContact ? <>Contact: {contact}</> : undefined}
        actions={<>
          <button
            type="button"
            className="bk-btn bk-btn--secondary"
            onClick={() => navigate(`/customers/${id}/risk`)}
          >Payment risk profile</button>
          <button type="button" className="bk-btn bk-btn--primary" onClick={openEdit}>Edit customer</button>
        </>}
      />

      <div className="bk-detail-grid bk-detail-grid--rail">
        <div className="bk-stack">
          {/* Key figures first: what they owe you, then what they are worth.
              Until quotes and invoices arrive, tile placeholders hold the row
              (never the "not quoted yet" notice, which would then swap out). */}
          {quotesData === undefined || (!ledger.data && !ledger.error) ? (
            <div className="cd-tiles-skel"><TilesSkeleton count={2} /></div>
          ) : (owed > 0 || totalQuotes > 0) ? (
            <KpiRow>
              {owed > 0 && (
                <KpiTile
                  aria-label="Owed to you"
                  label="Owed to you"
                  aside={<InfoTip>Unpaid balances on issued invoices, including VAT. Same basis as Invoices and the Debtors report.</InfoTip>}
                  figure={<span title={formatZAR(owed)}>{wholeRand(owed)}</span>}
                  note={`${openInvoices.length} ${openInvoices.length === 1 ? "invoice" : "invoices"}`}
                />
              )}
              {overdue > 0 && (
                <KpiTile
                  aria-label="Overdue"
                  label="Overdue"
                  figure={<span title={formatZAR(overdue)}>{wholeRand(overdue)}</span>}
                  note={`Oldest ${oldestLate} ${oldestLate === 1 ? "day" : "days"} late`}
                  tone="danger"
                />
              )}
              {wonQuotes.length > 0 && (
                <KpiTile
                  aria-label="Won from quotes"
                  label="Won from quotes"
                  aside={<InfoTip>Totals of quotes accepted or turned into a load, from {basis}.</InfoTip>}
                  figure={<span title={formatZAR(totalRevenue)}>{wholeRand(totalRevenue)}</span>}
                  note={`${wonQuotes.length} ${wonQuotes.length === 1 ? "quote" : "quotes"} won`}
                />
              )}
              {pipeline.winRate != null && (
                <KpiTile
                  aria-label="Win rate"
                  label="Win rate"
                  aside={<InfoTip>Quotes accepted or turned into a load, out of quotes sent. Drafts are left out. Same definition as Home.</InfoTip>}
                  figure={`${pipeline.winRate}%`}
                  note={`${wonQuotes.length} of ${sentQuotes} sent`}
                />
              )}
            </KpiRow>
          ) : (
            <div className="bk-notice" style={{ marginBottom: 0 }}>
              <div>
                <p className="bk-notice__text">You have not quoted {displayName} yet.</p>
              </div>
              <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
            </div>
          )}

          {/* Contact details: a definition grid across the column, not
              label/value rows with the value 700px from its label. */}
          <section className="bk-card" aria-labelledby="cd-contact-title">
            <div className="bk-card__head"><h2 className="bk-card__title" id="cd-contact-title">Contact details</h2></div>
            <dl className="bk-facts bk-facts--auto cd-contact">
              {[
                ...(showContact ? [{ label: "Contact", value: contact }] : []),
                { label: "Email", value: customer.email, wide: true },
                { label: "Phone", value: customer.phone },
                { label: "City", value: customer.city },
                { label: "Province", value: customer.state },
                { label: "Postal code", value: customer.zip_code },
                { label: "Address", value: customer.address, wide: true },
                { label: "Billing address", value: customer.billing_address || customer.address, wide: true },
              ].map((r: { label: string; value?: string; wide?: boolean }) => (
                <div key={r.label} className={r.wide ? 'bk-fact--wide' : undefined}>
                  <dt className="bk-fact__label">{r.label}</dt>
                  <dd className="bk-fact__value">{r.value || <span className="bk-muted">Not recorded</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Account Details: sticky rail */}
        <section ref={railRef} className="bk-card" aria-labelledby="cd-account-title">
          <div className="bk-card__head"><h2 className="bk-card__title" id="cd-account-title">Account details</h2></div>
          {[
            { label: "Payment terms", value: paymentTermsLabel(customer.payment_terms_default) },
            { label: "Owed now", value: ledger.data ? (owed > 0 ? formatZAR(owed) : "Nothing owed") : ledger.error ? "Could not load" : "…" },
            {
              label: "Credit limit",
              // Its source in one visible line (R5), not only behind a tip.
              value: customer.credit_limit ? formatZAR(parseFloat(customer.credit_limit)) : "Not set",
              note: customer.credit_limit ? "Set by your team; not enforced" : undefined,
            },
            { label: "Invoices", value: theirInvoices.length ? `${theirInvoices.length} issued` : ledger.data ? "None yet" : "…" },
            { label: "Last quote", value: sortedQuotes[0]?.created_at ? formatDate(sortedQuotes[0].created_at) : "None yet" },
            { label: "Customer since", value: customer.created_at ? formatDate(customer.created_at) : "Not recorded" },
          ].map((r: { label: string; value: string; tip?: string; note?: string }) => (
            <div key={r.label} className={r.note ? 'bk-kv cd-kv--noted' : 'bk-kv'}>
              <span className="bk-kv__label">{r.label}{r.tip && <InfoTip label={`Where the ${r.label.toLowerCase()} comes from`}>{r.tip}</InfoTip>}</span>
              <span className="bk-kv__value">{r.value}{r.note && <span className="cd-kv__note">{r.note}</span>}</span>
            </div>
          ))}
          {/* Status lives with the account, not as a loose button in the head. */}
          <div className="bk-kv">
            <span className="bk-kv__label">Status</span>
            <span className="bk-kv__value cd-status">
              {isActive ? "Active" : "Inactive"}
              <button type="button" className="bk-link" disabled={updating} onClick={handleStatusToggle}>
                {updating ? "Updating…" : isActive ? "Mark inactive" : "Mark active"}
              </button>
            </span>
          </div>
        </section>
      </div>

      {/* Invoices: open ones first, then the most recent settled ones. */}
      <section className="bk-card" style={{ marginTop: "var(--section-gap, 24px)", padding: 0 }} aria-labelledby="cd-invoices-title">
        <div className="bk-card__head" style={{ padding: "var(--card-pad, 20px) var(--card-pad, 20px) 0" }}>
          <h2 className="bk-card__title" id="cd-invoices-title">Invoices</h2>
          <span className="bk-toolbar__end">
            {theirInvoices.length > invoiceRows.length
              ? `${invoiceRows.length} of ${theirInvoices.length}`
              : `${theirInvoices.length} ${theirInvoices.length === 1 ? "invoice" : "invoices"}`}
          </span>
        </div>
        {!ledger.data ? (
          ledger.error ? (
            <div className="bk-empty"><p className="bk-empty__text">Invoices could not be loaded. <button type="button" className="bk-link" onClick={ledger.retry}>Try again</button></p></div>
          ) : (
            // Header plus one row: most customers have one or two invoices.
            <div style={{ padding: "var(--card-pad, 20px)" }}><div className="ops-skel" style={{ height: 52 }} /></div>
          )
        ) : theirInvoices.length === 0 ? (
          <div className="bk-empty"><p className="bk-empty__text">No invoices for this customer yet.</p></div>
        ) : (
          <div className="bk-table-wrap bk-table-wrap--bare">
            <table className="table-heading-roles bk-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col" className="bk-col-opt">Issued</th>
                  <th scope="col" className="bk-col-phone">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-num bk-col-narrow">Total</th>
                  <th scope="col" className="is-num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map(inv => {
                  const late = isOpen(inv) && inv.due_date && inv.due_date.slice(0, 10) < today;
                  return (
                    <tr key={inv.id} className="is-clickable" {...rowLink(() => navigate(`/finance/invoices/${inv.id}`))} onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                      <td className="is-id">{inv.invoice_number}</td>
                      <td className="is-date bk-col-opt">{inv.issue_date ? formatDate(inv.issue_date) : "Not issued"}</td>
                      <td className="is-date bk-col-phone">
                        {inv.due_date ? formatDate(inv.due_date) : "Not set"}
                        {late && <span className="bk-muted"> · {daysBetween(inv.due_date, today)} days late</span>}
                      </td>
                      <td><StatusChip status={late && String(inv.status).toUpperCase() === "SENT" ? "OVERDUE" : inv.status} size="sm" /></td>
                      <td className="is-num bk-col-narrow">{formatZAR(num(inv.total_amount))}</td>
                      <td className="is-money">{isOpen(inv) ? formatZAR(num(inv.balance)) : <span className="bk-muted" aria-label="Nothing due">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quotes table */}
      <section className="bk-card" style={{ marginTop: "var(--section-gap, 24px)", padding: 0 }} aria-labelledby="cd-quotes-title">
        <div className="bk-card__head" style={{ padding: "var(--card-pad, 20px) var(--card-pad, 20px) 0" }}>
          <h2 className="bk-card__title" id="cd-quotes-title">Quotes</h2>
          <span className="bk-toolbar__end">
            {quotesOnServer > totalQuotes
              ? `Latest ${totalQuotes} of ${quotesOnServer}`
              : `${totalQuotes} ${totalQuotes === 1 ? "quote" : "quotes"}`}
          </span>
        </div>
        {quotes.length === 0 ? (
          <div className="bk-empty">
            <p className="bk-empty__text">No quotes yet for this customer.</p>
          </div>
        ) : (
          <div className="bk-table-wrap bk-table-wrap--bare">
            <table className="table-heading-roles bk-table">
              <thead>
                <tr>
                  <th scope="col">Quote</th>
                  <th scope="col" className="bk-col-route">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="bk-col-narrow">Date</th>
                  <th scope="col" className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(allQuotes ? sortedQuotes : sortedQuotes.slice(0, QUOTES_SHOWN)).map((q: any) => (
                  <tr
                    key={q.id}
                    className="is-clickable"
                    {...rowLink(() => navigate(`/bookings/quotes/${q.id}`))}
                    onClick={() => navigate(`/bookings/quotes/${q.id}`)}
                  >
                    <td className="is-id">
                      {q.quote_number || `#${q.id}`}
                    </td>
                    <td className="is-truncate bk-col-route" title={`${q.pickup_location || "—"} → ${q.delivery_location || "—"}`}>
                      {q.pickup_location || "—"} → {q.delivery_location || "—"}
                    </td>
                    <td>
                      {/* A quote that became a load reads as booked, not as the load's own state. */}
                      {String(q.status).toUpperCase() === "IT"
                        ? <StatusChip tone="success" label="Booked" size="sm" />
                        : q.outcome === 'rejected' && String(q.status).toUpperCase() === 'SENT'
                          // Same reading as the Quotes board: a lost answer sits with the declined ones.
                          ? <StatusChip status="LOST" label="Marked lost" size="sm" />
                          : <StatusChip status={q.status} size="sm" />}
                    </td>
                    <td className="is-date bk-col-narrow">
                      {q.created_at ? formatDate(q.created_at) : "—"}
                    </td>
                    <td className="is-money">
                      {q.total_amount || q.quote_price ? formatZAR(parseFloat(q.total_amount || q.quote_price)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedQuotes.length > QUOTES_SHOWN && (
              <div className="cd-more">
                <button type="button" className="bk-btn bk-btn--quiet" onClick={() => setAllQuotes(v => !v)} aria-expanded={allQuotes}>
                  {allQuotes ? `Show the latest ${QUOTES_SHOWN}` : `Show all ${sortedQuotes.length}`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Edit slide-out */}
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop, rgba(0,0,0,0.65))" }} onClick={() => setShowEdit(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-edit-title"
            style={{ position: "relative", width: 440, maxWidth: "100%", background: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", padding: 24, overflowY: "auto", fontFamily: "var(--font-sans)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 className="bk-dialog__title" id="cd-edit-title" style={{ margin: 0 }}>Edit customer</h2>
              <button type="button" className="bk-icon-btn" aria-label="Close" onClick={() => setShowEdit(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {[
              { key: "name", label: "Full name", placeholder: "e.g. John Doe" },
              { key: "company_name", label: "Company name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email" },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000" },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg" },
              { key: "state", label: "Province", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Postal code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor={`cd-edit-${f.key}`}>{f.label}</label>
                <input
                  id={`cd-edit-${f.key}`}
                  className="qi-input"
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ""}
                  onChange={e => setEditForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} id="cd-edit-terms">Payment terms</label>
              <Select value={editForm.payment_terms_default ?? "NET30"} onValueChange={val => setEditForm((p: any) => ({ ...p, payment_terms_default: val }))}>
                <SelectTrigger aria-labelledby="cd-edit-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...PAYMENT_TERMS, ...(editForm.payment_terms_default && !PAYMENT_TERMS.some(t => t.value === editForm.payment_terms_default)
                    ? [{ value: editForm.payment_terms_default, label: paymentTermsLabel(editForm.payment_terms_default) }] : [])]
                    .map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="cd-edit-credit">Credit limit (R)</label>
              <input id="cd-edit-credit" className="qi-input" type="number" placeholder="e.g. 50000" value={editForm.credit_limit ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, credit_limit: e.target.value }))} style={fieldStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} id="cd-edit-status">Status</label>
              <Select value={editForm.status ?? "ACTIVE"} onValueChange={val => setEditForm((p: any) => ({ ...p, status: val }))}>
                <SelectTrigger aria-labelledby="cd-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                type="button"
                className="bk-btn bk-btn--primary"
                style={{ flex: 1 }}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
