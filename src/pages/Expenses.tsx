import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpRight, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  trip_id?: number;
  trip_number?: string;
  status: string;
}

export default function Expenses() {
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const itemsPerPage = 10;

  // Fetch expenses from API
  const { data: expensesData, isLoading, refetch } = useFetch<{ results: Expense[]; count: number }>("/api/expenses/");

  const expenses = expensesData?.results || [];

  // Calculate KPIs from real data
  const calculateKPIs = () => {
    const now = new Date();
    const currentMonthExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    });

    const totalExpensesMTD = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const fuelCostsMTD = currentMonthExpenses
      .filter(exp => exp.category === 'FUEL')
      .reduce((sum, exp) => sum + exp.amount, 0);

    const pendingApproval = expenses.filter(exp => exp.status === 'PENDING');
    const pendingAmount = pendingApproval.reduce((sum, exp) => sum + exp.amount, 0);

    return {
      totalExpensesMTD,
      fuelCostsMTD,
      pendingCount: pendingApproval.length,
      pendingAmount,
    };
  };

  const kpis = calculateKPIs();

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.trip_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getCategoryIcon = (category: string) => {
    const cat = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES];
    return cat?.icon || "📋";
  };

  const getCategoryLabel = (category: string) => {
    const cat = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES];
    return cat?.label || category;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Expenses</h1>
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <AddExpenseModal onClose={() => { setIsAddExpenseOpen(false); refetch(); }} />
        </Dialog>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Expenses MTD */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Expenses MTD</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={kpis.totalExpensesMTD} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">Month to date</span>
            </div>
          </div>
        </Card>

        {/* Fuel Costs MTD */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Fuel Costs MTD</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={kpis.fuelCostsMTD} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">
                {kpis.totalExpensesMTD > 0 ? ((kpis.fuelCostsMTD / kpis.totalExpensesMTD) * 100).toFixed(1) : 0}% of total
              </span>
            </div>
          </div>
        </Card>

        {/* Pending Approval */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Pending Approval</p>
            <p className="text-3xl font-mono font-medium text-[#F59E0B]">
              {kpis.pendingCount}
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">
                <CurrencyDisplay amount={kpis.pendingAmount} />
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="FUEL">⛽ Fuel</SelectItem>
              <SelectItem value="TOLLS">🛣️ Tolls</SelectItem>
              <SelectItem value="MAINTENANCE">🔧 Maintenance</SelectItem>
              <SelectItem value="DRIVER">👤 Driver</SelectItem>
              <SelectItem value="INSURANCE">🛡️ Insurance</SelectItem>
              <SelectItem value="OVERHEAD">📋 Overhead</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card className="bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Description
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Trip
                </th>
                <th className="text-right py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Amount
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748B]">
                    No expenses found. Add your first expense to get started.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="py-4 px-6 text-sm text-[#0F172A]">
                      {new Date(expense.date).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCategoryIcon(expense.category)}</span>
                        <span className="text-sm text-[#0F172A]">{getCategoryLabel(expense.category)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-[#0F172A]">{expense.description}</td>
                    <td className="py-4 px-6 text-sm text-[#0F172A]">
                      {expense.trip_number || (expense.trip_id ? `TRIP-${expense.trip_id}` : "—")}
                    </td>
                    <td className="py-4 px-6 text-sm text-right">
                      <CurrencyDisplay amount={expense.amount} />
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={expense.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#F1F5F9]">
            <p className="text-sm text-[#64748B]">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredExpenses.length)} of {filteredExpenses.length} expenses
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Add Expense Modal Component
function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");
  const [tripId, setTripId] = useState("");

  const { mutate: createExpense, isPending } = usePost();
  const { data: tripsData } = useFetch<{ results: any[] }>("/api/trips/");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expenseData = {
      category,
      amount: parseFloat(amount),
      date,
      description,
      trip_id: tripId ? parseInt(tripId) : null,
      status: "PENDING",
    };

    createExpense(
      { url: "/api/expenses/", data: expenseData },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add Expense</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FUEL">⛽ Fuel</SelectItem>
              <SelectItem value="TOLLS">🛣️ Tolls</SelectItem>
              <SelectItem value="MAINTENANCE">🔧 Maintenance</SelectItem>
              <SelectItem value="DRIVER">👤 Driver</SelectItem>
              <SelectItem value="INSURANCE">🛡️ Insurance</SelectItem>
              <SelectItem value="OVERHEAD">📋 Overhead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount (ZAR)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="trip">Trip (optional)</Label>
          <Select value={tripId} onValueChange={setTripId}>
            <SelectTrigger id="trip">
              <SelectValue placeholder="Select trip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No trip</SelectItem>
              {tripsData?.results?.map((trip: any) => (
                <SelectItem key={trip.id} value={trip.id.toString()}>
                  {trip.trip_number || `TRIP-${trip.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Enter expense details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
            {isPending ? "Adding..." : "Add Expense"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
