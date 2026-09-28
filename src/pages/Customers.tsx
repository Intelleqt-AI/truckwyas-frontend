import './customers-typography.css';
import './table-heading-roles.css';
import './bookings-section.css';
import './quote-invoice-roles.css';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, Plus, X } from "lucide-react";
import SectionHeader from "@/components/layout/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import { PasteImportDrawer } from "@/components/import/PasteImportDrawer";
import { BulkDeleteBar, RowCheckbox, secondaryButtonStyle } from "@/components/BulkDeleteBar";
import { fetchData, postData, patchData, deleteData } from "../lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/lib/AuthContext';
import RowActions from '@/components/ui/RowActions';

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
  { value: "NET30", label: "Net 30 days" },
  { value: "NET60", label: "Net 60 days" },
  { value: "NET90", label: "Net 90 days" },
];


const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "10px 12px",
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
  letterSpacing: "normal",
  marginBottom: 6,
  textTransform: "none",
};

const PAYMENT_TERMS_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_TERMS.map(t => [t.value, t.label]));
// "NET45" → "Net 45 days" for terms outside the fixed list.
const paymentTermsLabel = (v?: string) =>
  !v ? "Net 30 days" : PAYMENT_TERMS_LABEL[v] || (/^NET(\d+)$/.test(v) ? `Net ${v.slice(3)} days` : v);

const EMPTY_FORM = {
  name: "", company_name: "", email: "", phone: "",
  city: "", state: "", address: "", zip_code: "",
  billing_address: "", payment_terms_default: "NET30",
  credit_limit: "" as string | number, status: "ACTIVE",
};

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const didMountCustomers = useRef(false);
  const [sortBy, setSortBy] = useState("name_asc");

  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleOne = (id: number, on: boolean) =>
    setSelected(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
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
  // The endpoint is paginated; count is the true total, results only the first page.
  const totalCustomers: number = Array.isArray(data) ? customers.length : (data?.count ?? customers.length);

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

  const header = (
    <SectionHeader
      title="Customers"
      description="Who you quote and invoice"
      actions={
        <>
          <button
            type="button"
            className="bk-btn bk-btn--secondary"
            onClick={() => setShowImport(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : 'Paste a list from Excel'}
          >Import from Excel</button>
          <button
            type="button"
            className="bk-btn bk-btn--primary"
            onClick={() => setShowAddForm(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : undefined}
          ><Plus size={16} aria-hidden="true" /> Add customer</button>
        </>
      }
    />
  );

  if (loading) return <div className="customers-typography">{header}<Loader fullScreen /></div>;

  return (
    <div className="customers-typography bookings-typography">
      {header}

      {/* Table. No summary tiles: nothing on this directory drives a decision
          except finding the customer, so the count sits in the toolbar. */}
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-card, 12px)" }}>
        {/* Sits above the toolbar so it never covers the rows being chosen. */}
        <div style={{ padding: selected.length ? "12px 16px 0" : 0 }}>
          <BulkDeleteBar
            entity="customers"
            selected={selected}
            onClear={() => setSelected([])}
            onDeleted={() => { setSelected([]); refetch(); }}
          />
        </div>

        {/* Table toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <input
            type="search"
            className="bk-search"
            aria-label="Search customers"
            placeholder="Search name, company, email, city"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
            <span className="bk-toolbar__end" style={{ marginRight: 8 }}>
              {customers.length < totalCustomers
                ? `Showing ${customers.length} of ${totalCustomers} customers`
                : `${totalCustomers} ${totalCustomers === 1 ? "customer" : "customers"}`}
            </span>
            <span id="customers-sort-label" style={{ fontSize: 13, lineHeight: "20px", fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text-secondary)", letterSpacing: 0 }}>Sort</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-labelledby="customers-sort-label" style={{ minWidth: 160, minHeight: 40 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="city">City A–Z</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table className="table-heading-roles bk-table bk-table--pin-actions">
          <thead>
            <tr>
              <th scope="col" style={{ paddingRight: 0, width: 32 }}>
                {filtered.length > 0 && (
                  <RowCheckbox
                    title="Select everything shown"
                    checked={selected.length > 0 && filtered.every((c: any) => selected.includes(c.id))}
                    onChange={on => setSelected(on ? filtered.map((c: any) => c.id) : [])}
                  />
                )}
              </th>
              {["Name", "Company", "Email", "Phone", "City", "Payment terms", "Status"].map(h => (
                <th key={h} scope="col">{h}</th>
              ))}
              <th scope="col" className="is-num"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              customers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 0, whiteSpace: "normal" }}>
                    <div className="bk-empty" style={{ padding: "48px 24px" }}>
                      <div className="bk-empty__icon"><Building2 size={32} strokeWidth={1.5} aria-hidden="true" /></div>
                      <h2 className="bk-empty__title">No customers yet</h2>
                      <div className="bk-empty__text">
                        Already have them in a spreadsheet? Paste the list straight in.
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={() => setShowImport(true)}
                          className="bk-btn bk-btn--primary"
                          disabled={isDemo}
                          title={isDemo ? 'Fixed in demo mode' : undefined}
                        >Paste from Excel</button>
                        <button
                          type="button"
                          className="bk-btn bk-btn--secondary"
                          onClick={() => setShowAddForm(true)}
                          disabled={isDemo}
                          title={isDemo ? 'Fixed in demo mode' : undefined}
                        >Add one at a time</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40, fontSize: 13 }}>
                    No customers match your search.
                  </td>
                </tr>
              )
            ) : filtered.map((c, idx) => {
              const status = customerStatus(c);
              return (
                <tr
                  key={c.id}
                  className="is-clickable"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <td style={{ paddingRight: 0, width: 32 }}>
                    <RowCheckbox
                      checked={selected.includes(c.id)}
                      onChange={on => toggleOne(c.id, on)}
                    />
                  </td>
                  <td className="is-primary is-truncate" style={{ fontWeight: 500, maxWidth: 220 }} title={c.name}>
                    {c.name}
                  </td>
                  <td className="is-truncate" style={{ maxWidth: 200 }} title={c.company_name || ""}>
                    {c.company_name || "—"}
                  </td>
                  <td className="is-truncate" style={{ maxWidth: 220 }} title={c.email}>
                    {c.email}
                  </td>
                  <td>
                    {c.phone || "—"}
                  </td>
                  <td>
                    {c.city || "—"}
                  </td>
                  <td>
                    {paymentTermsLabel(c.payment_terms_default)}
                  </td>
                  <td>
                    <span className={`bk-status bk-status--${status === "ACTIVE" ? "success" : "neutral"}`}>{status === "ACTIVE" ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="is-num">
                    <RowActions
                      label={c.name}
                      items={[
                        { label: "Edit", onSelect: () => openEdit(c), disabled: isDemo },
                        {
                          label: "Delete",
                          danger: true,
                          disabled: isDemo,
                          onSelect: () => setConfirmOpts({
                            title: "Delete customer",
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
                          }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <PasteImportDrawer
        entity="customers"
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => refetch()}
      />

      {/* Add customer slide-out */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop, rgba(0,0,0,0.65))" }} onClick={() => { setShowAddForm(false); if (location.pathname === "/customers/new") navigate("/customers", { replace: true }); }} />
          <div role="dialog" aria-modal="true" style={{ position: "relative", width: 440, maxWidth: "100%", background: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", padding: 24, overflowY: "auto", fontFamily: "var(--font-sans)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 className="bk-dialog__title" style={{ margin: 0 }}>Add customer</h2>
              <button type="button" className="bk-icon-btn" aria-label="Close" onClick={() => setShowAddForm(false)}><X size={20} aria-hidden="true" /></button>
            </div>

            {[
              { key: "name", label: "Full name", placeholder: "e.g. John Doe", required: true },
              { key: "company_name", label: "Company name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email", required: true },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000", required: true },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg", required: true },
              { key: "state", label: "Province", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Postal code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger-text, var(--status-danger))", marginLeft: 2 }}>*</span>}</label>
                <input
                  className="qi-input"
                  aria-label={f.label}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Payment terms</label>
              <Select value={addForm.payment_terms_default} onValueChange={val => setAddForm(prev => ({ ...prev, payment_terms_default: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...PAYMENT_TERMS, ...(addForm.payment_terms_default && !PAYMENT_TERMS.some(t => t.value === addForm.payment_terms_default)
                    ? [{ value: addForm.payment_terms_default, label: paymentTermsLabel(addForm.payment_terms_default) }] : [])]
                    .map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Credit limit (R)</label>
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
                type="button"
                className="bk-btn bk-btn--primary"
                style={{ flex: 1 }}
              >
                {saving ? "Saving…" : "Create customer"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                type="button"
                className="bk-btn bk-btn--secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit customer slide-out */}
      {editCustomer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--modal-backdrop, rgba(0,0,0,0.65))" }} onClick={() => setEditCustomer(null)} />
          <div role="dialog" aria-modal="true" style={{ position: "relative", width: 440, maxWidth: "100%", background: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", padding: 24, overflowY: "auto", fontFamily: "var(--font-sans)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 className="bk-dialog__title" style={{ margin: 0 }}>Edit customer</h2>
              <button type="button" className="bk-icon-btn" aria-label="Close" onClick={() => setEditCustomer(null)}><X size={20} aria-hidden="true" /></button>
            </div>

            {[
              { key: "name", label: "Full name", placeholder: "e.g. John Doe", required: true },
              { key: "company_name", label: "Company name", placeholder: "e.g. Acme Logistics" },
              { key: "email", label: "Email", placeholder: "e.g. john@company.com", type: "email", required: true },
              { key: "phone", label: "Phone", placeholder: "e.g. +27 11 000 0000", required: true },
              { key: "city", label: "City", placeholder: "e.g. Johannesburg", required: true },
              { key: "state", label: "Province", placeholder: "e.g. Gauteng" },
              { key: "zip_code", label: "Postal code", placeholder: "e.g. 2000" },
              { key: "address", label: "Address", placeholder: "Street address" },
              { key: "billing_address", label: "Billing address", placeholder: "Leave blank if same as address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger-text, var(--status-danger))", marginLeft: 2 }}>*</span>}</label>
                <input
                  className="qi-input"
                  aria-label={f.label}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ""}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Payment terms</label>
              <Select value={editForm.payment_terms_default ?? "NET30"} onValueChange={val => setEditForm((prev: any) => ({ ...prev, payment_terms_default: val }))}>
                <SelectTrigger>
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
              <label style={labelStyle}>Credit limit (R)</label>
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
                type="button"
                className="bk-btn bk-btn--primary"
                style={{ flex: 1 }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => setEditCustomer(null)}
                type="button"
                className="bk-btn bk-btn--secondary"
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
