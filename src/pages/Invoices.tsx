import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import { calculateDaysAge } from "@/lib/constants";
import useFetch from "@/hooks/useFetch";
import { useNavigate } from "react-router-dom";

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name?: string;
  total_amount: number;
  status: string;
  due_date: string;
  created_at: string;
}

export default function Invoices() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch invoices from API
  const { data: invoicesData, isLoading, error } = useFetch<{ results: Invoice[]; count: number }>("/api/invoices/");

  const invoices = invoicesData?.results || [];
  const totalCount = invoicesData?.count || 0;

  // Calculate KPIs from real data
  const calculateKPIs = () => {
    const outstanding = invoices
      .filter(inv => inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID')
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    const overdue = invoices.filter(inv => inv.status === 'OVERDUE');
    const overdueAmount = overdue.reduce((sum, inv) => sum + inv.total_amount, 0);

    const paidThisMonth = invoices
      .filter(inv => {
        if (inv.status !== 'PAID') return false;
        const paidDate = new Date(inv.created_at);
        const now = new Date();
        return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    const avgDSO = invoices.length > 0
      ? invoices
          .filter(inv => inv.status !== 'DRAFT' && inv.status !== 'CANCELLED')
          .reduce((sum, inv) => sum + calculateDaysAge(inv.created_at), 0) / invoices.length
      : 0;

    return { outstanding, overdueAmount, overdueCount: overdue.length, paidThisMonth, avgDSO };
  };

  const kpis = calculateKPIs();

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = statusFilter === "All" || invoice.status === statusFilter;
    const matchesSearch = !searchQuery ||
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRowClick = (invoiceId: number) => {
    navigate(`/finance/invoices/${invoiceId}`);
  };

  const handleCreateInvoice = () => {
    navigate('/finance/invoices/new');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#EF4444]">Error loading invoices. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0F172A]">Invoices</h1>
        <Button
          onClick={handleCreateInvoice}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Outstanding */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Outstanding</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={kpis.outstanding} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">{filteredInvoices.filter(i => i.status === 'SENT' || i.status === 'PARTIALLY_PAID').length} invoices</span>
            </div>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Overdue</p>
            <p className="text-3xl font-mono font-medium text-[#EF4444]">
              {kpis.overdueCount}
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#EF4444] font-medium">
                <CurrencyDisplay amount={kpis.overdueAmount} />
              </span>
            </div>
          </div>
        </Card>

        {/* Paid This Month */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Paid This Month</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={kpis.paidThisMonth} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#10B981] font-medium">On track</span>
            </div>
          </div>
        </Card>

        {/* Average DSO */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Average DSO</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              {Math.round(kpis.avgDSO)} days
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">Days Sales Outstanding</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Search invoices or customers..."
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
                  Invoice #
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Customer
                </th>
                <th className="text-right py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Amount
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Due Date
                </th>
                <th className="text-right py-4 px-6 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Age (days)
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748B]">
                    No invoices found. Create your first invoice to get started.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => handleRowClick(invoice.id)}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 text-sm font-medium text-[#0F172A]">
                      {invoice.invoice_number || `INV-${invoice.id}`}
                    </td>
                    <td className="py-4 px-6 text-sm text-[#0F172A]">
                      {invoice.customer_name || "N/A"}
                    </td>
                    <td className="py-4 px-6 text-sm text-right">
                      <CurrencyDisplay amount={invoice.total_amount} />
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="py-4 px-6 text-sm text-[#0F172A]">
                      {new Date(invoice.due_date).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6 text-sm font-mono text-[#64748B] text-right">
                      {calculateDaysAge(invoice.created_at)}
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
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
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
