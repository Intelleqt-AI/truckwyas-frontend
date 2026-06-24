import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, patchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatZAR = (v: number) =>
  "R " + (v || 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  NET30: "Net 30 Days",
  NET60: "Net 60 Days",
  NET90: "Net 90 Days",
};

const QUOTE_STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--status-warning)",
  ACCEPTED: "var(--status-success)",
  REJECTED: "var(--status-danger)",
  EXPIRED: "var(--text-tertiary)",
  DRAFT: "var(--text-tertiary)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  borderRadius: 2,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const PAYMENT_TERMS = [
  { value: "NET30", label: "Net 30 Days" },
  { value: "NET60", label: "Net 60 Days" },
  { value: "NET90", label: "Net 90 Days" },
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

  if (isLoading) return (
    <div style={{ padding: 40, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>LOADING...</div>
  );

  if (!customer) return (
    <div style={{ padding: 40 }}>
      <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Customer not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate("/customers")}>← BACK</button>
    </div>
  );

  const quotes = Array.isArray(quotesData) ? quotesData : (quotesData?.results || []);
  const totalQuotes = quotes.length;
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
    <div>
      {/* Back + Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate("/customers")}
          style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 8, padding: 0 }}
        >← BACK TO CUSTOMERS</button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>CUSTOMER</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>{customer.name}</div>
            {customer.company_name && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{customer.company_name}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={openEdit}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "transparent", padding: "6px 12px", border: "1px solid var(--border-subtle)", borderRadius: 2, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >EDIT</button>
            <button
              disabled={updating}
              onClick={handleStatusToggle}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: isActive ? "var(--bg-deep)" : "var(--text-tertiary)",
                background: isActive ? "var(--status-success)" : "transparent",
                padding: "6px 12px",
                border: `1px solid ${isActive ? "var(--status-success)" : "var(--text-tertiary)"}`,
                borderRadius: 2,
                cursor: updating ? "default" : "pointer",
                opacity: updating ? 0.5 : 1,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                transition: "all 0.15s ease",
              }}
            >{isActive ? "ACTIVE" : "INACTIVE"}</button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Quotes</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{totalQuotes}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Accepted Quotes</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>{acceptedQuotes}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Revenue</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>{formatZAR(totalRevenue)}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Credit Limit</span></div>
          <div className="metric-value" style={{ fontSize: 20, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
            {customer.credit_limit ? formatZAR(parseFloat(customer.credit_limit)) : "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Contact Details */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>CONTACT DETAILS</div>
          {[
            { label: "EMAIL", value: customer.email },
            { label: "PHONE", value: customer.phone },
            { label: "CITY", value: customer.city },
            { label: "PROVINCE", value: customer.state },
            { label: "ZIP CODE", value: customer.zip_code },
            { label: "ADDRESS", value: customer.address },
            { label: "BILLING ADDRESS", value: customer.billing_address || customer.address },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-row)" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 260, textAlign: "right" }}>{r.value || "—"}</span>
            </div>
          ))}
        </div>

        {/* Account Details */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>ACCOUNT DETAILS</div>
          {[
            { label: "PAYMENT TERMS", value: PAYMENT_TERMS_LABEL[customer.payment_terms_default] || customer.payment_terms_default || "NET30", mono: true },
            { label: "CREDIT LIMIT", value: customer.credit_limit ? formatZAR(parseFloat(customer.credit_limit)) : "—", mono: true },
            { label: "STATUS", value: isActive ? "ACTIVE" : "INACTIVE", mono: true },
            { label: "MEMBER SINCE", value: customer.created_at?.slice(0, 10) || "—", mono: true },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-row)" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: r.mono ? "var(--font-mono)" : undefined }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quotes table */}
      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>QUOTES ({totalQuotes})</div>
        {quotes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-tertiary)", fontSize: 13 }}>No quotes yet for this customer</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Quote #", "Route", "Amount", "Status", "Date"].map(h => (
                  <th key={h} style={{
                    padding: "8px 16px", textAlign: "left",
                    fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: "var(--text-tertiary)",
                    borderBottom: "1px solid var(--border-subtle)", fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 15).map((q: any, idx: number) => (
                <tr
                  key={q.id}
                  style={{ cursor: "pointer", borderBottom: idx < Math.min(quotes.length, 15) - 1 ? "1px solid var(--border-row)" : "none" }}
                  onClick={() => navigate(`/bookings/quotes/${q.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>
                    {q.quote_number || `#${q.id}`}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                    {q.pickup_location || "—"} → {q.delivery_location || "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-primary)" }}>
                    {q.total_amount || q.quote_price ? formatZAR(parseFloat(q.total_amount || q.quote_price)) : "—"}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                      color: QUOTE_STATUS_COLOR[q.status] || "var(--text-tertiary)",
                    }}>{q.status?.replace("_", " ") || "—"}</span>
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>
                    {q.created_at?.slice(0, 10) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit slide-out */}
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop)" }} onClick={() => setShowEdit(false)} />
          <div style={{ position: "relative", width: 440, background: "var(--bg-deep)", borderLeft: "1px solid var(--border-subtle)", padding: 28, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Edit Customer</div>
              <button onClick={() => setShowEdit(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {[
              { key: "name", label: "Full Name", placeholder: "e.g. John Doe" },
              { key: "company_name", label: "Company Name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email" },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000" },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg" },
              { key: "state", label: "Province / State", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Zip Code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing Address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ""}
                  onChange={e => setEditForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Payment Terms</label>
              <Select value={editForm.payment_terms_default ?? "NET30"} onValueChange={val => setEditForm((p: any) => ({ ...p, payment_terms_default: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Credit Limit (R)</label>
              <input type="number" placeholder="e.g. 50000" value={editForm.credit_limit ?? ""} onChange={e => setEditForm((p: any) => ({ ...p, credit_limit: e.target.value }))} style={fieldStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Status</label>
              <Select value={editForm.status ?? "ACTIVE"} onValueChange={val => setEditForm((p: any) => ({ ...p, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={handleSave}
                style={{ flex: 1, padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", background: "var(--accent-primary)", color: "var(--bg-deep)", border: "none", borderRadius: 2, cursor: saving ? "wait" : "pointer", fontWeight: 600 }}
              >
                {saving ? "SAVING..." : "UPDATE CUSTOMER"}
              </button>
              <button
                onClick={() => setShowEdit(false)}
                style={{ padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 2, cursor: "pointer" }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
