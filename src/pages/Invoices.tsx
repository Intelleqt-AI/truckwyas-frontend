import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Plus, Search, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { RiskBadge } from "@/components/capital/RiskBadge";
import { FastPayModal } from "@/components/capital/FastPayModal";
import { calculateDaysAge } from "@/lib/constants";
import { calculateRiskScore, type RiskScoreResult } from "@/lib/risk-engine";
import { MOCK_INVOICES, MOCK_CUSTOMERS, FACILITY_DATA, getCustomerById } from "@/lib/mock-capital-data";
import { formatCurrency } from "@/lib/formatters";
import useFetch from "@/hooks/useFetch";
import { useNavigate } from "react-router-dom";

interface Invoice {
  id: number | string;
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
  const [selectedInvoiceForFastPay, setSelectedInvoiceForFastPay] = useState<string | null>(null);
  const [showFastPayModal, setShowFastPayModal] = useState(false);
  const itemsPerPage = 10;

  // Try to fetch real invoices from API, fall back to mock data
  const { data: invoicesData, isLoading, error } = useFetch<{ results: Invoice[]; count: number }>(
    "/api/invoices/",
    { retry: false }
  );

  // Use mock data if API fails or returns empty
  const useMockData = error || !invoicesData || invoicesData.results?.length === 0;

  const invoices = useMemo(() => {
    if (useMockData) {
      // Map mock data to Invoice interface
      return MOCK_INVOICES.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        customer_name: inv.customerName,
        total_amount: inv.amount,
        status: inv.status,
        due_date: inv.dueDate,
        created_at: inv.createdDate
      }));
    }
    return invoicesData?.results || [];
  }, [useMockData, invoicesData]);

  const totalCount = invoices.length;

  // Calculate risk scores for all invoices (memoized for performance)
  const invoiceRiskScores = useMemo(() => {
    if (!useMockData) return {};

    const scores: Record<string, RiskScoreResult> = {};

    MOCK_INVOICES.forEach(mockInv => {
      const customer = getCustomerById(mockInv.customerId);
      if (!customer) return;

      try {
        const riskResult = calculateRiskScore(
          {
            invoiceId: mockInv.id,
            customerId: mockInv.customerId,
            customerName: mockInv.customerName,
            amount: mockInv.amount,
            createdDate: mockInv.createdDate,
            dueDate: mockInv.dueDate,
            status: mockInv.status as any,
            ageInDays: mockInv.ageInDays
          },
          {
            totalInvoices: customer.totalInvoices,
            onTimeCount: customer.onTimeCount,
            avgDaysLate: customer.avgDaysLate,
            hasActiveDispute: customer.hasActiveDispute
          },
          {
            method: mockInv.podMethod,
            allFieldsComplete: mockInv.podComplete,
            hasQualityIssues: mockInv.podQualityIssues
          },
          {
            rating: customer.creditRating,
            hasBankruptcy: customer.hasBankruptcy
          },
          {
            firstTransactionDate: customer.firstTransactionDate,
            transactionCount: customer.totalInvoices
          },
          {
            facilityLimit: FACILITY_DATA.facilityLimit,
            currentOutstanding: FACILITY_DATA.currentOutstanding,
            invoiceAmount: mockInv.amount
          }
        );

        scores[mockInv.id] = riskResult;
      } catch (err) {
        // Risk calculation failed for this invoice
      }
    });

    return scores;
  }, [useMockData]);

  // Calculate KPIs from data
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

    // Count eligible for fast pay
    const eligibleCount = Object.values(invoiceRiskScores).filter(r => r.isEligible).length;

    return { outstanding, overdueAmount, overdueCount: overdue.length, paidThisMonth, avgDSO, eligibleCount };
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

  const handleRowClick = (invoiceId: number | string) => {
    navigate(`/finance/invoices/${invoiceId}`);
  };

  const handleCreateInvoice = () => {
    navigate('/finance/invoices/new');
  };

  const handleFastPayClick = (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation(); // Prevent row click
    setSelectedInvoiceForFastPay(invoiceId);
    setShowFastPayModal(true);
  };

  const selectedRiskResult = selectedInvoiceForFastPay ? invoiceRiskScores[selectedInvoiceForFastPay] : null;
  const selectedInvoice = selectedInvoiceForFastPay
    ? MOCK_INVOICES.find(inv => inv.id === selectedInvoiceForFastPay)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="space-y-4 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#64748B]">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Invoices</h1>
          {useMockData && (
            <p className="text-sm text-[#F59E0B] mt-1">
              Demo Mode: Showing sample data with risk scoring
            </p>
          )}
        </div>
        <Button
          onClick={handleCreateInvoice}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Total Outstanding</div>
            <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {formatCurrency(kpis.outstanding)}
            </div>
            <div className="text-sm text-[#64748B] mt-1">
              {filteredInvoices.filter(i => i.status === 'SENT' || i.status === 'PARTIALLY_PAID').length} invoices
            </div>
          </div>
        </Card>

        {/* Eligible for Fast Pay */}
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-[#94A3B8] mb-1">
              <Zap className="w-3 h-3 text-[#10B981]" />
              <span>Fast Pay Eligible</span>
            </div>
            <div className="text-2xl font-semibold text-[#10B981] font-mono tabular-nums">
              {kpis.eligibleCount}
            </div>
            <div className="text-sm text-[#64748B] mt-1">
              invoices ready for advance
            </div>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Overdue</div>
            <div className="text-2xl font-semibold text-[#EF4444] font-mono tabular-nums">
              {kpis.overdueCount}
            </div>
            <div className="text-sm text-[#EF4444] mt-1">
              {formatCurrency(kpis.overdueAmount)}
            </div>
          </div>
        </Card>

        {/* Average DSO */}
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Average DSO</div>
            <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {Math.round(kpis.avgDSO)}
            </div>
            <div className="text-sm text-[#64748B] mt-1">
              Days Sales Outstanding
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="p-4 flex gap-4">
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
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-4 px-6 text-xs text-[#94A3B8]">
                  Invoice #
                </th>
                <th className="text-left py-4 px-6 text-xs text-[#94A3B8]">
                  Customer
                </th>
                <th className="text-right py-4 px-6 text-xs text-[#94A3B8]">
                  Amount
                </th>
                <th className="text-left py-4 px-6 text-xs text-[#94A3B8]">
                  Status
                </th>
                {useMockData && (
                  <th className="text-left py-4 px-6 text-xs text-[#94A3B8]">
                    Risk
                  </th>
                )}
                <th className="text-left py-4 px-6 text-xs text-[#94A3B8]">
                  Due Date
                </th>
                <th className="text-right py-4 px-6 text-xs text-[#94A3B8]">
                  Age
                </th>
                {useMockData && (
                  <th className="text-right py-4 px-6 text-xs text-[#94A3B8]">
                    Fast Pay
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={useMockData ? 8 : 6} className="py-12 text-center text-[#64748B]">
                    No invoices found. Create your first invoice to get started.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const riskResult = invoiceRiskScores[invoice.id];

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => handleRowClick(invoice.id)}
                      className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 text-sm font-medium text-[#0F172A]">
                        {invoice.invoice_number || `INV-${invoice.id}`}
                      </td>
                      <td className="py-4 px-6 text-sm text-[#0F172A]">
                        {invoice.customer_name || "N/A"}
                      </td>
                      <td className="py-4 px-6 text-sm text-right font-mono tabular-nums text-[#0F172A]">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={invoice.status} />
                      </td>
                      {useMockData && (
                        <td className="py-4 px-6">
                          {riskResult ? (
                            <RiskBadge
                              tier={riskResult.riskTier}
                              score={riskResult.riskScore}
                              showScore={false}
                              size="sm"
                            />
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-4 px-6 text-sm text-[#0F172A]">
                        {new Date(invoice.due_date).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono text-[#64748B] text-right">
                        {calculateDaysAge(invoice.created_at)}d
                      </td>
                      {useMockData && (
                        <td className="py-4 px-6 text-right">
                          {riskResult && riskResult.isEligible ? (
                            <Button
                              size="sm"
                              className="bg-[#10B981] hover:bg-[#059669] text-white"
                              onClick={(e) => handleFastPayClick(e, invoice.id as string)}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Fast Pay
                            </Button>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">Not eligible</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0]">
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

      {/* Fast Pay Modal */}
      {selectedRiskResult && selectedInvoice && (
        <FastPayModal
          isOpen={showFastPayModal}
          onClose={() => {
            setShowFastPayModal(false);
            setSelectedInvoiceForFastPay(null);
          }}
          riskResult={selectedRiskResult}
          invoiceNumber={selectedInvoice.invoiceNumber}
          customerName={selectedInvoice.customerName}
        />
      )}
    </div>
  );
}
