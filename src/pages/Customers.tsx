import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData, postData, patchData, deleteData } from "../lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Customer {
  id: number;
  name: string;
  company_name?: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  zip_code?: string;
  billing_address?: string;
  payment_terms_default?: string;
  credit_limit?: number | null;
  status?: string;
  is_active?: boolean;
  created_at?: string;
}

const PAYMENT_TERMS = [
  { value: "NET30", label: "Net 30 Days" },
  { value: "NET60", label: "Net 60 Days" },
  { value: "NET90", label: "Net 90 Days" },
];


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

const EMPTY_FORM = {
  name: "", company_name: "", email: "", phone: "",
  city: "", state: "", address: "", zip_code: "",
  billing_address: "", payment_terms_default: "NET30",
  credit_limit: "" as string | number, status: "ACTIVE",
};

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const didMountCustomers = useRef(false);
  const [sortBy, setSortBy] = useState("name_asc");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    document.title = "Customers - TruckWys";
  }, []);

  useEffect(() => {
    if (location.pathname === "/customers/new") {
      setShowAddForm(true);
    }
  }, [location.pathname]);

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["customers-page", debouncedSearch],
    queryFn: () => {
      const url = debouncedSearch
        ? `api/v1/customers/?search=${encodeURIComponent(debouncedSearch)}`
        : "api/v1/customers/";
      return fetchData(url);
    },
  });
  const customers: Customer[] = Array.isArray(data) ? data : data?.results || [];

  useAutoRefresh(refetch);

  useEffect(() => {
    if (!didMountCustomers.current) { didMountCustomers.current = true; return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const customerStatus = (c: Customer) =>
    c.is_active === false || c.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const filtered = [...customers].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return a.name.localeCompare(b.name);
        case "name_desc": return b.name.localeCompare(a.name);
        case "city":      return (a.city || "").localeCompare(b.city || "");
        case "newest":    return (b.created_at || "").localeCompare(a.created_at || "");
        case "oldest":    return (a.created_at || "").localeCompare(b.created_at || "");
        default:          return 0;
      }
    });

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setEditForm({
      name: c.name || "",
      company_name: c.company_name || "",
      email: c.email || "",
      phone: c.phone || "",
      city: c.city || "",
      state: c.state || "",
      address: c.address || "",
      zip_code: c.zip_code || "",
      billing_address: c.billing_address || "",
      payment_terms_default: c.payment_terms_default || "NET30",
      credit_limit: c.credit_limit ?? "",
      status: customerStatus(c),
    });
  }

  if (loading) return (
    <div style={{ padding: 40, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Loading…</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>Customers</div>
          <LiveBadge />
        </div>
        <button className="btn-action" onClick={() => setShowAddForm(true)}>+ Add customer</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Customers", value: customers.length, color: "var(--text-primary)" },
          { label: "With Credit Limit", value: customers.filter(c => c.credit_limit != null && Number(c.credit_limit) > 0).length, color: "var(--accent-primary)" },
          { label: "Cities Covered", value: new Set(customers.map(c => c.city).filter(Boolean)).size, color: "var(--text-primary)" },
          { label: "NET30 Clients", value: customers.filter(c => (c.payment_terms_default || "NET30") === "NET30").length, color: "var(--text-primary)" },
        ].map(k => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ fontSize: 28, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {/* Table toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 12px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
          <input
            type="text"
            placeholder="Search name, company, email, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...fieldStyle, width: 280 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sort</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="city">City A–Z</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Name", "Company", "Email", "Phone", "City", "Payment Terms", ""].map(h => (
                <th key={h} style={{
                  padding: "12px 20px 12px 32px", textAlign: "left",
                  fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "var(--text-tertiary)",
                  borderBottom: "1px solid var(--border-subtle)", fontWeight: 500, whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              customers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <div style={{ padding: "60px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏢</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No customers yet</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        Add your first customer to get started
                      </div>
                      <button onClick={() => setShowAddForm(true)} className="btn-action">Add customer</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 40, fontSize: 13 }}>
                    No customers match your filters
                  </td>
                </tr>
              )
            ) : filtered.map((c, idx) => {
              const status = customerStatus(c);
              const dotColor = status === "ACTIVE" ? "var(--status-success)" : "var(--text-tertiary)";
              return (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer", borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-row)" : "none" }}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 20px 12px 32px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      {c.name}
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px 12px 32px", fontSize: 13, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.company_name || ""}>
                    {c.company_name || "—"}
                  </td>
                  <td style={{ padding: "12px 20px 12px 32px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.email}>
                    {c.email}
                  </td>
                  <td style={{ padding: "12px 20px 12px 32px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {c.phone || "—"}
                  </td>
                  <td style={{ padding: "12px 20px 12px 32px", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {c.city || "—"}
                  </td>
                  <td style={{ padding: "12px 20px 12px 32px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {c.payment_terms_default || "NET30"}
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(c); }}
                        style={{ background: "none", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: 2, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em" }}
                      >Edit</button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmOpts({
                            title: "Delete Customer",
                            message: `Remove "${c.name}"? This cannot be undone.`,
                            confirmLabel: "Delete",
                            danger: true,
                            onConfirm: async () => {
                              try {
                                await deleteData({ url: `api/v1/customers/${c.id}/` });
                                toast.success("Customer deleted");
                                refetch();
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to delete");
                              }
                            },
                          });
                        }}
                        style={{ background: "none", border: "1px solid var(--status-danger)", color: "var(--status-danger)", padding: "4px 10px", borderRadius: 2, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em" }}
                      >Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Customer slide-out */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop)" }} onClick={() => { setShowAddForm(false); if (location.pathname === "/customers/new") navigate("/customers", { replace: true }); }} />
          <div style={{ position: "relative", width: 440, background: "var(--bg-deep)", borderLeft: "1px solid var(--border-subtle)", padding: 28, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Add Customer</div>
              <button onClick={() => setShowAddForm(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {[
              { key: "name", label: "Full Name", placeholder: "e.g. John Doe", required: true },
              { key: "company_name", label: "Company Name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email", required: true },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000", required: true },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg", required: true },
              { key: "state", label: "Province / State", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Zip Code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing Address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger)", marginLeft: 2 }}>*</span>}</label>
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Payment Terms</label>
              <Select value={addForm.payment_terms_default} onValueChange={val => setAddForm(prev => ({ ...prev, payment_terms_default: val }))}>
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
              <input
                type="number"
                placeholder="e.g. 50000"
                value={addForm.credit_limit}
                onChange={e => setAddForm(prev => ({ ...prev, credit_limit: e.target.value }))}
                style={fieldStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={async () => {
                  if (!addForm.name.trim() || !addForm.email.trim()) {
                    toast.warning("Name and email are required");
                    return;
                  }
                  setSaving(true);
                  try {
                    const payload: any = { ...addForm };
                    if (payload.credit_limit === "") delete payload.credit_limit;
                    else if (payload.credit_limit) payload.credit_limit = parseFloat(String(payload.credit_limit));
                    await postData({ url: "api/v1/customers/", data: payload });
                    refetch();
                    setShowAddForm(false);
                    setAddForm({ ...EMPTY_FORM });
                    toast.success("Customer created");
                  } catch (e: any) {
                    toast.error(e?.message || "Failed to create customer");
                  }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", background: "var(--accent-primary)", color: "var(--bg-deep)", border: "none", borderRadius: 2, cursor: saving ? "wait" : "pointer", fontWeight: 600 }}
              >
                {saving ? "Saving…" : "Create customer"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 2, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer slide-out */}
      {editCustomer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop)" }} onClick={() => setEditCustomer(null)} />
          <div style={{ position: "relative", width: 440, background: "var(--bg-deep)", borderLeft: "1px solid var(--border-subtle)", padding: 28, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Edit Customer</div>
              <button onClick={() => setEditCustomer(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {[
              { key: "name", label: "Full Name", placeholder: "e.g. John Doe", required: true },
              { key: "company_name", label: "Company Name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email", required: true },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000", required: true },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg", required: true },
              { key: "state", label: "Province / State", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Zip Code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing Address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger)", marginLeft: 2 }}>*</span>}</label>
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ""}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Payment Terms</label>
              <Select value={editForm.payment_terms_default ?? "NET30"} onValueChange={val => setEditForm((prev: any) => ({ ...prev, payment_terms_default: val }))}>
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
              <input
                type="number"
                placeholder="e.g. 50000"
                value={editForm.credit_limit ?? ""}
                onChange={e => setEditForm((prev: any) => ({ ...prev, credit_limit: e.target.value }))}
                style={fieldStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Status</label>
              <Select value={editForm.status ?? "ACTIVE"} onValueChange={val => setEditForm((prev: any) => ({ ...prev, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const payload: any = { ...editForm };
                    if (payload.credit_limit === "") payload.credit_limit = null;
                    else if (payload.credit_limit) payload.credit_limit = parseFloat(String(payload.credit_limit));
                    payload.is_active = payload.status !== "INACTIVE";
                    await patchData({ url: `api/v1/customers/${editCustomer.id}/`, data: payload });
                    refetch();
                    setEditCustomer(null);
                    toast.success("Customer updated");
                  } catch (e: any) {
                    toast.error(e?.message || "Failed to update customer");
                  }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", background: "var(--accent-primary)", color: "var(--bg-deep)", border: "none", borderRadius: 2, cursor: saving ? "wait" : "pointer", fontWeight: 600 }}
              >
                {saving ? "Saving…" : "Update customer"}
              </button>
              <button
                onClick={() => setEditCustomer(null)}
                style={{ padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 2, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpts && (
        <ConfirmModal
          title={confirmOpts.title}
          message={confirmOpts.message}
          confirmLabel={confirmOpts.confirmLabel || "Confirm"}
          danger={confirmOpts.danger}
          onConfirm={confirmOpts.onConfirm}
          onCancel={() => setConfirmOpts(null)}
        />
      )}
    </div>
  );
}
