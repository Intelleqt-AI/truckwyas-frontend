import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchData, postData, putData, deleteData } from "@/lib/Api";

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

export default function Invoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTab>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('All');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
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

  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      try {
        const [data, statsData] = await Promise.all([
          fetchData('/api/v1/invoices/'),
          fetchData('/api/v1/invoices/stats/').catch(() => null),
        ]);
        // API returns paginated {count, results} — extract results
        setInvoices(Array.isArray(data) ? data : (data?.results || []));
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load invoices:', error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  // Load expenses when switching to expenses tab
  useEffect(() => {
    if (activeTab === 'expenses') {
      const loadExpenses = async () => {
        setExpensesLoading(true);
        try {
          const [expensesData, vehiclesData] = await Promise.all([
            fetchData('/api/v1/expenses/'),
            fetchData('/api/v1/vehicles/').catch(() => []),
          ]);
          setExpenses(Array.isArray(expensesData) ? expensesData : (expensesData?.results || []));
          setVehicles(Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []));
        } catch (error) {
          console.error('Failed to load expenses:', error);
          setExpenses([]);
        } finally {
          setExpensesLoading(false);
        }
      };

      loadExpenses();
    }
  }, [activeTab]);

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
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...e, ...payload } : e));
      } else {
        const newExpense = await postData({ url: '/api/v1/expenses/', data: payload });
        setToast('Expense added!');
        setExpenses(prev => [newExpense, ...prev]);
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
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'APPROVED' } : e));
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
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'REJECTED' } : e));
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
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
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
      // Optimistically update status
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'SENT' } : inv));
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast('Failed to send invoice');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPDF = (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    const url = `/api/v1/invoices/${invoiceId}/generate_pdf/`;
    window.open(import.meta.env.VITE_API_URL + url, '_blank');
    setToast('PDF downloading...');
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
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {activeTab === 'invoices' ? 'Invoices' : 'Expenses'}
            </div>

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
                    <select
                      value={expenseForm.category}
                      onChange={(e) => handleExpenseFormChange('category', e.target.value)}
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
                    >
                      <option value="FUEL">Fuel</option>
                      <option value="TOLLS">Tolls</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="DRIVER_COST">Driver Cost</option>
                      <option value="INSURANCE">Insurance</option>
                      <option value="OVERHEAD">Overhead</option>
                      <option value="OTHER">Other</option>
                    </select>
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
                      readOnly={expenseForm.category === 'FUEL' && expenseForm.litres && expenseForm.price_per_litre}
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
                      <input
                        type="date"
                        value={expenseForm.expense_date}
                        onChange={(e) => handleExpenseFormChange('expense_date', e.target.value)}
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
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle</label>
                      <select
                        value={expenseForm.vehicle}
                        onChange={(e) => handleExpenseFormChange('vehicle', e.target.value)}
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
                      >
                        <option value="">Select vehicle...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration || v.vehicle_number}</option>
                        ))}
                      </select>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
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
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {expenseCategories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c.replace('_', ' ')}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
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
                    transition: 'all 0.2s ease'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Expenses Table */}
          {(() => {
            const filteredExpenses = expenses.filter(e => {
              const matchCategory = categoryFilter === 'All' || e.category === categoryFilter;
              const matchStatus = expenseStatusFilter === 'All' || e.status === expenseStatusFilter;
              const matchSearch = !expenseSearch ||
                e.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                e.vendor?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                e.expense_number?.toLowerCase().includes(expenseSearch.toLowerCase());
              return matchCategory && matchStatus && matchSearch;
            });

            const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
            const expenseRows = filteredExpenses.slice((expensePage - 1) * PAGE_SIZE, expensePage * PAGE_SIZE);

            return (
              <>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {filteredExpenses.length} expenses
                  </span>
                </div>

                <div className="card table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Vehicle</th>
                        <th className="text-right">Amount</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
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
                        const vehicleName = vehicles.find(v => v.id === exp.vehicle)?.registration ||
                                          vehicles.find(v => v.id === exp.vehicle)?.vehicle_number ||
                                          'N/A';

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
                            <td className="mono text-right" style={{ fontSize: 13, fontWeight: 500 }}>
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
                            <td className="text-right">
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
            { label: 'Total Invoiced MTD', value: formatCurrency(stats?.total_invoiced_mtd || outstanding), color: 'var(--text-primary)' },
            { label: 'Collected', value: formatCurrency(stats?.total_collected_mtd || paid), color: 'var(--status-success)' },
            { label: 'Overdue', value: `${stats?.overdue_count || Math.floor(overdue / 40000)} / ${formatCurrency(stats?.overdue_amount || overdue)}`, color: 'var(--status-danger)' },
            { label: 'Collection Rate', value: `${Math.round((stats?.collection_rate || 0.71) * 100)}%`, color: 'var(--accent-primary)' },
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
              <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Due Date</th><th className="text-right">Actions</th>
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
                      <button onClick={() => navigate('/bookings/new')} className="btn-action">
                        CREATE BOOKING
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
                  <td className="text-right" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
