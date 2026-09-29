import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import './customers-typography.css';
import './table-heading-roles.css';
import './bookings-section.css';
import './quote-invoice-roles.css';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, Plus, X } from "lucide-react";
import SectionHeader from "@/components/layout/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import LoadError, { loadFailed } from "@/components/data/LoadError";
import { rowLink } from "@/lib/rowLink";
import { PasteImportDrawer } from "@/components/import/PasteImportDrawer";
import { BulkDeleteBar, RowCheckbox, secondaryButtonStyle } from "@/components/BulkDeleteBar";
import { postData, patchData, deleteData } from "../lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import { fetchAllPages } from '@/components/insights/findings';
import { useLedger, isOpen, num, todayISO } from '@/components/reports/data';
import { InfoTip } from '@/components/ui/InfoTip';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/lib/AuthContext';
import RowActions from '@/components/ui/RowActions';
import { StatusChip } from '@/components/ui/StatusChip';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

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
  // Slide-outs: focus moves in, Tab stays inside, focus returns on close.
  useFocusTrap(latestModal, showAddForm);
  useFocusTrap(latestModal, !!editCustomer);
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

  const customersQuery = useQuery({
    queryKey: ["customers-page", debouncedSearch],
    queryFn: () => {
      const url = debouncedSearch
        ? `api/v1/customers/?search=${encodeURIComponent(debouncedSearch)}`
        : "api/v1/customers/";
      // Same list endpoint, every page followed, so the directory is complete.
      return fetchAllPages<Customer>(url);
    },
  });
  const { data, refetch } = customersQuery;
  // Failed (or failing and retrying) with nothing to show: say so, never "No customers yet".
  const failed = loadFailed(customersQuery);
  const loading = customersQuery.isLoading && !failed;
  const customers: Customer[] = data?.rows ?? [];
  // The endpoint is paginated; count is the true total (every page is followed).
  const totalCustomers: number = data?.count ?? customers.length;

  // Money owed per customer, from the same invoice ledger as Invoices and the
  // Debtors report: issued, not paid, balance above zero (incl. VAT). Overdue
  // is the part of that past its due date.
  const ledger = useLedger(['invoices']);
  const today = todayISO();
  const owedBy = new Map<number, { owed: number; overdue: number }>();
  for (const inv of ledger.data?.invoices ?? []) {
    if (inv.customer == null || !isOpen(inv)) continue;
    const row = owedBy.get(inv.customer) ?? { owed: 0, overdue: 0 };
    row.owed += num(inv.balance);
    if (inv.due_date && inv.due_date.slice(0, 10) < today) row.overdue += num(inv.balance);
    owedBy.set(inv.customer, row);
  }
  // Some balance is partly late: every row then takes the two-line height.
  const anyPartlyLate = [...owedBy.values()].some(r => r.overdue >= 0.005 && Math.abs(r.overdue - r.owed) >= 0.005);
  // One money column: Owed. When all of it is late the figure itself turns the
  // danger text colour (no extra line); only a partly late balance gets a
  // second line with the overdue part, because only then does it differ.
  const owedCell = (row: { owed: number; overdue: number } | undefined) => {
    if (!ledger.data) return <span className="bk-muted">{ledger.error ? 'Not loaded' : '…'}</span>;
    const owed = row?.owed ?? 0;
    const overdue = row?.overdue ?? 0;
    if (owed < 0.005) return <span className="bk-muted">—</span>;
    if (overdue >= 0.005 && Math.abs(overdue - owed) < 0.005) {
      return <span className="cu-owed__late" title="All overdue">{formatCurrency(owed)}<span className="sr-only">, all overdue</span></span>;
    }
    return (
      <>
        {formatCurrency(owed)}
        {overdue >= 0.005 && <span className="cu-owed__sub">{formatCurrency(overdue)} overdue</span>}
      </>
    );
  };

  // Customer is the company; the contact name is shown only when it differs.
  const displayName = (c: Customer) => (c.company_name || '').trim() || c.name;
  const contactName = (c: Customer) => {
    const n = (c.name || '').trim();
    return n && n.toLowerCase() !== displayName(c).toLowerCase() ? n : '';
  };

  useAutoRefresh(refetch);

  useEffect(() => {
    if (!didMountCustomers.current) { didMountCustomers.current = true; return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const customerStatus = (c: Customer) =>
    c.is_active === false || c.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  // Status earns a column only when some customer is inactive.
  const anyInactive = customers.some(c => customerStatus(c) !== 'ACTIVE');

  const filtered = [...customers].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return displayName(a).localeCompare(displayName(b));
        case "name_desc": return displayName(b).localeCompare(displayName(a));
        case "owed":      return (owedBy.get(b.id)?.owed ?? 0) - (owedBy.get(a.id)?.owed ?? 0);
        case "overdue":   return (owedBy.get(b.id)?.overdue ?? 0) - (owedBy.get(a.id)?.overdue ?? 0);
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

  if (failed) {
    return (
      <div className="customers-typography">
        {header}
        <LoadError
          what="customers"
          error={customersQuery.error ?? customersQuery.failureReason}
          busy={customersQuery.isFetching}
          onRetry={() => refetch()}
        />
      </div>
    );
  }
  // The toolbar row is reserved while loading so the table does not jump.
  if (loading) return <div className="customers-typography">{header}<div className="tw-toolbar" aria-hidden="true" /><TableSkeleton rows={8} cols={6} label="Loading customers" /></div>;

  return (
    <div className="customers-typography bookings-typography">
      {header}

      {/* Table. No summary tiles: nothing on this directory drives a decision
          except finding the customer, so the count sits in the toolbar. */}
      {/* Toolbar sits above the card, as on every other list. */}
      <Toolbar
        className="cu-toolbar"
        meta={data && !data.complete
          ? `First ${customers.length} of ${totalCustomers} customers`
          : `${totalCustomers} ${totalCustomers === 1 ? "customer" : "customers"}`}
        end={
          <>
            <span id="customers-sort-label" className="cu-sort-label">Sort</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-labelledby="customers-sort-label" style={{ width: 'auto', minWidth: 168 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="owed">Most owed</SelectItem>
                <SelectItem value="overdue">Most overdue</SelectItem>
                <SelectItem value="city">City A–Z</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      >
        <SearchInput
          aria-label="Search customers"
          placeholder="Search name, company, email, city"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </Toolbar>

      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-card, 12px)" }}>
        {/* Sits above the table so it never covers the rows being chosen. */}
        <div style={{ padding: selected.length ? "12px 16px 0" : 0 }}>
          <BulkDeleteBar
            entity="customers"
            selected={selected}
            onClear={() => setSelected([])}
            onDeleted={() => { setSelected([]); refetch(); }}
          />
        </div>
        <div className="bk-table-wrap bk-table-wrap--bare">
        <table className={`table-heading-roles bk-table bk-table--pin-actions${anyPartlyLate ? ' cu-two-line' : ''}`}>
          <thead>
            <tr>
              <th scope="col" className="bk-col-select" style={{ paddingRight: 0, width: 32 }}>
                {filtered.length > 0 && (
                  <RowCheckbox
                    title="Select everything shown"
                    checked={selected.length > 0 && filtered.every((c: any) => selected.includes(c.id))}
                    onChange={on => setSelected(on ? filtered.map((c: any) => c.id) : [])}
                  />
                )}
              </th>
              <th scope="col">Customer</th>
              <th scope="col" className="bk-col-opt">Email</th>
              <th scope="col" className="bk-col-city">City</th>
              <th scope="col" className="bk-col-terms bk-col-narrow">Terms</th>
              <th scope="col" className="is-num bk-col-money"><span className="cu-owed__head">Owed<InfoTip align="end">Unpaid invoice balances, incl. VAT. Red means all of it is past its due date; a second line shows the overdue part when only some is late.</InfoTip></span></th>
              {anyInactive && <th scope="col">Status</th>}
              <th scope="col" className="is-num"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              customers.length === 0 ? (
                <tr>
                  <td colSpan={anyInactive ? 8 : 7} style={{ padding: 0, whiteSpace: "normal" }}>
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
                  <td colSpan={anyInactive ? 8 : 7} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40, fontSize: 13 }}>
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
                  {...rowLink(() => navigate(`/customers/${c.id}`))}
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <td className="bk-col-select" style={{ paddingRight: 0, width: 32 }}>
                    <RowCheckbox
                      checked={selected.includes(c.id)}
                      onChange={on => toggleOne(c.id, on)}
                    />
                  </td>
                  <td className="is-primary is-truncate bk-col-customer" style={{ fontWeight: 500 }} title={[displayName(c), contactName(c)].filter(Boolean).join(', contact ')}>
                    {displayName(c)}
                    {contactName(c) && <span className="bk-muted" style={{ fontWeight: 400 }}> · {contactName(c)}</span>}
                  </td>
                  <td className="is-truncate bk-col-opt" title={c.email}>
                    {c.email || <span className="bk-muted">—</span>}
                  </td>
                  <td className="is-truncate bk-col-city">
                    {c.city || <span className="bk-muted">—</span>}
                  </td>
                  <td className="bk-col-terms bk-col-narrow">
                    {paymentTermsLabel(c.payment_terms_default).replace(/ days$/, '')}
                  </td>
                  <td className="is-money bk-col-money cu-owed">{owedCell(owedBy.get(c.id))}</td>
                  {anyInactive && (
                    <td>
                      <StatusChip status={status === "ACTIVE" ? "ACTIVE" : "INACTIVE"} size="sm" />
                    </td>
                  )}
                  <td className="is-num">
                    <RowActions
                      label={c.name}
                      items={[
                        { label: "Edit", onSelect: () => openEdit(c), disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined },
                        {
                          label: "Delete",
                          danger: true,
                          disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined,
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
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger-text)", marginLeft: 2 }}>*</span>}</label>
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
                <label style={labelStyle}>{f.label}{(f as any).required && <span style={{ color: "var(--status-danger-text)", marginLeft: 2 }}>*</span>}</label>
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
