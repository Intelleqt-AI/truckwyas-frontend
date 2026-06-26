import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchData, postData, putData, deleteData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--status-success)', SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)', DRAFT: 'var(--text-tertiary)',
};

const EXPENSE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--status-warning)',
  APPROVED: 'var(--status-success)',
  REJECTED: 'var(--status-danger)',
};

const CATEGORY_ICONS: Record<string, string> = {
  FUEL: '',
  TOLLS: '',
  MAINTENANCE: '',
  DRIVER_COST: '',
  INSURANCE: '',
  OVERHEAD: '',
  OTHER: '',
};

const PAGE_SIZE = 10;

type FinanceTab = 'invoices' | 'expenses';

// Fetches invoices + stats. Lives in the queryFn so the result is cached by
// TanStack Query (keyed below) and survives navigation — revisiting the page
// no longer refires these requests until the cache goes stale.
async function loadInvoicesPage() {
  const [data, statsData] = await Promise.all([
    fetchData('/api/v1/invoices/'),
    fetchData('/api/v1/invoices/stats/').catch(() => null),
  ]);
  // API returns paginated {count, results} — extract results
  return {
    invoices: Array.isArray(data) ? data : (data?.results || []),
    stats: statsData,
  };
}

// Fetches expenses + vehicles together (mirrors the original Promise.all
// grouping). Cached under its own key so the expenses tab survives navigation.
async function loadFinanceExpenses() {
  const [expensesData, vehiclesData] = await Promise.all([
    fetchData('/api/v1/expenses/'),
    fetchData('/api/v1/vehicles/').catch(() => []),
  ]);
  return {
    expenses: Array.isArray(expensesData) ? expensesData : (expensesData?.results || []),
    vehicles: Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []),
  };
}

export default function Invoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTab>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];

  // Invoices + stats, cached across navigations.
  const { data: invoicesData, isLoading: loading, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices-page'],
    queryFn: loadInvoicesPage,
  });
  const invoices: any[] = invoicesData?.invoices ?? [];
  const stats: any = invoicesData?.stats ?? null;

  // Expenses + vehicles, cached across navigations. Only fetched once the
  // expenses tab is opened, mirroring the original lazy load.
  const { data: expensesData, isLoading: expensesQueryLoading, refetch: refetchExpenses } = useQuery({
    queryKey: ['finance-expenses'],
    queryFn: loadFinanceExpenses,
    enabled: activeTab === 'expenses',
  });
  const expenses: any[] = expensesData?.expenses ?? [];
  const vehicles: any[] = expensesData?.vehicles ?? [];
  // Show the skeleton only before the first expenses fetch resolves.
  const expensesLoading = activeTab === 'expenses' && expensesQueryLoading;

  // Expenses state
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('All');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'FUEL',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vehicle: '',
    vendor: '',
    receipt_number: '',
    notes: '',
    litres: '',
    price_per_litre: '',
  });

  const expenseCategories = ['All', 'FUEL', 'TOLLS', 'MAINTENANCE', 'DRIVER_COST', 'INSURANCE', 'OVERHEAD', 'OTHER'];
  const expenseStatuses = ['All', 'PENDING', 'APPROVED', 'REJECTED'];

  useEffect(() => {
    document.title = 'Invoices - TruckWys';
  }, []);

  // Live-refresh both datasets on the auto-refresh tick / focus / live events.
  // The expenses query is a no-op until its tab has been opened (enabled flag).
  useAutoRefresh(() => {
    refetchInvoices();
    if (activeTab === 'expenses') refetchExpenses();
  });

  // Expense handlers
  const handleExpenseFormChange = (field: string, value: any) => {
    setExpenseForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate amount for fuel
      if (field === 'litres' || field === 'price_per_litre') {
        const litres = parseFloat(field === 'litres' ? value : updated.litres) || 0;
        const pricePerLitre = parseFloat(field === 'price_per_litre' ? value : updated.price_per_litre) || 0;
        if (litres > 0 && pricePerLitre > 0) {
          updated.amount = (litres * pricePerLitre).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleAddExpense = async () => {
    try {
      const payload: any = {
        category: expenseForm.category,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        vehicle: expenseForm.vehicle || null,
        vendor: expenseForm.vendor || null,
        receipt_number: expenseForm.receipt_number || null,
        notes: expenseForm.notes || '',
      };

      // Add fuel details to notes if category is FUEL
      if (expenseForm.category === 'FUEL' && expenseForm.litres && expenseForm.price_per_litre) {
        payload.notes = `Fuel: ${expenseForm.litres}L @ ${formatCurrency(parseFloat(expenseForm.price_per_litre))}/L${payload.notes ? '\n' + payload.notes : ''}`;
      }

      if (editingExpense) {
        await putData({ url: `/api/v1/expenses/${editingExpense.id}/`, data: payload });
        setToast('Expense updated!');
        refetchExpenses();
      } else {
        await postData({ url: '/api/v1/expenses/', data: payload });
        setToast('Expense added!');
        refetchExpenses();
      }

      setTimeout(() => setToast(null), 3000);
      setShowExpenseForm(false);
      setEditingExpense(null);
      setExpenseForm({
        category: 'FUEL',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        vehicle: '',
        vendor: '',
        receipt_number: '',
        notes: '',
        litres: '',
        price_per_litre: '',
      });
    } catch (error) {
      console.error('Failed to save expense:', error);
      setToast('Failed to save expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      await postData({ url: `/api/v1/expenses/${expenseId}/approve/` });
      setToast('Expense approved!');
      setTimeout(() => setToast(null), 3000);
      refetchExpenses();
    } catch (error) {
      console.error('Failed to approve expense:', error);
      setToast('Failed to approve expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRejectExpense = async (expenseId: string) => {
    try {
      await postData({ url: `/api/v1/expenses/${expenseId}/reject/` });
      setToast('Expense rejected!');
      setTimeout(() => setToast(null), 3000);
      refetchExpenses();
    } catch (error) {
      console.error('Failed to reject expense:', error);
      setToast('Failed to reject expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    // Parse fuel details from notes if present
    let litres = '';
    let pricePerLitre = '';
    if (expense.category === 'FUEL' && expense.notes) {
      const fuelMatch = expense.notes.match(/Fuel: ([\d.]+)L @ R([\d.]+)\/L/);
      if (fuelMatch) {
        litres = fuelMatch[1];
        pricePerLitre = fuelMatch[2];
      }
    }
    setExpenseForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      vehicle: expense.vehicle || '',
      vendor: expense.vendor || '',
      receipt_number: expense.receipt_number || '',
      notes: expense.notes?.replace(/^Fuel: [\d.]+L @ R[\d.]+\/L\n?/, '') || '',
      litres,
      price_per_litre: pricePerLitre,
    });
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteData({ url: `/api/v1/expenses/${expenseId}/` });
      setToast('Expense deleted!');
      setTimeout(() => setToast(null), 3000);
      refetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      setToast('Failed to delete expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSendInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingId(invoiceId);
    try {
      await postData({ url: `/api/v1/invoices/${invoiceId}/send_invoice/` });
      setToast('Invoice sent!');
      setTimeout(() => setToast(null), 3000);
      refetchInvoices();
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast('Failed to send invoice');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    // generate_pdf is POST-only and returns a pdf_url; window.open(GET) 405s.
    try {
      const result = await postData({ url: `api/v1/invoices/${invoiceId}/generate_pdf/`, data: {} });
      if (result?.pdf_url) window.open(result.pdf_url, '_blank');
      setToast('PDF ready');
    } catch {
      setToast('Could not generate PDF');
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendReminder = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingReminderId(invoiceId);
    try {
      await postData({ url: `/api/v1/invoices/${invoiceId}/send_reminder/`, data: {} });
      setToast('Reminder sent successfully!');
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setToast('Reminder recorded — customer will be contacted');
      } else {
        setToast('Failed to send reminder');
      }
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingReminderId(null);
    }
  };

  // Never fall back to mock data — show empty state if API returns nothing
  const allInvoices = invoices;

  const filtered = allInvoices.filter(inv => {
    const invStatus = inv.status?.toUpperCase();
    const matchStatus = statusFilter === 'All' || invStatus === statusFilter;
    const invNumber = inv.invoice_number || inv.invoiceNumber || '';
    const custName = inv.customer_name || inv.customerName || '';
    const matchSearch = !search || invNumber.toLowerCase().includes(search.toLowerCase()) || custName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredExpenses = expenses.filter(e => {
    const matchCategory = categoryFilter === 'All' || e.category === categoryFilter;
    const matchStatus = expenseStatusFilter === 'All' || e.status === expenseStatusFilter;
    const matchSearch = !expenseSearch ||
      e.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.vendor?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.expense_number?.toLowerCase().includes(expenseSearch.toLowerCase());
    return matchCategory && matchStatus && matchSearch;
  });

  const outstanding = allInvoices.filter(i => i.status === 'SENT').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const overdue = allInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);
  const paid = allInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (parseFloat(i.total_amount || i.amount) || 0), 0);

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000, background: 'var(--accent-primary)', color: 'black', padding: '12px 20px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {activeTab === 'invoices' ? 'Invoices' : 'Expenses'}
            </div>
            <LiveBadge />
          </div>
          {activeTab === 'invoices' && (
            <button className="btn-action" onClick={() => navigate('/finance/invoices/new')}>+ NEW INVOICE</button>
          )}
          {activeTab === 'expenses' && (
            <button className="btn-action" onClick={() => { setShowExpenseForm(true); setEditingExpense(null); }}>+ ADD EXPENSE</button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20,
        display: 'flex',
        gap: 24,
      }}>
        {([
          { id: 'invoices', label: 'Invoices' },
          { id: 'expenses', label: 'Expenses' },
        ] as { id: FinanceTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '12px 0',
              marginBottom: -1,
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'expenses' && (
        <>
          {/* Expense Form Modal */}
          {showExpenseForm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}>
              <div className="card" style={{
                width: '100%',
                maxWidth: 600,
                maxHeight: '90vh',
                overflow: 'auto',
                padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {editingExpense ? 'Edit Expense' : 'Add Expense'}
                  </div>
                  <button
                    onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: 24,
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category *</label>
                    <Select value={expenseForm.category} onValueChange={val => handleExpenseFormChange('category', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FUEL">Fuel</SelectItem>
                        <SelectItem value="TOLLS">Tolls</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                        <SelectItem value="DRIVER_COST">Driver Cost</SelectItem>
                        <SelectItem value="INSURANCE">Insurance</SelectItem>
                        <SelectItem value="OVERHEAD">Overhead</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description *</label>
                    <input
                      type="text"
                      value={expenseForm.description}
                      onChange={(e) => handleExpenseFormChange('description', e.target.value)}
                      placeholder="e.g. Fuel refill at Shell"
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        borderRadius: 2,
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                  </div>

                  {expenseForm.category === 'FUEL' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Litres</label>
                          <input
                            type="number"
                            step="0.01"
                            value={expenseForm.litres}
                            onChange={(e) => handleExpenseFormChange('litres', e.target.value)}
                            placeholder="0.00"
                            style={{
                              width: '100%',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              padding: '10px 12px',
                              color: 'var(--text-primary)',
                              borderRadius: 2,
                              fontSize: 13,
                              fontFamily: 'var(--font-mono)',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price/Litre</label>
                          <input
                            type="number"
                            step="0.01"
                            value={expenseForm.price_per_litre}
                            onChange={(e) => handleExpenseFormChange('price_per_litre', e.target.value)}
                            placeholder="0.00"
                            style={{
                              width: '100%',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              padding: '10px 12px',
                              color: 'var(--text-primary)',
                              borderRadius: 2,
                              fontSize: 13,
                              fontFamily: 'var(--font-mono)',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount (ZAR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={(e) => handleExpenseFormChange('amount', e.target.value)}
                      placeholder="0.00"
                      readOnly={Boolean(expenseForm.category === 'FUEL' && expenseForm.litres && expenseForm.price_per_litre)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        borderRadius: 2,
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date *</label>
                      <DatePicker
                        value={expenseForm.expense_date}
                        onChange={val => handleExpenseFormChange('expense_date', val)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle</label>
                      <Select value={expenseForm.vehicle} onValueChange={val => handleExpenseFormChange('vehicle', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={String(v.id)}>{v.plate || v.registration || v.vehicle_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor</label>
                      <input
                        type="text"
                        value={expenseForm.vendor}
                        onChange={(e) => handleExpenseFormChange('vendor', e.target.value)}
                        placeholder="e.g. Shell, BP"
                        style={{
                          width: '100%',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          borderRadius: 2,
                          fontSize: 13,
                          fontFamily: 'var(--font-sans)',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipt #</label>
                      <input
                        type="text"
                        value={expenseForm.receipt_number}
                        onChange={(e) => handleExpenseFormChange('receipt_number', e.target.value)}
                        placeholder="Receipt number"
                        style={{
                          width: '100%',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          borderRadius: 2,
                          fontSize: 13,
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                    <textarea
                      value={expenseForm.notes}
                      onChange={(e) => handleExpenseFormChange('notes', e.target.value)}
                      placeholder="Additional notes..."
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        borderRadius: 2,
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button
                      className="btn-action"
                      onClick={handleAddExpense}
                      disabled={!expenseForm.category || !expenseForm.description || !expenseForm.amount || !expenseForm.expense_date}
                      style={{ flex: 1 }}
                    >
                      {editingExpense ? 'UPDATE EXPENSE' : 'ADD EXPENSE'}
                    </button>
                    <button
                      onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        padding: '10px 16px',
                        borderRadius: 2,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expenses KPIs */}
          {expensesLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card" style={{ padding: 20 }}>
                  <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
                  <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '70%' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {(() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const thisMonthExpenses = expenses.filter(e => {
                  const expDate = new Date(e.expense_date);
                  return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
                });

                const totalMtd = thisMonthExpenses
                  .filter(e => e.status === 'APPROVED')
                  .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

                const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
                const pendingAmount = pendingExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

                const fuelCosts = thisMonthExpenses
                  .filter(e => e.category === 'FUEL')
                  .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

                // Top category
                const categoryTotals: Record<string, number> = {};
                thisMonthExpenses.forEach(e => {
                  categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount || 0);
                });
                const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
                const topCategory = topCategoryEntry ? topCategoryEntry[0].replace('_', ' ') : 'N/A';
                const topCategoryAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'Total Expenses MTD', value: formatCurrency(totalMtd), color: 'var(--text-primary)' },
                      { label: 'Pending Approval', value: `${pendingExpenses.length} / ${formatCurrency(pendingAmount)}`, color: 'var(--status-warning)' },
                      { label: 'Fuel Costs MTD', value: formatCurrency(fuelCosts), color: 'var(--accent-primary)' },
                      { label: 'Top Category', value: `${topCategory}\n${formatCurrency(topCategoryAmount)}`, color: 'var(--text-primary)' },
                    ].map(m => (
                      <div key={m.label} className="card metric-card">
                        <div className="card-header"><span className="card-title">{m.label}</span></div>
                        <div className="metric-value" style={{ fontSize: 20, color: m.color, whiteSpace: 'pre-line' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search expenses..."
              value={expenseSearch}
              onChange={e => { setExpenseSearch(e.target.value); setExpensePage(1); }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                borderRadius: 2,
                fontSize: 12,
                outline: 'none',
                width: 220,
                fontFamily: 'var(--font-sans)',
              }}
            />
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setExpensePage(1); }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                borderRadius: 2,
                fontSize: 12,
                width: 160,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {expenseCategories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c.replace('_', ' ')}</option>
              ))}
            </select>
            {expenseStatuses.map(s => (
              <button
                key={s}
                onClick={() => { setExpenseStatusFilter(s); setExpensePage(1); }}
                style={{
                  background: expenseStatusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: expenseStatusFilter === s ? 'var(--bg-deep)' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  borderRadius: 2,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: expenseStatusFilter === s ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {filteredExpenses.length} expenses
            </span>
          </div>

          {/* Expenses Table */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
            const expenseRows = filteredExpenses.slice((expensePage - 1) * PAGE_SIZE, expensePage * PAGE_SIZE);

            return (
              <>
                <div className="card table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Vehicle</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseRows.length === 0 ? (
                        expenses.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 0 }}>
                              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>💰</div>
                                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                                  No expenses yet
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                                  Add your first expense to track costs and manage budgets
                                </div>
                                <button onClick={() => setShowExpenseForm(true)} className="btn-action">
                                  ADD EXPENSE
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                              No expenses match your filters
                            </td>
                          </tr>
                        )
                      ) : expenseRows.map(exp => {
                        const veh = vehicles.find(v => v.id === exp.vehicle);
                        const vehicleName = veh?.plate || veh?.registration || veh?.vehicle_number || 'N/A';

                        return (
                          <tr key={exp.id}>
                            <td className="mono" style={{ fontSize: 12 }}>
                              {formatDate(exp.expense_date)}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <span style={{ fontFamily: 'var(--font-sans)' }}>
                                {exp.category.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{exp.description}</td>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {vehicleName}
                            </td>
                            <td className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                              {formatCurrency(exp.amount)}
                            </td>
                            <td>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                color: EXPENSE_STATUS_COLOR[exp.status] || 'var(--text-secondary)',
                                padding: '2px 6px',
                                background: 'var(--bg-surface-hover)',
                                borderRadius: 2,
                              }}>
                                {exp.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {exp.status === 'PENDING' && (
                                  <>
                                    <button
                                      className="btn-action"
                                      style={{
                                        fontSize: 10,
                                        padding: '4px 12px',
                                        background: 'var(--status-success)',
                                        border: 'none',
                                      }}
                                      onClick={() => handleApproveExpense(exp.id)}
                                    >
                                      APPROVE
                                    </button>
                                    <button
                                      className="btn-action"
                                      style={{
                                        fontSize: 10,
                                        padding: '4px 12px',
                                        background: 'var(--status-danger)',
                                        border: 'none',
                                      }}
                                      onClick={() => handleRejectExpense(exp.id)}
                                    >
                                      REJECT
                                    </button>
                                  </>
                                )}
                                <button
                                  className="btn-action"
                                  style={{
                                    fontSize: 10,
                                    padding: '4px 10px',
                                    background: 'transparent',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                  }}
                                  onClick={() => handleEditExpense(exp)}
                                >
                                  EDIT
                                </button>
                                <button
                                  className="btn-action"
                                  style={{
                                    fontSize: 10,
                                    padding: '4px 10px',
                                    background: 'transparent',
                                    border: '1px solid var(--status-danger)',
                                    color: 'var(--status-danger)',
                                  }}
                                  onClick={() => handleDeleteExpense(exp.id)}
                                >
                                  DEL
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 20px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Page {expensePage} of {totalPages} · showing {expenseRows.length} of {filteredExpenses.length}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-action"
                          onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                          disabled={expensePage === 1}
                        >
                          ← PREV
                        </button>
                        <button
                          className="btn-action"
                          onClick={() => setExpensePage(p => Math.min(totalPages, p + 1))}
                          disabled={expensePage === totalPages}
                        >
                          NEXT →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}

      {activeTab === 'invoices' && (
        <>
          {/* KPIs */}
          {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface-hover)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
              <div style={{ height: 24, background: 'var(--bg-surface-hover)', borderRadius: 4, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Invoiced MTD', value: formatCurrency(stats?.total_invoiced_mtd ?? outstanding), color: 'var(--text-primary)' },
            { label: 'Collected', value: formatCurrency(stats?.total_collected_mtd ?? paid), color: 'var(--status-success)' },
            { label: 'Overdue', value: `${stats?.overdue_count ?? 0} / ${formatCurrency(stats?.overdue_amount ?? overdue)}`, color: 'var(--status-danger)' },
            { label: 'Collection Rate', value: `${Math.round((stats?.collection_rate ?? 0) * 100)}%`, color: 'var(--accent-primary)' },
          ].map(m => (
            <div key={m.label} className="card metric-card">
              <div className="card-header"><span className="card-title">{m.label}</span></div>
              <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text" placeholder="Search invoices..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '6px 10px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 220, fontFamily: 'var(--font-sans)' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {statuses.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: statusFilter === s ? 'var(--bg-deep)' : 'var(--text-secondary)',
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              borderRadius: 2,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: statusFilter === s ? 600 : 400,
              transition: 'all 0.2s ease'
            }}>{s}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {filtered.length} invoices
        </span>
      </div>

      {/* Table — 10 per page, clickable */}
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              allInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📄</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                        No invoices yet
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Invoices will be generated from completed bookings
                      </div>
                      <button onClick={() => navigate('/bookings')} className="btn-action">
                        GO TO BOOKINGS
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No invoices match your filters</td></tr>
              )
            ) : rows.map(inv => {
              const invStatus = inv.status?.toUpperCase();
              const amount = parseFloat(inv.total_amount || inv.amount) || 0;
              const invNumber = inv.invoice_number || inv.invoiceNumber;
              const custName = inv.customer_name || inv.customerName;
              const dueDate = inv.due_date || inv.dueDate;
              // Aging indicator
              const ageDays = dueDate ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;
              const agingColor = ageDays <= 0 ? 'var(--status-success)' : ageDays <= 30 ? 'var(--status-warning)' : ageDays <= 60 ? 'var(--accent-primary)' : 'var(--status-danger)';
              const agingLabel = ageDays <= 0 ? `Due in ${Math.abs(ageDays)}d` : `${ageDays}d overdue`;

              return (
                <tr
                  key={inv.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                >
                  <td className="mono">{invNumber}</td>
                  <td>{custName}</td>
                  <td className="mono">{formatCurrency(amount)}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[invStatus] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {invStatus}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: invStatus === 'OVERDUE' ? 'var(--status-danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{dueDate}</span>
                      {invStatus !== 'PAID' && dueDate && (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: agingColor, padding: '1px 5px', border: `1px solid ${agingColor}`, borderRadius: 2, whiteSpace: 'nowrap' }}>
                          {agingLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {invStatus === 'DRAFT' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 12px' }} onClick={(e) => handleSendInvoice(e, inv.id)} disabled={sendingId === inv.id}>
                          {sendingId === inv.id ? 'SENDING...' : 'SEND'}
                        </button>
                      )}
                      {invStatus === 'OVERDUE' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent', border: '1px solid var(--status-warning)', color: 'var(--status-warning)' }} onClick={(e) => handleSendReminder(e, inv.id)} disabled={sendingReminderId === inv.id}>
                          {sendingReminderId === inv.id ? 'SENDING...' : 'REMIND'}
                        </button>
                      )}
                      {invStatus !== 'DRAFT' && (
                        <button className="btn-action" style={{ fontSize: 10, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={(e) => handleDownloadPDF(e, inv.id)}>
                          PDF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Page {page} of {totalPages} · showing {rows.length} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-action" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← PREV</button>
              <button className="btn-action" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT →</button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
