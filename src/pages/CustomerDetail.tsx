import './quote-invoice-roles.css';
import './table-heading-roles.css';
import './bookings-typography.css';
import './bookings-section.css';
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowLeft, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';

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

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchData(`api/v1/customers/${id}/`),
    enabled: !!id,
  });

  const { data: quotesData } = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: () => fetchData(`api/v1/quotes/?customer=${id}&page_size=50`),
    enabled: !!id,
  });

  if (isLoading) return <Loader fullScreen />;

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

  const quotes = Array.isArray(quotesData) ? quotesData : (quotesData?.results || []);
  const totalQuotes = quotes.length;
  // The quotes endpoint is paginated (page_size=50): every figure below is
  // computed from the quotes actually loaded, and says so when that is not all of them.
  const quotesOnServer: number = Array.isArray(quotesData) ? quotes.length : (quotesData?.count ?? quotes.length);
  const basis = quotesOnServer > totalQuotes ? `the latest ${totalQuotes} of ${quotesOnServer} quotes` : `${totalQuotes} ${totalQuotes === 1 ? "quote" : "quotes"}`;
  const acceptedQuotes = quotes.filter((q: any) => q.status === "ACCEPTED").length;
  const totalRevenue = quotes
    .filter((q: any) => q.status === "ACCEPTED")
    .reduce((s: number, q: any) => s + parseFloat(q.total_amount || q.quote_price || "0"), 0);
  const isActive = customer.is_active !== false && customer.status !== "INACTIVE";

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

  return (
    <div className="bk-detail bookings-typography">
      {/* Back + Header */}
      <button type="button" className="bk-back" onClick={() => navigate("/customers")}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to customers
      </button>
      <div className="bk-detail-header">
        <div className="bk-detail-header__titles">
          <div className="bk-eyebrow">Customer</div>
          <div className="bk-title-row">
            <h1 className="bk-title">{customer.name}</h1>
            <span className={`bk-status bk-status--${isActive ? "success" : "neutral"}`}>{isActive ? "Active" : "Inactive"}</span>
          </div>
          {customer.company_name && customer.company_name !== customer.name && (
            <p className="bk-subtitle">{customer.company_name}</p>
          )}
        </div>
        <div className="bk-detail-header__actions">
          <button
            type="button"
            className="bk-btn bk-btn--quiet"
            disabled={updating}
            onClick={handleStatusToggle}
          >{updating ? "Updating…" : isActive ? "Mark inactive" : "Mark active"}</button>
          <button
            type="button"
            className="bk-btn bk-btn--secondary"
            onClick={() => navigate(`/customers/${id}/risk`)}
          >Payment risk profile</button>
          <button type="button" className="bk-btn bk-btn--primary" onClick={openEdit}>Edit customer</button>
        </div>
      </div>

      {/* Key figure first: what this customer is worth, from their own quotes. */}
      {totalQuotes > 0 ? (
        <section className="bk-summary" aria-label="Customer value">
          <div className="bk-summary__cell">
            <div className="bk-summary__label">Won from accepted quotes</div>
            <div className="bk-summary__value">{formatZAR(totalRevenue)}</div>
            <div className="bk-summary__note">Quote totals, from {basis}.</div>
          </div>
          <div className="bk-summary__cell">
            <div className="bk-summary__label">Quotes accepted</div>
            <div className="bk-summary__value">{acceptedQuotes}<span className="bk-summary__of">of {totalQuotes}</span></div>
            <div className="bk-summary__note">{Math.round((acceptedQuotes / totalQuotes) * 100)}% of their quotes, drafts included, were accepted.</div>
          </div>
          <div className="bk-summary__cell">
            <div className="bk-summary__label">Credit limit</div>
            <div className="bk-summary__value">{customer.credit_limit ? formatZAR(parseFloat(customer.credit_limit)) : "—"}</div>
            <div className="bk-summary__note">{customer.credit_limit ? `${paymentTermsLabel(customer.payment_terms_default)} payment terms.` : "No limit set. Add one under Edit customer."}</div>
          </div>
        </section>
      ) : (
        <div className="bk-notice">
          <div>
            <p className="bk-notice__text">You have not quoted {customer.name} yet.</p>
            <p className="bk-notice__sub">Their value and win rate appear here once you send them a quote.</p>
          </div>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={() => navigate("/bookings/quotes/new")}>New quote</button>
        </div>
      )}

      <div className="bk-detail-grid">
        {/* Contact Details */}
        <section className="bk-card" aria-labelledby="cd-contact-title">
          <div className="bk-card__head"><h2 className="bk-card__title" id="cd-contact-title">Contact details</h2></div>
          {[
            { label: "Email", value: customer.email },
            { label: "Phone", value: customer.phone },
            { label: "City", value: customer.city },
            { label: "Province", value: customer.state },
            { label: "Postal code", value: customer.zip_code },
            { label: "Address", value: customer.address },
            { label: "Billing address", value: customer.billing_address || customer.address },
          ].map(r => (
            <div key={r.label} className="bk-kv">
              <span className="bk-kv__label">{r.label}</span>
              <span className="bk-kv__value">{r.value || "—"}</span>
            </div>
          ))}
        </section>

        {/* Account Details */}
        <section className="bk-card" aria-labelledby="cd-account-title">
          <div className="bk-card__head"><h2 className="bk-card__title" id="cd-account-title">Account details</h2></div>
          {[
            { label: "Payment terms", value: paymentTermsLabel(customer.payment_terms_default) },
            { label: "Credit limit", value: customer.credit_limit ? formatZAR(parseFloat(customer.credit_limit)) : "—" },
            { label: "Status", value: isActive ? "Active" : "Inactive" },
            { label: "Customer since", value: customer.created_at ? formatDate(customer.created_at) : "—" },
          ].map(r => (
            <div key={r.label} className="bk-kv">
              <span className="bk-kv__label">{r.label}</span>
              <span className="bk-kv__value">{r.value}</span>
            </div>
          ))}
        </section>
      </div>

      {/* Quotes table */}
      <section className="bk-card" style={{ marginTop: 24, padding: 0 }} aria-labelledby="cd-quotes-title">
        <div className="bk-card__head" style={{ padding: "24px 24px 0" }}>
          <h2 className="bk-card__title" id="cd-quotes-title">Quotes</h2>
          <span className="bk-toolbar__end">
            {totalQuotes > 15 ? `Showing 15 of ${totalQuotes}` : `${totalQuotes} ${totalQuotes === 1 ? "quote" : "quotes"}`}
          </span>
        </div>
        {quotes.length === 0 ? (
          <div className="bk-empty">
            <p className="bk-empty__text">No quotes yet for this customer.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table-heading-roles bk-table">
              <thead>
                <tr>
                  <th scope="col">Quote #</th>
                  <th scope="col">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotes.slice(0, 15).map((q: any) => (
                  <tr
                    key={q.id}
                    className="is-clickable"
                    onClick={() => navigate(`/bookings/quotes/${q.id}`)}
                  >
                    <td className="is-id">
                      {q.quote_number || `#${q.id}`}
                    </td>
                    <td className="is-truncate" title={`${q.pickup_location || "—"} → ${q.delivery_location || "—"}`}>
                      {q.pickup_location || "—"} → {q.delivery_location || "—"}
                    </td>
                    <td>
                      <span className={`bk-status bk-status--${QUOTE_STATUS_TONE[q.status] || "neutral"}`}>{formatStatus(q.status)}</span>
                    </td>
                    <td className="is-date">
                      {q.created_at ? formatDate(q.created_at) : "—"}
                    </td>
                    <td className="is-money">
                      {q.total_amount || q.quote_price ? formatZAR(parseFloat(q.total_amount || q.quote_price)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
